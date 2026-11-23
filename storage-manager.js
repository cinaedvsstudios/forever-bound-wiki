/* Capsanoto Storage & Cleanup v1.0 — optional, non-invasive settings module.
   Only audited Capsanoto storage identifiers are owned. Unknown data is never cleaned.
   This module does not sync to a server or clear entire browser storage. */
(function () {
  "use strict";
  const APP = "capsanoto";
  const VERSION = 1;
  const LAST_CLEAN = "capsanoto-storage-manager-last-clean-v1";
  const AUTO_CLEAN = "capsanoto-storage-manager-auto-v1";
  const CATEGORIES = [
    "Settings & Preferences", "Projects & Saved Work", "Drafts & Unsaved Changes",
    "User Data", "Server-Synced Copies", "Temporary Data", "Cache & Previews",
    "History & Logs", "Unknown / Unclassified"
  ];
  // Audited from app.core.js, project-setup.js, dropbox-storage.js and Specnoto.
  // [category, description, sensitive, editable, regenerable].
  const KNOWN_LOCAL = {
    "forever-bound-writing-room-v2": ["Projects & Saved Work", "Legacy workspace recovery data", false, false, false],
    "forever-bound-authenticated": ["Settings & Preferences", "Legacy authentication flag", true, false, false],
    "capsanoto-design-settings-v5-10-5-module-integration": ["Settings & Preferences", "Element Designer preferences", false, false, false],
    "capsanoto-help-html-v1": ["User Data", "Edited Guidebook content", false, false, false],
    "capsanoto-writing-room-layout-v5-8-6": ["Settings & Preferences", "Filing Cabinet layout", false, false, false],
    "capsanoto-floating-panel-layouts-v5-9-0": ["Settings & Preferences", "Floating window positions", false, false, false],
    "capsanoto-writing-surface-layout-v5-9-0": ["Settings & Preferences", "Writing surface layout", false, false, false],
    "capsanoto-favorite-emojis-v1": ["Settings & Preferences", "Favourite emojis", false, true, false],
    "capsanoto-custom-emojis-v1": ["User Data", "Custom emoji entries", false, false, false],
    "capsanoto-folder-mode-prefs-v1": ["Settings & Preferences", "Local backup folder preferences", false, false, false],
    "capsanoto-google-drive-storage-v1": ["Settings & Preferences", "Legacy Google Drive configuration", true, false, false],
    "capsanoto-google-drive-token-v1": ["Settings & Preferences", "Legacy Google Drive session credentials", true, false, false],
    "capsanoto-dropbox-app-key": ["Settings & Preferences", "Public Dropbox app identifier", false, false, false],
    "capsanoto_specnoto_settings": ["Settings & Preferences", "Specnoto preferences", false, false, false],
    "capsanoto_specnoto_open_state": ["Settings & Preferences", "Specnoto open state", false, false, false],
    "capsanoto_specnoto_pos_x": ["Settings & Preferences", "Specnoto horizontal position", false, false, false],
    "capsanoto_specnoto_pos_y": ["Settings & Preferences", "Specnoto vertical position", false, false, false],
    "capsanoto-storage-manager-last-clean-v1": ["History & Logs", "Last successful cleanup", false, false, false],
    "capsanoto-storage-manager-auto-v1": ["Settings & Preferences", "Automatic verified-copy cleanup preference", false, false, false]
  };
  const KNOWN_DBS = {
    "capsanoto-workspaces-v1": ["records"],
    "capsanoto-folder-mode-db-v1": ["handles"],
    "capsanoto-storyboarder-v1": ["records", "assets"]
  };
  const state = { entries: [], capabilities: [], errors: [], originBytes: null, selected: new Set(), backupSelected: new Set(CATEGORIES.filter((name) => name !== "Unknown / Unclassified")), confirmed: null, verified: new Set(), busy: false };
  const enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
  const $ = (selector) => document.querySelector(selector);
  const escaped = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const bytes = (value) => enc ? enc.encode(String(value)).length : String(value).length * 2;
  const formatBytes = (value) => value == null ? "Not available" : value < 1024 ? value + " B" : value < 1048576 ? (value / 1024).toFixed(1) + " KB" : (value / 1048576).toFixed(2) + " MB";
  const approxSize = (value) => {
    if (typeof Blob !== "undefined" && value instanceof Blob) return value.size;
    if (value instanceof ArrayBuffer) return value.byteLength;
    try { return bytes(typeof value === "string" ? value : JSON.stringify(value)); } catch { return null; }
  };
  function jsonPortable(value, seen = new WeakSet()) {
    if (value == null || ["string","number","boolean"].includes(typeof value)) return true;
    if (typeof value !== "object" || value instanceof Date || value instanceof ArrayBuffer ||
        (typeof Blob !== "undefined" && value instanceof Blob) || ArrayBuffer.isView(value)) return false;
    if (seen.has(value)) return false;
    seen.add(value);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) return false;
    return Object.values(value).every((part) => jsonPortable(part, seen));
  }
  async function settleWorkspaceSave() {
    if (typeof persistNow === "function") await persistNow("Preparing browser storage");
    if (typeof workspaceWriteQueue !== "undefined") await workspaceWriteQueue;
    if (busyWriter()) throw Error("Writing Room save/sync is active or unsuccessful. Do not change storage yet.");
  }
  function categoryForDb(database, store, key) {
    const k = String(key);
    if (database === "capsanoto-folder-mode-db-v1") return ["Settings & Preferences", "Local backup directory handle", false, true];
    if (database === "capsanoto-storyboarder-v1") return ["Projects & Saved Work", "Storyboarder document or media", false, true];
    if (database !== "capsanoto-workspaces-v1") return null;
    if (k === "active" || k.startsWith("project:")) return ["Projects & Saved Work", "Writing Room project", false, true];
    if (k === "previous-project" || k.startsWith("legacy-project:")) return ["Drafts & Unsaved Changes", "Project recovery snapshot", false, true];
    if (k.startsWith("document-body:")) return ["Drafts & Unsaved Changes", "Cached document body (may be needed offline)", false, true];
    if (k === "dropbox-connection") return ["Settings & Preferences", "Dropbox connection credentials", true, true];
    if (k.startsWith("dropbox-") || k.startsWith("dropbox:")) return ["Settings & Preferences", "Dropbox sync metadata", false, true];
    if (k.startsWith("storyboarder-handoff:")) return ["Drafts & Unsaved Changes", "Storyboard transfer payload", false, true];
    return null;
  }
  function makeEntry(technology, key, value, extra) {
    const descriptor = extra && extra.descriptor;
    const own = Boolean(descriptor);
    const id = [technology, extra?.database || "", extra?.store || "", String(key)].join("|");
    const size = approxSize(value);
    return {
      id, technology, key: String(key), database: extra?.database || "", store: extra?.store || "",
      category: own ? descriptor[0] : "Unknown / Unclassified",
      description: own ? descriptor[1] : "Not proven to belong to Capsanoto",
      sensitive: own && Boolean(descriptor[2]), owned: own, editable: technology === "localStorage" || technology === "sessionStorage" ? own && Boolean(descriptor[3]) : false,
      protected: true, safe: false, verified: false, size,
      modified: value && typeof value === "object" ? value.savedAt || value.updatedAt || null : null
    };
  }
  function register(entry) { state.entries.push(entry); }
  function safeGet(storage, key) { try { return storage?.getItem(key) ?? null; } catch { return null; } }
  function localStore() { try { return window.localStorage; } catch { return null; } }
  function sessionStore() { try { return window.sessionStorage; } catch { return null; } }
  function scanKeyValue(storage, kind) {
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        const value = safeGet(storage, key);
        register(makeEntry(kind, key, value || "", { descriptor: Object.prototype.hasOwnProperty.call(KNOWN_LOCAL, key) ? KNOWN_LOCAL[key] : null }));
      }
      state.capabilities.push(kind + ": supported");
    } catch (error) { state.capabilities.push(kind + ": unavailable"); state.errors.push(kind + ": " + error.message); }
  }
  async function openKnownDatabase(name) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || Error("Cannot open database"));
      request.onblocked = () => reject(Error("Database is busy in another tab"));
    });
  }
  async function enumerateStore(db, name, store) {
    return new Promise((resolve, reject) => {
      let count = 0; let truncated = false;
      const tx = db.transaction(store, "readonly");
      const request = tx.objectStore(store).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (count++ >= 600) { truncated = true; return; }
        const descriptor = categoryForDb(name, store, cursor.key);
        const entry = makeEntry("IndexedDB", cursor.key, cursor.value, { database: name, store, descriptor });
        register(entry);
        cursor.continue();
      };
      tx.oncomplete = () => { if (truncated) state.errors.push(name + "/" + store + ": showing first 600 entries; additional records remain protected."); resolve(); };
      tx.onerror = () => reject(tx.error || Error("Storage read failed"));
      tx.onabort = () => reject(tx.error || Error("Storage read cancelled"));
    });
  }
  async function scanIndexedDb() {
    if (!window.indexedDB) { state.capabilities.push("IndexedDB: unavailable"); return; }
    if (typeof indexedDB.databases !== "function") {
      state.capabilities.push("IndexedDB: database listing restricted in this browser");
      state.errors.push("IndexedDB was not scanned because opening an unknown database might create it.");
      return;
    }
    try {
      const databases = await indexedDB.databases();
      const names = new Set(databases.map((db) => db.name));
      for (const name of Object.keys(KNOWN_DBS)) {
        if (!names.has(name)) continue;
        let db;
        try {
          db = await openKnownDatabase(name);
          for (const store of KNOWN_DBS[name]) if (db.objectStoreNames.contains(store)) await enumerateStore(db, name, store);
        } catch (error) { state.errors.push("IndexedDB " + name + ": " + error.message); }
        finally { if (db) db.close(); }
      }
      state.capabilities.push("IndexedDB: supported (audited databases only)");
    } catch (error) { state.capabilities.push("IndexedDB: restricted"); state.errors.push("IndexedDB: " + error.message); }
  }
  async function scanCaches() {
    if (!window.caches || typeof caches.keys !== "function") { state.capabilities.push("Cache Storage: unavailable"); return; }
    try {
      const keys = await caches.keys();
      keys.forEach((key) => register(makeEntry("Cache Storage", key, "", { descriptor: null })));
      state.capabilities.push("Cache Storage: supported (unverified caches protected)");
    } catch (error) { state.capabilities.push("Cache Storage: restricted"); state.errors.push("Caches: " + error.message); }
  }
  async function scanOpfs() {
    if (!navigator.storage || typeof navigator.storage.getDirectory !== "function") { state.capabilities.push("OPFS: unavailable"); return; }
    try {
      const root = await navigator.storage.getDirectory();
      let count = 0;
      for await (const item of root.values()) {
        if (count++ >= 100) { state.errors.push("OPFS: listing limited to 100 root entries"); break; }
        register(makeEntry("OPFS", item.name, "", { descriptor: null }));
      }
      state.capabilities.push("OPFS: supported (unverified entries protected)");
    } catch (error) { state.capabilities.push("OPFS: restricted"); state.errors.push("OPFS: " + error.message); }
  }
  function scanCookies() {
    try {
      const pairs = document.cookie ? document.cookie.split(/;\s*/) : [];
      for (const pair of pairs) {
        const name = decodeURIComponent(pair.split("=")[0]);
        if (Object.prototype.hasOwnProperty.call(KNOWN_LOCAL, name)) register(makeEntry("Cookie", name, "", { descriptor: KNOWN_LOCAL[name] }));
      }
      state.capabilities.push("Cookies: only JavaScript-accessible known keys");
    } catch { state.capabilities.push("Cookies: unavailable"); }
  }
  function busyWriter() {
    return (typeof localSavePending !== "undefined" && localSavePending > 0) ||
      (typeof localSaveFailed !== "undefined" && localSaveFailed) ||
      (typeof stateSaveBusy !== "undefined" && stateSaveBusy) ||
      (typeof dropboxBusy !== "undefined" && dropboxBusy) ||
      (typeof window.__capsanotoStorageBusy === "boolean" && window.__capsanotoStorageBusy);
  }
  function note(message, warning) {
    const node = $("#storageManagerStatus");
    if (node) { node.textContent = message; node.classList.toggle("is-warning", Boolean(warning)); }
  }
  async function scan() {
    if (state.busy) return;
    state.busy = true;
    note("Scanning Capsanoto browser storage…");
    state.entries = []; state.capabilities = []; state.errors = []; state.originBytes = null; state.verified.clear();
    try {
      const local = localStore(), session = sessionStore();
      if (local) scanKeyValue(local, "localStorage"); else state.capabilities.push("localStorage: restricted");
      if (session) scanKeyValue(session, "sessionStorage"); else state.capabilities.push("sessionStorage: restricted");
      await scanIndexedDb();
      await scanCaches();
      await scanOpfs();
      scanCookies();
      if (navigator.storage && typeof navigator.storage.estimate === "function") {
        try { const estimate = await navigator.storage.estimate(); state.originBytes = estimate.usage ?? null; }
        catch { state.errors.push("Origin quota/usage estimates unavailable"); }
      }
      render();
      note("Scan complete. Protected or unclassified data will not be removed by Quick Clean.");
    } catch (error) { note("Scan incomplete: " + error.message, true); }
    finally { state.busy = false; }
  }
  function counts() {
    const owned = state.entries.filter((entry) => entry.owned);
    return { all: state.entries.length, owned: owned.length, total: owned.reduce((sum, item) => sum + (item.size || 0), 0),
      protected: owned.filter((e) => e.protected).length,
      safe: owned.filter((e) => e.safe).length,
      verified: owned.filter((e) => e.verified).length,
      review: state.entries.filter((e) => !e.owned).length };
  }
  function render() {
    const summary = $("#storageManagerOverview");
    if (!summary) return;
    const stats = counts();
    const cells = [
      ["Application storage (estimated)", formatBytes(stats.total)],
      ["Origin usage (all apps)", formatBytes(state.originBytes)],
      ["Stored entries", String(stats.all)],
      ["Protected Capsanoto entries", String(stats.protected)],
      ["Safe to clean", String(stats.safe)],
      ["Server verified", String(stats.verified)],
      ["Requires review / other apps", String(stats.review)]
    ];
    summary.innerHTML = cells.map(([label, value]) => '<div class="sm-metric"><span>' + escaped(label) + '</span><strong>' + escaped(value) + '</strong></div>').join("");
    const max = state.originBytes || stats.total || 1;
    const fraction = Math.min(100, Math.round(100 * stats.total / max));
    $("#storageManagerUsage").style.width = fraction + "%";
    $("#storageManagerUsage").title = "Estimated Capsanoto-managed data relative to origin use; storage measurements are approximate.";
    $("#storageManagerDetails").textContent = state.capabilities.join(" • ") + (state.errors.length ? "\nWarnings: " + state.errors.join(" | ") : "");
    $("#storageManagerLastClean").textContent = safeGet(localStore(), LAST_CLEAN) || "Not recorded";
    const group = $("#storageManagerCategories");
    const backupGroup = $("#storageManagerBackupCategories");
    group.innerHTML = CATEGORIES.map((category) => {
      const items = state.entries.filter((entry) => entry.category === category);
      if (!items.length) return "";
      const eligible = items.filter((entry) => entry.safe).length;
      const selection = state.selected.has(category) && eligible > 0;
      return '<label class="sm-category"><span><strong>' + escaped(category) + '</strong><small>' +
        items.length + ' entries · ' + formatBytes(items.reduce((sum, entry) => sum + (entry.size || 0), 0)) +
        ' · ' + (eligible ? eligible + ' eligible for cleanup' : "Protected / review required") +
        '</small></span><input type="checkbox" data-sm-category="' + escaped(category) + '"' +
        (selection ? ' checked' : '') + (eligible ? '' : ' disabled') + '></label>';
    }).join("");
    backupGroup.innerHTML = CATEGORIES.filter((category) => category !== "Unknown / Unclassified" &&
      state.entries.some((entry) => entry.owned && entry.category === category)).map((category) =>
      '<label class="sm-checkbox"><input type="checkbox" data-sm-backup-category="' + escaped(category) + '"' +
      (state.backupSelected.has(category) ? ' checked' : '') + '> ' + escaped(category) + '</label>').join("") ||
      '<span class="sm-muted">No audited application data found.</span>';
    const sources = Array.isArray(window.CapsanotoStorageSources) ? window.CapsanotoStorageSources : [];
    $("#storageManagerServer").textContent = sources.length ?
      "Configured verification sources: " + sources.length + ". Content must match exactly before a local copy is marked verified." :
      "No server verification source configured. Dropbox cloud status alone is not proof that a browser copy is disposable.";
    $("#storageManagerAuto").checked = safeGet(localStore(), AUTO_CLEAN) === "true";
    renderBrowser();
  }
  function renderBrowser() {
    const table = $("#storageManagerRows");
    if (!table) return;
    const q = ($("#storageManagerSearch")?.value || "").toLowerCase();
    const filter = $("#storageManagerFilter")?.value || "all";
    const sort = $("#storageManagerSort")?.value || "key";
    let list = state.entries.filter((entry) =>
      (!q || [entry.key, entry.technology, entry.category, entry.description, entry.database].join(" ").toLowerCase().includes(q)) &&
      (filter === "all" || (filter === "safe" && entry.safe) || (filter === "protected" && entry.protected) ||
       filter === entry.technology || (filter === "owned" && entry.owned)));
    if (sort === "size") list.sort((a, b) => (b.size || 0) - (a.size || 0));
    else list.sort((a, b) => a.key.localeCompare(b.key));
    table.innerHTML = list.slice(0, 400).map((entry) => {
      const ix = state.entries.indexOf(entry);
      return '<tr><td><strong>' + escaped(entry.key) + '</strong><small>' + escaped(entry.description) +
        '</small></td><td>' + escaped(entry.technology + (entry.database ? " / " + entry.database : "")) +
        '</td><td>' + escaped(entry.category) + '</td><td>' + formatBytes(entry.size) +
        '</td><td>' + (entry.verified ? "Server verified" : entry.owned ? "Local / not verified" : "Unknown owner") +
        '</td><td>' + (entry.safe ? "Safe" : "Protected") + '</td><td><button type="button" data-sm-view="' + ix +
        '">Inspect</button></td></tr>';
    }).join("") || '<tr><td colspan="7">No matching records</td></tr>';
    $("#storageManagerRowCount").textContent = list.length + " matching entries" + (list.length > 400 ? " (showing 400)" : "");
  }
  function openKnownRecord(entry) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await openKnownDatabase(entry.database);
        const tx = db.transaction(entry.store, "readonly");
        const request = tx.objectStore(entry.store).get(entry.key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || Error("Record read failed"));
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
        tx.onabort = () => db.close();
      } catch (error) { reject(error); }
    });
  }
  async function readEntry(entry) {
    if (entry.technology === "localStorage") return safeGet(localStorage, entry.key);
    if (entry.technology === "sessionStorage") return safeGet(sessionStorage, entry.key);
    if (entry.technology === "IndexedDB") return openKnownRecord(entry);
    throw Error("This storage technology does not expose a safe editable record in Capsanoto.");
  }
  async function inspectEntry(index) {
    const entry = state.entries[index];
    if (!entry) return;
    const area = $("#storageManagerInspector");
    area.hidden = false;
    $("#storageManagerEntryTitle").textContent = entry.key + " (" + entry.technology + ")";
    $("#storageManagerEntryInfo").textContent = entry.category + " • " + entry.description + " • " +
      formatBytes(entry.size) + " • " + (entry.modified || "Modified: not recorded") +
      " • " + (entry.owned ? "Capsanoto-owned" : "Unverified owner");
    const preview = $("#storageManagerValue");
    preview.dataset.index = String(index);
    if (entry.sensitive) {
      preview.value = "[Sensitive connection or authentication data hidden; excluded from ordinary backups.]";
      preview.readOnly = true;
    } else {
      try {
        const value = await readEntry(entry);
        const serialized = typeof value === "string" ? value : JSON.stringify(value, null, 2);
        preview.value = String(serialized || "").slice(0, 10000) +
          (String(serialized || "").length > 10000 ? "\n[Preview truncated. Use Backup to export the full record.]" : "");
        preview.readOnly = !entry.editable;
      } catch (error) { preview.value = "Preview not available: " + error.message; preview.readOnly = true; }
    }
    $("#storageManagerCopyEntry").disabled = entry.sensitive;
    $("#storageManagerExportEntry").disabled = entry.sensitive || !entry.owned;
    $("#storageManagerSaveEntry").disabled = !entry.editable;
    $("#storageManagerDeleteEntry").disabled = !entry.safe;
  }
  async function saveEditedEntry() {
    const area = $("#storageManagerValue");
    const entry = state.entries[Number(area.dataset.index)];
    if (!entry || !entry.editable || entry.sensitive || busyWriter()) { note("This record cannot be edited safely right now.", true); return; }
    if (entry.technology !== "localStorage" && entry.technology !== "sessionStorage") return;
    const storage = entry.technology === "localStorage" ? localStorage : sessionStorage;
    const before = safeGet(storage, entry.key) || "";
    const next = area.value;
    try {
      const a = JSON.parse(before), b = JSON.parse(next);
      if (Array.isArray(a) !== Array.isArray(b) || typeof a !== typeof b) throw Error("The JSON value type must remain unchanged.");
    } catch (error) { note("Edits must preserve valid JSON and the original value type: " + error.message, true); return; }
    if (entry.key === "capsanoto-favorite-emojis-v1") {
      const values = JSON.parse(next);
      if (!Array.isArray(values) || values.length > 36 || !values.every((item) => typeof item === "string" && item.length < 64)) {
        note("Favourite emoji edits must be an array of up to 36 emoji strings.", true); return;
      }
    } else { note("This record does not have a validated in-place editing schema.", true); return; }
    if (!confirm("Replace " + entry.key + " in browser storage? This will reload Capsanoto. Back up first if needed.")) return;
    storage.setItem(entry.key, next);
    location.reload();
  }
  async function download(contents, name) {
    const blob = new Blob([contents], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function exportOne() {
    const entry = state.entries[Number($("#storageManagerValue").dataset.index)];
    if (!entry || !entry.owned || entry.sensitive) return;
    try {
      const value = await readEntry(entry);
      await download(JSON.stringify({ application: APP, format: "capsanoto-storage-entry", key: entry.key,
        technology: entry.technology, database: entry.database, store: entry.store, value }, null, 2), "capsanoto-entry.json");
      note("Entry export generated. Check your browser downloads.");
    } catch (error) { note("Could not export entry: " + error.message, true); }
  }
  async function backup(selectedOnly = false) {
    if (state.busy) return;
    try { await settleWorkspaceSave(); await scan(); }
    catch (error) { note("Backup stopped: " + error.message, true); return; }
    state.busy = true;
    try {
      const output = { application: APP, format: "capsanoto-storage-backup", version: VERSION,
        exportedAt: new Date().toISOString(), entries: [], omitted: [] };
      for (const entry of state.entries) {
        if (selectedOnly && !state.backupSelected.has(entry.category)) continue;
        if (!entry.owned || entry.sensitive || entry.technology === "Cookie" || entry.technology === "OPFS" ||
            entry.technology === "Cache Storage" || entry.database === "capsanoto-folder-mode-db-v1") {
          if (entry.owned) output.omitted.push({ key: entry.key, location: entry.technology, reason: entry.sensitive ? "Credentials excluded" : "Not JSON portable" });
          continue;
        }
        try {
          const value = await readEntry(entry);
          if (!jsonPortable(value)) {
            output.omitted.push({ key: entry.key, location: entry.technology, reason: "Binary, handle or non-JSON data cannot be safely represented" });
            continue;
          }
          if (value !== undefined && value !== null) output.entries.push({ technology: entry.technology,
            database: entry.database, store: entry.store, key: entry.key, value });
        } catch (error) { output.omitted.push({ key: entry.key, reason: error.message }); }
      }
      const json = JSON.stringify(output, null, 2);
      await download(json, "capsanoto-browser-backup-" + new Date().toISOString().slice(0, 10) + ".json");
      note("Backup generated (" + output.entries.length + " records). " + output.omitted.length +
        " nonportable/sensitive records omitted. Browser download completion cannot be confirmed.");
    } catch (error) { note("Backup failed: " + error.message, true); }
    finally { state.busy = false; }
  }
  function modal(title, description, action, strong) {
    const box = $("#storageManagerConfirmation");
    state.confirmed = action;
    $("#storageManagerConfirmTitle").textContent = title;
    $("#storageManagerConfirmText").textContent = description;
    $("#storageManagerAcknowledge").checked = false;
    $("#storageManagerStrongRow").hidden = !strong;
    $("#storageManagerPhrase").value = "";
    box.hidden = false;
    $("#storageManagerConfirmButton").disabled = true;
  }
  function closeModal() { $("#storageManagerConfirmation").hidden = true; state.confirmed = null; }
  function updateModal() {
    $("#storageManagerConfirmButton").disabled = !$("#storageManagerAcknowledge").checked ||
      (!$("#storageManagerStrongRow").hidden && $("#storageManagerPhrase").value.trim() !== "DELETE CAPSANOTO");
  }
  function collectSafe(mode) {
    return state.entries.filter((entry) => entry.owned && entry.safe &&
      (mode === "quick" || mode === "verified" && entry.verified ||
       mode === "selected" && state.selected.has(entry.category)));
  }
  async function deleteEntry(entry, explicit) {
    if (!entry.owned || (!explicit && !entry.safe)) throw Error("Protected/unknown entry");
    if (entry.technology === "localStorage") localStorage.removeItem(entry.key);
    else if (entry.technology === "sessionStorage") sessionStorage.removeItem(entry.key);
    else if (entry.technology === "IndexedDB") {
      const db = await openKnownDatabase(entry.database);
      try { await new Promise((resolve, reject) => {
        const tx = db.transaction(entry.store, "readwrite");
        tx.objectStore(entry.store).delete(entry.key);
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      }); } finally { db.close(); }
    } else throw Error("Unsupported deletion technology");
  }
  async function performCleanup(entries, destructive) {
    if (state.busy || busyWriter()) { note("A save/sync operation is active or failed; cleanup is disabled. Finish or recover your writing first.", true); return; }
    state.busy = true;
    let removed = 0; const failures = [];
    try {
      for (const entry of entries) {
        try { await deleteEntry(entry, destructive); removed++; }
        catch (error) { failures.push(entry.key + ": " + error.message); }
      }
      if (removed && !destructive) { try { localStore()?.setItem(LAST_CLEAN, new Date().toLocaleString()); } catch { /* Non-critical cleanup timestamp. */ } }
      if (destructive && removed) { location.reload(); return; }
      await scanAfterMutation();
      note(removed + " entries removed. " + failures.length + " failed." +
        (failures.length ? " " + failures.slice(0, 4).join(" | ") : ""), Boolean(failures.length));
    } finally { state.busy = false; }
  }
  async function scanAfterMutation() {
    state.busy = false;
    await scan();
  }
  async function verifyServer() {
    const sources = Array.isArray(window.CapsanotoStorageSources) ? window.CapsanotoStorageSources : [];
    if (!sources.length) { note("No server verification source configured. No local data was marked as redundant.", true); return; }
    let verified = 0;
    for (const source of sources) {
      if (!source || !/^https:\/\//.test(source.url || "")) continue;
      const entry = state.entries.find((item) => item.owned && item.technology === source.technology &&
        item.key === source.key && (item.database || "") === (source.database || ""));
      if (!entry || entry.sensitive) continue;
      try {
        const response = await fetch(source.url, { cache: "no-store", credentials: "omit" });
        if (!response.ok) throw Error("HTTP " + response.status);
        const published = await response.json();
        const local = await readEntry(entry);
        const meaningful = (value) => {
          if (typeof value === "string") { try { return JSON.parse(value); } catch { return value; } }
          return value;
        };
        const canonical = (value) => JSON.stringify(value, function (key, val) {
          return val && !Array.isArray(val) && typeof val === "object" ?
            Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b))) : val;
        });
        if (canonical(meaningful(local)) !== canonical(published)) continue;
        entry.verified = true; verified++;
        // Offline, recovery and active workspace records remain protected even when equal.
        if (source.allowCleanup === true && source.requiredOffline === false &&
            entry.category === "Server-Synced Copies" && !entry.sensitive) {
          entry.protected = false; entry.safe = true;
        }
      } catch (error) { state.errors.push("Verification " + entry.key + ": " + error.message); }
    }
    render();
    note(verified + " copy/copies content-verified; protected working copies were retained." +
      (state.errors.length ? " Some sources could not be verified." : ""));
    if (safeGet(localStorage, AUTO_CLEAN) === "true" && collectSafe("verified").length)
      await performCleanup(collectSafe("verified"), false);
  }
  function cleanupAction(mode) {
    const items = collectSafe(mode);
    if (!items.length) { note("No verified disposable Capsanoto entries in this selection. Your writing and preferences are protected."); return; }
    const amount = items.reduce((sum, entry) => sum + (entry.size || 0), 0);
    modal("Review cleanup", items.length + " verified-safe entries will be removed. Estimated " +
      formatBytes(amount) + " recoverable. Documents, TCards, drafts, settings and unknown data are excluded.",
      () => performCleanup(items, false), false);
  }
  async function clearAll() {
    try { await settleWorkspaceSave(); await scan(); }
    catch (error) { note("Reset stopped: " + error.message, true); return; }
    const items = state.entries.filter((entry) => entry.owned && entry.technology !== "OPFS" &&
      entry.technology !== "Cache Storage" && entry.technology !== "Cookie");
    if (!items.length) { note("No audited Capsanoto records to remove."); return; }
    modal("Clear ALL Capsanoto browser data", "Close any other open Capsanoto tabs before continuing. This will delete " + items.length +
      " audited Capsanoto records, including saved projects, local drafts, preferences and recovery copies. " +
      "Cloud files are not deleted. Other applications' data will not be touched. Download a backup first. " +
      "Unrecognized records and unsupported storage technologies stay protected.",
      () => performCleanup(items, true), true);
  }
  async function restorePreview(file) {
    if (!file || state.busy) return;
    try {
      if (file.size > 100 * 1024 * 1024) throw Error("Backup exceeds the 100 MB browser import safety limit.");
      const payload = JSON.parse(await file.text());
      if (payload.application !== APP || payload.format !== "capsanoto-storage-backup" ||
          payload.version !== VERSION || !Array.isArray(payload.entries)) throw Error("Not a compatible Capsanoto Storage Manager backup.");
      const unique = new Set(), valid = [], excluded = [];
      for (const record of payload.entries) {
        const descriptor = record.technology === "IndexedDB" ? categoryForDb(record.database, record.store, record.key) :
          Object.prototype.hasOwnProperty.call(KNOWN_LOCAL, record.key) ? KNOWN_LOCAL[record.key] : null;
        const id = [record.technology, record.database || "", record.store || "", String(record.key)].join("|");
        if (!descriptor || descriptor[2] || unique.has(id) ||
            !["localStorage", "sessionStorage", "IndexedDB"].includes(record.technology) ||
            (record.technology === "IndexedDB" && (!KNOWN_DBS[record.database]?.includes(record.store) ||
             record.database === "capsanoto-folder-mode-db-v1"))) { excluded.push(id); continue; }
        if (record.technology === "IndexedDB" &&
            record.database === "capsanoto-workspaces-v1") {
          const k = String(record.key);
          if (k.startsWith("document-body:") && typeof record.value !== "string") { excluded.push(id); continue; }
          if ((k === "active" || k.startsWith("project:")) &&
              (typeof record.value?.json !== "string" || !Array.isArray(JSON.parse(record.value.json)?.documents))) {
            excluded.push(id); continue;
          }
        }
        if (record.technology !== "IndexedDB" && typeof record.value !== "string") { excluded.push(id); continue; }
        unique.add(id); valid.push(record);
      }
      if (!valid.length) throw Error("No compatible, non-sensitive records to restore.");
      const existing = new Set(state.entries.map((entry) => entry.id));
      const clashes = valid.filter((entry) => existing.has([entry.technology, entry.database || "", entry.store || "", String(entry.key)].join("|"))).length;
      modal("Restore Capsanoto backup", valid.length + " recognised records; " + clashes +
        " already exist and would be overwritten. " + excluded.length + " unsafe or unsupported records will be skipped. " +
        "The application will reload after restoration. Back up your current data before continuing.",
        () => restoreRecords(valid), true);
    } catch (error) { note("Restore blocked: " + error.message, true); }
    finally { $("#storageManagerRestoreInput").value = ""; }
  }
  async function restoreRecords(records) {
    if (state.busy || busyWriter()) { note("An app save is active. Finish saving before restoration.", true); return; }
    try { await settleWorkspaceSave(); }
    catch (error) { note("Restore stopped: " + error.message, true); return; }
    state.busy = true;
    const failed = [];
    for (const item of records) {
      try {
        if (item.technology === "localStorage" || item.technology === "sessionStorage") {
          if (typeof item.value !== "string") throw Error("Expected a stored text value");
          (item.technology === "localStorage" ? localStorage : sessionStorage).setItem(item.key, item.value);
        } else if (item.technology === "IndexedDB") {
          const db = await openKnownDatabase(item.database);
          try { await new Promise((resolve, reject) => {
            const tx = db.transaction(item.store, "readwrite");
            tx.objectStore(item.store).put(item.value, item.key);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
          }); } finally { db.close(); }
        }
      } catch (error) { failed.push(item.key + ": " + error.message); }
    }
    state.busy = false;
    if (failed.length) { note("Restore partially failed. " + failed.slice(0, 4).join(" | "), true); return; }
    location.reload();
  }
  function report() {
    const stats = counts();
    return "Capsanoto Storage Report\n" + new Date().toISOString() + "\n" +
      "Capsanoto estimated storage: " + formatBytes(stats.total) + "\n" +
      "Origin total usage (not Capsanoto-only): " + formatBytes(state.originBytes) + "\n" +
      "Detected: " + stats.all + ", owned: " + stats.owned + ", protected: " + stats.protected +
      ", safe: " + stats.safe + ", server verified: " + stats.verified +
      ", unknown/other: " + stats.review + "\n" +
      state.capabilities.join("\n") + "\nWarnings:\n" + state.errors.join("\n");
  }
  function buildUi() {
    const menu = $("#settingsPanel .settings-menu");
    const panel = $("#settingsPanel");
    if (!menu || !panel || $("#storageManagerPanel")) return false;
    const button = document.createElement("button");
    button.type = "button"; button.dataset.settingsTab = "storage"; button.setAttribute("aria-pressed", "false");
    button.textContent = "💾 Storage & Cleanup";
    menu.append(button);
    const section = document.createElement("section");
    section.id = "storageManagerPanel"; section.className = "settings-section settings-card storage-manager";
    section.dataset.settingsSection = "storage"; section.hidden = true;
    section.innerHTML = [
      '<h3>💾 Storage & Cleanup</h3>',
      '<p class="panel-help">Inspect and back up this browser’s Capsanoto data. Quick Clean only removes items proven disposable. Other projects on this website are never cleared.</p>',
      '<div class="sm-metrics" id="storageManagerOverview"></div>',
      '<div class="sm-meter" aria-label="Estimated Capsanoto storage relative to all origin storage"><div id="storageManagerUsage"></div></div>',
      '<p class="sm-muted">Application sizes are calculated estimates. The browser’s origin total may include other sites or apps on this domain.</p>',
      '<div class="sm-categories" id="storageManagerCategories"></div>',
      '<div class="sm-actions"><button type="button" data-sm-action="quick">Quick Clean</button><button type="button" data-sm-action="selected">Clear Selected</button><button type="button" data-sm-action="verified">Remove Server-Verified Copies</button><button type="button" data-sm-action="browse">Browse Storage</button><button type="button" data-sm-action="backup">Backup / Export</button><button type="button" data-sm-action="refresh">Refresh</button></div>',
      '<details class="sm-advanced"><summary>Choose categories for a selective backup</summary><div id="storageManagerBackupCategories" class="sm-backup-categories"></div><button type="button" data-sm-action="backup-selected">Backup Selected Categories</button></details>',
      '<div class="sm-settings"><p id="storageManagerServer"></p><div class="sm-actions"><button type="button" data-sm-action="verify">Check Server</button><button type="button" data-sm-action="report">Copy Storage Report</button></div>',
      '<label class="sm-checkbox"><input type="checkbox" id="storageManagerAuto"> Automatically remove verified redundant local copies (opt-in, off by default)</label>',
      '<p class="sm-muted">This option only applies to explicitly configured, content-verified and dispensable server copies. Offline working copies remain protected.</p>',
      '<p class="sm-muted">Last cleanup: <span id="storageManagerLastClean">Not recorded</span></p></div>',
      '<div id="storageManagerBrowser" hidden><h4>Browse Storage</h4><div class="sm-actions"><input type="search" id="storageManagerSearch" placeholder="Search keys, locations, categories" aria-label="Search stored entries">',
      '<select id="storageManagerFilter" aria-label="Filter storage"><option value="all">All entries</option><option value="owned">Capsanoto only</option><option value="safe">Safe only</option><option value="protected">Protected</option><option value="localStorage">localStorage</option><option value="sessionStorage">sessionStorage</option><option value="IndexedDB">IndexedDB</option><option value="Cache Storage">Cache Storage</option><option value="OPFS">OPFS</option></select>',
      '<select id="storageManagerSort" aria-label="Sort storage"><option value="key">By name</option><option value="size">Largest first</option></select></div>',
      '<div class="sm-table-wrap"><table><thead><tr><th>Key / Name</th><th>Location</th><th>Category</th><th>Size</th><th>Server</th><th>Safety</th><th></th></tr></thead><tbody id="storageManagerRows"></tbody></table></div><p id="storageManagerRowCount" class="sm-muted"></p>',
      '<div id="storageManagerInspector" class="sm-inspector" hidden><h4 id="storageManagerEntryTitle"></h4><p id="storageManagerEntryInfo"></p><textarea id="storageManagerValue" rows="7" spellcheck="false" readonly></textarea><div class="sm-actions"><button type="button" id="storageManagerCopyEntry">Copy</button><button type="button" id="storageManagerExportEntry">Export Entry</button><button type="button" id="storageManagerSaveEntry">Save Edited Value</button><button type="button" id="storageManagerDeleteEntry">Delete (safe items only)</button></div></div></div>',
      '<details class="sm-advanced"><summary>Storage technologies & warnings</summary><pre id="storageManagerDetails"></pre></details>',
      '<div class="sm-danger"><h4>Destructive reset</h4><p>Clear Everything deletes only audited Capsanoto-owned local data. It never deletes cloud files or unrelated apps’ storage. Important writing may be lost.</p><button type="button" data-sm-action="clear-all">Clear Everything…</button></div>',
      '<div class="sm-restore"><h4>Restore a browser backup</h4><label>Choose a Storage Manager backup JSON <input id="storageManagerRestoreInput" type="file" accept=".json,application/json"></label><p class="sm-muted">Restoring checks application, schema, known keys and overwrite conflicts. Active data is not overwritten silently.</p></div>',
      '<div class="sm-status" id="storageManagerStatus" role="status" aria-live="polite">Open this section to inspect storage.</div>',
      '<div class="sm-confirm" id="storageManagerConfirmation" hidden><h4 id="storageManagerConfirmTitle"></h4><p id="storageManagerConfirmText"></p><p class="sm-actions"><button type="button" data-sm-action="backup">Download backup first</button></p><label class="sm-checkbox"><input type="checkbox" id="storageManagerAcknowledge"> I understand what will be changed</label><label id="storageManagerStrongRow" hidden>Type DELETE CAPSANOTO to confirm<input id="storageManagerPhrase" type="text" autocomplete="off"></label><div class="sm-actions"><button type="button" id="storageManagerCancelButton">Cancel</button><button type="button" id="storageManagerConfirmButton" disabled>Confirm action</button></div></div>'
    ].join("");
    menu.after(section);
    section.addEventListener("input", (event) => { event.stopPropagation(); if (event.target.matches("#storageManagerSearch, #storageManagerFilter, #storageManagerSort")) renderBrowser(); if (event.target.matches("#storageManagerAcknowledge, #storageManagerPhrase")) updateModal(); });
    section.addEventListener("change", (event) => {
      event.stopPropagation();
      const target = event.target;
      if (target.dataset.smCategory) { if (target.checked) state.selected.add(target.dataset.smCategory); else state.selected.delete(target.dataset.smCategory); }
      if (target.dataset.smBackupCategory) { if (target.checked) state.backupSelected.add(target.dataset.smBackupCategory); else state.backupSelected.delete(target.dataset.smBackupCategory); }
      if (target.id === "storageManagerAuto") {
        try { localStorage.setItem(AUTO_CLEAN, String(target.checked)); note("Automatic verified-copy cleanup " + (target.checked ? "enabled" : "disabled") + "."); }
        catch (error) { note("Preference could not be saved: " + error.message, true); }
      }
      if (target.id === "storageManagerRestoreInput") restorePreview(target.files?.[0]);
      if (target.matches("#storageManagerFilter, #storageManagerSort")) renderBrowser();
    });
    section.addEventListener("click", async (event) => {
      event.stopPropagation();
      const rowButton = event.target.closest("[data-sm-view]");
      if (rowButton) return inspectEntry(Number(rowButton.dataset.smView));
      const action = event.target.closest("[data-sm-action]")?.dataset.smAction;
      if (action === "quick" || action === "selected" || action === "verified") cleanupAction(action);
      else if (action === "browse") { $("#storageManagerBrowser").hidden = !$("#storageManagerBrowser").hidden; renderBrowser(); }
      else if (action === "refresh") await scan();
      else if (action === "verify") await verifyServer();
      else if (action === "backup") await backup();
      else if (action === "backup-selected") await backup(true);
      else if (action === "report") {
        try { await navigator.clipboard.writeText(report()); note("Sanitized storage report copied."); }
        catch { note("Clipboard unavailable. Use HTTPS or a browser clipboard permission.", true); }
      } else if (action === "clear-all") clearAll();
      if (event.target.id === "storageManagerCopyEntry") {
        const entry = state.entries[Number($("#storageManagerValue").dataset.index)];
        if (!entry || entry.sensitive) return;
        try { await navigator.clipboard.writeText($("#storageManagerValue").value); note("Entry preview copied."); }
        catch { note("Clipboard unavailable.", true); }
      }
      if (event.target.id === "storageManagerExportEntry") await exportOne();
      if (event.target.id === "storageManagerSaveEntry") await saveEditedEntry();
      if (event.target.id === "storageManagerDeleteEntry") {
        const entry = state.entries[Number($("#storageManagerValue").dataset.index)];
        if (entry?.safe) modal("Remove safe record", "Remove " + entry.key + " from this browser?", () => performCleanup([entry], false), false);
      }
      if (event.target.id === "storageManagerCancelButton") closeModal();
      if (event.target.id === "storageManagerConfirmButton" && state.confirmed && !event.target.disabled) {
        const callback = state.confirmed; closeModal(); await callback();
      }
    });
    // The app's existing delegated settings handler switches the new section like every other settings tab.
    button.addEventListener("click", () => { if (!section.hidden) scan(); });
    window.CapsanotoStorageManager = { refresh: scan, getReport: report, version: VERSION };
    return true;
  }
  if (buildUi()) {
    const tab = $("#settingsPanel .settings-menu [data-settings-tab='storage']");
    tab.addEventListener("click", () => { setTimeout(scan, 20); });
  }
})();
