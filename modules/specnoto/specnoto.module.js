/*
  Specnoto for Capsanoto
  Converted from the original Chrome extension content script into a normal browser app module.

  Usage:
    <script src="modules/specnoto/specnoto.module.js"></script>
    <button data-capsanoto-tool="specnoto">📜 Specnoto</button>

  API:
    window.CapsanotoSpecnoto.init({ sourceSelector: '#editor' })
    window.CapsanotoSpecnoto.toggle()
    window.CapsanotoSpecnoto.open()
    window.CapsanotoSpecnoto.close()
    window.CapsanotoSpecnoto.refresh()
*/
(function specnotoCapsanotoModule() {
  'use strict';

  if (window.CapsanotoSpecnoto && window.CapsanotoSpecnoto.__ready) {
    return;
  }

  const MODULE_VERSION = '1.0-capsanoto';
  const SETTINGS_KEY = 'capsanoto_specnoto_settings';
  const OPEN_STATE_KEY = 'capsanoto_specnoto_open_state';
  const POSITION_X_KEY = 'capsanoto_specnoto_pos_x';
  const POSITION_Y_KEY = 'capsanoto_specnoto_pos_y';

  const defaultSettings = {
    width: 300,
    accent: '#e88f69',
    bg: '#211812',
    panel: '#28133f',
    text: '#fbf4d6',
    muted: '#a97b38',
    border: '#724837',
    emSettings: '⚙️',
    emBack: '🏛️',
    emJump: '🧭',
    emClear: '🧹',
    emSearch: '🕯️',
    emDownload: '🧺',
    emPin: '🧭',
    prevLen: 3,
    sens: 2,
    fontSize: 14,
    uiPadding: 12
  };

  const state = {
    host: null,
    shadow: null,
    app: null,
    visible: false,
    sourceRoot: null,
    docData: [],
    originalSnapshot: null,
    selectedMatch: null,
    openPreviews: [],
    activePreviewId: null,
    appSettings: { ...defaultSettings },
    options: {
      sourceSelector: '#editor, .editor[contenteditable="true"], [contenteditable="true"], main',
      autoRestoreOpenState: true
    },
    draggingApp: null,
    draggingTabs: null,
    hasDraggedTabs: false,
    buttonBound: false
  };

  function storageGet(keys) {
    const output = {};
    keys.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw === null) return;
      try {
        output[key] = JSON.parse(raw);
      } catch (error) {
        output[key] = raw;
      }
    });
    return output;
  }

  function storageSet(values) {
    Object.entries(values).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });
  }

  function tabsStorageKey() {
    return 'capsanoto_specnoto_tabs_' + window.location.origin + window.location.pathname;
  }

  function escapeHTML(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function sourceLabel() {
    const root = getSourceRoot();
    if (!root) return 'page';
    if (root.id === 'editor') return 'Capsanoto file';
    if (root.isContentEditable) return 'editable text';
    if (root.tagName) return root.tagName.toLowerCase();
    return 'page';
  }

  function getSourceRoot() {
    if (state.sourceRoot && document.contains(state.sourceRoot)) return state.sourceRoot;

    const selectors = state.options.sourceSelector.split(',').map((item) => item.trim()).filter(Boolean);
    for (const selector of selectors) {
      try {
        const found = document.querySelector(selector);
        if (found && found !== state.host && !found.closest('#specnoto-host')) {
          state.sourceRoot = found;
          return found;
        }
      } catch (error) {
        // Ignore invalid custom selectors and continue.
      }
    }

    state.sourceRoot = document.body || document.documentElement;
    return state.sourceRoot;
  }

  function readSourceText() {
    const root = getSourceRoot();
    if (!root) return '';
    return root.innerText || root.textContent || '';
  }

  function refreshData() {
    state.docData = [{ text: readSourceText() }];
    const input = state.shadow && state.shadow.getElementById('search-input');
    if (input && input.value.length >= 2) input.dispatchEvent(new Event('input'));
    updateStatus();
  }

  function init(options = {}) {
    state.options = { ...state.options, ...options };
    if (state.host) return api;

    state.host = document.createElement('div');
    state.host.id = 'specnoto-host';
    state.host.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;';
    document.documentElement.appendChild(state.host);

    state.shadow = state.host.attachShadow({ mode: 'open' });
    state.shadow.innerHTML = template();
    state.app = state.shadow.getElementById('specnoto-app');

    const saved = storageGet([SETTINGS_KEY, tabsStorageKey()]);
    state.appSettings = { ...defaultSettings, ...(saved[SETTINGS_KEY] || {}) };
    if (Array.isArray(saved[tabsStorageKey()])) {
      state.openPreviews = saved[tabsStorageKey()];
      if (state.openPreviews.length > 0) state.activePreviewId = state.openPreviews[0].id;
    }

    setupLogic();
    applyTheme(state.appSettings);
    renderTabs();

    if (state.options.autoRestoreOpenState && sessionStorage.getItem(OPEN_STATE_KEY) === 'true') {
      setTimeout(open, 100);
    }

    document.dispatchEvent(new CustomEvent('capsanoto:tool-ready', {
      detail: { tool: 'specnoto', version: MODULE_VERSION }
    }));

    return api;
  }

  function template() {
    return `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; letter-spacing: normal; word-spacing: normal; line-height: normal; }

        #specnoto-app {
          --bg: #211812;
          --panel: #28133f;
          --accent: #e88f69;
          --text: #fbf4d6;
          --muted: #a97b38;
          --border: #724837;
          --font-size: 14px;
          --ui-padding: 12px;
          --app-width: 300px;
          position: fixed;
          top: 72px;
          right: 50px;
          width: var(--app-width);
          height: 550px;
          background: var(--bg);
          color: var(--text);
          font-size: var(--font-size);
          border: 1px solid var(--accent);
          border-radius: 14px;
          display: none;
          flex-direction: column;
          box-shadow: 0 16px 42px rgba(0,0,0,0.72);
          overflow: hidden;
          transition: width 0.25s ease;
        }
        #specnoto-app.expanded { width: calc(var(--app-width) + 450px); }

        .app-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px var(--ui-padding);
          background: var(--panel);
          cursor: grab;
          flex-shrink: 0;
          border-bottom: 1px solid var(--border);
        }
        .app-header:active { cursor: grabbing; }
        .app-title { font-size: calc(var(--font-size) * 1.05); color: var(--text); display: flex; align-items: center; gap: 8px; font-weight: 700; }
        .app-subtitle { color: var(--muted); font-size: calc(var(--font-size) * 0.75); font-weight: 700; margin-left: 4px; }
        .app-btn-top { background: none; border: none; color: var(--muted); font-size: calc(var(--font-size) * 1.15); cursor: pointer; padding: 0; transition: 0.2s; display: flex; align-items: center; }
        .app-btn-top:hover { color: #c55222; }

        .app-body { display: flex; flex-direction: row; flex: 1; overflow: hidden; }
        .col-search { display: flex; flex-direction: column; padding: var(--ui-padding); gap: 10px; width: var(--app-width); flex-shrink: 0; height: 100%; }
        .top-nav { display: flex; gap: 6px; padding: 6px; border: 1px solid var(--border); border-radius: 10px; background: rgba(0,0,0,0.22); justify-content: space-between; }
        .btn-icon { flex: 1; padding: 6px 0; background: transparent; color: var(--text); border: 1px solid transparent; border-radius: 8px; cursor: pointer; font-size: calc(var(--font-size) * 1.05); transition: 0.2s; display: flex; justify-content: center; align-items: center; }
        .btn-icon:hover { background: rgba(255,255,255,0.08); border-color: var(--accent); }
        .btn-icon:disabled { opacity: 0.35; cursor: not-allowed; border-color: transparent; }
        .search-box { background: #000; border: 1px solid var(--border); color: var(--text); padding: 10px; border-radius: 8px; width: 100%; outline: none; font-size: var(--font-size); }
        .search-box:focus { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }

        .status-area { display: flex; align-items: center; font-size: calc(var(--font-size) * 0.82); color: var(--muted); margin-top: -3px; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #2c2c2c; display: inline-block; margin-right: 6px; }
        .status-dot.active { background: #e88f69; box-shadow: 0 0 8px #e88f69; }

        #results-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px; }
        .result-item { background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; cursor: pointer; font-size: calc(var(--font-size) * 0.9); border-left: 4px solid transparent; transition: transform 0.2s, background-color 0.2s; line-height: 1.4; }
        .result-item:hover { background: rgba(255,255,255,0.1); }
        .result-item.active { border-left-color: var(--accent); background: rgba(255,255,255,0.13); transform: translateX(4px); }
        .tab-tag { font-size: calc(var(--font-size) * 0.7); font-weight: 700; color: var(--muted); display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .snippet { color: var(--text); }
        .snippet b { color: #000; background: var(--accent); padding: 0 3px; border-radius: 3px; font-weight: 400; }

        .col-preview { flex: 1; display: none; flex-direction: column; background: rgba(0,0,0,0.25); border-left: 1px solid var(--border); height: 100%; min-width: 0; }
        #specnoto-app.expanded .col-preview { display: flex; }
        .preview-top { padding: 10px 15px; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border); flex-shrink: 0; display: flex; gap: 10px; flex-wrap: nowrap; overflow-x: auto; transform: scaleY(-1); cursor: grab; }
        .preview-top:active { cursor: grabbing; }
        .preview-top::-webkit-scrollbar { height: 8px; }
        .preview-top::-webkit-scrollbar-track { background: transparent; }
        .preview-top::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
        .preview-top::-webkit-scrollbar-thumb:hover { background: var(--accent); border: 2px solid transparent; background-clip: padding-box; }
        .location-badge { display: inline-flex; align-items: center; padding: 6px 12px; background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-radius: 999px; color: var(--accent); font-size: calc(var(--font-size) * 0.85); font-weight: 700; letter-spacing: 0.4px; cursor: pointer; user-select: none; transition: 0.2s ease; flex-shrink: 0; transform: scaleY(-1); }
        .location-badge:hover { background: rgba(255,255,255,0.1); }
        .location-badge.locked { border-color: var(--accent); background: rgba(255,255,255,0.12); }
        .badge-close { margin-left: 10px; color: var(--muted); font-size: 1.2rem; font-weight: 400; line-height: 1; display: flex; align-items: center; }
        .badge-close:hover { color: #c55222; }
        #preview-content { flex: 1; padding: 15px 25px 25px 25px; overflow-y: auto; white-space: pre-wrap; line-height: 1.45; color: var(--text); font-size: calc(var(--font-size) * 1.02); font-family: Arial, Helvetica, sans-serif; }
        #preview-content b { color: #000; background: var(--accent); padding: 0 3px; border-radius: 3px; font-weight: 400; }

        #settings-panel { display: none; position: absolute; inset: 12px; margin: auto; background: var(--panel); border: 1px solid var(--accent); border-radius: 12px; padding: 15px; z-index: 100; flex-direction: column; overflow-y: auto; color: var(--text); box-shadow: 0 12px 32px rgba(0,0,0,0.55); }
        .settings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; position: sticky; top: -15px; background: var(--panel); padding: 0 0 8px 0; border-bottom: 1px solid var(--border); }
        .settings-header b { color: var(--accent); font-size: 1.02rem; }
        .setting-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px; font-size: 0.85rem; }
        .setting-row span:first-child { color: var(--muted); font-weight: 700; }
        .slider-group { display: flex; align-items: center; gap: 8px; flex: 1; justify-content: flex-end; }
        .slider-group input { width: 100px; accent-color: var(--accent); }
        .slider-group span { width: 22px; text-align: right; font-family: 'Courier New', Courier, monospace; color: var(--text); }
        .setting-input { background: #000; border: 1px solid var(--border); color: var(--text); padding: 6px; border-radius: 6px; width: 74px; text-align: center; font-size: 0.88rem; }
        .setting-color { width: 34px; height: 25px; padding: 0; border: 1px solid var(--border); background: none; cursor: pointer; border-radius: 999px; overflow: hidden; }
        .btn-save { background: var(--accent); color: #000; padding: 10px; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; margin-top: 10px; width: 100%; font-size: 0.92rem; }
        .section-line { border-top: 1px solid var(--border); margin: 13px 0; }

        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
        ::-webkit-scrollbar-thumb:hover { background: var(--accent); border: 2px solid transparent; background-clip: padding-box; }
      </style>

      <div id="specnoto-app" role="dialog" aria-label="Specnoto search panel">
        <div class="app-header" id="drag-handle">
          <div class="app-title">📜 Specnoto <span class="app-subtitle">Capsanoto module</span></div>
          <button class="app-btn-top" id="btn-close" title="Close" type="button">✖</button>
        </div>

        <div class="app-body">
          <div class="col-search">
            <div class="top-nav">
              <button class="btn-icon" id="btn-settings" title="Settings" type="button"></button>
              <button class="btn-icon" id="btn-back" disabled title="Return to Location" type="button"></button>
              <button class="btn-icon" id="btn-jump" disabled title="Jump to Match" type="button"></button>
              <button class="btn-icon" id="btn-clear" title="Clear Search" type="button"></button>
              <button class="btn-icon" id="btn-refresh" title="Refresh Capsanoto Text" type="button"></button>
              <button class="btn-icon" id="btn-download" title="Download Preview Text" type="button"></button>
            </div>
            <input type="text" id="search-input" class="search-box" placeholder="Search current file..." autocomplete="off">
            <div class="status-area">
              <span class="status-dot" id="sync-dot"></span><span id="footer-hint">System Ready.</span>
            </div>
            <div id="results-list"></div>
          </div>

          <div class="col-preview">
            <div class="preview-top" id="preview-tabs-container"></div>
            <div id="preview-content"></div>
          </div>
        </div>

        <div id="settings-panel">
          <div class="settings-header">
            <b>Settings</b><button class="app-btn-top" id="set-close" title="Close settings" type="button">✖</button>
          </div>
          <div class="setting-row"><span>Context</span><div class="slider-group"><input type="range" id="cfg-prev" min="0" max="8"><span id="val-prev"></span></div></div>
          <div class="setting-row"><span>Sensitivity</span><div class="slider-group"><input type="range" id="cfg-sens" min="1" max="4"><span id="val-sens"></span></div></div>
          <div class="setting-row"><span>Text Size</span><div class="slider-group"><input type="range" id="cfg-font" min="10" max="22"><span id="val-font"></span></div></div>
          <div class="setting-row"><span>Padding</span><div class="slider-group"><input type="range" id="cfg-pad" min="6" max="20"><span id="val-pad"></span></div></div>
          <div class="section-line"></div>
          <div class="setting-row"><span>Width</span><input type="number" id="cfg-width" class="setting-input"></div>
          <div class="setting-row"><span>Accent</span><input type="color" id="cfg-accent" class="setting-color"></div>
          <div class="setting-row"><span>Background</span><input type="color" id="cfg-bg" class="setting-color"></div>
          <div class="setting-row"><span>Panel</span><input type="color" id="cfg-panel" class="setting-color"></div>
          <div class="setting-row"><span>Text</span><input type="color" id="cfg-text" class="setting-color"></div>
          <div class="section-line"></div>
          <div class="setting-row"><span>Settings Icon</span><input type="text" id="cfg-em-settings" class="setting-input"></div>
          <div class="setting-row"><span>Back Icon</span><input type="text" id="cfg-em-back" class="setting-input"></div>
          <div class="setting-row"><span>Jump Icon</span><input type="text" id="cfg-em-jump" class="setting-input"></div>
          <div class="setting-row"><span>Clear Icon</span><input type="text" id="cfg-em-clear" class="setting-input"></div>
          <div class="setting-row"><span>Search Icon</span><input type="text" id="cfg-em-search" class="setting-input"></div>
          <div class="setting-row"><span>Download Icon</span><input type="text" id="cfg-em-download" class="setting-input"></div>
          <div class="setting-row"><span>Pin Icon</span><input type="text" id="cfg-em-pin" class="setting-input"></div>
          <button id="set-save" class="btn-save" type="button">Save & Apply</button>
        </div>
      </div>
    `;
  }

  function applyTheme(settings) {
    if (!state.app || !state.shadow) return;
    state.app.style.setProperty('--bg', settings.bg);
    state.app.style.setProperty('--panel', settings.panel || '#28133f');
    state.app.style.setProperty('--accent', settings.accent);
    state.app.style.setProperty('--text', settings.text || '#fbf4d6');
    state.app.style.setProperty('--muted', settings.muted || '#a97b38');
    state.app.style.setProperty('--border', settings.border || '#724837');
    state.app.style.setProperty('--font-size', settings.fontSize + 'px');
    state.app.style.setProperty('--ui-padding', settings.uiPadding + 'px');
    state.app.style.setProperty('--app-width', settings.width + 'px');

    setText('btn-settings', settings.emSettings);
    setText('btn-back', settings.emBack);
    setText('btn-jump', settings.emJump);
    setText('btn-clear', settings.emClear);
    setText('btn-refresh', settings.emSearch);
    setText('btn-download', settings.emDownload);

    setValue('cfg-width', settings.width);
    setValue('cfg-accent', settings.accent);
    setValue('cfg-bg', settings.bg);
    setValue('cfg-panel', settings.panel || '#28133f');
    setValue('cfg-text', settings.text || '#fbf4d6');
    setValue('cfg-prev', settings.prevLen);
    setText('val-prev', settings.prevLen);
    setValue('cfg-sens', settings.sens);
    setText('val-sens', settings.sens);
    setValue('cfg-font', settings.fontSize);
    setText('val-font', settings.fontSize);
    setValue('cfg-pad', settings.uiPadding);
    setText('val-pad', settings.uiPadding);
    setValue('cfg-em-settings', settings.emSettings);
    setValue('cfg-em-back', settings.emBack);
    setValue('cfg-em-jump', settings.emJump);
    setValue('cfg-em-clear', settings.emClear);
    setValue('cfg-em-search', settings.emSearch);
    setValue('cfg-em-download', settings.emDownload);
    setValue('cfg-em-pin', settings.emPin);

    renderTabs();
  }

  function setText(id, value) {
    const el = state.shadow.getElementById(id);
    if (el) el.innerText = value;
  }

  function setValue(id, value) {
    const el = state.shadow.getElementById(id);
    if (el) el.value = value;
  }

  function open() {
    if (!state.host) init();
    state.visible = true;
    sessionStorage.setItem(OPEN_STATE_KEY, 'true');
    state.app.style.display = 'flex';
    restorePosition();
    refreshData();
    const input = state.shadow.getElementById('search-input');
    if (input) input.focus();
  }

  function close() {
    if (!state.app) return;
    state.visible = false;
    sessionStorage.setItem(OPEN_STATE_KEY, 'false');
    state.app.style.display = 'none';
  }

  function toggle() {
    if (!state.host) init();
    if (state.visible) close();
    else open();
  }

  function restorePosition() {
    const posX = sessionStorage.getItem(POSITION_X_KEY);
    const posY = sessionStorage.getItem(POSITION_Y_KEY);
    if (posX && posY) {
      state.app.style.left = posX;
      state.app.style.top = posY;
      state.app.style.right = 'auto';
    }
  }

  function saveLockedTabs() {
    const lockedTabs = state.openPreviews.filter((preview) => preview.locked);
    storageSet({ [tabsStorageKey()]: lockedTabs });
  }

  function updateStatus() {
    if (!state.shadow) return;
    const input = state.shadow.getElementById('search-input');
    const list = state.shadow.getElementById('results-list');
    const hint = state.shadow.getElementById('footer-hint');
    const dot = state.shadow.getElementById('sync-dot');
    if (!input || !list || !hint || !dot) return;

    const queryLen = input.value.length;
    const matchCount = list.children.length;
    const lockedCount = state.openPreviews.filter((preview) => preview.locked).length;

    let statusText = `Ready · ${sourceLabel()}`;
    if (queryLen >= 2) statusText = `${matchCount} match${matchCount === 1 ? '' : 'es'} in ${sourceLabel()}.`;
    if (lockedCount > 0) statusText += ` | ${lockedCount} locked tab${lockedCount === 1 ? '' : 's'}`;

    hint.innerText = statusText;
    dot.classList.toggle('active', queryLen >= 2 || lockedCount > 0);
  }

  function renderTabs() {
    if (!state.shadow || !state.app) return;
    const tabsContainer = state.shadow.getElementById('preview-tabs-container');
    const contentContainer = state.shadow.getElementById('preview-content');
    if (!tabsContainer || !contentContainer) return;

    if (state.openPreviews.length === 0) {
      state.app.classList.remove('expanded');
      const jump = state.shadow.getElementById('btn-jump');
      if (jump) jump.disabled = true;
      state.selectedMatch = null;
      contentContainer.innerHTML = '';
      updateStatus();
      return;
    }

    state.app.classList.add('expanded');
    const jump = state.shadow.getElementById('btn-jump');
    if (jump) jump.disabled = false;
    tabsContainer.innerHTML = '';

    state.openPreviews.forEach((preview) => {
      const badge = document.createElement('div');
      badge.className = 'location-badge';
      if (preview.id === state.activePreviewId) badge.classList.add('active');
      if (preview.locked) badge.classList.add('locked');

      const textArea = document.createElement('span');
      const icon = preview.locked ? '🔒' : state.appSettings.emPin;
      textArea.innerText = `${icon} ${preview.label || 'MATCH'} · line ${preview.lineInfo}`;
      textArea.addEventListener('click', () => {
        if (state.hasDraggedTabs) return;
        if (state.activePreviewId === preview.id) {
          preview.locked = !preview.locked;
          saveLockedTabs();
        } else {
          state.activePreviewId = preview.id;
        }
        renderTabs();
      });
      badge.appendChild(textArea);

      if (preview.locked) {
        const closeBtn = document.createElement('span');
        closeBtn.className = 'badge-close';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          if (state.hasDraggedTabs) return;
          state.openPreviews = state.openPreviews.filter((item) => item.id !== preview.id);
          saveLockedTabs();
          if (state.activePreviewId === preview.id) {
            state.activePreviewId = state.openPreviews.length ? state.openPreviews[state.openPreviews.length - 1].id : null;
          }
          renderTabs();
        });
        badge.appendChild(closeBtn);
      }

      tabsContainer.appendChild(badge);
    });

    const activePreview = state.openPreviews.find((preview) => preview.id === state.activePreviewId);
    if (activePreview) {
      contentContainer.innerHTML = activePreview.fullText;
      state.selectedMatch = activePreview.para;
      state.shadow.querySelectorAll('.result-item').forEach((item) => {
        item.classList.toggle('active', item.dataset.id === activePreview.id);
      });
    }

    updateStatus();
  }

  function setupLogic() {
    const input = state.shadow.getElementById('search-input');
    const handle = state.shadow.getElementById('drag-handle');
    const tabsContainer = state.shadow.getElementById('preview-tabs-container');

    ['cfg-prev', 'cfg-sens', 'cfg-font', 'cfg-pad'].forEach((id) => {
      const el = state.shadow.getElementById(id);
      const val = state.shadow.getElementById(id.replace('cfg-', 'val-'));
      if (el && val) el.addEventListener('input', (event) => { val.innerText = event.target.value; });
    });

    handle.addEventListener('pointerdown', startAppDrag);
    tabsContainer.addEventListener('wheel', handleTabsWheel, { passive: false });
    tabsContainer.addEventListener('pointerdown', startTabsDrag);
    tabsContainer.addEventListener('pointermove', moveTabsDrag);
    tabsContainer.addEventListener('pointerup', stopTabsDrag);
    tabsContainer.addEventListener('pointerleave', stopTabsDrag);

    input.addEventListener('input', runSearch);

    state.shadow.getElementById('btn-close').addEventListener('click', close);
    state.shadow.getElementById('btn-clear').addEventListener('click', clearUnlockedTabs);
    state.shadow.getElementById('btn-refresh').addEventListener('click', () => {
      refreshData();
      input.dispatchEvent(new Event('input'));
    });
    state.shadow.getElementById('btn-download').addEventListener('click', downloadActivePreview);
    state.shadow.getElementById('btn-jump').addEventListener('click', jumpToSelectedMatch);
    state.shadow.getElementById('btn-back').addEventListener('click', returnToOriginalScroll);

    const setPanel = state.shadow.getElementById('settings-panel');
    state.shadow.getElementById('btn-settings').addEventListener('click', () => { setPanel.style.display = 'flex'; });
    state.shadow.getElementById('set-close').addEventListener('click', () => { setPanel.style.display = 'none'; });
    state.shadow.getElementById('set-save').addEventListener('click', saveSettings);
  }

  function startAppDrag(event) {
    if (event.target.tagName === 'BUTTON' || event.target.closest('button')) return;
    const rect = state.app.getBoundingClientRect();
    state.draggingApp = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top
    };
    state.shadow.getElementById('drag-handle').setPointerCapture(event.pointerId);
    window.addEventListener('pointermove', moveAppDrag);
    window.addEventListener('pointerup', stopAppDrag, { once: true });
    event.preventDefault();
  }

  function moveAppDrag(event) {
    if (!state.draggingApp) return;
    const nextLeft = state.draggingApp.left + (event.clientX - state.draggingApp.startX);
    const nextTop = state.draggingApp.top + (event.clientY - state.draggingApp.startY);
    const maxLeft = Math.max(0, window.innerWidth - state.app.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - state.app.offsetHeight);
    state.app.style.left = Math.min(Math.max(nextLeft, 0), maxLeft) + 'px';
    state.app.style.top = Math.min(Math.max(nextTop, 0), maxTop) + 'px';
    state.app.style.right = 'auto';
  }

  function stopAppDrag(event) {
    if (!state.draggingApp) return;
    try {
      state.shadow.getElementById('drag-handle').releasePointerCapture(state.draggingApp.pointerId || event.pointerId);
    } catch (error) {
      // Safe to ignore if capture was already released.
    }
    sessionStorage.setItem(POSITION_X_KEY, state.app.style.left);
    sessionStorage.setItem(POSITION_Y_KEY, state.app.style.top);
    state.draggingApp = null;
    window.removeEventListener('pointermove', moveAppDrag);
  }

  function handleTabsWheel(event) {
    if (event.deltaY !== 0) {
      event.preventDefault();
      event.currentTarget.scrollLeft += event.deltaY;
    }
  }

  function startTabsDrag(event) {
    const tabsContainer = state.shadow.getElementById('preview-tabs-container');
    state.draggingTabs = {
      pointerId: event.pointerId,
      startX: event.pageX - tabsContainer.offsetLeft,
      scrollLeft: tabsContainer.scrollLeft
    };
    state.hasDraggedTabs = false;
    tabsContainer.setPointerCapture(event.pointerId);
  }

  function moveTabsDrag(event) {
    if (!state.draggingTabs) return;
    const tabsContainer = state.shadow.getElementById('preview-tabs-container');
    const x = event.pageX - tabsContainer.offsetLeft;
    const walk = x - state.draggingTabs.startX;
    if (Math.abs(walk) > 5) state.hasDraggedTabs = true;
    tabsContainer.scrollLeft = state.draggingTabs.scrollLeft - walk;
  }

  function stopTabsDrag(event) {
    if (!state.draggingTabs) return;
    const tabsContainer = state.shadow.getElementById('preview-tabs-container');
    try {
      tabsContainer.releasePointerCapture(state.draggingTabs.pointerId || event.pointerId);
    } catch (error) {
      // Safe to ignore if capture was already released.
    }
    state.draggingTabs = null;
    setTimeout(() => { state.hasDraggedTabs = false; }, 30);
  }

  function runSearch() {
    const input = state.shadow.getElementById('search-input');
    const query = input.value.toLowerCase();
    const list = state.shadow.getElementById('results-list');
    list.innerHTML = '';

    if (query.length < 2) {
      updateStatus();
      return;
    }

    if (!state.docData.length) refreshData();

    const sensitivity = parseInt(state.appSettings.sens, 10);
    let searchRegex;
    if (sensitivity > 1) {
      const fuzzyStr = escapeRegExp(query).split('').join('.{0,' + (sensitivity - 1) + '}');
      searchRegex = new RegExp(fuzzyStr, 'gi');
    }

    const paras = (state.docData[0]?.text || '').split(/\n+/).map((para) => para.trim()).filter(Boolean);
    paras.forEach((para, index) => {
      const matchInfo = findMatch(para, query, searchRegex, sensitivity);
      if (!matchInfo.isMatch) return;

      const matchId = 'block-' + index;
      const item = document.createElement('div');
      item.className = 'result-item';
      item.dataset.id = matchId;
      if (state.activePreviewId === matchId) item.classList.add('active');

      const start = Math.max(0, matchInfo.index - 30);
      const end = Math.min(para.length, matchInfo.index + matchInfo.length + 30);
      const snippetText = para.substring(start, end);
      item.innerHTML = `<span class="tab-tag">${escapeHTML(sourceLabel())} match</span><div class="snippet">...${highlightText(snippetText, query, sensitivity)}...</div>`;

      item.addEventListener('click', () => openMatchPreview(matchId, para, paras, index, query, sensitivity));
      list.appendChild(item);
    });

    updateStatus();
  }

  function findMatch(para, query, regex, sensitivity) {
    if (sensitivity === 1) {
      const lower = para.toLowerCase();
      const index = lower.indexOf(query);
      return { isMatch: index !== -1, index, length: query.length };
    }

    if (!regex) return { isMatch: false, index: -1, length: query.length };
    regex.lastIndex = 0;
    const match = regex.exec(para);
    if (!match) return { isMatch: false, index: -1, length: query.length };
    return { isMatch: true, index: match.index, length: match[0].length };
  }

  function highlightText(text, query, sensitivity) {
    const safe = escapeHTML(text);
    if (!query) return safe;
    if (sensitivity === 1) {
      return safe.replace(new RegExp('(' + escapeRegExp(query) + ')', 'gi'), '<b>$1</b>');
    }
    const previewRegex = new RegExp(escapeRegExp(query).split('').join('.{0,' + (sensitivity - 1) + '}'), 'gi');
    return safe.replace(previewRegex, '<b>$&</b>');
  }

  function openMatchPreview(matchId, para, paras, index, query, sensitivity) {
    const existing = state.openPreviews.find((preview) => preview.id === matchId);
    if (existing) {
      state.activePreviewId = matchId;
      renderTabs();
      return;
    }

    const prevLen = parseInt(state.appSettings.prevLen, 10) || 1;
    const contextStart = Math.max(0, index - prevLen);
    const contextEnd = Math.min(paras.length, index + prevLen + 1);
    const contextText = paras.slice(contextStart, contextEnd).join('\n\n');
    const newTabData = {
      id: matchId,
      label: sourceLabel(),
      para,
      fullText: highlightText(contextText, query, sensitivity),
      lineInfo: `${index + 1} / ${paras.length}`,
      locked: false
    };

    let targetTab = state.openPreviews.find((preview) => preview.id === state.activePreviewId && !preview.locked);
    if (!targetTab) targetTab = state.openPreviews.find((preview) => !preview.locked);

    if (targetTab) {
      Object.assign(targetTab, newTabData);
      state.activePreviewId = targetTab.id;
    } else {
      state.openPreviews.push(newTabData);
      state.activePreviewId = matchId;
    }

    renderTabs();
  }

  function clearUnlockedTabs() {
    const input = state.shadow.getElementById('search-input');
    const list = state.shadow.getElementById('results-list');
    input.value = '';
    list.innerHTML = '';
    state.openPreviews = state.openPreviews.filter((preview) => preview.locked);
    state.activePreviewId = state.openPreviews.length ? state.openPreviews[0].id : null;
    renderTabs();
  }

  function downloadActivePreview() {
    if (!state.activePreviewId) return;
    const contentDiv = state.shadow.getElementById('preview-content');
    if (!contentDiv || !contentDiv.innerText) return;
    const blob = new Blob([contentDiv.innerText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Specnoto_Extract_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function jumpToSelectedMatch() {
    if (!state.selectedMatch) return;
    state.originalSnapshot = window.scrollY;
    const searchText = state.selectedMatch.trim();
    const found = selectTextInSource(searchText);
    if (!found && typeof window.find === 'function') {
      const fallbackText = searchText.substring(0, 60);
      window.getSelection().removeAllRanges();
      let windowFound = window.find(fallbackText, false, false, true, false, false, false);
      if (!windowFound) {
        window.scrollTo(0, 0);
        windowFound = window.find(fallbackText, false, false, true, false, false, false);
      }
      if (windowFound) scrollSelectionIntoView();
    }
    const back = state.shadow.getElementById('btn-back');
    if (back) back.disabled = false;
  }

  function selectTextInSource(text) {
    const root = getSourceRoot();
    if (!root || !text) return false;

    const candidates = [text.substring(0, 90), text.substring(0, 60), text.substring(0, 40), text.substring(0, 24)]
      .map((item) => item.trim())
      .filter((item) => item.length >= 8);

    for (const candidate of candidates) {
      const found = findTextNodeContaining(root, candidate);
      if (found) {
        const range = document.createRange();
        range.setStart(found.node, found.index);
        range.setEnd(found.node, found.index + candidate.length);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        scrollSelectionIntoView();
        return true;
      }
    }

    return false;
  }

  function findTextNodeContaining(root, needle) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('#specnoto-host, script, style, noscript')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let node = walker.nextNode();
    while (node) {
      const index = node.nodeValue.indexOf(needle);
      if (index !== -1) return { node, index };
      node = walker.nextNode();
    }
    return null;
  }

  function scrollSelectionIntoView() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const target = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer;
    if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function returnToOriginalScroll() {
    if (typeof state.originalSnapshot === 'number') {
      window.scrollTo({ top: state.originalSnapshot, behavior: 'smooth' });
    }
    const back = state.shadow.getElementById('btn-back');
    if (back) back.disabled = true;
  }

  function saveSettings() {
    const s = state.appSettings;
    s.width = parseIntValue('cfg-width', s.width);
    s.fontSize = parseIntValue('cfg-font', s.fontSize);
    s.uiPadding = parseIntValue('cfg-pad', s.uiPadding);
    s.bg = valueOf('cfg-bg', s.bg);
    s.panel = valueOf('cfg-panel', s.panel);
    s.text = valueOf('cfg-text', s.text);
    s.accent = valueOf('cfg-accent', s.accent);
    s.prevLen = parseIntValue('cfg-prev', s.prevLen);
    s.sens = parseIntValue('cfg-sens', s.sens);
    s.emSettings = valueOf('cfg-em-settings', s.emSettings);
    s.emBack = valueOf('cfg-em-back', s.emBack);
    s.emJump = valueOf('cfg-em-jump', s.emJump);
    s.emClear = valueOf('cfg-em-clear', s.emClear);
    s.emSearch = valueOf('cfg-em-search', s.emSearch);
    s.emDownload = valueOf('cfg-em-download', s.emDownload);
    s.emPin = valueOf('cfg-em-pin', s.emPin);

    applyTheme(s);
    storageSet({ [SETTINGS_KEY]: s });
    state.shadow.getElementById('settings-panel').style.display = 'none';
    const input = state.shadow.getElementById('search-input');
    if (input) input.dispatchEvent(new Event('input'));
  }

  function valueOf(id, fallback) {
    const el = state.shadow.getElementById(id);
    return el && el.value !== '' ? el.value : fallback;
  }

  function parseIntValue(id, fallback) {
    const value = parseInt(valueOf(id, fallback), 10);
    return Number.isFinite(value) ? value : fallback;
  }

  function bindCapsanotoButtons() {
    if (state.buttonBound) return;
    const buttons = document.querySelectorAll('[data-capsanoto-tool="specnoto"], #specnotoButton');
    buttons.forEach((button) => {
      if (button.dataset.specnotoBound === 'true') return;
      button.dataset.specnotoBound = 'true';
      button.addEventListener('click', () => api.toggle());
    });
    state.buttonBound = buttons.length > 0;
  }

  function configure(options = {}) {
    state.options = { ...state.options, ...options };
    state.sourceRoot = null;
    return api;
  }

  function destroy() {
    close();
    if (state.host) state.host.remove();
    state.host = null;
    state.shadow = null;
    state.app = null;
    state.docData = [];
    state.openPreviews = [];
    state.activePreviewId = null;
    state.visible = false;
  }

  const api = {
    __ready: true,
    version: MODULE_VERSION,
    init,
    configure,
    toggle,
    open,
    close,
    refresh: refreshData,
    destroy
  };

  window.CapsanotoSpecnoto = api;

  document.addEventListener('capsanoto:toggle-specnoto', () => api.toggle());
  document.addEventListener('capsanoto:open-specnoto', () => api.open());
  document.addEventListener('capsanoto:close-specnoto', () => api.close());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bindCapsanotoButtons();
      api.init();
    }, { once: true });
  } else {
    bindCapsanotoButtons();
    api.init();
  }
})();
