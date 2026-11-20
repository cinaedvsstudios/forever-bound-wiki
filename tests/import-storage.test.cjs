const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const { JSDOM } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');
const createPurifier = require('dompurify');
const JSZip = require('jszip');
const root = path.resolve(__dirname, '..');
function app({ indexedDB = new IDBFactory(), legacy } = {}) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost:4317/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  Object.defineProperty(w, 'crypto', { value: webcrypto });
  Object.assign(w, { indexedDB, TextEncoder, TextDecoder, fetch: async () => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, 'content/documents.json'), 'utf8')) }), DOMPurify: createPurifier(w), JSZip, mammoth: require('mammoth') });
  w.HTMLDialogElement.prototype.showModal ||= function () { this.open = true; };
  w.HTMLDialogElement.prototype.close ||= function () { this.open = false; };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  if (legacy !== undefined) w.localStorage.setItem('forever-bound-writing-room-v2', legacy);
  const core = fs.readFileSync(path.join(root, 'app.core.js'), 'utf8').replace(/boot\(\)\.catch\([\s\S]*?\n\}\);/, '');
  const setup = fs.readFileSync(path.join(root, 'project-setup.js'), 'utf8');
  const markdown = fs.readFileSync(path.join(root, 'markdown-export.js'), 'utf8');
  const navigation = fs.readFileSync(path.join(root, 'writing-room-ui.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'document-navigation.js'), 'utf8');
  const cloud = fs.readFileSync(path.join(root, 'cloud-history.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'dropbox-storage.js'), 'utf8');
  const library = fs.readFileSync(path.join(root, 'project-library.js'), 'utf8');
  const workspace = fs.readFileSync(path.join(root, 'workspace-storage.js'), 'utf8');
  const transfer = fs.readFileSync(path.join(root, 'storyboard-transfer.js'), 'utf8');
  const filesRuntime = fs.readFileSync(path.join(root, 'project-files.js'), 'utf8');
  w.eval(filesRuntime + '\n' + setup + '\n' + library + '\n' + cloud + '\n' + workspace + '\n' + transfer + '\n' + markdown + '\n' + navigation + '\n' + core + '\nwindow.testApp = { showStorageWarning, setReconnect: callback => { connectDropbox = callback; }, hasRetainedDocumentBody: doc => savedDocumentBodies.has(doc), setWorkspaceHistoryLimit, loadWorkspaceHistorySettings, maintainWorkspaceHistory, withDropboxProjectLock, retainedProjectHistory, getHistoryLimit: () => workspaceHistoryLimit, getCatalogue: () => dropboxProjectCatalogue, getLibraryEntries: () => projectLibraryEntries, renderProjectLibraryOptions, restoreDropboxCatalogue, syncWorkspaceProjects, setWorkspaceSyncInterval, scheduleDropboxSync, restoreWorkspacePreferences, buildWorkspaceZip, projectBackupFromZip, removeWorkspaceProject, confirmWorkspaceDeletion, sendDocumentToStoryboarder, getSyncInterval: () => workspaceSyncInterval, getSyncTimer: () => dropboxSyncTimer, refreshDropboxProjects, openSavedProject, openLocalProjectRecord, projectFileHash, encodeProjectIndex, ensureDocumentContent, ensureProjectDocumentsLoaded, openDocument, openDropboxProjectPath, documentIsLoaded, completeProjectCopy, listSavedProjectIndexes, openFromRoute, releaseDocumentBody, duplicateDocument, deprecateDocument, deleteDocumentSafely, restoreArchivedDocument, setDialogResponse: (response) => { openCapsDialog = async () => response; }, startWritingRoomResize, moveWritingRoomResize, stopWritingRoomResize, handleWritingRoomResizeKey, documentOutline, jumpToDocumentOutline, fillDocumentOutline, calculateRoomLayout, renderWritingRoomCards, renderDocumentEndBar, updateRoomWorkspaceLayout, toggleWritingRoomPanel, applyDesignSettings, collectDesignSettingsFromForm, saveDesignSettings, applyExtraDesignSettings, currentDesignSettings, buildMarkdownArchive, openProjectSetup, advanceProjectSetup, readGoogleDocsSource, renderDropboxStorage, setSetupSource: (source) => { setupSession.source = source; setupSession.selected = new Set(source.tabs.map(t => t.id)); }, state, els, boot, loadWorkspace, serializedWorkspace, writeWorkspaceSnapshot, readWorkspaceSnapshot, workspaceRecord, persistNow, safeDocumentHtml, googleDocsToImportSource, commitProjectImport, readImportFile, importProjectBackupPayload, folderModeProjectPayload, capsMarkdownToDocument, prepareProjectReplacement, saveFolderModeSnapshot, syncDropboxProject, openWritingRoomFolder, projectCloudFingerprint, setConnection: (value) => { dropboxConnection = value; }, getRevision: () => workspaceRevision };');
  return { w, api: w.testApp, close: () => dom.window.close() };
}
function seed(a) {
  Object.assign(a.state, { projectId: 'project-original', writingRoomName: 'Original', activeId: 'original', documents: [{ id: 'original', title: 'Original', content: '<p>Keep this draft</p>', tags: [], updatedAt: '2026-11-17T00:00:00Z' }], filingGroups: [], filingTabs: [] });
  a.els.editor.innerHTML = '<p>Keep this draft</p>';
  a.els.titleInput.value = 'Original';
}
const native = { documentId: 'source-google-id', title: 'Pilot', tabs: [
  { tabProperties: { tabId: 'act', title: 'Act 1' }, documentTab: { body: { content: [{ paragraph: { paragraphStyle: { namedStyleType: 'HEADING_1', headingId: 'act-one' }, elements: [{ textRun: { content: 'Act One\n', textStyle: { bold: true } } }] } }, { paragraph: { elements: [{ textRun: { content: 'Script words\n' } }] } }] } }, childTabs: [{ tabProperties: { tabId: 'notes', title: 'Notes' }, documentTab: { body: { content: [{ paragraph: { elements: [{ textRun: { content: 'Nested notes\n' } }] } }] } } }] },
  { tabProperties: { tabId: 'full', title: 'Full script' }, documentTab: { body: { content: [{ paragraph: { elements: [{ textRun: { content: 'Alternate copy\n' } }] } }] } } },
] };

test('the complete app starts and shows first-run setup', async () => {
  const a = app();
  try { await a.api.boot(); assert.equal(a.w.document.querySelector('#projectSetupDialog').open, true); assert.ok(a.api.state.documents.length); assert.ok(a.w.document.querySelector('#dropboxStorageControls button')); }
  finally { a.close(); }
});
test('unreadable browser saves are preserved, never replaced by starter content', async () => {
  const a = app({ legacy: '{broken user data' });
  try { await assert.rejects(a.api.loadWorkspace(), /preserved/); assert.equal(a.w.localStorage.getItem('forever-bound-writing-room-v2'), '{broken user data'); assert.equal(await a.api.workspaceRecord('active'), undefined); }
  finally { a.close(); }
});
test('legacy data migrates to the larger browser database with HTML intact', async () => {
  const legacy = { projectId: 'legacy', writingRoomName: 'Old project', documents: [{ id: 'old', title: 'Old', content: '<p>100% preserved</p>', tags: [] }], blocks: {} };
  const a = app({ legacy: JSON.stringify(legacy) });
  try { await a.api.loadWorkspace(); await a.api.writeWorkspaceSnapshot(); const saved = JSON.parse((await a.api.workspaceRecord('active')).json); assert.equal(saved.documents[0].content, undefined); await a.api.ensureDocumentContent(a.api.state.documents[0]); assert.equal(a.api.state.documents[0].content, legacy.documents[0].content); assert.equal(saved.projectId, 'legacy'); }
  finally { a.close(); }
});
test('native tabs and nested relationships survive selective import and backup restore', async () => {
  const a = app(); seed(a.api);
  try {
    const source = a.api.googleDocsToImportSource(native);
    assert.equal(source.tabs.length, 3); assert.equal(source.tabs[1].parentId, 'act');
    await a.api.commitProjectImport({ mode: 'new', name: 'Forever Bound', source, selected: new Set(['act', 'notes']) });
    assert.equal(a.api.state.documents.length, 2);
    assert.equal(a.api.state.documents[1].parentDocumentId, a.api.state.documents[0].id);
    await a.api.ensureProjectDocumentsLoaded();
    const payload = a.api.folderModeProjectPayload();
    payload.blocks = a.api.state.blocks;
    assert.equal(payload.documents[1].source.tabId, 'notes');
    await a.api.importProjectBackupPayload(payload);
    assert.equal(a.api.state.documents[1].parentDocumentId, a.api.state.documents[0].id);
    assert.match(a.api.state.documents[0].content, /<strong>Act One<\/strong>/);
    assert.ok(await a.api.workspaceRecord('project:project-original'));
  } finally { a.close(); }
});
test('adding another file retains the existing documents and rejects duplicate Google tabs', async () => {
  const a = app(); seed(a.api);
  try {
    const source = a.api.googleDocsToImportSource(native);
    await a.api.commitProjectImport({ mode: 'add', source, selected: new Set(['act']) });
    assert.equal(a.api.state.documents.length, 2);
    const original = a.api.state.documents.find((d) => d.id === 'original');
    assert.equal(original.content, undefined);
    await a.api.ensureDocumentContent(original);
    assert.match(original.content, /Keep this draft/);
    await assert.rejects(a.api.commitProjectImport({ mode: 'add', source, selected: new Set(['act']) }), /already/);
    assert.equal(a.api.state.documents.length, 2);
  } finally { a.close(); }
});
test('active HTML, event attributes, and executable links are filtered', () => {
  const a = app();
  try { const safe = a.api.safeDocumentHtml('<p onclick="alert(1)">text<script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">bad</a></p>'); assert.doesNotMatch(safe, /onclick|onerror|<script|javascript:/); assert.match(safe, /text/); }
  finally { a.close(); }
});
test('Windows Markdown line endings and frontmatter round-trip', () => {
  const a = app();
  try { const doc = a.api.capsMarkdownToDocument('---\r\nid: "windows"\r\ntitle: "Windows title"\r\n---\r\n\r\n# Hello'); assert.equal(doc.title, 'Windows title'); assert.match(doc.content, /<h1>Hello<\/h1>/); }
  finally { a.close(); }
});
test('a second browser tab cannot overwrite a newer save silently', async () => {
  const db = new IDBFactory(); const a = app({ indexedDB: db }); const b = app({ indexedDB: db }); seed(a.api); seed(b.api);
  try { await a.api.writeWorkspaceSnapshot(); await assert.rejects(b.api.writeWorkspaceSnapshot(), /Another tab/); assert.match(b.w.document.querySelector('#storageWarning').textContent, /not saved/); }
  finally { a.close(); b.close(); }
});
test('Word imports preserve text, headings, and emphasis without uploading', async () => {
  const a = app();
  try {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Word pilot text</w:t></w:r></w:p></w:body></w:document>');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const actualMammoth = a.w.mammoth;
    a.w.mammoth = { convertToHtml: async ({ arrayBuffer }, options) => actualMammoth.convertToHtml({ buffer: Buffer.from(arrayBuffer) }, options) };
    const source = await a.api.readImportFile({ name: 'Pilot.docx', size: buffer.length, arrayBuffer: async () => buffer });
    assert.match(source.tabs[0].html, /<strong>Word pilot text<\/strong>/);
  } finally { a.close(); }
});
test('all entry pages wire the same setup and storage runtime', () => {
  for (const file of ['index.html', 'editor.html', 'writing-room.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(html, /project-setup.js\?v=5.16.0/); assert.match(html, /dropbox-storage.js/);
    assert.doesNotMatch(html, /id="createOnlineProjectButton"/);
  }
});

test('the complete pilot package keeps all 16 tabs, including the second nested level', { skip: !fs.existsSync(path.join(root, '../migration-files/Pilot.google-docs-source.json')) }, async () => {
  const a = app(); seed(a.api);
  try {
    const payload = JSON.parse(fs.readFileSync(path.join(root, '../migration-files/Pilot.google-docs-source.json'), 'utf8'));
    const source = a.api.googleDocsToImportSource(payload.document);
    assert.equal(source.tabs.length, 16);
    assert.ok(source.tabs.some((tab) => tab.depth === 2));
    const originalText = [];
    function readText(elements) { for (const element of elements || []) { for (const part of element.paragraph?.elements || []) if (part.textRun?.content.trim()) originalText.push(part.textRun.content.trim()); for (const row of element.table?.tableRows || []) for (const cell of row.tableCells || []) readText(cell.content); } }
    for (const tab of payload.document.tabs) readText(tab.body.content);
    const importedText = source.tabs.map((tab) => new a.w.DOMParser().parseFromString(tab.html, 'text/html').body.textContent).join('\n').replace(/\s+/g, '');
    for (const text of originalText) assert.ok(importedText.includes(text.replace(/\s+/g, '')), 'A source text run must remain in the imported copy');
    await a.api.commitProjectImport({ mode: 'new', name: 'Forever Bound pilot test', source, selected: new Set(source.tabs.map((tab) => tab.id)) });
    assert.equal(a.api.state.documents.length, 16);
    assert.equal(JSON.parse((await a.api.workspaceRecord('active')).json).documents.length, 16);
  } finally { a.close(); }
});

test('invalid backup hierarchies and missing content leave the current project untouched', async () => {
  const a = app(); seed(a.api);
  try {
    await assert.rejects(a.api.importProjectBackupPayload({ documents: [{ id: 'bad', title: 'Missing content' }] }), /does not include content/);
    await assert.rejects(a.api.importProjectBackupPayload({ documents: [{ id: 'bad', title: 'Cycle', content: '<p>cycle</p>', parentDocumentId: 'bad' }] }), /circular/);
    assert.equal(a.api.state.documents[0].id, 'original');
  } finally { a.close(); }
});

test('a storage failure shows a persistent warning without discarding the in-memory draft', async () => {
  const brokenDb = { open() { const request = {}; queueMicrotask(() => { request.error = new Error('Disk quota exceeded'); request.onerror(); }); return request; } };
  const a = app({ indexedDB: brokenDb }); seed(a.api);
  try {
    assert.equal(await a.api.persistNow(), false);
    assert.equal(a.api.state.documents[0].content, '<p>Keep this draft</p>');
    assert.match(a.w.document.querySelector('#storageWarning').textContent, /not saved/);
  } finally { a.close(); }
});

test('folder snapshots include every file and queue edits made during a write', async () => {
  const a = app(); seed(a.api);
  try {
    a.api.state.documents.push({ id: 'second', title: 'Second', content: '<p>Second file</p>', tags: [] });
    const files = new Map();
    let delayFirst = true;
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const handle = {
      name: 'Test backup', queryPermission: async () => 'granted',
      getDirectoryHandle: async () => handle,
      getFileHandle: async (name) => ({ createWritable: async () => ({ write: async (content) => { if (delayFirst) { delayFirst = false; await gate; } files.set(name, content); }, close: async () => {} }) }),
    };
    Object.assign(a.api.state.folderMode, { enabled: true, directoryHandle: handle });
    const first = a.api.saveFolderModeSnapshot();
    await new Promise((resolve) => setTimeout(resolve, 5));
    a.api.state.documents[0].content = '<p>Edited while saving</p>';
    const second = a.api.saveFolderModeSnapshot();
    release(); await Promise.all([first, second]);
    const project = JSON.parse(files.get('capsanoto.project.json'));
    assert.equal(project.documents.length, 2);
    assert.equal(project.documents[0].content, '<p>Edited while saving</p>');
    assert.equal(a.api.state.folderMode.writeInProgress, false);
  } finally { a.close(); }
});

test('project storage, backups, and developer settings are separate accessible views', async () => {
  const a = app();
  try {
    await a.api.boot();
    assert.equal(a.w.document.querySelector('#project-view-storage').hidden, false);
    assert.equal(a.w.document.querySelector('#project-view-backups').hidden, true);
    assert.equal(a.w.document.querySelector('#project-view-details').hidden, true);
    assert.ok(a.w.document.querySelector('#project-view-details #dropboxAppKey'));
    a.w.document.querySelector('#project-tab-backups').click();
    assert.equal(a.w.document.querySelector('#project-view-storage').hidden, true);
    assert.equal(a.w.document.querySelector('#project-view-backups').hidden, false);
    assert.ok(a.w.document.querySelector('#project-view-backups #downloadMarkdownProject'));
    a.api.setConnection({ token: 'test-only', accountId: 'storage-account', expiresAt: Date.now() + 60000, label: 'Writing account' });
    a.api.renderDropboxStorage();
    assert.equal(a.w.document.querySelector('#connectDropbox').hidden, true);
    assert.equal(a.w.document.querySelector('#syncDropbox').hidden, false);
    assert.equal(a.w.document.querySelector('.storage-account-options').open, false);
  } finally { a.close(); }
});

test('Preview opens a labelled, complete, paragraph-separated view and filtering keeps selection', async () => {
  const a = app(); seed(a.api);
  try {
    await a.api.boot();
    a.api.openProjectSetup('add');
    const source = a.api.googleDocsToImportSource(native);
    source.tabs[0].html = '<p>First paragraph.</p><p>Second paragraph.</p><p>' + 'Long text. '.repeat(600) + '</p>';
    a.api.setSetupSource(source);
    await a.api.advanceProjectSetup({ preventDefault() {} });
    const section = a.w.document.querySelector('#setupPreviewSection');
    assert.equal(section.hidden, true);
    a.w.document.querySelector('#setupTabList button').click();
    assert.equal(section.hidden, false);
    assert.match(a.w.document.querySelector('#setupPreviewTitle').textContent, /Act 1/);
    assert.match(a.w.document.querySelector('#setupPreview').textContent, /First paragraph\.\n\nSecond paragraph/);
    assert.ok(a.w.document.querySelector('#setupPreview').textContent.length > 6000);
    const filter = a.w.document.querySelector('#setupTabFilter');
    filter.value = 'Notes'; filter.dispatchEvent(new a.w.Event('input'));
    assert.equal([...a.w.document.querySelectorAll('.setup-tab')].filter((row) => !row.hidden).length, 1);
    assert.equal(a.w.document.querySelectorAll('#setupTabList input:checked').length, 3);
  } finally { a.close(); }
});

test('metadata-only tab outlines cannot accidentally become empty imported documents', () => {
  const a = app();
  try { assert.throws(() => a.api.googleDocsToImportSource({ documentId: 'outline-only', tabs: [{ tabId: 'one', title: 'Names only', body: null }] }), /without their content/); }
  finally { a.close(); }
});

test('Markdown ZIP keeps hierarchy, extracts and deduplicates images, and leaves original content intact', async () => {
  const a = app(); seed(a.api);
  try {
    const image = '<img alt="Example" src="data:image/png;base64,iVBORw0KGgo=">';
    a.api.state.documents[0].content = '<h1>Parent</h1><p>Text {{Canon-Example}}</p>' + image;
    a.api.state.documents.push({ id: 'child', title: 'Child', parentDocumentId: 'original', content: '<p>Nested</p>' + image, tags: [] });
    a.api.state.blocks = { 'Canon-Example': { id: 'Canon-Example', content: 'Reusable text' } };
    const before = a.api.state.documents.map((doc) => doc.content);
    const archive = await JSZip.loadAsync(await a.api.buildMarkdownArchive());
    const manifest = JSON.parse(await archive.file('project-map.json').async('string'));
    assert.equal(manifest.documents.length, 2);
    assert.equal(manifest.documents[1].parentDocumentId, 'original');
    const child = await archive.file(manifest.documents[1].path).async('string');
    assert.match(child, /!\[Example\]\(\.\.\/\.\.\/assets\/image-1.png\)/);
    assert.equal(Object.keys(archive.files).filter((name) => /^assets\/image-/.test(name)).length, 1);
    assert.ok(archive.file('tcards/Canon-Example.md'));
    assert.deepEqual(a.api.state.documents.map((doc) => doc.content), before);
  } finally { a.close(); }
});

test('Google failure explains the server error while retaining a selected Word source', async () => {
  const a = app(); seed(a.api);
  try {
    await a.api.boot();
    a.api.openProjectSetup('add');
    a.api.setSetupSource({ title: 'Downloaded', format: 'word', tabs: [{ id: 'file', title: 'Downloaded', html: '<p>Writing</p>', textLength: 7 }] });
    a.w.google = { accounts: { oauth2: { initTokenClient: (options) => ({ requestAccessToken: () => options.callback({ access_token: 'test-only' }) }) } } };
    a.w.fetch = async () => ({ ok: false, status: 403, json: async () => ({ error: { message: 'Google Docs API is disabled for this project.' } }) });
    a.w.document.querySelector('#setupGoogleUrl').value = 'https://docs.google.com/document/d/test-document/edit';
    await a.w.document.querySelector('#setupReadGoogle').onclick();
    assert.match(a.w.document.querySelector('#setupError').textContent, /API is disabled/);
    await a.api.advanceProjectSetup({ preventDefault() {} });
    assert.match(a.w.document.querySelector('#setupBody').textContent, /one combined document/);
    assert.equal(a.w.document.querySelectorAll('#setupTabList input').length, 1);
  } finally { a.close(); }
});

test('outline includes deep headings, scene paragraphs, duplicate titles and document tags', async () => {
  const a = app();
  try {
    await a.api.boot();
    const doc = a.api.state.documents[0];
    doc.content = '<h1>Act One</h1><p>Ordinary prose.</p><p><strong>Scene 12: The gate</strong></p><h4>Notes</h4><h2>Notes</h2><p>INT. CASTLE - NIGHT</p>';
    doc.tags = ['pilot']; a.api.renderWritingRoomCards();
    const outline = a.api.documentOutline(doc);
    assert.equal(outline.length, 5); assert.equal(outline[2].level, 4); assert.notEqual(outline[2].index, outline[3].index);
    const section = a.w.document.querySelector(`[data-outline-doc="${doc.id}"]`);
    section.open = true; a.api.fillDocumentOutline(section, 'gate');
    assert.equal(section.querySelectorAll('.outline-results button').length, 1);
    a.api.fillDocumentOutline(section, 'pilot');
    assert.equal(section.querySelectorAll('.outline-results button').length, 5);
    const metadata = section.parentElement.querySelector('[data-disclosure="metadata"]');
    const summary = section.parentElement.querySelector('[data-disclosure="summary"]');
    assert.equal(metadata.open, false); assert.equal(summary.open, false);
    a.api.renderWritingRoomCards();
    assert.equal(a.w.document.querySelector(`[data-outline-doc="${doc.id}"]`).open, true);
  } finally { a.close(); }
});

test('jumping to an outline item opens the correct document and selects the correct repeated heading', async () => {
  const a = app();
  try {
    await a.api.boot();
    a.api.state.documents.push({ id: 'jump-target', title: 'Scene target', content: '<h2>Repeated</h2><p>Prose.</p><h2>Repeated</h2><p>Scene 3: Arrival</p>', tags: [] });
    await a.api.jumpToDocumentOutline('jump-target', 1);
    assert.equal(a.api.state.activeId, 'jump-target');
    const node = a.w.getSelection().anchorNode;
    assert.equal(node.tagName, 'H2');
    assert.equal(node, a.api.els.editor.querySelectorAll('h2')[1]);
  } finally { a.close(); }
});

test('the writing pad fits to either side of the Room and restores its prior width on close', async () => {
  const a = app();
  try {
    await a.api.boot();
    Object.defineProperty(a.w, 'innerWidth', { configurable: true, value: 1400 });
    const shell = a.api.els.writingSurfaceShell;
    shell.style.width = '1000px'; shell.getBoundingClientRect = () => ({ width: parseFloat(shell.style.width), height: 500, top: 100 });
    a.api.els.writingRoomPanel.getBoundingClientRect = () => ({ left: 16, right: 316, width: 300 });
    a.api.els.writingRoomPanel.hidden = false;
    a.api.updateRoomWorkspaceLayout();
    assert.equal(shell.style.width, '1000px'); assert.equal(shell.style.marginLeft, '334px');
    a.api.els.writingRoomPanel.hidden = true; a.api.updateRoomWorkspaceLayout();
    assert.equal(shell.style.width, '1000px'); assert.equal(shell.style.marginLeft, '');
    assert.equal(a.api.calculateRoomLayout(700, { left: 16, right: 316 }, 1000).mode, 'stacked');
    const rightRoom = a.api.calculateRoomLayout(1400, { left: 1084, right: 1384 }, 1000);
    assert.equal(rightRoom.mode, 'beside'); assert.ok(rightRoom.left + rightRoom.width < 1084);
  } finally { a.close(); }
});

test('all mapped design controls apply their CSS value, including empty image clearing, and save to the project', async () => {
  const a = app();
  try {
    await a.api.boot();
    assert.equal(a.w.document.querySelector('#writingRoomButton .command-glyph').textContent, '🏺');
    a.api.state.designSettings.topIconWritingRoom = '📚';
    assert.equal(a.api.currentDesignSettings().topIconWritingRoom, '🏺');
    a.api.state.designSettings.topIconWritingRoom = '🌻';
    assert.equal(a.api.currentDesignSettings().topIconWritingRoom, '🌻');
    a.api.state.designSettings.topIconWritingRoom = '🏺';
    const controls = [...a.w.document.querySelectorAll('[data-design-key]')];
    for (const input of controls) {
      if (input.type === 'color') input.value = '#123456';
      else if (input.type === 'number') input.value = String(Math.max(Number(input.min || 0), Math.min(Number(input.max || 999), 23)));
      else if (input.type === 'checkbox') input.checked = !input.checked;
      else if (input.tagName === 'SELECT') input.selectedIndex = input.options.length - 1;
      else if (input.dataset.cssUrl === 'true' || input.dataset.cssVar === '--top-bar-image-url') input.value = 'example.png';
    }
    a.w.document.querySelectorAll('[data-inherit-section]').forEach((toggle) => { toggle.checked = false; });
    await a.api.saveDesignSettings();
    const saved = JSON.parse((await a.api.workspaceRecord('active')).json).designSettings;
    for (const input of controls) {
      assert.ok(Object.hasOwn(saved, input.dataset.designKey), input.dataset.designKey + ' must persist');
      if (input.dataset.cssVar) assert.notEqual(a.w.document.documentElement.style.getPropertyValue(input.dataset.cssVar), '', input.dataset.designKey + ' must apply');
    }
    const image = a.w.document.querySelector('[data-design-key="topBarBgImage"]');
    image.value = ''; await a.api.saveDesignSettings();
    assert.equal(a.w.document.documentElement.style.getPropertyValue('--top-bar-bg-image'), 'none');
    const label = a.w.document.querySelector('[data-design-key="topLabelWritingRoom"]'); label.value = 'My library';
    await a.api.saveDesignSettings();
    assert.equal(a.w.document.querySelector('#writingRoomButton .command-label').textContent, 'MY LIBRARY');
  } finally { a.close(); }
});

test('Specnoto has a real pointer and keyboard resize handle with remembered dimensions', async () => {
  const a = app();
  try {
    a.w.eval(fs.readFileSync(path.join(root, 'modules/specnoto/specnoto.module.js'), 'utf8'));
    a.w.CapsanotoSpecnoto.init({ autoRestoreOpenState: false });
    a.w.CapsanotoSpecnoto.open();
    const shadow = a.w.document.querySelector('#specnoto-host').shadowRoot;
    const panel = shadow.querySelector('#specnoto-app');
    const handle = shadow.querySelector('#specnoto-resize');
    panel.getBoundingClientRect = () => ({ left: 100, top: 100, width: parseFloat(panel.style.getPropertyValue('--app-width')) || 300, height: parseFloat(panel.style.getPropertyValue('--app-height')) || 550 });
    handle.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.equal(panel.style.getPropertyValue('--app-width'), '310px');
    function pointer(type, x, y) { const event = new a.w.Event(type, { bubbles: true, cancelable: true }); Object.assign(event, { clientX: x, clientY: y, pointerId: 1, button: 0 }); handle.dispatchEvent(event); }
    pointer('pointerdown', 410, 650); pointer('pointermove', 470, 680); pointer('pointerup', 470, 680);
    const settings = JSON.parse(a.w.localStorage.getItem('capsanoto_specnoto_settings'));
    assert.equal(settings.width, 370); assert.ok(settings.height > 550);
    a.w.CapsanotoSpecnoto.close(); a.w.CapsanotoSpecnoto.open();
    assert.equal(panel.style.getPropertyValue('--app-width'), '370px');
    a.w.CapsanotoSpecnoto.destroy();
  } finally { a.close(); }
});

test('every mapped design variable has a stylesheet consumer and refinement styles parse', () => {
  const a = app();
  try {
    const sheets = [...a.w.document.querySelectorAll('link[rel="stylesheet"]')].map((link) => fs.readFileSync(path.join(root, link.getAttribute('href').split('?')[0]), 'utf8'));
    const css = sheets.join('\n');
    for (const input of a.w.document.querySelectorAll('[data-css-var]')) assert.ok(css.includes(`var(${input.dataset.cssVar}`), `${input.dataset.designKey} must have a visual consumer`);
    for (const file of ['workspace-refinements.css', 'settings-controls.css']) {
      const style = a.w.document.createElement('style'); style.textContent = fs.readFileSync(path.join(root, file), 'utf8'); a.w.document.head.append(style);
      assert.ok(style.sheet?.cssRules.length, `${file} must parse`);
    }
  } finally { a.close(); }
});

test('Use Defaults applies section defaults without losing the custom value; rgba colors remain valid and preserve alpha', async () => {
  const a = app();
  try {
    await a.api.boot();
    const settings = { ...a.api.currentDesignSettings(), commandBarText: '#123456', 'inherit_top-menu': true, windowBg: 'rgba(28, 18, 14, 0.76)' };
    a.api.applyDesignSettings(settings);
    const rootStyle = a.w.document.documentElement.style;
    assert.notEqual(rootStyle.getPropertyValue('--command-bar-text'), '#123456');
    assert.equal(a.w.document.querySelector('[data-design-key="commandBarText"]').value, '#123456');
    const color = a.w.document.querySelector('[data-design-key="windowBg"]');
    assert.equal(color.value, '#1c120e');
    assert.equal(a.api.collectDesignSettingsFromForm().windowBg, 'rgba(28, 18, 14, 0.76)');
    a.api.applyDesignSettings({ ...settings, 'inherit_top-menu': false });
    assert.equal(rootStyle.getPropertyValue('--command-bar-text'), '#123456');
  } finally { a.close(); }
});

test('the toolbar retains the approved rules and no supplemental stylesheet owns its layout', () => {
  const a = app();
  try {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8').replace(/\/\*[^]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /(?:writer-header|top-command-menus|command-icon|command-label|command-glyph|command-status|unified-command-bar|writing-room-button)/.test(m[1])).map((m) => ({ selector: m[1].replace(/\s+/g, ' ').trim(), declarations: m[2].replace(/\s+/g, ' ').trim() }));
    assert.deepEqual(rules, JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/approved-toolbar.json'), 'utf8')));
    for (const link of a.w.document.querySelectorAll('link[rel=stylesheet]')) {
      const name = link.getAttribute('href').split('?')[0];
      assert.notEqual(name, 'settings-consumers.css');
      if (name !== 'styles.css') {
        const componentCss = fs.readFileSync(path.join(root, name), 'utf8').replace(/\/\*[^]*?\*\//g, '');
        assert.doesNotMatch(componentCss, /(?:writer-header|top-command-menus|command-label|command-glyph|#writingRoomButton|\.direct-command)/);
      }
    }
    assert.equal(fs.existsSync(path.join(root, 'settings-consumers.css')), false);
  } finally { a.close(); }
});

test('the preview button shows all tabs and nesting before any project import', async () => {
  const a = app();
  try {
    await a.api.boot();
    const before = a.api.serializedWorkspace();
    a.api.openProjectSetup('add');
    a.w.google = { accounts: { oauth2: { initTokenClient: (options) => ({ requestAccessToken: () => options.callback({ access_token: 'test-only' }) }) } } };
    a.w.fetch = async () => ({ ok: true, json: async () => native });
    a.w.document.querySelector('#setupGoogleUrl').value = 'https://docs.google.com/document/d/test-document/edit';
    await a.w.document.querySelector('#setupReadGoogle').onclick();
    assert.equal(a.w.document.querySelector('#setupNext').textContent, 'Preview all 3 tabs');
    assert.equal(a.w.document.querySelector('#setupNext').disabled, false);
    await a.api.advanceProjectSetup({ preventDefault() {} });
    const rows = a.w.document.querySelectorAll('#setupTabList .setup-tab');
    assert.equal(rows.length, 3);
    assert.equal(rows[1].style.paddingLeft, '18px');
    assert.match(a.w.document.querySelector('#setupBody').textContent, /Act 1/);
    assert.match(a.w.document.querySelector('#setupBody').textContent, /Notes/);
    assert.equal(JSON.parse(a.api.serializedWorkspace()).documents.length, JSON.parse(before).documents.length);
  } finally { a.close(); }
});

test('Writing Room pointer and keyboard resizing persists geometry without exiting editing mode', async () => {
  const a = app();
  try {
    await a.api.boot();
    a.api.els.writingRoomPanel.hidden = false;
    a.api.state.filingEditMode = true;
    const panel = a.api.els.writingRoomPanel;
    panel.getBoundingClientRect = () => ({ left: 12, top: 80, width: parseFloat(panel.style.width) || 300, height: parseFloat(panel.style.height) || 400 });
    const handle = a.w.document.querySelector('#writingRoomResizeGrip');
    function pointer(type, x, y) { const event = new a.w.Event(type, { bubbles: true, cancelable: true }); Object.assign(event, { clientX: x, clientY: y, pointerId: 5, button: 0 }); (type === 'pointerdown' ? handle : a.w).dispatchEvent(event); }
    pointer('pointerdown', 312, 480); pointer('pointermove', 412, 530); pointer('pointerup', 412, 530);
    assert.equal(panel.style.width, '400px'); assert.equal(panel.style.height, '450px');
    assert.equal(a.api.state.filingEditMode, true);
    handle.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
    assert.equal(panel.style.width, '450px');
    const stored = JSON.parse(a.w.localStorage.getItem('capsanoto-writing-room-layout-v5-8-6'));
    assert.equal(stored.width, 450); assert.equal(stored.height, 450);
  } finally { a.close(); }
});

function fakeDropbox() {
  const entries = new Map();
  const requests = [];
  let revision = 0;
  const cloud = { entries, requests, fail: null, before: null };
  const metadata = (path, tag = 'file') => ({ '.tag': tag, path_lower: path.toLowerCase(), name: path.split('/').pop(), rev: String(++revision), server_modified: new Date(1700000000000 + revision * 1000).toISOString() });
  cloud.put = (path, text) => { const file = { ...metadata(path), text }; entries.set(path.toLowerCase(), file); return file; };
  cloud.attach = (a, accountId = 'account') => {
    a.api.setConnection({ token: 'test-only', accountId, expiresAt: Date.now() + 3600000 });
    a.w.fetch = async (url, options) => {
      const route = url.split('/2/')[1];
      const args = options.headers['Dropbox-API-Arg'] ? JSON.parse(options.headers['Dropbox-API-Arg']) : JSON.parse(options.body);
      const request = { route, args, body: options.body };
      requests.push(request);
      if (cloud.before) await cloud.before(request);
      const failure = (summary, status = 409) => ({ ok: false, status, json: async () => ({ error_summary: summary }) });
      if (cloud.fail?.(request)) return failure('simulated failure', 503);
      const key = args?.path?.toLowerCase();
      const existing = entries.get(key);
      let result;
      if (route === 'files/get_metadata') {
        if (!existing) return failure('path/not_found/');
        result = existing;
      } else if (route === 'files/create_folder_v2') {
        if (existing) return failure('path/conflict/folder/');
        const folder = metadata(args.path, 'folder'); entries.set(key, folder); result = { metadata: folder };
      } else if (route === 'files/upload') {
        if (args.mode?.['.tag'] === 'update' ? existing?.rev !== args.mode.update : existing && (args.strict_conflict || existing.text !== options.body)) return failure('path/conflict/file/');
        result = existing?.text === options.body ? existing : cloud.put(args.path, options.body);
      } else if (route === 'files/download') {
        if (!existing || existing['.tag'] !== 'file') return failure('path/not_found/');
        return { ok: true, status: 200, text: async () => existing.text, headers: { get: (name) => name === 'Dropbox-API-Result' ? JSON.stringify(existing) : null } };
      } else if (route === 'files/delete_v2') {
        if (!existing) return failure('path/not_found/');
        if (args.parent_rev && existing.rev !== args.parent_rev) return failure('path/conflict/file/');
        for (const entryKey of [...entries.keys()]) if (entryKey === key || entryKey.startsWith(key + '/')) entries.delete(entryKey);
        result = { metadata: existing };
      } else if (route === 'files/list_folder') {
        const prefix = args.path.toLowerCase() + '/';
        result = { entries: [...entries.values()].filter((entry) => entry.path_lower.startsWith(prefix) && !entry.path_lower.slice(prefix.length).includes('/')), has_more: false };
      } else throw new Error('Unexpected Dropbox route: ' + route);
      return { ok: true, status: 200, json: async () => result, headers: { get: () => null } };
    };
  };
  return cloud;
}

function seedLibrary(a) {
  seed(a.api);
  a.api.state.documents.push({ id: 'bible', title: 'Bible', tags: ['lore'], content: '<p>' + 'World history. '.repeat(50000) + '</p>' });
  a.api.state.filingGroups = [{ id: 'files', label: 'Files' }];
  a.api.state.filingTabs = [{ id: 'documents', groupId: 'files', label: 'Documents' }];
  a.api.state.documents.forEach((doc) => { doc.filingGroupId = 'files'; doc.filingTabId = 'documents'; });
}

async function cloudIndex(a, cloud) {
  const binding = await a.api.workspaceRecord('dropbox-binding:account:project-original');
  return { binding, file: cloud.entries.get(binding.path.toLowerCase()), index: JSON.parse(cloud.entries.get(binding.path.toLowerCase()).text) };
}

test('local persistence splits bodies from the index and reopens only the selected document', async () => {
  const db = new IDBFactory(); const a = app({ indexedDB: db }); const b = app({ indexedDB: db }); seedLibrary(a);
  try {
    await a.api.writeWorkspaceSnapshot();
    const record = await a.api.workspaceRecord('active'); const index = JSON.parse(record.json);
    assert.ok(record.json.length < 10000);
    assert.equal(index.documents[1].content, undefined);
    assert.match(await a.api.workspaceRecord('document-body:' + index.documents[1]._body.hash), /World history/);
    await b.api.loadWorkspace();
    assert.equal(b.api.state.documents.every((doc) => !b.api.documentIsLoaded(doc)), true);
    await b.api.ensureDocumentContent(b.api.state.documents[0]);
    assert.equal(b.api.documentIsLoaded(b.api.state.documents[1]), false);
    assert.equal(b.api.state.documents[0].content, '<p>Keep this draft</p>');
  } finally { a.close(); b.close(); }
});

test('Dropbox publishes separate document files and a small index, then uploads only the edited document', async () => {
  const a = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    await a.api.syncDropboxProject();
    const first = await cloudIndex(a, cloud);
    assert.equal(first.index.type, 'capsanoto-project-index');
    assert.equal(first.index.project.documents.length, 2);
    assert.ok(first.file.text.length < cloud.entries.get(first.index.project.documents[1]._body.path).text.length / 10);
    assert.doesNotMatch(first.file.text, /World history/);
    assert.equal(first.index.project.documents[0].content, undefined);
    const biblePath = first.index.project.documents[1]._body.path;
    assert.match(cloud.entries.get(biblePath).text, /World history/);
    cloud.requests.length = 0;
    a.api.els.editor.innerHTML = '<p>Edited script</p>';
    await a.api.syncDropboxProject();
    const uploads = cloud.requests.filter((request) => request.route === 'files/upload');
    assert.equal(uploads.filter((request) => request.args.path.includes('/documents/')).length, 1);
    assert.equal(uploads.some((request) => request.args.path === biblePath), false);
    assert.equal(uploads.at(-1).args.path, first.binding.path);
    assert.equal(uploads.at(-1).args.mode.update, first.binding.rev);
    assert.equal(uploads.at(-1).args.strict_conflict, true);
    assert.equal(uploads.at(-1).args.autorename, false);
    cloud.requests.length = 0;
    await a.api.syncDropboxProject();
    assert.equal(cloud.requests.some((request) => request.route === 'files/upload'), false);
  } finally { a.close(); }
});

test('a new device opens the index and selected script without downloading or parsing the bible', async () => {
  const a = app(); const b = app(); seedLibrary(a); seed(b.api); const cloud = fakeDropbox(); cloud.attach(a); cloud.attach(b);
  try {
    await a.api.syncDropboxProject(); const { binding, index } = await cloudIndex(a, cloud);
    cloud.requests.length = 0;
    await b.api.openDropboxProjectPath(binding.path);
    const downloads = cloud.requests.filter((request) => request.route === 'files/download').map((request) => request.args.path);
    assert.equal(downloads.length, 3); // index, shared TCards, selected script
    assert.equal(downloads.includes(index.project.documents[1]._body.path), false);
    assert.equal(b.api.documentIsLoaded(b.api.state.documents[1]), false);
    b.api.renderWritingRoomCards();
    assert.equal(b.api.documentIsLoaded(b.api.state.documents[1]), false);
    assert.equal(await b.api.openDocument('bible'), true);
    assert.match(b.api.state.documents[1].content, /World history/);
    assert.equal(b.api.documentIsLoaded(b.api.state.documents[0]), false);
  } finally { a.close(); b.close(); }
});

test('an interrupted upload keeps the previous index and document versions intact and can be retried', async () => {
  const a = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    await a.api.syncDropboxProject(); const first = await cloudIndex(a, cloud);
    const originalText = first.file.text;
    a.api.els.editor.innerHTML = '<p>New edit that must survive failure</p>';
    cloud.fail = (request) => request.route === 'files/upload' && request.args.path.includes('/history/');
    await assert.rejects(a.api.syncDropboxProject(), /503/);
    assert.equal(cloud.entries.get(first.binding.path).text, originalText);
    assert.equal((await a.api.workspaceRecord('dropbox-binding:account:project-original')).rev, first.binding.rev);
    const local = JSON.parse((await a.api.workspaceRecord('active')).json);
    assert.match(await a.api.workspaceRecord('document-body:' + local.documents[0]._body.hash), /must survive failure/);
    cloud.fail = null;
    await a.api.syncDropboxProject();
    assert.notEqual(cloud.entries.get(first.binding.path).text, originalText);
    for (const doc of first.index.project.documents) assert.ok(cloud.entries.has(doc._body.path));
  } finally { a.close(); }
});

test('a competing device cannot publish a stale index or overwrite another device’s documents', async () => {
  const a = app(); const b = app(); seedLibrary(a); seed(b.api); const cloud = fakeDropbox(); cloud.attach(a); cloud.attach(b);
  try {
    await a.api.syncDropboxProject(); const first = await cloudIndex(a, cloud);
    await b.api.openDropboxProjectPath(first.binding.path);
    a.api.els.editor.innerHTML = '<p>Device A wins</p>'; await a.api.syncDropboxProject();
    const newer = cloud.entries.get(first.binding.path).text;
    b.api.els.editor.innerHTML = '<p>Device B unsynced draft</p>';
    await assert.rejects(b.api.syncDropboxProject(), /another version/);
    assert.equal(cloud.entries.get(first.binding.path).text, newer);
    assert.match(b.api.state.documents[0].content, /Device B unsynced/);
  } finally { a.close(); b.close(); }
});

test('a revision conflict at the final commit cannot expose partially updated document files', async () => {
  const a = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    await a.api.syncDropboxProject(); const first = await cloudIndex(a, cloud);
    a.api.els.editor.innerHTML = '<p>Competing edit</p>';
    cloud.before = async (request) => {
      if (request.route === 'files/upload' && request.args.path === first.binding.path) { cloud.before = null; cloud.put(first.binding.path, first.file.text); }
    };
    await assert.rejects(a.api.syncDropboxProject(), /another version/);
    assert.equal(cloud.entries.get(first.binding.path).text, first.file.text);
    const finalUpload = cloud.requests.filter((request) => request.route === 'files/upload').at(-1);
    assert.equal(finalUpload.args.mode.update, first.binding.rev);
    assert.equal(finalUpload.args.autorename, false);
  } finally { a.close(); }
});

test('a missing bible file leaves the script usable and cannot become a blank saved bible', async () => {
  const a = app(); const b = app(); seedLibrary(a); seed(b.api); const cloud = fakeDropbox(); cloud.attach(a); cloud.attach(b);
  try {
    await a.api.syncDropboxProject(); const { binding, index } = await cloudIndex(a, cloud);
    const biblePath = index.project.documents[1]._body.path;
    cloud.entries.delete(biblePath);
    await b.api.openDropboxProjectPath(binding.path);
    assert.equal(await b.api.openDocument('bible'), false);
    assert.equal(b.api.state.activeId, 'original');
    assert.equal(b.api.state.documents[1].content, undefined);
    b.api.els.editor.innerHTML = '<p>Still editing script</p>';
    await b.api.syncDropboxProject();
    const saved = await cloudIndex(b, cloud);
    assert.equal(saved.index.project.documents[1]._body.hash, index.project.documents[1]._body.hash);
    assert.equal(cloud.entries.has(biblePath), false);
  } finally { a.close(); b.close(); }
});

test('a corrupted document is rejected independently while other documents can still open', async () => {
  const a = app(); const b = app(); seedLibrary(a); seed(b.api); const cloud = fakeDropbox(); cloud.attach(a); cloud.attach(b);
  try {
    await a.api.syncDropboxProject(); const { binding, index } = await cloudIndex(a, cloud);
    cloud.entries.get(index.project.documents[1]._body.path).text = '{broken content';
    await b.api.openDropboxProjectPath(binding.path);
    await assert.rejects(b.api.ensureDocumentContent(b.api.state.documents[1]), /integrity check/);
    assert.match(b.api.state.documents[0].content, /Keep this draft/);
    assert.equal(b.api.state.documents[1].content, undefined);
  } finally { a.close(); b.close(); }
});

test('visited documents reopen offline from individual cache records after a browser restart', async () => {
  const db = new IDBFactory(); const a = app({ indexedDB: db }); seedLibrary(a);
  try {
    await a.api.writeWorkspaceSnapshot();
    const b = app({ indexedDB: db });
    try {
      b.w.fetch = async () => { throw new Error('Offline'); };
      await b.api.loadWorkspace();
      await b.api.ensureDocumentContent(b.api.state.documents[0]);
      await b.api.ensureDocumentContent(b.api.state.documents[1]);
      assert.match(b.api.state.documents[1].content, /World history/);
    } finally { b.close(); }
  } finally { a.close(); }
});

test('complete backups and Markdown export explicitly load all required bodies without empty files', async () => {
  const a = app(); const b = app(); seedLibrary(a); seed(b.api); const cloud = fakeDropbox(); cloud.attach(a); cloud.attach(b);
  try {
    await a.api.syncDropboxProject(); const { binding } = await cloudIndex(a, cloud);
    await b.api.openDropboxProjectPath(binding.path);
    const copy = await b.api.completeProjectCopy(JSON.parse(b.api.serializedWorkspace()));
    assert.match(copy.documents[1].content, /World history/);
    assert.equal(copy.documents[1]._body, undefined);
    assert.equal(b.api.state.documents[1].content, undefined); // backup does not load it into the editor model
    const archive = await JSZip.loadAsync(await b.api.buildMarkdownArchive());
    const map = JSON.parse(await archive.file('project-map.json').async('string'));
    assert.match(await archive.file(map.documents[1].path).async('string'), /World history/);
  } finally { a.close(); b.close(); }
});

test('older Dropbox snapshots migrate into separate files without modifying or deleting the old backup', async () => {
  const a = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    const legacyText = JSON.stringify({ type: 'capsanoto-project-backup', project: JSON.parse(a.api.serializedWorkspace()) });
    const legacy = cloud.put('/older.caps.json', legacyText);
    await a.api.workspaceRecord('dropbox-binding:account:project-original', { path: '/older.caps.json', rev: legacy.rev });
    await a.api.syncDropboxProject();
    const { binding } = await cloudIndex(a, cloud);
    assert.equal(binding.format, 'document-files-v1');
    assert.equal(binding.legacyPath, '/older.caps.json');
    assert.equal(cloud.entries.get('/older.caps.json').text, legacyText);
    assert.equal(cloud.requests.some((request) => request.route.includes('delete') && !request.args.path.endsWith('/.sync-lock.json')), false);
  } finally { a.close(); }
});

test('a damaged index can reopen a verified saved index without replacing anything in Dropbox', async () => {
  const a = app(); const b = app(); seedLibrary(a); seed(b.api); const cloud = fakeDropbox(); cloud.attach(a); cloud.attach(b);
  try {
    await a.api.syncDropboxProject(); const { binding } = await cloudIndex(a, cloud);
    cloud.entries.get(binding.path).text = '{damaged index';
    b.api.setDialogResponse({ path: binding.historyPath, confirm: 'on' });
    cloud.requests.length = 0;
    await b.api.openDropboxProjectPath(binding.path);
    assert.equal(b.api.state.projectId, 'project-original');
    assert.match(b.api.state.documents[0].content, /Keep this draft/);
    assert.equal(b.api.state.documents[1].content, undefined);
    assert.equal(cloud.entries.get(binding.path).text, '{damaged index');
    assert.equal(cloud.requests.some((request) => request.route === 'files/upload'), false);
  } finally { a.close(); b.close(); }
});

test('choosing a script before project opening does not load the previously active bible', async () => {
  const a = app(); const b = app(); seedLibrary(a); seed(b.api); const cloud = fakeDropbox(); cloud.attach(a); cloud.attach(b);
  try {
    a.api.state.activeId = 'bible'; a.api.els.editor.innerHTML = a.api.state.documents[1].content;
    await a.api.syncDropboxProject(); const { binding, index } = await cloudIndex(a, cloud);
    b.api.setDialogResponse({ documentId: 'original' });
    cloud.requests.length = 0;
    await b.api.openDropboxProjectPath(binding.path, { chooseDocument: true });
    assert.equal(b.api.state.activeId, 'original');
    assert.equal(b.api.state.documents[1].content, undefined);
    assert.equal(cloud.requests.some((request) => request.route === 'files/download' && request.args.path === index.project.documents[1]._body.path), false);
  } finally { a.close(); b.close(); }
});

test('a missing startup body leaves navigation and reconnection available without saving placeholder text', async () => {
  const a = app(); const b = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    await a.api.writeWorkspaceSnapshot();
    const index = JSON.parse((await a.api.workspaceRecord('active')).json);
    // Simulate a new browser with just the index, no cached bodies and an expired connection.
    await b.api.workspaceRecord('active', { json: JSON.stringify(index), revision: 1, projectId: 'project-original', name: 'Original' });
    await b.api.boot();
    assert.equal(b.api.els.editor.contentEditable, 'false');
    assert.ok(b.w.document.querySelector('[data-retry-document]'));
    assert.ok(b.w.document.querySelector('#connectDropbox'));
    assert.equal(b.api.state.documents[0].content, undefined);
    await b.api.writeWorkspaceSnapshot();
    const saved = JSON.parse((await b.api.workspaceRecord('active')).json);
    assert.equal(saved.documents[0].content, undefined);
    assert.equal(saved.documents[0]._body.hash, index.documents[0]._body.hash);
  } finally { a.close(); b.close(); }
});

test('listing saved projects does not read every cached body', async () => {
  const a = app(); seedLibrary(a);
  const { IDBObjectStore } = require('fake-indexeddb');
  const originalGetAll = IDBObjectStore.prototype.getAll;
  try {
    await a.api.writeWorkspaceSnapshot();
    IDBObjectStore.prototype.getAll = () => { throw new Error('Bulk body read forbidden'); };
    const projects = await a.api.listSavedProjectIndexes();
    assert.equal(projects.length, 1);
    assert.equal(projects[0].projectId, 'project-original');
    assert.doesNotMatch(projects[0].json, /World history/);
  } finally { IDBObjectStore.prototype.getAll = originalGetAll; a.close(); }
});

test('a failed selected-document download never replaces the current project', async () => {
  const a = app(); const b = app(); seedLibrary(a); seed(b.api); const cloud = fakeDropbox(); cloud.attach(a); cloud.attach(b);
  try {
    b.api.state.projectId = 'different-project';
    await a.api.syncDropboxProject(); const { binding, index } = await cloudIndex(a, cloud);
    cloud.entries.delete(index.project.documents[0]._body.path);
    await assert.rejects(b.api.openDropboxProjectPath(binding.path), /Could not open/);
    assert.equal(b.api.state.projectId, 'different-project');
    assert.match(b.api.state.documents[0].content, /Keep this draft/);
  } finally { a.close(); b.close(); }
});

test('local cache pruning keeps every saved project and the previous working copy', async () => {
  const a = app(); seedLibrary(a);
  try {
    await a.api.writeWorkspaceSnapshot();
    const oldRecord = await a.api.workspaceRecord('active');
    const oldIndex = JSON.parse(oldRecord.json);
    await a.api.workspaceRecord('previous-project', { json: oldRecord.json });
    a.api.state.documents[0].content = '<p>Second revision</p>';
    await a.api.writeWorkspaceSnapshot();
    const second = JSON.parse((await a.api.workspaceRecord('active')).json);
    assert.match(await a.api.workspaceRecord('document-body:' + oldIndex.documents[0]._body.hash), /Keep this draft/);
    assert.match(await a.api.workspaceRecord('document-body:' + second.documents[0]._body.hash), /Second revision/);
    assert.match(await a.api.workspaceRecord('document-body:' + oldIndex.documents[1]._body.hash), /World history/);
    await a.api.workspaceRecord('previous-project', null);
    a.api.state.documents[0].content = '<p>Third revision</p>';
    await a.api.writeWorkspaceSnapshot();
    assert.equal(await a.api.workspaceRecord('document-body:' + second.documents[0]._body.hash), undefined);
    assert.equal(await a.api.workspaceRecord('document-body:' + oldIndex.documents[0]._body.hash), undefined);
    assert.match(await a.api.workspaceRecord('document-body:' + oldIndex.documents[1]._body.hash), /World history/);
  } finally { a.close(); }
});

test('an unavailable body stops a complete export instead of emitting an empty document', async () => {
  const a = app(); const b = app(); seedLibrary(a); seed(b.api); const cloud = fakeDropbox(); cloud.attach(a); cloud.attach(b);
  try {
    await a.api.syncDropboxProject(); const { binding, index } = await cloudIndex(a, cloud);
    cloud.entries.delete(index.project.documents[1]._body.path);
    await b.api.openDropboxProjectPath(binding.path);
    await assert.rejects(b.api.buildMarkdownArchive(), /Could not open/);
    assert.equal(b.api.state.documents[1].content, undefined);
  } finally { a.close(); b.close(); }
});

test('normal startup after migration loads only the active cached document', async () => {
  const db = new IDBFactory(); const a = app({ indexedDB: db }); const b = app({ indexedDB: db }); seedLibrary(a);
  try {
    await a.api.writeWorkspaceSnapshot();
    await b.api.boot();
    assert.equal(b.api.state.activeId, 'original');
    assert.match(b.api.els.editor.textContent, /Keep this draft/);
    assert.equal(b.api.state.documents[1].content, undefined);
    assert.equal(b.api.els.editor.contentEditable, 'true');
  } finally { a.close(); b.close(); }
});

test('document routes load existing bodies on demand and retain new-document link behavior', async () => {
  const a = app(); seedLibrary(a);
  try {
    await a.api.writeWorkspaceSnapshot();
    a.api.releaseDocumentBody(a.api.state.documents[1]);
    a.w.history.pushState(null, '', '?doc=bible');
    await a.api.openFromRoute();
    assert.equal(a.api.state.activeId, 'bible');
    assert.match(a.api.state.documents[1].content, /World history/);
    a.w.history.pushState(null, '', '?doc=new-linked-file');
    await a.api.openFromRoute();
    assert.equal(a.api.state.activeId, 'new-linked-file');
    assert.equal(a.api.state.documents.length, 3);
  } finally { a.close(); }
});

test('ordinary autosave never reparses a large preserved legacy snapshot', async () => {
  const a = app(); seedLibrary(a);
  const originalParse = a.w.JSON.parse;
  try {
    const legacy = a.api.serializedWorkspace();
    await a.api.writeWorkspaceSnapshot();
    a.api.releaseDocumentBody(a.api.state.documents[1]);
    await a.api.workspaceRecord('legacy-project:original-backup', { json: legacy, bodyReferences: [] });
    a.w.JSON.parse = (value, ...args) => {
      if (typeof value === 'string' && value.includes('World history')) throw new Error('Unopened bible was parsed during autosave');
      return originalParse(value, ...args);
    };
    await a.api.writeWorkspaceSnapshot();
    assert.equal(a.api.state.documents[1].content, undefined);
    assert.equal((await a.api.workspaceRecord('legacy-project:original-backup')).json, legacy);
  } finally { a.w.JSON.parse = originalParse; a.close(); }
});

test('project controls and visible save status live in the bottom bar and survive document redraws', async () => {
  const a = app();
  try {
    await a.api.boot();
    const bar = a.api.els.documentEndBar;
    const controls = ['workspaceSettings', 'addProjectFile', 'openSavedProject', 'quickDropboxSync'];
    assert.equal(a.w.document.querySelector('.project-quick-actions'), null);
    for (const id of controls) assert.ok(bar.contains(a.w.document.getElementById(id)));
    assert.ok(bar.contains(a.api.els.saveStatus));
    assert.ok(a.api.els.saveStatus.textContent.trim());
    const originalButton = a.w.document.querySelector('#addProjectFile');
    a.api.renderDocumentEndBar(); a.api.renderDocumentEndBar();
    assert.equal(a.w.document.querySelector('#addProjectFile'), originalButton);
    assert.equal(a.w.document.querySelectorAll('#projectActions').length, 1);
    a.w.document.querySelector('#projectSetupDialog').close();
    originalButton.click();
    assert.match(a.w.document.querySelector('#setupBody').textContent, /Step 2/);
    a.w.document.querySelector('#projectSetupDialog').close();
    a.w.document.querySelector('#startProjectSetup').click();
    assert.match(a.w.document.querySelector('#setupBody').textContent, /Step 1/);
  } finally { a.close(); }
});

test('bottom-bar Sync now saves to Dropbox and exposes busy, connected, and expired states', async () => {
  const a = app(); const cloud = fakeDropbox();
  try {
    await a.api.boot(); seedLibrary(a); cloud.attach(a); a.api.renderDropboxStorage();
    const button = a.w.document.querySelector('#quickDropboxSync');
    assert.equal(button.textContent, 'Sync now');
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    cloud.before = async () => { cloud.before = null; await gate; };
    const sync = button.onclick();
    assert.equal(button.disabled, true);
    assert.equal(button.getAttribute('aria-busy'), 'true');
    assert.equal(a.w.document.querySelector('#workspaceSettings').disabled, true);
    release(); await sync;
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, 'Sync now');
    assert.match(a.w.document.querySelector('#bottomDropboxStatus').textContent, /Synced/);
    assert.match(a.api.els.saveStatus.textContent, /browser and Dropbox/);
    assert.equal((await cloudIndex(a, cloud)).index.type, 'capsanoto-project-index');
    a.api.setConnection({ accountId: 'account', expiresAt: Date.now() - 1 }); a.api.renderDropboxStorage();
    assert.equal(button.textContent, 'Reconnect Dropbox');
    a.api.setConnection(null); a.api.renderDropboxStorage();
    assert.equal(button.textContent, 'Connect Dropbox');
  } finally { a.close(); }
});

test('returning users see Dropbox projects in Workspace settings without downloading documents', async () => {
  const a = app(); const b = app(); const cloud = fakeDropbox();
  try {
    await a.api.boot(); seedLibrary(a); cloud.attach(a); await a.api.syncDropboxProject();
    await b.api.boot(); cloud.attach(b);
    cloud.requests.length = 0;
    const returning = b.w.document.querySelector('#setupExistingAccount');
    assert.match(returning.textContent, /Sign in to Dropbox/);
    await returning.onclick();
    assert.equal(b.w.document.querySelector('#projectLibraryDialog').open, true);
    assert.match(b.w.document.querySelector('#projectLibrarySelect').textContent, /Original/);
    assert.equal(cloud.requests.some(request => request.route === 'files/download' && request.args.path.includes('/documents/')), false);
    const selected = b.api.getLibraryEntries().find(entry => entry.cloud);
    b.w.document.querySelector('#projectLibrarySelect').value = selected.key;
    b.api.setDialogResponse({ documentId: 'original' });
    await b.w.document.querySelector('#projectLibraryForm').onsubmit({ preventDefault() {} });
    assert.equal(b.api.state.projectId, 'project-original');
    assert.equal(b.api.state.documents[1].content, undefined);
    assert.equal(b.api.state.workspaceAccountId, 'account');
    assert.ok(b.w.document.querySelector('#projectLibraryDialog #startProjectSetup'));
    assert.equal(b.w.document.querySelector('#documentEndBar #startProjectSetup'), null);
  } finally { a.close(); b.close(); }
});

test('changing Dropbox accounts changes the workspace catalogue and cannot upload the former account’s draft', async () => {
  const a = app(); const b = app(); const first = fakeDropbox(); const second = fakeDropbox();
  try {
    await a.api.boot(); seedLibrary(a); first.attach(a); await a.api.syncDropboxProject();
    await b.api.boot(); seedLibrary(b); b.api.state.projectId = 'other-project'; b.api.state.writingRoomName = 'Other collection'; second.attach(b, 'other'); await b.api.syncDropboxProject();
    second.attach(a, 'other');
    await a.api.openSavedProject();
    const entries = a.api.getLibraryEntries();
    assert.equal(entries.some(entry => entry.name === 'Original'), false);
    assert.equal(entries.some(entry => entry.name === 'Other collection'), true);
    second.requests.length = 0;
    await a.api.syncWorkspaceProjects();
    assert.equal(second.requests.some(request => request.route === 'files/upload'), false);
    await assert.rejects(a.api.syncDropboxProject(), /another Dropbox workspace/);
  } finally { a.close(); b.close(); }
});

test('workspace timer defaults to ten minutes, does not reset after edits, and zero disables it', async () => {
  const a = app(); const cloud = fakeDropbox();
  try {
    await a.api.boot(); cloud.attach(a);
    assert.equal(a.api.getSyncInterval(), 10);
    const timers = []; const original = a.w.setTimeout;
    a.w.setTimeout = (fn, delay) => { timers.push({ fn, delay }); return 9000 + timers.length; };
    await a.api.setWorkspaceSyncInterval(10);
    assert.equal(timers.at(-1).delay, 600000);
    const timer = a.api.getSyncTimer();
    a.api.scheduleDropboxSync(); a.api.scheduleDropboxSync();
    assert.equal(a.api.getSyncTimer(), timer);
    assert.equal(timers.length, 1);
    await a.api.setWorkspaceSyncInterval(0);
    assert.equal(a.api.getSyncTimer(), null);
    a.api.scheduleDropboxSync(); assert.equal(timers.length, 1);
    await a.api.setWorkspaceSyncInterval(3);
    assert.equal(timers.at(-1).delay, 180000);
    a.api.setConnection({ accountId: 'different', expiresAt: Date.now() + 60000 });
    await a.api.restoreWorkspacePreferences(); assert.equal(a.api.getSyncInterval(), 10);
    a.w.setTimeout = original;
  } finally { a.close(); }
});

test('scheduled sync sends changed browser data and ignores stale unbound migration copies', async () => {
  const a = app(); const cloud = fakeDropbox();
  try {
    await a.api.boot(); seedLibrary(a); cloud.attach(a);
    await a.api.writeWorkspaceSnapshot(); // old standalone browser record remains for recovery
    await a.api.syncDropboxProject();
    cloud.requests.length = 0;
    await a.api.syncWorkspaceProjects();
    assert.equal(cloud.requests.some(request => request.route === 'files/upload'), false);
    a.api.els.editor.innerHTML = '<p>New automatic revision</p>';
    await a.api.syncWorkspaceProjects();
    const saved = await cloudIndex(a, cloud);
    const body = cloud.entries.get(saved.index.project.documents[0]._body.path);
    assert.match(body.text, /New automatic revision/);
    assert.equal(cloud.requests.filter(request => request.route === 'files/upload' && request.args.path.includes('/documents/')).length, 1);
  } finally { a.close(); }
});

test('workspace ZIP contains verified project files and separate unsynced drafts and can be restored', async () => {
  const a = app(); const cloud = fakeDropbox();
  try {
    await a.api.boot(); seedLibrary(a); cloud.attach(a); await a.api.syncDropboxProject();
    a.api.releaseDocumentBody(a.api.state.documents[1]);
    a.api.els.editor.innerHTML = '<p>Unsynced browser draft</p>';
    const bytes = await a.api.buildWorkspaceZip(); const zip = await JSZip.loadAsync(bytes);
    const index = Object.keys(zip.files).find(name => name.endsWith('/project.json'));
    const draft = Object.keys(zip.files).find(name => name.startsWith('browser-drafts/') && name.endsWith('.caps.json'));
    assert.ok(index); assert.ok(draft);
    a.api.setDialogResponse({ path: index });
    const cloudCopy = await a.api.projectBackupFromZip({ arrayBuffer: async () => bytes });
    assert.match(cloudCopy.project.documents[0].content, /Keep this draft/);
    assert.match(cloudCopy.project.documents[1].content, /World history/);
    a.api.setDialogResponse({ path: draft });
    const localCopy = await a.api.projectBackupFromZip({ arrayBuffer: async () => bytes });
    assert.match(localCopy.documents[0].content, /Unsynced browser draft/);
    assert.equal(a.api.state.documents[1].content, undefined);
    assert.equal(Object.keys(zip.files).some(name => /token|connection/.test(name)), false);
  } finally { a.close(); }
});

test('a damaged document stops a ZIP backup instead of producing a partial-looking complete backup', async () => {
  const a = app(); const cloud = fakeDropbox();
  try {
    await a.api.boot(); seedLibrary(a); cloud.attach(a); await a.api.syncDropboxProject();
    const { index } = await cloudIndex(a, cloud);
    cloud.entries.get(index.project.documents[1]._body.path).text = 'corrupted';
    await assert.rejects(a.api.buildWorkspaceZip(), /integrity check/);
    assert.equal(a.api.state.projectId, 'project-original');
  } finally { a.close(); }
});

test('format requires its exact confirmation and only removes recognized projects in the selected account', async () => {
  const a = app(); const cloud = fakeDropbox();
  try {
    await a.api.boot(); seedLibrary(a); cloud.attach(a); await a.api.syncDropboxProject();
    cloud.put('/forever-bound-project-original.caps.json', a.api.serializedWorkspace());
    cloud.put('/unrelated-notes.txt', 'Keep this unrelated file');
    await a.api.openSavedProject();
    a.api.setDialogResponse({ confirmation: 'wrong phrase' });
    cloud.requests.length = 0;
    await a.api.confirmWorkspaceDeletion({ all: true });
    assert.equal(cloud.requests.some(request => request.route === 'files/delete_v2'), false);
    a.api.setDialogResponse({ confirmation: 'RESET WORKSPACE' });
    await a.api.confirmWorkspaceDeletion({ all: true });
    assert.equal(a.api.getCatalogue().length, 0);
    assert.equal(cloud.entries.has('/unrelated-notes.txt'), true);
    assert.equal(cloud.entries.has('/forever-bound-project-original.caps.json'), false);
    const copies = (await a.api.listSavedProjectIndexes()).map(record => JSON.parse(record.json));
    assert.equal(copies.some(project => project.workspaceAccountId === 'account'), false);
  } finally { a.close(); }
});

test('deleting one account’s project preserves another account’s browser copy with the same project ID', async () => {
  const a = app(); const b = app(); const first = fakeDropbox(); const second = fakeDropbox();
  try {
    await a.api.boot(); seedLibrary(a); first.attach(a); await a.api.syncDropboxProject();
    await b.api.boot(); seedLibrary(b); b.api.state.writingRoomName = 'Other account copy'; second.attach(b, 'other'); await b.api.syncDropboxProject();
    const binding = await b.api.workspaceRecord('dropbox-binding:other:project-original');
    second.attach(a, 'other');
    await a.api.openDropboxProjectPath(binding.path);
    await a.api.refreshDropboxProjects();
    const entry = { ...a.api.getCatalogue()[0], cloud: true };
    await a.api.removeWorkspaceProject(entry, 'other');
    const records = (await a.api.listSavedProjectIndexes()).map(record => JSON.parse(record.json));
    assert.equal(records.some(project => project.projectId === 'project-original' && project.workspaceAccountId === 'account'), true);
    assert.equal(records.some(project => project.projectId === 'project-original' && project.workspaceAccountId === 'other'), false);
    assert.ok([...first.entries.keys()].some(name => name.endsWith('/project.json')));
  } finally { a.close(); b.close(); }
});

test('delete refuses a project changed after it was listed', async () => {
  const a = app(); const cloud = fakeDropbox();
  try {
    await a.api.boot(); seedLibrary(a); cloud.attach(a); await a.api.syncDropboxProject();
    const entry = { ...a.api.getCatalogue()[0], cloud: true };
    cloud.put(entry.path, cloud.entries.get(entry.path).text);
    cloud.requests.length = 0;
    await assert.rejects(a.api.removeWorkspaceProject(entry, 'account'), /changed since/);
    assert.equal(cloud.requests.some(request => request.route === 'files/delete_v2'), false);
  } finally { a.close(); }
});

test('Writing Room can reach the viewport bottom without a fixed height cap and uses emoji icons', async () => {
  const a = app();
  try {
    await a.api.boot();
    Object.defineProperty(a.w, 'innerHeight', { configurable: true, value: 1100 });
    const panel = a.api.els.writingRoomPanel;
    panel.getBoundingClientRect = () => ({ left: 12, top: 80, width: 300, height: parseFloat(panel.style.height) || 400 });
    a.w.document.querySelector('#fillWritingRoomHeight').click();
    assert.equal(panel.style.height, '1008px');
    assert.equal(panel.style.top, '80px');
    assert.match(a.w.document.querySelector('#newTabButton').textContent, /Tab/);
    assert.match(a.w.document.querySelector('#editWritingRoomButton').textContent, /Edit/);
    assert.match(a.w.document.querySelector('#projectSettingsButton').textContent, /Project settings/);
  } finally { a.close(); }
});

test('cabinet menus retain real controls, fit the panel, and support keyboard navigation', async () => {
  const a = app();
  try {
    await a.api.boot();
    a.api.toggleWritingRoomPanel(true);
    const panel = a.api.els.writingRoomPanel;
    panel.getBoundingClientRect = () => ({ top: 80, left: 12, width: 280, height: 250 });
    const trigger = panel.querySelector('[data-cabinet-menu="cabinetNewMenu"]');
    trigger.getBoundingClientRect = () => ({ bottom: 178 });
    trigger.click();
    const menu = a.w.document.getElementById('cabinetNewMenu');
    assert.equal(menu.hidden, false); assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(a.w.document.activeElement.id, 'newDocumentButton');
    assert.ok(parseFloat(menu.style.top) + parseFloat(menu.style.maxHeight) <= 250);
    a.w.document.activeElement.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    assert.equal(a.w.document.activeElement.id, 'newFolderButton');
    a.w.document.activeElement.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(menu.hidden, true); assert.equal(a.w.document.activeElement, trigger);
    panel.querySelector('[data-cabinet-menu="cabinetMoreMenu"]').click();
    assert.equal(a.w.document.getElementById('cabinetMoreMenu').hidden, false);
    a.w.document.getElementById('projectSettingsButton').click();
    assert.equal(a.w.document.getElementById('cabinetMoreMenu').hidden, true);
    assert.equal(a.api.els.projectSettingsPanel.hidden, false);
  } finally { a.close(); }
});

test('cabinet file actions remain available without the old row of icon buttons', async () => {
  const a = app();
  try {
    await a.api.boot();
    const card = a.w.document.querySelector('[data-doc-card]');
    card.querySelector('[data-document-menu]').click();
    const actions = [...a.w.document.querySelectorAll('#cabinetDocumentMenu [data-card-action]')];
    assert.deepEqual(actions.map(button => button.dataset.cardAction), ['sub-document', 'bulk-style', 'duplicate', 'deprecate', 'copy', 'storyboard', 'delete']);
    assert.ok(actions.every(button => button.dataset.docId === card.dataset.docCard));
    assert.equal(card.querySelector('.document-card-actions'), null);
    assert.equal(card.querySelector('.metadata-pill'), null);
    assert.equal(card.querySelector('[data-disclosure="metadata"]').open, false);
    assert.equal(card.querySelector('[data-disclosure="summary"]').open, false);
    const before = a.api.state.documents.length;
    actions.find(button => button.dataset.cardAction === 'duplicate').click();
    for (let i = 0; i < 50 && a.api.state.documents.length === before; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(a.api.state.documents.length, before + 1);
  } finally { a.close(); }
});

test('cabinet rail lists unloaded nested files and jumps without downloading their bodies', async () => {
  const a = app();
  try {
    await a.api.boot();
    a.api.state.filingGroups = [{ id: 'rail-folder', label: 'A long folder name' }];
    a.api.state.filingTabs = [{ id: 'rail-tab', groupId: 'rail-folder', label: 'Documents' }];
    a.api.state.documents = [{ id: 'rail-parent', title: 'Episode', filingGroupId: 'rail-folder', filingTabId: 'rail-tab' }, { id: 'rail-child', title: 'Act 1', parentDocumentId: 'rail-parent', filingGroupId: 'rail-folder', filingTabId: 'rail-tab' }];
    a.api.state.activeId = 'rail-parent';
    a.api.renderWritingRoomCards();
    a.api.els.writingRoomCards.querySelectorAll('details').forEach(node => { node.open = false; });
    a.w.fetch = async () => { throw new Error('Rail navigation must not download bodies'); };
    const marker = [...a.w.document.querySelectorAll('[data-cabinet-rail]')].find(button => button.title.includes('File 2 of 2'));
    assert.ok(marker); assert.match(marker.getAttribute('aria-label'), /Act 1/); marker.click();
    const child = a.w.document.querySelector('[data-doc-card="rail-child"]');
    assert.equal(child.open, true); assert.equal(child.closest('.filing-tab').open, true);
    assert.equal(child.closest('.writing-room-group').open, true);
    assert.equal(a.api.state.documents[1].content, undefined);
    assert.equal(a.api.state.activeId, 'rail-parent');
    assert.equal(a.w.document.querySelector('.cabinet-file-count').textContent, '2');
  } finally { a.close(); }
});

test('dense cabinet rail groups destinations and every file is still reachable', async () => {
  const a = app();
  try {
    await a.api.boot();
    a.api.state.filingGroups = [{ id: 'many', label: 'Episodes' }];
    a.api.state.filingTabs = [{ id: 'many-tab', groupId: 'many', label: 'Documents' }];
    a.api.state.documents = Array.from({ length: 80 }, (_, i) => ({ id: `file-${i}`, title: `Episode ${i + 1}`, filingTabId: 'many-tab', filingGroupId: 'many' }));
    a.api.state.activeId = 'file-0';
    a.api.els.writingRoomPanel.getBoundingClientRect = () => ({ height: 260 });
    a.api.renderWritingRoomCards();
    const markers = [...a.w.document.querySelectorAll('[data-cabinet-rail]')];
    assert.ok(markers.length <= 3);
    const reachable = [];
    for (const marker of markers) {
      marker.click();
      for (const button of a.w.document.querySelectorAll('#cabinetJumpMenu button')) reachable.push(button.textContent);
    }
    assert.ok(reachable.some(label => label.includes('Episode 80')));
    const last = [...a.w.document.querySelectorAll('#cabinetJumpMenu button')].find(button => button.textContent.includes('Episode 80'));
    last.click();
    assert.equal(a.w.document.querySelector('[data-doc-card="file-79"]').open, true);
    assert.equal(a.w.document.querySelector('.cabinet-file-count').textContent, '80');
  } finally { a.close(); }
});

test('cabinet locks stay at their row level and keep a closed folder expanded after locking', async () => {
  const a = app();
  try {
    await a.api.boot();
    const folder = a.w.document.querySelector('.writing-room-group[data-group-id]');
    const id = folder.dataset.groupId; folder.open = false;
    folder.querySelector(':scope > summary .lock-button').click();
    for (let i = 0; i < 50 && !a.api.state.filingGroups.find(group => group.id === id)?.locked; i++) await new Promise(resolve => setTimeout(resolve, 5));
    const updated = [...a.w.document.querySelectorAll('.writing-room-group[data-group-id]')].find(item => item.dataset.groupId === id);
    assert.equal(updated.open, true);
    assert.equal(updated.querySelector(':scope > summary .lock-button').getAttribute('aria-pressed'), 'true');
    updated.querySelector('summary').click(); assert.equal(updated.open, true);
    assert.ok(updated.querySelector(':scope > summary .cabinet-title'));
    assert.equal(updated.querySelector(':scope > summary .card-arrow').textContent, '›');
  } finally { a.close(); }
});

test('Send to Storyboarder transfers just the selected document through local same-origin storage', async () => {
  const a = app();
  try {
    await a.api.boot(); seedLibrary(a);
    let destination;
    const target = { opener: a.w, location: { replace: value => { destination = value; } }, close() {} };
    a.w.open = () => target;
    await a.api.sendDocumentToStoryboarder();
    const url = new URL(destination);
    assert.equal(url.origin, a.w.location.origin);
    assert.equal(url.pathname, '/modules/storyboarder/');
    assert.equal(target.opener, null);
    const payload = await a.api.workspaceRecord(`storyboarder-handoff:${url.searchParams.get('import')}`);
    assert.equal(payload.document.id, 'original');
    assert.match(payload.document.markdown, /Keep this draft/);
    assert.doesNotMatch(payload.document.markdown, /World history/);
  } finally { a.close(); }
});

test('confirmed sync evicts saved document bodies and repairs older local links while keeping the open document in memory', async () => {
  const db = new IDBFactory(); const a = app({ indexedDB: db }); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    await a.api.writeWorkspaceSnapshot(); // standalone record from before connecting Dropbox
    a.api.state.trash.push({ id: 'trashed', title: 'Trashed', content: '<p>Archived content</p>', tags: [] });
    a.api.state.deprecated.push({ id: 'old', title: 'Old draft', content: '<p>Previous content</p>', tags: [] });
    await a.api.syncDropboxProject();
    const index = JSON.parse((await a.api.workspaceRecord('active')).json);
    assert.equal(await a.api.workspaceRecord('document-body:' + index.documents[0]._body.hash), undefined);
    assert.match(a.api.state.documents[0].content, /Keep this draft/);
    for (const doc of [index.documents[1], ...index.trash, ...index.deprecated]) {
      assert.equal(await a.api.workspaceRecord('document-body:' + doc._body.hash), undefined);
      assert.ok(cloud.entries.has(doc._body.path));
    }
    assert.equal(a.api.state.documents[1].content, undefined);
    assert.equal(a.api.state.trash[0].content, undefined);
    assert.equal(a.api.hasRetainedDocumentBody(a.api.state.documents[1]), false);
    const old = JSON.parse((await a.api.workspaceRecord('project:project-original')).json);
    assert.equal(old.documents[1]._body.path, index.documents[1]._body.path);
    const b = app({ indexedDB: db }); cloud.attach(b);
    try {
      await b.api.loadWorkspace();
      await b.api.ensureDocumentContent(b.api.state.documents[1]);
      assert.match(b.api.state.documents[1].content, /World history/);
      assert.equal(await b.api.workspaceRecord('document-body:' + index.documents[1]._body.hash), undefined);
    } finally { b.close(); }
  } finally { a.close(); }
});

test('edits made during a successful upload stay local when they differ from the committed cloud body', async () => {
  const a = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    cloud.before = async request => {
      if (request.route === 'files/upload' && request.args.path.endsWith('/project.json')) {
        cloud.before = null;
        a.api.state.documents[1].content = '<p>Newer unsynced lore typed during upload</p>';
        await a.api.writeWorkspaceSnapshot();
      }
    };
    await a.api.syncDropboxProject();
    const index = JSON.parse((await a.api.workspaceRecord('active')).json);
    const saved = await cloudIndex(a, cloud);
    assert.notEqual(index.documents[1]._body.hash, saved.index.project.documents[1]._body.hash);
    assert.equal(index.documents[1]._body.path, undefined);
    assert.match(await a.api.workspaceRecord('document-body:' + index.documents[1]._body.hash), /Newer unsynced lore/);
    await a.api.ensureDocumentContent(a.api.state.documents[1]);
    assert.match(a.api.state.documents[1].content, /Newer unsynced lore/);
  } finally { a.close(); }
});

test('uploading document files without committing the index never makes unsynced cache bodies disposable', async () => {
  const a = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    cloud.fail = request => request.route === 'files/upload' && request.args.path.endsWith('/project.json');
    await assert.rejects(a.api.syncDropboxProject(), /503/);
    const index = JSON.parse((await a.api.workspaceRecord('active')).json);
    assert.match(await a.api.workspaceRecord('document-body:' + index.documents[1]._body.hash), /World history/);
    assert.equal(index.documents[1]._body.path, undefined);
    assert.equal(await a.api.workspaceRecord('dropbox-binding:account:project-original'), undefined);
    cloud.fail = null;
    await a.api.syncDropboxProject();
    assert.equal(await a.api.workspaceRecord('document-body:' + index.documents[1]._body.hash), undefined);
  } finally { a.close(); }
});

