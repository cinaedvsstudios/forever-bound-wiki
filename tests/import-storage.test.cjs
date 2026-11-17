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
  const navigation = fs.readFileSync(path.join(root, 'document-navigation.js'), 'utf8');
  const cloud = fs.readFileSync(path.join(root, 'dropbox-storage.js'), 'utf8');
  w.eval(setup + '\n' + cloud + '\n' + markdown + '\n' + navigation + '\n' + core + '\nwindow.testApp = { startWritingRoomResize, moveWritingRoomResize, stopWritingRoomResize, handleWritingRoomResizeKey, documentOutline, jumpToDocumentOutline, fillDocumentOutline, calculateRoomLayout, renderWritingRoomCards, updateRoomWorkspaceLayout, toggleWritingRoomPanel, applyDesignSettings, collectDesignSettingsFromForm, saveDesignSettings, applyExtraDesignSettings, currentDesignSettings, buildMarkdownArchive, openProjectSetup, advanceProjectSetup, readGoogleDocsSource, renderDropboxStorage, setSetupSource: (source) => { setupSession.source = source; setupSession.selected = new Set(source.tabs.map(t => t.id)); }, state, els, boot, loadWorkspace, serializedWorkspace, writeWorkspaceSnapshot, readWorkspaceSnapshot, workspaceRecord, persistNow, safeDocumentHtml, googleDocsToImportSource, commitProjectImport, readImportFile, importProjectBackupPayload, folderModeProjectPayload, capsMarkdownToDocument, prepareProjectReplacement, saveFolderModeSnapshot, syncDropboxProject, openWritingRoomFolder, projectCloudFingerprint, setConnection: (value) => { dropboxConnection = value; }, getRevision: () => workspaceRevision };');
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
  try { await a.api.loadWorkspace(); await a.api.writeWorkspaceSnapshot(); const saved = JSON.parse((await a.api.workspaceRecord('active')).json); assert.equal(saved.documents[0].content, legacy.documents[0].content); assert.equal(saved.projectId, 'legacy'); }
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
    assert.match(a.api.state.documents.find((d) => d.id === 'original').content, /Keep this draft/);
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
test('Dropbox upload uses revision checks and keeps the local copy on a conflict', async () => {
  const a = app(); seed(a.api);
  try {
    a.api.setConnection({ token: 'test-only', accountId: 'account', expiresAt: Date.now() + 60000 });
    await a.api.workspaceRecord('dropbox-binding:account:project-original', { path: '/project.caps.json', rev: 'known-revision' });
    let upload;
    a.w.fetch = async (url, options) => { upload = options; return { ok: false, status: 409 }; };
    await assert.rejects(a.api.syncDropboxProject(), /another version/);
    const args = JSON.parse(upload.headers['Dropbox-API-Arg']);
    assert.equal(args.mode.update, 'known-revision'); assert.equal(args.strict_conflict, true); assert.equal(args.autorename, false);
    assert.match((await a.api.workspaceRecord('active')).json, /Keep this draft/);
  } finally { a.close(); }
});
test('all entry pages wire the same setup and storage runtime', () => {
  for (const file of ['index.html', 'editor.html', 'writing-room.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(html, /project-setup.js\?v=5.11.2/); assert.match(html, /dropbox-storage.js/);
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
    a.api.jumpToDocumentOutline('jump-target', 1);
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
