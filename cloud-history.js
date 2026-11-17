/* Bounded immutable document history. Publication and cleanup share one project lock. */
let workspaceHistoryLimit = 5;
let workspaceHistorySettingsRev = null;
let workspaceHistorySettingsAccount = '';

async function loadWorkspaceHistorySettings() {
  requireDropboxConnection();
  const accountId = dropboxConnection.accountId;
  let limit = 5; let rev = null;
  try {
    const file = await dropboxRequest('files/download', { path: '/workspace-settings.json' }, { download: true });
    const settings = JSON.parse(file.text);
    if (settings.type !== 'capsanoto-workspace-settings' || settings.schemaVersion !== 1 || !Number.isInteger(settings.documentHistoryLimit) || settings.documentHistoryLimit < 0 || settings.documentHistoryLimit > 100) throw new Error('Workspace history settings could not be read. History cleanup is stopped.');
    limit = settings.documentHistoryLimit; rev = file.metadata.rev;
  } catch (error) { if (!error.notFound) throw error; }
  assertDropboxAccount(accountId);
  workspaceHistoryLimit = limit; workspaceHistorySettingsRev = rev; workspaceHistorySettingsAccount = accountId;
  const input = document.getElementById('workspaceHistoryLimit');
  if (input) input.value = limit;
  return limit;
}

async function setWorkspaceHistoryLimit(value) {
  if (String(value).trim() === '') throw new Error('Enter the number of previous versions to keep.');
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 0 || limit > 100) throw new Error('Use a whole number from 0 to 100 previous versions.');
  requireDropboxConnection();
  const accountId = dropboxConnection.accountId;
  if (workspaceHistorySettingsAccount !== accountId) await loadWorkspaceHistorySettings();
  const text = JSON.stringify({ type: 'capsanoto-workspace-settings', schemaVersion: 1, documentHistoryLimit: limit }, null, 2);
  let uploaded;
  try { uploaded = await uploadDropboxFile('/workspace-settings.json', text, workspaceHistorySettingsRev); }
  catch (error) {
    if (error.status === 409) throw new Error('Workspace settings changed on another device. Reopen Workspace settings before saving this limit.');
    throw error;
  }
  assertDropboxAccount(accountId);
  workspaceHistoryLimit = limit; workspaceHistorySettingsRev = uploaded.rev; workspaceHistorySettingsAccount = accountId;
  await maintainWorkspaceHistory();
  return limit;
}

async function withDropboxProjectLock(folder, operation) {
  if (!/^\/[^/]+\.caps-project$/.test(folder)) throw new Error('Invalid project folder.');
  const accountId = dropboxConnection.accountId;
  await ensureDropboxFolder(folder);
  const path = `${folder}/.sync-lock.json`;
  let lock;
  try { lock = await uploadDropboxFile(path, JSON.stringify({ type: 'capsanoto-sync-lock', token: crypto.randomUUID(), startedAt: new Date().toISOString() })); }
  catch (error) {
    if (error.status === 409) throw new Error('This project is syncing in another tab or device. If that sync was interrupted, close the other tabs and use Release interrupted sync in Workspace settings.');
    throw error;
  }
  async function assertLock() {
    assertDropboxAccount(accountId);
    if ((await dropboxMetadata(path))?.rev !== lock.rev) throw new Error('The project sync lock changed. This operation stopped.');
  }
  try { return await operation(assertLock); }
  finally {
    if (dropboxConnection?.accountId === accountId) {
      try { await dropboxRequest('files/delete_v2', { path, parent_rev: lock.rev }); }
      catch (error) { if (!error.notFound) setDropboxStatus('The operation finished but its sync lock could not be released. Reconnect and use Release interrupted sync if needed.'); }
    }
  }
}

async function releaseInterruptedProjectSync(entry) {
  if (!entry?.cloud || !entry.path.endsWith('/project.json')) throw new Error('Choose a Dropbox project folder first.');
  const folder = entry.path.slice(0, -'/project.json'.length);
  if (!/^\/[^/]+\.caps-project$/.test(folder)) throw new Error('Invalid project folder.');
  const accountId = dropboxConnection.accountId;
  const path = `${folder}/.sync-lock.json`;
  const lock = await dropboxMetadata(path);
  if (!lock) { setDropboxStatus('This project has no interrupted sync lock.'); return; }
  document.getElementById('projectLibraryDialog')?.close();
  const response = await openCapsDialog('Release interrupted sync', [
    { html: '<p>Close this project on other tabs and devices first. Releasing an active sync can interrupt its work. Type UNLOCK to release this lock only.</p>' },
    { name: 'confirm', label: 'Confirmation' },
  ]);
  if (response?.confirm === 'UNLOCK') {
    assertDropboxAccount(accountId);
    await dropboxRequest('files/delete_v2', { path, parent_rev: lock.rev });
    setDropboxStatus('Interrupted sync released. You can sync again.');
  }
  await openSavedProject();
}

