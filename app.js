const STORAGE_KEY = "forever-bound-writing-room-v2";
const AUTH_KEY = "forever-bound-authenticated";
const AUTH_CONFIG_PATH = "config/auth.json";
const AUTOSAVE_DELAY = 600;

const state = {
  documents: [],
  blocks: {},
  activeId: null,
  saveTimer: null,
  suppressInput: false,
  sharedPassword: "",
};

const els = {
  passwordScreen: document.querySelector("#passwordScreen"),
  passwordForm: document.querySelector("#passwordForm"),
  passwordInput: document.querySelector("#passwordInput"),
  passwordError: document.querySelector("#passwordError"),
  editorApp: document.querySelector("#editorApp"),
  documentSelect: document.querySelector("#documentSelect"),
  newDocumentButton: document.querySelector("#newDocumentButton"),
  saveStatus: document.querySelector("#saveStatus"),
  exportButton: document.querySelector("#exportButton"),
  logoutButton: document.querySelector("#logoutButton"),
  toolbar: document.querySelector(".toolbar"),
  linkButton: document.querySelector("#linkButton"),
  pillLinkButton: document.querySelector("#pillLinkButton"),
  bookmarkButton: document.querySelector("#bookmarkButton"),
  tableButton: document.querySelector("#tableButton"),
  imageButton: document.querySelector("#imageButton"),
  imageInput: document.querySelector("#imageInput"),
  emojiButton: document.querySelector("#emojiButton"),
  blockButton: document.querySelector("#blockButton"),
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
  showPasswordScreen();
  els.passwordError.textContent = "Unable to load password settings. Check config/auth.json.";
});

async function boot() {
  markFrameMode();
  await loadAuthConfig();
  bindAuthEvents();
  if (!isAuthenticated()) {
    showPasswordScreen();
    return;
  }
  await startEditor();
}

async function loadAuthConfig() {
  const response = await fetch(AUTH_CONFIG_PATH, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load ${AUTH_CONFIG_PATH}`);
  const config = await response.json();
  state.sharedPassword = config.sharedPassword ?? "";
}

function bindAuthEvents() {
  els.passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (els.passwordInput.value === state.sharedPassword) {
      localStorage.setItem(AUTH_KEY, "true");
      els.passwordInput.value = "";
      await startEditor();
    } else {
      els.passwordError.textContent = "That password did not match the shared project password.";
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
  bindEditorEvents();
  openFromHash();
  renderAll();
  setStatus("Ready", "saved");
}

function showPasswordScreen() {
  setAuthVisibility(false);
  els.passwordError.textContent = "";
  requestAnimationFrame(() => els.passwordInput.focus());
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
    const payload = JSON.parse(saved);
    state.documents = payload.documents ?? [];
    state.blocks = payload.blocks ?? {};
  } else {
    const response = await fetch("content/documents.json", { cache: "no-store" });
    const payload = await response.json();
    state.documents = payload.documents ?? [];
    state.blocks = payload.blocks ?? {};
    persistNow("Loaded starter workspace");
  }

  if (!state.documents.length) createDocument();
  state.activeId = state.documents[0].id;
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
  els.pillLinkButton.addEventListener("click", createPillLink);
  els.bookmarkButton.addEventListener("click", insertBookmark);
  els.tableButton.addEventListener("click", insertTable);
  els.imageButton.addEventListener("click", () => els.imageInput.click());
  els.imageInput.addEventListener("change", embedSelectedImage);
  els.emojiButton.addEventListener("click", () => insertHtml("✨"));
  els.exportButton.addEventListener("click", exportWorkspace);

  els.bookmarkBar.addEventListener("click", (event) => {
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

  window.addEventListener("hashchange", openFromHash);
  document.addEventListener("keydown", (event) => {
    const isModifier = event.metaKey || event.ctrlKey;
    if (isModifier && event.key.toLowerCase() === "s") {
      event.preventDefault();
      persistNow("Saved locally");
    }
  });
}

function createDocument() {
  const doc = {
    id: `doc-${Date.now()}`,
    title: "Untitled Document",
    tags: [],
    updatedAt: new Date().toISOString(),
    content: els.documentTemplate.innerHTML.trim(),
  };
  state.documents.unshift(doc);
  return doc;
}

function openDocument(id) {
  state.activeId = id;
  renderAll();
  updateUrl();
  setStatus("Ready", "saved");
}

function openFromHash() {
  const { documentId, bookmarkId } = parseHash();
  if (documentId && state.documents.some((doc) => doc.id === documentId)) {
    state.activeId = documentId;
    renderAll();
  }
  if (bookmarkId) requestAnimationFrame(() => jumpToBookmark(bookmarkId, false));
}

function activeDocument() {
  return state.documents.find((doc) => doc.id === state.activeId) ?? state.documents[0];
}

function renderAll() {
  renderDocumentSelect();
  renderActiveDocument();
  renderBookmarks();
  renderBlockList();
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
  const bookmarks = getBookmarks();
  els.bookmarkBar.innerHTML = bookmarks.length ? bookmarks.map((bookmark) => (
    `<a class="bookmark-pill" href="#${encodeURIComponent(activeDocument().id)}/${encodeURIComponent(bookmark.id)}" data-bookmark="${escapeAttr(bookmark.id)}">${escapeHtml(bookmark.label)}</a>`
  )).join("") : `<span class="empty-bookmarks">Add headings or bookmarks to jump through this document.</span>`;
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

function createHyperlink() {
  const url = prompt("Link URL, bookmark anchor, or document URL");
  if (!url) return;
  runLinkCommand(url, "");
}

function createPillLink() {
  const url = prompt("Pill destination: document id, #bookmark, or https:// URL");
  if (!url) return;
  runLinkCommand(normalizeLinkTarget(url), "pill-link");
}

function runLinkCommand(url, className) {
  els.editor.focus();
  document.execCommand("createLink", false, url);
  const link = currentLink();
  if (link && className) link.classList.add(className);
  syncAndSave(className ? "Pill link created" : "Link created");
}

function currentLink() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return null;
  let node = selection.anchorNode;
  while (node && node !== els.editor) {
    if (node.nodeType === Node.ELEMENT_NODE && node.matches("a")) return node;
    node = node.parentNode;
  }
  return els.editor.querySelector("a[href]:focus");
}

function insertBookmark() {
  const label = prompt("Bookmark heading name");
  if (!label) return;
  const id = uniqueBookmarkId(slugify(label));
  insertHtml(`<h2 id="${escapeAttr(id)}" data-bookmark="true">${escapeHtml(label)}</h2><p></p>`);
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
  const hash = bookmarkId ? `${activeDocument().id}/${bookmarkId}` : activeDocument().id;
  history.replaceState(null, "", `#${hash}`);
}

function parseHash() {
  const [documentId, bookmarkId] = decodeURIComponent(location.hash.replace(/^#/, "")).split("/");
  return { documentId, bookmarkId };
}

function normalizeLinkTarget(value) {
  if (/^(https?:|mailto:|#)/i.test(value)) return value;
  const doc = state.documents.find((item) => item.id === value || item.title.toLowerCase() === value.toLowerCase());
  return doc ? `#${doc.id}` : value;
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
