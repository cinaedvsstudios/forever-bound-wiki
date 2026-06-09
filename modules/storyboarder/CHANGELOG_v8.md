# Storyboarder v8 — Simplified Folder Plan

## Last known good update before this pass
- v7: cleaner scene label font and two-column left control buttons.
- Rollback files saved before this pass:
  - `index.before-v8.html`
  - `storyboarder.before-v8.css`
  - `storyboarder.before-v8.js`

## Files changed in this pass
- `index.html`
- `storyboarder.js`
- `CHANGELOG_v8.md`

## Grouped changes
- Simplified the HDD folder plan.
- Scene folders no longer create child folders for `Images`, `Video`, `Audio`, `Blender`, `Notes`, or `Exports`.
- Each scene now gets only one folder, intended to hold photos, videos, dialogue files, and scene-specific working files.
- Each act now gets one shared `Sound` folder for music and SFX.
- `Misc` remains inside each act for unsorted material.
- `Episode Effects` remains at episode level for reusable episode-wide effect assets.
- The Folders modal hint now explains the simplified structure.
- Newly attached media now records its target folder as the scene folder by default, with future music/SFX media types targeted to the act `Sound` folder.

## New folder structure rule
- `Episode 01 - The Curse Begins/Act 02/Sound` = act-level music and SFX.
- `Episode 01 - The Curse Begins/Act 02/Scene 09A - The Church Steps` = scene images, videos, dialogue, and scene-specific working files.
