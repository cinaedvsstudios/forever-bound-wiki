const STORAGE_KEY = "forever-bound-lore-documents-v1";
const AUTOSAVE_DELAY = 700;

const state = {
  documents: [],
  activeId: null,
  dirty: false,
  saveTimer: null,
  sectionsCollapsed: false,
};

const els = {
  documentList: document.querySelector("#documentList"),
  searchInput: document.querySelector("#searchInput"),
  searchResults: document.querySelector("#searchResults"),
  newDocButton: document.querySelector("#newDocButton"),
  exportButton: document.querySelector("#exportButton"),
  copyHtmlButton: document.querySelector("#copyHtmlButton"),
  commitButton: document.querySelector("#commitButton"),
  githubOwnerInput: document.querySelector("#githubOwnerInput"),
  githubRepoInput: document.querySelector("#githubRepoInput"),
  githubBranchInput: document.querySelector("#githubBranchInput"),
  githubPathInput: document.querySelector("#githubPathInput"),
  githubTokenInput: document.querySelector("#githubTokenInput"),
  titleInput: document.querySelector("#titleInput"),
  saveStatus: document.querySelector("#saveStatus"),
  wordCount: document.querySelector("#wordCount"),
  toggleMetaButton: document.querySelector("#toggleMetaButton"),
  toggleSectionsButton: document.querySelector("#toggleSectionsButton"),
  metadataPanel: document.querySelector("#metadataPanel"),
  typeInput: document.querySelector("#typeInput"),
  statusInput: document.querySelector("#statusInput"),
  tagsInput: document.querySelector("#tagsInput"),
  summaryInput: document.querySelector("#summaryInput"),
  editor: document.querySelector("#editor"),
  toolbar: document.querySelector(".toolbar"),
  tableButton: document.querySelector("#tableButton"),
  imageButton: document.querySelector("#imageButton"),
  imageInput: document.querySelector("#imageInput"),
  emojiButton: document.querySelector("#emojiButton"),
  newDocTemplate: document.querySelector("#newDocTemplate"),
};

async function boot() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    state.documents = JSON.parse(saved).documents ?? [];
  } else {
    const response = await fetch("content/documents.json", { cache: "no-store" });
    const payload = await response.json();
    state.documents = payload.documents;
    persistNow("Loaded starter documents");
  }

  state.activeId = state.documents[0]?.id ?? createDocument().id;
  bindEvents();
  renderAll();
  setStatus("Ready", "saved");
}

function bindEvents() {
  els.documentList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-id]");
    if (button) openDocument(button.dataset.id);
  });

  els.searchInput.addEventListener("input", renderSearchResults);
  els.searchResults.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-id]");
    if (button) openDocument(button.dataset.id);
  });

  els.newDocButton.addEventListener("click", () => {
    const doc = createDocument();
    state.activeId = doc.id;
    renderAll();
    markDirty("New document created");
    els.titleInput.focus();
    els.titleInput.select();
  });

  els.exportButton.addEventListener("click", exportDocuments);
  els.copyHtmlButton.addEventListener("click", copyActiveHtml);
  els.commitButton.addEventListener("click", commitBatchToGitHub);
  els.toggleMetaButton.addEventListener("click", () => els.metadataPanel.classList.toggle("is-hidden"));
  els.toggleSectionsButton.addEventListener("click", toggleSections);

  [els.titleInput, els.typeInput, els.statusInput, els.tagsInput, els.summaryInput].forEach((input) => {
    input.addEventListener("input", updateActiveFromForm);
  });

  els.editor.addEventListener("input", () => {
    const doc = activeDocument();
    doc.content = els.editor.innerHTML;
    doc.updatedAt = new Date().toISOString();
    updateWordCount();
    markDirty("Editing…");
  });

  els.toolbar.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.command) runCommand(button.dataset.command);
    if (button.dataset.block) formatBlock(button.dataset.block);
  });

  els.tableButton.addEventListener("click", insertTable);
  els.imageButton.addEventListener("click", () => els.imageInput.click());
  els.imageInput.addEventListener("change", embedSelectedImage);
  els.emojiButton.addEventListener("click", () => insertHtml("✨"));

  document.addEventListener("keydown", (event) => {
    const isModifier = event.metaKey || event.ctrlKey;
    if (isModifier && event.key.toLowerCase() === "k") {
      event.preventDefault();
      els.searchInput.focus();
    }
    if (isModifier && event.key.toLowerCase() === "s") {
      event.preventDefault();
      persistNow("Saved locally");
    }
  });
}

