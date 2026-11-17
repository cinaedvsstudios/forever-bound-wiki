/* Workspace membership and timers belong to the connected account, not the open document. */
let workspaceSyncInterval = 10;

async function restoreWorkspacePreferences() {
  const account = dropboxConnection?.accountId;
  const prefs = account ? await workspaceRecord(`workspace-preferences:${account}`) : null;
  workspaceSyncInterval = Number.isFinite(prefs?.syncIntervalMinutes) ? prefs.syncIntervalMinutes : 10;
  const input = document.getElementById('workspaceSyncInterval');
  if (input) input.value = workspaceSyncInterval;
}

async function setWorkspaceSyncInterval(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 10080) throw new Error('Use a sync interval between 0 and 10080 minutes.');
  requireDropboxConnection();
  const accountId = dropboxConnection.accountId;
  await workspaceRecord(`workspace-preferences:${accountId}`, { syncIntervalMinutes: minutes });
  assertDropboxAccount(accountId);
  workspaceSyncInterval = minutes;
  scheduleDropboxSync({ reset: true });
  return minutes;
}

function scheduleDropboxSync({ reset = false } = {}) {
  if (reset) { clearTimeout(dropboxSyncTimer); dropboxSyncTimer = null; }
  if (dropboxSyncTimer !== null || !dropboxConnection || workspaceSyncInterval <= 0) return;
  dropboxSyncTimer = setTimeout(async () => {
    dropboxSyncTimer = null;
    try {
      if (!dropboxBusy && dropboxConnection?.expiresAt > Date.now() + 10000) await dropboxAction(() => syncWorkspaceProjects());
    } finally { scheduleDropboxSync(); }
  }, workspaceSyncInterval * 60000);
}

