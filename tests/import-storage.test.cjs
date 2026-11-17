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
  Object.assign(w, { indexedDB, TextEncoder, TextDecoder, fetch: async () => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, 'content/documents.json'), 'utf8')) }), DOMPurify: createPurifier(w), mammoth: require('mammoth') });
  w.HTMLDialogElement.prototype.showModal ||= function () { this.open = true; };
  w.HTMLDialogElement.prototype.close ||= function () { this.open = false; };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  if (legacy !== undefined) w.localStorage.setItem('forever-bound-writing-room-v2', legacy);
  const core = fs.readFileSync(path.join(root, 'app.core.js'), 'utf8').replace(/boot\(\)\.catch\([\s\S]*?\n\}\);/, '');
  const setup = fs.readFileSync(path.join(root, 'project-setup.js'), 'utf8');
  const cloud = fs.readFileSync(path.join(root, 'dropbox-storage.js'), 'utf8');
  w.eval(setup + '\n' + cloud + '\n' + core + '\nwindow.testApp = { state, els, boot, loadWorkspace, serializedWorkspace, writeWorkspaceSnapshot, readWorkspaceSnapshot, workspaceRecord, persistNow, safeDocumentHtml, googleDocsToImportSource, commitProjectImport, readImportFile, importProjectBackupPayload, folderModeProjectPayload, capsMarkdownToDocument, prepareProjectReplacement, saveFolderModeSnapshot, syncDropboxProject, openWritingRoomFolder, projectCloudFingerprint, setConnection: (value) => { dropboxConnection = value; }, getRevision: () => workspaceRevision };');
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
    assert.match(html, /project-setup.js\?v=5.11.0/); assert.match(html, /dropbox-storage.js/);
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