function createDocument() {
  const id = `doc-${Date.now()}`;
  const doc = {
    id,
    title: "Untitled Lore Note",
    type: "lore-note",
    status: "draft",
    tags: ["new"],
    template: "Lore Note",
    updatedAt: new Date().toISOString(),
    summary: "",
    content: els.newDocTemplate.innerHTML.trim(),
  };
  state.documents.unshift(doc);
  return doc;
}

function openDocument(id) {
  if (state.activeId === id) return;
  state.activeId = id;
  renderAll();
  setStatus("Ready", "saved");
}

function activeDocument() {
  return state.documents.find((doc) => doc.id === state.activeId) ?? state.documents[0];
}

function renderAll() {
  renderDocumentList();
  renderActiveDocument();
  renderSearchResults();
}

function renderDocumentList() {
  els.documentList.innerHTML = state.documents.map((doc) => `
    <button class="doc-link ${doc.id === state.activeId ? "active" : ""}" data-id="${escapeAttr(doc.id)}" type="button">
      <strong>${escapeHtml(doc.title)}</strong>
      <span>${escapeHtml(doc.type)} · ${escapeHtml(doc.status)} · ${formatDate(doc.updatedAt)}</span>
    </button>
  `).join("");
}

function renderActiveDocument() {
  const doc = activeDocument();
  if (!doc) return;
  els.titleInput.value = doc.title;
  els.typeInput.value = doc.type ?? "";
  els.statusInput.value = doc.status ?? "";
  els.tagsInput.value = (doc.tags ?? []).join(", ");
  els.summaryInput.value = doc.summary ?? "";
  els.editor.innerHTML = doc.content ?? "";
  updateWordCount();
}

function renderSearchResults() {
  const query = els.searchInput.value.trim().toLowerCase();
  if (!query) {
    els.searchResults.innerHTML = "<p class=\"muted\">Type to search titles, tags, summaries, and body content.</p>";
    return;
  }

  const results = state.documents
    .map((doc) => ({ doc, score: scoreDocument(doc, query) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  els.searchResults.innerHTML = results.length ? results.map(({ doc }) => `
    <button class="result-card" data-id="${escapeAttr(doc.id)}" type="button">
      <strong>${highlight(doc.title, query)}</strong>
      <span>${escapeHtml(doc.summary || textFromHtml(doc.content).slice(0, 120) || "No preview yet")}</span>
    </button>
  `).join("") : "<p class=\"muted\">No matching lore found.</p>";
}

function scoreDocument(doc, query) {
  const haystacks = [
    [doc.title, 8],
    [(doc.tags ?? []).join(" "), 5],
    [doc.type, 3],
    [doc.status, 2],
    [doc.summary, 4],
    [textFromHtml(doc.content), 1],
  ];
  return haystacks.reduce((score, [value, weight]) => score + fuzzyScore(String(value ?? "").toLowerCase(), query) * weight, 0);
}

function fuzzyScore(text, query) {
  if (text.includes(query)) return 10 + query.length;
  let index = 0;
  for (const char of text) {
    if (char === query[index]) index += 1;
    if (index === query.length) return Math.max(1, query.length / Math.max(text.length, 1));
  }
  return 0;
}

function updateActiveFromForm() {
  const doc = activeDocument();
  doc.title = els.titleInput.value || "Untitled Lore Note";
  doc.type = els.typeInput.value;
  doc.status = els.statusInput.value;
  doc.tags = els.tagsInput.value.split(",").map((tag) => tag.trim()).filter(Boolean);
  doc.summary = els.summaryInput.value;
  doc.updatedAt = new Date().toISOString();
  renderDocumentList();
  renderSearchResults();
  markDirty("Metadata changed");
}

function markDirty(message) {
  state.dirty = true;
  setStatus(message, "dirty");
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => persistNow("Autosaved locally"), AUTOSAVE_DELAY);
}

function persistNow(message) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    documents: state.documents,
  }, null, 2));
  state.dirty = false;
  setStatus(message, "saved");
}

