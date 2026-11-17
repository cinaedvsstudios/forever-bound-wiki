/* Capsanoto project setup, local persistence, and read-only document import. */
let workspaceRevision = 0;
let workspaceWriteQueue = Promise.resolve();
let localSavePending = 0;
let localSaveFailed = false;
let firstWorkspaceRun = false;
let setupSession = null;

function openWorkspaceDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('capsanoto-workspaces-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other Capsanoto tabs and try again.'));
  });
}

async function workspaceRecord(key, value) {
  const db = await openWorkspaceDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('records', value === undefined ? 'readonly' : 'readwrite');
      const request = value === undefined ? tx.objectStore('records').get(key) : tx.objectStore('records').put(value, key);
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Browser storage transaction was cancelled.'));
    });
  } finally { db.close(); }
}

async function readWorkspaceSnapshot() {
  const record = await workspaceRecord('active');
  workspaceRevision = record?.revision || 0;
  return record?.json || localStorage.getItem(STORAGE_KEY);
}

function writeWorkspaceSnapshot() {
  // Capture now: a later project switch must not change a pending save's contents.
  state.projectId ||= crypto.randomUUID();
  const json = serializedWorkspace();
  const projectId = state.projectId;
  const name = state.writingRoomName;
  localSavePending++;
  const operation = workspaceWriteQueue.catch(() => {}).then(async () => {
    const captured = JSON.parse(json);
    const { index, bodies } = await encodeProjectIndex(captured);
    const indexJson = JSON.stringify(index);
    const db = await openWorkspaceDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('records', 'readwrite');
        const records = tx.objectStore('records');
        let conflict = false;
        const request = records.get('active');
        request.onsuccess = () => {
          if ((request.result?.revision || 0) !== workspaceRevision) {
            conflict = true;
            tx.abort();
            return;
          }
          if (request.result?.json && !request.result.storageFormat) {
            let bodyReferences = null;
            try {
              const legacy = JSON.parse(request.result.json);
              bodyReferences = PROJECT_DOCUMENT_COLLECTIONS.flatMap((collection) => (legacy[collection] || []).filter((doc) => validDocumentBodyRef(doc._body)).map((doc) => documentBodyKey(doc._body.hash)));
            } catch { /* Preserve unreadable recovery data without pruning its possible dependencies. */ }
            records.put({ ...request.result, bodyReferences }, `legacy-project:${request.result.projectId || projectId}`);
          }
          for (const [hash, text] of bodies) records.put(text, documentBodyKey(hash));
          const record = { json: indexJson, storageFormat: 'document-files-v1', revision: workspaceRevision + 1, projectId, name, savedAt: new Date().toISOString() };
          records.put(record, 'active');
          records.put(record, `project:${projectId}`);
          // Prune only unreferenced local cache records in this same atomic transaction.
          pruneUnreferencedDocumentBodies(records);
        };
        tx.oncomplete = () => { workspaceRevision++; resolve(); };
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(conflict ? new Error('Another tab saved a different copy. Download this copy before reloading.') : tx.error || new Error('Browser storage write failed.'));
      });
      rememberIndexedDocumentBodies(captured, index);
      localSaveFailed = false;
      showStorageWarning('');
    } finally { db.close(); }
  }).catch((error) => {
    localSaveFailed = true;
    showStorageWarning(`Changes are not saved in this browser. ${error.message} Download a backup before closing.`);
    throw error;
  }).finally(() => { localSavePending--; });
  workspaceWriteQueue = operation;
  return operation;
}

function showStorageWarning(message) {
  let banner = document.getElementById('storageWarning');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'storageWarning';
    banner.setAttribute('role', 'alert');
    const text = document.createElement('span');
    const button = document.createElement('button');
    button.textContent = 'Download backup';
    button.onclick = () => downloadCapsanotoProjectBackup();
    banner.append(text, button);
    document.body.append(banner);
  }
  banner.firstElementChild.textContent = message;
  banner.hidden = !message;
}

function safeDocumentHtml(html) {
  if (!window.DOMPurify) throw new Error('The document safety filter could not load. Refresh before importing.');
  return DOMPurify.sanitize(String(html || ''), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed', 'style', 'link', 'meta'],
    FORBID_ATTR: ['srcset', 'autofocus'],
    ADD_ATTR: ['data-bookmark', 'data-link-target', 'data-link-style'],
  });
}

