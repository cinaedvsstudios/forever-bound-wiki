# Storyboarder v6 — Sticky Layout + Act Circle Images

## Last known good version before this change
- v5 files: `index.before-v6.html`, `storyboarder.before-v6.css`, `storyboarder.before-v6.js`

## Files touched
- `index.html` — unchanged structurally; v6 uses the existing layout containers.
- `storyboarder.css` — viewport scrolling, sticky/static header stack, shadows, split panel scrolling, act-circle thumbnail styling.
- `storyboarder.js` — act jump image preservation, right-click image picker, internal scroll helpers.

## Grouped changes
1. Locked the app to the viewport so the top bar and episode jump navigator stay visible.
2. Moved scrolling into the visual scene area instead of the whole browser page.
3. Gave the left control panel and main scene board separate scrolling.
4. Added stronger shadows/dividers between top, left, and main content areas.
5. Added right-click image replacement on the Prologue/Act/Epilogue circles.
6. Preserved `jumpNavigator.thumbnail` instead of wiping it during import normalization.
7. Changed internal jump behavior to scroll the scene board rather than the document.

## Rollback
Replace the current files with:
- `index.before-v6.html`
- `storyboarder.before-v6.css`
- `storyboarder.before-v6.js`
