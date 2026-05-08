const STORAGE_KEY = "forever-bound-writing-room-v2";
const AUTH_KEY = "forever-bound-authenticated";
const AUTH_CONFIG_PATH = "config/auth.json";
const CONTENT_PATH = "content/documents.json";
const EDITOR_ENTRY = "editor.html";
const AUTOSAVE_DELAY = 600;
const DESIGN_KEY = "capsanoto-design-settings-v1";

const CAPSANOTO_PALETTE = {
  black: "#000000",
  deepPlum: "#28133f",
  espresso: "#211812",
  amethyst: "#563485",
  clay: "#724837",
  ochre: "#a97b38",
  ember: "#c55222",
  peach: "#e88f69",
  umber: "#2f251c",
  charcoal: "#2c2c2c",
  parchment: "#fbf4d6",
};

const DEFAULT_FAVORITE_COLORS = [
  CAPSANOTO_PALETTE.black,
  CAPSANOTO_PALETTE.deepPlum,
  CAPSANOTO_PALETTE.espresso,
  CAPSANOTO_PALETTE.amethyst,
  CAPSANOTO_PALETTE.clay,
  CAPSANOTO_PALETTE.ochre,
  CAPSANOTO_PALETTE.ember,
  CAPSANOTO_PALETTE.peach,
];

const DEFAULT_WORKSPACE = {
  schemaVersion: 2,
  updatedAt: "2026-05-08T00:00:00.000Z",
  documents: [
    {
      id: "episode-01",
      title: "Episode 01",
      tags: ["season-1", "episode"],
      updatedAt: "2026-05-07T00:00:00.000Z",
      content: '<h1 id="episode-01">Episode 01</h1><p>Draft the episode here in a clean writing environment.</p><h2 id="synopsis">Synopsis</h2><p>Write the episode summary.</p><h2 id="canon-notes">Canon Notes</h2><p>Use reusable TCards for shared lore, such as {{Location-Ironvale}}.</p><h2 id="structure">Structure</h2><table><thead><tr><th>Beat</th><th>Notes</th></tr></thead><tbody><tr><td>Opening</td><td></td></tr><tr><td>Turn</td><td></td></tr><tr><td>Ending</td><td></td></tr></tbody></table>',
    },
    {
      id: "Character-Mel-Ameldra",
      title: "Character Mel Ameldra",
      tags: ["character", "example", "deep-link"],
      updatedAt: "2026-05-08T00:00:00.000Z",
      content: '<h1 id="Overview">Character Mel Ameldra</h1><p>This starter profile demonstrates document URLs like <code>editor.html?doc=Character-Mel-Ameldra</code>.</p><h2 id="Runestones">Runestones</h2><p>This section demonstrates direct bookmark URLs like <code>editor.html?doc=Character-Mel-Ameldra#Runestones</code>.</p><h2 id="Relationships">Relationships</h2><p>Add linked characters, factions, and locations here.</p>',
    },
  ],
  blocks: {
    "Item-Runestones": {
      id: "Item-Runestones",
      content: "Runestones are reusable canon items that can be referenced across lore documents without duplicating text.",
      updatedAt: "2026-05-07T00:00:00.000Z",
    },
    "Location-Ironvale": {
      id: "Location-Ironvale",
      content: "Ironvale is a sample location block used to demonstrate how edits update every {{Location-Ironvale}} reference.",
      updatedAt: "2026-05-07T00:00:00.000Z",
    },
  },
};

const state = {
  documents: [],
  blocks: {},
  activeId: null,
  saveTimer: null,
  pendingBookmarkId: "",
  suppressInput: false,
  sharedPassword: "",
  authReady: false,
  exportItems: [],
  draggedExportIndex: null,
  savedRange: null,
  dialogResolver: null,
  writingRoomDrag: null,
  panelDrag: null,
  filingEditMode: false,
  filingGroups: [],
  trash: [],
  deprecated: [],
  draggedDocId: "",
  lastColorInput: null,
  favoriteColors: [...DEFAULT_FAVORITE_COLORS],
  contextStatusLocked: false,
  contextStatusTimer: null,
};

const els = {
  passwordScreen: document.querySelector("#passwordScreen"),
  passwordForm: document.querySelector("#passwordForm"),
  passwordInput: document.querySelector("#passwordInput"),
  passwordError: document.querySelector("#passwordError"),
  passwordSubmit: document.querySelector("#passwordForm button[type='submit']"),
  editorApp: document.querySelector("#editorApp"),
  documentSelect: document.querySelector("#documentSelect"),
  newDocumentButton: document.querySelector("#newDocumentButton"),
  documentSettingsButton: document.querySelector("#documentSettingsButton"),
  contextStatus: document.querySelector("#contextStatus"),
  saveStatus: document.querySelector("#saveStatus"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsPanel: document.querySelector("#settingsPanel"),
  closeSettingsPanel: document.querySelector("#closeSettingsPanel"),
  logoutButton: document.querySelector("#logoutButton"),
  toolbar: document.querySelector(".toolbar"),
  linkButton: document.querySelector("#linkButton"),
  editLinkButton: document.querySelector("#editLinkButton"),
  pillLinkButton: document.querySelector("#pillLinkButton"),
  removeLinkButton: document.querySelector("#removeLinkButton"),
  bookmarkButton: document.querySelector("#bookmarkButton"),
  tableButton: document.querySelector("#tableButton"),
  imageButton: document.querySelector("#imageButton"),
  imageInput: document.querySelector("#imageInput"),
  emojiButton: document.querySelector("#emojiButton"),
  blockButton: document.querySelector("#blockButton"),
  emphasisButton: document.querySelector("#emphasisButton"),
  topHelpButton: document.querySelector("#topHelpButton"),
  helpButton: document.querySelector("#helpButton"),
  exportSourceType: document.querySelector("#exportSourceType"),
  exportSourceSelect: document.querySelector("#exportSourceSelect"),
  addExportItemButton: document.querySelector("#addExportItemButton"),
  exportQueue: document.querySelector("#exportQueue"),
  exportCapsButton: document.querySelector("#exportCapsButton"),
  exportTxtButton: document.querySelector("#exportTxtButton"),
  exportHtmlButton: document.querySelector("#exportHtmlButton"),
  exportDocButton: document.querySelector("#exportDocButton"),
  designButtonBg: document.querySelector("#designButtonBg"),
  designBorderColor: document.querySelector("#designBorderColor"),
  designTextColor: document.querySelector("#designTextColor"),
  designFontSize: document.querySelector("#designFontSize"),
  designBold: document.querySelector("#designBold"),
  designBgImage: document.querySelector("#designBgImage"),
  dialogBgColor: document.querySelector("#dialogBgColor"),
  dialogBorderColor: document.querySelector("#dialogBorderColor"),
  dialogShadowColor: document.querySelector("#dialogShadowColor"),
  dialogTextColor: document.querySelector("#dialogTextColor"),
  dialogFontSize: document.querySelector("#dialogFontSize"),
  dialogBold: document.querySelector("#dialogBold"),
  dialogButtonBg: document.querySelector("#dialogButtonBg"),
  dialogButtonBorder: document.querySelector("#dialogButtonBorder"),
  dialogButtonText: document.querySelector("#dialogButtonText"),
  dialogButtonShadow: document.querySelector("#dialogButtonShadow"),
  labelTextColor: document.querySelector("#labelTextColor"),
  dynamicTextColor: document.querySelector("#dynamicTextColor"),
  scrollbarTrackColor: document.querySelector("#scrollbarTrackColor"),
  scrollbarThumbColor: document.querySelector("#scrollbarThumbColor"),
  statusBgColor: document.querySelector("#statusBgColor"),
  statusBorderColor: document.querySelector("#statusBorderColor"),
  statusTextColor: document.querySelector("#statusTextColor"),
  emphasisBgColor: document.querySelector("#emphasisBgColor"),
  emphasisBorderColor: document.querySelector("#emphasisBorderColor"),
  emphasisTextColor: document.querySelector("#emphasisTextColor"),
  panelBgColor: document.querySelector("#panelBgColor"),
  panelBorderColor: document.querySelector("#panelBorderColor"),
  designBoldToggle: document.querySelector("#designBoldToggle"),
  dialogBoldToggle: document.querySelector("#dialogBoldToggle"),
  activeColorHex: document.querySelector("#activeColorHex"),
  favoriteColors: document.querySelector("#favoriteColors"),
  settingsMenu: document.querySelector(".settings-menu"),
  settingsSections: document.querySelectorAll("[data-settings-section]"),
  writingRoomButton: document.querySelector("#writingRoomButton"),
  writingRoomPanel: document.querySelector("#writingRoomPanel"),
  writingRoomPanelHeader: document.querySelector("#writingRoomPanelHeader"),
  closeWritingRoomPanel: document.querySelector("#closeWritingRoomPanel"),
  editWritingRoomButton: document.querySelector("#editWritingRoomButton"),
  writingRoomEditBar: document.querySelector("#writingRoomEditBar"),
  newFolderButton: document.querySelector("#newFolderButton"),
  newTabButton: document.querySelector("#newTabButton"),
  trashCanButton: document.querySelector("#trashCanButton"),
  writingRoomCards: document.querySelector("#writingRoomCards"),
  selectionMenu: document.querySelector("#selectionMenu"),
  dialogOverlay: document.querySelector("#dialogOverlay"),
  dialogBox: document.querySelector("#dialogBox"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogFields: document.querySelector("#dialogFields"),
  dialogCancelButton: document.querySelector("#dialogCancelButton"),
  applyDesignButton: document.querySelector("#applyDesignButton"),
  resetDesignButton: document.querySelector("#resetDesignButton"),
  helpPanel: document.querySelector("#helpPanel"),
  closeHelpPanel: document.querySelector("#closeHelpPanel"),
  bookmarkBar: document.querySelector("#bookmarkBar"),
  titleInput: document.querySelector("#titleInput"),
  tagsInput: document.querySelector("#tagsInput"),
  editor: document.querySelector("#editor"),
  blockPanel: document.querySelector("#blockPanel"),
  closeBlockPanel: document.querySelector("#closeBlockPanel"),
  blockIdInput: document.querySelector("#blockIdInput"),
  blockContentInput: document.querySelector("#blockContentInput"),
  saveBlockButton: document.querySelector("#saveBlockButton"),
  insertBlockRefButton: document.querySelector("#insertBlockRefButton"),
  blockList: document.querySelector("#blockList"),
  documentTemplate: document.querySelector("#documentTemplate"),
};

boot().catch((error) => {
  console.error(error);
  showEditorStartupError(error);
});

async function boot() {
  markFrameMode();
  await startEditor();
}

async function loadAuthConfig() {
  const errors = [];
  for (const url of authConfigUrls()) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
      const config = await response.json();
      if (config.sharedPassword) {
        state.sharedPassword = config.sharedPassword;
        return;
      }
      throw new Error("Missing sharedPassword");
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }

  const fallbackPassword = els.passwordForm.dataset.sharedPassword;
  if (fallbackPassword) {
    console.warn(`Using embedded Capsanoto password fallback after config load failed: ${errors.join(" | ")}`);
    state.sharedPassword = fallbackPassword;
    return;
  }

  throw new Error(`Unable to load ${AUTH_CONFIG_PATH}. Tried ${errors.join(" | ")}`);
}

function authConfigUrls() {
  const urls = [];
  addUniqueUrl(urls, AUTH_CONFIG_PATH, document.baseURI);
  addUniqueUrl(urls, AUTH_CONFIG_PATH, location.href);
  const scriptSrc = document.currentScript?.src || document.querySelector('script[src$="app.js"]')?.src;
  if (scriptSrc) addUniqueUrl(urls, AUTH_CONFIG_PATH, scriptSrc);
  if (location.origin && location.origin !== "null") addUniqueUrl(urls, `/${AUTH_CONFIG_PATH}`, location.origin);
  return urls;
}

function addUniqueUrl(urls, path, base) {
  try {
    const url = new URL(path, base).href;
    if (!urls.includes(url)) urls.push(url);
  } catch (error) {
    console.warn("Skipping invalid auth config URL", path, base, error);
  }
}

function bindAuthEvents() {
  if (els.passwordForm.dataset.bound === "true") return;
  els.passwordForm.dataset.bound = "true";

  els.passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.authReady || !state.sharedPassword) {
      showPasswordScreen("Password settings are still loading. Try again in a moment.");
      return;
    }
    if (els.passwordInput.value !== state.sharedPassword) {
      showPasswordScreen("That password did not match the Writing Room password.");
      return;
    }

    localStorage.setItem(AUTH_KEY, "true");
    els.passwordInput.value = "";
    setPasswordFormState(false, "Opening Writing Room…");
    try {
      await startEditor();
      setPasswordFormState(true);
    } catch (error) {
      console.error(error);
      localStorage.removeItem(AUTH_KEY);
      setPasswordFormState(true);
      showPasswordScreen("Password accepted, but the editor could not initialize. Refresh the page and try again.");
    }
  });

  els.logoutButton.addEventListener("click", () => {
    localStorage.removeItem(AUTH_KEY);
    showPasswordScreen();
  });
}