function validateImportedDocuments(documents, { allowUnloaded = false } = {}) {
  const ids = new Set();
  for (const doc of documents) {
    if (!doc || typeof doc.id !== 'string' || typeof doc.title !== 'string' || (typeof doc.content !== 'string' && !(allowUnloaded && validDocumentBodyRef(doc._body))) || (doc.tags !== undefined && !Array.isArray(doc.tags))) throw new Error('This backup has invalid document data. The current project is unchanged.');
    if (ids.has(doc.id)) throw new Error('This backup contains duplicate document IDs. The current project is unchanged.');
    ids.add(doc.id);
  }
  const byId = new Map(documents.map((doc) => [doc.id, doc]));
  for (const doc of documents) {
    const visited = new Set([doc.id]);
    let parent = doc.parentDocumentId;
    while (parent) {
      if (!ids.has(parent)) throw new Error('A nested document is missing its parent. The current project is unchanged.');
      if (visited.has(parent)) throw new Error('This backup has a circular document hierarchy. The current project is unchanged.');
      visited.add(parent);
      parent = byId.get(parent).parentDocumentId;
    }
  }
}

async function prepareProjectReplacement({ detach = true } = {}) {
  if (state.folderMode.writeInProgress || state.googleDrive.syncInProgress) throw new Error('Wait for the current storage operation to finish.');
  if (dropboxBusy && !dropboxOpeningProject) throw new Error('Wait for the Dropbox operation to finish.');
  syncEditorToDocument();
  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  await writeWorkspaceSnapshot(); // Every project remains available in Open project.
  const savedIndex = await workspaceRecord('active');
  await workspaceRecord('previous-project', { json: savedIndex.json, storageFormat: 'document-files-v1', savedAt: new Date().toISOString() });
  if (detach) await detachBackupFolder();
}

async function detachBackupFolder() {
  if (state.folderMode.writeInProgress) throw new Error('Wait for the current backup to finish.');
  await storeFolderModeHandle(null);
  state.folderMode.enabled = false;
  state.folderMode.directoryHandle = null;
  state.folderMode.projectName = '';
  state.folderMode.lastDiskSaveAt = '';
  document.querySelector('.folder-mode-toast')?.remove();
}

function initializeProjectSetup() {
  if (document.getElementById('projectSetupDialog')) return;
  const actions = document.createElement('div');
  actions.id = 'projectActions';
  actions.className = 'project-actions';
  actions.innerHTML = '<div class="project-action-buttons" role="group" aria-label="Project controls"><button type="button" id="startProjectSetup">New project</button><button type="button" id="addProjectFile">Add file</button><button type="button" id="openSavedProject">Open project</button><button type="button" id="quickDropboxSync">Connect Dropbox</button></div><div class="project-save-status"><span id="bottomDropboxStatus" role="status" aria-live="polite"></span></div>';
  els.documentEndBar.append(actions);
  initializeProjectSettingsViews();
  els.saveStatus.setAttribute('role', 'status');
  els.saveStatus.setAttribute('aria-live', 'polite');
  actions.querySelector('.project-save-status').prepend(els.saveStatus);
  document.getElementById('quickDropboxSync').onclick = () => {
    if (!document.getElementById('rememberDropbox')) renderDropboxStorage();
    const valid = dropboxConnection && dropboxConnection.expiresAt > Date.now() + 10000;
    return dropboxAction(valid ? syncDropboxProject : connectDropbox);
  };
  renderBottomDropboxControl();
  document.getElementById('startProjectSetup').onclick = () => openProjectSetup('new');
  document.getElementById('addProjectFile').onclick = () => openProjectSetup('add');
  document.querySelectorAll('[data-open-file-import]').forEach((button) => { button.onclick = () => openProjectSetup('add'); });
  document.getElementById('openSavedProject').onclick = openSavedProject;
  const recover = document.createElement('button');
  recover.type = 'button'; recover.textContent = 'Download previous working copy';
  recover.onclick = () => runProjectFileAction(async () => {
    const previous = await workspaceRecord('previous-project');
    if (!previous) { setStatus('No previous working copy has been saved yet', 'dirty'); return; }
    const complete = await completeProjectCopy(JSON.parse(previous.json));
    downloadFile('Previous-Working-Copy.caps.json', JSON.stringify(complete, null, 2), 'application/json');
  });
  els.downloadProjectBackupButton?.parentElement.append(recover);
  const dialog = document.createElement('dialog');
  dialog.id = 'projectSetupDialog';
  dialog.setAttribute('aria-labelledby', 'setupTitle');
  dialog.innerHTML = '<form id="projectSetupForm"><header><div><p class="eyebrow">One document at a time</p><h2 id="setupTitle">Create your project</h2></div><button type="button" id="setupClose" aria-label="Close project setup">×</button></header><div id="setupBody"></div><p id="setupError" role="alert"></p><footer><button type="button" id="setupBack">Back</button><button type="submit" id="setupNext">Continue</button></footer></form>';
  document.body.append(dialog);
  dialog.querySelector('#setupClose').onclick = () => dialog.close();
  dialog.querySelector('#setupBack').onclick = () => { setupSession.step--; renderProjectSetup(); };
  dialog.querySelector('form').onsubmit = advanceProjectSetup;
  dialog.addEventListener('cancel', (event) => { if (setupSession?.busy) event.preventDefault(); });
  window.addEventListener('beforeunload', (event) => {
    if (localSaveFailed || localSavePending || state.saveTimer) { event.preventDefault(); event.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.saveTimer) void persistNow();
  });
  if (firstWorkspaceRun) openProjectSetup('new');
}

