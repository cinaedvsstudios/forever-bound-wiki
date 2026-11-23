# Capsanoto Storage & Cleanup v1.0 (Capsanoto v5.16.3)

Settings → 💾 Storage & Cleanup. Loaded by `index.html`, `editor.html` and `writing-room.html` through `storage-manager.js` and `storage-manager.css`. The module is independent of `app.core.js` and leaves its save logic unchanged.

## Audited storage ownership

**localStorage/sessionStorage:** `forever-bound-writing-room-v2`, `forever-bound-authenticated`, `capsanoto-design-settings-v5-10-5-module-integration`, `capsanoto-help-html-v1`, `capsanoto-writing-room-layout-v5-8-6`, `capsanoto-floating-panel-layouts-v5-9-0`, `capsanoto-writing-surface-layout-v5-9-0`, `capsanoto-favorite-emojis-v1`, `capsanoto-custom-emojis-v1`, `capsanoto-folder-mode-prefs-v1`, `capsanoto-google-drive-storage-v1`, `capsanoto-google-drive-token-v1`, `capsanoto-dropbox-app-key`, `capsanoto_specnoto_settings`, `capsanoto_specnoto_open_state`, `capsanoto_specnoto_pos_x`, `capsanoto_specnoto_pos_y`, and the two namespaced Storage Manager keys. Other keys on the shared GitHub Pages origin are **not** claimed as Capsanoto data.

**IndexedDB:** `capsanoto-workspaces-v1` (active, project:, legacy-project:, previous-project, document-body:, dropbox-connection, dropbox metadata, storyboarder handoffs), `capsanoto-folder-mode-db-v1` (folder handles) and `capsanoto-storyboarder-v1` (storyboards/assets). Unknown records in known databases are protected. If the browser cannot list databases without creating new ones, the manager skips IndexedDB inspection and explains this restriction.

**Cache Storage, OPFS and cookies:** detect capabilities and list readable entries where feasible, but unverified origin-shared data is protected. No broad `localStorage.clear()`, `indexedDB.deleteDatabase()`, `caches.delete()` or origin-wide reset is used.

## Safety rules

All current user content, drafts, recovery records, settings, Dropbox connection details and unknown data are protected during Quick Clean. Quick Clean and category cleanup will often find **zero** eligible items until Capsanoto defines exact disposable data. This is intentional. Clear Everything separately requires an acknowledgement checkbox plus typing `DELETE CAPSANOTO`. It affects *only positively identified* Capsanoto browser records, not Dropbox or other websites.

Server verification requires an explicit `window.CapsanotoStorageSources` array containing specific HTTPS source URLs and local record IDs; none is configured in the current release. A matching filename, Dropbox connection or completed upload does **not** establish equivalence. Optional verified-copy automatic cleanup is off by default. Working files needed offline remain protected.

Backups cover JSON-portable, non-sensitive, audited records. Binary assets, browser folder handles and credentials are deliberately excluded, with omissions reported. A download is initiated but the browser cannot confirm that it reached disk. Restore checks application/schema/record ownership, counts overwrite conflicts and requires confirmation, then reloads Capsanoto. It does not restore unknown or sensitive records.

## Validation

- JavaScript syntax check passed via V8 compilation.
- Settings module mock-DOM mounting passed.
- Mock storage scan identified a known Capsanoto key and protected an unrelated key.
- All three entry pages include Storage Manager CSS and load its JavaScript *before* the Capsanoto runtime loader.
- Real-browser destructive cleanup, IndexedDB large-data restore, mobile layout, and cloud verification have **not** been end-to-end tested yet.

## Further integration

If adding a genuinely disposable cache or exact published JSON mirror, first audit its writer/reader paths, add an explicit ownership definition, document its dependencies, and then configure safe server comparison. Never classify based on `cache` or `temp` substrings alone.
