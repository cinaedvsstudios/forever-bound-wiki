/* Deterministic script breakdown: no generated story content, no network requests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StoryboardScriptImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const sections = [['prologue', 'Prologue'], ['act-1', 'Act 1'], ['act-2', 'Act 2'], ['act-3', 'Act 3'], ['epilogue', 'Epilogue']];
  const clean = (text) => String(text || '').replace(/^\s*#{1,6}\s+/, '').replace(/<[^>]*>/g, '').replace(/\*\*|__/g, '').replace(/^[*_]+|[*_]+$/g, '').trim();
  const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scene';

  function sectionId(text) {
    if (/^prologue\b/i.test(text)) return 'prologue';
    if (/^epilogue\b/i.test(text)) return 'epilogue';
    const match = /^act\s+(iii|ii|i|[123])\b/i.exec(text);
    if (!match) return null;
    return `act-${({ i: 1, ii: 2, iii: 3 })[match[1].toLowerCase()] || match[1]}`;
  }

  function parse(transfer) {
    if (transfer?.type !== 'capsanoto-storyboard-transfer' || transfer.version !== 1 || typeof transfer.document?.markdown !== 'string' || typeof transfer.document.id !== 'string' || typeof transfer.project?.id !== 'string') throw new Error('This is not a supported Capsanoto document transfer.');
    const source = transfer.document;
    const markdown = source.markdown.replace(/^---\r?\n[^]*?\r?\n---\r?\n/, '');
    const lines = markdown.split(/\r?\n/);
    const acts = sections.map(([actId, actLabel]) => ({ actId, actLabel, folderName: actLabel, scenes: [] }));
    let actId = sectionId(clean(source.title)) || 'prologue';
    let current = null;
    let explicitScene = false;
    let sequence = 0;
    const occurrences = new Map();
    function addScene(title, number = '', letter = '', explicit = false) {
      explicitScene = explicit;
      const base = `${source.id}:${actId}:${number ? number + letter : slug(title)}`;
      const occurrence = (occurrences.get(base) || 0) + 1; occurrences.set(base, occurrence);
      const sourceKey = `${base}:${occurrence}`;
      current = { sceneId: `caps-${slug(sourceKey)}`, sourceKey, sourceDocumentId: source.id, sceneNumber: number || String(++sequence), sceneLetter: letter, sceneTitle: title, scriptHeadingText: title, scriptExcerpt: '', slugLine: '', location: '', timeOfDay: '', characters: [], music: [], sfx: [], status: 'Not Started', notes: '', media: { images: [], videos: [], audio: [], blender: [], other: [] } };
      acts.find((act) => act.actId === actId).scenes.push(current);
    }
    const prelude = [];
    for (const line of lines) {
      const text = clean(line);
      const section = sectionId(text);
      const scene = /^(?:prologue\s+)?scene\s+(\d+)?\s*([a-z])?\s*(?:[:.\-–—]\s*|$)(.*)$/i.exec(text);
      const slugLine = /^(?:INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|INT\.|EXT\.|I\/E\.)\s+/i.test(text);
      if (section && !/^prologue\s+scene\b/i.test(text)) {
        actId = section;
        const act = acts.find((item) => item.actId === section);
        act.actTitle = text;
        current = null;
        continue;
      }
      if (scene) {
        const title = scene[3] || text;
        addScene(title, scene[1] || '', (scene[2] || '').toUpperCase(), true);
      } else if (slugLine && (!current || (current.slugLine && !explicitScene))) {
        addScene(text);
      }
      if (slugLine && current) {
        current.slugLine = text;
        const location = text.replace(/^(?:INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|INT\.|EXT\.|I\/E\.)\s+/i, '').split(/\s+[—–-]\s+/);
        current.location = location[0]; current.timeOfDay = location.slice(1).join(' — ');
      }
      if (current) {
        current.scriptExcerpt += line + '\n';
        const characters = /^CHARACTERS:\s*(.+)/i.exec(text);
        if (characters) current.characters = characters[1].split(/[,;]/).map((name) => name.trim()).filter(Boolean);
        const music = /^MUSIC:\s*(.+)/i.exec(text); if (music) current.music.push(music[1]);
        const sfx = /^(?:SFX|SOUND):\s*(.+)/i.exec(text); if (sfx) current.sfx.push(sfx[1]);
      } else if (text) prelude.push(line);
    }
    const sceneCount = acts.reduce((count, act) => count + act.scenes.length, 0);
    const warnings = [];
    if (!sceneCount) {
      addScene(source.title || 'Document');
      current.scriptExcerpt = markdown;
      warnings.push('No explicit scenes were found. One document card was created; add scene headings to break it down further.');
    }
    return { storyboarderVersion: 'v1', episode: { episodeNumber: String(transfer.episode?.number || '1'), episodeTitle: transfer.episode?.title || source.title, sourceScriptTitle: source.title, sourceDocumentId: source.id, sourceEpisodeKey: transfer.episode?.key || source.id, status: 'Not Started' }, sources: { [source.id]: { title: source.title, markdown, updatedAt: source.updatedAt || transfer.createdAt } }, importNotes: prelude.join('\n'), importWarnings: warnings, episodeEffects: [], acts };
  }

  function merge(existing, incoming) {
    if (!existing) return incoming;
    const documentId = incoming.episode.sourceDocumentId;
    const result = { ...existing, sources: { ...existing.sources, ...incoming.sources }, importWarnings: incoming.importWarnings };
    result.episode = { ...existing.episode, sourceDocumentId: documentId, sourceScriptTitle: incoming.episode.sourceScriptTitle };
    result.acts = incoming.acts.map((act) => {
      const old = existing.acts.find((item) => item.actId === act.actId) || { scenes: [] };
      const bySource = new Map(old.scenes.map((scene) => [scene.sourceKey, scene]));
      const refreshed = act.scenes.map((scene) => {
        const previous = bySource.get(scene.sourceKey);
        return previous ? { ...previous, ...scene, sourceRemoved: false, status: previous.status, notes: previous.notes, media: previous.media, sceneEffects: previous.sceneEffects, productionChecklist: previous.productionChecklist } : scene;
      });
      const currentKeys = new Set(refreshed.map((scene) => scene.sourceKey));
      const retained = old.scenes.filter((scene) => scene.sourceDocumentId !== documentId || !currentKeys.has(scene.sourceKey)).map((scene) => scene.sourceDocumentId === documentId ? { ...scene, sourceRemoved: true } : scene);
      return { ...old, ...act, scenes: [...retained, ...refreshed] };
    });
    return result;
  }
  return { parse, merge, sectionId };
});