function initializeProjectSettingsViews() {
  const panel = els.projectSettingsPanel;
  if (!panel || panel.querySelector('.project-settings-tabs')) return;
  const navigation = document.createElement('nav');
  navigation.className = 'project-settings-tabs';
  navigation.setAttribute('role', 'tablist');
  navigation.setAttribute('aria-label', 'Project settings sections');
  const body = document.createElement('div'); body.className = 'project-settings-body';
  const definitions = [['storage', 'Storage'], ['backups', 'Backups & files'], ['details', 'Project details']];
  const views = new Map();
  for (const [id, label] of definitions) {
    const view = document.createElement('div');
    view.id = `project-view-${id}`; view.setAttribute('role', 'tabpanel');
    view.setAttribute('aria-labelledby', `project-tab-${id}`); view.tabIndex = 0; view.hidden = id !== 'storage';
    const tab = document.createElement('button'); tab.type = 'button'; tab.id = `project-tab-${id}`;
    tab.textContent = label; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', view.id);
    tab.setAttribute('aria-selected', String(id === 'storage')); tab.tabIndex = id === 'storage' ? 0 : -1;
    tab.onclick = () => { for (const [key, value] of views) { value.view.hidden = key !== id; value.tab.setAttribute('aria-selected', String(key === id)); value.tab.tabIndex = key === id ? 0 : -1; } };
    tab.onkeydown = (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = definitions.findIndex(([key]) => key === id);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3;
      const target = views.get(definitions[next][0]).tab; target.click(); target.focus();
    };
    views.set(id, { view, tab }); navigation.append(tab); body.append(view);
  }
  for (const section of [...panel.querySelectorAll(':scope > .project-settings-section')]) {
    const id = section.id === 'dropboxStorageSection' ? 'storage' : section.querySelector('#projectInfoStatus') ? 'details' : 'backups';
    views.get(id).view.append(section);
  }
  const developer = document.createElement('div'); developer.id = 'dropboxDeveloperControls';
  views.get('details').view.append(developer);
  const exportCard = document.createElement('section'); exportCard.className = 'project-settings-section project-export-card';
  exportCard.innerHTML = '<h3>Readable Markdown copy</h3><p>Download each document as an .md file in one ZIP, with images and a map of the document hierarchy. Use the complete project backup to restore all app features.</p><button id="downloadMarkdownProject" type="button">Download Markdown copy</button>';
  exportCard.querySelector('button').onclick = () => downloadMarkdownProject().catch((error) => { setStatus('Markdown download failed', 'dirty'); showStorageWarning(error.message); });
  views.get('backups').view.append(exportCard);
  panel.querySelector('header').after(navigation, body);
}

function openProjectSetup(mode = 'new') {
  setupSession = { mode, step: mode === 'new' ? 1 : 2, name: mode === 'new' ? '' : state.writingRoomName, source: null, selected: new Set(), busy: false };
  renderProjectSetup();
  document.getElementById('projectSetupDialog').showModal();
}