test('switching between synced documents and exporting a complete copy does not refill an accumulating cache', async () => {
  const a = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    await a.api.syncDropboxProject();
    const first = JSON.parse((await a.api.workspaceRecord('active')).json);
    assert.equal(await a.api.openDocument('bible'), true);
    await a.api.writeWorkspaceSnapshot();
    assert.equal(await a.api.workspaceRecord('document-body:' + first.documents[0]._body.hash), undefined);
    assert.equal(await a.api.workspaceRecord('document-body:' + first.documents[1]._body.hash), undefined);
    assert.match(a.api.state.documents[1].content, /World history/);
    const copy = await a.api.completeProjectCopy(JSON.parse(a.api.serializedWorkspace()));
    assert.match(copy.documents[0].content, /Keep this draft/);
    assert.equal(await a.api.workspaceRecord('document-body:' + first.documents[0]._body.hash), undefined);
    assert.equal(await a.api.openDocument('original'), true);
    await a.api.writeWorkspaceSnapshot();
    assert.equal(await a.api.workspaceRecord('document-body:' + first.documents[1]._body.hash), undefined);
    assert.match(a.api.state.documents[0].content, /Keep this draft/);
  } finally { a.close(); }
});

test('cache eviction preserves identical bodies still needed by an unsynced separate project', async () => {
  const a = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    a.api.state.projectId = 'local-only-project';
    await a.api.writeWorkspaceSnapshot();
    a.api.state.projectId = 'project-original';
    await a.api.syncDropboxProject();
    const index = JSON.parse((await a.api.workspaceRecord('active')).json);
    assert.match(await a.api.workspaceRecord('document-body:' + index.documents[1]._body.hash), /World history/);
    const other = JSON.parse((await a.api.workspaceRecord('project:local-only-project')).json);
    assert.equal(other.documents[1]._body.path, undefined);
  } finally { a.close(); }
});

