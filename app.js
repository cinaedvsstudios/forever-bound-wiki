const HEX_SHORT_OR_LONG = /^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DEFAULT_SETTINGS_PATH = 'data.json';

const designerState = {
  settings: null,
};

function normalizeHex(value) {
  const rawValue = String(value || '').trim();

  if (!HEX_SHORT_OR_LONG.test(rawValue)) {
    return null;
  }

  const hex = rawValue.replace(/^#/, '').toLowerCase();
  const expanded = hex.length === 3
    ? hex.split('').map((character) => character + character).join('')
    : hex;

  return `#${expanded}`;
}

function getStatusElement() {
  return document.getElementById('designerStatus');
}

function setDesignerStatus(message, tone = 'info') {
  const status = getStatusElement();
  if (!status) return;

  status.textContent = message;
  status.dataset.tone = tone;
}

function updateCurrentColor(hex) {
  const currentColor = document.getElementById('currentColorValue');
  if (!currentColor) return;

  currentColor.value = hex;
  currentColor.textContent = hex;
}

function toCamelIdentifier(path) {
  return path
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, character) => character.toUpperCase())
    .replace(/^[^a-zA-Z]+/, '')
    .replace(/^./, (character) => character.toLowerCase());
}

function escapeSelectorValue(value) {
  if (window.CSS?.escape) {
    return CSS.escape(value);
  }

  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function findPairedHexInput(colorInput) {
  if (colorInput.dataset.colorFor) {
    return document.querySelector(`input[data-hex-for="${escapeSelectorValue(colorInput.dataset.colorFor)}"]`);
  }

  if (colorInput.id.endsWith('Color')) {
    return document.getElementById(`${colorInput.id.slice(0, -5)}Hex`);
  }

  return colorInput.closest('.color-control')?.querySelector('.color-control__hex') || null;
}

function findPairedColorInput(hexInput) {
  if (hexInput.dataset.hexFor) {
    return document.querySelector(`input[type="color"][data-color-for="${escapeSelectorValue(hexInput.dataset.hexFor)}"]`);
  }

  if (hexInput.id.endsWith('Hex')) {
    return document.getElementById(`${hexInput.id.slice(0, -3)}Color`);
  }

  return hexInput.closest('.color-control')?.querySelector('input[type="color"]') || null;
}

function getPathParts(path) {
  return String(path || '').split('.').filter(Boolean);
}

function setSettingByPath(path, value) {
  if (!designerState.settings) return;

  const pathParts = getPathParts(path);
  let target = designerState.settings;

  if (pathParts[0] === 'system') {
    target = designerState.settings.settings?.systemStyles || designerState.settings.systemStyles;
    pathParts.shift();
  }

  if (!target || !pathParts.length) return;

  for (let index = 0; index < pathParts.length - 1; index += 1) {
    target = target[pathParts[index]];
    if (!target) return;
  }

  target[pathParts.at(-1)] = value;
}

function applyColorSetting(path, hex, { save = true } = {}) {
  if (path) {
    setSettingByPath(path, hex);
    document.documentElement.style.setProperty(`--${path.replace(/[^a-zA-Z0-9-]/g, '-')}`, hex);
  }

  updateCurrentColor(hex);

  window.dispatchEvent(new CustomEvent('element-designer:color-change', {
    detail: { path, value: hex },
  }));

  if (save) {
    saveAndApplySettings();
  }
}

function saveAndApplySettings() {
  if (typeof window.applySettings === 'function') {
    window.applySettings(designerState.settings);
  }

  if (typeof window.saveSettings === 'function') {
    window.saveSettings(designerState.settings);
  }

  window.dispatchEvent(new CustomEvent('element-designer:settings-save', {
    detail: { settings: designerState.settings },
  }));
}

function handleColorInput(event) {
  if (!(event.target instanceof Element)) return;

  const colorInput = event.target.closest('input[type="color"][data-color-for], .color-control input[type="color"]');
  if (!colorInput) return;

  const normalizedColor = normalizeHex(colorInput.value);
  if (!normalizedColor) return;

  const hexInput = findPairedHexInput(colorInput);
  if (hexInput) {
    hexInput.value = normalizedColor;
  }

  colorInput.value = normalizedColor;
  applyColorSetting(colorInput.dataset.colorFor, normalizedColor);
  setDesignerStatus(`Applied ${normalizedColor}.`, 'success');
}

function commitHexInput(hexInput) {
  const colorInput = findPairedColorInput(hexInput);
  const normalizedColor = normalizeHex(hexInput.value);

  if (!normalizedColor) {
    setDesignerStatus('Enter a valid hex color, such as #c9a or #cc99aa.', 'error');
    return false;
  }

  hexInput.value = normalizedColor;

  if (colorInput) {
    colorInput.value = normalizedColor;
    applyColorSetting(hexInput.dataset.hexFor || colorInput.dataset.colorFor, normalizedColor);
  } else {
    updateCurrentColor(normalizedColor);
    saveAndApplySettings();
  }

  setDesignerStatus(`Applied ${normalizedColor}.`, 'success');
  return true;
}

function handleHexBlur(event) {
  if (!(event.target instanceof Element)) return;

  const hexInput = event.target.closest('.color-control__hex, input[data-hex-for]');
  if (!hexInput) return;

  commitHexInput(hexInput);
}

function handleHexKeydown(event) {
  if (event.key !== 'Enter' || !(event.target instanceof Element)) return;

  const hexInput = event.target.closest('.color-control__hex, input[data-hex-for]');
  if (!hexInput) return;

  event.preventDefault();
  commitHexInput(hexInput);
}

function createColorControl({ path, label, value }) {
  const template = document.getElementById('colorControlTemplate');
  const fragment = template.content.cloneNode(true);
  const control = fragment.querySelector('.color-control');
  const labelText = fragment.querySelector('.color-control__label');
  const colorInput = fragment.querySelector('.color-control__picker');
  const hexInput = fragment.querySelector('.color-control__hex');
  const normalizedColor = normalizeHex(value) || '#000000';
  const inputBaseId = toCamelIdentifier(path);

  control.dataset.colorControlFor = path;
  labelText.textContent = label;

  colorInput.id = `${inputBaseId}Color`;
  colorInput.name = path;
  colorInput.value = normalizedColor;
  colorInput.dataset.colorFor = path;
  colorInput.setAttribute('aria-label', `${label} color picker`);

  hexInput.id = `${inputBaseId}Hex`;
  hexInput.name = `${path}.hex`;
  hexInput.value = normalizedColor;
  hexInput.dataset.hexFor = path;
  hexInput.setAttribute('aria-label', `${label} hex code`);

  return fragment;
}

function getSystemColorDescriptors(settings) {
  const systemStyles = settings?.settings?.systemStyles || settings?.systemStyles || {};

  return Object.entries(systemStyles).flatMap(([systemId, styleConfig]) => (
    Object.entries(styleConfig)
      .filter(([propertyName, value]) => /color/i.test(propertyName) && normalizeHex(value))
      .map(([propertyName, value]) => ({
        path: `system.${systemId}.${propertyName}`,
        label: `${styleConfig.name || systemId} ${propertyName}`,
        value,
      }))
  ));
}

function renderSystemColorControls(settings) {
  const container = document.getElementById('systemColorControls');
  if (!container) return;

  const controls = getSystemColorDescriptors(settings);
  container.replaceChildren();

  if (!controls.length) {
    container.textContent = 'No system color controls were found.';
    return;
  }

  controls.forEach((controlConfig) => {
    container.append(createColorControl(controlConfig));
  });

  updateCurrentColor(normalizeHex(controls[0].value) || '#000000');
}

async function loadDesignerSettings() {
  try {
    const response = await fetch(DEFAULT_SETTINGS_PATH);
    if (!response.ok) {
      throw new Error(`Unable to load ${DEFAULT_SETTINGS_PATH}.`);
    }

    designerState.settings = await response.json();
  } catch (error) {
    designerState.settings = { settings: { systemStyles: {} } };
    setDesignerStatus(error.message, 'error');
  }

  renderSystemColorControls(designerState.settings);
}

function initializeColorControls(root = document) {
  root.addEventListener('input', handleColorInput);
  root.addEventListener('blur', handleHexBlur, true);
  root.addEventListener('keydown', handleHexKeydown);
}

document.addEventListener('DOMContentLoaded', () => {
  initializeColorControls();
  loadDesignerSettings();
});

window.ElementDesignerColorControls = {
  initializeColorControls,
  normalizeHex,
};
