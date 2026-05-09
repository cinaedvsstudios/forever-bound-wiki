const DESIGN_STORAGE_KEY = "forever-bound-design-settings";

const DESIGN_SECTIONS = [
  { name: "system", label: "System" },
  { name: "topMenuBar", label: "Top Menu Bar" },
  { name: "writingRoom", label: "Writing Room / Filing Cabinet" },
  { name: "subnoto", label: "Subnoto" },
  { name: "specnoto", label: "Specnoto" },
  { name: "writingArea", label: "Writing Area" },
  { name: "help", label: "Help / Guidebook" },
  { name: "settingsWindow", label: "Settings Window" },
  { name: "transclusionCards", label: "Transclusion Cards" }
];

const SECTION_CSS_PREFIX = {
  system: "system",
  topMenuBar: "top-menu-bar",
  writingRoom: "writing-room",
  subnoto: "subnoto",
  specnoto: "specnoto",
  writingArea: "writing-area",
  help: "help",
  settingsWindow: "settings-window",
  transclusionCards: "transclusion-cards"
};

function baseDesignTokens(overrides = {}) {
  return {
    background: "#191711",
    foreground: "#f7ead2",
    accent: "#d88a64",
    surface: "#2e2721",
    fontSize: 16,
    borderRadius: 14,
    ...overrides
  };
}

function defaultDesignSettings() {
  return {
    system: baseDesignTokens(),
    topMenuBar: { useSystemDefaults: true, ...baseDesignTokens({ background: "#2e2721" }) },
    writingRoom: { useSystemDefaults: true, ...baseDesignTokens({ background: "#2e2721" }) },
    subnoto: { useSystemDefaults: true, ...baseDesignTokens({ background: "#30251f" }) },
    specnoto: { useSystemDefaults: true, ...baseDesignTokens({ background: "#271f2e" }) },
    writingArea: { useSystemDefaults: true, ...baseDesignTokens({ background: "#fff8e8", foreground: "#1b1610" }) },
    help: { useSystemDefaults: true, ...baseDesignTokens({ background: "#211d18" }) },
    settingsWindow: { useSystemDefaults: true, ...baseDesignTokens({ background: "#211d18" }) },
    transclusionCards: { useSystemDefaults: true, ...baseDesignTokens({ background: "#241f19" }) }
  };
}

function deepMergeDesignSettings(savedSettings = {}) {
  const defaults = defaultDesignSettings();
  return DESIGN_SECTIONS.reduce((settings, section) => {
    settings[section.name] = {
      ...defaults[section.name],
      ...(savedSettings[section.name] || {})
    };
    return settings;
  }, {});
}

function currentDesignSettingsFromForm() {
  const settings = defaultDesignSettings();

  document.querySelectorAll("[data-design-section]").forEach((card) => {
    const sectionName = card.dataset.designSection;
    const sectionSettings = { ...settings[sectionName] };
    const useSystemDefaults = card.querySelector("[data-design-use-system]");

    if (useSystemDefaults) {
      sectionSettings.useSystemDefaults = useSystemDefaults.checked;
    }

    card.querySelectorAll("[data-design-token]").forEach((input) => {
      const token = input.dataset.designToken;
      sectionSettings[token] = input.type === "number" ? Number(input.value) : input.value;
    });

    settings[sectionName] = sectionSettings;
  });

  return settings;
}

function saveDesignSettings(settings = currentDesignSettingsFromForm()) {
  const nestedSettings = deepMergeDesignSettings(settings);
  localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(nestedSettings));
  applyDesignSettings(nestedSettings);
  return nestedSettings;
}

function loadSavedDesignSettings() {
  const rawSettings = localStorage.getItem(DESIGN_STORAGE_KEY);
  if (!rawSettings) {
    return defaultDesignSettings();
  }

  return deepMergeDesignSettings(JSON.parse(rawSettings));
}

function setInheritedControlsState(card) {
  const checkbox = card.querySelector("[data-design-use-system]");
  const inheritedControls = card.querySelector(".inherited-controls");

  if (!checkbox || !inheritedControls) {
    return;
  }

  inheritedControls.disabled = checkbox.checked;
  card.classList.toggle("is-inheriting", checkbox.checked);
}

function loadDesignForm(settings = loadSavedDesignSettings()) {
  document.querySelectorAll("[data-design-section]").forEach((card) => {
    const sectionName = card.dataset.designSection;
    const sectionSettings = settings[sectionName] || {};
    const checkbox = card.querySelector("[data-design-use-system]");

    if (checkbox) {
      checkbox.checked = sectionSettings.useSystemDefaults !== false;
    }

    card.querySelectorAll("[data-design-token]").forEach((input) => {
      const token = input.dataset.designToken;
      if (sectionSettings[token] !== undefined) {
        input.value = sectionSettings[token];
      }
    });

    setInheritedControlsState(card);
  });
}

function resolvedDesignSection(sectionName, settings = loadSavedDesignSettings()) {
  const system = settings.system || defaultDesignSettings().system;
  const section = settings[sectionName] || {};

  if (sectionName === "system" || section.useSystemDefaults === false) {
    return { ...system, ...section };
  }

  return { ...section, ...system, useSystemDefaults: true };
}

function setCssToken(prefix, token, value) {
  const cssToken = token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  const cssValue = token === "fontSize" || token === "borderRadius" ? `${value}px` : value;
  document.documentElement.style.setProperty(`--${prefix}-${cssToken}`, cssValue);
}

function applyDesignSettings(settings = loadSavedDesignSettings()) {
  DESIGN_SECTIONS.forEach(({ name }) => {
    const resolvedSection = resolvedDesignSection(name, settings);
    const prefix = SECTION_CSS_PREFIX[name];

    Object.entries(resolvedSection).forEach(([token, value]) => {
      if (token !== "useSystemDefaults") {
        setCssToken(prefix, token, value);
      }
    });
  });
}

function setAllDesignCards(open) {
  document.querySelectorAll(".design-card").forEach((card) => {
    card.open = open;
  });
}

function bindDesignControls() {
  document.querySelectorAll("[data-design-use-system]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      setInheritedControlsState(checkbox.closest("[data-design-section]"));
      saveDesignSettings();
    });
  });

  document.querySelectorAll("[data-design-token]").forEach((input) => {
    input.addEventListener("input", () => saveDesignSettings());
  });

  document.querySelectorAll("[data-design-expand-all]").forEach((button) => {
    button.addEventListener("click", () => setAllDesignCards(true));
  });

  document.querySelectorAll("[data-design-collapse-all]").forEach((button) => {
    button.addEventListener("click", () => setAllDesignCards(false));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const settings = loadSavedDesignSettings();
  loadDesignForm(settings);
  applyDesignSettings(settings);
  bindDesignControls();
});