test('background sync clears the inactive project cache while preserving the current unsynced project', async () => {
  const a = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    a.api.state.workspaceAccountId = 'account';
    await a.api.writeWorkspaceSnapshot();
    const original = JSON.parse((await a.api.workspaceRecord('active')).json);
    a.api.state.projectId = 'other-project'; a.api.state.writingRoomName = 'Other';
    a.api.state.documents = [{ id: 'other-doc', title: 'Other', content: '<p>Open unsynced work</p>', tags: [] }];
    a.api.state.activeId = 'other-doc'; a.api.state.cloudSyncPaused = true;
    a.api.els.editor.innerHTML = '<p>Open unsynced work</p>';
    await a.api.writeWorkspaceSnapshot();
    await a.api.syncWorkspaceProjects();
    for (const doc of original.documents) assert.equal(await a.api.workspaceRecord('document-body:' + doc._body.hash), undefined);
    const active = JSON.parse((await a.api.workspaceRecord('active')).json);
    assert.match(await a.api.workspaceRecord('document-body:' + active.documents[0]._body.hash), /Open unsynced work/);
    const saved = JSON.parse((await a.api.workspaceRecord('project:account:project-original')).json);
    assert.ok(saved.documents[1]._body.path);
  } finally { a.close(); }
});

test('opening a saved cloud project keeps its chosen document in memory without leaving a local body copy', async () => {
  const a = app(); const b = app(); seedLibrary(a); seed(b.api); const cloud = fakeDropbox(); cloud.attach(a); cloud.attach(b);
  try {
    await a.api.syncDropboxProject(); const saved = await cloudIndex(a, cloud);
    await b.api.openDropboxProjectPath(saved.binding.path);
    assert.match(b.api.state.documents[0].content, /Keep this draft/);
    const index = JSON.parse((await b.api.workspaceRecord('active')).json);
    assert.equal(await b.api.workspaceRecord('document-body:' + index.documents[0]._body.hash), undefined);
    b.api.els.editor.innerHTML = '<p>Changed again after opening cloud copy</p>';
    b.api.state.documents[0].content = b.api.els.editor.innerHTML;
    await b.api.persistNow();
    const edited = JSON.parse((await b.api.workspaceRecord('active')).json);
    assert.match(await b.api.workspaceRecord('document-body:' + edited.documents[0]._body.hash), /Changed again after opening/);
  } finally { a.close(); b.close(); }
});

