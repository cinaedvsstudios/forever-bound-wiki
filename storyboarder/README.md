# Storyboarder Prototype

Storyboarder is a standalone Capsanoto-adjacent production board for episode planning.

It imports a simple Storyboarder JSON scene list, shows mandatory episode jump sections, and lets you add notes plus local media previews per scene. It does not edit the source script. The script Markdown can be linked for read-only popup previews.

## Files

- `index.html` — app shell
- `storyboarder.css` — visual styling
- `storyboarder.js` — app logic
- `storyboarder.png` — current icon/logo
- `sample/storyboarder.sample.json` — cleaned sample import based on the uploaded scene JSON
- `prompt/Storyboarder_JSON_Prompt_v2.txt` — revised generator prompt

## Current features

- Mandatory jump navigator: Prologue, Act 1, Act 2, Act 3, Epilogue
- Scene cards with scene number, title, status, summary, notes, and media boxes
- Local JSON import/export
- Script Markdown linking for popup preview
- Draggable/resizable script preview window
- Local image/video/audio preview after adding files
- Play/stop/download/folder buttons on media tiles
- Folder plan generator
- HDD API hooks for future integration

## HDD API expectations

The prototype checks for one of these browser globals:

- `window.capsanotoHddApi`
- `window.hddApi`
- `window.storyboarderHddApi`

If present, it expects one or more of these methods:

- `createFolders(foldersArray)`
- `createFolder(folderPath)`
- `revealPath(path)`
- `openFolder(path)`

Without the HDD API, folder buttons show the intended path and the folder plan can be copied manually.

## Notes

Browsers do not preserve full local file paths from normal file inputs. The current media preview works for the active browser session. Permanent file copying/open-folder behaviour should use the Capsanoto HDD API later.
