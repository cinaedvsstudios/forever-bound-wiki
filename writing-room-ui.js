/* Writing Room controls, accessible action menus and document jump rail. */
let cabinetMenuTrigger = null;
let cabinetRailEntries = [];
let cabinetRailBuckets = [];

function cabinetAppearanceDefaults() {
  return { folderRowBg: '#241a12', folderRowBorder: '#cfaa62', tabRowBg: '#2a1829', tabRowBorder: '#bc78d3', docRowBg: '#1d2926', docRowBorder: '#80c5b8', metadataPillBg: 'transparent', metadataPillBorder: '#62503f', trashBg: '#301818', trashBorder: '#d87878' };
}

function closeCabinetMenus({ restoreFocus = false } = {}) {
  document.querySelectorAll('#writingRoomPanel .cabinet-popup').forEach(menu => { menu.hidden = true; });
  if (cabinetMenuTrigger) {
    cabinetMenuTrigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus && cabinetMenuTrigger.isConnected) cabinetMenuTrigger.focus({ preventScroll: true });
  }
  cabinetMenuTrigger = null;
}

function openCabinetMenu(menu, trigger) {
  const wasOpen = !menu.hidden && cabinetMenuTrigger === trigger;
  closeCabinetMenus();
  if (wasOpen) return;
  const panel = els.writingRoomPanel;
  const bounds = panel.getBoundingClientRect();
  const anchor = trigger.getBoundingClientRect();
  const height = bounds.height || 400;
  const top = Math.max(8, Math.min(anchor.bottom - bounds.top + 6, height - 110));
  menu.style.top = `${top}px`;
  menu.style.maxHeight = `${Math.max(80, height - top - 16)}px`;
  menu.hidden = false;
  cabinetMenuTrigger = trigger;
  trigger.setAttribute('aria-expanded', 'true');
  menu.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
}

function prepareCabinetTitle(event) {
  const row = event.target.closest?.('.cabinet-row');
  const viewport = row?.querySelector('.cabinet-title');
  const text = viewport?.firstElementChild;
  if (!text || !viewport.clientWidth) return;
  const distance = Math.max(0, text.scrollWidth - viewport.clientWidth);
  const overflow = distance > 2;
  if (row.classList.contains('title-overflows') !== overflow) row.classList.toggle('title-overflows', overflow);
  const travel = `${-distance}px`;
  if (row.style.getPropertyValue('--title-travel') !== travel) row.style.setProperty('--title-travel', travel);
}

function jumpToCabinetEntry(entry) {
  const cards = els.writingRoomCards;
  const elements = [...cards.querySelectorAll('[data-group-id], [data-doc-card], .filing-archive')];
  const target = elements.find(node => entry.kind === 'doc' ? node.dataset.docCard === entry.id : entry.kind === 'group' ? node.matches('.writing-room-group') && node.dataset.groupId === entry.id : node.matches('.filing-archive'));
  if (!target) return;
  for (let ancestor = target; ancestor && ancestor !== cards; ancestor = ancestor.parentElement) {
    if (ancestor.tagName === 'DETAILS') ancestor.open = true;
  }
  const top = Math.max(0, cards.scrollTop + target.getBoundingClientRect().top - cards.getBoundingClientRect().top - 8);
  if (cards.scrollTo) cards.scrollTo({ top, behavior: 'smooth' });
  else cards.scrollTop = top;
  target.querySelector('summary')?.focus({ preventScroll: true });
  setContextStatus(`Jumped to ${entry.label}`, false);
}

function renderCabinetJumpRail(groups) {
  const old = els.writingRoomPanel.querySelector(':scope > .filing-jump-rail');
  old?.remove();
  cabinetRailEntries = [];
  const visited = new Set();
  let fileNumber = 0;
  const appendDocument = doc => {
    if (visited.has(doc.id)) return;
    visited.add(doc.id);
    cabinetRailEntries.push({ kind: 'doc', id: doc.id, label: doc.title, icon: docIcon(doc), fileNumber: ++fileNumber });
    childDocuments(doc.id).forEach(appendDocument);
  };
  for (const group of groups) {
    cabinetRailEntries.push({ kind: 'group', id: group.id, label: group.label, icon: groupIcon(group) });
    group.tabs.forEach(tab => tab.documents.forEach(appendDocument));
  }
  cabinetRailEntries.push({ kind: 'trash', id: 'trash', label: 'Trash', icon: '🗑️' });
  const rail = document.createElement('nav');
  rail.className = 'filing-jump-rail';
  rail.setAttribute('aria-label', `${fileNumber} files · jump to folders and documents`);
  rail.innerHTML = `<span class="cabinet-file-count" title="${fileNumber} files in this project">${fileNumber}</span><div class="cabinet-rail-track"></div>`;
  els.writingRoomPanel.append(rail);
  refreshCabinetRailMarkers();
}

