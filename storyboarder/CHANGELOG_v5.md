# Storyboarder v5 Change Log

## Last known good version before this pass
- Previous package: `storyboarder-prototype-v4.zip`
- Backups created before overwrite:
  - `index.before-v5.html`
  - `storyboarder.before-v5.css`
  - `storyboarder.before-v5.js`

## Files changed in this pass
- `index.html`
- `storyboarder.css`
- `storyboarder.js`
- `sample/storyboarder.sample.json`

## Grouped changes

### Top bar and project flow
- Added visible `📚 Project` button/name to the left of the episode selector.
- Project modal now supports project name, project root folder, new project, load project JSON, and apply.
- Episode selector now includes `➕ New episode`.
- Import button remains visible in the top bar as `📥 Import`.
- Added visible `💾 Save` button for future HDD API save workflow.
- `📤 Export JSON` moved into Settings.

### Left control panel
- Renamed `Plan` to `📁 Folders`.
- Removed `Create` from the left panel.
- Moved `Create` into the Folders modal.
- Moved `Clear` into Settings.
- Added visible standalone `🔤 Translator` button.
- Added visible standalone `🎙️ Lipsync` button.
- Kept `✨ Effects` as a visible button.

### Folders modal
- `📁 Folders` opens the folder plan modal.
- The modal contains `📋 Copy` and `🗂️ Create`.
- `Create` uses the HDD API if available, otherwise shows a clear message.

### Settings modal
- Added Settings modal.
- Contains `📤 Export JSON` and `🧹 Clear Draft`.
- Clear Draft only clears browser autosave, not HDD files.

### Media tiles
- Drop tile now says `Drop media here` instead of `Drop image here`.
- Accepts images, WebP, videos, audio/sound files, `.blend`, notes/text/JSON files.
- Added per-scene media filters: `All`, `Images`, `Videos`, `Sounds`.

### Notes
- Removed hover notes popover.
- Clicking the scene notes icon now opens a draggable/resizable Notes modal.
- Notes update the scene data and mark the episode dirty.

### Save/autosave logic
- Browser autosave remains active.
- Unsaved changes trigger a warning on episode/project switching and browser close.
- Save calculates hashes and only attempts to write changed project/episode files.
- HDD write calls are hooked for `saveTextFile`, `writeTextFile`, or `writeFile`.

### External tool buttons
- `🔤 Translator` opens: `https://cinaedvsstudios.github.io/Forever-Bound-Game/artifex/apps/misc/translator/`
- `🎙️ Lipsync` opens: `https://cinaedvsstudios.github.io/Forever-Bound-Game/artifex/apps/lipsync-helper/`