function manifestDocuments(payload) {
  return PROJECT_DOCUMENT_COLLECTIONS.flatMap(collection => payload.project[collection] || []);
}

function validateRetainedHistory(payload, folder, accountId) {
  if (!payload.history) return;
  if (payload.history.schemaVersion !== 1 || !Number.isInteger(payload.history.limit) || payload.history.limit < 0 || payload.history.limit > 100 || !payload.history.documents || typeof payload.history.documents !== 'object' || Array.isArray(payload.history.documents) || !Array.isArray(payload.history.shared) || payload.history.shared.length > 100) throw new Error('The document history index is unreadable. Cleanup stopped.');
  const check = (ref, directory, suffix) => {
    if (!validDocumentBodyRef(ref) || ref.path !== `${folder}/${directory}/${ref.hash}${suffix}`) throw new Error('Unsafe document history link. Cleanup stopped.');
  };
  for (const versions of Object.values(payload.history.documents)) {
    if (!Array.isArray(versions) || versions.length > 100) throw new Error('Invalid document history list.');
    versions.forEach(ref => check(ref, 'documents', '.doc.json'));
  }
  payload.history.shared.forEach(ref => check(ref, 'shared', '.json'));
}

async function readHistorySnapshots(folder, accountId) {
  const files = (await listDropboxFiles(`${folder}/history`)).filter(file => file['.tag'] === 'file' && /^[a-f0-9]{64}\.project\.json$/.test(file.name)).sort((a,b) => b.server_modified.localeCompare(a.server_modified));
  const snapshots = [];
  for (let offset = 0; offset < files.length; offset += 3) {
    const batch = await Promise.all(files.slice(offset, offset + 3).map(async file => {
      const downloaded = await dropboxRequest('files/download', { path: file.path_lower }, { download: true });
      if (await projectFileHash(downloaded.text) !== file.name.split('.')[0]) throw new Error('A recovery index failed its integrity check. History cleanup stopped.');
      const payload = JSON.parse(downloaded.text);
      validateDropboxIndex(payload, folder, accountId); validateRetainedHistory(payload, folder, accountId);
      return { ...file, payload };
    }));
    snapshots.push(...batch);
  }
  return snapshots;
}

function retainedProjectHistory(previous, next, older, limit) {
  const unique = (references, currentHash) => {
    const hashes = new Set([currentHash]);
    return references.filter(ref => ref && !hashes.has(ref.hash) && hashes.add(ref.hash)).slice(0, limit).map(ref => ({ ...ref }));
  };
  const documents = Object.create(null);
  const previousDocuments = new Map(previous ? manifestDocuments(previous).map(doc => [doc.id, doc]) : []);
  for (const doc of manifestDocuments(next)) {
    const candidates = [previousDocuments.get(doc.id)?._body, ...(previous?.history?.documents?.[doc.id] || [])];
    if (!previous?.history) for (const item of older) candidates.push(manifestDocuments(item.payload).find(old => old.id === doc.id)?._body);
    documents[doc.id] = unique(candidates, doc._body.hash);
  }
  const shared = unique([previous?.shared, ...(previous?.history?.shared || []), ...(!previous?.history ? older.map(item => item.payload.shared) : [])], next.shared.hash);
  return { schemaVersion: 1, limit, documents, shared };
}

function historyFileReferences(payload, includeVersions = true) {
  const paths = new Set(manifestDocuments(payload).map(doc => doc._body.path));
  paths.add(payload.shared.path);
  if (includeVersions && payload.history) {
    Object.values(payload.history.documents).flat().forEach(ref => paths.add(ref.path));
    payload.history.shared.forEach(ref => paths.add(ref.path));
  }
  return paths;
}

