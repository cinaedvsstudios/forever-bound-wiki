(() => {
  'use strict';

  const STORAGE_KEY = 'capsanoto-storyboarder-v5-autosave';
  const SCRIPT_STORAGE_KEY = 'capsanoto-storyboarder-v5-script-name';
  const STATUSES = ['Not Started', 'Needs Assets', 'In Progress', 'Rendered', 'Final', 'Problem'];
  const REQUIRED_SECTIONS = [
    { id: 'prologue', label: 'Prologue', numberLabel: 'P', folderName: 'Prologue' },
    { id: 'act-1', label: 'Act 1', numberLabel: '1', folderName: 'Act 01' },
    { id: 'act-2', label: 'Act 2', numberLabel: '2', folderName: 'Act 02' },
    { id: 'act-3', label: 'Act 3', numberLabel: '3', folderName: 'Act 03' },
    { id: 'epilogue', label: 'Epilogue', numberLabel: 'E', folderName: 'Epilogue' }
  ];
  const MEDIA_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'images', label: 'Images' },
    { id: 'videos', label: 'Videos' },
    { id: 'audio', label: 'Sounds' }
  ];

  const state = {
    project: null,
    activeEpisodeId: '',
    scriptText: '',
    scriptName: localStorage.getItem(SCRIPT_STORAGE_KEY) || '',
    mediaRuntime: new Map(),
    validation: [],
    viewMode: 'scene',
    filter: { query: '', status: 'All' },
    mediaFilters: {},
    currentNotesSceneId: null,
    lastSavedHashes: {},
    dirty: false,
    autosaveTimer: null
  };

  const el = {
    btnProject: document.getElementById('btnProject'),
    projectNameLabel: document.getElementById('projectNameLabel'),
    projectNameInput: document.getElementById('projectNameInput'),
    projectRootInput: document.getElementById('projectRootInput'),
    projectInput: document.getElementById('projectInput'),
    btnNewProject: document.getElementById('btnNewProject'),
    btnApplyProject: document.getElementById('btnApplyProject'),
    episodeButton: document.getElementById('episodeButton'),
    episodeMenu: document.getElementById('episodeMenu'),
    episodeNumber: document.getElementById('episodeNumber'),
    episodeTitle: document.getElementById('episodeTitle'),
    episodeStatusButton: document.getElementById('episodeStatusButton'),
    episodeStatusMenu: document.getElementById('episodeStatusMenu'),
    jumpNav: document.getElementById('jumpNav'),
    sceneStage: document.getElementById('sceneStage'),
    jsonInput: document.getElementById('jsonInput'),
    scriptInput: document.getElementById('scriptInput'),
    btnLoadSample: document.getElementById('btnLoadSample'),
    btnSave: document.getElementById('btnSave'),
    btnFolders: document.getElementById('btnFolders'),
    btnCreateFolders: document.getElementById('btnCreateFolders'),
    btnCopyFolders: document.getElementById('btnCopyFolders'),
    folderPlan: document.getElementById('folderPlan'),
    btnOpenEffectsLibrary: document.getElementById('btnOpenEffectsLibrary'),
    btnTranslator: document.getElementById('btnTranslator'),
    btnLipsync: document.getElementById('btnLipsync'),
    btnSettings: document.getElementById('btnSettings'),
    btnExport: document.getElementById('btnExport'),
    btnClearLocal: document.getElementById('btnClearLocal'),
    viewButtons: Array.from(document.querySelectorAll('[data-view-mode]')),
    sceneSearch: document.getElementById('sceneSearch'),
    statusFilterButton: document.getElementById('statusFilterButton'),
    statusFilterMenu: document.getElementById('statusFilterMenu'),
    validationList: document.getElementById('validationList'),
    scriptWindow: document.getElementById('scriptWindow'),
    scriptWindowHeader: document.getElementById('scriptWindowHeader'),
    scriptWindowTitle: document.getElementById('scriptWindowTitle'),
    scriptPreview: document.getElementById('scriptPreview'),
    btnCloseScript: document.getElementById('btnCloseScript'),
    btnScriptPopout: document.getElementById('btnScriptPopout'),
    notesWindow: document.getElementById('notesWindow'),
    notesWindowHeader: document.getElementById('notesWindowHeader'),
    notesWindowTitle: document.getElementById('notesWindowTitle'),
    notesTextarea: document.getElementById('notesTextarea'),
    btnCloseNotes: document.getElementById('btnCloseNotes'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    projectModal: document.getElementById('projectModal'),
    foldersModal: document.getElementById('foldersModal'),
    settingsModal: document.getElementById('settingsModal'),
    toast: document.getElementById('toast'),
    mediaTileTemplate: document.getElementById('mediaTileTemplate')
  };

  function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function clone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalizeText(value) {
    return String(value || '')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[*_`#>\[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function titleCaseSoft(value) {
    const keepUpper = new Set(['INT', 'EXT', 'POV', 'CE', 'VFX', 'SFX']);
    return String(value || '')
      .toLowerCase()
      .replace(/(^|\s|[-–—])([a-zà-ž])/g, (m, pre, char) => `${pre}${char.toUpperCase()}`)
      .split(' ')
      .map(word => keepUpper.has(word.toUpperCase().replace(/[^A-Z]/g, '')) ? word.toUpperCase() : word)
      .join(' ')
      .replace(/\bNyx\b/gi, 'Nyx')
      .replace(/\bLuca\b/gi, 'Luca')
      .replace(/\bMel\b/gi, 'Mel')
      .replace(/\bVitus\b/gi, 'Vitus')
      .replace(/\bPOV\b/gi, 'POV')
      .replace(/\bOstangavia\b/gi, 'Ostangavia');
  }

  function safeFolderText(value) {
    let clean = String(value || 'Untitled').trim();
    if (clean.includes('/')) clean = clean.split('/')[0].trim();
    clean = clean
      .replace(/[*_`#\[\]{}<>"\\|?]/g, '')
      .replace(/:/g, ' -')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\.+$/g, '')
      .replace(/^-+|-+$/g, '')
      .trim();
    return titleCaseSoft(clean || 'Untitled');
  }

  function slugify(value) {
    return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || makeId('item');
  }

  function blankMedia() {
    return { images: [], videos: [], audio: [], blender: [], other: [] };
  }

  function makeBlankEpisode(number = '1') {
    return normalizeEpisode({
      storyboarderVersion: 'v1',
      episode: {
        episodeNumber: String(number),
        episodeTitle: 'Untitled Episode',
        scriptMarkdownFile: '',
        sourceScriptTitle: '',
        defaultEpisodeFolderName: `Episode ${String(number).padStart(2, '0')} - Untitled Episode`,
        status: 'Not Started',
        jumpNavigator: []
      },
      episodeEffects: [],
      acts: REQUIRED_SECTIONS.map(section => ({
        actId: section.id,
        actLabel: section.label,
        actTitle: '',
        shortDescription: '',
        folderName: section.folderName,
        miscFolderName: 'Misc',
        scenes: []
      }))
    });
  }

  function makeDefaultProject() {
    const episode = makeBlankEpisode('1');
    episode.episode.episodeTitle = 'The Curse Begins';
    episode.episode.defaultEpisodeFolderName = 'Episode 01 - The Curse Begins';
    return normalizeProjectEnvelope({
      storyboarderProjectVersion: 'v1',
      projectName: 'Forever Bound',
      projectRootFolder: '',
      activeEpisodeId: 'episode-1',
      episodes: [{
        episodeId: 'episode-1',
        episodeNumber: '1',
        episodeTitle: 'The Curse Begins',
        fileName: 'episode-01-storyboarder.json',
        folderName: 'Episode 01 - The Curse Begins',
        data: episode
      }]
    });
  }

  function normalizeProjectEnvelope(input) {
    const project = clone(input || {});
    project.storyboarderProjectVersion = project.storyboarderProjectVersion || 'v1';
    project.projectName = project.projectName || 'Untitled Project';
    project.projectRootFolder = project.projectRootFolder || '';
    project.episodes = Array.isArray(project.episodes) ? project.episodes : [];

    if (!project.episodes.length) {
      const ep = makeBlankEpisode('1');
      project.episodes.push({
        episodeId: 'episode-1',
        episodeNumber: '1',
        episodeTitle: ep.episode.episodeTitle,
        fileName: 'episode-01-storyboarder.json',
        folderName: ep.episode.defaultEpisodeFolderName,
        data: ep
      });
    }

    project.episodes = project.episodes.map((entry, index) => {
      const data = normalizeEpisode(entry.data || entry.storyboarderData || makeBlankEpisode(String(index + 1)));
      const number = String(entry.episodeNumber || data.episode.episodeNumber || index + 1);
      const title = entry.episodeTitle || data.episode.episodeTitle || `Episode ${number}`;
      return {
        episodeId: entry.episodeId || `episode-${number}`,
        episodeNumber: number,
        episodeTitle: title,
        fileName: entry.fileName || `episode-${String(number).padStart(2, '0')}-storyboarder.json`,
        folderName: entry.folderName || data.episode.defaultEpisodeFolderName || safeFolderText(`Episode ${number} - ${title}`),
        data
      };
    });

    project.activeEpisodeId = project.activeEpisodeId || project.episodes[0].episodeId;
    if (!project.episodes.some(entry => entry.episodeId === project.activeEpisodeId)) project.activeEpisodeId = project.episodes[0].episodeId;
    return project;
  }

  function normalizeEpisode(input) {
    const data = clone(input || {});
    const validation = [];
    data.storyboarderVersion = data.storyboarderVersion || 'v1';
    data.episode = data.episode || {};
    data.episode.episodeNumber = String(data.episode.episodeNumber || '1');
    data.episode.episodeTitle = data.episode.episodeTitle || 'Untitled Episode';
    data.episode.defaultEpisodeFolderName = safeFolderText(data.episode.defaultEpisodeFolderName || `Episode ${String(data.episode.episodeNumber).padStart(2, '0')} - ${data.episode.episodeTitle}`);
    data.episode.status = STATUSES.includes(data.episode.status) ? data.episode.status : 'Not Started';

    const existingNav = new Map((data.episode.jumpNavigator || []).map(item => [item.targetActId || item.id, item]));
    data.episode.jumpNavigator = REQUIRED_SECTIONS.map(section => {
      const found = existingNav.get(section.id) || {};
      if (!existingNav.has(section.id)) validation.push({ type: 'warning', title: `Added ${section.label}`, message: 'Mandatory section was missing.' });
      return {
        id: section.id,
        label: section.label,
        numberLabel: section.numberLabel,
        shortDescription: found.shortDescription || '',
        thumbnail: found.thumbnail || '',
        targetActId: section.id
      };
    });

    const actsById = new Map((data.acts || []).map(act => [act.actId, act]));
    data.acts = REQUIRED_SECTIONS.map(section => {
      const existing = actsById.get(section.id) || {};
      return {
        actId: section.id,
        actLabel: existing.actLabel || section.label,
        actTitle: existing.actTitle || '',
        shortDescription: existing.shortDescription || '',
        folderName: section.folderName,
        miscFolderName: 'Misc',
        scenes: Array.isArray(existing.scenes) ? existing.scenes : []
      };
    });

    const seenIds = new Set();
    data.acts.forEach(act => {
      act.scenes = (act.scenes || []).map((rawScene, index) => {
        const scene = clone(rawScene || {});
        const baseId = scene.sceneId || `${act.actId}-scene-${String(index + 1).padStart(2, '0')}`;
        let finalId = baseId;
        let suffix = 2;
        while (seenIds.has(finalId)) {
          finalId = `${baseId}-${suffix}`;
          suffix += 1;
        }
        if (finalId !== baseId) validation.push({ type: 'warning', title: 'Duplicate ID fixed', message: `${baseId} became ${finalId}.` });
        seenIds.add(finalId);

        scene.sceneId = finalId;
        scene.sceneNumber = String(scene.sceneNumber || '').trim();
        scene.sceneLetter = String(scene.sceneLetter || '').trim().toUpperCase();
        scene.sceneTitle = scene.sceneTitle || scene.scriptHeadingText || 'Untitled Scene';
        scene.section = act.actLabel;
        scene.slugLine = scene.slugLine || '';
        scene.location = scene.location || '';
        scene.timeOfDay = scene.timeOfDay || '';
        scene.characters = Array.isArray(scene.characters) ? scene.characters : [];
        scene.music = Array.isArray(scene.music) ? scene.music.map(stripLinkFragments).filter(Boolean) : [];
        scene.sfx = Array.isArray(scene.sfx) ? scene.sfx.map(stripLinkFragments).filter(Boolean) : [];
        scene.scriptNotes = stripLinkFragments(scene.scriptNotes || '');
        scene.storySummary = scene.storySummary || '';
        scene.scriptAnchor = scene.scriptAnchor || slugify(scene.scriptHeadingText || scene.sceneTitle);
        scene.scriptHeadingText = scene.scriptHeadingText || scene.sceneTitle;
        scene.folderName = makeSceneFolderName(scene);
        scene.status = STATUSES.includes(scene.status) ? scene.status : 'Not Started';
        scene.media = sanitizeImportedMedia(scene.media);
        scene.sceneEffects = Array.isArray(scene.sceneEffects) ? scene.sceneEffects : [];
        scene.productionChecklist = Array.isArray(scene.productionChecklist) ? scene.productionChecklist : [];
        scene.notes = scene.notes || '';
        return scene;
      });
    });

    data.episodeEffects = Array.isArray(data.episodeEffects) ? data.episodeEffects.map(cleanEpisodeEffect).filter(Boolean) : [];
    validation.push({ type: 'ok', title: 'Episode ready', message: `${countScenes(data)} scenes loaded.` });
    state.validation = validation;
    return data;
  }

  function stripLinkFragments(value) {
    return String(value || '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\[[\s\]]*$/g, '')
      .replace(/\\\[/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanEpisodeEffect(effect) {
    if (!effect || !effect.name) return null;
    return {
      effectId: effect.effectId || makeId('episode-effect'),
      name: effect.name,
      type: effect.type || 'other',
      description: effect.description || '',
      localPath: effect.localPath || '',
      usedInScenes: Array.isArray(effect.usedInScenes) ? effect.usedInScenes : [],
      status: STATUSES.includes(effect.status) ? effect.status : 'Needs Assets',
      notes: effect.notes || ''
    };
  }

  function sanitizeImportedMedia(media) {
    const cleaned = blankMedia();
    const source = media && typeof media === 'object' ? media : {};
    Object.keys(cleaned).forEach(group => {
      const items = Array.isArray(source[group]) ? source[group] : [];
      cleaned[group] = items
        .filter(item => item && !item.sourceUrl)
        .map(item => ({
          id: item.id || makeId('media'),
          label: item.label || item.filename || 'Linked media',
          type: item.type || inferTypeFromName(item.label || item.filename || ''),
          filename: item.filename || item.label || '',
          localPath: item.localPath || '',
          targetFolder: item.targetFolder || '',
          status: STATUSES.includes(item.status) ? item.status : 'Needs Assets',
          notes: item.notes || '',
          size: item.size || 0,
          lastModified: item.lastModified || 0
        }));
    });
    return cleaned;
  }

  function countScenes(episodeData) {
    return (episodeData.acts || []).reduce((sum, act) => sum + (act.scenes || []).length, 0);
  }

  function activeEntry() {
    return state.project.episodes.find(entry => entry.episodeId === state.activeEpisodeId) || state.project.episodes[0];
  }

  function activeEpisode() {
    return activeEntry().data;
  }

  function getSceneCode(scene) {
    const num = String(scene.sceneNumber || '').trim();
    const letter = String(scene.sceneLetter || '').trim().toUpperCase();
    if (num === 'P') return 'P';
    if (!num) return '';
    const padded = /^\d+$/.test(num) ? String(Number(num)).padStart(2, '0') : num;
    return `${padded}${letter}`;
  }

  function makeSceneFolderName(scene) {
    const code = getSceneCode(scene);
    const title = safeFolderText(scene.sceneTitle || scene.scriptHeadingText || 'Untitled Scene');
    return code ? `Scene ${code} - ${title}` : `Scene - ${title}`;
  }

  function inferTypeFromName(name, mime = '') {
    const lower = String(name || '').toLowerCase();
    if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(lower)) return 'image';
    if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(lower)) return 'video';
    if (mime.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(lower)) return 'audio';
    if (/\.blend$/i.test(lower)) return 'blender';
    return 'other';
  }

  function mediaGroupForType(type) {
    if (type === 'image') return 'images';
    if (type === 'video') return 'videos';
    if (['audio', 'music', 'sfx', 'voice'].includes(type)) return 'audio';
    if (type === 'blender') return 'blender';
    return 'other';
  }

  function iconForType(type) {
    if (type === 'image') return '🖼️';
    if (type === 'video') return '🎞️';
    if (type === 'audio') return '🔊';
    if (type === 'blender') return '🧊';
    return '📎';
  }

  function sceneEmoji(scene) {
    const text = normalizeText(`${scene.sceneTitle} ${scene.slugLine} ${scene.location}`);
    if (/song|music|charm|night without end/.test(text)) return '🎵';
    if (/oracle|sylvara|prophecy/.test(text)) return '🔮';
    if (/church|crypt|vitus|holy/.test(text)) return '⛪';
    if (/castle|keep|courtyard|execution|duke/.test(text)) return '🏰';
    if (/forest|tree|grove|river|lake/.test(text)) return '🌲';
    if (/nyx|curse|dark|underworld|moravok/.test(text)) return '🖤';
    if (/battle|duel|arrest|field|archery/.test(text)) return '⚔️';
    if (/prologue|book|library|alexandria/.test(text)) return '📜';
    return '🎬';
  }

  function markDirty() {
    state.dirty = true;
    scheduleAutosave();
  }

  function scheduleAutosave() {
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = setTimeout(() => persist(), 300);
  }

  function persist() {
    if (!state.project) return;
    const payload = {
      project: state.project,
      activeEpisodeId: state.activeEpisodeId,
      viewMode: state.viewMode,
      filter: state.filter,
      lastSavedHashes: state.lastSavedHashes,
      dirty: state.dirty,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function render() {
    if (!state.project) state.project = makeDefaultProject();
    if (!state.activeEpisodeId) state.activeEpisodeId = state.project.activeEpisodeId;
    renderTopBar();
    renderEpisodeHeader();
    renderJumpNav();
    renderLeftPanel();
    renderScenes();
    persist();
  }

  function renderTopBar() {
    const project = state.project;
    const entry = activeEntry();
    el.projectNameLabel.textContent = project.projectName || 'Untitled Project';
    el.episodeButton.textContent = `Episode ${entry.episodeNumber} — ${entry.episodeTitle} ▾`;
    el.episodeMenu.innerHTML = '';
    project.episodes.forEach(ep => {
      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'option';
      button.className = ep.episodeId === state.activeEpisodeId ? 'active' : '';
      button.textContent = `Episode ${ep.episodeNumber} — ${ep.episodeTitle}`;
      button.addEventListener('click', () => switchEpisode(ep.episodeId));
      el.episodeMenu.appendChild(button);
    });
    const newButton = document.createElement('button');
    newButton.type = 'button';
    newButton.className = 'new-episode-option';
    newButton.textContent = '➕ New episode';
    newButton.addEventListener('click', createNewEpisode);
    el.episodeMenu.appendChild(newButton);
  }

  function renderEpisodeHeader() {
    const data = activeEpisode();
    const ep = data.episode;
    el.episodeNumber.textContent = `Episode ${String(ep.episodeNumber || '1').padStart(2, '0')}`;
    el.episodeTitle.textContent = ep.episodeTitle || 'Untitled Episode';
    el.episodeStatusButton.textContent = `${ep.status || 'Not Started'} ▾`;
    renderOptionMenu(el.episodeStatusMenu, STATUSES, ep.status, status => {
      ep.status = status;
      syncActiveEntryFromEpisode();
      markDirty();
      closeAllMenus();
      render();
    });
    renderOptionMenu(el.statusFilterMenu, ['All', ...STATUSES], state.filter.status, status => {
      state.filter.status = status;
      closeAllMenus();
      renderLeftPanel();
      renderScenes();
    });
    el.statusFilterButton.textContent = `${state.filter.status} ▾`;
  }

  function renderOptionMenu(menu, values, selected, onClick) {
    menu.innerHTML = '';
    values.forEach(value => {
      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'option';
      button.textContent = value;
      if (value === selected) button.classList.add('active');
      button.addEventListener('click', () => onClick(value));
      menu.appendChild(button);
    });
  }

  function renderJumpNav() {
    const data = activeEpisode();
    el.jumpNav.innerHTML = '';
    data.episode.jumpNavigator.forEach(item => {
      const act = data.acts.find(candidate => candidate.actId === item.targetActId);
      const sceneCount = act ? act.scenes.length : 0;
      const anchor = document.createElement('a');
      anchor.href = `#${item.targetActId}`;
      anchor.className = 'jump-item';
      const thumbnail = item.thumbnail || '';
      anchor.innerHTML = `
        <span class="jump-label-top">${escapeHtml(item.label)}</span>
        <span class="jump-circle${thumbnail ? ' has-image' : ''}" title="Right-click to change image">${escapeHtml(item.numberLabel)}</span>
        <span class="jump-caption">${escapeHtml(item.shortDescription || `${sceneCount} scene${sceneCount === 1 ? '' : 's'}`)}</span>
      `;
      if (thumbnail) anchor.querySelector('.jump-circle').style.setProperty('--jump-thumb', `url("${thumbnail}")`);
      anchor.addEventListener('click', event => {
        event.preventDefault();
        scrollSceneStageToAct(item.targetActId);
      });
      anchor.addEventListener('contextmenu', event => {
        event.preventDefault();
        chooseJumpImage(item);
      });
      el.jumpNav.appendChild(anchor);
    });
  }

  function scrollSceneStageToAct(actId) {
    const target = document.getElementById(actId);
    if (!target) return;
    const top = target.offsetTop - 12;
    el.sceneStage.scrollTo({ top, behavior: 'smooth' });
  }

  function scrollSceneStageToScene(sceneId, block = 'center') {
    const target = document.getElementById(sceneId);
    if (!target) return;
    const stageRect = el.sceneStage.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    let top = el.sceneStage.scrollTop + (targetRect.top - stageRect.top);
    if (block === 'center') top -= Math.max(0, (stageRect.height - targetRect.height) / 2);
    else top -= 12;
    el.sceneStage.scrollTo({ top, behavior: 'smooth' });
  }

  function chooseJumpImage(item) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.webp';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        item.thumbnail = String(reader.result || '');
        markDirty();
        renderJumpNav();
        showToast(`${item.label} image updated.`);
      };
      reader.onerror = () => showToast('Could not load that image.');
      reader.readAsDataURL(file);
    });
    input.click();
  }

  function renderLeftPanel() {
    el.viewButtons.forEach(button => button.classList.toggle('active', button.dataset.viewMode === state.viewMode));
    el.validationList.innerHTML = '';
    (state.validation || []).slice(-4).forEach(item => {
      const node = document.createElement('div');
      node.className = `validation-pill ${item.type === 'ok' ? 'ok' : 'warning'}`;
      node.innerHTML = `<strong>${escapeHtml(item.title)}</strong>${escapeHtml(item.message || '')}`;
      el.validationList.appendChild(node);
    });
  }

  function renderScenes() {
    el.sceneStage.innerHTML = '';
    if (state.viewMode === 'overview') return renderOverviewView();
    if (state.viewMode === 'act') return renderActView();
    renderSceneView();
  }

  function renderSceneView() {
    const data = activeEpisode();
    data.acts.forEach(act => {
      const section = document.createElement('section');
      section.id = act.actId;
      section.className = 'act-section';
      const visibleScenes = act.scenes.filter(sceneMatchesFilter);
      section.innerHTML = `
        <div class="act-header">
          <div><h3>${escapeHtml(act.actLabel)}${act.actTitle ? ` — ${escapeHtml(act.actTitle)}` : ''}</h3><p>${escapeHtml(act.shortDescription || act.folderName)}</p></div>
          <span class="scene-count">${visibleScenes.length}/${act.scenes.length}</span>
        </div>
      `;
      if (!act.scenes.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = `${act.actLabel} has no scenes yet.`;
        section.appendChild(empty);
      } else {
        act.scenes.forEach(scene => section.appendChild(renderSceneCard(act, scene)));
      }
      el.sceneStage.appendChild(section);
    });
  }

  function renderOverviewView() {
    const wrap = document.createElement('div');
    wrap.className = 'overview-board';
    activeEpisode().acts.forEach(act => {
      const card = document.createElement('article');
      card.className = 'overview-act-card';
      card.id = act.actId;
      card.innerHTML = `
        <div class="overview-act-head">
          <div><h3>${escapeHtml(act.actLabel)}${act.actTitle ? ` — ${escapeHtml(act.actTitle)}` : ''}</h3><p>${escapeHtml(act.shortDescription || `${act.scenes.length} scenes`)}</p></div>
          <button type="button" data-open-act>Open</button>
        </div>
        <div class="overview-scene-strip"></div>
      `;
      const strip = card.querySelector('.overview-scene-strip');
      if (!act.scenes.length) strip.innerHTML = '<div class="mini-scene empty-mini">No scenes</div>';
      else act.scenes.forEach(scene => strip.appendChild(renderMiniSceneBox(scene)));
      card.querySelector('[data-open-act]').addEventListener('click', () => {
        state.viewMode = 'act';
        render();
        scrollSceneStageToAct(act.actId);
      });
      wrap.appendChild(card);
    });
    el.sceneStage.appendChild(wrap);
  }

  function renderActView() {
    activeEpisode().acts.forEach(act => {
      const section = document.createElement('section');
      section.id = act.actId;
      section.className = 'act-section act-board-section';
      section.innerHTML = `
        <div class="act-header">
          <div><h3>${escapeHtml(act.actLabel)}${act.actTitle ? ` — ${escapeHtml(act.actTitle)}` : ''}</h3><p>${escapeHtml(act.shortDescription || act.folderName)}</p></div>
          <span class="scene-count">${act.scenes.length} scene${act.scenes.length === 1 ? '' : 's'}</span>
        </div>
        <div class="act-scene-grid"></div>
      `;
      const grid = section.querySelector('.act-scene-grid');
      const scenes = act.scenes.filter(sceneMatchesFilter);
      if (!scenes.length) grid.innerHTML = '<div class="empty-state">No scenes visible.</div>';
      else scenes.forEach(scene => grid.appendChild(renderActSceneCard(act, scene)));
      el.sceneStage.appendChild(section);
    });
  }

  function renderMiniSceneBox(scene) {
    const box = document.createElement('button');
    box.type = 'button';
    box.className = 'mini-scene';
    const thumb = getFirstImageRuntimeUrl(scene);
    if (thumb) box.style.setProperty('--mini-thumb', `url('${thumb}')`);
    box.innerHTML = `<span class="mini-visual">${thumb ? '' : sceneEmoji(scene)}</span><strong>${escapeHtml(getSceneCode(scene) || '—')}</strong><small>${escapeHtml(scene.sceneTitle)}</small>`;
    box.addEventListener('click', () => {
      state.viewMode = 'scene';
      render();
      scrollSceneStageToScene(scene.sceneId, 'center');
    });
    return box;
  }

  function renderActSceneCard(act, scene) {
    const card = document.createElement('article');
    card.className = 'act-scene-card';
    const thumb = getFirstImageRuntimeUrl(scene);
    if (thumb) card.style.setProperty('--mini-thumb', `url('${thumb}')`);
    card.innerHTML = `
      <button type="button" class="act-scene-thumb" data-open-scene>${thumb ? '' : sceneEmoji(scene)}</button>
      <div class="act-scene-info"><strong>${escapeHtml(getSceneCode(scene) || '—')} · ${escapeHtml(scene.sceneTitle)}</strong><span>${escapeHtml(scene.slugLine || scene.location || scene.folderName)}</span><div class="act-card-actions"><button type="button" data-script>Script</button><button type="button" data-folder>Folder</button></div></div>
    `;
    card.querySelector('[data-open-scene]').addEventListener('click', () => {
      state.viewMode = 'scene';
      render();
      scrollSceneStageToScene(scene.sceneId, 'center');
    });
    card.querySelector('[data-script]').addEventListener('click', () => openScriptPreview(scene));
    card.querySelector('[data-folder]').addEventListener('click', () => revealSceneFolder(act, scene));
    return card;
  }

  function renderSceneCard(act, scene) {
    const card = document.createElement('article');
    card.className = `scene-card${sceneMatchesFilter(scene) ? '' : ' hidden-by-filter'}`;
    card.id = scene.sceneId;
    const code = getSceneCode(scene) || '—';
    const characterLine = (scene.characters || []).slice(0, 7).join(', ');
    const filter = state.mediaFilters[scene.sceneId] || 'all';

    card.innerHTML = `
      <div class="scene-topline">
        <div>
          <div class="scene-title-wrap">
            <div class="scene-emoji">${sceneEmoji(scene)}</div>
            <div class="scene-title-text">
              <div class="scene-code-line">Scene ${escapeHtml(code)}</div>
              <h4>${escapeHtml(scene.sceneTitle)}</h4>
              <div class="scene-subline">${escapeHtml(scene.slugLine || scene.location || scene.folderName)}</div>
              ${characterLine ? `<div class="scene-subline">${escapeHtml(characterLine)}</div>` : ''}
            </div>
          </div>
          ${scene.storySummary ? `<p class="scene-summary">${escapeHtml(scene.storySummary)}</p>` : ''}
        </div>
        <div class="scene-actions-row">
          <div class="custom-select scene-status-wrap" data-scene-status-widget>
            <button type="button" class="status-pill" data-status-button>${escapeHtml(scene.status || 'Not Started')} ▾</button>
            <div class="select-menu hidden" data-status-menu></div>
          </div>
          <button type="button" class="scene-icon-button" title="Script" data-action="script">📜</button>
          <button type="button" class="scene-icon-button" title="Folder" data-action="folder">📁</button>
          <button type="button" class="scene-icon-button" title="Notes" data-action="notes">📝</button>
        </div>
      </div>
      <div class="scene-media-bar"><div class="media-filter"></div></div>
      <div class="media-strip" data-media-strip></div>
    `;

    const statusMenu = card.querySelector('[data-status-menu]');
    const statusButton = card.querySelector('[data-status-button]');
    renderOptionMenu(statusMenu, STATUSES, scene.status, status => {
      scene.status = status;
      markDirty();
      closeAllMenus();
      render();
    });
    statusButton.addEventListener('click', event => {
      event.stopPropagation();
      closeAllMenus(statusMenu);
      statusMenu.classList.toggle('hidden');
    });

    card.querySelector('[data-action="script"]').addEventListener('click', () => openScriptPreview(scene));
    card.querySelector('[data-action="folder"]').addEventListener('click', () => revealSceneFolder(act, scene));
    card.querySelector('[data-action="notes"]').addEventListener('click', () => openNotesModal(scene));

    const filterWrap = card.querySelector('.media-filter');
    MEDIA_FILTERS.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = item.id === filter ? 'active' : '';
      button.textContent = item.label;
      button.addEventListener('click', () => {
        state.mediaFilters[scene.sceneId] = item.id;
        renderScenes();
      });
      filterWrap.appendChild(button);
    });

    renderMediaStrip(card.querySelector('[data-media-strip]'), scene, filter);
    return card;
  }

  function renderMediaStrip(container, scene, filter = 'all') {
    container.innerHTML = '';
    getAllSceneMedia(scene)
      .filter(media => filter === 'all' || media.group === filter)
      .forEach(media => container.appendChild(renderMediaTile(scene, media)));

    const addTile = document.createElement('label');
    addTile.className = 'add-media-tile drop-media-tile';
    addTile.innerHTML = `
      <input type="file" multiple accept="image/*,.webp,video/*,audio/*,.blend,.txt,.md,.json" />
      <span class="drop-icon">🧩</span>
      <strong>Drop media here</strong>
      <small>Images, WebP, video, sounds, .blend, notes</small>
    `;
    const input = addTile.querySelector('input');
    input.addEventListener('change', event => {
      addMediaFiles(scene, event.target.files);
      event.target.value = '';
    });
    addTile.addEventListener('dragover', event => {
      event.preventDefault();
      addTile.classList.add('drag-over');
    });
    addTile.addEventListener('dragleave', () => addTile.classList.remove('drag-over'));
    addTile.addEventListener('drop', event => {
      event.preventDefault();
      addTile.classList.remove('drag-over');
      addMediaFiles(scene, event.dataTransfer?.files);
    });
    container.appendChild(addTile);
  }

  function getAllSceneMedia(scene) {
    const media = scene.media || blankMedia();
    return ['images', 'videos', 'audio', 'blender', 'other'].flatMap(group => (media[group] || []).map(item => ({ ...item, group })));
  }

  function renderMediaTile(scene, media) {
    const tile = el.mediaTileTemplate.content.firstElementChild.cloneNode(true);
    const preview = tile.querySelector('.media-preview');
    const runtime = state.mediaRuntime.get(media.id);
    const url = runtime?.objectUrl || '';
    tile.querySelector('.media-label').textContent = media.label || media.filename || 'Media';
    tile.querySelector('.media-type').textContent = `${media.type || 'other'}${media.size ? ` · ${formatBytes(media.size)}` : ''}`;

    if (media.type === 'image' && url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = media.label || media.filename || 'Image preview';
      preview.appendChild(img);
    } else if (media.type === 'video' && url) {
      const video = document.createElement('video');
      video.src = url;
      video.preload = 'metadata';
      video.controls = true;
      preview.appendChild(video);
    } else if (media.type === 'audio' && url) {
      const audio = document.createElement('audio');
      audio.src = url;
      audio.controls = true;
      preview.appendChild(audio);
    } else if (media.type === 'blender') {
      preview.textContent = '🧊 .blend';
    } else if (!url && media.filename) {
      preview.textContent = 'Relink';
      preview.title = 'Browsers cannot keep direct file handles after reload unless the HDD API is connected.';
    } else {
      preview.textContent = iconForType(media.type);
    }

    tile.querySelectorAll('[data-media-action]').forEach(button => {
      button.addEventListener('click', () => handleMediaAction(scene, media, button.dataset.mediaAction, tile));
    });
    return tile;
  }

  function addMediaFiles(scene, files) {
    if (!files || !files.length) return;
    scene.media = scene.media || blankMedia();
    Array.from(files).forEach(file => {
      const type = inferTypeFromName(file.name, file.type);
      const group = mediaGroupForType(type);
      const media = {
        id: makeId('media'),
        label: file.name,
        type,
        filename: file.name,
        localPath: '',
        targetFolder: `${scene.folderName}/${group}`,
        status: 'Needs Assets',
        notes: '',
        size: file.size,
        lastModified: file.lastModified
      };
      scene.media[group].push(media);
      state.mediaRuntime.set(media.id, { file, objectUrl: URL.createObjectURL(file) });
    });
    markDirty();
    renderScenes();
    showToast(`${files.length} media file${files.length === 1 ? '' : 's'} attached.`);
  }

  function handleMediaAction(scene, media, action, tile) {
    const runtime = state.mediaRuntime.get(media.id);
    const playable = tile.querySelector('video, audio');
    if (action === 'play') {
      if (playable) playable.play().catch(() => showToast('Use the built-in controls on the tile.'));
      else showToast('This media type cannot be played in the window.');
    }
    if (action === 'stop' && playable) { playable.pause(); playable.currentTime = 0; }
    if (action === 'download') {
      if (!runtime?.objectUrl) return showToast('No browser-accessible file attached. Relink it or use HDD paths later.');
      const a = document.createElement('a');
      a.href = runtime.objectUrl;
      a.download = media.filename || media.label || 'storyboarder-media';
      a.click();
    }
    if (action === 'folder') {
      if (media.localPath) revealPath(media.localPath);
      else showToast('Folder button ready for HDD API paths.');
    }
    if (action === 'remove') {
      removeMedia(scene, media.id);
      markDirty();
      renderScenes();
    }
  }

  function removeMedia(scene, mediaId) {
    const runtime = state.mediaRuntime.get(mediaId);
    if (runtime?.objectUrl) URL.revokeObjectURL(runtime.objectUrl);
    state.mediaRuntime.delete(mediaId);
    Object.keys(scene.media || {}).forEach(group => {
      scene.media[group] = (scene.media[group] || []).filter(item => item.id !== mediaId);
    });
  }

  function getFirstImageRuntimeUrl(scene) {
    const first = (scene.media?.images || [])[0];
    if (!first) return '';
    return state.mediaRuntime.get(first.id)?.objectUrl || '';
  }

  function sceneMatchesFilter(scene) {
    const q = normalizeText(state.filter.query);
    const statusOk = state.filter.status === 'All' || scene.status === state.filter.status;
    if (!statusOk) return false;
    if (!q) return true;
    const haystack = normalizeText([scene.sceneTitle, scene.location, scene.slugLine, scene.storySummary, scene.notes, scene.scriptHeadingText].join(' '));
    return haystack.includes(q);
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (!value) return '';
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }

  function openNotesModal(scene) {
    state.currentNotesSceneId = scene.sceneId;
    el.notesWindow.classList.remove('hidden');
    el.notesWindowTitle.textContent = `${getSceneCode(scene) || ''} ${scene.sceneTitle} — Notes`.trim();
    el.notesTextarea.value = scene.notes || '';
    el.notesTextarea.focus();
  }

  function findSceneById(sceneId) {
    for (const act of activeEpisode().acts) {
      const found = act.scenes.find(scene => scene.sceneId === sceneId);
      if (found) return found;
    }
    return null;
  }

  function openScriptPreview(scene) {
    el.scriptWindow.classList.remove('hidden');
    el.scriptWindowTitle.textContent = `${getSceneCode(scene) || ''} ${scene.sceneTitle}`.trim();
    if (!state.scriptText) {
      el.scriptPreview.innerHTML = `<p>No script Markdown has been linked yet.</p><p>Expected heading: <strong>${escapeHtml(scene.scriptHeadingText || scene.sceneTitle)}</strong></p>`;
      return;
    }
    const excerpt = findSceneExcerpt(scene, state.scriptText);
    el.scriptPreview.innerHTML = renderMarkdownLite(excerpt || `No matching script section was found for ${scene.scriptHeadingText || scene.sceneTitle}.`);
  }

  function findSceneExcerpt(scene, markdown) {
    const lines = markdown.split(/\r?\n/);
    const candidates = [scene.scriptHeadingText, scene.sceneTitle, `Scene ${scene.sceneNumber}${scene.sceneLetter || ''}`, `${scene.sceneNumber}${scene.sceneLetter || ''}: ${scene.sceneTitle}`]
      .filter(Boolean).map(normalizeText);
    let start = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (!/^\s{0,3}#{1,6}\s+/.test(lines[i])) continue;
      const clean = normalizeText(lines[i]);
      if (candidates.some(candidate => candidate && clean.includes(candidate))) { start = i; break; }
    }
    if (start < 0) start = lines.findIndex(line => normalizeText(line).includes(normalizeText(scene.sceneTitle)));
    if (start < 0) return '';
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i += 1) {
      if (/^\s{0,3}#{1,3}\s+/.test(lines[i]) && /scene|act|epilogue|prologue/i.test(lines[i])) { end = i; break; }
    }
    const chunk = lines.slice(start, end).join('\n').trim();
    return chunk.length > 16000 ? `${chunk.slice(0, 16000)}\n\n[Preview clipped.]` : chunk;
  }

  function renderMarkdownLite(markdown) {
    const escaped = escapeHtml(markdown || '')
      .replace(/^######\s+(.+)$/gm, '<h6 class="md-heading">$1</h6>')
      .replace(/^#####\s+(.+)$/gm, '<h5 class="md-heading">$1</h5>')
      .replace(/^####\s+(.+)$/gm, '<h4 class="md-heading">$1</h4>')
      .replace(/^###\s+(.+)$/gm, '<h3 class="md-heading">$1</h3>')
      .replace(/^##\s+(.+)$/gm, '<h2 class="md-heading">$1</h2>')
      .replace(/^#\s+(.+)$/gm, '<h1 class="md-heading">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>');
    return `<p>${escaped}</p>`;
  }

  function showFullScript() {
    el.scriptWindow.classList.remove('hidden');
    el.scriptWindowTitle.textContent = state.scriptName || 'Full script';
    if (!state.scriptText) return void (el.scriptPreview.innerHTML = '<p>No script Markdown has been linked yet.</p>');
    const preview = state.scriptText.length > 50000 ? `${state.scriptText.slice(0, 50000)}\n\n[Preview clipped for performance.]` : state.scriptText;
    el.scriptPreview.innerHTML = renderMarkdownLite(preview);
  }

  function openEffectsLibrary() {
    el.scriptWindow.classList.remove('hidden');
    el.scriptWindowTitle.textContent = 'Episode Effects Library';
    const effects = activeEpisode().episodeEffects || [];
    const rows = effects.length ? effects.map(effect => `
      <article class="effect-library-row"><strong>${escapeHtml(effect.name)}</strong><span>${escapeHtml(effect.type || 'effect')} · ${escapeHtml(effect.status || 'Needs Assets')}</span><p>${escapeHtml(effect.description || 'No description yet.')}</p></article>
    `).join('') : '<p>No episode effects yet. Add reusable VFX/music/SFX here later.</p>';
    el.scriptPreview.innerHTML = `<p>Episode-level reusable effects live here. Scene cards should reference this library rather than duplicating files.</p><div class="effect-library-list">${rows}</div><p><button id="addEffectFromLibrary" type="button">Add effect</button></p>`;
    document.getElementById('addEffectFromLibrary')?.addEventListener('click', () => {
      const name = prompt('Episode effect name');
      if (!name) return;
      activeEpisode().episodeEffects.push({ effectId: makeId('episode-effect'), name, type: 'vfx', description: '', localPath: '', usedInScenes: [], status: 'Needs Assets', notes: '' });
      markDirty();
      openEffectsLibrary();
    });
  }

  function buildFolderPlan() {
    const data = activeEpisode();
    const epFolder = data.episode.defaultEpisodeFolderName || safeFolderText(`Episode ${data.episode.episodeNumber} - ${data.episode.episodeTitle}`);
    const root = state.project.projectRootFolder ? state.project.projectRootFolder.replace(/[\\/]$/,'') : '';
    const prefix = root ? `${root}/${epFolder}` : epFolder;
    const folders = [prefix, `${prefix}/Episode Effects`];
    data.acts.forEach(act => {
      folders.push(`${prefix}/${act.folderName}`);
      folders.push(`${prefix}/${act.folderName}/Misc`);
      act.scenes.forEach(scene => {
        const base = `${prefix}/${act.folderName}/${scene.folderName}`;
        folders.push(base);
        ['Images', 'Video', 'Audio', 'Blender', 'Notes', 'Exports'].forEach(child => folders.push(`${base}/${child}`));
      });
    });
    return folders;
  }

  function openFoldersModal() {
    el.folderPlan.textContent = buildFolderPlan().join('\n');
    openModal('foldersModal');
  }

  async function createFoldersViaApi() {
    const folders = buildFolderPlan();
    const api = getHddApi();
    if (!api) {
      showToast('No HDD API detected. The folder plan is ready to copy.');
      return;
    }
    try {
      if (typeof api.createFolders === 'function') await api.createFolders(folders);
      else if (typeof api.createFolder === 'function') for (const folder of folders) await api.createFolder(folder);
      else throw new Error('Detected HDD API has no createFolder/createFolders function.');
      showToast(`Requested creation/check of ${folders.length} folders.`);
    } catch (error) {
      showToast(`Folder creation failed: ${error.message}`);
    }
  }

  function getHddApi() {
    return window.capsanotoHddApi || window.hddApi || window.storyboarderHddApi || null;
  }

  function revealSceneFolder(act, scene) {
    const data = activeEpisode();
    const epFolder = data.episode.defaultEpisodeFolderName || safeFolderText(data.episode.episodeTitle);
    const root = state.project.projectRootFolder ? state.project.projectRootFolder.replace(/[\\/]$/,'') : '';
    const folder = `${root ? `${root}/` : ''}${epFolder}/${act.folderName}/${scene.folderName}`;
    revealPath(folder);
  }

  async function revealPath(path) {
    const api = getHddApi();
    if (!api) return showToast(`Folder button ready. HDD API not detected. Path: ${path}`);
    try {
      if (typeof api.revealPath === 'function') await api.revealPath(path);
      else if (typeof api.openFolder === 'function') await api.openFolder(path);
      else throw new Error('Detected HDD API has no revealPath/openFolder function.');
    } catch (error) { showToast(`Could not open folder: ${error.message}`); }
  }

  function normalizeEpisodeForExport(data) {
    const copy = normalizeEpisode(data);
    copy.acts.forEach(act => act.scenes.forEach(scene => {
      scene.folderName = makeSceneFolderName(scene);
      scene.media = sanitizeImportedMedia(scene.media);
    }));
    return copy;
  }

  function exportCurrentEpisode() {
    const cleaned = normalizeEpisodeForExport(activeEpisode());
    const blob = new Blob([JSON.stringify(cleaned, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ep = cleaned.episode || {};
    a.href = url;
    a.download = `storyboarder-episode-${String(ep.episodeNumber || '1').padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function projectManifestForSave() {
    return {
      storyboarderProjectVersion: state.project.storyboarderProjectVersion,
      projectName: state.project.projectName,
      projectRootFolder: state.project.projectRootFolder,
      activeEpisodeId: state.activeEpisodeId,
      episodes: state.project.episodes.map(entry => ({
        episodeId: entry.episodeId,
        episodeNumber: entry.episodeNumber,
        episodeTitle: entry.episodeTitle,
        fileName: entry.fileName,
        folderName: entry.folderName
      }))
    };
  }

  async function saveChangedFiles() {
    syncActiveEntryFromEpisode();
    const api = getHddApi();
    const entry = activeEntry();
    const projectPath = state.project.projectRootFolder ? `${state.project.projectRootFolder.replace(/[\\/]$/,'')}/storyboarder.project.json` : 'storyboarder.project.json';
    const episodePath = state.project.projectRootFolder ? `${state.project.projectRootFolder.replace(/[\\/]$/,'')}/${entry.fileName}` : entry.fileName;
    const files = [
      { key: 'project', path: projectPath, text: JSON.stringify(projectManifestForSave(), null, 2) },
      { key: `episode:${entry.episodeId}`, path: episodePath, text: JSON.stringify(normalizeEpisodeForExport(entry.data), null, 2) }
    ];

    const changed = [];
    for (const file of files) {
      const hash = await hashText(file.text);
      if (state.lastSavedHashes[file.key] !== hash) changed.push({ ...file, hash });
    }

    if (!changed.length) {
      state.dirty = false;
      persist();
      showToast('Nothing changed. No files need saving.');
      return;
    }

    if (!api) {
      showToast(`HDD API not detected. ${changed.length} changed file${changed.length === 1 ? '' : 's'} ready: ${changed.map(f => f.path).join(', ')}`);
      return;
    }

    try {
      for (const file of changed) {
        if (typeof api.saveTextFile === 'function') await api.saveTextFile(file.path, file.text);
        else if (typeof api.writeTextFile === 'function') await api.writeTextFile(file.path, file.text);
        else if (typeof api.writeFile === 'function') await api.writeFile(file.path, file.text);
        else throw new Error('Detected HDD API has no saveTextFile/writeTextFile/writeFile function.');
        state.lastSavedHashes[file.key] = file.hash;
      }
      state.dirty = false;
      persist();
      showToast(`Saved ${changed.length} changed file${changed.length === 1 ? '' : 's'}.`);
    } catch (error) {
      showToast(`Save failed: ${error.message}`);
    }
  }

  async function hashText(text) {
    if (!crypto?.subtle) return String(text.length) + ':' + simpleHash(text);
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function simpleHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return String(hash);
  }

  function syncActiveEntryFromEpisode() {
    const entry = activeEntry();
    const data = entry.data;
    entry.episodeNumber = data.episode.episodeNumber;
    entry.episodeTitle = data.episode.episodeTitle;
    entry.folderName = data.episode.defaultEpisodeFolderName;
    entry.fileName = entry.fileName || `episode-${String(entry.episodeNumber).padStart(2, '0')}-storyboarder.json`;
    state.project.activeEpisodeId = state.activeEpisodeId;
  }

  function switchEpisode(episodeId) {
    if (state.dirty && !confirm('You have unsaved changes. Switch episodes anyway? Your browser autosave will keep a draft, but HDD Save has not run.')) return;
    state.activeEpisodeId = episodeId;
    state.project.activeEpisodeId = episodeId;
    closeAllMenus();
    render();
  }

  function createNewEpisode() {
    if (state.dirty && !confirm('You have unsaved changes. Create a new episode anyway?')) return;
    const used = new Set(state.project.episodes.map(ep => Number(ep.episodeNumber)).filter(Boolean));
    let next = 1;
    while (used.has(next)) next += 1;
    const data = makeBlankEpisode(String(next));
    const entry = {
      episodeId: `episode-${next}`,
      episodeNumber: String(next),
      episodeTitle: 'Untitled Episode',
      fileName: `episode-${String(next).padStart(2, '0')}-storyboarder.json`,
      folderName: data.episode.defaultEpisodeFolderName,
      data
    };
    state.project.episodes.push(entry);
    state.activeEpisodeId = entry.episodeId;
    state.project.activeEpisodeId = entry.episodeId;
    state.dirty = true;
    closeAllMenus();
    render();
    showToast('Blank episode created. Use Import to load its Storyboarder JSON.');
  }

  function openProjectModal() {
    el.projectNameInput.value = state.project.projectName || '';
    el.projectRootInput.value = state.project.projectRootFolder || '';
    openModal('projectModal');
  }

  function applyProjectFields() {
    state.project.projectName = el.projectNameInput.value.trim() || 'Untitled Project';
    state.project.projectRootFolder = el.projectRootInput.value.trim();
    markDirty();
    closeModal('projectModal');
    render();
  }

  function newProject() {
    if (state.dirty && !confirm('You have unsaved changes. Create a new project anyway?')) return;
    state.project = makeDefaultProject();
    state.activeEpisodeId = state.project.activeEpisodeId;
    state.dirty = true;
    closeModal('projectModal');
    render();
    showToast('New project created.');
  }

  async function importProjectFile(file) {
    if (!file) return;
    if (state.dirty && !confirm('You have unsaved changes. Load another project anyway?')) return;
    try {
      const text = await file.text();
      const incoming = JSON.parse(text);
      state.project = normalizeProjectEnvelope(incoming);
      state.activeEpisodeId = state.project.activeEpisodeId;
      state.dirty = false;
      closeModal('projectModal');
      render();
      showToast(`Loaded project ${file.name}.`);
    } catch (error) { showToast(`Project load failed: ${error.message}`); }
  }

  async function importEpisodeFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = normalizeEpisode(JSON.parse(text));
      const entry = activeEntry();
      entry.data = data;
      entry.episodeNumber = data.episode.episodeNumber;
      entry.episodeTitle = data.episode.episodeTitle;
      entry.folderName = data.episode.defaultEpisodeFolderName;
      entry.fileName = entry.fileName || `episode-${String(entry.episodeNumber).padStart(2, '0')}-storyboarder.json`;
      markDirty();
      showToast(`Imported ${file.name}. Media URLs were ignored by design.`);
      render();
    } catch (error) { showToast(`Import failed: ${error.message}`); }
  }

  async function loadSample() {
    if (state.dirty && !confirm('You have unsaved changes. Load sample anyway?')) return;
    try {
      const response = await fetch('sample/storyboarder.sample.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = normalizeEpisode(await response.json());
      const entry = activeEntry();
      entry.data = data;
      entry.episodeNumber = data.episode.episodeNumber;
      entry.episodeTitle = data.episode.episodeTitle;
      entry.folderName = data.episode.defaultEpisodeFolderName;
      entry.fileName = 'episode-01-storyboarder.json';
      state.dirty = true;
      render();
      showToast('Sample episode loaded.');
    } catch (error) { showToast(`Could not fetch sample file. Use Import instead. ${error.message}`); }
  }

  function openModal(id) {
    closeAllMenus();
    el.modalBackdrop.classList.remove('hidden');
    document.getElementById(id)?.classList.remove('hidden');
  }

  function closeModal(id) {
    document.getElementById(id)?.classList.add('hidden');
    if (![el.projectModal, el.foldersModal, el.settingsModal].some(modal => modal && !modal.classList.contains('hidden'))) {
      el.modalBackdrop.classList.add('hidden');
    }
  }

  function closeAllModals() {
    [el.projectModal, el.foldersModal, el.settingsModal].forEach(modal => modal.classList.add('hidden'));
    el.modalBackdrop.classList.add('hidden');
  }

  function toggleMenu(button, menu) {
    const willOpen = menu.classList.contains('hidden');
    closeAllMenus(menu);
    menu.classList.toggle('hidden', !willOpen);
    button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }

  function closeAllMenus(except = null) {
    document.querySelectorAll('.select-menu').forEach(menu => {
      if (menu !== except) menu.classList.add('hidden');
    });
    document.querySelectorAll('[aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  }

  function copyText(text) {
    navigator.clipboard?.writeText(text)
      .then(() => showToast('Copied.'))
      .catch(() => showToast('Could not copy automatically. Select the text manually.'));
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.remove('hidden');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => el.toast.classList.add('hidden'), 4500);
  }

  function bindEvents() {
    el.btnProject.addEventListener('click', openProjectModal);
    el.btnApplyProject.addEventListener('click', applyProjectFields);
    el.btnNewProject.addEventListener('click', newProject);
    el.projectInput.addEventListener('change', event => { importProjectFile(event.target.files?.[0]); event.target.value = ''; });

    el.episodeButton.addEventListener('click', event => { event.stopPropagation(); toggleMenu(el.episodeButton, el.episodeMenu); });
    el.episodeStatusButton.addEventListener('click', event => { event.stopPropagation(); toggleMenu(el.episodeStatusButton, el.episodeStatusMenu); });
    el.statusFilterButton.addEventListener('click', event => { event.stopPropagation(); toggleMenu(el.statusFilterButton, el.statusFilterMenu); });
    document.addEventListener('click', event => { if (!event.target.closest('.custom-select')) closeAllMenus(); });

    el.viewButtons.forEach(button => button.addEventListener('click', () => { state.viewMode = button.dataset.viewMode || 'scene'; render(); }));
    el.sceneSearch.addEventListener('input', event => { state.filter.query = event.target.value; renderScenes(); });

    el.jsonInput.addEventListener('change', event => { importEpisodeFile(event.target.files?.[0]); event.target.value = ''; });
    el.scriptInput.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      state.scriptText = await file.text();
      state.scriptName = file.name;
      localStorage.setItem(SCRIPT_STORAGE_KEY, file.name);
      showToast(`Linked script: ${file.name}.`);
      event.target.value = '';
    });

    el.btnLoadSample.addEventListener('click', loadSample);
    el.btnSave.addEventListener('click', saveChangedFiles);
    el.btnFolders.addEventListener('click', openFoldersModal);
    el.btnCopyFolders.addEventListener('click', () => copyText(buildFolderPlan().join('\n')));
    el.btnCreateFolders.addEventListener('click', createFoldersViaApi);
    el.btnOpenEffectsLibrary.addEventListener('click', openEffectsLibrary);
    el.btnTranslator.addEventListener('click', () => window.open('https://cinaedvsstudios.github.io/Forever-Bound-Game/artifex/apps/misc/translator/', '_blank', 'noopener'));
    el.btnLipsync.addEventListener('click', () => window.open('https://cinaedvsstudios.github.io/Forever-Bound-Game/artifex/apps/lipsync-helper/', '_blank', 'noopener'));
    el.btnSettings.addEventListener('click', () => openModal('settingsModal'));
    el.btnExport.addEventListener('click', exportCurrentEpisode);
    el.btnClearLocal.addEventListener('click', () => {
      if (!confirm('Clear the browser autosaved Storyboarder draft? This does not delete HDD files.')) return;
      localStorage.removeItem(STORAGE_KEY);
      state.project = makeDefaultProject();
      state.activeEpisodeId = state.project.activeEpisodeId;
      state.dirty = false;
      closeModal('settingsModal');
      render();
      showToast('Local draft cleared.');
    });

    document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.closeModal)));
    el.modalBackdrop.addEventListener('click', closeAllModals);

    el.btnCloseScript.addEventListener('click', () => el.scriptWindow.classList.add('hidden'));
    el.btnScriptPopout.addEventListener('click', showFullScript);
    el.btnCloseNotes.addEventListener('click', () => el.notesWindow.classList.add('hidden'));
    el.notesTextarea.addEventListener('input', event => {
      const scene = findSceneById(state.currentNotesSceneId);
      if (!scene) return;
      scene.notes = event.target.value;
      markDirty();
    });

    makeDraggable(el.scriptWindow, el.scriptWindowHeader);
    makeDraggable(el.notesWindow, el.notesWindowHeader);

    window.addEventListener('beforeunload', event => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  function makeDraggable(windowEl, handleEl) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    handleEl.addEventListener('pointerdown', event => {
      if (event.target.closest('button')) return;
      dragging = true;
      handleEl.setPointerCapture(event.pointerId);
      startX = event.clientX;
      startY = event.clientY;
      const rect = windowEl.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
    });
    handleEl.addEventListener('pointermove', event => {
      if (!dragging) return;
      const nextLeft = Math.max(8, Math.min(window.innerWidth - 80, startLeft + event.clientX - startX));
      const nextTop = Math.max(8, Math.min(window.innerHeight - 80, startTop + event.clientY - startY));
      windowEl.style.left = `${nextLeft}px`;
      windowEl.style.top = `${nextTop}px`;
    });
    handleEl.addEventListener('pointerup', event => {
      dragging = false;
      try { handleEl.releasePointerCapture(event.pointerId); } catch {}
    });
  }

  function boot() {
    bindEvents();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.project) {
        state.project = normalizeProjectEnvelope(saved.project);
        state.activeEpisodeId = saved.activeEpisodeId || state.project.activeEpisodeId;
        state.viewMode = saved.viewMode || 'scene';
        state.filter = saved.filter || state.filter;
        state.lastSavedHashes = saved.lastSavedHashes || {};
        state.dirty = !!saved.dirty;
      } else {
        state.project = makeDefaultProject();
        state.activeEpisodeId = state.project.activeEpisodeId;
      }
    } catch {
      state.project = makeDefaultProject();
      state.activeEpisodeId = state.project.activeEpisodeId;
    }
    render();
  }

  boot();
})();