async function startEditor() {
  setAuthVisibility(true);
  await loadWorkspace();
  applySavedDesignSettings();
  hydrateIconButtons();
  bindEditorEvents();
  applyRouteToState();
  renderAll();
  if (!new URLSearchParams(location.search).has("doc")) updateUrl();
  scrollToRouteBookmark();
  setStatus("Ready", "saved");
  updateContextStatus();
}

function showPasswordScreen(message = "") {
  setAuthVisibility(false);
  els.passwordError.textContent = message;
  requestAnimationFrame(() => els.passwordInput.focus());
}

function setPasswordFormState(enabled, message = "") {
  els.passwordInput.disabled = !enabled;
  els.passwordSubmit.disabled = !enabled;
  els.passwordError.textContent = message;
}

function showEditorStartupError(error) {
  setAuthVisibility(true);
  const message = error?.message || "Unknown startup error";
  els.editor.innerHTML = `<h1>Capsanoto startup issue</h1><p>The editor is unlocked, but startup hit an error:</p><pre>${escapeHtml(message)}</pre><p>Try refreshing. If this keeps happening, use Reset Local Save in Settings.</p>`;
  setStatus("Startup issue", "dirty");
}

function setAuthVisibility(isUnlocked) {
  document.body.classList.toggle("is-locked", !isUnlocked);
  document.body.classList.toggle("is-unlocked", isUnlocked);
  els.passwordScreen.hidden = isUnlocked;
  els.editorApp.hidden = !isUnlocked;
  els.passwordScreen.setAttribute("aria-hidden", String(isUnlocked));
  els.editorApp.setAttribute("aria-hidden", String(!isUnlocked));
}

function markFrameMode() {
  try {
    if (window.self !== window.top) document.body.classList.add("is-framed");
  } catch {
    document.body.classList.add("is-framed");
  }
}

function isAuthenticated() {
  return localStorage.getItem(AUTH_KEY) === "true";
}

async function loadWorkspace() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const payload = JSON.parse(saved);
      state.documents = Array.isArray(payload.documents) ? payload.documents : [];
      state.blocks = payload.blocks && typeof payload.blocks === "object" ? payload.blocks : {};
      state.filingGroups = Array.isArray(payload.filingGroups) ? payload.filingGroups : [];
      state.trash = Array.isArray(payload.trash) ? payload.trash : [];
      state.deprecated = Array.isArray(payload.deprecated) ? payload.deprecated : [];
    } catch (error) {
      console.warn("Ignoring unreadable local Capsanoto Writing Room", error);
      localStorage.removeItem(STORAGE_KEY);
      state.documents = [];
      state.blocks = {};
    }
  }

  if (!state.documents.length) {
    const payload = await loadStarterWorkspace();
    state.documents = Array.isArray(payload.documents) ? payload.documents : [];
    state.blocks = payload.blocks && typeof payload.blocks === "object" ? payload.blocks : {};
    state.filingGroups = Array.isArray(payload.filingGroups) ? payload.filingGroups : [];
    state.trash = Array.isArray(payload.trash) ? payload.trash : [];
    state.deprecated = Array.isArray(payload.deprecated) ? payload.deprecated : [];
    persistNow("Loaded starter Writing Room");
  }

  if (!state.filingGroups.length) state.filingGroups = defaultFilingGroups();
  if (!state.documents.length) createDocument();
  state.activeId = state.documents[0].id;
}

async function loadStarterWorkspace() {
  const errors = [];
  for (const url of contentWorkspaceUrls()) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
      const payload = await response.json();
      if (Array.isArray(payload.documents)) return payload;
      throw new Error("Missing documents array");
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }

  console.warn(`Using embedded Capsanoto starter Writing Room after content load failed: ${errors.join(" | ")}`);
  return cloneDefaultWorkspace();
}

function contentWorkspaceUrls() {
  const urls = [];
  addUniqueUrl(urls, CONTENT_PATH, document.baseURI);
  addUniqueUrl(urls, CONTENT_PATH, location.href);
  const scriptSrc = document.currentScript?.src || document.querySelector('script[src$="app.js"]')?.src;
  if (scriptSrc) addUniqueUrl(urls, CONTENT_PATH, scriptSrc);
  if (location.origin && location.origin !== "null") addUniqueUrl(urls, `/${CONTENT_PATH}`, location.origin);
  return urls;
}

function cloneDefaultWorkspace() {
  return JSON.parse(JSON.stringify(DEFAULT_WORKSPACE));
}

