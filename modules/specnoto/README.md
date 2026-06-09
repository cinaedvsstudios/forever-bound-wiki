# Specnoto for Capsanoto

This folder is the Capsanoto-ready conversion of the original Specnoto Chrome extension.

The Chrome extension used:

- `manifest.json` to register the extension.
- `background.js` to listen for the browser extension icon click and send `TOGGLE_UI` into the page.
- `content.js` to inject the floating Specnoto search window, search page text, preview matches, lock preview tabs, and jump back to matching text.

The Capsanoto module removes the extension wrapper and exposes Specnoto as a normal browser app tool.

## Files

- `specnoto.module.js` — the converted standalone Capsanoto module.
- `capsanoto-button-snippet.html` — example button/script wiring.
- `integration-notes.md` — what changed from the Chrome extension version.

## Install

Copy the whole `modules/specnoto/` folder into the root of the Capsanoto directory.

Then add this near the bottom of each Capsanoto entry page, before `</body>`:

```html
<script src="modules/specnoto/specnoto.module.js"></script>
```

Then add a button somewhere in the Capsanoto top bar:

```html
<button type="button" data-capsanoto-tool="specnoto" title="Open Specnoto">📜 Specnoto</button>
```

The module auto-detects buttons with either:

```html
data-capsanoto-tool="specnoto"
```

or:

```html
id="specnotoButton"
```

You can also call it directly from any existing button:

```html
<button type="button" onclick="window.CapsanotoSpecnoto.toggle()">📜 Specnoto</button>
```

## API

```js
window.CapsanotoSpecnoto.toggle();
window.CapsanotoSpecnoto.open();
window.CapsanotoSpecnoto.close();
window.CapsanotoSpecnoto.refresh();
window.CapsanotoSpecnoto.configure({ sourceSelector: '#editor' });
```

## What it searches

By default it searches the current Capsanoto writing surface using this selector order:

```js
#editor, .editor[contenteditable="true"], [contenteditable="true"], main
```

If it cannot find an editor, it falls back to the page body.

## Storage

The Chrome extension version used `chrome.storage.local`.

The Capsanoto version uses `localStorage` and `sessionStorage`, so it works on GitHub Pages and does not require browser extension permissions.

Stored values:

- Specnoto settings: `capsanoto_specnoto_settings`
- Locked tabs for the current page: `capsanoto_specnoto_tabs_<origin><pathname>`
- Open/closed state and panel position: `sessionStorage`

## Current limitations

Specnoto can jump to plain text inside the editor, but very heavily formatted text may be split across multiple text nodes. In those cases the fallback browser text search may still find it, but exact jumping can be less reliable.

This is intended as a first converted module package. The next pass can make it match the current Capsanoto Filing Cabinet/Settings visual system more closely.