test('a paused independent recovery copy keeps its bodies even when the same versions exist in Dropbox', async () => {
  const a = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    await a.api.syncDropboxProject();
    const original = JSON.parse(a.api.serializedWorkspace());
    const full = await a.api.completeProjectCopy(original);
    await a.api.importProjectBackupPayload({ type: 'capsanoto-project-backup', project: full });
    assert.equal(a.api.state.cloudSyncPaused, true);
    const restored = JSON.parse((await a.api.workspaceRecord('active')).json);
    assert.match(await a.api.workspaceRecord('document-body:' + restored.documents[1]._body.hash), /World history/);
    a.api.setConnection(null);
    await a.api.ensureDocumentContent(a.api.state.documents[1]);
    assert.match(a.api.state.documents[1].content, /World history/);
  } finally { a.close(); }
});

test('history defaults to five previous versions per document without ageing an unchanged document', async () => {
  const a = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    await a.api.syncDropboxProject();
    for (let version = 1; version <= 2; version++) {
      await a.api.ensureDocumentContent(a.api.state.documents[1]);
      a.api.state.documents[1].content = `<p>Bible revision ${version}</p>`;
      await a.api.syncDropboxProject();
    }
    for (let version = 1; version <= 8; version++) {
      a.api.els.editor.innerHTML = `<p>Script revision ${version}</p>`;
      await a.api.syncDropboxProject();
    }
    const saved = await cloudIndex(a, cloud);
    assert.equal(saved.index.history.limit, 5);
    assert.equal(saved.index.history.documents.original.length, 5);
    assert.equal(saved.index.history.documents.bible.length, 2);
    const originalVersions = saved.index.history.documents.original.map(ref => cloud.entries.get(ref.path).text);
    assert.match(originalVersions[0], /Script revision 7/);
    assert.match(originalVersions[4], /Script revision 3/);
    assert.equal([...cloud.entries.values()].filter(file => file.path_lower.startsWith(saved.binding.folder + '/documents/')).length, 9);
    for (const ref of [saved.index.shared, ...saved.index.history.shared, ...saved.index.history.documents.original, ...saved.index.history.documents.bible]) assert.ok(cloud.entries.has(ref.path));
    assert.ok([...cloud.entries.values()].filter(file => file.name.endsWith('.project.json')).length <= 6);
  } finally { a.close(); }
});