function bindEditorEvents() {
  if (els.editor.dataset.bound === "true") return;
  els.editor.dataset.bound = "true";

  els.documentSelect.addEventListener("change", () => openDocument(els.documentSelect.value));
  els.newDocumentButton.addEventListener("click", () => {
    const doc = createDocument();
    openDocument(doc.id);
    markDirty("New document created");
  });
  els.documentSettingsButton.addEventListener("click", openFilingCabinetSettingsMode);

  els.titleInput.addEventListener("input", () => {
    activeDocument().title = els.titleInput.value || "Untitled Document";
    renderDocumentSelect();
    updateUrl();
    markDirty("Title updated");
  });

  els.tagsInput.addEventListener("input", () => {
    activeDocument().tags = els.tagsInput.value.split(",").map((tag) => tag.trim()).filter(Boolean);
    markDirty("Tags updated");
  });

  els.editor.addEventListener("input", () => {
    if (state.suppressInput) return;
    syncEditorToDocument();
    renderBookmarks();
    updateContextStatus();
    markDirty("Autosaving locally…");
  });
  els.editor.addEventListener("keyup", updateContextStatus);
  els.editor.addEventListener("mouseup", updateContextStatus);
  document.addEventListener("selectionchange", updateContextStatus);
  document.addEventListener("mouseover", updateHoverStatus);
  document.addEventListener("focusin", updateHoverStatus);

  els.toolbar.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.command) runCommand(button.dataset.command);
    if (button.dataset.block) formatBlock(button.dataset.block);
  });

  els.linkButton.addEventListener("click", createHyperlink);
  els.editLinkButton.addEventListener("click", editSelectedLink);
  els.pillLinkButton.addEventListener("click", createPillLink);
  els.removeLinkButton.addEventListener("click", removeSelectedLink);
  els.bookmarkButton.addEventListener("click", insertBookmark);
  els.tableButton.addEventListener("click", insertTable);
  els.imageButton.addEventListener("click", () => els.imageInput.click());
  els.imageInput.addEventListener("change", embedSelectedImage);
  els.emojiButton.addEventListener("click", () => insertHtml("✨"));
  els.emphasisButton.addEventListener("click", insertEmphasisBox);
  els.topHelpButton.addEventListener("click", () => toggleHelpPanel(true));
  els.settingsButton.addEventListener("click", () => toggleSettingsPanel(true));
  els.closeSettingsPanel.addEventListener("click", () => toggleSettingsPanel(false));
  els.settingsMenu.addEventListener("click", handleSettingsMenuClick);
  els.settingsPanel.addEventListener("click", handleSettingsCardToggle);
  els.writingRoomButton.addEventListener("click", () => toggleWritingRoomPanel());
  els.closeWritingRoomPanel.addEventListener("click", () => toggleWritingRoomPanel(false));
  els.editWritingRoomButton.addEventListener("click", toggleFilingEditMode);
  els.newFolderButton.addEventListener("click", () => createFilingGroup("folder"));
  els.newTabButton.addEventListener("click", createFilingTab);
  els.trashCanButton.addEventListener("click", () => setContextStatus(`${state.trash.length} items in Trash · ${state.deprecated.length} deprecated`, false));
  els.writingRoomCards.addEventListener("click", handleWritingRoomCardClick);
  els.writingRoomCards.addEventListener("dragstart", handleFilingDragStart);
  els.writingRoomCards.addEventListener("dragover", handleFilingDragOver);
  els.writingRoomCards.addEventListener("drop", handleFilingDrop);
  els.writingRoomPanelHeader.addEventListener("pointerdown", startWritingRoomDrag);
  window.addEventListener("pointermove", moveWritingRoomPanel);
  window.addEventListener("pointerup", stopWritingRoomDrag);
  els.settingsPanel.querySelector("header")?.addEventListener("pointerdown", (event) => startPanelDrag(event, els.settingsPanel));
  els.helpPanel.querySelector("header")?.addEventListener("pointerdown", (event) => startPanelDrag(event, els.helpPanel));
  window.addEventListener("pointermove", movePanelDrag);
  window.addEventListener("pointerup", stopPanelDrag);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { toggleHelpPanel(false); toggleSettingsPanel(false); toggleWritingRoomPanel(false); } });
  bindDesignColorTools();
  bindDesignToggle(els.designBoldToggle, els.designBold);
  bindDesignToggle(els.dialogBoldToggle, els.dialogBold);
  els.helpButton.addEventListener("click", () => { toggleSettingsPanel(false); toggleHelpPanel(true); });
  els.closeHelpPanel.addEventListener("click", () => toggleHelpPanel(false));
  els.logoutButton.addEventListener("click", resetLocalWorkspace);
  els.exportSourceType.addEventListener("change", renderExportSourceSelect);
  els.addExportItemButton.addEventListener("click", addExportItem);
  els.exportCapsButton.addEventListener("click", () => exportSmartBundle("caps"));
  els.exportTxtButton.addEventListener("click", () => exportSmartBundle("txt"));
  els.exportHtmlButton.addEventListener("click", () => exportSmartBundle("html"));
  els.exportDocButton.addEventListener("click", () => exportSmartBundle("doc"));
  els.exportQueue.addEventListener("dragstart", handleExportDragStart);
  els.exportQueue.addEventListener("dragover", handleExportDragOver);
  els.exportQueue.addEventListener("drop", handleExportDrop);
  els.exportQueue.addEventListener("click", handleExportQueueClick);
  els.applyDesignButton.addEventListener("click", saveDesignSettings);
  els.resetDesignButton.addEventListener("click", resetDesignSettings);

  els.bookmarkBar.addEventListener("click", (event) => {
    const copyButton = event.target.closest("button[data-copy-bookmark]");
    if (copyButton) {
      copyBookmarkLink(copyButton.dataset.copyBookmark);
      return;
    }

    const link = event.target.closest("a[data-bookmark]");
    if (!link) return;
    event.preventDefault();
    jumpToBookmark(link.dataset.bookmark);
  });

  els.blockButton.addEventListener("click", () => toggleBlockPanel(true));
  els.closeBlockPanel.addEventListener("click", () => toggleBlockPanel(false));
  els.saveBlockButton.addEventListener("click", saveBlock);
  els.insertBlockRefButton.addEventListener("click", insertBlockReference);
  els.blockList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-block-id]");
    if (!button) return;
    selectBlock(button.dataset.blockId);
  });

  els.editor.addEventListener("click", handleEditorClick);
  els.editor.addEventListener("mouseover", handleEditorLinkPreview);
  els.editor.addEventListener("contextmenu", openSelectionContextMenu);
  els.selectionMenu.addEventListener("click", handleSelectionMenuClick);
  els.dialogBox.addEventListener("submit", submitDialog);
  els.dialogCancelButton.addEventListener("click", cancelDialog);
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#selectionMenu")) hideSelectionContextMenu();
  });

  window.addEventListener("hashchange", openFromRoute);
  window.addEventListener("popstate", openFromRoute);
  document.addEventListener("keydown", (event) => {
    const isModifier = event.metaKey || event.ctrlKey;
    if (isModifier && event.key.toLowerCase() === "s") {
      event.preventDefault();
      persistNow("Saved locally");
    }
  });
}

function createDocument(id = `doc-${Date.now()}`, title = "Untitled Document") {
  const doc = {
    id,
    title,
    tags: [],
    updatedAt: new Date().toISOString(),
    content: els.documentTemplate.innerHTML.trim(),
  };
  state.documents.unshift(doc);
  return doc;
}

function openDocument(id, bookmarkId = "") {
  state.activeId = id;
  state.pendingBookmarkId = bookmarkId;
  renderAll();
  updateUrl(bookmarkId);
  if (bookmarkId) scrollToRouteBookmark();
  setStatus("Ready", "saved");
}

function openFromRoute() {
  const previousId = state.activeId;
  applyRouteToState();
  if (state.activeId !== previousId) renderAll();
  scrollToRouteBookmark();
}

function applyRouteToState() {
  const route = parseRoute();
  const routeDocument = route.documentId ? findDocumentByRouteId(route.documentId) : null;
  if (routeDocument) {
    state.activeId = routeDocument.id;
  } else if (route.documentId) {
    const doc = createDocument(route.documentId, humanizeDocumentId(route.documentId));
    state.activeId = doc.id;
    markDirty("Created document from URL");
  }
  state.pendingBookmarkId = route.bookmarkId;
}

function scrollToRouteBookmark() {
  if (!state.pendingBookmarkId) return;
  requestAnimationFrame(() => jumpToBookmark(state.pendingBookmarkId, false));
}

function activeDocument() {
  return state.documents.find((doc) => doc.id === state.activeId) ?? state.documents[0];
}

function renderAll() {
  renderDocumentSelect();
  renderActiveDocument();
  renderBookmarks();
  renderBlockList();
  renderExportSourceSelect();
  renderExportQueue();
  renderWritingRoomCards();
}

function renderDocumentSelect() {
  els.documentSelect.innerHTML = state.documents.map((doc) => (
    `<option value="${escapeAttr(doc.id)}" ${doc.id === state.activeId ? "selected" : ""}>${escapeHtml(doc.title)}</option>`
  )).join("");
}

function renderActiveDocument() {
  const doc = activeDocument();
  els.titleInput.value = doc.title;
  els.tagsInput.value = (doc.tags ?? []).join(", ");
  state.suppressInput = true;
  els.editor.innerHTML = renderTransclusions(doc.content);
  ensureHeadingIds();
  state.suppressInput = false;
}

function renderBookmarks() {
  if (els.bookmarkBar) els.bookmarkBar.innerHTML = "";
}

function getBookmarks() {
  return [...els.editor.querySelectorAll("h1[id], h2[id], h3[id], [data-bookmark='true'][id]")].map((heading) => ({
    id: heading.id,
    label: heading.textContent.trim() || heading.id,
  }));
}

function ensureHeadingIds() {
  [...els.editor.querySelectorAll("h1, h2, h3")].forEach((heading) => {
    if (!heading.id) heading.id = uniqueBookmarkId(slugify(heading.textContent || "section"));
  });
  syncEditorToDocument(false);
}

function renderTransclusions(html) {
  return String(html ?? "").replace(/\{\{([A-Za-z]+-[A-Za-z0-9-]+)\}\}/g, (_, id) => {
    const block = state.blocks[id];
    const content = block ? block.content : "Missing transclusion block";
    return `<aside class="transclusion-ref" contenteditable="false" data-block-id="${escapeAttr(id)}"><span>${escapeHtml(id)}</span><div>${sanitizeBlockContent(content)}</div></aside>`;
  });
}

function syncEditorToDocument(updateTimestamp = true) {
  const clone = els.editor.cloneNode(true);
  clone.querySelectorAll(".transclusion-ref[data-block-id]").forEach((node) => {
    node.replaceWith(document.createTextNode(`{{${node.dataset.blockId}}}`));
  });
  const doc = activeDocument();
  doc.content = clone.innerHTML;
  if (updateTimestamp) doc.updatedAt = new Date().toISOString();
}

function runCommand(command) {
  els.editor.focus();
  document.execCommand(command, false, null);
  syncAndSave("Formatting updated");
}

function formatBlock(tag) {
  els.editor.focus();
  document.execCommand("formatBlock", false, tag);
  ensureHeadingIds();
  renderBookmarks();
  syncAndSave("Heading updated");
}


function saveSelectionRange() {
  const selection = window.getSelection();
  if (selection.rangeCount && els.editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
    state.savedRange = selection.getRangeAt(0).cloneRange();
  }
}

function restoreSelectionRange() {
  if (!state.savedRange) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(state.savedRange);
}

function selectedPlainText() {
  const selection = window.getSelection();
  return selection?.toString().trim() || "";
}

function openSelectionContextMenu(event) {
  const selection = window.getSelection();
  if (!selection.rangeCount || selection.isCollapsed || !els.editor.contains(selection.getRangeAt(0).commonAncestorContainer)) return;
  event.preventDefault();
  saveSelectionRange();
  showSelectionContextMenu(event.clientX, event.clientY);
}

function showSelectionContextMenu(clientX, clientY) {
  els.selectionMenu.hidden = false;
  const margin = 12;
  const rect = els.selectionMenu.getBoundingClientRect();
  const left = Math.min(clientX, window.innerWidth - rect.width - margin);
  const top = Math.min(clientY, window.innerHeight - rect.height - margin);
  els.selectionMenu.style.left = `${Math.max(margin, left)}px`;
  els.selectionMenu.style.top = `${Math.max(margin, top)}px`;
}

function hideSelectionContextMenu() {
  els.selectionMenu.hidden = true;
}

async function handleSelectionMenuClick(event) {
  const button = event.target.closest("button[data-context-action]");
  if (!button) return;
  hideSelectionContextMenu();
  restoreSelectionRange();
  const action = button.dataset.contextAction;
  if (action === "bookmark") await insertBookmark();
  if (action === "transclusion") await createTransclusionFromSelection();
  if (action === "link") await createHyperlink();
  if (action === "pill") await createPillLink();
}