function setStatus(message, className) {
  els.saveStatus.textContent = message;
  els.saveStatus.className = `save-status ${className}`;
}

function updateWordCount() {
  const words = textFromHtml(els.editor.innerHTML).trim().split(/\s+/).filter(Boolean).length;
  els.wordCount.textContent = `${words} ${words === 1 ? "word" : "words"}`;
}

function runCommand(command) {
  els.editor.focus();
  document.execCommand(command, false, null);
  syncEditorAfterCommand();
}

function formatBlock(tag) {
  els.editor.focus();
  document.execCommand("formatBlock", false, tag);
  syncEditorAfterCommand();
}

function insertTable() {
  insertHtml(`<table><thead><tr><th>Field</th><th>Notes</th></tr></thead><tbody><tr><td>Canon</td><td>Details</td></tr><tr><td>References</td><td>[[Related Document]]</td></tr></tbody></table>`);
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
  syncEditorAfterCommand();
}

function syncEditorAfterCommand() {
  const doc = activeDocument();
  doc.content = els.editor.innerHTML;
  doc.updatedAt = new Date().toISOString();
  updateWordCount();
  markDirty("Formatting changed");
}

function toggleSections() {
  state.sectionsCollapsed = !state.sectionsCollapsed;
  els.toggleSectionsButton.textContent = state.sectionsCollapsed ? "Expand Sections" : "Collapse Sections";
  if (state.sectionsCollapsed) wrapSections();
  [...els.editor.querySelectorAll("section")].forEach((section) => section.classList.toggle("collapsed", state.sectionsCollapsed));
}

function wrapSections() {
  if (els.editor.querySelector("section")) return;
  const nodes = [...els.editor.childNodes];
  let currentSection = null;
  nodes.forEach((node) => {
    const isHeading = node.nodeType === Node.ELEMENT_NODE && /^H[1-3]$/.test(node.tagName);
    if (isHeading || !currentSection) {
      currentSection = document.createElement("section");
      els.editor.insertBefore(currentSection, node);
    }
    currentSection.appendChild(node);
  });
}

function exportDocuments() {
  persistNow("Export prepared");
  const blob = new Blob([serializedDocuments()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "documents.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function commitBatchToGitHub() {
  persistNow("Preparing GitHub commit");
  const owner = els.githubOwnerInput.value.trim();
  const repo = els.githubRepoInput.value.trim();
  const branch = els.githubBranchInput.value.trim() || "main";
  const path = els.githubPathInput.value.trim() || "content/documents.json";
  const token = els.githubTokenInput.value.trim();

  if (!owner || !repo || !token) {
    setStatus("GitHub owner, repo, and token are required", "dirty");
    return;
  }

  setStatus("Fetching GitHub file SHA…", "dirty");
  const apiBase = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const existing = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, { headers });
  const existingPayload = existing.ok ? await existing.json() : null;

  setStatus("Committing batch to GitHub…", "dirty");
  const commit = await fetch(apiBase, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Autosave lore documents ${new Date().toISOString()}`,
      content: btoa(unescape(encodeURIComponent(serializedDocuments()))),
      branch,
      sha: existingPayload?.sha,
    }),
  });

  if (!commit.ok) {
    const details = await commit.text();
    console.error(details);
    setStatus("GitHub commit failed", "dirty");
    return;
  }

  setStatus("Committed batch to GitHub", "saved");
}

function serializedDocuments() {
  return JSON.stringify({
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    documents: state.documents,
  }, null, 2);
}

async function copyActiveHtml() {
  await navigator.clipboard.writeText(activeDocument().content ?? "");
  setStatus("Copied HTML", "saved");
}

function textFromHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html ?? "";
  return div.textContent ?? "";
}

function highlight(value, query) {
  const safe = escapeHtml(value);
  const index = safe.toLowerCase().indexOf(escapeHtml(query).toLowerCase());
  if (index < 0) return safe;
  return `${safe.slice(0, index)}<mark>${safe.slice(index, index + query.length)}</mark>${safe.slice(index + query.length)}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function escapeAttr(value) { return escapeHtml(value).replace(/'/g, "&#39;"); }
function formatDate(value) { return value ? new Date(value).toLocaleDateString() : "Untracked"; }

boot().catch((error) => {
  console.error(error);
  setStatus("Unable to load documents", "dirty");
});