test('workspace history limit follows the account and zero retains current files without previous versions', async () => {
  const a = app(); const b = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a); cloud.attach(b);
  try {
    await a.api.syncDropboxProject();
    for (let version = 1; version <= 4; version++) { a.api.els.editor.innerHTML = `<p>Saved ${version}</p>`; await a.api.syncDropboxProject(); }
    await a.api.setWorkspaceHistoryLimit(1);
    await b.api.loadWorkspaceHistorySettings(); assert.equal(b.api.getHistoryLimit(), 1);
    let saved = await cloudIndex(a, cloud); assert.equal(saved.index.history.documents.original.length, 1);
    await a.api.setWorkspaceHistoryLimit(0);
    saved = await cloudIndex(a, cloud); assert.equal(saved.index.history.documents.original.length, 0);
    assert.equal([...cloud.entries.values()].filter(file => file.path_lower.startsWith(saved.binding.folder + '/documents/')).length, 2);
    assert.equal([...cloud.entries.values()].filter(file => file.name.endsWith('.project.json')).length, 1);
    assert.match(cloud.entries.get(saved.index.project.documents[0]._body.path).text, /Saved 4/);
    for (const invalid of [-1, 1.5, 101, 'bad']) await assert.rejects(a.api.setWorkspaceHistoryLimit(invalid), /whole number/);
    await assert.rejects(a.api.setWorkspaceHistoryLimit(''), /Enter the number/);
    cloud.attach(b, 'another-account');
    // Separate fake account contents for the settings read.
    const config = cloud.entries.get('/workspace-settings.json'); cloud.entries.delete('/workspace-settings.json');
    await b.api.loadWorkspaceHistorySettings(); assert.equal(b.api.getHistoryLimit(), 5);
    cloud.entries.set('/workspace-settings.json', config);
  } finally { a.close(); b.close(); }
});

