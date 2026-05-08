const STORAGE_KEY = "forever-bound-writing-room-v2";
const AUTH_KEY = "forever-bound-authenticated";
const AUTH_CONFIG_PATH = "config/auth.json";
const CONTENT_PATH = "content/documents.json";
const EDITOR_ENTRY = "editor.html";
const AUTOSAVE_DELAY = 600;
const DESIGN_KEY = "capsanoto-design-settings-v1";

const DEFAULT_WORKSPACE = {
  schemaVersion: 2,
  updatedAt: "2026-05-08T00:00:00.000Z",
  documents: [
    {
      id: "project-overview",
      title: "Project Overview",
      tags: ["overview", "worldbuilding", "editor"],
      updatedAt: "2026-05-07T00:00:00.000Z",
      content: '<h1 id="writing-room">Forever Bound Writing Room</h1><p>This is a minimal browser-based writing space for long-form lore and interconnected worldbuilding. The interface stays out of the way until formatting, links, bookmarks, or reusable blocks are needed.</p><h2 id="bookmarks">Bookmarks</h2><p>Any heading with an ID becomes a bookmark pill under the toolbar. Use the Bookmark button to create a new jump target with a direct URL anchor.</p><h2 id="links-and-pills">Links and Pill Links</h2><p>Normal hyperlinks work inside the document, and selected text can also become a <a class="pill-link" href="editor.html?doc=episode-01">rounded pill-style document link</a>.</p><h2 id="transclusions">Transclusions</h2><p>Reusable content blocks appear wherever their token is used. Example:</p><p>{{Item-Runestones}}</p>',
    },
    {
      id: "episode-01",
      title: "Episode 01",
      tags: ["season-1", "episode"],
      updatedAt: "2026-05-07T00:00:00.000Z",
      content: '<h1 id="episode-01">Episode 01</h1><p>Draft the episode here in a clean writing environment.</p><h2 id="synopsis">Synopsis</h2><p>Write the episode summary.</p><h2 id="canon-notes">Canon Notes</h2><p>Use reusable blocks for shared lore, such as {{Location-Ironvale}}.</p><h2 id="structure">Structure</h2><table><thead><tr><th>Beat</th><th>Notes</th></tr></thead><tbody><tr><td>Opening</td><td></td></tr><tr><td>Turn</td><td></td></tr><tr><td>Ending</td><td></td></tr></tbody></table>',
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
  settingsMenu: document.querySelector(".settings-menu"),
  settingsSections: document.querySelectorAll("[data-settings-section]"),
  documentCards: document.querySelector("#documentCards"),
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
      showPasswordScreen("That password did not match the shared project password.");
      return;
    }

    localStorage.setItem(AUTH_KEY, "true");
    els.passwordInput.value = "";
    setPasswordFormState(false, "Unlocking workspace…");
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
    } catch (error) {
      console.warn("Ignoring unreadable local Capsanoto workspace", error);
      localStorage.removeItem(STORAGE_KEY);
      state.documents = [];
      state.blocks = {};
    }
  }

  if (!state.documents.length) {
    const payload = await loadStarterWorkspace();
    state.documents = Array.isArray(payload.documents) ? payload.documents : [];
    state.blocks = payload.blocks && typeof payload.blocks === "object" ? payload.blocks : {};
    persistNow("Loaded starter workspace");
  }

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

  console.warn(`Using embedded Capsanoto starter workspace after content load failed: ${errors.join(" | ")}`);
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
    markDirty("Autosaving locally…");
  });

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
  els.settingsButton.addEventListener("click", () => toggleSettingsPanel(true));
  els.closeSettingsPanel.addEventListener("click", () => toggleSettingsPanel(false));
  els.settingsMenu.addEventListener("click", handleSettingsMenuClick);
  els.documentCards.addEventListener("click", handleDocumentCardClick);
  els.helpButton.addEventListener("click", () => toggleHelpPanel(true));
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
  renderDocumentCards();
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
  const scrollY = window.scrollY;
  const bookmarks = getBookmarks();
  els.bookmarkBar.innerHTML = bookmarks.length ? bookmarks.map((bookmark) => {
    const href = sectionUrl(activeDocument().id, bookmark.id);
    return `<span class="bookmark-group"><a class="bookmark-pill" href="${escapeAttr(href)}" data-bookmark="${escapeAttr(bookmark.id)}">${escapeHtml(bookmark.label)}</a><button class="copy-bookmark" type="button" data-copy-bookmark="${escapeAttr(bookmark.id)}" title="Copy section link" aria-label="Copy link to ${escapeAttr(bookmark.label)}">🔗</button></span>`;
  }).join("") : `<span class="empty-bookmarks">Add headings or bookmarks to jump through this document.</span>`;
  window.scrollTo({ top: scrollY, left: window.scrollX, behavior: "auto" });
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
  const result = await openCapsDialog("Create Transclusion", [
    { name: "id", label: "Block ID", value: "", placeholder: "Character-Name / Item-Name / Location-Name" },
    { name: "content", label: "Block Content", value: selectedText, multiline: true },
  ]);
  if (!result?.id) return;
  const id = result.id.trim();
  if (!/^[A-Za-z]+-[A-Za-z0-9-]+$/.test(id)) {
    setStatus("Use block IDs like Item-Runestones", "dirty");
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
  els.dialogFields.innerHTML = fields.map((field) => `
    <label>${escapeHtml(field.label)}
      ${field.multiline
        ? `<textarea name="${escapeAttr(field.name)}" rows="5" placeholder="${escapeAttr(field.placeholder || "")}">${escapeHtml(field.value || "")}</textarea>`
        : `<input name="${escapeAttr(field.name)}" value="${escapeAttr(field.value || "")}" placeholder="${escapeAttr(field.placeholder || "")}">`}
    </label>
  `).join("");
  els.dialogOverlay.hidden = false;
  els.dialogFields.querySelector("input, textarea")?.focus();
  return new Promise((resolve) => { state.dialogResolver = resolve; });
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
    showSettingsSection("documents");
    renderDocumentCards();
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

function showSettingsSection(sectionName) {
  els.settingsMenu.querySelectorAll("button[data-settings-tab]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.settingsTab === sectionName));
  });
  els.settingsSections.forEach((section) => {
    section.hidden = section.dataset.settingsSection !== sectionName;
  });
}

