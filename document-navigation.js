/* Document outlines and a workspace that makes room for the filing cabinet. */
const outlineCache = new WeakMap();
const cabinetViewState = new Map();
const outlineSearches = new Map();
let workspaceLayoutSnapshot = null;
let workspaceLayoutFrame = null;

function outlineCandidates(root) {
  return [...root.querySelectorAll('h1,h2,h3,h4,h5,h6,[data-bookmark="true"],p,div')].filter((node) => {
    if (node.closest('.transclusion-ref') || node.querySelector('h1,h2,h3,h4,h5,h6,p,div')) return false;
    if (/^H[1-6]$/.test(node.tagName) || node.dataset.bookmark === 'true') return Boolean(node.textContent.trim());
    const text = node.textContent.trim();
    return text.length <= 240 && /^(?:scene\s+\d+[a-z]?\b|act\s+(?:[ivx]+|\d+)\b|(?:int\.?\s*\/\s*ext|int|ext|i\/e)\.)/i.test(text);
  });
}

function documentOutline(doc) {
  if (!documentIsLoaded(doc)) return [];
  const cached = outlineCache.get(doc);
  if (cached?.content === doc.content) return cached.items;
  const root = new DOMParser().parseFromString(doc.content || '', 'text/html').body;
  const items = outlineCandidates(root).map((node, index) => ({
    index, id: node.id, label: node.textContent.trim(), level: /^H[1-6]$/.test(node.tagName) ? Number(node.tagName.slice(1)) : 3,
    kind: /^H[1-6]$/.test(node.tagName) ? 'Heading' : 'Scene / bookmark',
  }));
  outlineCache.set(doc, { content: doc.content, items });
  return items;
}

function renderDocumentOutlineSection(doc) {
  return `<details class="document-disclosure document-outline" data-outline-doc="${escapeAttr(doc.id)}"><summary>Headings &amp; scenes</summary><div class="document-disclosure-body"><label class="outline-search-label">Find heading, scene, or document tag<input type="search" data-outline-search="${escapeAttr(doc.id)}" placeholder="Search headings…"></label><p class="outline-count" role="status"></p><div class="outline-results"></div></div></details>`;
}

function fillDocumentOutline(section, query = outlineSearches.get(section.dataset.outlineDoc) || '') {
  const doc = state.documents.find((item) => item.id === section.dataset.outlineDoc);
  if (!doc) return;
  if (!documentIsLoaded(doc)) {
    section.querySelector('.outline-count').textContent = 'This document has not been loaded.';
    section.querySelector('.outline-results').innerHTML = `<button type="button" data-load-outline="${escapeAttr(doc.id)}">Load headings for this document</button>`;
    return;
  }
  const search = section.querySelector('input');
  if (search.value !== query) search.value = query;
  outlineSearches.set(doc.id, query);
  const normalized = query.trim().toLowerCase();
  const tagMatch = normalized && (doc.tags || []).some((tag) => String(tag).toLowerCase().includes(normalized));
  const outline = documentOutline(doc);
  const matches = outline.filter((item) => !normalized || tagMatch || item.label.toLowerCase().includes(normalized));
  section.querySelector('.outline-count').textContent = outline.length ? `${matches.length} of ${outline.length} headings / scenes` : 'No headings or scene labels found in this document.';
  section.querySelector('.outline-results').innerHTML = matches.map((item) => `<button type="button" data-outline-jump="${item.index}" data-outline-document="${escapeAttr(doc.id)}" style="--outline-level:${Math.min(item.level, 4)}" title="${escapeAttr(item.label)}">${escapeHtml(item.label)}</button>`).join('');
}

function cabinetDisclosureKey(element) {
  if (element.dataset.docCard) return `doc:${element.dataset.docCard}`;
  if (element.classList.contains('document-disclosure')) return `${element.closest('[data-doc-card]')?.dataset.docCard}:${element.dataset.disclosure || 'outline'}`;
  if (element.classList.contains('writing-room-group')) return `group:${element.dataset.groupId}`;
  if (element.classList.contains('filing-tab')) return `tab:${element.dataset.tabId}`;
  return '';
}

function captureCabinetView() {
  els.writingRoomCards.querySelectorAll('details').forEach((element) => {
    const key = cabinetDisclosureKey(element);
    if (key) cabinetViewState.set(key, element.open);
  });
  return els.writingRoomCards.scrollTop;
}

function restoreCabinetView(scrollTop) {
  els.writingRoomCards.querySelectorAll('details').forEach((element) => {
    const key = cabinetDisclosureKey(element);
    if (cabinetViewState.has(key)) element.open = cabinetViewState.get(key);
    if (element.matches('.document-outline[open]')) fillDocumentOutline(element);
  });
  els.writingRoomCards.scrollTop = scrollTop;
}

async function jumpToDocumentOutline(documentId, index) {
  const doc = state.documents.find((item) => item.id === documentId);
  if (!doc) return;
  if (state.activeId !== documentId && !await openDocument(documentId)) return;
  const target = outlineCandidates(els.editor)[Number(index)];
  if (!target) { setStatus('The document changed. Reopen Headings to refresh the list.', 'dirty'); return; }
  const editorRect = els.editor.getBoundingClientRect();
  const top = Math.max(0, els.editor.scrollTop + target.getBoundingClientRect().top - editorRect.top - 18);
  if (els.editor.scrollTo) els.editor.scrollTo({ top, behavior: 'smooth' });
  else target.scrollIntoView({ block: 'start', behavior: 'smooth' });
  els.editor.focus({ preventScroll: true });
  const range = document.createRange(); range.selectNodeContents(target); range.collapse(true);
  const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  target.animate?.([{ backgroundColor: 'rgba(182,115,0,.45)' }, { backgroundColor: 'transparent' }], { duration: 1500 });
  if (target.id) updateUrl(target.id);
  setStatus(`Jumped to ${target.textContent.trim().slice(0, 80)}`, 'saved');
}