async function createTransclusionFromSelection() {
  saveSelectionRange();
  const selectedText = selectedPlainText();
  const result = await openCapsDialog("Create TCard", [
    { name: "id", label: "TCard ID", value: "", placeholder: "Character-Name / Item-Name / Location-Name" },
    { name: "content", label: "TCard Content", value: selectedText, multiline: true },
  ]);
  if (!result?.id) return;
  const id = result.id.trim();
  if (!/^[A-Za-z]+-[A-Za-z0-9-]+$/.test(id)) {
    setStatus("Use TCard IDs like Item-Runestones", "dirty");
    return;
  }
  state.blocks[id] = { id, content: result.content || selectedText, updatedAt: new Date().toISOString() };
  restoreSelectionRange();
  insertHtml(`{{${escapeHtml(id)}}}`);
  renderBlockList();
  renderExportSourceSelect();
  setStatus("Transclusion created", "saved");
}

function openCapsDialog(title, fields) {
  els.dialogTitle.textContent = title;
  els.dialogFields.innerHTML = fields.map(renderDialogField).join("");
  els.dialogOverlay.hidden = false;
  els.dialogFields.querySelector("input:not([readonly]), textarea:not([readonly])")?.focus();
  return new Promise((resolve) => { state.dialogResolver = resolve; });
}

function renderDialogField(field) {
  if (field.checkbox) {
    return `<label class="dialog-check"><input type="checkbox" name="${escapeAttr(field.name)}"> ${escapeHtml(field.label)}</label>`;
  }
  const readonly = field.readonly ? " readonly" : "";
  return `
    <label>${escapeHtml(field.label)}
      ${field.multiline
        ? `<textarea name="${escapeAttr(field.name)}" rows="5" placeholder="${escapeAttr(field.placeholder || "")}"${readonly}>${escapeHtml(field.value || "")}</textarea>`
        : `<input name="${escapeAttr(field.name)}" value="${escapeAttr(field.value || "")}" placeholder="${escapeAttr(field.placeholder || "")}"${readonly}>`}
    </label>
  `;
}

function submitDialog(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(els.dialogBox).entries());
  closeCapsDialog(data);
}

function cancelDialog() {
  closeCapsDialog(null);
}

function closeCapsDialog(value) {
  els.dialogOverlay.hidden = true;
  const resolve = state.dialogResolver;
  state.dialogResolver = null;
  if (resolve) resolve(value);
}

async function createHyperlink() {
  saveSelectionRange();
  const result = await openCapsDialog("Create Link", [{ name: "target", label: "Target", value: "", placeholder: "document id, #bookmark, block:Item-Name, {{Item-Name}}, or https://" }]);
  if (!result?.target) return;
  restoreSelectionRange();
  runLinkCommand(result.target, { pill: false });
}

async function createPillLink() {
  saveSelectionRange();
  const existingLink = currentLink();
  if (existingLink) {
    existingLink.classList.add("pill-link");
    existingLink.dataset.linkStyle = "pill";
    syncAndSave("Converted link to pill");
    return;
  }

  const result = await openCapsDialog("Create Pill Link", [{ name: "target", label: "Target", value: "", placeholder: "document id, #bookmark, block:Item-Name, {{Item-Name}}, or https://" }]);
  if (!result?.target) return;
  restoreSelectionRange();
  runLinkCommand(result.target, { pill: true });
}

async function editSelectedLink() {
  saveSelectionRange();
  const link = currentLink();
  if (!link) {
    setStatus("Select a link to edit", "dirty");
    return;
  }
  const currentTarget = link.dataset.linkTarget || link.getAttribute("href") || "";
  const result = await openCapsDialog("Edit Link", [{ name: "target", label: "Target", value: currentTarget }]);
  if (!result?.target) return;
  applyLinkTarget(link, result.target, link.classList.contains("pill-link"));
  syncAndSave("Link updated");
}

function removeSelectedLink() {
  const link = currentLink();
  if (!link) {
    setStatus("Select a link to remove", "dirty");
    return;
  }
  link.replaceWith(document.createTextNode(link.textContent));
  syncAndSave("Link removed");
}

function runLinkCommand(target, options = {}) {
  const normalized = normalizeLinkTarget(target);
  els.editor.focus();
  document.execCommand("createLink", false, normalized.href);
  const matchingLinks = [...els.editor.querySelectorAll(`a[href="${cssString(normalized.href)}"]`)];
  const link = currentLink() || matchingLinks[matchingLinks.length - 1];
  if (link) applyLinkMetadata(link, normalized, options.pill);
  syncAndSave(options.pill ? "Pill link created" : "Link created");
}

function applyLinkTarget(link, target, keepPill = false) {
  applyLinkMetadata(link, normalizeLinkTarget(target), keepPill);
}

function applyLinkMetadata(link, normalized, pill = false) {
  link.href = normalized.href;
  link.dataset.linkType = normalized.type;
  link.dataset.linkTarget = normalized.target;
  link.dataset.previewType = normalized.type;
  link.dataset.previewTarget = normalized.target;
  link.title = normalized.label;
  link.classList.toggle("pill-link", Boolean(pill));
  if (pill) link.dataset.linkStyle = "pill";
  else delete link.dataset.linkStyle;
}

function currentLink() {
  const selection = window.getSelection();
  if (selection.rangeCount) {
    let node = selection.anchorNode;
    while (node && node !== els.editor) {
      if (node.nodeType === Node.ELEMENT_NODE && node.matches("a")) return node;
      node = node.parentNode;
    }
    const selectedElement = selection.getRangeAt(0).commonAncestorContainer;
    if (selectedElement.nodeType === Node.ELEMENT_NODE) {
      const nestedLink = selectedElement.closest?.("a") || selectedElement.querySelector?.("a");
      if (nestedLink) return nestedLink;
    }
  }
  return document.activeElement?.closest?.("a") || null;
}

function handleEditorClick(event) {
  hideSelectionContextMenu();
  handleEditorLinkClick(event);
}

function handleEditorLinkClick(event) {
  const link = event.target.closest("a[data-link-type='block']");
  if (!link) return;
  event.preventDefault();
  toggleBlockPanel(true);
  selectBlock(link.dataset.linkTarget);
  setStatus(`Opened block ${link.dataset.linkTarget}`, "saved");
}

function handleEditorLinkPreview(event) {
  const link = event.target.closest("a[data-preview-type]");
  if (!link) return;
  const preview = getLinkPreviewData(link);
  if (preview) link.title = preview.summary;
}

function getLinkPreviewData(link) {
  const type = link.dataset.previewType;
  const target = link.dataset.previewTarget;
  if (type === "document") {
    const doc = findDocumentByRouteId(target);
    return doc ? { type, title: doc.title, summary: `Document: ${doc.title}` } : null;
  }
  if (type === "bookmark") return { type, title: target, summary: `Bookmark: ${target}` };
  if (type === "block") {
    const block = state.blocks[target];
    return block ? { type, title: block.id, summary: `Block: ${block.id} — ${block.content.slice(0, 120)}` } : null;
  }
  return null;
}

async function insertBookmark() {
  saveSelectionRange();
  const selectedText = selectedPlainText();
  const result = await openCapsDialog("Create Bookmark", [{ name: "label", label: "Heading / Bookmark name", value: selectedText }]);
  if (!result?.label) return;
  restoreSelectionRange();
  const id = uniqueBookmarkId(slugify(result.label));
  insertHtml(`<h2 id="${escapeAttr(id)}" data-bookmark="true">${escapeHtml(result.label)}</h2><p></p>`);
  updateUrl(id);
}

function jumpToBookmark(id, updateHash = true) {
  const target = els.editor.querySelector(`#${CSS.escape(id)}`);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  if (updateHash) updateUrl(id);
}

async function openDocumentSettings() {
  const doc = activeDocument();
  const result = await openCapsDialog("Document Settings", [
    { name: "title", label: "Document title", value: doc.title },
    { name: "tags", label: "Tags", value: (doc.tags ?? []).join(", "), placeholder: "character, episode, lore" },
  ]);
  if (!result) return;
  doc.title = result.title?.trim() || "Untitled Document";
  doc.tags = String(result.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
  els.titleInput.value = doc.title;
  els.tagsInput.value = doc.tags.join(", ");
  renderDocumentSelect();
  renderWritingRoomCards();
  updateUrl();
  markDirty("Document settings updated");
}

function insertEmphasisBox() {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !els.editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
    insertHtml('<aside class="emphasis-box"><p>Emphasis note</p></aside>');
    return;
  }
  const selectedHtml = selection.isCollapsed ? "Emphasis note" : selectionHtml(selection.getRangeAt(0));
  insertHtml(`<aside class="emphasis-box">${selectedHtml}</aside><p></p>`);
}

function selectionHtml(range) {
  const fragment = range.cloneContents();
  const wrapper = document.createElement("div");
  wrapper.append(fragment);
  return wrapper.innerHTML || escapeHtml(range.toString());
}

function insertTable() {
  insertHtml(`<table><thead><tr><th>Field</th><th>Notes</th></tr></thead><tbody><tr><td>Canon</td><td></td></tr><tr><td>Reference</td><td></td></tr></tbody></table>`);
}

function embedSelectedImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    insertHtml(`<figure><img src="${reader.result}" alt="Embedded lore image"><figcaption>Image note</figcaption></figure>`);
    els.imageInput.value = "";
  });
  reader.readAsDataURL(file);
}

function insertHtml(html) {
  els.editor.focus();
  document.execCommand("insertHTML", false, html);
  ensureHeadingIds();
  renderBookmarks();
  syncAndSave("Content inserted");
}

function toggleSettingsPanel(show) {
  els.settingsPanel.hidden = !show;
  if (show) {
    els.settingsSections.forEach((section) => {
      section.hidden = false;
      section.classList.add("is-collapsed");
    });
    renderExportSourceSelect();
    renderExportQueue();
    loadDesignForm();
  }
}

function handleSettingsMenuClick(event) {
  const button = event.target.closest("button[data-settings-tab]");
  if (!button) return;
  showSettingsSection(button.dataset.settingsTab);
}

function handleSettingsCardToggle(event) {
  const heading = event.target.closest(".settings-section > h3");
  if (!heading) return;
  heading.closest(".settings-section").classList.toggle("is-collapsed");
}

