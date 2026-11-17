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
  dropboxConnection = await workspaceRecord('dropbox-connection') || null;
  dropboxStatus = dropboxConnection ? (dropboxConnection.expiresAt > Date.now() ? 'Ready to sync.' : 'Sign-in expired. Reconnect to sync.') : 'Not connected. Edits still save in this browser.';
  renderDropboxStorage();
}

function dropboxRedirectUrl() { return new URL('dropbox-callback.html', location.href).href; }

function renderDropboxStorage() {
  const container = document.getElementById('dropboxStorageControls');
  if (!container) return;
  const connected = Boolean(dropboxConnection);
  const valid = connected && dropboxConnection.expiresAt > Date.now() + 10000;
  container.innerHTML = `<div class="storage-account"><span class="storage-provider">Dropbox</span><strong>${escapeHtml(connected ? dropboxConnection.label || 'Connected account' : 'Connect your storage account')}</strong></div><p class="storage-description">${connected ? 'Your project stays in this browser and syncs to this account’s Apps/Capsanoto folder.' : 'Keep a project copy online and open it on another device. Use the account where you want to store your writing.'}</p><p id="dropboxStatus" class="storage-sync-status" role="status"></p><div class="storage-main-actions"><button type="button" id="connectDropbox" ${valid ? 'hidden' : ''}>${connected ? 'Reconnect Dropbox' : 'Connect Dropbox'}</button><button type="button" id="syncDropbox" ${connected ? '' : 'hidden'} ${valid ? '' : 'disabled'}>Sync now</button><button type="button" id="openDropboxProject" ${connected ? '' : 'hidden'} ${valid ? '' : 'disabled'}>Open another project</button></div><label class="storage-option" ${connected ? '' : 'hidden'}><input type="checkbox" id="autoSyncDropbox"> Sync automatically after edits</label><details class="storage-account-options"><summary>Account options</summary><label class="storage-option"><input type="checkbox" id="rememberDropbox" checked> Remember this connection in this browser</label><p>Only a short-lived access token is saved here. Dropbox may ask you to reconnect; your password is never stored.</p><button type="button" id="disconnectDropbox" ${connected ? '' : 'hidden'}>Disconnect this account</button></details>`;
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
}

async function dropboxAction(action) {
  if (dropboxBusy) return;
  dropboxBusy = true;
  document.querySelectorAll('#dropboxStorageControls button').forEach((button) => { button.disabled = true; });
  try { await action(); }
  catch (error) { setDropboxStatus(error.message || 'Dropbox operation failed. Your browser copy is kept.'); setStatus('Dropbox needs attention · browser copy kept', 'dirty'); }
  finally { dropboxBusy = false; document.querySelectorAll('#dropboxStorageControls button').forEach((button) => { button.disabled = ['syncDropbox', 'openDropboxProject'].includes(button.id) && (!dropboxConnection || dropboxConnection.expiresAt <= Date.now() + 10000); }); }
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
    throw error;
  }
  return options.download ? { text: await response.text(), metadata: JSON.parse(response.headers.get('Dropbox-API-Result') || '{}') } : response.status === 200 && response.headers.get('content-length') === '0' ? null : response.json();
}

function dropboxBindingKey(projectId = state.projectId) { return `dropbox-binding:${dropboxConnection.accountId}:${projectId}`; }

function projectCloudFingerprint(project) {
  // Ignore save timestamps; changing content, organization, or appearance changes the fingerprint.
  const { updatedAt, ...copy } = project;
  copy.documents = copy.documents.map(({ localDraftAt, diskSavedAt, onlineSavedAt, ...doc }) => doc);
  return JSON.stringify(copy);
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
  const fingerprint = projectCloudFingerprint(project);
  const path = binding?.path || `/${slugify(project.writingRoomName)}-${projectId}.caps.json`;
  const body = JSON.stringify({ type: 'capsanoto-project-backup', schemaVersion: 1, exportedAt: new Date().toISOString(), project });
  if (new TextEncoder().encode(body).length > 140 * 1024 * 1024) throw new Error('This project exceeds the single-file Dropbox sync limit. Split it into smaller projects.');
  setDropboxStatus('Syncing project…');
  const uploaded = await dropboxRequest('files/upload', { path, mode: binding?.rev ? { '.tag': 'update', update: binding.rev } : { '.tag': 'add' }, autorename: false, mute: true, strict_conflict: true }, { upload: body });
  if (dropboxConnection?.accountId !== accountId) throw new Error('Dropbox account changed. Check the saved file before syncing again.');
  await workspaceRecord(bindingKey, { path: uploaded.path_lower || path, rev: uploaded.rev, fingerprint, syncedAt: new Date().toISOString() });
  setDropboxStatus(`Synced · ${new Date().toLocaleString()}`);
  setStatus('Saved in this browser and Dropbox', 'saved');
  if (state.projectId === projectId && projectCloudFingerprint(JSON.parse(serializedWorkspace())) !== fingerprint) scheduleDropboxSync();
}

function scheduleDropboxSync() {
  clearTimeout(dropboxSyncTimer);
  if (!state.dropboxAutoSync || !dropboxConnection) return;
  dropboxSyncTimer = setTimeout(() => { if (!dropboxBusy) void dropboxAction(syncDropboxProject); }, 5000);
}

async function openDropboxProject() {
  requireDropboxConnection();
  let page = await dropboxRequest('files/list_folder', { path: '', recursive: false, limit: 200 });
  const files = [...page.entries];
  while (page.has_more) { page = await dropboxRequest('files/list_folder/continue', { cursor: page.cursor }); files.push(...page.entries); }
  const projects = files.filter((entry) => entry['.tag'] === 'file' && entry.name.endsWith('.caps.json'));
  if (!projects.length) throw new Error('No Capsanoto projects in this Dropbox app folder yet. Use Sync now on the first device.');
  const result = await openCapsDialog('Open from Dropbox', [
    { html: '<p>Your current browser project is kept in Open project. Opening a cloud copy replaces the working copy. Download a backup first if you want a separate file too.</p>' },
    { name: 'path', label: 'Project file', options: projects.map((entry) => ({ value: entry.path_lower, label: `${entry.name} · ${new Date(entry.server_modified).toLocaleString()}` })) },
    { name: 'confirm', checkbox: true, label: 'Open the selected Dropbox copy in this browser.' },
  ]);
  if (!result?.path || result.confirm !== 'on') return;
  const downloaded = await dropboxRequest('files/download', { path: result.path }, { download: true });
  const payload = JSON.parse(downloaded.text);
  dropboxOpeningProject = true;
  try { await importProjectBackupPayload(payload); }
  finally { dropboxOpeningProject = false; }
  await workspaceRecord(dropboxBindingKey(), { path: result.path, rev: downloaded.metadata.rev, fingerprint: projectCloudFingerprint(JSON.parse(serializedWorkspace())), syncedAt: new Date().toISOString() });
  setDropboxStatus(`Opened ${state.writingRoomName} from Dropbox. Sync now saves changes back here.`);
  renderDropboxStorage();
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