function calculateRoomLayout(viewportWidth, roomRect, preferredWidth) {
  const gap = 18;
  const right = Math.max(0, viewportWidth - roomRect.right - gap * 2);
  const left = Math.max(0, roomRect.left - gap * 2);
  if (viewportWidth < 880 || Math.max(left, right) < 520) return { mode: 'stacked' };
  const available = Math.max(left, right);
  const width = Math.min(preferredWidth, available);
  const start = right >= left ? roomRect.right + gap : gap + Math.max(0, (left - width) / 2);
  return { mode: 'beside', left: Math.round(start), width: Math.round(width) };
}

function restoreWorkspaceLayout() {
  if (!workspaceLayoutSnapshot) return;
  for (const [node, properties] of workspaceLayoutSnapshot.nodes) {
    for (const [property, value, priority] of properties) value ? node.style.setProperty(property, value, priority) : node.style.removeProperty(property);
  }
  document.documentElement.style.setProperty('--writing-shell-width', workspaceLayoutSnapshot.rootWidth);
  workspaceLayoutSnapshot = null;
  document.body.classList.remove('room-beside', 'room-stacked');
  updateWritingSurfaceMetrics();
}

function updateRoomWorkspaceLayout() {
  workspaceLayoutFrame = null;
  const room = els.writingRoomPanel;
  if (!room || room.hidden || state.writingRoomPreviewExpanded) { restoreWorkspaceLayout(); return; }
  const shell = els.writingSurfaceShell;
  if (!workspaceLayoutSnapshot) {
    const properties = ['width', 'max-width', 'min-width', 'margin-left', 'margin-right', 'left', 'position', 'transform'];
    workspaceLayoutSnapshot = {
      preferredWidth: shell.getBoundingClientRect().width || 1000,
      roomWidth: room.getBoundingClientRect().width || 300,
      rootWidth: document.documentElement.style.getPropertyValue('--writing-shell-width'),
      nodes: [shell, els.documentEndBar].filter(Boolean).map((node) => [node, properties.map((key) => [key, node.style.getPropertyValue(key), node.style.getPropertyPriority(key)])]),
    };
  }
  const roomRect = document.body.classList.contains('room-stacked') ? { left: 16, right: 16 + workspaceLayoutSnapshot.roomWidth } : room.getBoundingClientRect();
  const layout = calculateRoomLayout(window.innerWidth, roomRect, workspaceLayoutSnapshot.preferredWidth);
  document.body.classList.toggle('room-beside', layout.mode === 'beside');
  document.body.classList.toggle('room-stacked', layout.mode === 'stacked');
  const width = layout.mode === 'beside' ? layout.width : Math.max(280, window.innerWidth - 32);
  const left = layout.mode === 'beside' ? layout.left : 16;
  for (const node of [shell, els.documentEndBar].filter(Boolean)) {
    node.style.setProperty('width', `${width}px`, 'important');
    node.style.setProperty('max-width', `${width}px`, 'important');
    node.style.setProperty('min-width', '0', 'important');
    node.style.setProperty('margin-left', `${left}px`, 'important');
    node.style.setProperty('margin-right', '0', 'important');
    node.style.setProperty('position', 'relative', 'important');
    node.style.setProperty('left', 'auto', 'important');
    node.style.setProperty('transform', 'none', 'important');
  }
  updateWritingSurfaceMetrics();
}

function scheduleRoomWorkspaceLayout() {
  if (!workspaceLayoutFrame) workspaceLayoutFrame = requestAnimationFrame(updateRoomWorkspaceLayout);
}

function initializeDocumentNavigation() {
  if (els.writingRoomCards.dataset.navigationBound) return;
  els.writingRoomCards.dataset.navigationBound = 'true';
  els.writingRoomCards.addEventListener('toggle', (event) => { if (event.target.matches?.('.document-outline[open]')) fillDocumentOutline(event.target); }, true);
  els.writingRoomCards.addEventListener('input', (event) => { if (event.target.matches('[data-outline-search]')) fillDocumentOutline(event.target.closest('.document-outline'), event.target.value); });
  els.writingRoomCards.addEventListener('click', async (event) => {
    const load = event.target.closest('[data-load-outline]');
    if (load) {
      try { await ensureDocumentContent(state.documents.find((doc) => doc.id === load.dataset.loadOutline)); fillDocumentOutline(load.closest('.document-outline')); }
      catch (error) { setStatus(error.message, 'dirty'); load.closest('.document-outline').querySelector('.outline-count').textContent = error.message; }
      return;
    }
    const button = event.target.closest('[data-outline-jump]');
    if (button) { event.preventDefault(); jumpToDocumentOutline(button.dataset.outlineDocument, button.dataset.outlineJump); }
  });
  new MutationObserver(scheduleRoomWorkspaceLayout).observe(els.writingRoomPanel, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
  if (window.ResizeObserver) new ResizeObserver(scheduleRoomWorkspaceLayout).observe(els.writingRoomPanel);
  window.addEventListener('resize', scheduleRoomWorkspaceLayout);
  let outlineTimer;
  els.editor.addEventListener('input', () => {
    clearTimeout(outlineTimer);
    outlineTimer = setTimeout(() => { els.writingRoomCards.querySelectorAll('.document-outline[open]').forEach((section) => fillDocumentOutline(section)); }, 200);
  });
  scheduleRoomWorkspaceLayout();
}
