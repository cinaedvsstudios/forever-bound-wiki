/* Public OAuth client: no app secret or account password belongs in this app. */
const DROPBOX_SCOPES = 'account_info.read files.metadata.read files.content.read files.content.write';
let dropboxConnection = null;
let dropboxBusy = false;
let dropboxOpeningProject = false;
let dropboxSyncTimer = null;
let dropboxStatus = 'Not connected. Browser autosave still works.';

async function initializeDropboxStorage() {
  if (!localStorage.getItem('capsanoto-dropbox-app-key')) {
    try {
      const response = await fetch('config/storage.json', { cache: 'no-store' });
      const config = response.ok ? await response.json() : {};
      if (/^[a-zA-Z0-9]{5,80}$/.test(config.dropboxAppKey || '')) localStorage.setItem('capsanoto-dropbox-app-key', config.dropboxAppKey);
    } catch { /* Owner setup remains available when offline. */ }
  }
  await restoreDropboxConnection();
  dropboxStatus = dropboxConnection ? (dropboxConnection.expiresAt > Date.now() ? 'Ready to sync.' : 'Sign-in expired. Reconnect to sync.') : 'Not connected. Edits still save in this browser.';
  renderDropboxStorage();
}

async function restoreDropboxConnection() {
  dropboxConnection = await workspaceRecord('dropbox-connection') || null;
}

function dropboxRedirectUrl() { return new URL('dropbox-callback.html', location.href).href; }

function renderDropboxStorage() {
  renderBottomDropboxControl();
  const container = document.getElementById('dropboxStorageControls');
  if (!container) return;
  const connected = Boolean(dropboxConnection);
  const valid = connected && dropboxConnection.expiresAt > Date.now() + 10000;
  container.innerHTML = `<div class="storage-account"><span class="storage-provider">Dropbox</span><strong>${escapeHtml(connected ? dropboxConnection.label || 'Connected account' : 'Connect your storage account')}</strong></div><p class="storage-description">${connected ? 'Your project uses separate document files and a small index in this account’s Apps/Capsanoto folder. Documents load when you open them; visited files are cached here for offline use.' : 'Keep a project copy online and open it on another device. Use the account where you want to store your writing.'}</p><p id="dropboxStatus" class="storage-sync-status" role="status"></p><div class="storage-main-actions"><button type="button" id="connectDropbox" ${valid ? 'hidden' : ''}>${connected ? 'Reconnect Dropbox' : 'Connect Dropbox'}</button><button type="button" id="syncDropbox" ${connected ? '' : 'hidden'} ${valid ? '' : 'disabled'}>Sync now</button><button type="button" id="openDropboxProject" ${connected ? '' : 'hidden'} ${valid ? '' : 'disabled'}>Open another project</button></div><label class="storage-option" ${connected ? '' : 'hidden'}><input type="checkbox" id="autoSyncDropbox"> Sync automatically after edits</label><details class="storage-account-options"><summary>Account options</summary><label class="storage-option"><input type="checkbox" id="rememberDropbox" checked> Remember this connection in this browser</label><p>Only a short-lived access token is saved here. Dropbox may ask you to reconnect; your password is never stored.</p><button type="button" id="disconnectDropbox" ${connected ? '' : 'hidden'}>Disconnect this account</button></details>`;
  const developer = document.getElementById('dropboxDeveloperControls');
  const markup = '<details class="project-developer-setup"><summary>Developer setup</summary><p>App owners only. Register a free Scoped access / App folder app in the <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer">Dropbox developer console</a>. Enable account_info.read, files.metadata.read, files.content.read, files.content.write and public clients (PKCE). Add the redirect address below and enable additional users. Never enter an app secret or access token here.</p><label>Public app key<input type="text" id="dropboxAppKey" autocomplete="off"></label><button type="button" id="saveDropboxAppKey">Save app key</button><p id="dropboxCallbackAddress"></p></details>';
  if (developer) developer.innerHTML = markup;
  else container.insertAdjacentHTML('beforeend', markup);
  document.getElementById('dropboxStatus').textContent = dropboxStatus;
  document.getElementById('dropboxCallbackAddress').textContent = `Redirect URI: ${dropboxRedirectUrl()}`;
  document.getElementById('dropboxAppKey').value = localStorage.getItem('capsanoto-dropbox-app-key') || '';
  document.getElementById('rememberDropbox').checked = dropboxConnection?.remembered !== false;
  document.getElementById('rememberDropbox').onchange = async (event) => { if (dropboxConnection) { dropboxConnection.remembered = event.target.checked; await workspaceRecord('dropbox-connection', event.target.checked ? dropboxConnection : null); } };
  document.getElementById('autoSyncDropbox').checked = Boolean(state.dropboxAutoSync);
  document.getElementById('autoSyncDropbox').onchange = async (event) => { state.dropboxAutoSync = event.target.checked; await persistNow(); };
  document.getElementById('saveDropboxAppKey').onclick = () => {
    const key = document.getElementById('dropboxAppKey').value.trim();
    if (!/^[a-zA-Z0-9]{5,80}$/.test(key)) { setDropboxStatus('Enter the public Dropbox app key from your developer console.'); return; }
    localStorage.setItem('capsanoto-dropbox-app-key', key);
    setDropboxStatus('App key saved. You can connect your account.');
  };
  document.getElementById('connectDropbox').onclick = () => dropboxAction(connectDropbox);
  document.getElementById('syncDropbox').onclick = () => dropboxAction(syncDropboxProject);
  document.getElementById('openDropboxProject').onclick = () => dropboxAction(openDropboxProject);
  document.getElementById('disconnectDropbox').onclick = () => dropboxAction(disconnectDropbox);
}