function renderProjectSetup() {
  const session = setupSession;
  const body = document.getElementById('setupBody');
  document.getElementById('setupTitle').textContent = session.mode === 'add' ? `Add to ${state.writingRoomName}` : 'Create your project';
  document.getElementById('setupError').textContent = '';
  document.getElementById('setupBack').hidden = session.step === (session.mode === 'new' ? 1 : 2);
  document.getElementById('setupNext').textContent = session.step === 3 ? (session.mode === 'new' ? 'Create project and import' : session.source?.format === 'word' ? 'Import document' : 'Import selected tabs') : 'Continue';
  if (session.step === 1) {
    body.innerHTML = '<p class="setup-step">Step 1 of 3 · Your collection</p><p>A project holds documents under one theme: scripts, bible, characters, and notes.</p><label>Project name<input id="setupName" placeholder="Forever Bound" maxlength="120" required></label><p class="setup-note">Your current project stays available in Open project. Start with one source document; add more whenever you are ready.</p>';
    body.querySelector('input').value = session.name;
    body.querySelector('input').focus();
  } else if (session.step === 2) {
    body.innerHTML = '<p class="setup-step">Step 2 of 3 · Choose one source</p><label>Downloaded file<input id="setupFile" type="file" accept=".docx,.txt,.md,.html,.htm,.json"></label><p class="setup-note"><strong>Word combines tabs.</strong> Downloading “all tabs” puts their content into one .docx file. Capsanoto imports that as one document; it cannot reliably rebuild the original tabs. To keep tabs and nesting, use a tab-aware Google Docs source package or direct Google Docs import below. You do not need to download each tab separately.</p><details><summary>Import Google Docs tabs directly</summary><p>Read a Google Doc once, select its tabs, and copy them here. Nothing is written back to Google.</p><label>Google Docs link<input id="setupGoogleUrl" type="url" placeholder="https://docs.google.com/document/d/…"></label><button id="setupReadGoogle" type="button">Read tabs from Google Docs</button><p class="setup-note">Google will ask for read-only Docs access. This requires the Google Docs API and this site’s address to be enabled for the app’s Google client.</p></details><p id="setupSourceStatus" role="status"></p><p class="setup-note">Files are copied into this browser. Your originals stay intact. Word, Markdown, text, HTML, and Capsanoto Google Docs source packages are supported. Old .doc files must be downloaded as .docx.</p>';
    const status = document.getElementById('setupSourceStatus');
    status.textContent = session.source ? importSourceStatus(session.source) : 'No file selected yet.';
    updateSourcePreviewButton();
    document.getElementById('setupFile').onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      session.source = null;
      await setupWork(async () => {
        session.source = await readImportFile(file);
        session.selected = new Set(session.source.tabs.map((tab) => tab.id));
        status.textContent = importSourceStatus(session.source);
      });
    };
    document.getElementById('setupReadGoogle').onclick = () => setupWork(async () => {
      const url = document.getElementById('setupGoogleUrl').value.trim();
      const source = await readGoogleDocsSource(url);
      session.source = source;
      session.selected = new Set(session.source.tabs.map((tab) => tab.id));
      status.textContent = importSourceStatus(session.source);
    });
  } else {
    const source = session.source;
    const word = source.format === 'word';
    body.innerHTML = `<p class="setup-step">Step 3 of 3 · Review ${word ? 'document' : 'tabs'}</p><h3>${escapeHtml(source.title)}</h3><p>${word ? '<strong>This will import one combined document.</strong> Text from the selected Google tabs may be included, but their names and nesting are not available in this Word file.' : 'Select the tabs to copy. Each becomes a file; a selected child stays nested under its selected parent. You can skip alternate copies such as a full-script tab.'}</p>${word ? '' : '<div class="setup-selection-tools"><label class="sr-only" for="setupTabFilter">Filter tabs</label><input id="setupTabFilter" type="search" placeholder="Find a tab…"><button type="button" id="setupSelectAll">Select all</button><button type="button" id="setupSelectNone">Select none</button></div>'}<p id="setupSelectionCount" class="setup-note" role="status"></p><div id="setupTabList"></div><section id="setupPreviewSection" hidden aria-label="Document preview"><h4 id="setupPreviewTitle"></h4><div class="setup-preview" id="setupPreview" tabindex="0"></div></section><p class="setup-note">${escapeHtml((source.warnings || []).join(' '))}</p><p class="setup-note">Click Preview to read the complete extracted text here. Comments, suggestions, exact page layout, and some embedded objects may not transfer. Check the imported copy before removing originals.</p>`;
    const list = document.getElementById('setupTabList');
    for (const tab of source.tabs) {
      const row = document.createElement('div');
      row.className = 'setup-tab';
      row.dataset.tabTitle = tab.title.toLowerCase();
      row.style.paddingLeft = `${Math.min(tab.depth || 0, 8) * 18}px`;
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.checked = session.selected.has(tab.id);
      checkbox.dataset.sourceTab = tab.id;
      checkbox.onchange = () => { checkbox.checked ? session.selected.add(tab.id) : session.selected.delete(tab.id); updateImportSelectionCount(); };
      const title = document.createElement('span');
      title.textContent = `${tab.title} · ${tab.textLength.toLocaleString()} characters`;
      const preview = document.createElement('button');
      preview.type = 'button'; preview.textContent = 'Preview';
      preview.setAttribute('aria-controls', 'setupPreviewSection'); preview.setAttribute('aria-pressed', 'false');
      preview.onclick = () => { list.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button === preview))); previewSetupTab(tab); };
      label.append(checkbox, title); row.append(label, preview); list.append(row);
    }
    updateImportSelectionCount();
    document.getElementById('setupTabFilter')?.addEventListener('input', (event) => {
      const query = event.target.value.toLowerCase().trim();
      list.querySelectorAll('.setup-tab').forEach((row) => { row.hidden = !row.dataset.tabTitle.includes(query); });
    });
    const select = (checked) => { session.selected = new Set(checked ? source.tabs.map((tab) => tab.id) : []); list.querySelectorAll('input').forEach((input) => { input.checked = checked; }); updateImportSelectionCount(); };
    document.getElementById('setupSelectAll')?.addEventListener('click', () => select(true));
    document.getElementById('setupSelectNone')?.addEventListener('click', () => select(false));
  }
}