test('failed project commit does not delete history and a later successful sync retries safely', async () => {
  const a = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    await a.api.syncDropboxProject(); await a.api.setWorkspaceHistoryLimit(0);
    const saved = await cloudIndex(a, cloud); const currentBody = saved.index.project.documents[0]._body.path;
    cloud.requests.length = 0;
    a.api.els.editor.innerHTML = '<p>Pending failed revision</p>';
    cloud.fail = request => request.route === 'files/upload' && request.args.path.endsWith('/project.json');
    await assert.rejects(a.api.syncDropboxProject(), /503/);
    assert.ok(cloud.entries.has(currentBody));
    assert.equal(cloud.requests.some(request => request.route === 'files/delete_v2' && !request.args.path.endsWith('/.sync-lock.json')), false);
    cloud.fail = null; await a.api.syncDropboxProject();
    assert.equal(cloud.entries.has(currentBody), false);
    const latest = await cloudIndex(a, cloud);
    for (const doc of latest.index.project.documents) assert.ok(cloud.entries.has(doc._body.path));
  } finally { a.close(); }
});

test('concurrent publication cannot enter a project while another device owns its history cleanup lock', async () => {
  const a = app(); const b = app(); seedLibrary(a); seed(b.api); const cloud = fakeDropbox(); cloud.attach(a); cloud.attach(b);
  try {
    await a.api.syncDropboxProject(); const saved = await cloudIndex(a, cloud);
    await b.api.openDropboxProjectPath(saved.binding.path);
    a.api.els.editor.innerHTML = '<p>Device A revision</p>'; b.api.els.editor.innerHTML = '<p>Device B draft</p>';
    let blocked = false;
    cloud.before = async request => {
      if (request.route === 'files/upload' && request.args.path === saved.binding.path) {
        cloud.before = null;
        await assert.rejects(b.api.syncDropboxProject(), /syncing in another/); blocked = true;
        assert.ok(cloud.entries.has(saved.binding.folder + '/.sync-lock.json'));
      }
    };
    await a.api.syncDropboxProject(); assert.equal(blocked, true);
    assert.equal(cloud.entries.has(saved.binding.folder + '/.sync-lock.json'), false);
    assert.match(b.api.state.documents[0].content, /Device B draft/);
  } finally { a.close(); b.close(); }
});