function setDropboxStatus(message) {
  dropboxStatus = message;
  const target = document.getElementById('dropboxStatus');
  if (target) target.textContent = message;
  updateProjectSettingsStatus();
  renderBottomDropboxControl();
}

function renderBottomDropboxControl() {
  const button = document.getElementById('quickDropboxSync');
  if (!button) return;
  const connected = Boolean(dropboxConnection);
  const valid = connected && dropboxConnection.expiresAt > Date.now() + 10000;
  button.textContent = dropboxBusy ? 'Working…' : valid ? 'Sync now' : connected ? 'Reconnect Dropbox' : 'Connect Dropbox';
  button.title = valid ? 'Save this project to Dropbox now' : 'Connect the Dropbox account that stores your writing';
  button.disabled = dropboxBusy;
  button.setAttribute('aria-busy', String(dropboxBusy));
  document.getElementById('bottomDropboxStatus').textContent = dropboxStatus;
  for (const id of ['startProjectSetup', 'addProjectFile', 'openSavedProject']) document.getElementById(id).disabled = dropboxBusy;
}

async function dropboxAction(action) {
  if (dropboxBusy) return;
  dropboxBusy = true;
  renderBottomDropboxControl();
  document.querySelectorAll('#dropboxStorageControls button').forEach((button) => { button.disabled = true; });
  try { await action(); }
  catch (error) { setDropboxStatus(error.message || 'Dropbox operation failed. Your browser copy is kept.'); setStatus('Dropbox needs attention · browser copy kept', 'dirty'); }
  finally { dropboxBusy = false; document.querySelectorAll('#dropboxStorageControls button').forEach((button) => { button.disabled = ['syncDropbox', 'openDropboxProject'].includes(button.id) && (!dropboxConnection || dropboxConnection.expiresAt <= Date.now() + 10000); }); renderBottomDropboxControl(); }
}

