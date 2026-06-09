Capsanoto v5.8.5 integrated repair

Rollback anchor:
- v5.8.4

Edited root files:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html

What changed:
- Removed the old forced/hotfix CSS layers from styles.css and replaced them with integrated component rules.
- Replaced app.js layout-forcing recovery with a safe startup sync only; it no longer forces Settings width/height or inline display styles.
- Settings resize works through CSS resize again; Settings sits above the toolbar and editor tools through a normal layer scale.
- Settings close no longer leaves inline display:flex behind.
- Top bar is rebuilt as an icon-over-one-word uppercase command strip.
- Format and Insert dropdowns are compact icon grids with short labels, not wrapped vertical text.
- TCard edit buttons are positioned on the right side of cards.
- Table toolbar lifecycle is rewritten: opens from a single right-side edit button, closes on outside click, scroll, Escape, and pointer leave.
- Writing Assist Rail markers now calculate from the editor viewport and update on editor scroll, so they stay attached to the visible target position.
- Cache/version bumped to v5.8.5.

Checks run:
- node --check app.js
- basic HTML parse checks for editor.html, index.html, writing-room.html

Rollback:
- Replace these five files with the v5.8.4 versions if needed.

Full non-image package includes all non-image files from the working folder.