async function cleanupDropboxProjectHistory(folder, payload, revision, historyPath, assertLock) {
  const accountId = dropboxConnection.accountId;
  const keep = historyFileReferences(payload);
  const snapshots = await readHistorySnapshots(folder, accountId);
  const bodyFiles = [...await listDropboxFiles(`${folder}/documents`), ...await listDropboxFiles(`${folder}/shared`)];
  const available = new Set(bodyFiles.map(file => file.path_lower));
  for (const path of keep) if (!available.has(path.toLowerCase())) throw new Error('A retained document version is missing. History cleanup stopped.');
  let retained = 0;
  const obsoleteIndexes = [];
  for (const snapshot of snapshots) {
    if (snapshot.path_lower === historyPath) continue;
    if (retained < payload.history.limit && [...historyFileReferences(snapshot.payload, false)].every(path => keep.has(path))) retained++;
    else obsoleteIndexes.push(snapshot);
  }
  async function remove(file) {
    await assertLock();
    if ((await dropboxMetadata(`${folder}/project.json`))?.rev !== revision) throw new Error('The project changed during history cleanup. Cleanup stopped.');
    assertDropboxAccount(accountId);
    await dropboxRequest('files/delete_v2', { path: file.path_lower, parent_rev: file.rev });
  }
  // Remove obsolete indexes before their bodies, so interruption cannot leave a
  // retained recovery index pointing at a body deleted by this cleanup.
  for (const file of obsoleteIndexes) await remove(file);
  for (const file of bodyFiles) {
    if (file['.tag'] !== 'file' || keep.has(file.path_lower)) continue;
    const allowedName = file.path_lower.includes('/documents/') ? /^[a-f0-9]{64}\.doc\.json$/.test(file.name) : /^[a-f0-9]{64}\.json$/.test(file.name);
    if (allowedName) await remove(file);
  }
}

async function maintainWorkspaceHistory() {
  requireDropboxConnection();
  const accountId = dropboxConnection.accountId;
  await loadWorkspaceHistorySettings();
  await refreshDropboxProjects();
  const errors = [];
  for (const entry of dropboxProjectCatalogue.filter(item => !item.legacy && !item.needsRecovery)) {
    assertDropboxAccount(accountId);
    const folder = entry.path.slice(0, -'/project.json'.length);
    try {
      const preview = await readDropboxIndex(entry.path, { recovery: false });
      validateRetainedHistory(preview.payload, folder, accountId);
      if (preview.payload.history?.limit === workspaceHistoryLimit) {
        const files = [...await listDropboxFiles(`${folder}/documents`), ...await listDropboxFiles(`${folder}/shared`)];
        const snapshots = await listDropboxFiles(`${folder}/history`);
        const keep = historyFileReferences(preview.payload);
        if (snapshots.filter(file => /^[a-f0-9]{64}\.project\.json$/.test(file.name)).length <= workspaceHistoryLimit + 1 && files.every(file => !/^[a-f0-9]{64}(?:\.doc)?\.json$/.test(file.name) || keep.has(file.path_lower))) continue;
      }
      await withDropboxProjectLock(folder, async assertLock => {
        const loaded = await readDropboxIndex(entry.path, { recovery: false });
        validateRetainedHistory(loaded.payload, folder, accountId);
        let payload = loaded.payload; let rev = loaded.rev;
        const snapshots = await readHistorySnapshots(folder, accountId);
        let historyPath = `${folder}/history/${await projectFileHash(loaded.text)}.project.json`;
        if (!payload.history || payload.history.limit !== workspaceHistoryLimit) {
          payload = { ...payload, previous: null, history: retainedProjectHistory(payload, payload, snapshots, workspaceHistoryLimit) };
          const text = JSON.stringify(payload, null, 2);
          historyPath = `${folder}/history/${await projectFileHash(text)}.project.json`;
          await uploadDropboxImmutableFile(historyPath, text);
          await assertLock();
          rev = (await uploadDropboxFile(entry.path, text, loaded.rev)).rev;
          const key = dropboxBindingKey(payload.project.projectId);
          const binding = await workspaceRecord(key);
          if (binding?.rev === loaded.rev) await storeDropboxBinding(key, { ...binding, rev, historyPath });
        } else if (!snapshots.some(snapshot => snapshot.path_lower === historyPath)) {
          await assertLock();
          await uploadDropboxImmutableFile(historyPath, loaded.text);
        }
        await cleanupDropboxProjectHistory(folder, payload, rev, historyPath, assertLock);
      });
    } catch (error) { errors.push(`${entry.name}: ${error.message}`); }
  }
  if (errors.length) throw new Error('History settings saved; some cleanup needs retry. ' + errors.join(' '));
}
