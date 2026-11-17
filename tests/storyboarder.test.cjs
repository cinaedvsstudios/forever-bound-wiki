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
  w.eval(fs.readFileSync(path.join(root, 'storage.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(root, 'script-import.js'), 'utf8'));
  let code = fs.readFileSync(path.join(root, 'storyboarder.js'), 'utf8');
  const end = code.lastIndexOf('  boot().catch(');
  code = code.slice(0, end) + 'window.story = { state, persist, receiveCapsanotoDocument, activeEpisode, activeEntry, buildProductionFiles, saveChangedFiles, importProjectFile, loadActiveEpisode, switchEpisode, createNewEpisode, addMediaFiles, normalizeEpisode, normalizeProjectEnvelope }; window.ready = boot();\n})();';
  w.eval(code);
  return { w, api: w.story, ready: w.ready, close: () => dom.window.close() };
}
async function send(a, data, token = 'test-transfer-token-0000000001') {
  await a.w.StoryboardStore.record(`storyboarder-handoff:${token}`, data, 'capsanoto-workspaces-v1');
  await a.api.receiveCapsanotoDocument(token);
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
    const writes = [];
    a.w.capsanotoHddApi = { writeTextFile: async (path, text) => { writes.push({ path, text }); } };
    await a.api.saveChangedFiles();
    assert.equal(writes.filter(file => file.path.endsWith('.storyboarder.json')).length, 2);
    assert.equal(writes.at(-1).path, 'storyboarder.project.json');
    assert.equal(JSON.parse(writes.at(-1).text).episodes.length, 2);
    assert.ok(writes.some(file => file.path.startsWith('scripts/')));
  } finally { a.close(); }
});