function showSettingsSection(sectionName) {
  els.settingsMenu.querySelectorAll("button[data-settings-tab]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.settingsTab === sectionName));
  });
  els.settingsSections.forEach((section) => {
    section.hidden = section.dataset.settingsSection !== sectionName;
  });
}

function openFilingCabinetSettingsMode() {
  toggleWritingRoomPanel(true);
  if (!state.filingEditMode) toggleFilingEditMode();
  setContextStatus("Filing Cabinet settings: click Settings on a folder, tab, or document");
}

function toggleWritingRoomPanel(show = els.writingRoomPanel.hidden) {
  els.writingRoomPanel.hidden = !show;
  els.writingRoomButton.setAttribute("aria-expanded", String(show));
  if (show) renderWritingRoomCards();
}

function toggleFilingEditMode() {
  state.filingEditMode = !state.filingEditMode;
  els.editWritingRoomButton.setAttribute("aria-pressed", String(state.filingEditMode));
  els.writingRoomEditBar.hidden = !state.filingEditMode;
  els.writingRoomPanel.classList.toggle("is-editing", state.filingEditMode);
  renderWritingRoomCards();
  setContextStatus(state.filingEditMode ? "Filing Cabinet edit mode unlocked" : "Filing Cabinet locked");
}

async function createFilingGroup(type) {
  const result = await openCapsDialog(type === "folder" ? "New Folder" : "New Tab", [
    { name: "name", label: `${type === "folder" ? "Folder" : "Tab"} name`, value: "" },
  ]);
  const name = result?.name?.trim();
  if (!name) return;
  state.filingGroups.push({ id: `${type}-${slugify(name)}-${Date.now()}`, label: name, type, createdAt: new Date().toISOString() });
  renderWritingRoomCards();
  markDirty(`${type === "folder" ? "Folder" : "Tab"} added`);
}

async function createFilingTab() {
  const result = await openCapsDialog("New Tab", [
    { name: "title", label: "Tab title", value: "Untitled Document" },
  ]);
  const title = result?.title?.trim() || "Untitled Document";
  const doc = createDocument(`doc-${Date.now()}`, title);
  doc.filingGroupId = state.filingGroups[0]?.id || defaultFilingGroups()[0].id;
  openDocument(doc.id);
  toggleWritingRoomPanel(true);
  markDirty("New Filing Cabinet tab created");
}

function defaultFilingGroups() {
  return [
    { id: "writing-room-tabs", label: "Writing Room Tabs", type: "folder" },
    { id: "writing-room-core", label: "Writing Room Core", type: "folder" },
    { id: "episodes", label: "Episodes", type: "folder" },
    { id: "characters", label: "Characters", type: "folder" },
  ];
}

function renderWritingRoomCards() {
  if (!els.writingRoomCards) return;
  const groups = groupedDocuments();
  const groupHtml = groups.map((group, groupIndex) => `
    <details class="writing-room-group" data-group-id="${escapeAttr(group.id)}" ${groupIndex === 0 ? "open" : ""}>
      <summary><span class="card-arrow">›</span><strong>${escapeHtml(group.label)}</strong><small>${group.documents.length} ${group.documents.length === 1 ? "tab" : "tabs"}</small>${state.filingEditMode ? `<span class="filing-group-actions"><button type="button" data-group-action="settings" data-group-id="${escapeAttr(group.id)}">Settings</button><button type="button" data-group-action="delete" data-group-id="${escapeAttr(group.id)}">Delete</button></span>` : ""}</summary>
      <div class="writing-room-card-stack" data-drop-group="${escapeAttr(group.id)}">
        ${group.documents.map((doc) => renderWritingRoomCard(doc, group.depth)).join("")}
        ${state.filingEditMode && !group.documents.length ? '<p class="panel-help">Drop files here or use metadata tags later.</p>' : ''}
      </div>
    </details>
  `).join("");
  const trashHtml = state.filingEditMode ? renderTrashSection() : "";
  els.writingRoomCards.innerHTML = groupHtml + trashHtml;
}

function renderWritingRoomCard(doc, depth = 0) {
  const tags = (doc.tags ?? []).slice(0, 4);
  const updated = doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : "Not saved yet";
  const preview = textFromHtml(renderTransclusions(doc.content)).slice(0, 180) || "Empty Writing Room tab";
  return `<details class="writing-room-card ${doc.id === state.activeId ? "is-active" : ""}" draggable="${state.filingEditMode}" style="--tab-depth:${depth}" data-doc-card="${escapeAttr(doc.id)}">
    <summary>
      <span class="card-arrow">›</span>
      <span class="card-icon">${docIcon(doc)}</span>
      <strong>${escapeHtml(doc.title)}</strong>
      <small>Document</small>
    </summary>
    <div class="writing-room-card-body">
      <p class="doc-id-line"><strong>Document ID:</strong> ${escapeHtml(doc.id)}</p>
      <p>${escapeHtml(preview)}</p>
      <div class="document-card-tags">${tags.length ? tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("") : "<span>No tags</span>"}</div>
      <footer>
        <small>Updated ${escapeHtml(updated)}</small>
        <span class="document-card-actions">
          <button type="button" data-card-action="open" data-doc-id="${escapeAttr(doc.id)}">Open</button>
          <button type="button" data-card-action="settings" data-doc-id="${escapeAttr(doc.id)}">Settings</button>
          <button type="button" data-card-action="duplicate" data-doc-id="${escapeAttr(doc.id)}">Duplicate</button>
          <button type="button" data-card-action="deprecate" data-doc-id="${escapeAttr(doc.id)}">Deprecate</button>
          <button type="button" data-card-action="delete" data-doc-id="${escapeAttr(doc.id)}">Delete</button>
          <button type="button" data-card-action="copy" data-doc-id="${escapeAttr(doc.id)}">Copy URL</button>
        </span>
      </footer>
    </div>
  </details>`;
}

function renderTrashSection() {
  const deleted = state.trash.map((doc) => archivedCard(doc, "trash")).join("") || '<p class="panel-help">Trash is empty.</p>';
  const deprecated = state.deprecated.map((doc) => archivedCard(doc, "deprecated")).join("") || '<p class="panel-help">No deprecated files.</p>';
  return `<details class="writing-room-group filing-archive" open><summary><span class="card-arrow">›</span><strong>Trashcan</strong><small>${state.trash.length} deleted</small></summary><div class="writing-room-card-stack">${deleted}</div></details>
    <details class="writing-room-group filing-archive"><summary><span class="card-arrow">›</span><strong>Deprecated</strong><small>${state.deprecated.length} archived</small></summary><div class="writing-room-card-stack">${deprecated}</div></details>`;
}

function archivedCard(doc, source) {
  return `<article class="writing-room-card archived-card"><div class="writing-room-card-body"><strong>${escapeHtml(doc.title)}</strong><p class="doc-id-line"><strong>Document ID:</strong> ${escapeHtml(doc.id)}</p><span class="document-card-actions"><button type="button" data-card-action="restore" data-archive-source="${source}" data-doc-id="${escapeAttr(doc.id)}">Restore</button></span></div></article>`;
}

function groupedDocuments() {
  const baseGroups = state.filingGroups.length ? state.filingGroups : defaultFilingGroups();
  const groupsById = new Map(baseGroups.map((group, index) => [group.id, { ...group, documents: [], depth: index ? 1 : 0 }]));
  const groupsByLabel = new Map([...groupsById.values()].map((group) => [group.label, group]));
  state.documents.forEach((doc) => {
    let group = doc.filingGroupId ? groupsById.get(doc.filingGroupId) : null;
    if (!group) {
      const label = writingRoomGroupLabel(doc);
      group = groupsByLabel.get(label);
      if (!group) {
        group = { id: slugify(label), label, type: "folder", documents: [], depth: groupsById.size ? 1 : 0 };
        groupsById.set(group.id, group);
        groupsByLabel.set(group.label, group);
      }
      doc.filingGroupId = group.id;
    }
    group.documents.push(doc);
  });
  return [...groupsById.values()];
}

function writingRoomGroupLabel(doc) {
  const tags = (doc.tags ?? []).map((tag) => tag.toLowerCase());
  if (tags.includes("character")) return "Characters";
  if (tags.includes("episode") || tags.includes("season-1")) return "Episodes";
  if (tags.includes("worldbuilding")) return "Writing Room Core";
  return "Writing Room Tabs";
}

function docIcon(doc) {
  const tags = (doc.tags ?? []).map((tag) => tag.toLowerCase());
  if (tags.includes("character")) return "🧑";
  if (tags.includes("episode")) return "📄";
  if (tags.includes("worldbuilding")) return "💗";
  return "📝";
}

async function handleWritingRoomCardClick(event) {
  const groupButton = event.target.closest("button[data-group-action]");
  if (groupButton) {
    event.preventDefault();
    return handleFilingGroupAction(groupButton.dataset.groupAction, groupButton.dataset.groupId);
  }
  const button = event.target.closest("button[data-card-action]");
  if (!button) return;
  const docId = button.dataset.docId;
  const action = button.dataset.cardAction;
  if (action === "open") { openDocument(docId); renderWritingRoomCards(); return; }
  if (action === "settings") { openDocument(docId); await openDocumentSettings(); renderWritingRoomCards(); return; }
  if (action === "duplicate") return duplicateDocument(docId);
  if (action === "deprecate") return deprecateDocument(docId);
  if (action === "delete") return deleteDocumentSafely(docId);
  if (action === "restore") return restoreArchivedDocument(docId, button.dataset.archiveSource);
  if (action === "copy") {
    await copyText(new URL(documentUrl(docId), location.href).href);
    setStatus("Copied Writing Room tab link", "saved");
  }
}

