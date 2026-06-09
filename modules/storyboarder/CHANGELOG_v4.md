# Storyboarder v4 change log

Last known good version before this pass: Storyboarder prototype v3.

Files touched in this pass:
- index.html
- storyboarder.js
- storyboarder.css
- sample/storyboarder.sample.json
- CHANGELOG_v4.md

Backups created before editing:
- index.before-v4.html
- storyboarder.before-v4.js
- storyboarder.before-v4.css

Grouped changes:

1. Project layer added
- Added project name button in the top bar, placed immediately before the episode selector.
- Added a project modal with New, Load, Apply, and Export controls.
- Added a project JSON model that stores project name, root folder, active episode, and episode file links.

2. Episode linking added
- Replaced the browser episode select with a custom themed dropdown.
- Episode dropdown now lists project episodes and includes a New option.
- New creates a blank episode slot that can then receive an imported episode JSON.

3. Top controls updated
- Added Import, Script, Save, and Export controls in the top bar.
- Removed the default Windows/browser select styling.
- Kept controls emoji-led and compact.

4. Save/change tracking added
- Added dirty tracking for project-level and episode-level changes.
- Added a visible Unsaved pill.
- Added autosave to localStorage.
- Added before-unload warning for unsaved changes.
- Added warning when switching episode/project with unsaved changes.
- Added changed-file detection using stable hashes.
- Save attempts to write only changed project/episode JSON files via HDD API when available; otherwise it reports the changed files and keeps local autosave.

5. Existing scene workflow preserved
- Scene, act, and overview views remain.
- Media placeholders, drag/drop media, script preview, folder plan, create folders, effects window, and clear local draft remain.

Rollback instructions:
- Restore index.before-v4.html to index.html.
- Restore storyboarder.before-v4.js to storyboarder.js.
- Restore storyboarder.before-v4.css to storyboarder.css.
