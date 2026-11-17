/* One project picker for this browser and the connected Dropbox account. */
let dropboxProjectCatalogue = [];
let dropboxCatalogueAccount = '';
let projectLibraryEntries = [];
let projectLibrarySequence = 0;

async function restoreDropboxCatalogue() {
  const accountId = dropboxConnection?.accountId || '';
  dropboxCatalogueAccount = accountId;
  dropboxProjectCatalogue = accountId ? await workspaceRecord(`dropbox-catalogue:${accountId}`) || [] : [];
}

async function refreshDropboxProjects() {
  requireDropboxConnection();
  const accountId = dropboxConnection.accountId;
  const files = await listDropboxFiles('');
  const folders = files.filter((entry) => entry['.tag'] === 'folder' && entry.name.endsWith('.caps-project'));
  const catalogue = [];
  // Read only the small project indexes. Document bodies stay unloaded.
  for (let offset = 0; offset < folders.length; offset += 3) {
    const group = await Promise.all(folders.slice(offset, offset + 3).map(async (entry) => {
      const path = `${entry.path_lower}/project.json`;
      const fallback = entry.name.replace(/--[\w-]+\.caps-project$/, '').replace(/-/g, ' ');
      try {
        const downloaded = await dropboxRequest('files/download', { path }, { download: true });
        const payload = JSON.parse(downloaded.text);
        validateDropboxIndex(payload, entry.path_lower, accountId);
        return { path, name: payload.project.writingRoomName, projectId: payload.project.projectId, rev: downloaded.metadata.rev };
      } catch (error) {
        if (error.status === 401 || error.status === 403) throw error;
        return { path, name: fallback || entry.name, needsRecovery: true };
      }
    }));
    catalogue.push(...group);
  }
  for (const entry of files.filter((item) => item['.tag'] === 'file' && item.name.endsWith('.caps.json'))) {
    if (catalogue.some((project) => project.projectId && entry.name.endsWith(`-${project.projectId}.caps.json`))) continue;
    catalogue.push({ path: entry.path_lower, name: entry.name.replace(/\.caps\.json$/, ''), legacy: true });
  }
  assertDropboxAccount(accountId);
  catalogue.sort((a, b) => a.name.localeCompare(b.name));
  await workspaceRecord(`dropbox-catalogue:${accountId}`, catalogue);
  assertDropboxAccount(accountId);
  dropboxCatalogueAccount = accountId;
  dropboxProjectCatalogue = catalogue;
  renderProjectLibraryOptions();
  return catalogue;
}