async function handleFilingGroupAction(action, groupId) {
  const group = state.filingGroups.find((item) => item.id === groupId) || groupedDocuments().find((item) => item.id === groupId);
  if (!group) return;
  const groupDocs = state.documents.filter((doc) => doc.filingGroupId === groupId);
  if (action === "settings") {
    const result = await openCapsDialog("Folder Settings", [
      { name: "label", label: "Folder / tab label", value: group.label },
      { name: "type", label: "Type metadata", value: group.type || "folder", placeholder: "folder or tab" },
    ]);
    const label = result?.label?.trim();
    if (!label) return;
    const storedGroup = state.filingGroups.find((item) => item.id === groupId);
    if (storedGroup) {
      storedGroup.label = label;
      storedGroup.type = result.type?.trim() || storedGroup.type || "folder";
    } else {
      state.filingGroups.push({ id: group.id, label, type: result.type?.trim() || "folder" });
    }
    renderWritingRoomCards();
    markDirty("Filing Cabinet folder settings updated");
    return;
  }
  if (action === "delete") {
    if (groupDocs.length) {
      await openCapsDialog("Folder Not Empty", [
        { name: "warning", label: `${group.label} contains ${groupDocs.length} ${groupDocs.length === 1 ? "tab" : "tabs"}. Move, delete, deprecate, or restore those tabs before deleting the folder.`, value: "", readonly: true },
      ]);
      return;
    }
    state.filingGroups = state.filingGroups.filter((item) => item.id !== groupId);
    renderWritingRoomCards();
    markDirty("Empty Filing Cabinet folder deleted");
  }
}

function duplicateDocument(docId) {
  const doc = state.documents.find((item) => item.id === docId);
  if (!doc) return;
  const copy = JSON.parse(JSON.stringify(doc));
  copy.id = uniqueDocumentId(`${doc.id}-copy`);
  copy.title = `${doc.title} Copy`;
  copy.updatedAt = new Date().toISOString();
  state.documents.splice(state.documents.indexOf(doc) + 1, 0, copy);
  renderAll();
  markDirty("Document duplicated");
}

function deprecateDocument(docId) {
  const index = state.documents.findIndex((item) => item.id === docId);
  if (index < 0) return;
  const [doc] = state.documents.splice(index, 1);
  doc.deprecatedAt = new Date().toISOString();
  state.deprecated.push(doc);
  if (state.activeId === docId) state.activeId = state.documents[0]?.id || createDocument().id;
  renderAll();
  markDirty("Document deprecated");
}

function documentTextStats(html) {
  const withBreaks = String(html || "")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|aside)>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n");
  const text = textFromHtml(withBreaks).trim();
  return {
    characters: text.length,
    lines: text.split(/\n|\r/).filter((line) => line.trim()).length || (text ? 1 : 0),
  };
}

async function deleteDocumentSafely(docId) {
  const index = state.documents.findIndex((item) => item.id === docId);
  if (index < 0) return;
  const doc = state.documents[index];
  const stats = documentTextStats(doc.content || "");
  if (stats.characters) {
    const result = await openCapsDialog("Confirm Delete", [
      { name: "warning", label: `You are deleting ${stats.lines} lines and ${stats.characters} characters from ${doc.title}.`, value: "", readonly: true },
      { name: "confirm", label: "Yes, move this file to Trash", checkbox: true },
    ]);
    if (result?.confirm !== "on") return;
  }
  const [deleted] = state.documents.splice(index, 1);
  deleted.deletedAt = new Date().toISOString();
  state.trash.push(deleted);
  if (state.activeId === docId) state.activeId = state.documents[0]?.id || createDocument().id;
  renderAll();
  markDirty("Document moved to Trash");
}

function restoreArchivedDocument(docId, source) {
  const collection = source === "deprecated" ? state.deprecated : state.trash;
  const index = collection.findIndex((item) => item.id === docId);
  if (index < 0) return;
  const [doc] = collection.splice(index, 1);
  delete doc.deletedAt;
  delete doc.deprecatedAt;
  doc.id = uniqueDocumentId(doc.id);
  state.documents.push(doc);
  renderAll();
  markDirty("Document restored");
}

function uniqueDocumentId(base) {
  let id = slugify(base);
  let index = 2;
  while (state.documents.some((doc) => doc.id === id) || state.trash.some((doc) => doc.id === id) || state.deprecated.some((doc) => doc.id === id)) {
    id = `${slugify(base)}-${index}`;
    index += 1;
  }
  return id;
}

function handleFilingDragStart(event) {
  if (!state.filingEditMode) return;
  const card = event.target.closest("[data-doc-card]");
  if (!card) return;
  state.draggedDocId = card.dataset.docCard;
  event.dataTransfer?.setData("text/plain", state.draggedDocId);
}

function handleFilingDragOver(event) {
  if (state.filingEditMode && event.target.closest("[data-doc-card], [data-drop-group]")) event.preventDefault();
}

function handleFilingDrop(event) {
  if (!state.filingEditMode || !state.draggedDocId) return;
  const targetCard = event.target.closest("[data-doc-card]");
  const targetGroup = event.target.closest("[data-drop-group]");
  if (!targetCard && !targetGroup) return;
  if (targetCard?.dataset.docCard === state.draggedDocId) return;
  event.preventDefault();
  const from = state.documents.findIndex((doc) => doc.id === state.draggedDocId);
  if (from < 0) return;
  const [doc] = state.documents.splice(from, 1);
  if (targetGroup) doc.filingGroupId = targetGroup.dataset.dropGroup;
  if (targetCard) {
    const targetDoc = state.documents.find((item) => item.id === targetCard.dataset.docCard);
    if (targetDoc?.filingGroupId) doc.filingGroupId = targetDoc.filingGroupId;
    const to = state.documents.findIndex((item) => item.id === targetCard.dataset.docCard);
    state.documents.splice(Math.max(0, to), 0, doc);
  } else {
    state.documents.push(doc);
  }
  state.draggedDocId = "";
  renderWritingRoomCards();
  markDirty("Filing Cabinet order updated");
}

function startPanelDrag(event, panel) {
  if (event.target.closest("button, input, select, textarea")) return;
  const rect = panel.getBoundingClientRect();
  state.panelDrag = { panel, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
}

function movePanelDrag(event) {
  if (!state.panelDrag) return;
  const { panel, offsetX, offsetY } = state.panelDrag;
  panel.style.left = `${Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, event.clientX - offsetX))}px`;
  panel.style.top = `${Math.max(8, Math.min(window.innerHeight - 80, event.clientY - offsetY))}px`;
  panel.style.right = "auto";
}

function stopPanelDrag() { state.panelDrag = null; }


function toggleHelpPanel(show) {
  els.helpPanel.hidden = !show;
  if (show) els.helpPanel.style.zIndex = "70";
}

function hydrateIconButtons() {
  document.querySelectorAll("button[data-icon-src]").forEach((button) => {
    const src = button.dataset.iconSrc;
    if (!src || button.querySelector("img.tool-icon-img")) return;
    const fallback = button.textContent.trim();
    button.textContent = "";
    const image = document.createElement("img");
    image.className = "tool-icon-img";
    image.src = src;
    image.alt = "";
    button.append(image);
    if (fallback) {
      const label = document.createElement("span");
      label.className = "sr-only";
      label.textContent = button.getAttribute("aria-label") || fallback;
      button.append(label);
    }
  });
}

function toggleBlockPanel(show) {
  els.blockPanel.hidden = !show;
  if (show) els.blockIdInput.focus();
}

function saveBlock() {
  const id = els.blockIdInput.value.trim();
  if (!/^[A-Za-z]+-[A-Za-z0-9-]+$/.test(id)) {
    setStatus("Use TCard IDs like Item-Runestones", "dirty");
    return;
  }
  state.blocks[id] = {
    id,
    content: els.blockContentInput.value,
    updatedAt: new Date().toISOString(),
  };
  renderBlockList();
  renderActiveDocument();
  renderBookmarks();
  markDirty("TCard updated everywhere");
}

function insertBlockReference() {
  const id = els.blockIdInput.value.trim();
  if (!id) return;
  insertHtml(`{{${escapeHtml(id)}}}`);
  renderActiveDocument();
  renderBookmarks();
}

function renderBlockList() {
  const blocks = Object.values(state.blocks).sort((a, b) => a.id.localeCompare(b.id));
  els.blockList.innerHTML = blocks.length ? blocks.map((block) => (
    `<button type="button" data-block-id="${escapeAttr(block.id)}"><strong>${escapeHtml(block.id)}</strong><span>${escapeHtml(block.content).slice(0, 90)}</span></button>`
  )).join("") : `<p class="panel-help">No reusable TCards yet.</p>`;
}

function selectBlock(id) {
  const block = state.blocks[id];
  if (!block) return;
  els.blockIdInput.value = block.id;
  els.blockContentInput.value = block.content;
}

function syncAndSave(message) {
  syncEditorToDocument();
  markDirty(message);
}

function markDirty(message) {
  setStatus(message, "dirty");
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => persistNow("Autosaved locally"), AUTOSAVE_DELAY);
}

function persistNow(message) {
  localStorage.setItem(STORAGE_KEY, serializedWorkspace());
  setStatus(message, "saved");
}


function renderExportSourceSelect() {
  if (!els.exportSourceSelect) return;
  const type = els.exportSourceType.value;
  const sources = type === "block"
    ? Object.values(state.blocks).map((block) => ({ id: block.id, label: block.id }))
    : state.documents.map((doc) => ({ id: doc.id, label: doc.title }));
  els.exportSourceSelect.innerHTML = sources.map((source) => `<option value="${escapeAttr(source.id)}">${escapeHtml(source.label)}</option>`).join("");
}

function addExportItem() {
  const type = els.exportSourceType.value;
  const id = els.exportSourceSelect.value;
  if (!id) return;
  state.exportItems.push({ type, id });
  renderExportQueue();
}

function renderExportQueue() {
  if (!els.exportQueue) return;
  els.exportQueue.innerHTML = state.exportItems.length ? state.exportItems.map((item, index) => {
    const label = item.type === "block" ? item.id : (state.documents.find((doc) => doc.id === item.id)?.title || item.id);
    return `<div class="export-pill" draggable="true" data-export-index="${index}"><span>${escapeHtml(item.type === "block" ? "▣" : "📄")} ${escapeHtml(label)}</span><button type="button" data-remove-export="${index}" aria-label="Remove ${escapeAttr(label)}">×</button></div>`;
  }).join("") : `<p class="panel-help">No export pieces selected yet.</p>`;
}

function handleExportDragStart(event) {
  const pill = event.target.closest(".export-pill");
  if (!pill) return;
  state.draggedExportIndex = Number(pill.dataset.exportIndex);
}

