const STORAGE_KEY = "forever-bound-writing-room-v2";
const AUTH_KEY = "forever-bound-authenticated";
const AUTH_CONFIG_PATH = "config/auth.json";
const EDITOR_ENTRY = "editor.html";
const AUTOSAVE_DELAY = 600;

const state = {
  documents: [],
  blocks: {},
  activeId: null,
  saveTimer: null,
  pendingBookmarkId: "",
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
  hydrateIconButtons();
  bindEditorEvents();
  applyRouteToState();
  renderAll();
  if (!new URLSearchParams(location.search).has("doc")) updateUrl();
  scrollToRouteBookmark();
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
  els.editLinkButton.addEventListener("click", editSelectedLink);
  els.pillLinkButton.addEventListener("click", createPillLink);
  els.removeLinkButton.addEventListener("click", removeSelectedLink);
  els.bookmarkButton.addEventListener("click", insertBookmark);
  els.tableButton.addEventListener("click", insertTable);
  els.imageButton.addEventListener("click", () => els.imageInput.click());
  els.imageInput.addEventListener("change", embedSelectedImage);
  els.emojiButton.addEventListener("click", () => insertHtml("✨"));
  els.exportButton.addEventListener("click", exportWorkspace);
  els.helpButton.addEventListener("click", () => toggleHelpPanel(true));
  els.closeHelpPanel.addEventListener("click", () => toggleHelpPanel(false));

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

  els.editor.addEventListener("click", handleEditorLinkClick);
  els.editor.addEventListener("mouseover", handleEditorLinkPreview);

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

function createHyperlink() {
  const target = prompt("Link target: document id, #bookmark, block:Item-Name, {{Item-Name}}, or https:// URL");
  if (!target) return;
  runLinkCommand(target, { pill: false });
}

function createPillLink() {
  const existingLink = currentLink();
  if (existingLink) {
    existingLink.classList.add("pill-link");
    existingLink.dataset.linkStyle = "pill";
    syncAndSave("Converted link to pill");
    return;
  }

  const target = prompt("Pill target: document id, #bookmark, block:Item-Name, {{Item-Name}}, or https:// URL");
  if (!target) return;
  runLinkCommand(target, { pill: true });
}

function editSelectedLink() {
  const link = currentLink();
  if (!link) {
    setStatus("Select a link to edit", "dirty");
    return;
  }
  const currentTarget = link.dataset.linkTarget || link.getAttribute("href") || "";
  const target = prompt("Edit link target", currentTarget);
  if (!target) return;
  applyLinkTarget(link, target, link.classList.contains("pill-link"));
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