function initializeProjectLibrary() {
  if (document.getElementById('projectLibraryDialog')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'projectLibraryDialog';
  dialog.setAttribute('aria-labelledby', 'projectLibraryTitle');
  dialog.innerHTML = '<form id="projectLibraryForm"><header><h2 id="projectLibraryTitle">Workspace settings</h2><button type="button" id="closeProjectLibrary" aria-label="Close project list">×</button></header><div class="project-library-body"><p id="workspaceAccountLabel"></p><p>This workspace contains the projects in your selected Dropbox account. Switch accounts to open a different workspace.</p><div class="project-library-actions"><button type="button" id="startProjectSetup">New project</button><button type="button" id="connectProjectLibrary">Connect Dropbox</button><button type="button" id="refreshProjectLibrary">Refresh projects</button></div><p id="projectLibraryStatus" role="status"></p><label>Project<select id="projectLibrarySelect" required></select></label><div class="project-library-actions"><button type="button" id="downloadWorkspaceProject">Download project ZIP</button><button type="button" id="deleteWorkspaceProject">Delete project</button></div><label>Sync interval (minutes)<input id="workspaceSyncInterval" type="number" min="0" max="10080" value="10" step="1"></label><p>Checks for changes while this app is open. Default: 10 minutes. Set 0 for manual sync only. Remote changes are flagged for review; unsaved local edits are never replaced automatically.</p><button type="button" id="saveWorkspaceInterval">Save sync interval</button><label>Document history limit<input id="workspaceHistoryLimit" type="number" min="0" max="100" step="1" value="5"></label><p>Previous saved versions per document, in addition to the current version. Default: 5. Set 0 to keep only current versions. Reducing this removes older history after the next successful cleanup. This setting follows your Dropbox workspace. Increasing it retains future saves; it cannot bring back removed versions. Refresh older app tabs before changing this setting.</p><button type="button" id="saveWorkspaceHistory">Save history limit</button><button type="button" id="releaseWorkspaceSync">Release interrupted sync</button><hr><div class="project-library-actions"><button type="button" id="downloadWholeWorkspace">Download workspace ZIP</button><button type="button" id="formatWorkspace">Format workspace</button></div></div><footer><button type="submit" id="openLibraryProject">Open selected project</button></footer></form>';
  document.body.append(dialog);
  dialog.querySelector('#downloadWorkspaceProject').onclick = () => dropboxAction(() => downloadWorkspaceZip(projectLibraryEntries.find(entry => entry.key === dialog.querySelector('select').value)));
  dialog.querySelector('#downloadWholeWorkspace').onclick = () => dropboxAction(() => downloadWorkspaceZip());
  dialog.querySelector('#deleteWorkspaceProject').onclick = () => runProjectFileAction(() => confirmWorkspaceDeletion());
  dialog.querySelector('#formatWorkspace').onclick = () => runProjectFileAction(() => confirmWorkspaceDeletion({ all: true }));
  dialog.querySelector('#saveWorkspaceInterval').onclick = () => runProjectFileAction(async () => {
    const minutes = await setWorkspaceSyncInterval(dialog.querySelector('#workspaceSyncInterval').value);
    dialog.querySelector('#projectLibraryStatus').textContent = minutes ? `Automatic sync checks every ${minutes} minute(s).` : 'Manual sync only. Use Sync now when ready.';
  });
  dialog.querySelector('#saveWorkspaceHistory').onclick = () => dropboxAction(async () => {
    const limit = await setWorkspaceHistoryLimit(dialog.querySelector('#workspaceHistoryLimit').value);
    dialog.querySelector('#projectLibraryStatus').textContent = `Keeping ${limit} previous version(s) per document, plus the current version.`;
  });
  dialog.querySelector('#releaseWorkspaceSync').onclick = () => dropboxAction(() => releaseInterruptedProjectSync(projectLibraryEntries.find(entry => entry.key === dialog.querySelector('select').value)));
  dialog.querySelector('#closeProjectLibrary').onclick = () => { projectLibrarySequence++; dialog.close(); };
  dialog.querySelector('#connectProjectLibrary').onclick = () => connectAndBrowseProjects({ switchAccount: Boolean(dropboxConnection && dropboxConnection.expiresAt > Date.now() + 10000) });
  dialog.querySelector('#refreshProjectLibrary').onclick = () => openSavedProject({ refresh: true });
  dialog.querySelector('form').onsubmit = async (event) => {
    event.preventDefault();
    const selected = projectLibraryEntries.find((entry) => entry.key === dialog.querySelector('select').value);
    if (!selected) return;
    const open = dialog.querySelector('#openLibraryProject');
    open.disabled = true;
    try {
      if (selected.cloud) {
        if (!dropboxConnection || dropboxConnection.expiresAt <= Date.now() + 10000) { await connectAndBrowseProjects(); return; }
        dialog.close();
        await dropboxAction(() => openDropboxProjectPath(selected.path, { chooseDocument: true }));
      } else {
        dialog.close();
        await openLocalProjectRecord(selected.record);
      }
    } catch (error) { document.getElementById('projectLibraryStatus').textContent = error.message; }
    finally { open.disabled = false; }
  };
}

function renderProjectLibraryOptions(localRecords) {
  const select = document.getElementById('projectLibrarySelect');
  if (!select) return;
  const value = select.value;
  let local = localRecords || projectLibraryEntries.filter((entry) => !entry.cloud).map((entry) => entry.record);
  if (dropboxConnection) local = local.filter(record => JSON.parse(record.json).workspaceAccountId === dropboxConnection.accountId);
  const cloud = dropboxCatalogueAccount === dropboxConnection?.accountId ? dropboxProjectCatalogue : [];
  projectLibraryEntries = [
    ...cloud.map((project) => ({ ...project, key: `dropbox:${project.path}`, cloud: true })),
    ...local.map((record) => ({ key: `local:${record.recordKey || record.projectId}`, name: record.name || 'Untitled project', record, cloud: false })),
  ];
  select.replaceChildren();
  for (const [label, entries] of [['Dropbox', projectLibraryEntries.filter((entry) => entry.cloud)], [dropboxConnection ? 'Browser drafts in this workspace' : 'This browser', projectLibraryEntries.filter((entry) => !entry.cloud)]]) {
    if (!entries.length) continue;
    const group = document.createElement('optgroup'); group.label = label;
    for (const entry of entries) {
      const option = document.createElement('option'); option.value = entry.key;
      option.textContent = `${entry.name}${entry.legacy ? ' (older backup)' : entry.needsRecovery ? ' (recovery available)' : ''}`;
      group.append(option);
    }
    select.append(group);
  }
  if (projectLibraryEntries.some((entry) => entry.key === value)) select.value = value;
  document.getElementById('openLibraryProject').disabled = !projectLibraryEntries.length;
  const valid = dropboxConnection && dropboxConnection.expiresAt > Date.now() + 10000;
  document.getElementById('connectProjectLibrary').textContent = valid ? 'Change Dropbox account' : dropboxConnection ? 'Reconnect Dropbox' : 'Connect Dropbox';
  document.getElementById('refreshProjectLibrary').disabled = !valid;
  document.getElementById('workspaceAccountLabel').textContent = dropboxConnection ? `Dropbox: ${dropboxConnection.label || dropboxConnection.accountId}` : 'No Dropbox workspace connected. Browser-only projects are listed below.';
  for (const id of ['downloadWorkspaceProject','downloadWholeWorkspace','deleteWorkspaceProject','formatWorkspace','saveWorkspaceInterval','saveWorkspaceHistory','releaseWorkspaceSync']) document.getElementById(id).disabled = !valid;
  document.getElementById('workspaceSyncInterval').value = workspaceSyncInterval;
  setWorkspaceControlsBusy();
}

async function connectAndBrowseProjects({ switchAccount = false } = {}) {
  // Start OAuth directly in the click handler so browsers allow its sign-in popup.
  if (!document.getElementById('rememberDropbox')) renderDropboxStorage();
  const wizard = document.getElementById('projectSetupDialog');
  wizard?.close();
  document.getElementById('projectLibraryDialog')?.close();
  return dropboxAction(async () => {
    await connectDropbox({ switchAccount });
    await openSavedProject({ refresh: false });
  });
}

async function openSavedProject({ refresh = true } = {}) {
  initializeProjectLibrary();
  const sequence = ++projectLibrarySequence;
  const dialog = document.getElementById('projectLibraryDialog');
  if (!dialog.open) dialog.showModal();
  const status = document.getElementById('projectLibraryStatus');
  status.textContent = 'Loading projects…';
  const records = await listSavedProjectIndexes();
  if (sequence !== projectLibrarySequence) return;
  renderProjectLibraryOptions(records);
  if (!dropboxConnection || dropboxConnection.expiresAt <= Date.now() + 10000) {
    status.textContent = 'Already set up on another device? Connect the same Dropbox account to see your projects here.';
    return;
  }
  try {
    if (refresh) await refreshDropboxProjects();
    await loadWorkspaceHistorySettings();
    if (sequence !== projectLibrarySequence) return;
    status.textContent = `${dropboxProjectCatalogue.length} Dropbox project(s). Select a project, then choose a document to open.`;
  } catch (error) { status.textContent = `Could not refresh Dropbox projects. ${error.message} Cached projects and browser copies are still listed.`; }
}

async function openLocalProjectRecord(record) {
  const project = JSON.parse(record.json);
  if (!await chooseProjectDocument(project)) return;
  await ensureDocumentContent(project.documents.find((doc) => doc.id === project.activeId));
  await prepareProjectReplacement();
  const previous = serializedWorkspace();
  try {
    restoreWorkspaceObject(project);
    state.googleDrive.projectFolderId = ''; state.googleDrive.projectName = '';
    if (project.designSettings) setProjectDesignSettings(project.designSettings);
    await writeWorkspaceSnapshot();
  } catch (error) { restoreWorkspaceObject(JSON.parse(previous)); throw error; }
  renderAll(); updateUrl(); updateProjectSettingsStatus();
  setStatus('Opened saved project', 'saved');
}