function handleExportDragOver(event) {
  if (event.target.closest(".export-pill")) event.preventDefault();
}

function handleExportDrop(event) {
  const pill = event.target.closest(".export-pill");
  if (!pill || state.draggedExportIndex === null) return;
  event.preventDefault();
  const targetIndex = Number(pill.dataset.exportIndex);
  const [item] = state.exportItems.splice(state.draggedExportIndex, 1);
  state.exportItems.splice(targetIndex, 0, item);
  state.draggedExportIndex = null;
  renderExportQueue();
}

function handleExportQueueClick(event) {
  const button = event.target.closest("button[data-remove-export]");
  if (!button) return;
  state.exportItems.splice(Number(button.dataset.removeExport), 1);
  renderExportQueue();
}

function exportSmartBundle(format) {
  const items = state.exportItems.length ? state.exportItems : [{ type: "document", id: activeDocument().id }];
  const pieces = items.map(resolveExportPiece).filter(Boolean);
  const baseName = `capsanoto-${new Date().toISOString().slice(0, 10)}`;
  if (format === "caps") {
    downloadFile(`${baseName}.caps.json`, JSON.stringify({ schemaVersion: 1, type: "caps-file", createdAt: new Date().toISOString(), pieces }, null, 2), "application/json");
  } else if (format === "txt") {
    downloadFile(`${baseName}.txt`, pieces.map((piece) => `${piece.title}\n${textFromHtml(piece.html)}`).join("\n\n---\n\n"), "text/plain");
  } else {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(baseName)}</title></head><body>${pieces.map((piece) => `<section data-caps-type="${piece.type}" data-caps-id="${escapeAttr(piece.id)}"><h1>${escapeHtml(piece.title)}</h1>${piece.html}</section>`).join("\n")}</body></html>`;
    downloadFile(`${baseName}.${format === "doc" ? "doc" : "html"}`, html, format === "doc" ? "application/msword" : "text/html");
  }
  setStatus(`Exported ${format.toUpperCase()}`, "saved");
}

function resolveExportPiece(item) {
  if (item.type === "block") {
    const block = state.blocks[item.id];
    return block ? { type: "block", id: block.id, title: block.id, html: `<p>${sanitizeBlockContent(block.content)}</p>` } : null;
  }
  const doc = state.documents.find((entry) => entry.id === item.id);
  return doc ? { type: "document", id: doc.id, title: doc.title, html: renderTransclusions(doc.content) } : null;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function textFromHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || "";
}

function bindDesignToggle(button, input) {
  if (!button || !input) return;
  button.addEventListener("click", () => {
    input.checked = !input.checked;
    button.setAttribute("aria-pressed", String(input.checked));
  });
}

function bindDesignColorTools() {
  renderFavoriteColors();
  const colorInputs = document.querySelectorAll(".design-section input[type='color']");
  colorInputs.forEach((input) => {
    input.draggable = true;
    input.addEventListener("focus", () => syncActiveColorInput(input));
    input.addEventListener("input", () => syncActiveColorInput(input));
    input.addEventListener("dragstart", (event) => event.dataTransfer?.setData("text/plain", input.value));
    if (!state.lastColorInput) state.lastColorInput = input;
  });
  els.activeColorHex?.addEventListener("input", () => applyHexToActiveColor(els.activeColorHex.value));
  els.favoriteColors?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-favorite-color]");
    if (!button) return;
    applyHexToActiveColor(button.dataset.favoriteColor);
  });
  els.favoriteColors?.addEventListener("dragover", (event) => {
    if (event.target.closest("button[data-favorite-index]")) event.preventDefault();
  });
  els.favoriteColors?.addEventListener("drop", handleFavoriteColorDrop);
}

function renderFavoriteColors() {
  if (!els.favoriteColors) return;
  els.favoriteColors.innerHTML = state.favoriteColors.map((color, index) => (
    `<button type="button" data-favorite-index="${index}" data-favorite-color="${escapeAttr(color)}" aria-label="Use ${escapeAttr(color)}" style="--favorite-color:${escapeAttr(color)}"></button>`
  )).join("");
}

function handleFavoriteColorDrop(event) {
  const button = event.target.closest("button[data-favorite-index]");
  if (!button) return;
  event.preventDefault();
  const color = normalizeHexColor(event.dataTransfer?.getData("text/plain") || state.lastColorInput?.value || "");
  if (!color) return;
  state.favoriteColors[Number(button.dataset.favoriteIndex)] = color;
  renderFavoriteColors();
  setStatus("Favorite color updated", "saved");
}

function syncActiveColorInput(input) {
  if (!input) return;
  state.lastColorInput = input;
  if (els.activeColorHex) els.activeColorHex.value = input.value;
}

function applyHexToActiveColor(value) {
  const color = normalizeHexColor(value);
  if (!color || !state.lastColorInput) return;
  state.lastColorInput.value = color;
  syncActiveColorInput(state.lastColorInput);
}

function normalizeHexColor(value) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw.slice(1).split("").map((char) => char + char).join("")}`.toLowerCase();
  }
  return "";
}

function loadDesignForm() {
  const settings = currentDesignSettings();
  state.favoriteColors = validFavoriteColors(settings.favoriteColors);
  renderFavoriteColors();
  els.designButtonBg.value = settings.buttonBg;
  els.designBorderColor.value = settings.borderColor;
  els.designTextColor.value = settings.textColor;
  els.designFontSize.value = settings.fontSize;
  els.designBold.checked = settings.bold;
  els.designBgImage.value = settings.bgImage;
  els.dialogBgColor.value = settings.dialogBg;
  els.dialogBorderColor.value = settings.dialogBorder;
  els.dialogShadowColor.value = settings.dialogShadow;
  els.dialogTextColor.value = settings.dialogText;
  els.dialogFontSize.value = settings.dialogFontSize;
  els.dialogBold.checked = settings.dialogBold;
  els.dialogButtonBg.value = settings.dialogButtonBg;
  els.dialogButtonBorder.value = settings.dialogButtonBorder;
  els.dialogButtonText.value = settings.dialogButtonText;
  els.dialogButtonShadow.value = settings.dialogButtonShadow;
  els.labelTextColor.value = settings.labelText;
  els.dynamicTextColor.value = settings.dynamicText;
  els.scrollbarTrackColor.value = settings.scrollbarTrack;
  els.scrollbarThumbColor.value = settings.scrollbarThumb;
  els.statusBgColor.value = settings.statusBg;
  els.statusBorderColor.value = settings.statusBorder;
  els.statusTextColor.value = settings.statusText;
  els.emphasisBgColor.value = settings.emphasisBg;
  els.emphasisBorderColor.value = settings.emphasisBorder;
  els.emphasisTextColor.value = settings.emphasisText;
  els.panelBgColor.value = settings.panelBg;
  els.panelBorderColor.value = settings.panelBorder;
  els.designBoldToggle?.setAttribute("aria-pressed", String(settings.bold));
  els.dialogBoldToggle?.setAttribute("aria-pressed", String(settings.dialogBold));
  syncActiveColorInput(els.designBorderColor);
}

function validFavoriteColors(colors) {
  const values = Array.isArray(colors) ? colors.map(normalizeHexColor).filter(Boolean) : [];
  return [...values, ...DEFAULT_FAVORITE_COLORS].slice(0, DEFAULT_FAVORITE_COLORS.length);
}

function currentDesignSettings() {
  try {
    return { ...defaultDesignSettings(), ...(JSON.parse(localStorage.getItem(DESIGN_KEY) || "null") || {}) };
  } catch (error) {
    console.warn("Ignoring unreadable Capsanoto design settings", error);
    localStorage.removeItem(DESIGN_KEY);
    return defaultDesignSettings();
  }
}

function defaultDesignSettings() {
  const palette = CAPSANOTO_PALETTE;
  return {
    buttonBg: palette.charcoal,
    borderColor: palette.peach,
    textColor: palette.parchment,
    fontSize: "14",
    bold: true,
    bgImage: "wallpapersm.jpg",
    dialogBg: palette.espresso,
    dialogBorder: palette.peach,
    dialogShadow: palette.black,
    dialogText: palette.parchment,
    dialogFontSize: "14",
    dialogBold: true,
    dialogButtonBg: palette.charcoal,
    dialogButtonBorder: palette.peach,
    dialogButtonText: palette.parchment,
    dialogButtonShadow: palette.black,
    labelText: palette.ochre,
    dynamicText: palette.peach,
    scrollbarTrack: palette.espresso,
    scrollbarThumb: palette.peach,
    statusBg: palette.black,
    statusBorder: palette.ochre,
    statusText: palette.parchment,
    emphasisBg: palette.umber,
    emphasisBorder: palette.amethyst,
    emphasisText: palette.parchment,
    panelBg: palette.espresso,
    panelBorder: palette.clay,
    favoriteColors: [...DEFAULT_FAVORITE_COLORS],
  };
}

function saveDesignSettings() {
  const settings = { buttonBg: els.designButtonBg.value, borderColor: els.designBorderColor.value, textColor: els.designTextColor.value, fontSize: els.designFontSize.value || "14", bold: els.designBold.checked, bgImage: els.designBgImage.value.trim(), dialogBg: els.dialogBgColor.value, dialogBorder: els.dialogBorderColor.value, dialogShadow: els.dialogShadowColor.value, dialogText: els.dialogTextColor.value, dialogFontSize: els.dialogFontSize.value || "14", dialogBold: els.dialogBold.checked, dialogButtonBg: els.dialogButtonBg.value, dialogButtonBorder: els.dialogButtonBorder.value, dialogButtonText: els.dialogButtonText.value, dialogButtonShadow: els.dialogButtonShadow.value, labelText: els.labelTextColor.value, dynamicText: els.dynamicTextColor.value, scrollbarTrack: els.scrollbarTrackColor.value, scrollbarThumb: els.scrollbarThumbColor.value, statusBg: els.statusBgColor.value, statusBorder: els.statusBorderColor.value, statusText: els.statusTextColor.value, emphasisBg: els.emphasisBgColor.value, emphasisBorder: els.emphasisBorderColor.value, emphasisText: els.emphasisTextColor.value, panelBg: els.panelBgColor.value, panelBorder: els.panelBorderColor.value, favoriteColors: [...state.favoriteColors] };
  localStorage.setItem(DESIGN_KEY, JSON.stringify(settings));
  applyDesignSettings(settings);
  setStatus("Design applied", "saved");
}

