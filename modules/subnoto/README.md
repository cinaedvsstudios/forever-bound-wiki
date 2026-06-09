# Subnoto for Capsanoto

This is a Capsanoto-ready conversion of the original Subnoto Chrome extension.

Subnoto is a persistent floating notes panel. It keeps the original lightweight design: one notes array, one render cycle, no framework, and local browser storage.

## Install

Unzip this package into the Capsanoto root directory so the files sit here:

```text
modules/subnoto/subnoto.module.js
modules/subnoto/icon.png
```

Add this script before the closing `</body>` tag in Capsanoto:

```html
<script src="modules/subnoto/subnoto.module.js"></script>
```

Add a button wherever the Subnoto tool should open:

```html
<button type="button" data-capsanoto-tool="subnoto" title="Open Subnoto">📜 Subnoto</button>
```

## Public API

```js
window.CapsanotoSubnoto.toggle();
window.CapsanotoSubnoto.open();
window.CapsanotoSubnoto.close();
window.CapsanotoSubnoto.refresh();
window.CapsanotoSubnoto.getNotes();
window.CapsanotoSubnoto.setNotes(notesArray);
```

You can also open or toggle it with events:

```js
document.dispatchEvent(new Event("capsanoto:open-subnoto"));
document.dispatchEvent(new Event("capsanoto:toggle-subnoto"));
```

## Storage

The Chrome extension used `chrome.storage.local`. This Capsanoto version uses `localStorage`:

```text
capsanoto_subnoto_notes_v1
capsanoto_subnoto_dark_mode_v1
capsanoto_subnoto_layout_v1
```

## Features kept from the extension

- Add, delete, reset, collapse, and expand notes.
- Per-note title and textarea.
- Per-note find, next, and previous match controls.
- Copy, cut, paste, select-all, download, reset, collapse, delete, and color-cycle note actions.
- Download all notes as one file or separate text files.
- Dark mode.
- Persistent local saving.

## Changes from Chrome extension version

- Removed `manifest.json` and `background.js` as runtime requirements.
- Removed `chrome.storage.local` and replaced it with `localStorage`.
- Removed Chrome popup-window creation. Subnoto now opens as a floating, draggable, resizable panel inside Capsanoto.
- Added Shadow DOM isolation so Subnoto styles do not interfere with Capsanoto styles.