function base64Url(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

async function connectDropbox() {
  const appKey = localStorage.getItem('capsanoto-dropbox-app-key');
  if (!appKey) throw new Error('Complete the one-time Dropbox app setup below first. Registration and API access are free.');
  const remember = document.getElementById('rememberDropbox').checked;
  const popup = window.open('about:blank', 'capsanoto-dropbox-connect', 'width=640,height=760');
  if (!popup) throw new Error('Allow the Dropbox sign-in popup, then try again.');
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const oauthState = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const redirect = dropboxRedirectUrl();
  const codePromise = new Promise((resolve, reject) => {
    const cleanup = () => { window.removeEventListener('message', listener); clearInterval(check); clearTimeout(timeout); };
    const listener = (event) => {
      if (event.origin !== location.origin || event.source !== popup || event.data?.type !== 'capsanoto-dropbox-oauth' || event.data.state !== oauthState) return;
      cleanup();
      event.data.error ? reject(new Error(`Dropbox connection declined: ${event.data.error}`)) : resolve(event.data.code);
    };
    const check = setInterval(() => { if (popup.closed) { cleanup(); reject(new Error('Dropbox sign-in was closed.')); } }, 500);
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Dropbox sign-in timed out. Try connecting again.')); }, 180000);
    window.addEventListener('message', listener);
  });
  const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
  authUrl.search = new URLSearchParams({ client_id: appKey, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', state: oauthState, redirect_uri: redirect, token_access_type: 'online', scope: DROPBOX_SCOPES }).toString();
  popup.location.href = authUrl.href;
  const code = await codePromise;
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', { method: 'POST', body: new URLSearchParams({ client_id: appKey, grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirect }) });
  if (!response.ok) throw new Error('Dropbox could not complete sign-in. Check the app key, redirect URI, and PKCE setting.');
  const token = await response.json();
  const previous = dropboxConnection;
  dropboxConnection = { remembered: remember, token: token.access_token, accountId: token.account_id, expiresAt: Date.now() + Number(token.expires_in || 14400) * 1000, label: 'Dropbox connected' };
  try {
    const account = await dropboxRequest('users/get_current_account', null);
    dropboxConnection.label = account.name?.display_name || 'Dropbox connected';
    await workspaceRecord('dropbox-connection', remember ? dropboxConnection : null);
  } catch (error) { dropboxConnection = previous; throw error; }
  renderDropboxStorage();
  setDropboxStatus('Connected. Choose Sync now or Open from Dropbox.');
}

function requireDropboxConnection() {
  if (!dropboxConnection?.token || dropboxConnection.expiresAt <= Date.now() + 10000) throw new Error('Connect Dropbox to refresh your sign-in. Your local documents are kept.');
}

async function dropboxRequest(route, data, options = {}) {
  requireDropboxConnection();
  const content = options.upload !== undefined || options.download;
  const headers = { Authorization: `Bearer ${dropboxConnection.token}` };
  let body;
  if (content) {
    headers['Dropbox-API-Arg'] = JSON.stringify(data).replace(/[\u007f-\uffff]/g, (character) => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
    if (options.upload !== undefined) { headers['Content-Type'] = 'application/octet-stream'; body = options.upload; }
  } else { headers['Content-Type'] = 'application/json'; body = JSON.stringify(data); }
  const response = await fetch(`https://${content ? 'content' : 'api'}.dropboxapi.com/2/${route}`, { method: 'POST', headers, body });
  if (!response.ok) {
    const error = new Error(response.status === 409 ? 'Dropbox has another version or a conflicting file. Open the Dropbox copy to review it; this browser copy has not been overwritten.' : response.status === 401 ? 'Dropbox sign-in expired. Connect again.' : `Dropbox request failed (${response.status}). Try again when online.`);
    error.status = response.status;
    try { error.summary = (await response.json()).error_summary || ''; } catch {}
    error.notFound = error.summary?.includes('path/not_found');
    if (error.notFound && options.download) error.message = 'The saved file is missing from Dropbox. Other documents are kept.';
    throw error;
  }
  return options.download ? { text: await response.text(), metadata: JSON.parse(response.headers.get('Dropbox-API-Result') || '{}') } : response.status === 200 && response.headers.get('content-length') === '0' ? null : response.json();
}

function dropboxBindingKey(projectId = state.projectId) { return `dropbox-binding:${dropboxConnection.accountId}:${projectId}`; }

async function projectCloudFingerprint(project) {
  const { index } = await encodeProjectIndex(project);
  delete index.updatedAt;
  for (const collection of PROJECT_DOCUMENT_COLLECTIONS) {
    index[collection] = index[collection].map(({ localDraftAt, diskSavedAt, onlineSavedAt, _body, ...doc }) => ({ ...doc, _body: { hash: _body.hash } }));
  }
  return projectFileHash(JSON.stringify(index));
}

function assertDropboxAccount(accountId) {
  if (dropboxConnection?.accountId !== accountId) throw new Error('Dropbox account changed. Your browser copy and the previous cloud project are kept.');
}

async function dropboxMetadata(path) {
  try { return await dropboxRequest('files/get_metadata', { path }); }
  catch (error) { if (error.notFound) return null; throw error; }
}

async function ensureDropboxFolder(path) {
  const existing = await dropboxMetadata(path);
  if (existing) {
    if (existing['.tag'] !== 'folder') throw new Error('A file occupies the project folder. Choose Open project to review it.');
    return;
  }
  try { await dropboxRequest('files/create_folder_v2', { path, autorename: false }); }
  catch (error) {
    if (error.status !== 409 || (await dropboxMetadata(path))?.['.tag'] !== 'folder') throw error;
  }
}

async function uploadDropboxFile(path, text, rev = null) {
  if (new TextEncoder().encode(text).length > 140 * 1024 * 1024) throw new Error('An individual file is too large to sync. Your browser copy and the previous cloud index are kept.');
  return dropboxRequest('files/upload', { path, mode: rev ? { '.tag': 'update', update: rev } : { '.tag': 'add' }, autorename: false, mute: true, strict_conflict: true }, { upload: text });
}

async function uploadDropboxImmutableFile(path, text) {
  try { return await uploadDropboxFile(path, text); }
  catch (error) {
    if (error.status !== 409) throw error;
    // A retry may find a body already uploaded before an interruption. Verify it;
    // never disable strict conflict checking or replace a different file.
    const existing = await dropboxRequest('files/download', { path }, { download: true });
    if (await projectFileHash(existing.text) !== await projectFileHash(text)) throw new Error('A saved document version has different contents. The previous project index is kept.');
    return existing.metadata;
  }
}

async function syncDropboxProject() {
  requireDropboxConnection();
  syncEditorToDocument();
  clearTimeout(dropboxSyncTimer);
  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  await writeWorkspaceSnapshot();
  const projectId = state.projectId;
  const accountId = dropboxConnection.accountId;
  const bindingKey = dropboxBindingKey(projectId);
  const binding = await workspaceRecord(bindingKey);
  const project = JSON.parse(serializedWorkspace());
  const fingerprint = await projectCloudFingerprint(project);
  const folder = binding?.format === 'document-files-v1' ? binding.folder : `/${slugify(project.writingRoomName).slice(0, 60) || 'project'}--${projectId}.caps-project`;
  const path = `${folder}/project.json`;
  const current = await dropboxMetadata(path);
  assertDropboxAccount(accountId);
  if ((binding?.format === 'document-files-v1' && current?.rev !== binding.rev) || (binding?.format !== 'document-files-v1' && current)) throw new Error('Dropbox has another version. Open the Dropbox project before syncing; this browser copy is kept.');
  if (binding?.format !== 'document-files-v1' && binding?.path) {
    const legacy = await dropboxMetadata(binding.path);
    if (legacy?.rev !== binding.rev) throw new Error('The older Dropbox project has changed. Open its latest copy before converting it to separate files.');
  }
  if (binding?.format === 'document-files-v1' && binding.fingerprint === fingerprint) {
    setDropboxStatus('Up to date. No document files needed uploading.');
    return;
  }
  for (const directory of [folder, `${folder}/documents`, `${folder}/shared`, `${folder}/history`]) {
    assertDropboxAccount(accountId);
    await ensureDropboxFolder(directory);
  }
  const { index, bodies } = await encodeProjectIndex(project);
  const known = new Set(binding?.format === 'document-files-v1' ? binding.hashes : []);
  const published = new Set();
  const total = PROJECT_DOCUMENT_COLLECTIONS.reduce((count, collection) => count + index[collection].length, 0);
  let completed = 0;
  for (const collection of PROJECT_DOCUMENT_COLLECTIONS) {
    for (const doc of index[collection]) {
      const hash = doc._body.hash;
      const filePath = `${folder}/documents/${hash}.doc.json`;
      assertDropboxAccount(accountId);
      if (!known.has(hash) && !published.has(hash)) {
        let text = bodies.get(hash) || await workspaceRecord(documentBodyKey(hash));
        if (typeof text !== 'string') {
          const original = project[collection].find((item) => item.id === doc.id);
          await ensureDocumentContent(original);
          text = await workspaceRecord(documentBodyKey(hash));
        }
        if (typeof text !== 'string') throw new Error(`The content for ${doc.title} is unavailable. The previous cloud index is kept.`);
        await checkedDocumentBody(text, hash);
        setDropboxStatus(`Saving document files · ${completed + 1} of ${total}…`);
        await uploadDropboxImmutableFile(filePath, text);
      }
      doc._body = { hash, path: filePath, accountId };
      published.add(hash);
      completed++;
    }
  }
  const sharedText = JSON.stringify({ type: 'capsanoto-shared-data', schemaVersion: 1, blocks: index.blocks || {}, deprecatedParagraphs: index.deprecatedParagraphs || [] });
  delete index.blocks;
  delete index.deprecatedParagraphs;
  const sharedHash = await projectFileHash(sharedText);
  const sharedPath = `${folder}/shared/${sharedHash}.json`;
  if (!known.has(sharedHash)) await uploadDropboxImmutableFile(sharedPath, sharedText);
  published.add(sharedHash);
  const manifest = { type: 'capsanoto-project-index', schemaVersion: 1, savedAt: new Date().toISOString(), project: index, shared: { hash: sharedHash, path: sharedPath }, previous: binding?.historyPath || null };
  const text = JSON.stringify(manifest, null, 2);
  const historyPath = `${folder}/history/${await projectFileHash(text)}.project.json`;
  assertDropboxAccount(accountId);
  await uploadDropboxImmutableFile(historyPath, text);
  // Immutable bodies and a recovery index are saved before the single revision-checked commit.
  assertDropboxAccount(accountId);
  setDropboxStatus('Saving project index…');
  const uploaded = await uploadDropboxFile(path, text, current?.rev);
  assertDropboxAccount(accountId);
  await workspaceRecord(bindingKey, { format: 'document-files-v1', folder, path, rev: uploaded.rev, hashes: [...published], historyPath, fingerprint, legacyPath: binding?.legacyPath || (binding?.format !== 'document-files-v1' ? binding?.path : null), syncedAt: new Date().toISOString() });
  // Attach cloud links only to the exact bodies that were published, never to newer edits.
  rememberIndexedDocumentBodies(project, index);
  if (state.projectId === projectId) await writeWorkspaceSnapshot();
  setDropboxStatus(`Synced separate files · ${new Date().toLocaleString()}`);
  setStatus('Saved in this browser and Dropbox', 'saved');
  if (state.projectId === projectId && await projectCloudFingerprint(JSON.parse(serializedWorkspace())) !== fingerprint) scheduleDropboxSync();
}

function scheduleDropboxSync() {
  clearTimeout(dropboxSyncTimer);
  if (!state.dropboxAutoSync || !dropboxConnection) return;
  dropboxSyncTimer = setTimeout(() => { if (!dropboxBusy) void dropboxAction(syncDropboxProject); }, 5000);
}

async function listDropboxFiles(path) {
  let page = await dropboxRequest('files/list_folder', { path, recursive: false, limit: 200 });
  const entries = [...page.entries];
  while (page.has_more) { page = await dropboxRequest('files/list_folder/continue', { cursor: page.cursor }); entries.push(...page.entries); }
  return entries;
}

function validateDropboxIndex(payload, folder, accountId) {
  if (payload?.type !== 'capsanoto-project-index' || payload.schemaVersion !== 1 || !payload.project || !/^[\w-]{1,100}$/.test(payload.project.projectId || '')) throw new Error('This project index is unreadable.');
  const project = payload.project;
  if (typeof project.writingRoomName !== 'string' || !Array.isArray(project.documents) || !project.documents.length) throw new Error('This project index is missing its document list.');
  for (const collection of PROJECT_DOCUMENT_COLLECTIONS) {
    if (!Array.isArray(project[collection])) throw new Error('This project index has an invalid file list.');
    for (const doc of project[collection]) {
      if (documentIsLoaded(doc) || !validDocumentBodyRef(doc._body) || doc._body.path?.toLowerCase() !== `${folder}/documents/${doc._body.hash}.doc.json`.toLowerCase()) throw new Error('This project contains an invalid document link.');
      doc._body.accountId = accountId;
    }
  }
  validateImportedDocuments(project.documents, { allowUnloaded: true });
  const shared = payload.shared;
  if (!validDocumentBodyRef(shared) || shared.path?.toLowerCase() !== `${folder}/shared/${shared.hash}.json`.toLowerCase()) throw new Error('The shared-data link is invalid.');
  return project;
}

async function readDropboxIndex(path, { recovery = true } = {}) {
  const folder = path.slice(0, path.lastIndexOf('/'));
  const accountId = dropboxConnection.accountId;
  const current = await dropboxMetadata(path);
  try {
    const downloaded = await dropboxRequest('files/download', { path }, { download: true });
    const payload = JSON.parse(downloaded.text);
    validateDropboxIndex(payload, folder, accountId);
    return { payload, folder, rev: downloaded.metadata.rev, recovered: false };
  } catch (error) {
    if (!recovery || (error.status && !error.notFound)) throw error;
    const entries = await listDropboxFiles(`${folder}/history`);
    const copies = entries.filter((entry) => entry['.tag'] === 'file' && /^[a-f0-9]{64}\.project\.json$/.test(entry.name)).sort((a, b) => b.server_modified.localeCompare(a.server_modified));
    if (!copies.length) throw error;
    const choice = await openCapsDialog('Recover project index', [
      { html: '<p>The current project index could not be read. Your document files are separate. Choose a saved index to reopen the project; nothing in Dropbox is replaced by opening it.</p>' },
      { name: 'path', label: 'Saved index', options: copies.map((entry) => ({ value: entry.path_lower, label: new Date(entry.server_modified).toLocaleString() })) },
      { name: 'confirm', checkbox: true, label: 'Open this saved index for review.' },
    ]);
    if (!choice?.path || choice.confirm !== 'on' || !copies.some((entry) => entry.path_lower === choice.path)) throw new Error('Recovery cancelled. Your current browser project is kept.');
    const downloaded = await dropboxRequest('files/download', { path: choice.path }, { download: true });
    const expectedHash = choice.path.split('/').pop().split('.')[0];
    if (await projectFileHash(downloaded.text) !== expectedHash) throw new Error('This saved index failed its integrity check. Choose another saved index.');
    const payload = JSON.parse(downloaded.text);
    validateDropboxIndex(payload, folder, accountId);
    return { payload, folder, rev: current?.rev, recovered: true, historyPath: choice.path };
  }
}

async function openDropboxProjectPath(path, { chooseDocument = false } = {}) {
  const accountId = dropboxConnection.accountId;
  if (path.endsWith('.caps.json')) {
    const downloaded = await dropboxRequest('files/download', { path }, { download: true });
    const payload = JSON.parse(downloaded.text);
    dropboxOpeningProject = true;
    try { await importProjectBackupPayload(payload); }
    finally { dropboxOpeningProject = false; }
    assertDropboxAccount(accountId);
    await workspaceRecord(dropboxBindingKey(), { path, rev: downloaded.metadata.rev });
    setDropboxStatus('Opened older project backup. The next sync creates separate files and keeps this backup.');
    return;
  }
  const loaded = await readDropboxIndex(path);
  const project = loaded.payload.project;
  if (chooseDocument && !await chooseProjectDocument(project)) return;
  const sharedFile = await dropboxRequest('files/download', { path: loaded.payload.shared.path }, { download: true });
  if (await projectFileHash(sharedFile.text) !== loaded.payload.shared.hash) throw new Error('The shared-data file failed its integrity check. The current project is kept.');
  const shared = JSON.parse(sharedFile.text);
  if (shared.type !== 'capsanoto-shared-data' || shared.schemaVersion !== 1 || !shared.blocks || typeof shared.blocks !== 'object' || Array.isArray(shared.blocks) || !Array.isArray(shared.deprecatedParagraphs)) throw new Error('The shared-data file is unreadable.');
  project.blocks = shared.blocks;
  project.deprecatedParagraphs = shared.deprecatedParagraphs;
  project.activeId = project.documents.some((doc) => doc.id === project.activeId) ? project.activeId : project.documents[0].id;
  // Loading one selected body must succeed before replacing the current project.
  await ensureDocumentContent(project.documents.find((doc) => doc.id === project.activeId));
  assertDropboxAccount(accountId);
  dropboxOpeningProject = true;
  try {
    await prepareProjectReplacement();
    const previous = JSON.parse(serializedWorkspace());
    try {
      restoreWorkspaceObject(project);
      state.dropboxAutoSync = false;
      if (project.designSettings) { setProjectDesignSettings(project.designSettings); applySavedDesignSettings(); loadDesignForm(); }
      state.googleDrive.projectFolderId = ''; state.googleDrive.projectName = '';
      await writeWorkspaceSnapshot();
      const hashes = PROJECT_DOCUMENT_COLLECTIONS.flatMap((collection) => project[collection].map((doc) => doc._body.hash));
      hashes.push(loaded.payload.shared.hash);
      await workspaceRecord(dropboxBindingKey(), { format: 'document-files-v1', folder: loaded.folder, path, rev: loaded.rev, hashes, historyPath: loaded.historyPath || null, fingerprint: loaded.recovered ? null : await projectCloudFingerprint(JSON.parse(serializedWorkspace())), syncedAt: new Date().toISOString() });
    } catch (error) { restoreWorkspaceObject(previous); throw error; }
    renderAll(); updateUrl(); renderDropboxStorage();
    setDropboxStatus(loaded.recovered ? 'Recovered a saved index. Review it, then use Sync now to restore it to Dropbox.' : `Opened ${state.writingRoomName}. Other documents load when you choose them.`);
    setStatus('Project opened · selected document loaded', 'saved');
  } finally { dropboxOpeningProject = false; }
}

async function openDropboxProject() {
  requireDropboxConnection();
  const files = await listDropboxFiles('');
  const projects = files.filter((entry) => entry['.tag'] === 'folder' ? entry.name.endsWith('.caps-project') : entry['.tag'] === 'file' && entry.name.endsWith('.caps.json'));
  if (!projects.length) throw new Error('No Capsanoto projects in this Dropbox app folder yet. Use Sync now on the first device.');
  const result = await openCapsDialog('Open from Dropbox', [
    { html: '<p>Open a project folder to load its index and selected document. Your current project stays saved in this browser. Older single-file backups can also be opened.</p>' },
    { name: 'path', label: 'Project', options: projects.map((entry) => ({ value: entry['.tag'] === 'folder' ? `${entry.path_lower}/project.json` : entry.path_lower, label: `${entry.name}${entry['.tag'] === 'file' ? ' (older backup)' : ''}` })) },
    { name: 'confirm', checkbox: true, label: 'Open the selected Dropbox project in this browser.' },
  ]);
  if (!result?.path || result.confirm !== 'on') return;
  const allowed = projects.some((entry) => result.path === (entry['.tag'] === 'folder' ? `${entry.path_lower}/project.json` : entry.path_lower));
  if (!allowed) throw new Error('Choose a project from the list.');
  await openDropboxProjectPath(result.path, { chooseDocument: true });
}

async function disconnectDropbox() {
  clearTimeout(dropboxSyncTimer);
  if (dropboxConnection?.token && dropboxConnection.expiresAt > Date.now()) {
    try { await dropboxRequest('auth/token/revoke', null); }
    catch { /* Local disconnect must still succeed when offline or expired. */ }
  }
  await workspaceRecord('dropbox-connection', null);
  dropboxConnection = null;
  renderDropboxStorage();
  setDropboxStatus('Disconnected in this browser. Local and Dropbox files are kept.');
}