async function updateInactiveCloudLinks(sourceRecord, index) {
  const db = await openWorkspaceDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite'); const store = tx.objectStore('records');
      const key = sourceRecord.recordKey || workspaceProjectKey(sourceRecord.projectId, index.workspaceAccountId);
      const request = store.get(key);
      request.onsuccess = () => {
        if (request.result?.json === sourceRecord.json) {
          store.put({ ...request.result, json: JSON.stringify(index) }, key);
          pruneDocumentBodyCache(store);
        }
      };
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

async function syncWorkspaceProjects({ manual = false } = {}) {
  requireDropboxConnection();
  const accountId = dropboxConnection.accountId;
  const changed = manual ? await syncDropboxProject() : false;
  if (!manual) { syncEditorToDocument(false); await writeWorkspaceSnapshot(); }
  const records = await listSavedProjectIndexes();
  let saved = changed ? 1 : 0;
  const errors = [];
  for (const record of records) {
    assertDropboxAccount(accountId);
    if (manual && record.projectId === state.projectId) continue;
    const project = JSON.parse(record.json);
    if (project.cloudSyncPaused || (project.workspaceAccountId && project.workspaceAccountId !== accountId)) continue;
    if (project.workspaceAccountId !== accountId) continue;
    project.workspaceAccountId = accountId;
    try { if (await publishDropboxProject(project, record, { automatic: true })) saved++; }
    catch (error) { errors.push(`${project.writingRoomName}: ${error.message}`); }
  }
  await refreshDropboxProjects();
  try { await maintainWorkspaceHistory(); }
  catch (error) { errors.push(error.message); }
  if (errors.length) setDropboxStatus(`Some projects need review. ${errors.join(' ')}`);
  else if (saved) setDropboxStatus(`Synced ${saved} project(s) · ${new Date().toLocaleString()}`);
  else {
    const newer = [];
    for (const entry of dropboxProjectCatalogue) {
      if (!entry.projectId || !entry.rev) continue;
      const binding = await workspaceRecord(dropboxBindingKey(entry.projectId));
      if (binding?.rev && binding.rev !== entry.rev) newer.push(entry.name);
    }
    setDropboxStatus(newer.length ? `Dropbox updates available: ${newer.join(', ')}. Open the Dropbox project to review the newer copy.` : 'Up to date. No browser changes needed uploading.');
  }
}

function setWorkspaceControlsBusy() {
  const valid = dropboxConnection && dropboxConnection.expiresAt > Date.now() + 10000;
  for (const id of ['startProjectSetup', 'connectProjectLibrary', 'refreshProjectLibrary', 'downloadWorkspaceProject', 'downloadWholeWorkspace', 'deleteWorkspaceProject', 'formatWorkspace', 'saveWorkspaceInterval', 'workspaceSyncInterval', 'saveWorkspaceHistory', 'workspaceHistoryLimit', 'releaseWorkspaceSync', 'openLibraryProject']) {
    const control = document.getElementById(id);
    if (!control) continue;
    control.disabled = dropboxBusy || (['refreshProjectLibrary','downloadWorkspaceProject','downloadWholeWorkspace','deleteWorkspaceProject','formatWorkspace','saveWorkspaceInterval','workspaceSyncInterval','saveWorkspaceHistory','workspaceHistoryLimit','releaseWorkspaceSync'].includes(id) && !valid) || (['openLibraryProject','downloadWorkspaceProject','deleteWorkspaceProject','formatWorkspace','releaseWorkspaceSync'].includes(id) && !projectLibraryEntries.length);
  }
}

async function addDropboxProjectToZip(zip, entry, budget) {
  const accountId = dropboxConnection.accountId;
  const prefix = `projects/${safePathPart(entry.name)}--${entry.projectId || await projectFileHash(entry.path)}`;
  function add(path, text) {
    budget.bytes += new TextEncoder().encode(text).length;
    if (budget.bytes > 512 * 1024 * 1024) throw new Error('This workspace is too large for one browser ZIP. Download its projects separately.');
    zip.file(path, text);
  }
  if (entry.legacy || entry.path.endsWith('.caps.json')) {
    const file = await dropboxRequest('files/download', { path: entry.path }, { download: true });
    backupProjectPayload(JSON.parse(file.text));
    add(`${prefix}/project.caps.json`, file.text);
    return;
  }
  const loaded = await readDropboxIndex(entry.path, { recovery: false });
  const payload = loaded.payload;
  for (const collection of PROJECT_DOCUMENT_COLLECTIONS) {
    for (const doc of payload.project[collection]) {
      assertDropboxAccount(accountId);
      const body = await dropboxRequest('files/download', { path: doc._body.path }, { download: true });
      await checkedDocumentBody(body.text, doc._body.hash);
      add(`${prefix}/documents/${doc._body.hash}.doc.json`, body.text);
    }
  }
  const shared = await dropboxRequest('files/download', { path: payload.shared.path }, { download: true });
  if (await projectFileHash(shared.text) !== payload.shared.hash) throw new Error('Shared data failed its integrity check. ZIP download stopped.');
  add(`${prefix}/shared/${payload.shared.hash}.json`, shared.text);
  add(`${prefix}/project.json`, JSON.stringify(payload, null, 2));
}

async function buildWorkspaceZip(selected = null) {
  requireDropboxConnection();
  syncEditorToDocument(false); await writeWorkspaceSnapshot();
  const accountId = dropboxConnection.accountId;
  await refreshDropboxProjects();
  const zip = new JSZip(); const budget = { bytes: 0 };
  const cloud = selected ? dropboxProjectCatalogue.filter(entry => entry.path === selected.path) : dropboxProjectCatalogue;
  if (selected?.cloud && !cloud.length) throw new Error('The project list changed. Refresh it before downloading.');
  for (const entry of cloud) { assertDropboxAccount(accountId); await addDropboxProjectToZip(zip, entry, budget); }
  // Include unsynced browser drafts separately, so the ZIP does not silently discard local work.
  const records = await listSavedProjectIndexes();
  for (const record of records) {
    if (selected && record.projectId !== (selected.projectId || selected.record?.projectId)) continue;
    if (selected && !selected.cloud && selected.record?.recordKey && record.recordKey !== selected.record.recordKey) continue;
    const project = JSON.parse(record.json);
    if (project.workspaceAccountId !== accountId) continue;
    const binding = await workspaceRecord(dropboxBindingKey(project.projectId));
    if ((!selected || selected.cloud) && binding?.fingerprint === await projectCloudFingerprint(project)) continue;
    const full = await completeProjectCopy(project);
    const text = JSON.stringify(full, null, 2);
    budget.bytes += new TextEncoder().encode(text).length;
    if (budget.bytes > 512 * 1024 * 1024) throw new Error('This backup exceeds the browser ZIP limit. Download projects separately.');
    zip.file(`browser-drafts/${safePathPart(project.writingRoomName)}--${project.projectId}--${(await projectFileHash(record.recordKey || record.json)).slice(0, 8)}.caps.json`, text);
  }
  zip.file('workspace-backup.json', JSON.stringify({ type: 'capsanoto-workspace-backup', version: 1, exportedAt: new Date().toISOString(), projects: cloud.map(({ name, projectId }) => ({ name, projectId })) }, null, 2));
  zip.file('README.txt', 'CAPSANOTO WORKSPACE BACKUP\nUse Import Project Backup in Capsanoto to open this ZIP. Select the project to restore. Unsynced browser drafts are separate copies in browser-drafts. Account tokens and passwords are not included. Saved cloud history is not duplicated; current document versions are verified and included.\n');
  assertDropboxAccount(accountId);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', streamFiles: true });
}

async function downloadWorkspaceZip(selected = null) {
  const bytes = await buildWorkspaceZip(selected);
  downloadFile(selected ? `${safePathPart(selected.name)}.zip` : 'Capsanoto-workspace.zip', bytes, 'application/zip');
  setStatus('ZIP backup downloaded', 'saved');
}

async function projectBackupFromZip(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const choices = [];
  for (const name of Object.keys(zip.files)) {
    if (name.endsWith('/project.json') || name === 'project.json') {
      const payload = JSON.parse(await zip.file(name).async('string'));
      if (payload.type === 'capsanoto-project-index') choices.push({ name, payload, label: payload.project?.writingRoomName || name });
    } else if (name.endsWith('.caps.json')) choices.push({ name, label: `${name} (browser/older copy)` });
  }
  if (!choices.length) throw new Error('This ZIP does not contain a Capsanoto project.');
  let selected = choices[0];
  if (choices.length > 1) {
    const result = await openCapsDialog('Choose a project from the ZIP', [{ name: 'path', label: 'Project', options: choices.map(item => ({ value: item.name, label: item.label })) }]);
    selected = choices.find(item => item.name === result?.path);
    if (!selected) return null;
  }
  if (!selected.payload) return JSON.parse(await zip.file(selected.name).async('string'));
  const payload = selected.payload;
  const prefix = selected.name.slice(0, -'project.json'.length);
  const first = payload.project.documents?.[0]?._body?.path;
  if (!first) throw new Error('The ZIP index has no valid document link.');
  const folder = first.slice(0, first.lastIndexOf('/documents/'));
  validateDropboxIndex(payload, folder, 'restoring-from-zip');
  const project = payload.project;
  for (const collection of PROJECT_DOCUMENT_COLLECTIONS) {
    for (const doc of project[collection]) {
      const body = zip.file(`${prefix}documents/${doc._body.hash}.doc.json`);
      if (!body) throw new Error(`The ZIP is missing ${doc.title}. Your current project is kept.`);
      doc.content = (await checkedDocumentBody(await body.async('string'), doc._body.hash)).content;
      delete doc._body;
    }
  }
  const sharedFile = zip.file(`${prefix}shared/${payload.shared.hash}.json`);
  if (!sharedFile) throw new Error('The ZIP is missing shared project data.');
  const text = await sharedFile.async('string');
  if (await projectFileHash(text) !== payload.shared.hash) throw new Error('The ZIP shared data failed its integrity check.');
  const shared = JSON.parse(text); project.blocks = shared.blocks; project.deprecatedParagraphs = shared.deprecatedParagraphs || [];
  return { type: 'capsanoto-project-backup', project };
}

async function removeWorkspaceProject(entry, accountId, allowedPaths = null) {
  assertDropboxAccount(accountId);
  if (!entry) throw new Error('Choose a project in the connected workspace.');
  if (state.folderMode.writeInProgress) throw new Error('Wait for the folder backup to finish before deleting.');
  if (entry.cloud) {
    if (!(allowedPaths ? allowedPaths.has(entry.path) : dropboxProjectCatalogue.some(item => item.path === entry.path))) throw new Error('The selected project is outside this workspace.');
    const path = entry.path.endsWith('/project.json') ? entry.path.slice(0, -'/project.json'.length) : entry.path;
    if (!/^\/[^/]+\.caps-project$/.test(path) && !/^\/[^/]+\.caps\.json$/.test(path)) throw new Error('Unsafe project path. Nothing was deleted.');
    const latest = await dropboxMetadata(entry.path);
    if (entry.rev && latest?.rev !== entry.rev) throw new Error('This project changed since the list was shown. Refresh and review it before deleting.');
    if (entry.legacy && !entry.projectId) {
      try { entry.projectId = backupProjectPayload(JSON.parse((await dropboxRequest('files/download', { path }, { download: true })).text)).projectId; } catch { /* An unreadable backup can still be explicitly removed; browser copies remain. */ }
    }
    assertDropboxAccount(accountId);
    await dropboxRequest('files/delete_v2', { path, ...(entry.legacy && latest?.rev ? { parent_rev: latest.rev } : {}) });
  } else {
    const project = JSON.parse(entry.record?.json || '{}');
    if (project.workspaceAccountId !== accountId) throw new Error('This browser draft belongs to another workspace.');
    entry.projectId = project.projectId;
  }
  assertDropboxAccount(accountId);
  if (entry.projectId) {
    const copies = (await listSavedProjectIndexes()).filter(record => {
      const project = JSON.parse(record.json);
      return project.projectId === entry.projectId && project.workspaceAccountId === accountId;
    });
    const previous = await workspaceRecord('previous-project');
    const previousProject = previous?.json ? JSON.parse(previous.json) : null;
    const db = await openWorkspaceDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('records', 'readwrite'); const store = tx.objectStore('records');
        for (const record of copies) store.delete(record.recordKey);
        if (previousProject?.projectId === entry.projectId && previousProject.workspaceAccountId === accountId) store.delete('previous-project');
        store.delete(`dropbox-binding:${accountId}:${entry.projectId}`);
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
    if (state.projectId === entry.projectId && state.workspaceAccountId === accountId) {
      clearTimeout(state.saveTimer); state.saveTimer = null;
      await detachBackupFolder();
      resetWritingRoomState('New Writing Room'); state.projectId = crypto.randomUUID(); state.workspaceAccountId = ''; state.cloudSyncPaused = true;
      await writeWorkspaceSnapshot(); renderAll(); updateUrl();
    }
  }
}

async function confirmWorkspaceDeletion({ all = false } = {}) {
  requireDropboxConnection();
  const accountId = dropboxConnection.accountId;
  const selected = projectLibraryEntries.find(entry => entry.key === document.getElementById('projectLibrarySelect').value);
  let entries = selected ? [selected] : [];
  if (all) {
    const files = await listDropboxFiles('');
    entries = files.filter(item => item['.tag'] === 'folder' ? item.name.endsWith('.caps-project') : item['.tag'] === 'file' && item.name.endsWith('.caps.json')).map(item => {
      const path = item['.tag'] === 'folder' ? `${item.path_lower}/project.json` : item.path_lower;
      return { ...(dropboxProjectCatalogue.find(project => project.path === path) || { name: item.name, path, legacy: item['.tag'] === 'file', rev: item.rev }), cloud: true };
    });
    const cloudIds = new Set(entries.map(entry => entry.projectId));
    entries.push(...projectLibraryEntries.filter(entry => !entry.cloud && !cloudIds.has(entry.record?.projectId)));
  } else if (selected?.cloud && selected.projectId) {
    const files = await listDropboxFiles('');
    for (const file of files.filter(item => item['.tag'] === 'file' && item.name.endsWith(`-${selected.projectId}.caps.json`) && item.path_lower !== selected.path)) entries.push({ name: file.name, path: file.path_lower, projectId: selected.projectId, rev: file.rev, cloud: true, legacy: true });
  }
  if (!entries.length) throw new Error('There are no projects to remove.');
  const allowedPaths = new Set(entries.filter(entry => entry.cloud).map(entry => entry.path));
  const phrase = all ? 'RESET WORKSPACE' : selected.name;
  document.getElementById('projectLibraryDialog').close();
  const result = await openCapsDialog(all ? 'Format workspace' : 'Delete project', [
    { html: `<p>This removes ${all ? `${entries.length} Capsanoto project file(s) and browser drafts` : escapeHtml(selected.name) + ' and its older single-file backups'} from <strong>${escapeHtml(dropboxConnection.label || 'the connected Dropbox account')}</strong> and removes their browser project copies. Other Dropbox files and other accounts are outside this action.</p><p>Download a ZIP first if you want an independent backup. Close these projects on other devices before deleting.</p>` },
    { name: 'confirmation', label: `Type ${phrase} to confirm`, value: '' },
  ]);
  if (result?.confirmation !== phrase) { await openSavedProject({ refresh: false }); return; }
  await dropboxAction(async () => {
    let removed = 0;
    try { for (const entry of entries) { await removeWorkspaceProject(entry, accountId, allowedPaths); removed++; } }
    finally { await refreshDropboxProjects(); setDropboxStatus(`${removed} project(s) removed from this workspace.`); }
  });
  await openSavedProject({ refresh: false });
}
