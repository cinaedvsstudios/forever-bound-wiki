const DEFAULT_FAVORITE_COLORS = [
  '#bda170',
  '#191711',
  '#111111',
  '#d88a64',
  '#41096f',
  '#881353',
  '#2e2721',
  '#2c2c2c',
  '#ffffff',
  '#6e4a2b',
];

const DESIGN_SETTINGS_KEY = 'designSettings';
const FAVORITE_COLORS_SETTING = 'favoriteColors';
const DRAG_COLOR_MIME = 'text/x-favorite-color';

const state = {
  lastColorInput: null,
  favoriteColors: [],
};

function normalizeHex(value) {
  const raw = String(value || '').trim();
  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  const shortMatch = withHash.match(/^#([0-9a-fA-F]{3})$/);

  if (shortMatch) {
    return `#${shortMatch[1].split('').map((char) => char + char).join('')}`.toLowerCase();
  }

  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toLowerCase() : null;
}

function getReadableTextColor(hex) {
  const color = normalizeHex(hex) || '#ffffff';
  const red = parseInt(color.slice(1, 3), 16);
  const green = parseInt(color.slice(3, 5), 16);
  const blue = parseInt(color.slice(5, 7), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

  return luminance >= 140 ? '#111111' : '#ffffff';
}

function getStoredDesignSettings() {
  const stored = localStorage.getItem(DESIGN_SETTINGS_KEY);
  return stored ? JSON.parse(stored) : {};
}

function saveStoredDesignSettings(settings) {
  localStorage.setItem(DESIGN_SETTINGS_KEY, JSON.stringify(settings));
}

function getDesignSetting(name, fallback) {
  const settings = getStoredDesignSettings();
  return Object.prototype.hasOwnProperty.call(settings, name) ? settings[name] : fallback;
}

function setDesignSetting(name, value) {
  const settings = getStoredDesignSettings();
  settings[name] = value;
  saveStoredDesignSettings(settings);
}

function persistFavoriteColors() {
  setDesignSetting(FAVORITE_COLORS_SETTING, state.favoriteColors);
}

function setSwatchColor(element, hex) {
  const color = normalizeHex(hex) || DEFAULT_FAVORITE_COLORS[0];
  element.textContent = color;
  element.dataset.color = color;
  element.style.setProperty('--swatch-color', color);
  element.style.setProperty('--swatch-text', getReadableTextColor(color));
  element.setAttribute('aria-label', `${element.classList.contains('current-color-box') ? 'Current Color' : 'Favorite color'} ${color}`);
}

function getActiveColorInput() {
  if (state.lastColorInput && document.contains(state.lastColorInput)) {
    return state.lastColorInput;
  }

  state.lastColorInput = document.querySelector('input[type="color"]');
  return state.lastColorInput;
}

function updateCurrentColor(hex, options = {}) {
  const color = normalizeHex(hex);
  if (!color) return;

  const activeColorHex = document.querySelector('#activeColorHex');
  const currentColorBox = document.querySelector('#currentColorBox');
  const activeColorInput = getActiveColorInput();

  if (activeColorHex) activeColorHex.value = color;
  if (currentColorBox) setSwatchColor(currentColorBox, color);

  if (activeColorInput && options.updateInput !== false) {
    activeColorInput.value = color;
  }
}

function replaceFavoriteColor(index, hex) {
  const color = normalizeHex(hex);
  if (!color || index < 0 || index >= state.favoriteColors.length) return;

  state.favoriteColors[index] = color;
  persistFavoriteColors();
  renderFavoriteColors();
}

function handleFavoriteClick(event) {
  const color = event.currentTarget.dataset.color;
  updateCurrentColor(color);
}

function handleFavoriteDragStart(event) {
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData(DRAG_COLOR_MIME, event.currentTarget.dataset.color);
  event.dataTransfer.setData('text/plain', event.currentTarget.dataset.color);
}

function handleFavoriteDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('is-drag-over');

  const color = normalizeHex(event.dataTransfer.getData(DRAG_COLOR_MIME) || event.dataTransfer.getData('text/plain'));
  const targetIndex = Number.parseInt(event.currentTarget.dataset.index, 10);

  replaceFavoriteColor(targetIndex, color);
}

function renderFavoriteColors() {
  const slots = document.querySelector('#favoriteColorSlots');
  if (!slots) return;

  slots.replaceChildren(...state.favoriteColors.map((color, index) => {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'favorite-color-slot';
    slot.draggable = true;
    slot.dataset.index = String(index);
    setSwatchColor(slot, color);

    slot.addEventListener('click', handleFavoriteClick);
    slot.addEventListener('dragstart', handleFavoriteDragStart);
    slot.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      slot.classList.add('is-drag-over');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('is-drag-over'));
    slot.addEventListener('drop', handleFavoriteDrop);

    return slot;
  }));
}

function initializeFavoriteColors() {
  const storedFavorites = getDesignSetting(FAVORITE_COLORS_SETTING, DEFAULT_FAVORITE_COLORS);
  state.favoriteColors = (Array.isArray(storedFavorites) ? storedFavorites : DEFAULT_FAVORITE_COLORS)
    .map(normalizeHex)
    .filter(Boolean);

  if (state.favoriteColors.length === 0) {
    state.favoriteColors = [...DEFAULT_FAVORITE_COLORS];
  }

  renderFavoriteColors();
  updateCurrentColor(document.querySelector('#activeColorHex')?.value || state.favoriteColors[0]);
}

function initializeColorInputs() {
  document.querySelectorAll('input[type="color"]').forEach((input) => {
    input.addEventListener('click', () => {
      state.lastColorInput = input;
    });

    input.addEventListener('focus', () => {
      state.lastColorInput = input;
    });

    input.addEventListener('input', () => {
      state.lastColorInput = input;
      updateCurrentColor(input.value, { updateInput: false });
    });
  });
}

function initializeActiveHexInput() {
  const activeColorHex = document.querySelector('#activeColorHex');
  if (!activeColorHex) return;

  activeColorHex.addEventListener('input', () => {
    const color = normalizeHex(activeColorHex.value);
    if (color) updateCurrentColor(color);
  });

  activeColorHex.addEventListener('blur', () => {
    const color = normalizeHex(activeColorHex.value) || document.querySelector('#currentColorBox')?.dataset.color;
    if (color) updateCurrentColor(color);
  });
}

function initializeCurrentColorDrag() {
  const currentColorBox = document.querySelector('#currentColorBox');
  if (!currentColorBox) return;

  currentColorBox.addEventListener('dragstart', (event) => {
    const color = currentColorBox.dataset.color;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(DRAG_COLOR_MIME, color);
    event.dataTransfer.setData('text/plain', color);
  });
}

function initializeFavoriteColorPalette() {
  initializeColorInputs();
  initializeActiveHexInput();
  initializeCurrentColorDrag();
  initializeFavoriteColors();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFavoriteColorPalette);
} else {
  initializeFavoriteColorPalette();
}

window.favoriteColorPalette = {
  state,
  normalizeHex,
  updateCurrentColor,
  replaceFavoriteColor,
  getDesignSetting,
  setDesignSetting,
};