test('interrupted cleanup keeps current and retained versions usable and retries only obsolete managed files', async () => {
  const a = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    await a.api.syncDropboxProject();
    a.api.els.editor.innerHTML = '<p>Second saved revision</p>'; await a.api.syncDropboxProject();
    const saved = await cloudIndex(a, cloud);
    cloud.put(saved.binding.folder + '/documents/notes.txt', 'Unrelated file');
    cloud.fail = request => request.route === 'files/delete_v2' && request.args.path.includes('/documents/');
    await assert.rejects(a.api.setWorkspaceHistoryLimit(0), /cleanup needs retry/);
    let current = await cloudIndex(a, cloud);
    for (const doc of current.index.project.documents) assert.ok(cloud.entries.has(doc._body.path));
    cloud.fail = null; await a.api.maintainWorkspaceHistory();
    current = await cloudIndex(a, cloud);
    assert.equal(current.index.history.documents.original.length, 0);
    assert.ok(cloud.entries.has(saved.binding.folder + '/documents/notes.txt'));
    assert.equal([...cloud.entries.values()].filter(file => file.path_lower.startsWith(saved.binding.folder + '/documents/') && file.name.endsWith('.doc.json')).length, 2);
  } finally { a.close(); }
});

test('history settings use revision checks so another device cannot silently replace the chosen limit', async () => {
  const a = app(); const b = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a); cloud.attach(b);
  try {
    await a.api.syncDropboxProject();
    await a.api.loadWorkspaceHistorySettings(); await b.api.loadWorkspaceHistorySettings();
    await a.api.setWorkspaceHistoryLimit(2);
    await assert.rejects(b.api.setWorkspaceHistoryLimit(8), /settings changed on another device/);
    assert.equal(JSON.parse(cloud.entries.get('/workspace-settings.json').text).documentHistoryLimit, 2);
  } finally { a.close(); b.close(); }
});