function resetDesignSettings() {
  localStorage.removeItem(DESIGN_KEY);
  applyDesignSettings(defaultDesignSettings());
  loadDesignForm();
  setStatus("Design reset", "saved");
}

function applySavedDesignSettings() {
  applyDesignSettings(currentDesignSettings());
}

function applyDesignSettings(settings) {
  const root = document.documentElement;
  root.style.setProperty("--button", settings.buttonBg);
  root.style.setProperty("--line", settings.borderColor);
  root.style.setProperty("--ink", settings.textColor);
  root.style.setProperty("--button-font-size", `${settings.fontSize}px`);
  root.style.setProperty("--button-font-weight", settings.bold ? "800" : "500");
  root.style.setProperty("--app-bg-image", settings.bgImage ? `url("${escapeCssUrl(settings.bgImage)}")` : "none");
  root.style.setProperty("--dialog-bg", settings.dialogBg);
  root.style.setProperty("--dialog-border", settings.dialogBorder);
  root.style.setProperty("--dialog-shadow", settings.dialogShadow);
  root.style.setProperty("--dialog-text", settings.dialogText);
  root.style.setProperty("--dialog-font-size", `${settings.dialogFontSize}px`);
  root.style.setProperty("--dialog-font-weight", settings.dialogBold ? "800" : "500");
  root.style.setProperty("--dialog-button-bg", settings.dialogButtonBg);
  root.style.setProperty("--dialog-button-border", settings.dialogButtonBorder);
  root.style.setProperty("--dialog-button-text", settings.dialogButtonText);
  root.style.setProperty("--dialog-button-shadow", settings.dialogButtonShadow);
  root.style.setProperty("--label-text", settings.labelText);
  root.style.setProperty("--dynamic-text", settings.dynamicText);
  root.style.setProperty("--scrollbar-track", settings.scrollbarTrack);
  root.style.setProperty("--scrollbar-thumb", settings.scrollbarThumb);
  root.style.setProperty("--status-bg", settings.statusBg);
  root.style.setProperty("--status-border", settings.statusBorder);
  root.style.setProperty("--status-text", settings.statusText);
  root.style.setProperty("--emphasis-bg", settings.emphasisBg);
  root.style.setProperty("--emphasis-border", settings.emphasisBorder);
  root.style.setProperty("--emphasis-text", settings.emphasisText);
  root.style.setProperty("--panel-bg", settings.panelBg);
  root.style.setProperty("--panel-border", settings.panelBorder);
}

function resetLocalWorkspace() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function exportWorkspace() {
  persistNow("Export prepared");
  const blob = new Blob([serializedWorkspace()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "documents.json";
  link.click();
  URL.revokeObjectURL(url);
}

function serializedWorkspace() {
  return JSON.stringify({
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    documents: state.documents,
    blocks: state.blocks,
    filingGroups: state.filingGroups,
    trash: state.trash,
    deprecated: state.deprecated,
  }, null, 2);
}

function updateUrl(bookmarkId = "") {
  history.replaceState(null, "", documentUrl(activeDocument().id, bookmarkId));
}

function parseRoute() {
  const params = new URLSearchParams(location.search);
  return {
    documentId: params.get("doc") || "",
    bookmarkId: decodeURIComponent(location.hash.replace(/^#/, "")),
  };
}

function documentUrl(documentId, bookmarkId = "") {
  const url = new URL(location.href);
  url.pathname = editorPathname();
  url.search = "";
  url.searchParams.set("doc", documentId);
  url.hash = bookmarkId ? encodeURIComponent(bookmarkId) : "";
  return `${url.pathname}${url.search}${url.hash}`;
}

function editorPathname() {
  const segments = location.pathname.split("/");
  if (!segments[segments.length - 1] || segments[segments.length - 1].endsWith(".html")) {
    segments[segments.length - 1] = EDITOR_ENTRY;
  } else {
    segments.push(EDITOR_ENTRY);
  }
  return segments.join("/");
}

function sectionUrl(documentId, bookmarkId) {
  return documentUrl(documentId, bookmarkId);
}

function absoluteSectionUrl(documentId, bookmarkId) {
  return new URL(sectionUrl(documentId, bookmarkId), location.href).href;
}

function findDocumentByRouteId(value) {
  const decoded = decodeURIComponent(value);
  return state.documents.find((item) => item.id === decoded)
    ?? state.documents.find((item) => slugify(item.title) === slugify(decoded));
}

async function copyBookmarkLink(bookmarkId) {
  const url = absoluteSectionUrl(activeDocument().id, bookmarkId);
  await copyText(url);
  setStatus("Copied section link", "saved");
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function normalizeLinkTarget(value) {
  const raw = String(value || "").trim();
  if (/^(https?:|mailto:)/i.test(raw)) {
    return { type: "external", target: raw, href: raw, label: raw };
  }

  const blockToken = raw.match(/^\{\{([A-Za-z]+-[A-Za-z0-9-]+)\}\}$/);
  const blockTarget = raw.startsWith("block:") ? raw.slice(6) : blockToken?.[1];
  if (blockTarget) {
    return { type: "block", target: blockTarget, href: `#block-${encodeURIComponent(blockTarget)}`, label: `Block: ${blockTarget}` };
  }

  if (raw.startsWith("#")) {
    const bookmark = raw.slice(1);
    return { type: "bookmark", target: bookmark, href: documentUrl(activeDocument().id, bookmark), label: `Bookmark: ${bookmark}` };
  }

  const localBookmark = findBookmarkId(raw);
  if (localBookmark) {
    return { type: "bookmark", target: localBookmark, href: documentUrl(activeDocument().id, localBookmark), label: `Bookmark: ${localBookmark}` };
  }

  const [docPart, bookmarkPart] = raw.split("#");
  const doc = findDocumentByRouteId(docPart);
  if (doc) {
    return bookmarkPart
      ? { type: "bookmark", target: bookmarkPart, href: documentUrl(doc.id, bookmarkPart), label: `${doc.title}#${bookmarkPart}` }
      : { type: "document", target: doc.id, href: documentUrl(doc.id), label: `Document: ${doc.title}` };
  }

  return { type: "external", target: raw, href: raw, label: raw };
}

function findBookmarkId(value) {
  const requested = slugify(value);
  const bookmark = getBookmarks().find((item) => item.id === value || slugify(item.id) === requested || slugify(item.label) === requested);
  return bookmark?.id || "";
}

function cssString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeCssUrl(value) {
  return String(value ?? "").replace(/["\\\n\r\f]/g, "");
}

function uniqueBookmarkId(base) {
  let id = base || "section";
  let index = 2;
  while (els.editor.querySelector(`#${CSS.escape(id)}`)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

function humanizeDocumentId(value) {
  return decodeURIComponent(value).replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
}

function sanitizeBlockContent(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function updateContextStatus() {
  if (!els.contextStatus || state.contextStatusLocked) return;
  const selection = window.getSelection();
  if (!selection?.rangeCount) {
    setContextStatus("···");
    return;
  }

  const range = selection.getRangeAt(0);
  if (!els.editor.contains(range.commonAncestorContainer)) {
    setContextStatus("···");
    return;
  }

  const node = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;
  const parts = [];
  parts.push(selection.isCollapsed ? "Cursor" : `Selection: ${selection.toString().trim().length} chars`);

  const link = node?.closest?.("a");
  const block = node?.closest?.(".transclusion-ref");
  const heading = node?.closest?.("h1[id], h2[id], h3[id], [data-bookmark='true'][id]");
  const table = node?.closest?.("table");
  const list = node?.closest?.("ul, ol");
  const emphasis = node?.closest?.(".emphasis-box");

  if (emphasis) parts.push("emphasis box");
  if (block) parts.push(`inside transclusion block ${block.dataset.blockId || ""}`.trim());
  if (link) parts.push(link.classList.contains("pill-link") ? "pill link" : "link");
  if (heading) parts.push(`bookmark heading #${heading.id}`);
  if (table) parts.push("table");
  if (list) parts.push("list");
  if (!link && !block && !heading && !table && !list && !emphasis) parts.push("normal text");

  setContextStatus(parts.join(" · "));
}

function updateHoverStatus(event) {
  if (!els.contextStatus || state.contextStatusLocked) return;
  const target = event.target;
  const interactive = target.closest?.("button, select, input, textarea, summary, .tool-menu-trigger, #editor, .title-input");
  if (!interactive) return;
  if (interactive === els.titleInput) setContextStatus("Document title field");
  else if (interactive === els.tagsInput) setContextStatus("Document metadata tags");
  else if (interactive === els.documentSelect) setContextStatus("Current document selector");
  else if (interactive === els.newDocumentButton) setContextStatus("Create a new Writing Room document");
  else if (interactive === els.documentSettingsButton) setContextStatus("Open Filing Cabinet settings for folders, tabs, and documents");
  else if (interactive === els.writingRoomButton) setContextStatus("Open Writing Room filing cabinet tabs");
  else if (interactive === els.settingsButton) setContextStatus("Open Writing Room settings");
  else if (interactive === els.topHelpButton || interactive === els.helpButton) setContextStatus("Open Help and release notes");
  else if (interactive === els.emphasisButton) setContextStatus("Wrap highlighted text in an emphasis box");
  else setContextStatus(interactive.dataset?.toolName || interactive.getAttribute?.("aria-label") || interactive.textContent.trim() || "Writing Room control");
}

function setContextStatus(message, lock = false, timeout = 0) {
  if (!els.contextStatus) return;
  clearTimeout(state.contextStatusTimer);
  state.contextStatusLocked = lock;
  els.contextStatus.textContent = message || "···";
  if (timeout) {
    state.contextStatusTimer = setTimeout(() => {
      state.contextStatusLocked = false;
      updateContextStatus();
    }, timeout);
  }
}

function setStatus(message, className) {
  els.saveStatus.textContent = message;
  els.saveStatus.className = `save-status ${className}`;
  if (className === "dirty") setContextStatus(`${message} …`, true);
  else if (className === "saved") setContextStatus(message, true, 1400);
  else setContextStatus(message, false);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
