# Storyboarder v7 changelog / rollback notes

Last known good before this pass: v6.

Files touched:
- index.html
- storyboarder.css
- CHANGELOG_v7.md

Grouped changes:
1. Scene readability
   - Changed the small SCENE label line to use a cleaner system UI font instead of the decorative serif styling.
   - Matched the slug-line readability style more closely by using the same plain UI-font family for scene metadata.

2. Left control panel
   - Converted the vertical one-column control buttons into a compact two-column grid.
   - Updated the control buttons to use icon-over-label layout.
   - Reduced label text size so the sidebar consumes less vertical space while staying readable.

Rollback:
- Restore index.html and storyboarder.css from storyboarder-prototype-v6.zip, or copy storyboarder.before-v7.* files if present in a later archive.