function refreshCabinetRailMarkers() {
  const track = els.writingRoomPanel.querySelector('.cabinet-rail-track');
  if (!track) return;
  const height = track.clientHeight || Math.max(100, (els.writingRoomPanel.getBoundingClientRect().height || 600) - 155);
  const slots = Math.max(2, Math.floor(height / 28));
  const size = Math.max(1, Math.ceil(cabinetRailEntries.length / slots));
  const layoutKey = `${size}:${cabinetRailEntries.length}:${state.activeId}`;
  if (track.dataset.layoutKey === layoutKey) return;
  track.dataset.layoutKey = layoutKey;
  cabinetRailBuckets = [];
  for (let i = 0; i < cabinetRailEntries.length; i += size) cabinetRailBuckets.push(cabinetRailEntries.slice(i, i + size));
  const total = cabinetRailEntries.filter(entry => entry.kind === 'doc').length;
  track.innerHTML = cabinetRailBuckets.map((bucket, index) => {
    const entry = bucket[0];
    const label = bucket.length === 1 ? entry.kind === 'doc' ? `File ${entry.fileNumber} of ${total}: ${entry.label}` : `${entry.kind === 'group' ? 'Folder' : 'Jump to'}: ${entry.label}` : `${bucket.length} destinations: ${bucket.slice(0, 3).map(item => item.label).join(' · ')}${bucket.length > 3 ? '…' : ''}`;
    const current = bucket.some(item => item.kind === 'doc' && item.id === state.activeId);
    const position = cabinetRailBuckets.length === 1 ? 50 : index / (cabinetRailBuckets.length - 1) * 100;
    return `<button type="button" data-cabinet-rail="${index}" class="cabinet-rail-${bucket.length === 1 ? entry.kind : 'cluster'}" style="top:${position}%" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}" ${current ? 'aria-current="true"' : ''}><span aria-hidden="true">${bucket.length === 1 ? entry.icon : bucket.length}</span></button>`;
  }).join('');
}

function showCabinetDocumentMenu(trigger) {
  const id = trigger.dataset.documentMenu;
  const doc = state.documents.find(item => item.id === id);
  if (!doc) return;
  const menu = document.getElementById('cabinetDocumentMenu');
  const actions = [['sub-document', '↳ Create sub-file'], ['bulk-style', '🎨 Appearance'], ['duplicate', '📑 Duplicate'], ['deprecate', '🕰️ Save old version'], ['copy', '🔗 Copy link'], ['storyboard', '🎬 Send to Storyboarder'], ['delete', '🗑️ Move to Trash']];
  menu.innerHTML = actions.map(([action, label]) => `<button type="button" data-card-action="${action}" data-doc-id="${escapeAttr(id)}">${label}</button>`).join('');
  menu.setAttribute('aria-label', `Actions for ${doc.title}`);
  openCabinetMenu(menu, trigger);
}

function showCabinetHistory() {
  jumpToCabinetEntry({ kind: 'doc', id: state.activeId, label: activeDocument().title });
  const card = [...els.writingRoomCards.querySelectorAll('[data-doc-card]')].find(node => node.dataset.docCard === state.activeId);
  const history = card?.querySelector('.deprecated-version-list');
  if (history) { history.open = true; history.scrollIntoView({ block: 'nearest' }); }
  else setStatus('No saved old versions of this file. Use Save old version in its actions menu to keep one.', 'saved');
}

function initializeCabinetControls() {
  const panel = els.writingRoomPanel;
  if (panel.dataset.controlsBound) return;
  panel.dataset.controlsBound = 'true';
  panel.addEventListener('pointerover', prepareCabinetTitle);
  panel.addEventListener('focusin', prepareCabinetTitle);
  panel.addEventListener('click', event => {
    const row = event.target.closest('.cabinet-row');
    if (row && !event.target.closest('button') && row.querySelector('.lock-button[aria-pressed="true"]') && row.parentElement.open) event.preventDefault();
    const trigger = event.target.closest('[data-cabinet-menu]');
    if (trigger) return openCabinetMenu(document.getElementById(trigger.dataset.cabinetMenu), trigger);
    const documentTrigger = event.target.closest('[data-document-menu]');
    if (documentTrigger) return showCabinetDocumentMenu(documentTrigger);
    const marker = event.target.closest('[data-cabinet-rail]');
    if (marker) {
      const bucket = cabinetRailBuckets[Number(marker.dataset.cabinetRail)];
      if (!bucket) return;
      if (bucket.length === 1) { closeCabinetMenus(); return jumpToCabinetEntry(bucket[0]); }
      const menu = document.getElementById('cabinetJumpMenu');
      menu.innerHTML = bucket.map((entry, index) => `<button type="button" data-cabinet-destination="${index}">${entry.icon} ${escapeHtml(entry.label)}</button>`).join('');
      menu.onclick = click => {
        const button = click.target.closest('[data-cabinet-destination]');
        if (button) { closeCabinetMenus(); jumpToCabinetEntry(bucket[Number(button.dataset.cabinetDestination)]); }
      };
      return openCabinetMenu(menu, marker);
    }
    const action = event.target.closest('.cabinet-popup button');
    if (!action) return;
    closeCabinetMenus();
    if (action.matches('[data-card-action]')) void runProjectFileAction(() => handleWritingRoomCardClick(event));
    if (action.dataset.cabinetAction === 'backup') void runProjectFileAction(downloadCapsanotoProjectBackup);
    if (action.dataset.cabinetAction === 'history') showCabinetHistory();
    if (action.dataset.filingAction) void runProjectFileAction(() => handleWritingRoomCardClick(event));
  });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape' && cabinetMenuTrigger) { event.preventDefault(); event.stopPropagation(); closeCabinetMenus({ restoreFocus: true }); return; }
    const menu = event.target.closest('.cabinet-popup');
    if (!menu || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...menu.querySelectorAll('button:not([disabled])')];
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('#writingRoomPanel .cabinet-popup, #writingRoomPanel [data-cabinet-menu], #writingRoomPanel [data-document-menu], #writingRoomPanel [data-cabinet-rail]')) closeCabinetMenus();
  });
}
