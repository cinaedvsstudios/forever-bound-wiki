const DESIGN_KEY = 'capsanoto-design-settings-v1';
const HEX_SHORT_OR_LONG = /^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const state = {
  lastColorInput: null,
  settings: {},
};

function normalizeHexColor(value) {
  const raw = String(value || '').trim();
  if (!HEX_SHORT_OR_LONG.test(raw)) return '';

  const hex = raw.replace(/^#/, '').toLowerCase();
  const normalized = hex.length === 3
    ? hex.split('').map((character) => character + character).join('')
    : hex;

  return `#${normalized}`;
}

function setDesignerStatus(message, tone = 'info') {
  const status = document.querySelector('#designerStatus');
  if (!status) return;

  status.textContent = message;
  status.dataset.tone = tone;
}

function updateCurrentColor(value) {
  const color = normalizeHexColor(value);
  if (!color) return;

  const currentColor = document.querySelector('#currentColorValue');
  const activeHex = document.querySelector('#activeColorHex');

  if (currentColor) {
    currentColor.value = color;
    currentColor.textContent = color;
  }

  if (activeHex && document.activeElement !== activeHex) {
    activeHex.value = color;
  }
}

function selectorEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function findPairedHexInput(colorInput) {
  if (colorInput.dataset.colorFor) {
    return document.querySelector(`input[data-hex-for="${selectorEscape(colorInput.dataset.colorFor)}"]`);
  }

  if (colorInput.id.endsWith('Color')) {
    return document.querySelector(`#${selectorEscape(colorInput.id.slice(0, -5))}Hex`);
  }

  return colorInput.closest('.color-control')?.querySelector('.color-control__hex') || null;
}

function findPairedColorInput(hexInput) {
  if (hexInput.dataset.hexFor) {
    return document.querySelector(`input[type="color"][data-color-for="${selectorEscape(hexInput.dataset.hexFor)}"]`);
  }

  if (hexInput.id.endsWith('Hex')) {
    return document.querySelector(`#${selectorEscape(hexInput.id.slice(0, -3))}Color`);
  }

  return hexInput.closest('.color-control')?.querySelector('input[type="color"]') || null;
}

function colorPathToCustomProperty(path) {
  const propertyMap = {
    'system.buttonBg': '--button',
    'system.borderColor': '--line',
    'system.textColor': '--ink',
    'dialog.bg': '--dialog-bg',
    'dialog.border': '--dialog-border',
    'dialog.shadow': '--dialog-shadow',
    'dialog.text': '--dialog-text',
    'dialog.buttonBg': '--dialog-button-bg',
    'dialog.buttonBorder': '--dialog-button-border',
    'dialog.buttonText': '--dialog-button-text',
    'dialog.buttonShadow': '--dialog-button-shadow',
    'writingRoom.statusBg': '--status-bg',
    'writingRoom.statusBorder': '--status-border',
    'writingRoom.statusText': '--status-text',
    'writingRoom.emphasisBg': '--emphasis-bg',
    'writingRoom.emphasisBorder': '--emphasis-border',
    'writingRoom.emphasisText': '--emphasis-text',
    'settings.panelBg': '--panel-bg',
    'settings.panelBorder': '--panel-border',
    'settings.labelText': '--label-text',
    'settings.dynamicText': '--dynamic-text',
    'help.scrollbarTrack': '--scrollbar-track',
    'help.scrollbarThumb': '--scrollbar-thumb',
  };

  return propertyMap[path] || `--${path.replace(/[^a-zA-Z0-9-]/g, '-')}`;
}

function saveAndApplySettings() {
  localStorage.setItem(DESIGN_KEY, JSON.stringify(state.settings));
  window.dispatchEvent(new CustomEvent('element-designer:settings-save', { detail: { settings: state.settings } }));
}

function applyColorSetting(path, color, { save = true } = {}) {
  if (path) {
    state.settings[path] = color;
    document.documentElement.style.setProperty(colorPathToCustomProperty(path), color);
  }

  updateCurrentColor(color);
  window.dispatchEvent(new CustomEvent('element-designer:color-change', { detail: { path, value: color } }));

  if (save) saveAndApplySettings();
}

function handleColorInput(event) {
  if (!(event.target instanceof Element)) return;

  const colorInput = event.target.closest('input[type="color"][data-color-for], .color-control input[type="color"]');
  if (!colorInput) return;

  const color = normalizeHexColor(colorInput.value);
  if (!color) return;

  state.lastColorInput = colorInput;
  colorInput.value = color;

  const hexInput = findPairedHexInput(colorInput);
  if (hexInput) hexInput.value = color;

  applyColorSetting(colorInput.dataset.colorFor, color);
  setDesignerStatus(`Applied ${color}.`, 'success');
}

function commitHexInput(hexInput) {
  const color = normalizeHexColor(hexInput.value);
  if (!color) {
    setDesignerStatus('Enter a valid hex color, such as #c9a or #cc99aa.', 'error');
    return false;
  }

  const colorInput = findPairedColorInput(hexInput) || state.lastColorInput;
  hexInput.value = color;

  if (colorInput) {
    colorInput.value = color;
    state.lastColorInput = colorInput;
    applyColorSetting(hexInput.dataset.hexFor || colorInput.dataset.colorFor, color);
  } else {
    updateCurrentColor(color);
    saveAndApplySettings();
  }

  setDesignerStatus(`Applied ${color}.`, 'success');
  return true;
}

function handleHexBlur(event) {
  if (!(event.target instanceof Element)) return;

  const hexInput = event.target.closest('.color-control__hex, input[data-hex-for], #activeColorHex');
  if (!hexInput) return;

  commitHexInput(hexInput);
}

function handleHexKeydown(event) {
  if (event.key !== 'Enter' || !(event.target instanceof Element)) return;

  const hexInput = event.target.closest('.color-control__hex, input[data-hex-for], #activeColorHex');
  if (!hexInput) return;

  event.preventDefault();
  commitHexInput(hexInput);
}

function loadSavedColorSettings() {
  try {
    state.settings = JSON.parse(localStorage.getItem(DESIGN_KEY) || '{}') || {};
  } catch (error) {
    state.settings = {};
    localStorage.removeItem(DESIGN_KEY);
    console.warn('Ignoring unreadable Capsanoto design settings', error);
  }

  document.querySelectorAll('input[type="color"][data-color-for]').forEach((colorInput) => {
    const savedColor = normalizeHexColor(state.settings[colorInput.dataset.colorFor]);
    const color = savedColor || normalizeHexColor(colorInput.value) || '#000000';
    const hexInput = findPairedHexInput(colorInput);

    colorInput.value = color;
    if (hexInput) hexInput.value = color;
    applyColorSetting(colorInput.dataset.colorFor, color, { save: false });
    if (!state.lastColorInput) state.lastColorInput = colorInput;
  });

  if (state.lastColorInput) updateCurrentColor(state.lastColorInput.value);
}

function resetDesignSettings() {
  localStorage.removeItem(DESIGN_KEY);
  state.settings = {};
  document.querySelectorAll('input[type="color"][data-color-for]').forEach((colorInput) => {
    const color = normalizeHexColor(colorInput.defaultValue || colorInput.getAttribute('value')) || '#000000';
    const hexInput = findPairedHexInput(colorInput);
    colorInput.value = color;
    if (hexInput) hexInput.value = color;
    applyColorSetting(colorInput.dataset.colorFor, color, { save: false });
  });
  saveAndApplySettings();
  setDesignerStatus('Design reset.', 'success');
}

function initializeColorControls(root = document) {
  root.addEventListener('input', handleColorInput);
  root.addEventListener('blur', handleHexBlur, true);
  root.addEventListener('keydown', handleHexKeydown);

  document.querySelector('#applyDesignButton')?.addEventListener('click', saveAndApplySettings);
  document.querySelector('#resetDesignButton')?.addEventListener('click', resetDesignSettings);
}

document.addEventListener('DOMContentLoaded', () => {
  initializeColorControls();
  loadSavedColorSettings();
});

window.ElementDesignerColorControls = {
  initializeColorControls,
  normalizeHexColor,
};