test('existing unbounded snapshots bootstrap bounded per-document history without touching unrelated files', async () => {
  const a = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    await a.api.syncDropboxProject();
    a.api.els.editor.innerHTML = '<p>Legacy second</p>'; await a.api.syncDropboxProject();
    const saved = await cloudIndex(a, cloud);
    const legacy = JSON.parse(saved.file.text); delete legacy.history;
    const legacyText = JSON.stringify(legacy, null, 2);
    const legacyFile = cloud.put(saved.binding.path, legacyText);
    cloud.put(saved.binding.folder + '/history/' + await a.api.projectFileHash(legacyText) + '.project.json', legacyText);
    const binding = await a.api.workspaceRecord('dropbox-binding:account:project-original');
    await a.api.workspaceRecord('dropbox-binding:account:project-original', { ...binding, rev: legacyFile.rev });
    cloud.put('/unrelated-folder/random.json', 'Not a managed file');
    await a.api.setWorkspaceHistoryLimit(1);
    const bounded = await cloudIndex(a, cloud);
    assert.equal(bounded.index.history.documents.original.length, 1);
    assert.ok(cloud.entries.has(bounded.index.history.documents.original[0].path));
    assert.ok(cloud.entries.has('/unrelated-folder/random.json'));
  } finally { a.close(); }
});

test('unreadable history settings stop publication and cleanup while keeping cloud and local drafts', async () => {
  const a = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    await a.api.syncDropboxProject(); const saved = await cloudIndex(a, cloud);
    cloud.put('/workspace-settings.json', '{broken configuration');
    a.api.els.editor.innerHTML = '<p>Keep unsynced update</p>'; cloud.requests.length = 0;
    await assert.rejects(a.api.syncDropboxProject());
    assert.equal(cloud.entries.get(saved.binding.path).text, saved.file.text);
    assert.equal(cloud.requests.some(request => request.route === 'files/delete_v2'), false);
    const local = JSON.parse((await a.api.workspaceRecord('active')).json);
    assert.match(await a.api.workspaceRecord('document-body:' + local.documents[0]._body.hash), /Keep unsynced update/);
  } finally { a.close(); }
});

test('Workspace settings history control saves the chosen account policy without changing its sync interval', async () => {
  const a = app(); const cloud = fakeDropbox();
  try {
    await a.api.boot(); seedLibrary(a); cloud.attach(a); await a.api.syncDropboxProject();
    await a.api.setWorkspaceSyncInterval(7); await a.api.openSavedProject();
    const input = a.w.document.getElementById('workspaceHistoryLimit');
    assert.equal(input.value, '5'); input.value = '2';
    await a.w.document.getElementById('saveWorkspaceHistory').onclick();
    assert.equal(JSON.parse(cloud.entries.get('/workspace-settings.json').text).documentHistoryLimit, 2);
    assert.equal(a.api.getSyncInterval(), 7);
    assert.match(a.w.document.getElementById('projectLibraryStatus').textContent, /2 previous/);
    assert.equal(input.disabled, false);
  } finally { a.close(); }
});

test('Release interrupted sync requires UNLOCK and removes only the selected project lock', async () => {
  const a = app(); const cloud = fakeDropbox();
  try {
    await a.api.boot(); seedLibrary(a); cloud.attach(a); await a.api.syncDropboxProject();
    const saved = await cloudIndex(a, cloud); const lockPath = saved.binding.folder + '/.sync-lock.json';
    cloud.put(lockPath, JSON.stringify({ type: 'capsanoto-sync-lock', token: 'interrupted-test' }));
    await a.api.openSavedProject();
    a.api.setDialogResponse({ confirm: 'no' });
    await a.w.document.getElementById('releaseWorkspaceSync').onclick();
    assert.ok(cloud.entries.has(lockPath));
    a.api.setDialogResponse({ confirm: 'UNLOCK' });
    await a.w.document.getElementById('releaseWorkspaceSync').onclick();
    assert.equal(cloud.entries.has(lockPath), false);
    assert.equal(cloud.entries.get(saved.binding.path).text, saved.file.text);
    for (const doc of saved.index.project.documents) assert.ok(cloud.entries.has(doc._body.path));
  } finally { a.close(); }
});

test('cleanup keeps the exact current recovery index after shared-data changes and orphan-file retries', async () => {
  const a = app(); seedLibrary(a); const cloud = fakeDropbox(); cloud.attach(a);
  try {
    await a.api.syncDropboxProject();
    for (let version = 1; version <= 3; version++) {
      a.api.state.blocks = { note: { id: 'note', content: `Shared note ${version}` } };
      await a.api.syncDropboxProject();
    }
    const saved = await cloudIndex(a, cloud);
    assert.equal(saved.index.history.shared.length, 3);
    cloud.put(saved.binding.folder + '/documents/' + 'e'.repeat(64) + '.doc.json', 'Interrupted orphan');
    await a.api.maintainWorkspaceHistory();
    const current = await cloudIndex(a, cloud);
    const exact = current.binding.folder + '/history/' + await a.api.projectFileHash(current.file.text) + '.project.json';
    assert.equal(cloud.entries.get(exact)?.text, current.file.text);
    for (const ref of [current.index.shared, ...current.index.history.shared]) assert.ok(cloud.entries.has(ref.path));
    assert.equal(cloud.entries.has(saved.binding.folder + '/documents/' + 'e'.repeat(64) + '.doc.json'), false);
  } finally { a.close(); }
});

test('the warning reconnects immediately from its button and retries the requested document without losing open edits', async () => {
  const a = app(); const cloud = fakeDropbox();
  try {
    await a.api.boot(); seedLibrary(a); cloud.attach(a); await a.api.syncDropboxProject();
    a.api.setConnection({ accountId: 'account', token: 'expired-test', expiresAt: 0 });
    a.api.els.editor.innerHTML = '<p>Keep edits made before reconnecting</p>';
    assert.equal(await a.api.openDocument('bible'), false);
    const panel = a.w.document.getElementById('storageWarning'); const button = a.w.document.getElementById('storageWarningReconnect');
    assert.equal(panel.hidden, false); assert.equal(button.hidden, false); assert.equal(button.disabled, false);
    assert.equal(a.api.state.activeId, 'original');
    let started = false;
    a.api.setReconnect(() => { started = true; cloud.attach(a); return Promise.resolve(); });
    const reconnect = button.onclick(); assert.equal(started, true); assert.equal(button.disabled, true);
    await reconnect;
    assert.equal(a.api.state.activeId, 'bible'); assert.match(a.api.state.documents[1].content, /World history/);
    await a.api.ensureDocumentContent(a.api.state.documents[0]); assert.match(a.api.state.documents[0].content, /Keep edits made before reconnecting/);
    assert.equal(panel.hidden, true);
  } finally { a.close(); }
});

test('startup reconnect loads the real active document instead of saving its unavailable-document placeholder', async () => {
  const a = app(); const b = app(); const cloud = fakeDropbox(); seedLibrary(a); cloud.attach(a);
  try {
    await a.api.syncDropboxProject(); const saved = await a.api.workspaceRecord('active');
    await b.api.workspaceRecord('active', { ...saved, revision: 1 });
    await b.api.workspaceRecord('dropbox-connection', { accountId: 'account', token: 'expired-test', expiresAt: 0 });
    await b.api.boot(); assert.equal(b.api.state.documents[0].content, undefined);
    assert.equal(b.w.document.getElementById('storageWarningReconnect').hidden, false);
    b.api.setReconnect(async () => { cloud.attach(b); });
    await b.w.document.getElementById('storageWarningReconnect').onclick();
    assert.equal(b.api.state.documents[0].content, '<p>Keep this draft</p>');
    assert.equal(b.api.els.editor.contentEditable, 'true');
    const index = JSON.parse((await b.api.workspaceRecord('active')).json);
    const body = await b.api.workspaceRecord('document-body:' + index.documents[0]._body.hash);
    assert.match(body, /Keep this draft/); assert.doesNotMatch(body, /data-retry-document|not cached|Could not open/);
  } finally { a.close(); b.close(); }
});

test('cancelled sign-in keeps the warning and allows reconnecting again', async () => {
  const a = app(); const cloud = fakeDropbox();
  try {
    await a.api.boot(); seedLibrary(a); cloud.attach(a); await a.api.syncDropboxProject();
    a.api.setConnection({ accountId: 'account', token: 'expired', expiresAt: 0 }); await a.api.openDocument('bible');
    a.api.setReconnect(async () => { throw new Error('Sign-in was cancelled'); });
    await a.w.document.getElementById('storageWarningReconnect').onclick();
    assert.equal(a.w.document.getElementById('storageWarning').hidden, false);
    assert.equal(a.w.document.getElementById('storageWarningReconnect').disabled, false);
    assert.match(a.w.document.getElementById('storageWarningMessage').textContent, /Sign-in was cancelled/);
    assert.equal(a.api.state.activeId, 'original');
  } finally { a.close(); }
});

test('the warning refuses to open a document through the wrong Dropbox account', async () => {
  const a = app(); const cloud = fakeDropbox();
  try {
    await a.api.boot(); seedLibrary(a); cloud.attach(a); await a.api.syncDropboxProject();
    a.api.setConnection({ accountId: 'account', token: 'expired', expiresAt: 0 }); await a.api.openDocument('bible');
    a.api.setReconnect(async () => { cloud.attach(a, 'other-account'); });
    await a.w.document.getElementById('storageWarningReconnect').onclick();
    assert.equal(a.api.state.activeId, 'original'); assert.equal(a.api.state.documents[1].content, undefined);
    assert.match(a.w.document.getElementById('storageWarningMessage').textContent, /account that owns this document/);
    let switched = false;
    a.api.setReconnect(async options => { switched = options.switchAccount; cloud.attach(a); });
    await a.w.document.getElementById('storageWarningReconnect').onclick();
    assert.equal(switched, true); assert.equal(a.api.state.activeId, 'bible');
  } finally { a.close(); }
});

test('generic storage warnings keep backup and dismiss actions without offering an irrelevant reconnect', async () => {
  const a = app(); let downloads = 0;
  try {
    a.api.showStorageWarning('The browser could not save your draft.', { backup: () => { downloads++; } });
    assert.equal(a.w.document.getElementById('storageWarningReconnect').hidden, true);
    a.w.document.getElementById('storageWarningBackup').click(); assert.equal(downloads, 1);
    a.w.document.getElementById('storageWarningDismiss').click(); assert.equal(a.w.document.getElementById('storageWarning').hidden, true);
    a.api.showStorageWarning('A newer warning'); assert.equal(a.w.document.getElementById('storageWarning').hidden, false);
    assert.equal(a.w.document.querySelectorAll('#storageWarning').length, 1);
  } finally { a.close(); }
});

test('a provider-rejected token offers reconnect even when its local expiry time is still valid', async () => {
  const a = app(); const cloud = fakeDropbox();
  try {
    await a.api.boot(); seedLibrary(a); cloud.attach(a); await a.api.syncDropboxProject();
    const fetch = a.w.fetch;
    a.w.fetch = async (url, options) => String(url).includes('/files/download') ? { ok: false, status: 401, json: async () => ({ error_summary: 'expired_access_token/' }) } : fetch(url, options);
    assert.equal(await a.api.openDocument('bible'), false);
    assert.equal(a.w.document.getElementById('storageWarningReconnect').hidden, false);
    a.api.setReconnect(async () => { cloud.attach(a); });
    await a.w.document.getElementById('storageWarningReconnect').onclick();
    assert.equal(a.api.state.activeId, 'bible'); assert.match(a.api.state.documents[1].content, /World history/);
  } finally { a.close(); }
});

test('a pending reconnect survives browser autosave and never dismisses a newer warning', async () => {
  const a = app(); const cloud = fakeDropbox();
  try {
    await a.api.boot(); seedLibrary(a); cloud.attach(a); await a.api.syncDropboxProject();
    a.api.setConnection({ accountId: 'account', token: 'expired', expiresAt: 0 }); await a.api.openDocument('bible');
    let release; const gate = new Promise(resolve => { release = resolve; });
    a.api.setReconnect(async () => { await gate; cloud.attach(a); });
    const reconnect = a.w.document.getElementById('storageWarningReconnect').onclick();
    await a.api.writeWorkspaceSnapshot();
    assert.equal(a.w.document.getElementById('storageWarning').hidden, false);
    a.api.showStorageWarning('A newer storage error needs attention.');
    release(); await reconnect;
    assert.equal(a.w.document.getElementById('storageWarning').hidden, false);
    assert.equal(a.w.document.getElementById('storageWarningMessage').textContent, 'A newer storage error needs attention.');
    assert.equal(a.api.state.activeId, 'original');
  } finally { a.close(); }
});