function importSourceStatus(source) {
  return source.format === 'word' ? `${source.title}: 1 combined Word document ready · original tabs cannot be recovered from this file` : `${source.title}: ${source.tabs.length} tabs ready`;
}

function updateImportSelectionCount() {
  document.getElementById('setupSelectionCount').textContent = `${setupSession.selected.size} of ${setupSession.source.tabs.length} ${setupSession.source.format === 'word' ? 'document' : 'tabs'} selected`;
}

function updateSourcePreviewButton() {
  if (setupSession.step !== 2) return;
  const source = setupSession.source;
  const button = document.getElementById('setupNext');
  button.disabled = !source;
  button.textContent = source?.format === 'google-tabs' ? `Preview all ${source.tabs.length} tabs` : 'Preview document';
  button.setAttribute('aria-label', source?.format === 'google-tabs' ? `Preview all ${source.tabs.length} tabs and their nesting before importing` : 'Preview document before importing');
}

function importPreviewText(html) {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  body.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  body.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,tr,blockquote,div').forEach((element) => element.append('\n\n'));
  return body.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

function previewSetupTab(tab) {
  const section = document.getElementById('setupPreviewSection');
  section.hidden = false;
  document.getElementById('setupPreviewTitle').textContent = `Previewing: ${tab.title}`;
  const preview = document.getElementById('setupPreview');
  preview.textContent = importPreviewText(tab.html);
  preview.scrollTop = 0;
  preview.focus({ preventScroll: true });
  section.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

async function setupWork(operation) {
  setupSession.busy = true;
  document.querySelectorAll('#projectSetupDialog button, #setupFile').forEach((el) => { el.disabled = true; });
  document.getElementById('setupError').textContent = '';
  try { await operation(); }
  catch (error) { document.getElementById('setupError').textContent = error.message || 'Import failed. Your current project is unchanged.'; }
  finally {
    setupSession.busy = false;
    document.querySelectorAll('#projectSetupDialog button, #setupFile').forEach((el) => { el.disabled = false; });
    updateSourcePreviewButton();
  }
}

async function advanceProjectSetup(event) {
  event.preventDefault();
  if (setupSession.busy) return;
  if (setupSession.step === 1) {
    setupSession.name = document.getElementById('setupName').value.trim();
    if (!setupSession.name) return;
    setupSession.step = 2;
    renderProjectSetup();
  } else if (setupSession.step === 2) {
    if (!setupSession.source) { document.getElementById('setupError').textContent = 'Choose a file or read a Google Doc first.'; return; }
    setupSession.step = 3;
    renderProjectSetup();
  } else await setupWork(async () => {
    await commitProjectImport(setupSession);
    document.getElementById('projectSetupDialog').close();
    toggleProjectSettingsPanel(true);
  });
}

async function readImportFile(file) {
  if (file.size > 25 * 1024 * 1024) throw new Error('Choose a file smaller than 25 MB. Split a large document into smaller downloads.');
  const ext = file.name.split('.').pop().toLowerCase();
  const title = file.name.replace(/\.[^.]+$/, '');
  let html = '';
  const warnings = [];
  if (ext === 'docx') {
    if (!window.mammoth) throw new Error('The Word importer could not load. Refresh and try again.');
    const converted = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { externalFileAccess: false });
    html = safeDocumentHtml(converted.value);
    warnings.push('Word imports are combined documents. Tab-aware source packages and direct Google Docs imports preserve separate tabs.');
    warnings.push(...converted.messages.map((message) => message.message));
  } else {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (ext === 'json') {
      const payload = JSON.parse(text);
      if (payload.type !== 'capsanoto-google-docs-source') throw new Error('Use Import Project Backup for a project backup. This input accepts Google Docs source packages.');
      return googleDocsToImportSource(payload.document);
    }
    if (ext === 'html' || ext === 'htm') html = safeDocumentHtml(text);
    else if (ext === 'md') html = safeDocumentHtml(capsMarkdownToHtml(parseCapsFrontMatter(text).body));
    else if (ext === 'txt') html = text.split(/\n\s*\n/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
    else throw new Error('Choose a .docx, .txt, .md, .html, or Google Docs source .json file.');
  }
  if (!new DOMParser().parseFromString(html, 'text/html').body.textContent.trim() && !/<img\b/.test(html)) throw new Error('This file has no importable content.');
  return { title, warnings, format: ext === 'docx' ? 'word' : ext, sourceKey: '', tabs: [{ id: 'file', title, html, textLength: new DOMParser().parseFromString(html, 'text/html').body.textContent.length, parentId: '', depth: 0 }] };
}

function googleDocsToImportSource(doc) {
  if (!doc || typeof doc.documentId !== 'string') throw new Error('Invalid Google Docs source package.');
  const tabs = [];
  const warnings = new Set();
  function flatten(items, parentId = '', depth = 0) {
    for (const tab of items || []) {
      const properties = tab.tabProperties || tab;
      const tabId = properties.tabId;
      const documentTab = tab.documentTab || tab;
      if (tabId) {
        if (!Array.isArray(documentTab.body?.content)) throw new Error('This source contains tab names without their content. Use a complete tab-aware source package.');
        const html = safeDocumentHtml(googleDocsElementsHtml(documentTab.body?.content || [], documentTab, warnings));
        tabs.push({ id: tabId, title: properties.title || 'Untitled tab', parentId: properties.parentTabId || parentId, depth, html, textLength: new DOMParser().parseFromString(html, 'text/html').body.textContent.length });
      }
      flatten(tab.childTabs, tabId || parentId, depth + 1);
    }
  }
  flatten(doc.tabs);
  if (!tabs.length && doc.body) {
    const html = safeDocumentHtml(googleDocsElementsHtml(doc.body.content || [], doc, warnings));
    tabs.push({ id: 'body', title: doc.title || 'Document', html, textLength: new DOMParser().parseFromString(html, 'text/html').body.textContent.length, parentId: '', depth: 0 });
  }
  if (!tabs.length) throw new Error('No readable tabs were returned.');
  // Connector packages flatten tabs; reconstruct their depth from parent IDs.
  const byId = new Map(tabs.map((tab) => [tab.id, tab]));
  for (const tab of tabs) {
    const seen = new Set([tab.id]);
    let parent = byId.get(tab.parentId);
    tab.depth = 0;
    while (parent && !seen.has(parent.id)) { tab.depth++; seen.add(parent.id); parent = byId.get(parent.parentId); }
  }
  return { title: doc.title || 'Google Doc', format: 'google-tabs', sourceKey: doc.documentId, tabs, warnings: [...warnings] };
}

function googleDocsElementsHtml(elements, tab, warnings) {
  const output = [];
  let listStack = [];
  const closeLists = (depth = 0) => { while (listStack.length > depth) output.push(`</li></${listStack.pop()}>`); };
  for (const element of elements) {
    if (element.table) {
      closeLists();
      output.push('<table><tbody>' + (element.table.tableRows || []).map((row) => '<tr>' + (row.tableCells || []).map((cell) => `<td${cell.tableCellStyle?.columnSpan > 1 ? ` colspan="${Number(cell.tableCellStyle.columnSpan)}"` : ''}>${googleDocsElementsHtml(cell.content || [], tab, warnings)}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
    } else if (element.paragraph) {
      const p = element.paragraph;
      const text = (p.elements || []).map((part) => {
        if (part.textRun) {
          const style = part.textRun.textStyle || {};
          let content = escapeHtml(part.textRun.content.replace(/\n$/, '')).replace(/[\n\v]/g, '<br>');
          if (style.bold) content = `<strong>${content}</strong>`;
          if (style.italic) content = `<em>${content}</em>`;
          if (style.underline) content = `<u>${content}</u>`;
          if (style.strikethrough) content = `<s>${content}</s>`;
          if (style.link?.url) content = `<a href="${escapeAttr(style.link.url)}">${content}</a>`;
          return content;
        }
        if (part.horizontalRule) return '<hr>';
        if (part.inlineObjectElement || part.person || part.richLink || part.footnoteReference) {
          warnings.add('Images, drawings, footnotes, and smart chips need review in the original; placeholders mark unsupported objects.');
          return '<span>[Embedded object — see original Google Doc]</span>';
        }
        return '';
      }).join('');
      const type = p.paragraphStyle?.namedStyleType || '';
      const level = /^HEADING_([1-6])$/.exec(type)?.[1];
      const tag = level ? `h${level}` : type === 'TITLE' ? 'h1' : 'p';
      const id = p.paragraphStyle?.headingId;
      if (p.bullet) {
        const depth = Math.min(Number(p.bullet.nestingLevel || 0) + 1, 9);
        const list = tab.lists?.[p.bullet.listId]?.listProperties?.nestingLevels?.[depth - 1];
        const listTag = list?.glyphType && !['GLYPH_TYPE_UNSPECIFIED', 'NONE'].includes(list.glyphType) ? 'ol' : 'ul';
        closeLists(depth);
        if (listStack.length === depth && listStack[depth - 1] !== listTag) closeLists(depth - 1);
        if (listStack.length === depth) output.push('</li><li>');
        while (listStack.length < depth) { output.push(`<${listTag}><li>`); listStack.push(listTag); }
        output.push(text || '<br>');
      } else {
        closeLists();
        output.push(`<${tag}${id ? ` id="${escapeAttr(id)}"` : ''}>${text || '<br>'}</${tag}>`);
      }
    }
  }
  closeLists();
  return output.join('');
}

async function readGoogleDocsSource(url) {
  const parsed = new URL(url);
  const id = parsed.hostname === 'docs.google.com' && /^\/document\/d\/([\w-]+)/.exec(parsed.pathname)?.[1];
  if (!id) throw new Error('Enter a Google Docs document link.');
  await loadGoogleIdentityScript();
  const token = await new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_DRIVE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/documents.readonly',
      callback: (response) => response.error ? reject(new Error(response.error_description || response.error)) : resolve(response.access_token),
      error_callback: (error) => reject(new Error(error.message || error.type || 'Google connection cancelled.')),
    });
    client.requestAccessToken();
  });
  try {
    const response = await fetch(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(id)}?includeTabsContent=true`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      const detail = problem.error?.message || 'Check document access and Google Docs API setup.';
      throw new Error(`Google Docs could not be read (${response.status}). ${detail} A selected downloaded file is still available. A Word download combines tabs; use a tab-aware source package to preserve them.`);
    }
    return googleDocsToImportSource(await response.json());
  } finally {
    // The read-only token stays only in this operation's memory.
  }
}

async function commitProjectImport(session) {
  const selected = session.source.tabs.filter((tab) => session.selected.has(tab.id));
  if (!selected.length) throw new Error('Select at least one tab to import.');
  const sourceKey = session.source.sourceKey;
  if (session.mode === 'add' && sourceKey && selected.some((tab) => state.documents.some((doc) => doc.source?.documentId === sourceKey && doc.source.tabId === tab.id))) throw new Error('One or more selected tabs are already in this project. Deselect them to avoid duplicate copies.');
  await prepareProjectReplacement({ detach: session.mode === 'new' });
  const previous = serializedWorkspace();
  try {
    if (session.mode === 'new') {
      resetWritingRoomState(session.name);
      state.projectId = crypto.randomUUID();
      state.documents = [];
      state.filingGroups = [];
      state.filingTabs = [];
    }
    const firstTab = state.filingTabs[0];
    const groupId = `import-${crypto.randomUUID()}`;
    state.filingGroups.push({ id: groupId, label: session.source.title, type: 'folder', locked: false });
    const filingTabId = `tab-${crypto.randomUUID()}`;
    state.filingTabs.push({ id: filingTabId, groupId, label: 'Documents', type: 'tab', locked: false });
    const ids = new Map(selected.map((tab) => [tab.id, uniqueCleanDocumentId(`${session.source.title}-${tab.title}-${crypto.randomUUID().slice(0, 8)}`)]));
    const now = new Date().toISOString();
    for (const tab of selected) {
      state.documents.push({ id: ids.get(tab.id), title: tab.title, content: safeDocumentHtml(tab.html) || '<p><br></p>', tags: [], updatedAt: now, localDraftAt: now, diskPath: '', diskSavedAt: '', filingGroupId: groupId || firstTab?.groupId, filingTabId, parentDocumentId: ids.get(tab.parentId) || '', source: sourceKey ? { documentId: sourceKey, tabId: tab.id, parentTabId: tab.parentId, importedAt: now } : { fileName: session.source.title, importedAt: now } });
    }
    state.activeId = ids.get(selected[0].id);
    validateImportedDocuments(state.documents, { allowUnloaded: true });
    normalizeFilingHierarchy();
    await writeWorkspaceSnapshot();
    releaseInactiveDocumentBodies();
    saveGoogleDriveStorageState();
  } catch (error) {
    restoreWorkspaceObject(JSON.parse(previous));
    renderAll();
    throw error;
  }
  renderAll();
  updateUrl();
  updateProjectSettingsStatus();
  renderDropboxStorage();
  setStatus(`Imported ${selected.length} file(s) · saved in this browser`, 'saved');
  scheduleDropboxSync();
  if (state.folderMode.enabled) void saveFolderModeSnapshot().catch((error) => updateFolderModeStatus(error.message));
}

function restoreWorkspaceObject(project) {
  state.projectId = /^[\w-]{1,100}$/.test(project.projectId || '') ? project.projectId : crypto.randomUUID();
  state.dropboxAutoSync = Boolean(project.dropboxAutoSync);
  for (const key of ['writingRoomName', 'documents', 'blocks', 'filingGroups', 'filingTabs', 'trash', 'deprecated', 'deprecatedParagraphs']) if (project[key] !== undefined) state[key] = project[key];
  normalizeFilingHierarchy();
  state.activeId = state.documents.some((doc) => doc.id === project.activeId) ? project.activeId : state.documents[0]?.id;
}

async function openSavedProject() {
  try {
    const projects = await listSavedProjectIndexes();
    const result = await openCapsDialog('Open a saved project', [
      { html: '<p>These projects are saved in this browser. Use Import Project Backup to open a downloaded copy from another device.</p>' },
      { name: 'projectId', label: 'Project', options: projects.map((item) => ({ value: item.projectId, label: item.name || 'Untitled project' })), value: state.projectId },
    ]);
    if (!result?.projectId || result.projectId === state.projectId) return;
    const project = JSON.parse(projects.find((item) => item.projectId === result.projectId).json);
    if (!await chooseProjectDocument(project)) return;
    await ensureDocumentContent(project.documents.find((doc) => doc.id === project.activeId));
    await prepareProjectReplacement();
    const previous = serializedWorkspace();
    try {
      restoreWorkspaceObject(project);
      state.googleDrive.projectFolderId = '';
      state.googleDrive.projectName = '';
      if (project.designSettings) setProjectDesignSettings(project.designSettings);
      await ensureDocumentContent(activeDocument());
      await writeWorkspaceSnapshot();
    } catch (error) { restoreWorkspaceObject(JSON.parse(previous)); throw error; }
    renderAll(); updateUrl(); updateProjectSettingsStatus();
    setStatus('Opened saved project', 'saved');
  } catch (error) { showStorageWarning(error.message); }
}