function renderDocumentCards() {
  if (!els.documentCards) return;
  els.documentCards.innerHTML = state.documents.map((doc) => {
    const tags = (doc.tags ?? []).slice(0, 4);
    const updated = doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : "Not saved yet";
    return `<article class="document-card ${doc.id === state.activeId ? "is-active" : ""}" data-doc-card="${escapeAttr(doc.id)}">
      <div>
        <p class="eyebrow">${doc.id === state.activeId ? "Current Card" : "Writing Card"}</p>
        <h4>${escapeHtml(doc.title)}</h4>
        <p>${escapeHtml(textFromHtml(renderTransclusions(doc.content)).slice(0, 140) || "Empty card")}</p>
      </div>
      <div class="document-card-tags">${tags.length ? tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("") : "<span>No tags</span>"}</div>
      <footer>
        <small>Updated ${escapeHtml(updated)}</small>
        <span class="document-card-actions">
          <button type="button" data-card-action="open" data-doc-id="${escapeAttr(doc.id)}">Open</button>
          <button type="button" data-card-action="copy" data-doc-id="${escapeAttr(doc.id)}">Copy URL</button>
        </span>
      </footer>
    </article>`;
  }).join("");
}

async function handleDocumentCardClick(event) {
  const button = event.target.closest("button[data-card-action]");
  if (!button) return;
  const docId = button.dataset.docId;
  if (button.dataset.cardAction === "open") {
    openDocument(docId);
    toggleSettingsPanel(false);
    return;
  }
  if (button.dataset.cardAction === "copy") {
    await copyText(new URL(documentUrl(docId), location.href).href);
    setStatus("Copied document card link", "saved");
  }
}

function toggleHelpPanel(show) {
  els.helpPanel.hidden = !show;
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
    setStatus("Use block IDs like Item-Runestones", "dirty");
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
  markDirty("Transclusion block updated everywhere");
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
  )).join("") : `<p class="panel-help">No reusable blocks yet.</p>`;
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

function loadDesignForm() {
  const settings = currentDesignSettings();
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
}

function currentDesignSettings() {
  try {
    return JSON.parse(localStorage.getItem(DESIGN_KEY) || "null") || defaultDesignSettings();
  } catch (error) {
    console.warn("Ignoring unreadable Capsanoto design settings", error);
    localStorage.removeItem(DESIGN_KEY);
    return defaultDesignSettings();
  }
}

function defaultDesignSettings() {
  return { buttonBg: "#2c2c2c", borderColor: "#d88a64", textColor: "#f3ead7", fontSize: "14", bold: true, bgImage: "wallpapersm.jpg", dialogBg: "#191711", dialogBorder: "#d88a64", dialogShadow: "#000000", dialogText: "#f3ead7", dialogFontSize: "14", dialogBold: true, dialogButtonBg: "#2c2c2c", dialogButtonBorder: "#d88a64", dialogButtonText: "#f3ead7", dialogButtonShadow: "#000000" };
}

function saveDesignSettings() {
  const settings = { buttonBg: els.designButtonBg.value, borderColor: els.designBorderColor.value, textColor: els.designTextColor.value, fontSize: els.designFontSize.value || "14", bold: els.designBold.checked, bgImage: els.designBgImage.value.trim(), dialogBg: els.dialogBgColor.value, dialogBorder: els.dialogBorderColor.value, dialogShadow: els.dialogShadowColor.value, dialogText: els.dialogTextColor.value, dialogFontSize: els.dialogFontSize.value || "14", dialogBold: els.dialogBold.checked, dialogButtonBg: els.dialogButtonBg.value, dialogButtonBorder: els.dialogButtonBorder.value, dialogButtonText: els.dialogButtonText.value, dialogButtonShadow: els.dialogButtonShadow.value };
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

function setStatus(message, className) {
  els.saveStatus.textContent = message;
  els.saveStatus.className = `save-status ${className}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
