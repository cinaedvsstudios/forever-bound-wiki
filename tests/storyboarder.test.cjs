const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');
const { webcrypto } = require('node:crypto');
const JSZip = require('jszip');
const parser = require('../modules/storyboarder/script-import.js');
const root = path.resolve(__dirname, '../modules/storyboarder');

function transfer(markdown = '# Act 1\n## Scene 1a: Arrival\nEXT. FOREST — NIGHT\nCHARACTERS: Mel, Luca\nHello world.\n## Scene 2: Return\nINT. HOME — DAY\nGoodbye.', id = 'act-one') {
  return { type: 'capsanoto-storyboard-transfer', version: 1, project: { id: 'writing-project', name: 'Forever Bound' }, episode: { key: 'pilot', title: 'Pilot', number: '1' }, document: { id, title: 'Act 1', markdown } };
}
function app({ db = new IDBFactory(), legacy } = {}) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'https://example.test/modules/storyboarder/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  Object.assign(w, { indexedDB: db, TextEncoder, TextDecoder, structuredClone, Blob, JSZip, confirm: () => true });
  Object.defineProperty(w, 'crypto', { value: webcrypto });
  w.URL.createObjectURL = () => 'blob:test'; w.URL.revokeObjectURL = () => {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLAnchorElement.prototype.click = function () {};
  if (legacy !== undefined) w.localStorage.setItem('capsanoto-storyboarder-v5-autosave', legacy);
  w.eval(fs.readFileSync(path.join(root, 'storage.js'), 'utf8').replace('  return { read, save,', '  window.savedEpisodeHashesForTest = writtenHashes; return { read, save,'));
  w.eval(fs.readFileSync(path.join(root, 'script-import.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(root, 'backup-history.js'), 'utf8'));
  let code = fs.readFileSync(path.join(root, 'storyboarder.js'), 'utf8');
  const end = code.lastIndexOf('  boot().catch(');
  code = code.slice(0, end) + 'window.story = { state, clearBrowserDraft, newProject, openProductionFolder, removeMedia, persist, receiveCapsanotoDocument, activeEpisode, activeEntry, buildProductionFiles, saveChangedFiles, importProjectFile, loadActiveEpisode, switchEpisode, createNewEpisode, addMediaFiles, normalizeEpisode, normalizeProjectEnvelope }; window.ready = boot();\n})();';
  w.eval(code);
  return { w, api: w.story, ready: w.ready, close: () => dom.window.close() };
}
async function send(a, data, token = 'test-transfer-token-0000000001') {
  await a.w.StoryboardStore.record(`storyboarder-handoff:${token}`, data, 'capsanoto-workspaces-v1');
  await a.api.receiveCapsanotoDocument(token);
}

function memoryFolder() {
  const files = new Map(); const directories = new Set(['']); const writes = [];
  let clock = 1700000000000;
  const fs = { files, writes, removed: [], beforeWrite: null, beforeClose: null, beforeRemove: null, directory: null };
  const missing = () => Object.assign(new Error('File not found'), { name: 'NotFoundError' });
  function directory(prefix = '') {
    return {
      kind: 'directory', name: prefix.split('/').filter(Boolean).at(-1) || 'Backup',
      requestPermission: async () => 'granted',
      async getDirectoryHandle(name, { create = false } = {}) {
        const next = prefix + name + '/';
        if (!directories.has(next)) { if (!create) throw missing(); directories.add(next); }
        return directory(next);
      },
      async getFileHandle(name, { create = false } = {}) {
        const path = prefix + name;
        if (!files.has(path)) { if (!create) throw missing(); files.set(path, new File([], name, { lastModified: ++clock })); }
        return {
          kind: 'file', name,
          getFile: async () => { if (!files.has(path)) throw missing(); return files.get(path); },
          async createWritable() {
            let pending;
            return {
              async write(contents) { if (fs.beforeWrite) await fs.beforeWrite(path, contents); pending = contents; },
              async close() { if (fs.beforeClose) await fs.beforeClose(path, pending); files.set(path, new File([pending], name, { lastModified: ++clock })); writes.push({ path, text: typeof pending === 'string' ? pending : null }); },
              async abort() { pending = undefined; }
            };
          }
        };
      },
      async removeEntry(name) { const path = prefix + name; if (fs.beforeRemove) await fs.beforeRemove(path); if (!files.has(path)) throw missing(); files.delete(path); fs.removed.push(path); },
      async *values() {
        for (const path of files.keys()) if (path.startsWith(prefix) && !path.slice(prefix.length).includes('/')) yield await this.getFileHandle(path.slice(prefix.length));
      }
    };
  }
  fs.directory = directory(); return fs;
}
function mountFolder(a, folder) {
  a.api.state.folderHandle = folder.directory;
  const record = a.w.StoryboardStore.record;
  // Native browser directory handles are cloneable; this in-memory test handle is not.
  a.w.StoryboardStore.record = (key, value, db) => key.startsWith('folder:') && value?.getDirectoryHandle ? Promise.resolve(value) : record(key, value, db);
}

test('script breakdown preserves scenes, letters, slug lines and full source text', () => {
  const data = parser.parse(transfer()); const scenes = data.acts[1].scenes;
  assert.equal(scenes.length, 2); assert.equal(scenes[0].sceneLetter, 'A');
  assert.equal(scenes[0].location, 'FOREST'); assert.equal(scenes[0].timeOfDay, 'NIGHT');
  assert.deepEqual(scenes[0].characters, ['Mel', 'Luca']);
  assert.match(scenes[0].scriptExcerpt, /Hello world/);
  assert.match(data.sources['act-one'].markdown, /Goodbye/);
});

test('re-sending a changed script preserves production work and retains removed scenes', () => {
  const old = parser.parse(transfer()); const scene = old.acts[1].scenes[0];
  scene.notes = 'Keep this shot'; scene.status = 'Final'; scene.media.images.push({ id: 'image-one' });
  const next = parser.merge(old, parser.parse(transfer('# Act 1\n## Scene 1a: New title\nEXT. FOREST — NIGHT\nChanged script.')));
  const updated = next.acts[1].scenes.find(item => item.sceneNumber === '1');
  assert.equal(updated.notes, 'Keep this shot'); assert.equal(updated.status, 'Final');
  assert.equal(updated.media.images[0].id, 'image-one'); assert.match(updated.scriptExcerpt, /Changed/);
  assert.equal(next.acts[1].scenes.find(item => item.sceneNumber === '2').sourceRemoved, true);
});

test('a scene containing multiple locations is not split into duplicate numbered scenes', () => {
  const result = parser.parse(transfer('# Act 1\n## Scene 1: Chase\nEXT. FOREST — DAY\nRun.\nINT. HOUSE — DAY\nHide.'));
  assert.equal(result.acts[1].scenes.length, 1);
  assert.match(result.acts[1].scenes[0].scriptExcerpt, /Hide/);
});

test('Capsanoto handoff creates production cards and survives a browser restart', async () => {
  const db = new IDBFactory(); const a = app({ db });
  try {
    await a.ready; await send(a, transfer());
    assert.equal(a.api.state.project.projectName, 'Forever Bound');
    assert.equal(a.api.activeEpisode().acts[1].scenes.length, 2);
    const b = app({ db });
    try { await b.ready; assert.match(b.api.state.scriptText, /Hello world/); assert.equal(b.api.activeEpisode().acts[1].scenes.length, 2); }
    finally { b.close(); }
  } finally { a.close(); }
});

test('handoff updates do not duplicate an episode or discard notes and media', async () => {
  const a = app();
  try {
    await a.ready; await send(a, transfer());
    a.api.activeEpisode().acts[1].scenes[0].notes = 'Production note'; await a.api.persist();
    await send(a, transfer('# Act 1\n## Scene 1a: Arrival\nEXT. FOREST — NIGHT\nRevised.'), 'test-transfer-token-0000000002');
    assert.equal(a.api.state.project.episodes.length, 1);
    assert.equal(a.api.activeEpisode().acts[1].scenes.find(scene => scene.sceneNumber === '1').notes, 'Production note');
    assert.equal(await a.w.StoryboardStore.handoff('test-transfer-token-0000000002'), null);
  } finally { a.close(); }
});

test('Save assembles the linked index, episode JSON, scripts and attached media', async () => {
  const a = app();
  try {
    await a.ready; await send(a, transfer());
    const scene = a.api.activeEpisode().acts[1].scenes[0];
    await a.api.addMediaFiles(scene, [new File(['image bytes'], 'frame.png', { type: 'image/png' })]);
    const built = await a.api.buildProductionFiles();
    assert.equal(built.files.at(-1).path, 'storyboarder.project.json');
    assert.ok(built.files.some(file => file.path.startsWith('scripts/')));
    assert.ok(built.files.some(file => file.path.startsWith('assets/')));
    assert.ok(built.files.some(file => file.path.endsWith('.storyboarder.json')));
    assert.equal(built.missingAssets.length, 0);
    await a.api.saveChangedFiles(); // browser fallback produces a portable ZIP
    assert.match(a.w.document.getElementById('toast').textContent, /ZIP downloaded/);
  } finally { a.close(); }
});

test('media bytes remain available after refresh rather than relying on old blob URLs', async () => {
  const db = new IDBFactory(); const a = app({ db });
  try {
    await a.ready; await send(a, transfer());
    await a.api.addMediaFiles(a.api.activeEpisode().acts[1].scenes[0], [new File(['voice'], 'voice.wav')]); await a.api.persist();
    const b = app({ db });
    try { await b.ready; assert.equal(b.api.state.mediaRuntime.size, 1); }
    finally { b.close(); }
  } finally { a.close(); }
});

test('unreadable legacy drafts are preserved and never replaced by starter data', async () => {
  const a = app({ legacy: '{broken original' });
  try {
    await a.ready; assert.equal(a.api.state.storageBlocked, true);
    assert.equal(await a.api.persist(), false);
    assert.equal(a.w.localStorage.getItem('capsanoto-storyboarder-v5-autosave'), '{broken original');
    assert.equal(await a.w.StoryboardStore.read(), undefined);
  } finally { a.close(); }
});

test('two Storyboarder tabs cannot silently overwrite the same saved project', async () => {
  const db = new IDBFactory(); const a = app({ db });
  try {
    await a.ready; await send(a, transfer());
    const b = app({ db });
    try {
      await b.ready;
      a.api.activeEpisode().acts[1].scenes[0].notes = 'Newer note'; assert.equal(await a.api.persist(), true);
      b.api.activeEpisode().acts[1].scenes[0].notes = 'Stale note'; assert.equal(await b.api.persist(), false);
      assert.equal((await a.w.StoryboardStore.episode(a.api.state.project.projectId, a.api.state.activeEpisodeId)).acts[1].scenes[0].notes, 'Newer note');
    } finally { b.close(); }
  } finally { a.close(); }
});

test('portable Storyboarder ZIP round-trips scripts, notes and media into an independent restored project', async () => {
  const a = app();
  try {
    await a.ready; await send(a, transfer());
    const originalId = a.api.state.project.projectId;
    const scene = a.api.activeEpisode().acts[1].scenes[0]; scene.notes = 'Production note to restore';
    await a.api.addMediaFiles(scene, [new File(['frame bytes'], 'frame.png')]);
    const built = await a.api.buildProductionFiles(); const zip = new JSZip();
    for (const file of built.files) zip.file(file.path, typeof file.contents === 'string' ? file.contents : await file.contents.arrayBuffer());
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    await a.api.importProjectFile({ name: 'Production.zip', arrayBuffer: async () => bytes });
    assert.notEqual(a.api.state.project.projectId, originalId);
    assert.match(a.api.state.scriptText, /Hello world/);
    assert.equal(a.api.activeEpisode().acts[1].scenes[0].notes, 'Production note to restore');
    assert.equal(a.api.state.mediaRuntime.size, 1);
    assert.equal(await a.api.persist(), true);
  } finally { a.close(); }
});

test('production Save includes every edited episode and writes the project index last', async () => {
  const a = app();
  try {
    await a.ready; await send(a, transfer());
    await send(a, { ...transfer('# Act 2\n## Scene 3: Second episode\nHello.', 'episode-two'), episode: { key: 'episode-two', title: 'Episode Two', number: '2' } }, 'test-transfer-token-0000000003');
    const folder = memoryFolder(); mountFolder(a, folder);
    const writes = folder.writes;
    await a.api.saveChangedFiles();
    assert.equal(writes.filter(file => file.path.endsWith('.storyboarder.json')).length, 2);
    assert.equal(writes.at(-1).path, 'storyboarder.project.json');
    assert.equal(JSON.parse(writes.at(-1).text).episodes.length, 2);
    assert.ok(writes.some(file => file.path.startsWith('scripts/')));
  } finally { a.close(); }
});

test('an interrupted folder backup preserves every file referenced by the last good index and can retry', async () => {
  const a = app(); const folder = memoryFolder();
  try {
    await a.ready; await send(a, transfer());
    await send(a, { ...transfer('# Act 2\n## Scene 3: Other\nOld second.', 'second'), episode: { key: 'second', title: 'Second', number: '2' } }, 'test-transfer-token-0000000003');
    mountFolder(a, folder); await a.api.saveChangedFiles();
    const original = await folder.files.get('storyboarder.project.json').text(); const index = JSON.parse(original);
    const priorFiles = new Map(await Promise.all(Object.keys(index.fileHashes).map(async path => [path, Buffer.from(await folder.files.get(path).arrayBuffer())])));
    await a.api.switchEpisode(a.api.state.project.episodes[0].episodeId);
    a.api.state.project.episodes[0].data.acts[1].scenes[0].notes = 'New first notes';
    await a.api.switchEpisode(a.api.state.project.episodes[1].episodeId);
    a.api.state.project.episodes[1].data.acts[2].scenes[0].notes = 'New second notes';
    let episodes = 0;
    folder.beforeWrite = path => { if (path.endsWith('.storyboarder.json') && ++episodes === 2) throw new Error('Interrupted episode write'); };
    await assert.rejects(a.api.saveChangedFiles(), /Interrupted episode/);
    assert.equal(await folder.files.get('storyboarder.project.json').text(), original);
    for (const [path, bytes] of priorFiles) assert.deepEqual(Buffer.from(await folder.files.get(path).arrayBuffer()), bytes);
    assert.equal(a.api.state.dirty, true); assert.equal(a.api.state.backupInProgress, false);
    folder.beforeWrite = null; await a.api.saveChangedFiles();
    const latest = JSON.parse(await folder.files.get('storyboarder.project.json').text());
    assert.notEqual(latest.episodes[0].fileName, index.episodes[0].fileName);
    assert.match(await folder.files.get(latest.episodes[0].fileName).text(), /New first notes/);
    assert.match(await folder.files.get(latest.episodes[1].fileName).text(), /New second notes/);
    assert.ok([...folder.files.keys()].filter(path => path.startsWith('backups/')).length >= 2);
  } finally { a.close(); }
});

test('a folder backup uses one captured revision and newer edits remain dirty and browser-saved', async () => {
  const a = app(); const folder = memoryFolder();
  try {
    await a.ready; await send(a, transfer()); mountFolder(a, folder);
    const scene = a.api.activeEpisode().acts[1].scenes[0]; scene.notes = 'Captured notes';
    let release; let started;
    const gate = new Promise(resolve => { release = resolve; }); const entered = new Promise(resolve => { started = resolve; });
    folder.beforeWrite = async path => { if (path.endsWith('.storyboarder.json')) { folder.beforeWrite = null; started(); await gate; } };
    const backup = a.api.saveChangedFiles(); await entered;
    assert.equal(a.w.document.getElementById('btnSave').disabled, true);
    const projectId = a.api.state.project.projectId;
    a.api.newProject(); assert.equal(a.api.state.project.projectId, projectId);
    assert.equal(await a.api.clearBrowserDraft(), false);
    scene.notes = 'Typed while backup was writing';
    release(); await backup;
    const index = JSON.parse(await folder.files.get('storyboarder.project.json').text());
    assert.match(await folder.files.get(index.episodes[0].fileName).text(), /Captured notes/);
    assert.doesNotMatch(await folder.files.get(index.episodes[0].fileName).text(), /Typed while backup/);
    assert.equal(a.api.state.dirty, true);
    const stored = await a.w.StoryboardStore.episode(projectId, a.api.state.activeEpisodeId);
    assert.equal(stored.acts[1].scenes[0].notes, 'Typed while backup was writing');
    assert.match(a.w.document.getElementById('toast').textContent, /Newer edits/);
    assert.equal(a.w.document.getElementById('btnSave').disabled, false);
  } finally { a.close(); }
});

test('a failed final index commit leaves the previous backup intact and folder opening can recover a complete snapshot', async () => {
  const a = app(); const b = app(); const folder = memoryFolder();
  try {
    await a.ready; await b.ready; await send(a, transfer()); mountFolder(a, folder); await a.api.saveChangedFiles();
    const old = await folder.files.get('storyboarder.project.json').text();
    a.api.activeEpisode().acts[1].scenes[0].notes = 'Recoverable newer notes';
    folder.beforeClose = path => { if (path === 'storyboarder.project.json') throw new Error('Commit interrupted'); };
    await assert.rejects(a.api.saveChangedFiles(), /Commit interrupted/);
    assert.equal(await folder.files.get('storyboarder.project.json').text(), old);
    folder.files.set('storyboarder.project.json', new File(['{damaged pointer'], 'storyboarder.project.json'));
    b.w.showDirectoryPicker = async () => folder.directory;
    await b.api.openProductionFolder();
    assert.equal(b.api.activeEpisode().acts[1].scenes[0].notes, 'Recoverable newer notes');
    assert.equal(b.api.state.folderHandle, null);
    assert.notEqual(b.api.state.project.projectId, a.api.state.project.projectId);
    assert.match(b.w.document.getElementById('toast').textContent, /Recovered a complete backup/);
  } finally { a.close(); b.close(); }
});

test('corrupted checksummed ZIP media is rejected before replacing the project', async () => {
  const a = app();
  try {
    await a.ready; await send(a, transfer());
    await a.api.addMediaFiles(a.api.activeEpisode().acts[1].scenes[0], [new File(['Correct frame bytes'], 'frame.png', { type: 'image/png' })]);
    const original = a.api.state.project;
    const built = await a.api.buildProductionFiles(); const zip = new JSZip();
    for (const file of built.files) zip.file(file.path, typeof file.contents === 'string' ? file.contents : await file.contents.arrayBuffer());
    zip.file(built.files.find(file => file.path.startsWith('assets/')).path, 'Damaged image bytes');
    await a.api.importProjectFile({ name: 'Damaged.zip', arrayBuffer: () => zip.generateAsync({ type: 'uint8array' }) });
    assert.equal(a.api.state.project, original);
    assert.match(a.w.document.getElementById('toast').textContent, /integrity check/);
  } finally { a.close(); }
});

test('Clear Draft removes only that browser project and detaches its folder without stale-tab resurrection', async () => {
  const db = new IDBFactory(); const a = app({ db }); let b;
  try {
    await a.ready; await send(a, transfer());
    const projectId = a.api.state.project.projectId;
    await a.api.addMediaFiles(a.api.activeEpisode().acts[1].scenes[0], [new File(['Frame'], 'frame.png')]);
    await a.api.persist(); const mediaId = a.api.activeEpisode().acts[1].scenes[0].media.images[0].id;
    await a.w.StoryboardStore.record(`folder:${projectId}`, { name: 'Previous backup folder' });
    await a.w.StoryboardStore.asset('other-media', new Blob(['Other project media']), 'other-project');
    b = app({ db }); await b.ready;
    a.api.state.folderHandle = memoryFolder().directory;
    assert.equal(await a.api.clearBrowserDraft(), true);
    assert.equal(a.api.state.folderHandle, null); assert.equal(a.api.state.scriptText, '');
    assert.equal(await a.w.StoryboardStore.asset(mediaId, undefined, projectId), undefined);
    assert.equal(await a.w.StoryboardStore.episode(projectId, b.api.state.activeEpisodeId), undefined);
    assert.equal(await a.w.StoryboardStore.record(`folder:${projectId}`), undefined);
    assert.ok(await a.w.StoryboardStore.asset('other-media', undefined, 'other-project'));
    b.api.activeEpisode().acts[1].scenes[0].notes = 'Stale tab tries to restore cleared work';
    assert.equal(await b.api.persist(), false);
    const tombstone = await a.w.StoryboardStore.read(projectId);
    assert.equal(tombstone.deleted, true); assert.equal(tombstone.project, undefined);
    await send(a, transfer(), 'test-transfer-token-0000000004');
    assert.equal(a.api.state.project.projectId, projectId);
    assert.equal(await a.api.persist(), true);
    assert.equal(await b.api.persist(), false);
  } finally { a.close(); b?.close(); }
});

test('cancelling Clear Draft and a stale-tab clear both preserve newer browser data', async () => {
  const db = new IDBFactory(); const a = app({ db }); let b;
  try {
    await a.ready; await send(a, transfer());
    const projectId = a.api.state.project.projectId;
    a.w.confirm = () => false; assert.equal(await a.api.clearBrowserDraft(), false);
    assert.ok((await a.w.StoryboardStore.read(projectId)).project);
    b = app({ db }); await b.ready;
    a.api.activeEpisode().acts[1].scenes[0].notes = 'Newer saved notes'; await a.api.persist();
    assert.equal(await b.api.clearBrowserDraft(), false);
    assert.equal((await a.w.StoryboardStore.episode(projectId, a.api.state.activeEpisodeId)).acts[1].scenes[0].notes, 'Newer saved notes');
  } finally { a.close(); b?.close(); }
});

test('the folder picker opens directly from Save and a folder belonging to another project is preserved', async () => {
  const a = app(); const folder = memoryFolder();
  try {
    await a.ready; await send(a, transfer());
    const foreign = JSON.stringify({ projectId: 'different-project', episodes: [] });
    folder.files.set('storyboarder.project.json', new File([foreign], 'storyboarder.project.json'));
    let called = false; a.w.showDirectoryPicker = () => { called = true; return Promise.resolve(folder.directory); };
    const backup = a.api.saveChangedFiles(); assert.equal(called, true);
    await assert.rejects(backup, /belongs to another/);
    assert.equal(await folder.files.get('storyboarder.project.json').text(), foreign);
    assert.equal(folder.writes.length, 0); assert.equal(a.api.state.folderHandle, null);
  } finally { a.close(); }
});

test('building a backup does not load inactive episodes into the live editor or trust an unsafe desktop bridge', async () => {
  const db = new IDBFactory(); const a = app({ db }); let b;
  try {
    await a.ready; await send(a, transfer());
    await send(a, { ...transfer('# Act 2\n## Scene 4: Two\nSource.', 'second'), episode: { key: 'second', title: 'Second', number: '2' } }, 'test-transfer-token-0000000003');
    b = app({ db }); await b.ready;
    assert.equal(b.api.state.project.episodes[0].data, null);
    const built = await b.api.buildProductionFiles(); assert.equal(built.manifest.episodes.length, 2);
    assert.equal(b.api.state.project.episodes[0].data, null);
    let unsafeWrites = 0; b.w.capsanotoHddApi = { writeTextFile: async () => { unsafeWrites++; } };
    await b.api.saveChangedFiles(); assert.equal(unsafeWrites, 0);
    assert.match(b.w.document.getElementById('toast').textContent, /ZIP downloaded/);
  } finally { a.close(); b?.close(); }
});

test('a stale loaded draft can be rescued as a ZIP without replacing a newer folder backup', async () => {
  const db = new IDBFactory(); const a = app({ db }); let b; const folder = memoryFolder();
  try {
    await a.ready; await send(a, transfer()); b = app({ db }); await b.ready;
    mountFolder(a, folder); await a.api.saveChangedFiles();
    const index = await folder.files.get('storyboarder.project.json').text();
    b.api.activeEpisode().acts[1].scenes[0].notes = 'Stale draft worth rescuing'; mountFolder(b, folder);
    const writesBefore = folder.writes.length;
    assert.equal(await b.api.saveChangedFiles(), true);
    assert.equal(folder.writes.length, writesBefore);
    assert.equal(await folder.files.get('storyboarder.project.json').text(), index);
    assert.match(b.w.document.getElementById('toast').textContent, /independent copy of a stale/);
    assert.equal(b.api.state.dirty, true);
  } finally { a.close(); b?.close(); }
});

test('older portable backups remain importable alongside checksummed backups', async () => {
  const a = app();
  try {
    await a.ready;
    const data = parser.parse(transfer()); data.acts[1].scenes[0].notes = 'Legacy backup notes';
    const zip = new JSZip();
    zip.file('storyboarder.project.json', JSON.stringify({ projectId: 'legacy-original', episodes: [{ episodeId: 'old-episode', episodeNumber: '1', episodeTitle: 'Legacy', fileName: 'episode-01.json' }] }));
    zip.file('episode-01.json', JSON.stringify(data));
    await a.api.importProjectFile({ name: 'Older.zip', arrayBuffer: () => zip.generateAsync({ type: 'uint8array' }) });
    assert.equal(a.api.activeEpisode().acts[1].scenes[0].notes, 'Legacy backup notes');
    assert.notEqual(a.api.state.project.projectId, 'legacy-original');
  } finally { a.close(); }
});

test('a folder changed by another writer during saving is never replaced', async () => {
  const a = app(); const folder = memoryFolder();
  try {
    await a.ready; await send(a, transfer()); mountFolder(a, folder); await a.api.saveChangedFiles();
    const otherIndex = JSON.parse(await folder.files.get('storyboarder.project.json').text()); otherIndex.projectName = 'Changed by another writer';
    const text = JSON.stringify(otherIndex);
    a.api.activeEpisode().acts[1].scenes[0].notes = 'Local newer notes';
    folder.beforeWrite = path => { if (path.endsWith('.storyboarder.json')) { folder.beforeWrite = null; folder.files.set('storyboarder.project.json', new File([text], 'storyboarder.project.json')); } };
    await assert.rejects(a.api.saveChangedFiles(), /folder backup changed/);
    assert.equal(await folder.files.get('storyboarder.project.json').text(), text);
    assert.equal(a.api.state.dirty, true);
  } finally { a.close(); }
});

async function testFileHash(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : await value.arrayBuffer();
  return Buffer.from(await webcrypto.subtle.digest('SHA-256', bytes)).toString('hex');
}
async function pruneTestFolder(a, folder, limit) {
  const text = await folder.files.get('storyboarder.project.json').text();
  return a.w.StoryboardBackupHistory.prune(folder.directory, {
    projectId: JSON.parse(text).projectId, currentText: text, limit, hash: testFileHash,
    read: async path => { const file = folder.files.get(path); if (!file) throw Object.assign(new Error('Not found'), { name: 'NotFoundError' }); return file; }
  });
}

test('a returned source scene clears its removed flag while preserving current unsaved production work', async () => {
  const a = app();
  try {
    await a.ready; await send(a, transfer());
    await send(a, transfer('# Act 1\n## Scene 2: Return\nINT. HOME — DAY\nOnly this scene.'), 'test-transfer-token-0000000003');
    const removed = a.api.activeEpisode().acts[1].scenes.find(scene => scene.sceneNumber === '1');
    assert.equal(removed.sourceRemoved, true); removed.notes = 'Unsaved production note to preserve'; removed.status = 'Final';
    await send(a, transfer(), 'test-transfer-token-0000000004');
    const restored = a.api.activeEpisode().acts[1].scenes.find(scene => scene.sceneNumber === '1');
    assert.equal(restored.sourceRemoved, false); assert.equal(restored.notes, 'Unsaved production note to preserve'); assert.equal(restored.status, 'Final');
    assert.equal(a.api.activeEpisode().acts[1].scenes.filter(scene => scene.sceneNumber === '1').length, 1);
  } finally { a.close(); }
});

test('unused attachments are collected after a successful save while other projects and pending imports remain protected', async () => {
  const a = app();
  try {
    await a.ready; await send(a, transfer()); const projectId = a.api.state.project.projectId;
    await a.api.addMediaFiles(a.api.activeEpisode().acts[1].scenes[0], [new File(['Used image'], 'frame.png')]); await a.api.persist();
    const id = a.api.activeEpisode().acts[1].scenes[0].media.images[0].id;
    await a.w.StoryboardStore.asset('pending-image', new Blob(['Pending bytes']), projectId);
    await a.w.StoryboardStore.asset('other-image', new Blob(['Other bytes']), 'other-project');
    a.api.removeMedia(a.api.activeEpisode().acts[1].scenes[0], id); await a.api.persist();
    assert.equal(await a.w.StoryboardStore.asset(id, undefined, projectId), undefined);
    assert.ok(await a.w.StoryboardStore.asset('pending-image', undefined, projectId));
    assert.ok(await a.w.StoryboardStore.asset('other-image', undefined, 'other-project'));
    await a.w.StoryboardStore.discardStagedAsset('pending-image', projectId); await a.api.persist();
    assert.equal(await a.w.StoryboardStore.asset('pending-image', undefined, projectId), undefined);
  } finally { a.close(); }
});

test('garbage collection reads inactive saved links and retains a shared image until its final link is removed', async () => {
  const a = app();
  try {
    await a.ready; await send(a, transfer()); const projectId = a.api.state.project.projectId;
    await a.api.addMediaFiles(a.api.activeEpisode().acts[1].scenes[0], [new File(['Shared image'], 'shared.png')]); await a.api.persist();
    const media = structuredClone(a.api.activeEpisode().acts[1].scenes[0].media.images[0]);
    await send(a, { ...transfer('# Act 2\n## Scene 3: Other\nText.', 'other'), episode: { key: 'other', title: 'Other', number: '2' } }, 'test-transfer-token-0000000003');
    a.api.activeEpisode().acts[2].scenes[0].media.images.push(media); await a.api.persist();
    await a.api.switchEpisode(a.api.state.project.episodes[0].episodeId);
    a.api.removeMedia(a.api.activeEpisode().acts[1].scenes[0], media.id); await a.api.persist();
    assert.equal(a.api.state.project.episodes[1].data, null);
    assert.ok(await a.w.StoryboardStore.asset(media.id, undefined, projectId));
    await a.api.switchEpisode(a.api.state.project.episodes[1].episodeId);
    a.api.removeMedia(a.api.activeEpisode().acts[2].scenes[0], media.id); await a.api.persist();
    assert.equal(await a.w.StoryboardStore.asset(media.id, undefined, projectId), undefined);
  } finally { a.close(); }
});

test('an attachment staged during autosave survives until its scene link commits', async () => {
  const a = app();
  try {
    await a.ready; await send(a, transfer()); const original = a.w.StoryboardStore.asset;
    a.w.StoryboardStore.asset = async (id, file, projectId) => {
      const result = await original(id, file, projectId);
      if (file) { await a.api.persist(); assert.ok(await original(id, undefined, projectId)); }
      return result;
    };
    await a.api.addMediaFiles(a.api.activeEpisode().acts[1].scenes[0], [new File(['Pending upload'], 'pending.png')]); await a.api.persist();
    const id = a.api.activeEpisode().acts[1].scenes[0].media.images[0].id;
    assert.ok(await original(id, undefined, a.api.state.project.projectId));
    assert.equal(await a.w.StoryboardStore.record(`asset-staging:${a.api.state.project.projectId}:${id}`), undefined);
  } finally { a.close(); }
});

test('a stale failed save cannot garbage-collect media referenced by the newer saved project', async () => {
  const db = new IDBFactory(); const a = app({ db }); let b;
  try {
    await a.ready; await send(a, transfer());
    await a.api.addMediaFiles(a.api.activeEpisode().acts[1].scenes[0], [new File(['Frame'], 'frame.png')]); await a.api.persist();
    const projectId = a.api.state.project.projectId; const id = a.api.activeEpisode().acts[1].scenes[0].media.images[0].id;
    b = app({ db }); await b.ready;
    a.api.activeEpisode().acts[1].scenes[0].notes = 'Newer saved scene'; await a.api.persist();
    b.api.removeMedia(b.api.activeEpisode().acts[1].scenes[0], id); assert.equal(await b.api.persist(), false);
    assert.ok(await a.w.StoryboardStore.asset(id, undefined, projectId));
    assert.equal((await a.w.StoryboardStore.episode(projectId, a.api.state.activeEpisodeId)).acts[1].scenes[0].media.images[0].id, id);
  } finally { a.close(); b?.close(); }
});

test('episode navigation releases saved inactive bodies and retains only small hash cache values', async () => {
  const a = app();
  try {
    await a.ready; await send(a, transfer());
    const first = a.api.state.activeEpisodeId;
    await send(a, { ...transfer('# Act 2\n## Scene 3: Other\nOther source.', 'other'), episode: { key: 'other', title: 'Other', number: '2' } }, 'test-transfer-token-0000000003');
    const second = a.api.state.activeEpisodeId;
    for (let visit = 0; visit < 4; visit++) {
      await a.api.switchEpisode(first); assert.match(a.api.state.scriptText, /Hello world/);
      assert.equal(a.api.state.project.episodes.filter(entry => entry.data).length, 1);
      await a.api.switchEpisode(second); assert.match(a.api.state.scriptText, /Other source/);
      assert.equal(a.api.state.project.episodes.filter(entry => entry.data).length, 1);
    }
    assert.ok([...a.w.savedEpisodeHashesForTest.values()].every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)));
    const record = await a.w.StoryboardStore.read();
    assert.ok(record.project.episodes.every(entry => !entry.data && /^[a-f0-9]{64}$/.test(entry.contentHash) && Array.isArray(entry.assetIds)));
  } finally { a.close(); }
});

test('an inactive body changed during a pending save is not released until its newer version saves', async () => {
  const a = app();
  try {
    await a.ready; await send(a, transfer()); const first = a.api.activeEntry();
    a.api.createNewEpisode();
    const pending = a.api.persist(); first.data.acts[1].scenes[0].notes = 'Changed while saving';
    await pending; assert.ok(first.data);
    await a.api.persist(); assert.equal(first.data, null);
    const saved = await a.w.StoryboardStore.episode(a.api.state.project.projectId, first.episodeId);
    assert.equal(saved.acts[1].scenes[0].notes, 'Changed while saving');
  } finally { a.close(); }
});

test('folder history defaults to five previous backups and removes only files no retained backup needs', async () => {
  const a = app(); const folder = memoryFolder();
  try {
    await a.ready; await send(a, transfer()); mountFolder(a, folder);
    for (let version = 0; version < 9; version++) { a.api.activeEpisode().acts[1].scenes[0].notes = `Revision ${version}`; await a.api.saveChangedFiles(); }
    const snapshots = [...folder.files.keys()].filter(path => path.startsWith('backups/'));
    assert.equal(snapshots.length, 6);
    const keep = new Set();
    for (const path of snapshots) {
      const index = JSON.parse(await folder.files.get(path).text()); assert.equal(index.backupHistoryLimit, 5);
      for (const file of Object.keys(index.fileHashes)) { keep.add(file); assert.ok(folder.files.has(file)); }
    }
    for (const path of folder.files.keys()) if (/^(episodes|assets|scripts|metadata)\//.test(path)) assert.ok(keep.has(path), path);
    assert.match(await folder.files.get(JSON.parse(await folder.files.get('storyboarder.project.json').text()).episodes[0].fileName).text(), /Revision 8/);
  } finally { a.close(); }
});

test('the folder history settings control accepts zero, rejects invalid limits and persists per project', async () => {
  const db = new IDBFactory(); const a = app({ db }); let b; const folder = memoryFolder();
  try {
    await a.ready; await send(a, transfer()); mountFolder(a, folder);
    await a.api.saveChangedFiles(); a.api.activeEpisode().acts[1].scenes[0].notes = 'Second'; await a.api.saveChangedFiles();
    a.w.document.getElementById('btnSettings').click(); const input = a.w.document.getElementById('backupHistoryLimit');
    assert.equal(input.value, '5'); input.value = '0'; a.w.document.getElementById('btnApplyBackupHistory').click();
    assert.equal(a.api.state.project.backupHistoryLimit, 0);
    for (const invalid of ['', '-1', '1.5', '101']) { input.value = invalid; a.w.document.getElementById('btnApplyBackupHistory').click(); assert.equal(a.api.state.project.backupHistoryLimit, 0); }
    await a.api.persist(); await a.api.saveChangedFiles();
    assert.equal([...folder.files.keys()].filter(path => path.startsWith('backups/')).length, 1);
    b = app({ db }); await b.ready; assert.equal(b.api.state.project.backupHistoryLimit, 0);
  } finally { a.close(); b?.close(); }
});

test('a failed backup commit does not prune history and interrupted cleanup retries without breaking retained indexes', async () => {
  const a = app(); const folder = memoryFolder();
  try {
    await a.ready; await send(a, transfer()); mountFolder(a, folder);
    for (let version = 0; version < 3; version++) { a.api.activeEpisode().acts[1].scenes[0].notes = `Version ${version}`; await a.api.saveChangedFiles(); }
    a.api.state.project.backupHistoryLimit = 0;
    folder.beforeClose = path => { if (path === 'storyboarder.project.json') throw new Error('Commit failed'); };
    await assert.rejects(a.api.saveChangedFiles(), /Commit failed/); assert.equal(folder.removed.length, 0);
    folder.beforeClose = null; let deletions = 0;
    folder.beforeRemove = path => { if (path.startsWith('backups/') && ++deletions === 2) throw new Error('Cleanup interrupted'); };
    await a.api.saveChangedFiles(); assert.match(a.w.document.getElementById('toast').textContent, /history cleanup will retry/);
    for (const [path, file] of folder.files) if (path.startsWith('backups/')) { const index = JSON.parse(await file.text()); for (const target of Object.keys(index.fileHashes)) assert.ok(folder.files.has(target)); }
    folder.beforeRemove = null; await a.api.saveChangedFiles();
    assert.equal([...folder.files.keys()].filter(path => path.startsWith('backups/')).length, 1);
  } finally { a.close(); }
});

test('foreign backup references and unrelated files survive folder cleanup', async () => {
  const a = app(); const folder = memoryFolder();
  try {
    await a.ready; await send(a, transfer()); mountFolder(a, folder); await a.api.saveChangedFiles();
    const prior = JSON.parse(await folder.files.get('storyboarder.project.json').text());
    const foreign = { ...prior, projectId: 'foreign-project' }; const text = JSON.stringify(foreign);
    const path = `backups/${await testFileHash(text)}.project.json`;
    folder.files.set(path, new File([text], path)); folder.files.set('assets/notes.txt', new File(['Leave me alone'], 'notes.txt'));
    a.api.state.project.backupHistoryLimit = 0; a.api.activeEpisode().acts[1].scenes[0].notes = 'New own backup'; await a.api.saveChangedFiles();
    assert.ok(folder.files.has(path)); assert.ok(folder.files.has('assets/notes.txt'));
    for (const path of Object.keys(foreign.fileHashes)) assert.ok(folder.files.has(path));
  } finally { a.close(); }
});

test('damaged current files stop folder pruning before any deletion', async () => {
  const a = app(); const folder = memoryFolder();
  try {
    await a.ready; await send(a, transfer()); mountFolder(a, folder); await a.api.saveChangedFiles();
    const index = JSON.parse(await folder.files.get('storyboarder.project.json').text());
    folder.files.set(index.episodes[0].fileName, new File(['Damaged episode'], 'damaged.json'));
    await assert.rejects(pruneTestFolder(a, folder, 0), /incomplete or damaged/);
    assert.equal(folder.removed.length, 0);
  } finally { a.close(); }
});

test('a late attachment write cannot recreate cleared project files or leave a staging record', async () => {
  const a = app();
  try {
    await a.ready; await send(a, transfer()); const projectId = a.api.state.project.projectId;
    await a.api.clearBrowserDraft();
    await assert.rejects(a.w.StoryboardStore.asset('late-asset', new Blob(['Late bytes']), projectId), /cleared before the attachment/);
    assert.equal(await a.w.StoryboardStore.asset('late-asset', undefined, projectId), undefined);
    assert.equal(await a.w.StoryboardStore.record(`asset-staging:${projectId}:late-asset`), undefined);
  } finally { a.close(); }
});
