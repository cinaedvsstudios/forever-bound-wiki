(() => {
  'use strict';

  const STORAGE_KEY = 'capsanoto-storyboarder-current-project-v1';
  const SCRIPT_STORAGE_KEY = 'capsanoto-storyboarder-script-name-v1';
  const STATUSES = ['Not Started', 'Needs Assets', 'In Progress', 'Rendered', 'Final', 'Problem'];
  const REQUIRED_SECTIONS = [
    { id: 'prologue', label: 'Prologue', numberLabel: 'P', folderName: 'Prologue' },
    { id: 'act-1', label: 'Act 1', numberLabel: '1', folderName: 'Act 01' },
    { id: 'act-2', label: 'Act 2', numberLabel: '2', folderName: 'Act 02' },
    { id: 'act-3', label: 'Act 3', numberLabel: '3', folderName: 'Act 03' },
    { id: 'epilogue', label: 'Epilogue', numberLabel: 'E', folderName: 'Epilogue' }
  ];

  const state = {
    project: null,
    scriptText: '',
    scriptName: localStorage.getItem(SCRIPT_STORAGE_KEY) || '',
    mediaRuntime: new Map(),
    validation: [],
    viewMode: 'scene',
    filter: {
      query: '',
      status: 'All'
    },
    currentScriptSceneId: null
  };

  const el = {
    episodeSelect: document.getElementById('episodeSelect'),
    episodeNumber: document.getElementById('episodeNumber'),
    episodeTitle: document.getElementById('episodeTitle'),
    episodeStatusButton: document.getElementById('episodeStatusButton'),
    episodeStatusMenu: document.getElementById('episodeStatusMenu'),
    jumpNav: document.getElementById('jumpNav'),
    sceneStage: document.getElementById('sceneStage'),
    jsonInput: document.getElementById('jsonInput'),
    scriptInput: document.getElementById('scriptInput'),
    btnLoadSample: document.getElementById('btnLoadSample'),
    btnExport: document.getElementById('btnExport'),
    btnFolderPlan: document.getElementById('btnFolderPlan'),
    btnCreateFolders: document.getElementById('btnCreateFolders'),
    btnClearLocal: document.getElementById('btnClearLocal'),
    btnOpenEffectsLibrary: document.getElementById('btnOpenEffectsLibrary'),
    viewButtons: Array.from(document.querySelectorAll('[data-view-mode]')),
    sceneSearch: document.getElementById('sceneSearch'),
    statusFilter: document.getElementById('statusFilter'),
    validationList: document.getElementById('validationList'),
    scriptWindow: document.getElementById('scriptWindow'),
    scriptWindowHeader: document.getElementById('scriptWindowHeader'),
    scriptWindowTitle: document.getElementById('scriptWindowTitle'),
    scriptPreview: document.getElementById('scriptPreview'),
    btnCloseScript: document.getElementById('btnCloseScript'),
    btnScriptPopout: document.getElementById('btnScriptPopout'),
    toast: document.getElementById('toast'),
    mediaTileTemplate: document.getElementById('mediaTileTemplate')
  };

  function makeDefaultProject() {
    return normalizeProject({
      storyboarderVersion: 'v1-prototype',
      episode: {
        episodeNumber: '1',
        episodeTitle: 'The Curse Begins',
        scriptMarkdownFile: 'Forever Bound Part 1 - The Curse Begins.md',
        sourceScriptTitle: 'Forever Bound Part 1 - The Curse Begins',
        defaultEpisodeFolderName: 'Episode 01 - The Curse Begins',
        status: 'Not Started',
        jumpNavigator: []
      },
      episodeEffects: [
        {
          effectId: makeId('effect'),
          name: 'One Sweet Charm motif',
          type: 'music',
          description: 'Reusable episode-level theme or motif.',
          localPath: '',
          usedInScenes: [],
          status: 'Needs Assets',
          notes: ''
        },
        {
          effectId: makeId('effect'),
          name: 'Nyx dark magic treatment',
          type: 'vfx',
          description: 'Reusable smoke, shadow, beetle, fire, and curse treatment.',
          localPath: '',
          usedInScenes: [],
          status: 'Needs Assets',
          notes: ''
        }
      ],
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

  function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
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
      .replace(/\bOstangavia\b/gi, 'Ostangavia');
  }

  function normalizeText(value) {
    return String(value || '')
      .replace(/[*_`#>\[\]()]/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function safeFolderText(value) {
    let clean = String(value || 'Untitled Scene').trim();
    if (clean.includes('/')) clean = clean.split('/')[0].trim();
    clean = clean
      .replace(/[*_`#\[\]{}<>"\\|?]/g, '')
      .replace(/:/g, ' -')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
    clean = clean.replace(/\.+$/g, '').replace(/^-+|-+$/g, '').trim();
    return titleCaseSoft(clean || 'Untitled Scene');
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

  function blankMedia() {
    return { images: [], videos: [], audio: [], blender: [], other: [] };
  }

  function normalizeProject(input) {
    const project = structuredClonePolyfill(input || {});
    const validation = [];

    project.storyboarderVersion = project.storyboarderVersion || 'v1-prototype';
    project.episode = project.episode || {};
    project.episode.episodeNumber = String(project.episode.episodeNumber || '1');
    project.episode.episodeTitle = project.episode.episodeTitle || 'Untitled Episode';
    project.episode.defaultEpisodeFolderName = safeFolderText(project.episode.defaultEpisodeFolderName || `Episode ${String(project.episode.episodeNumber).padStart(2, '0')} - ${project.episode.episodeTitle}`);
    project.episode.status = STATUSES.includes(project.episode.status) ? project.episode.status : 'Not Started';

    const existingNavigator = new Map((project.episode.jumpNavigator || []).map(item => [item.targetActId || item.id, item]));
    project.episode.jumpNavigator = REQUIRED_SECTIONS.map(section => {
      const found = existingNavigator.get(section.id) || {};
      if (!existingNavigator.has(section.id)) {
        validation.push({ type: 'warning', title: `Added missing ${section.label}`, message: 'The top jump navigator is mandatory, so this section was created.' });
      }
      return {
        id: section.id,
        label: section.label,
        numberLabel: section.numberLabel,
        shortDescription: found.shortDescription || '',
        thumbnail: '',
        targetActId: section.id
      };
    });

    const actsById = new Map((project.acts || []).map(act => [act.actId, act]));
    project.acts = REQUIRED_SECTIONS.map(section => {
      const existing = actsById.get(section.id) || {};
      if (!actsById.has(section.id)) {
        validation.push({ type: 'warning', title: `${section.label} act created`, message: 'This section did not exist in the imported file.' });
      }
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
    project.acts.forEach(act => {
      act.scenes = (act.scenes || []).map((rawScene, index) => {
        const scene = structuredClonePolyfill(rawScene || {});
        const baseId = scene.sceneId || `${act.actId}-scene-${String(index + 1).padStart(2, '0')}`;
        let finalId = baseId;
        let suffix = 2;
        while (seenIds.has(finalId)) {
          finalId = `${baseId}-${suffix}`;
          suffix += 1;
        }
        if (finalId !== baseId) {
          validation.push({ type: 'warning', title: 'Duplicate scene ID fixed', message: `${baseId} became ${finalId}.` });
        }
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
        scene.storySummary = scene.storySummary || '';
        scene.scriptAnchor = scene.scriptAnchor || slugify(scene.scriptHeadingText || scene.sceneTitle);
        scene.scriptHeadingText = scene.scriptHeadingText || scene.sceneTitle;
        scene.folderName = makeSceneFolderName(scene);
        scene.status = STATUSES.includes(scene.status) ? scene.status : 'Not Started';
        scene.notes = scene.notes || '';

        // Storyboarder owns media. Imported URL references are deliberately ignored.
        scene.media = sanitizeImportedMedia(scene.media);
        scene.sceneEffects = Array.isArray(scene.sceneEffects) ? scene.sceneEffects.map(cleanEffect).filter(Boolean) : [];
        scene.productionChecklist = Array.isArray(scene.productionChecklist) ? scene.productionChecklist : [];
        return scene;
      });
    });

    project.episodeEffects = Array.isArray(project.episodeEffects) ? project.episodeEffects.map(cleanEpisodeEffect).filter(Boolean) : [];
    if (!project.episodeEffects.length) {
      project.episodeEffects = [];
    }

    validation.push({ type: 'ok', title: 'Project ready', message: `${countScenes(project)} scenes loaded across ${project.acts.length} mandatory sections.` });
    state.validation = validation;
    return project;
  }

  function structuredClonePolyfill(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function slugify(value) {
    return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || makeId('scene');
  }

  function cleanEffect(effect) {
    if (!effect || !effect.name) return null;
    return {
      effectId: effect.effectId || makeId('scene-effect'),
      name: effect.name,
      type: effect.type || 'VFX',
      description: effect.description || '',
      status: STATUSES.includes(effect.status) ? effect.status : 'Needs Assets',
      notes: effect.notes || ''
    };
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

  function countScenes(project) {
    return (project.acts || []).reduce((total, act) => total + (act.scenes || []).length, 0);
  }

  function inferTypeFromName(name, mime = '') {
    const lower = String(name || '').toLowerCase();
    if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(lower)) return 'image';
    if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi)$/i.test(lower)) return 'video';
    if (mime.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|flac)$/i.test(lower)) return 'audio';
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

  function persist() {
    if (!state.project) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
  }

  function render() {
    if (!state.project) state.project = makeDefaultProject();
    renderEpisodeHeader();
    renderJumpNav();
    renderLeftPanel();
    renderScenes();
    persist();
  }

  function renderEpisodeHeader() {
    const ep = state.project.episode;
    el.episodeSelect.innerHTML = '';
    const option = document.createElement('option');
    option.value = ep.episodeNumber;
    option.textContent = `Episode ${ep.episodeNumber} — ${ep.episodeTitle}`;
    el.episodeSelect.appendChild(option);

    el.episodeNumber.textContent = `Episode ${String(ep.episodeNumber || '1').padStart(2, '0')}`;
    el.episodeTitle.textContent = ep.episodeTitle || 'Untitled Episode';
    el.episodeStatusButton.textContent = `${ep.status || 'Not Started'} ▾`;
    el.episodeStatusButton.setAttribute('aria-expanded', el.episodeStatusMenu.classList.contains('hidden') ? 'false' : 'true');
    el.episodeStatusMenu.innerHTML = '';

    STATUSES.forEach(status => {
      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'option';
      button.className = status === ep.status ? 'active' : '';
      button.textContent = status;
      button.addEventListener('click', () => {
        state.project.episode.status = status;
        el.episodeStatusMenu.classList.add('hidden');
        render();
      });
      el.episodeStatusMenu.appendChild(button);
    });
  }

  function renderJumpNav() {
    el.jumpNav.innerHTML = '';
    state.project.episode.jumpNavigator.forEach(item => {
      const act = state.project.acts.find(candidate => candidate.actId === item.targetActId);
      const sceneCount = act ? act.scenes.length : 0;
      const anchor = document.createElement('a');
      anchor.href = `#${item.targetActId}`;
      anchor.className = 'jump-item';
      const thumbStyle = item.thumbnail ? `style="--jump-thumb: url('${escapeHtml(item.thumbnail)}')"` : '';
      anchor.innerHTML = `
        <span class="jump-label-top">${escapeHtml(item.label)}</span>
        <span class="jump-circle" ${thumbStyle}>${escapeHtml(item.numberLabel)}</span>
        <span class="jump-caption">${escapeHtml(item.shortDescription || `${sceneCount} scene${sceneCount === 1 ? '' : 's'}`)}</span>
      `;
      anchor.addEventListener('click', event => {
        event.preventDefault();
        document.getElementById(item.targetActId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      el.jumpNav.appendChild(anchor);
    });
  }

  function renderLeftPanel() {
    el.statusFilter.innerHTML = ['All', ...STATUSES].map(status => `<option ${status === state.filter.status ? 'selected' : ''}>${status}</option>`).join('');
    el.viewButtons.forEach(button => button.classList.toggle('active', button.dataset.viewMode === state.viewMode));
    renderValidation();
  }

  function renderEffects() {
    el.episodeEffects.innerHTML = '';
    const effects = state.project.episodeEffects || [];
    if (!effects.length) {
      el.episodeEffects.innerHTML = '<div class="effect-pill">No episode effects yet.</div>';
      return;
    }
    effects.forEach(effect => {
      const node = document.createElement('div');
      node.className = 'effect-pill';
      node.innerHTML = `<strong>${escapeHtml(effect.name)}</strong>${escapeHtml(effect.type || 'effect')} · ${escapeHtml(effect.status || 'Needs Assets')}`;
      node.title = effect.description || '';
      el.episodeEffects.appendChild(node);
    });
  }

  function renderValidation() {
    el.validationList.innerHTML = '';
    (state.validation || []).forEach(item => {
      const node = document.createElement('div');
      node.className = `validation-pill ${item.type === 'ok' ? 'ok' : 'warning'}`;
      node.innerHTML = `<strong>${escapeHtml(item.title)}</strong>${escapeHtml(item.message || '')}`;
      el.validationList.appendChild(node);
    });
  }

  function renderScenes() {
    el.sceneStage.innerHTML = '';
    el.sceneStage.dataset.viewMode = state.viewMode;

    if (state.viewMode === 'overview') {
      renderOverviewView();
      return;
    }

    if (state.viewMode === 'act') {
      renderActView();
      return;
    }

    renderSceneView();
  }

  function renderSceneView() {
    state.project.acts.forEach(act => {
      const section = document.createElement('section');
      section.id = act.actId;
      section.className = 'act-section';

      const visibleScenes = act.scenes.filter(sceneMatchesFilter);
      section.innerHTML = `
        <div class="act-header">
          <div>
            <h3>${escapeHtml(act.actLabel)}${act.actTitle ? ` — ${escapeHtml(act.actTitle)}` : ''}</h3>
            <p>${escapeHtml(act.shortDescription || act.folderName)}</p>
          </div>
          <span class="scene-count">${visibleScenes.length}/${act.scenes.length} visible</span>
        </div>
      `;

      if (!act.scenes.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = `${act.actLabel} has no scenes yet. It is still kept because this section is mandatory.`;
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
    state.project.acts.forEach(act => {
      const card = document.createElement('article');
      card.className = 'overview-act-card';
      card.id = act.actId;
      const scenes = act.scenes || [];
      card.innerHTML = `
        <div class="overview-act-head">
          <div>
            <h3>${escapeHtml(act.actLabel)}${act.actTitle ? ` — ${escapeHtml(act.actTitle)}` : ''}</h3>
            <p>${escapeHtml(act.shortDescription || `${scenes.length} scenes`)}</p>
          </div>
          <button type="button" data-act-open="${escapeHtml(act.actId)}">Open act</button>
        </div>
        <div class="overview-scene-strip"></div>
      `;
      const strip = card.querySelector('.overview-scene-strip');
      if (!scenes.length) {
        strip.innerHTML = '<div class="mini-scene empty-mini">No scenes yet</div>';
      } else {
        scenes.forEach(scene => strip.appendChild(renderMiniSceneBox(act, scene)));
      }
      card.querySelector('[data-act-open]').addEventListener('click', () => {
        state.viewMode = 'act';
        render();
        document.getElementById(act.actId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      wrap.appendChild(card);
    });
    el.sceneStage.appendChild(wrap);
  }

  function renderActView() {
    state.project.acts.forEach(act => {
      const section = document.createElement('section');
      section.id = act.actId;
      section.className = 'act-section act-board-section';
      section.innerHTML = `
        <div class="act-header">
          <div>
            <h3>${escapeHtml(act.actLabel)}${act.actTitle ? ` — ${escapeHtml(act.actTitle)}` : ''}</h3>
            <p>${escapeHtml(act.shortDescription || act.folderName)}</p>
          </div>
          <span class="scene-count">${act.scenes.length} scene${act.scenes.length === 1 ? '' : 's'}</span>
        </div>
        <div class="act-scene-grid"></div>
      `;
      const grid = section.querySelector('.act-scene-grid');
      if (!act.scenes.length) {
        grid.innerHTML = '<div class="empty-state">No scenes yet.</div>';
      } else {
        act.scenes.filter(sceneMatchesFilter).forEach(scene => grid.appendChild(renderActSceneCard(act, scene)));
      }
      el.sceneStage.appendChild(section);
    });
  }

  function renderMiniSceneBox(act, scene) {
    const box = document.createElement('button');
    box.type = 'button';
    box.className = 'mini-scene';
    const thumb = getFirstImageRuntimeUrl(scene);
    if (thumb) box.style.setProperty('--mini-thumb', `url('${thumb}')`);
    box.innerHTML = `
      <span class="mini-visual">${thumb ? '' : sceneEmoji(scene)}</span>
      <strong>${escapeHtml(getSceneCode(scene) || '—')}</strong>
      <small>${escapeHtml(scene.sceneTitle)}</small>
    `;
    box.addEventListener('click', () => {
      state.viewMode = 'scene';
      render();
      document.getElementById(scene.sceneId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return box;
  }

  function renderActSceneCard(act, scene) {
    const card = document.createElement('article');
    card.className = `act-scene-card${sceneMatchesFilter(scene) ? '' : ' hidden-by-filter'}`;
    const thumb = getFirstImageRuntimeUrl(scene);
    if (thumb) card.style.setProperty('--mini-thumb', `url('${thumb}')`);
    card.innerHTML = `
      <button type="button" class="act-scene-thumb" data-open-scene>${thumb ? '' : sceneEmoji(scene)}</button>
      <div class="act-scene-info">
        <strong>${escapeHtml(getSceneCode(scene) || '—')} · ${escapeHtml(scene.sceneTitle)}</strong>
        <span>${escapeHtml(scene.slugLine || scene.location || scene.folderName)}</span>
        <div class="act-card-actions">
          <button type="button" data-script>Script</button>
          <button type="button" data-folder>Folder</button>
        </div>
      </div>
    `;
    card.querySelector('[data-open-scene]').addEventListener('click', () => {
      state.viewMode = 'scene';
      render();
      document.getElementById(scene.sceneId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    card.querySelector('[data-script]').addEventListener('click', () => openScriptPreview(scene));
    card.querySelector('[data-folder]').addEventListener('click', () => revealSceneFolder(act, scene));
    return card;
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
    const haystack = normalizeText([
      scene.sceneTitle,
      scene.sceneNumber,
      scene.sceneLetter,
      scene.location,
      scene.slugLine,
      scene.storySummary,
      scene.notes,
      scene.scriptHeadingText
    ].join(' '));
    return haystack.includes(q);
  }

  function renderSceneCard(act, scene) {
    const card = document.createElement('article');
    card.className = `scene-card${sceneMatchesFilter(scene) ? '' : ' hidden-by-filter'}`;
    card.id = scene.sceneId;
    card.dataset.sceneId = scene.sceneId;

    const code = getSceneCode(scene) || '—';
    const characterLine = (scene.characters || []).slice(0, 6).join(', ');

    card.innerHTML = `
      <div class="scene-main compact-scene-main">
        <div>
          <div class="scene-title-wrap">
            <div class="scene-emoji" title="Scene type">${sceneEmoji(scene)}</div>
            <div class="scene-title-text">
              <div class="scene-code-line">Scene ${escapeHtml(code)}</div>
              <h4>${escapeHtml(scene.sceneTitle)}</h4>
              <div class="scene-subline">${escapeHtml(scene.slugLine || scene.location || scene.folderName)}</div>
              ${characterLine ? `<div class="scene-subline">${escapeHtml(characterLine)}</div>` : ''}
            </div>
          </div>
          ${scene.storySummary ? `<p class="scene-summary">${escapeHtml(scene.storySummary)}</p>` : ''}
        </div>
        <div class="scene-tools compact-tools">
          <label>Status</label>
          <select data-scene-control="status">
            ${STATUSES.map(status => `<option ${status === scene.status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
          <div class="tool-row">
            <button type="button" data-scene-control="script">Script</button>
            <button type="button" data-scene-control="folder">Folder</button>
          </div>
          <div class="notes-hover">
            <button type="button" class="notes-trigger">📝 Notes</button>
            <div class="notes-popover" role="dialog" aria-label="Scene notes">
              <label>Scene notes</label>
              <textarea data-scene-control="notes" placeholder="Production notes, ideas, problems, reminders...">${escapeHtml(scene.notes || '')}</textarea>
            </div>
          </div>
        </div>
      </div>
      <div class="media-strip" data-media-strip="${escapeHtml(scene.sceneId)}"></div>
    `;

    card.querySelector('[data-scene-control="status"]').addEventListener('change', event => {
      scene.status = event.target.value;
      render();
    });

    card.querySelector('[data-scene-control="notes"]').addEventListener('input', event => {
      scene.notes = event.target.value;
      persist();
    });

    card.querySelector('[data-scene-control="script"]').addEventListener('click', () => openScriptPreview(scene));
    card.querySelector('[data-scene-control="folder"]').addEventListener('click', () => revealSceneFolder(act, scene));

    renderMediaStrip(card.querySelector('[data-media-strip]'), scene);
    return card;
  }

  function renderMediaStrip(container, scene) {
    container.innerHTML = '';
    const allMedia = getAllSceneMedia(scene);

    allMedia.forEach(media => container.appendChild(renderMediaTile(scene, media)));

    const addTile = document.createElement('label');
    addTile.className = 'add-media-tile drop-media-tile';
    addTile.innerHTML = `
      <input type="file" multiple accept="image/*,video/*,audio/*,.blend,.txt,.md,.json" />
      <span class="drop-icon">🖼️</span>
      <strong>Drop image here</strong>
      <small>or click to add video, audio, .blend, notes</small>
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
      preview.textContent = 'Relink file';
      preview.title = 'Browsers cannot keep full local file access after reload. Add the media again or use the HDD API integration later.';
    } else {
      preview.textContent = iconForType(media.type);
    }

    tile.querySelectorAll('[data-media-action]').forEach(button => {
      button.addEventListener('click', () => handleMediaAction(scene, media, button.dataset.mediaAction, tile));
    });

    return tile;
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

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (!value) return '';
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
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
    persist();
    renderScenes();
    showToast(`${files.length} media file${files.length === 1 ? '' : 's'} linked to ${scene.sceneTitle}.`);
  }

  function handleMediaAction(scene, media, action, tile) {
    const runtime = state.mediaRuntime.get(media.id);
    const playable = tile.querySelector('video, audio');

    if (action === 'play') {
      if (playable) {
        playable.play().catch(() => showToast('The browser blocked playback. Use the built-in controls on the tile.'));
      } else {
        showToast('This media type cannot be played in the window.');
      }
    }

    if (action === 'stop') {
      if (playable) {
        playable.pause();
        playable.currentTime = 0;
      }
    }

    if (action === 'download') {
      if (runtime?.objectUrl) {
        const a = document.createElement('a');
        a.href = runtime.objectUrl;
        a.download = media.filename || media.label || 'storyboarder-media';
        a.click();
      } else {
        showToast('No browser-accessible file is attached. Relink the file or use HDD API paths later.');
      }
    }

    if (action === 'folder') {
      if (media.localPath) {
        revealPath(media.localPath);
      } else {
        showToast('No local HDD path stored yet. This button is ready for the HDD API integration.');
      }
    }

    if (action === 'remove') {
      removeMedia(scene, media.id);
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
    persist();
  }

  function openScriptPreview(scene) {
    state.currentScriptSceneId = scene.sceneId;
    el.scriptWindow.classList.remove('hidden');
    el.scriptWindowTitle.textContent = `${getSceneCode(scene) || ''} ${scene.sceneTitle}`.trim();

    if (!state.scriptText) {
      el.scriptPreview.innerHTML = `
        <p>No script Markdown has been linked yet.</p>
        <p>Expected heading: <strong>${escapeHtml(scene.scriptHeadingText || scene.sceneTitle)}</strong></p>
        <p>Use <strong>Link script MD</strong> at the top when the script is ready from Capsanoto.</p>
      `;
      return;
    }

    const excerpt = findSceneExcerpt(scene, state.scriptText);
    el.scriptPreview.innerHTML = renderMarkdownLite(excerpt || `No matching script section was found for ${scene.scriptHeadingText || scene.sceneTitle}.`);
  }

  function findSceneExcerpt(scene, markdown) {
    const lines = markdown.split(/\r?\n/);
    const candidates = [
      scene.scriptHeadingText,
      scene.sceneTitle,
      `Scene ${scene.sceneNumber}${scene.sceneLetter || ''}`,
      `${scene.sceneNumber}${scene.sceneLetter || ''}: ${scene.sceneTitle}`
    ].filter(Boolean).map(normalizeText);

    let start = -1;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!/^\s{0,3}#{1,6}\s+/.test(line)) continue;
      const clean = normalizeText(line);
      if (candidates.some(candidate => candidate && clean.includes(candidate))) {
        start = i;
        break;
      }
    }

    if (start < 0) {
      const titleNeedle = normalizeText(scene.sceneTitle);
      start = lines.findIndex(line => normalizeText(line).includes(titleNeedle));
    }

    if (start < 0) return '';

    let end = lines.length;
    for (let i = start + 1; i < lines.length; i += 1) {
      if (/^\s{0,3}#{1,3}\s+/.test(lines[i]) && /scene|act|epilogue|prologue/i.test(lines[i])) {
        end = i;
        break;
      }
    }

    const chunk = lines.slice(start, end).join('\n').trim();
    return chunk.length > 16000 ? `${chunk.slice(0, 16000)}\n\n[Preview clipped. Use Full script to read more.]` : chunk;
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
    if (!state.scriptText) {
      el.scriptPreview.innerHTML = '<p>No script Markdown has been linked yet.</p>';
      return;
    }
    const preview = state.scriptText.length > 50000 ? `${state.scriptText.slice(0, 50000)}\n\n[Full script preview clipped for performance.]` : state.scriptText;
    el.scriptPreview.innerHTML = renderMarkdownLite(preview);
  }

  function openEffectsLibrary() {
    el.scriptWindow.classList.remove('hidden');
    el.scriptWindowTitle.textContent = 'Episode Effects Library';
    const effects = state.project.episodeEffects || [];
    const rows = effects.length ? effects.map(effect => `
      <article class="effect-library-row">
        <strong>${escapeHtml(effect.name)}</strong>
        <span>${escapeHtml(effect.type || 'effect')} · ${escapeHtml(effect.status || 'Needs Assets')}</span>
        <p>${escapeHtml(effect.description || 'No description yet.')}</p>
      </article>
    `).join('') : '<p>No episode effects yet. Add reusable VFX/music/SFX here later.</p>';

    el.scriptPreview.innerHTML = `
      <p>Episode-level reusable effects live here once Storyboarder is connected to actual media. Scene cards should reference this library instead of duplicating files.</p>
      <div class="effect-library-list">${rows}</div>
      <p><button id="addEffectFromLibrary" type="button">Add effect</button></p>
    `;

    document.getElementById('addEffectFromLibrary')?.addEventListener('click', () => {
      const name = prompt('Episode effect name');
      if (!name) return;
      state.project.episodeEffects.push({
        effectId: makeId('episode-effect'),
        name,
        type: 'vfx',
        description: '',
        localPath: '',
        usedInScenes: [],
        status: 'Needs Assets',
        notes: ''
      });
      persist();
      openEffectsLibrary();
    });
  }

  function showFolderPlan() {
    const plan = buildFolderPlan();
    el.scriptWindow.classList.remove('hidden');
    el.scriptWindowTitle.textContent = 'Folder Plan';
    el.scriptPreview.innerHTML = `
      <p>This is the folder structure Storyboarder will create or use when the HDD API is connected.</p>
      <pre class="folder-plan">${escapeHtml(plan.join('\n'))}</pre>
      <p><button id="copyFolderPlan" type="button">Copy folder plan</button></p>
    `;
    document.getElementById('copyFolderPlan')?.addEventListener('click', () => copyText(plan.join('\n')));
  }

  function buildFolderPlan() {
    const epFolder = state.project.episode.defaultEpisodeFolderName || safeFolderText(`Episode ${state.project.episode.episodeNumber} - ${state.project.episode.episodeTitle}`);
    const folders = [epFolder, `${epFolder}/Episode Effects`];
    state.project.acts.forEach(act => {
      folders.push(`${epFolder}/${act.folderName}`);
      folders.push(`${epFolder}/${act.folderName}/Misc`);
      act.scenes.forEach(scene => {
        const base = `${epFolder}/${act.folderName}/${scene.folderName}`;
        folders.push(base);
        ['Images', 'Video', 'Audio', 'Blender', 'Notes', 'Exports'].forEach(child => folders.push(`${base}/${child}`));
      });
    });
    return folders;
  }

  async function createFoldersViaApi() {
    const folders = buildFolderPlan();
    const api = getHddApi();
    if (!api) {
      showToast('No HDD API was detected. Showing the folder plan instead.');
      showFolderPlan();
      return;
    }

    try {
      if (typeof api.createFolders === 'function') {
        await api.createFolders(folders);
      } else if (typeof api.createFolder === 'function') {
        for (const folder of folders) await api.createFolder(folder);
      } else {
        throw new Error('Detected HDD API has no createFolder/createFolders function.');
      }
      showToast(`Requested creation of ${folders.length} folders.`);
    } catch (error) {
      showToast(`Folder creation failed: ${error.message}`);
    }
  }

  function getHddApi() {
    return window.capsanotoHddApi || window.hddApi || window.storyboarderHddApi || null;
  }

  function revealSceneFolder(act, scene) {
    const epFolder = state.project.episode.defaultEpisodeFolderName || safeFolderText(state.project.episode.episodeTitle);
    const folder = `${epFolder}/${act.folderName}/${scene.folderName}`;
    revealPath(folder);
  }

  async function revealPath(path) {
    const api = getHddApi();
    if (!api) {
      showToast(`Folder button ready. HDD API not detected. Path: ${path}`);
      return;
    }
    try {
      if (typeof api.revealPath === 'function') await api.revealPath(path);
      else if (typeof api.openFolder === 'function') await api.openFolder(path);
      else throw new Error('Detected HDD API has no revealPath/openFolder function.');
    } catch (error) {
      showToast(`Could not open folder: ${error.message}`);
    }
  }

  function exportProject() {
    const cleaned = normalizeProjectForExport(state.project);
    const blob = new Blob([JSON.stringify(cleaned, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ep = cleaned.episode || {};
    a.href = url;
    a.download = `storyboarder-episode-${String(ep.episodeNumber || '1').padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function normalizeProjectForExport(project) {
    const copy = normalizeProject(project);
    copy.acts.forEach(act => {
      act.scenes.forEach(scene => {
        scene.folderName = makeSceneFolderName(scene);
        scene.media = sanitizeImportedMedia(scene.media);
      });
    });
    return copy;
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
    showToast.timer = setTimeout(() => el.toast.classList.add('hidden'), 4200);
  }

  function bindEvents() {
    el.episodeStatusButton.addEventListener('click', event => {
      event.stopPropagation();
      el.episodeStatusMenu.classList.toggle('hidden');
      el.episodeStatusButton.setAttribute('aria-expanded', el.episodeStatusMenu.classList.contains('hidden') ? 'false' : 'true');
    });

    document.addEventListener('click', event => {
      if (!event.target.closest('#episodeStatusWidget')) {
        el.episodeStatusMenu.classList.add('hidden');
        el.episodeStatusButton.setAttribute('aria-expanded', 'false');
      }
    });

    el.viewButtons.forEach(button => {
      button.addEventListener('click', () => {
        state.viewMode = button.dataset.viewMode || 'scene';
        render();
      });
    });

    el.jsonInput.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        state.project = normalizeProject(JSON.parse(text));
        showToast(`Imported ${file.name}. External URL media was ignored by design.`);
        render();
      } catch (error) {
        showToast(`Import failed: ${error.message}`);
      } finally {
        event.target.value = '';
      }
    });

    el.scriptInput.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      state.scriptText = await file.text();
      state.scriptName = file.name;
      localStorage.setItem(SCRIPT_STORAGE_KEY, file.name);
      showToast(`Linked script preview source: ${file.name}.`);
      event.target.value = '';
    });

    el.btnLoadSample.addEventListener('click', loadSample);
    el.btnExport.addEventListener('click', exportProject);
    el.btnFolderPlan.addEventListener('click', showFolderPlan);
    el.btnCreateFolders.addEventListener('click', createFoldersViaApi);
    el.btnOpenEffectsLibrary.addEventListener('click', openEffectsLibrary);

    el.btnClearLocal.addEventListener('click', () => {
      if (!confirm('Clear the local Storyboarder draft from this browser?')) return;
      localStorage.removeItem(STORAGE_KEY);
      state.project = makeDefaultProject();
      render();
      showToast('Local draft cleared.');
    });


    el.sceneSearch.addEventListener('input', event => {
      state.filter.query = event.target.value;
      renderScenes();
    });

    el.statusFilter.addEventListener('change', event => {
      state.filter.status = event.target.value;
      renderScenes();
    });

    el.btnCloseScript.addEventListener('click', () => el.scriptWindow.classList.add('hidden'));
    el.btnScriptPopout.addEventListener('click', showFullScript);
    makeDraggable(el.scriptWindow, el.scriptWindowHeader);
  }

  async function loadSample() {
    try {
      const response = await fetch('sample/storyboarder.sample.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.project = normalizeProject(await response.json());
      showToast('Sample project loaded.');
      render();
    } catch (error) {
      showToast(`Could not fetch sample file. Use Import JSON instead. ${error.message}`);
    }
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
      const saved = localStorage.getItem(STORAGE_KEY);
      state.project = saved ? normalizeProject(JSON.parse(saved)) : makeDefaultProject();
    } catch {
      state.project = makeDefaultProject();
    }
    render();
  }

  boot();
})();
