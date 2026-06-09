# Subnoto conversion notes

Original Subnoto architecture:

- `manifest.json` registered a Manifest V3 Chrome extension with storage permission, action icon, background service worker, and `icon.png`.
- `background.js` listened for the extension action click, focused an existing popup window if one existed, or created `popup.html` in a new Chrome popup window.
- `popup.html`, `popup.js`, and `style.css` contained the actual note UI and logic.
- `popup.js` stored notes in `chrome.storage.local` under `notes` and `darkMode`.

Capsanoto conversion:

- `subnoto.module.js` is a normal browser script that can run on GitHub Pages.
- It exposes `window.CapsanotoSubnoto` instead of relying on the Chrome toolbar button.
- It stores notes and layout in `localStorage`.
- It creates a floating panel inside the current Capsanoto page rather than a separate browser popup.
- The panel is draggable and resizable, with its last position/size saved.
- The UI is isolated with Shadow DOM.

Recommended Capsanoto top-bar button:

```html
<button type="button" data-capsanoto-tool="subnoto" title="Open Subnoto">📜 Subnoto</button>
```
