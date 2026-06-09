(() => {
  "use strict";

  const MODULE_NAME = "Subnoto";
  const STORAGE_KEYS = {
    notes: "capsanoto_subnoto_notes_v1",
    darkMode: "capsanoto_subnoto_dark_mode_v1",
    layout: "capsanoto_subnoto_layout_v1"
  };

  const DEFAULT_LAYOUT = {
    width: 600,
    height: 350,
    left: null,
    top: 80
  };

  const pastelTextColors = [
    "#b03060", "#2e6f95", "#3a7d44", "#a67c00", "#6a4c93", "#a65e2e"
  ];

  let host = null;
  let shadow = null;
  let panel = null;
  let notes = [];
  let darkMode = false;
  let isVisible = false;
  let colorCycleIndex = 0;
  let dragState = null;

  function safeJsonParse(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn("Subnoto ignored unreadable stored data.", error);
      return fallback;
    }
  }

  function readStorage() {
    notes = safeJsonParse(localStorage.getItem(STORAGE_KEYS.notes), []);
    darkMode = localStorage.getItem(STORAGE_KEYS.darkMode) === "true";
  }

  function save() {
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));
    localStorage.setItem(STORAGE_KEYS.darkMode, String(darkMode));
    updateFooterStatus();
  }

  function saveLayout() {
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const layout = {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      left: Math.round(rect.left),
      top: Math.round(rect.top)
    };
    localStorage.setItem(STORAGE_KEYS.layout, JSON.stringify(layout));
  }

  function loadLayout() {
    return {
      ...DEFAULT_LAYOUT,
      ...safeJsonParse(localStorage.getItem(STORAGE_KEYS.layout), {})
    };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sanitizeFileName(value) {
    return String(value || "note")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 80) || "note";
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied.");
    } catch (error) {
      setStatus("Clipboard copy was blocked by the browser.");
      console.warn(error);
    }
  }

  async function readClipboardText() {
    try {
      return await navigator.clipboard.readText();
    } catch (error) {
      setStatus("Clipboard paste was blocked by the browser.");
      console.warn(error);
      return "";
    }
  }

  function setStatus(text) {
    const status = shadow?.getElementById("subnoto-status");
    if (status) status.textContent = text;
  }

  function updateFooterStatus() {
    const count = notes.length;
    const charCount = notes.reduce((sum, note) => sum + (note.text || "").length, 0);
    setStatus(`${count} note${count === 1 ? "" : "s"} · ${charCount} chars · saved locally`);
  }

  function init() {
    if (host) return;

    readStorage();

    host = document.createElement("div");
    host.id = "capsanoto-subnoto-host";
    host.style.cssText = "position: fixed; inset: 0; pointer-events: none; z-index: 2147483600;";
    document.documentElement.appendChild(host);

    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = template();
    panel = shadow.getElementById("subnoto-panel");

    applyLayout();
    bindEvents();
    applyTheme();
    render();
  }

  function template() {
    return `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
        button, input, textarea, label { font-family: Arial, Helvetica, sans-serif; }

        #subnoto-panel {
          --sub-bg: #fbf4d6;
          --sub-panel: #fff8de;
          --sub-text: #211812;
          --sub-muted: #724837;
          --sub-border: #a97b38;
          --sub-button: #e88f69;
          --sub-button-text: #211812;
          --sub-danger: #c55222;
          --sub-shadow: rgba(0, 0, 0, 0.35);
          position: fixed;
          display: none;
          flex-direction: column;
          min-width: 360px;
          min-height: 230px;
          width: 600px;
          height: 350px;
          background: var(--sub-bg);
          color: var(--sub-text);
          border: 1px solid var(--sub-border);
          border-radius: 14px;
          box-shadow: 0 18px 50px var(--sub-shadow);
          overflow: hidden;
          resize: both;
          pointer-events: auto;
        }

        #subnoto-panel.dark {
          --sub-bg: #211812;
          --sub-panel: #2f251c;
          --sub-text: #fbf4d6;
          --sub-muted: #e88f69;
          --sub-border: #724837;
          --sub-button: #563485;
          --sub-button-text: #fbf4d6;
          --sub-danger: #c55222;
          --sub-shadow: rgba(0, 0, 0, 0.75);
        }

        .toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          background: var(--sub-panel);
          border-bottom: 1px solid var(--sub-border);
          cursor: grab;
          user-select: none;
          flex-shrink: 0;
        }

        .toolbar:active { cursor: grabbing; }
        .title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-right: auto;
          font-size: 14px;
          font-weight: 700;
          color: var(--sub-text);
          white-space: nowrap;
        }

        .title img {
          width: 18px;
          height: 18px;
          object-fit: contain;
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        button {
          min-width: 26px;
          min-height: 24px;
          padding: 3px 7px;
          border-radius: 999px;
          border: 1px solid var(--sub-border);
          background: var(--sub-button);
          color: var(--sub-button-text);
          font-size: 12px;
          line-height: 1;
          cursor: pointer;
        }

        button:hover { filter: brightness(1.08); }
        button.danger { background: var(--sub-danger); color: #fbf4d6; }

        #notes {
          flex: 1;
          overflow: auto;
          padding: 8px;
          scrollbar-color: var(--sub-border) transparent;
        }

        #notes::-webkit-scrollbar, textarea::-webkit-scrollbar { width: 8px; height: 8px; }
        #notes::-webkit-scrollbar-track, textarea::-webkit-scrollbar-track { background: transparent; }
        #notes::-webkit-scrollbar-thumb, textarea::-webkit-scrollbar-thumb { background: var(--sub-border); border-radius: 999px; }

        .note {
          position: relative;
          background: var(--sub-panel);
          border: 1px solid color-mix(in srgb, var(--sub-border) 65%, transparent);
          border-radius: 10px;
          padding: 8px;
          margin-bottom: 8px;
        }

        .note-grid {
          display: grid;
          grid-template-columns: minmax(120px, 1fr) auto;
          grid-template-rows: auto auto;
          gap: 6px;
          align-items: center;
        }

        .title-input {
          width: 100%;
          min-width: 0;
          padding: 4px 6px;
          font-size: 12px;
          font-weight: 700;
          background: transparent;
          color: inherit;
          border: 1px solid transparent;
          border-radius: 6px;
        }

        .title-input:focus {
          outline: none;
          border-color: var(--sub-border);
          background: color-mix(in srgb, var(--sub-bg) 65%, transparent);
        }

        .find-wrap {
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .find-wrap input {
          width: 88px;
          padding: 4px 6px;
          border-radius: 999px;
          border: 1px solid var(--sub-border);
          background: var(--sub-bg);
          color: var(--sub-text);
          font-size: 11px;
        }

        .find-wrap input:focus { outline: 1px solid var(--sub-border); }

        .note-buttons {
          display: flex;
          gap: 3px;
          flex-wrap: wrap;
          grid-column: 1 / -1;
        }

        textarea {
          width: 100%;
          min-height: 105px;
          margin-top: 6px;
          padding: 7px;
          border-radius: 8px;
          font-size: 12px;
          line-height: 1.35;
          border: 1px solid var(--sub-border);
          resize: vertical;
          background: var(--sub-bg);
          color: var(--sub-text);
        }

        textarea:focus { outline: 1px solid var(--sub-border); }

        .counter-overlay {
          position: absolute;
          bottom: 10px;
          right: 12px;
          font-size: 10px;
          opacity: 0.65;
          pointer-events: none;
          color: var(--sub-muted);
        }

        #empty {
          display: none;
          text-align: center;
          padding: 22px;
          color: var(--sub-muted);
          font-size: 13px;
        }

        .footer {
          padding: 5px 10px;
          border-top: 1px solid var(--sub-border);
          background: var(--sub-panel);
          color: var(--sub-muted);
          font-size: 11px;
          flex-shrink: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        #export-modal {
          display: none;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: var(--sub-panel);
          color: var(--sub-text);
          border: 1px solid var(--sub-border);
          box-shadow: 0 14px 36px var(--sub-shadow);
          padding: 14px;
          border-radius: 10px;
          z-index: 5;
          min-width: 270px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
          font-weight: 700;
        }

        .export-options {
          display: grid;
          gap: 6px;
          margin: 10px 0 12px;
          font-size: 12px;
        }

        .export-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
      </style>

      <section id="subnoto-panel" role="dialog" aria-label="Subnoto notes panel">
        <div class="toolbar" id="drag-handle">
          <span class="title"><img src="${moduleAssetUrl("icon.png")}" alt=""> Subnoto</span>
          <div class="actions">
            <button id="exportBtn" title="Download notes">💾</button>
            <button id="add" title="Add note">➕</button>
            <button id="resetAll" class="danger" title="Delete all notes">♻️</button>
            <button id="toggleAll" title="Collapse/expand all notes">🪜</button>
            <button id="darkToggle" title="Toggle dark mode">🌙</button>
            <button id="closeBtn" title="Close Subnoto">✖</button>
          </div>
        </div>

        <div id="notes"></div>
        <div id="empty">No notes</div>
        <div class="footer" id="subnoto-status">Ready.</div>

        <div id="export-modal" role="dialog" aria-label="Download Subnoto notes">
          <div class="modal-header">
            <span>Download notes</span>
            <button id="exportClose" title="Close">✖</button>
          </div>
          <div class="export-options">
            <label><input type="radio" name="exportType" value="single" checked> One combined text file</label>
            <label><input type="radio" name="exportType" value="multiple"> Separate text files</label>
          </div>
          <div class="export-actions">
            <button id="exportConfirm">⬇️ Download</button>
          </div>
        </div>
      </section>
    `;
  }

  function moduleAssetUrl(filename) {
    const scripts = document.getElementsByTagName("script");
    for (let i = scripts.length - 1; i >= 0; i -= 1) {
      const src = scripts[i].src || "";
      if (src.endsWith("/subnoto.module.js") || src.includes("/modules/subnoto/")) {
        return new URL(filename, src).href;
      }
    }
    return `modules/subnoto/${filename}`;
  }

  function applyLayout() {
    const layout = loadLayout();
    const viewportWidth = Math.max(window.innerWidth, 360);
    const viewportHeight = Math.max(window.innerHeight, 260);
    const width = Math.min(Math.max(layout.width || DEFAULT_LAYOUT.width, 360), viewportWidth - 16);
    const height = Math.min(Math.max(layout.height || DEFAULT_LAYOUT.height, 230), viewportHeight - 16);
    const left = layout.left == null ? Math.max(8, viewportWidth - width - 20) : Math.min(Math.max(layout.left, 8), viewportWidth - width - 8);
    const top = Math.min(Math.max(layout.top || DEFAULT_LAYOUT.top, 8), viewportHeight - height - 8);

    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function bindEvents() {
    shadow.getElementById("add").addEventListener("click", addNote);
    shadow.getElementById("resetAll").addEventListener("click", resetAllNotes);
    shadow.getElementById("toggleAll").addEventListener("click", toggleAllNotes);
    shadow.getElementById("darkToggle").addEventListener("click", toggleDarkMode);
    shadow.getElementById("closeBtn").addEventListener("click", close);
    shadow.getElementById("exportBtn").addEventListener("click", openExportModal);
    shadow.getElementById("exportClose").addEventListener("click", closeExportModal);
    shadow.getElementById("exportConfirm").addEventListener("click", confirmExport);
    shadow.getElementById("drag-handle").addEventListener("pointerdown", startDrag);

    panel.addEventListener("mouseup", saveLayout);
    panel.addEventListener("keyup", event => {
      if (event.key === "Escape") closeExportModal();
    });

    document.addEventListener("click", event => {
      const trigger = event.target.closest?.('[data-capsanoto-tool="subnoto"]');
      if (trigger) {
        event.preventDefault();
        toggle();
      }
    });
  }

  function applyTheme() {
    if (!panel) return;
    panel.classList.toggle("dark", darkMode);
  }

  function createNoteElement(note) {
    const box = document.createElement("div");
    box.className = "note";
    box.dataset.noteId = note.id;

    const grid = document.createElement("div");
    grid.className = "note-grid";

    const title = document.createElement("input");
    title.value = note.label || "";
    title.className = "title-input";
    title.placeholder = "Note title";
    title.setAttribute("aria-label", "Note title");

    const findWrap = document.createElement("div");
    findWrap.className = "find-wrap";

    const findInput = document.createElement("input");
    findInput.placeholder = "Find...";
    findInput.setAttribute("aria-label", "Find in note");

    const searchBtn = makeButton("🔎", "Search note");
    const prev = makeButton("⬆️", "Previous match");
    const next = makeButton("⬇️", "Next match");
    findWrap.append(findInput, searchBtn, prev, next);

    const btns = document.createElement("div");
    btns.className = "note-buttons";

    const copy = makeButton("✍️", "Copy");
    const cut = makeButton("🤏", "Cut");
    const paste = makeButton("👇", "Paste");
    const select = makeButton("♾️", "Select all");
    const findBtn = makeButton("🔍", "Focus find");
    const download = makeButton("⬇️", "Download note");
    const reset = makeButton("♻️", "Reset note");
    const collapse = makeButton("🪜", "Collapse note");
    const del = makeButton("❌", "Delete note");
    const paint = makeButton("🎨", "Cycle text color. Double-click to reset.");

    del.classList.add("danger");
    btns.append(copy, cut, paste, select, findBtn, download, reset, collapse, del, paint);

    const area = document.createElement("textarea");
    area.value = note.text || "";
    area.style.color = note.textColor || "";
    if (note.collapsed) area.style.display = "none";

    const counter = document.createElement("div");
    counter.className = "counter-overlay";

    let matches = [];
    let index = 0;

    function updateCount() {
      counter.textContent = matches.length ? `${index + 1}/${matches.length}` : "";
    }

    function search() {
      matches = [];
      index = 0;
      const term = findInput.value.toLowerCase();
      if (!term) {
        updateCount();
        return;
      }
      let cursor = 0;
      const text = area.value.toLowerCase();
      while ((cursor = text.indexOf(term, cursor)) !== -1) {
        matches.push(cursor);
        cursor += term.length;
      }
      goTo();
    }

    function goTo() {
      if (!matches.length) {
        updateCount();
        return;
      }
      const pos = matches[index];
      area.focus();
      area.setSelectionRange(pos, pos + findInput.value.length);
      const lineHeight = parseInt(getComputedStyle(area).lineHeight, 10) || 16;
      const before = area.value.substring(0, pos);
      const line = before.split("\n").length;
      const visible = area.clientHeight / lineHeight;
      area.scrollTop = Math.max((line - visible / 2) * lineHeight, 0);
      updateCount();
    }

    searchBtn.addEventListener("click", search);
    findInput.addEventListener("keydown", event => {
      if (event.key === "Enter") search();
    });
    next.addEventListener("click", () => {
      if (matches.length) {
        index = (index + 1) % matches.length;
        goTo();
      }
    });
    prev.addEventListener("click", () => {
      if (matches.length) {
        index = (index - 1 + matches.length) % matches.length;
        goTo();
      }
    });
    findBtn.addEventListener("click", () => findInput.focus());

    title.addEventListener("input", () => {
      note.label = title.value;
      save();
    });
    area.addEventListener("input", () => {
      note.text = area.value;
      save();
    });

    copy.addEventListener("click", () => copyToClipboard(area.value));
    cut.addEventListener("click", async () => {
      await copyToClipboard(area.value);
      area.value = "";
      note.text = "";
      save();
    });
    paste.addEventListener("click", async () => {
      const text = await readClipboardText();
      if (!text) return;
      const start = area.selectionStart ?? area.value.length;
      const end = area.selectionEnd ?? area.value.length;
      area.value = `${area.value.slice(0, start)}${text}${area.value.slice(end)}`;
      note.text = area.value;
      save();
      area.focus();
      area.setSelectionRange(start + text.length, start + text.length);
    });
    select.addEventListener("click", () => {
      area.focus();
      area.select();
    });
    download.addEventListener("click", () => downloadText(`${sanitizeFileName(note.label)}.txt`, area.value));
    paint.addEventListener("click", () => {
      colorCycleIndex = (colorCycleIndex + 1) % pastelTextColors.length;
      note.textColor = pastelTextColors[colorCycleIndex];
      area.style.color = note.textColor;
      save();
    });
    paint.addEventListener("dblclick", () => {
      note.textColor = "";
      area.style.color = "";
      save();
    });
    reset.addEventListener("click", () => {
      note.text = "";
      note.label = "";
      title.value = "";
      area.value = "";
      save();
    });
    collapse.addEventListener("click", () => {
      note.collapsed = !note.collapsed;
      area.style.display = note.collapsed ? "none" : "block";
      save();
    });
    del.addEventListener("click", () => {
      notes = notes.filter(candidate => candidate.id !== note.id);
      render();
      save();
    });

    grid.append(title, findWrap, btns);
    box.append(grid, area, counter);
    return box;
  }

  function makeButton(text, title) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.title = title;
    return button;
  }

  function render() {
    if (!shadow) return;
    const notesDiv = shadow.getElementById("notes");
    const empty = shadow.getElementById("empty");
    notesDiv.innerHTML = "";

    if (!notes.length) {
      empty.style.display = "block";
      updateFooterStatus();
      return;
    }

    empty.style.display = "none";
    notes.forEach(note => notesDiv.appendChild(createNoteElement(note)));
    updateFooterStatus();
  }

  function addNote() {
    notes.unshift({
      id: Date.now(),
      label: "",
      text: "",
      collapsed: false,
      textColor: ""
    });
    render();
    save();
    const firstInput = shadow.querySelector(".title-input");
    firstInput?.focus();
  }

  function resetAllNotes() {
    if (notes.length && !window.confirm("Delete all Subnoto notes?")) return;
    notes = [];
    render();
    save();
  }

  function toggleAllNotes() {
    const collapseAll = !notes.every(note => note.collapsed);
    notes.forEach(note => {
      note.collapsed = collapseAll;
    });
    render();
    save();
  }

  function toggleDarkMode() {
    darkMode = !darkMode;
    applyTheme();
    save();
  }

  function openExportModal() {
    shadow.getElementById("export-modal").style.display = "block";
  }

  function closeExportModal() {
    shadow.getElementById("export-modal").style.display = "none";
  }

  function confirmExport() {
    const type = shadow.querySelector('input[name="exportType"]:checked')?.value || "single";
    if (type === "single") {
      const content = notes.map(note => `=== ${note.label || "note"} ===\n${note.text || ""}`).join("\n\n");
      downloadText("subnoto.txt", content);
    } else {
      notes.forEach(note => downloadText(`${sanitizeFileName(note.label)}.txt`, note.text || ""));
    }
    closeExportModal();
  }

  function startDrag(event) {
    if (event.target.closest("button")) return;
    const rect = panel.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    panel.setPointerCapture(event.pointerId);
    panel.addEventListener("pointermove", moveDrag);
    panel.addEventListener("pointerup", stopDrag, { once: true });
    panel.addEventListener("pointercancel", stopDrag, { once: true });
  }

  function moveDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const rect = panel.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - 8;
    const maxTop = window.innerHeight - rect.height - 8;
    const left = Math.min(Math.max(event.clientX - dragState.offsetX, 8), Math.max(8, maxLeft));
    const top = Math.min(Math.max(event.clientY - dragState.offsetY, 8), Math.max(8, maxTop));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function stopDrag(event) {
    if (dragState && event?.pointerId === dragState.pointerId) {
      try {
        panel.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Ignore pointer capture release issues.
      }
    }
    panel.removeEventListener("pointermove", moveDrag);
    dragState = null;
    saveLayout();
  }

  function open() {
    init();
    isVisible = true;
    panel.style.display = "flex";
    panel.focus?.();
    updateFooterStatus();
  }

  function close() {
    if (!panel) return;
    isVisible = false;
    closeExportModal();
    panel.style.display = "none";
    saveLayout();
  }

  function toggle() {
    init();
    if (isVisible) close();
    else open();
  }

  function refresh() {
    readStorage();
    render();
    applyTheme();
  }

  function getNotes() {
    return notes.map(note => ({ ...note }));
  }

  function setNotes(nextNotes) {
    notes = Array.isArray(nextNotes) ? nextNotes.map(note => ({ ...note })) : [];
    render();
    save();
  }

  window.CapsanotoSubnoto = {
    init,
    open,
    close,
    toggle,
    refresh,
    getNotes,
    setNotes,
    version: "1.0.0-capsanoto"
  };

  document.addEventListener("capsanoto:open-subnoto", open);
  document.addEventListener("capsanoto:toggle-subnoto", toggle);

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('[data-capsanoto-tool="subnoto"]').forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        toggle();
      });
    });
  });
})();
