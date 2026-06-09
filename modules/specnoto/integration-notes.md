# Specnoto conversion notes

## Removed Chrome extension pieces

The original `background.js` only listened for the Chrome extension icon click, tried to send `{ action: 'TOGGLE_UI' }` to the active tab, and force-injected `content.js` if the content script was not available yet.

Capsanoto does not need that. The normal app button can call:

```js
window.CapsanotoSpecnoto.toggle();
```

The original `manifest.json` declared a Manifest V3 extension with `storage`, `activeTab`, and `scripting` permissions. Capsanoto does not need those permissions because this is now a normal static-site script.

## Converted storage

Original:

```js
chrome.storage.local.get(...)
chrome.storage.local.set(...)
```

Converted:

```js
localStorage.getItem(...)
localStorage.setItem(...)
```

## Converted message listener

Original:

```js
chrome.runtime.onMessage.addListener(... TOGGLE_UI ...)
```

Converted:

```js
window.CapsanotoSpecnoto.toggle()
document.dispatchEvent(new Event('capsanoto:toggle-specnoto'))
```

## Converted text source

Original Specnoto searched:

```js
document.body.innerText
```

Capsanoto Specnoto searches the active writing area first:

```js
#editor, .editor[contenteditable="true"], [contenteditable="true"], main
```

Then it falls back to the whole page body.

## Preserved behavior

Preserved from the extension:

- Floating draggable Specnoto panel.
- Search box.
- Fuzzy search sensitivity.
- Context preview length.
- Preview tabs.
- Locked preview tabs.
- Jump to match.
- Back to original scroll position.
- Download preview text.
- Settings panel.
- Custom icons/emojis.

## Integration recommendation

For Capsanoto, keep Specnoto as a utility tool button in the same family as future Subnoto/other Noto tools. The naming can be:

- Application: Capsanoto
- Tool module: Specnoto
- Button label: 📜 Specnoto
- Function: Search current file / writing surface and jump to matching text.
