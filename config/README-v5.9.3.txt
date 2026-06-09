Capsanoto v5.9.3 purple glow card theme

Rollback anchor:
- v5.9.2 obsidian leather theme

Files changed:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html

Theme changes:
1. Cards, pills, buttons, panels, menus, TCards, emphasis boxes and tables now have stronger drop shadows.
2. Active/hover/focus/highlighted outlines now use purple (#8d43a0 / #5f1e66 family) instead of brown.
3. Added a regular text colour between dark labels and bright headings:
   - secondary/label/subheading text: #615243
   - regular readable text: #c7b08e
   - headings/highlights/bold text: #fff0ce
4. The overall direction follows the Effects Editor reference but uses purple instead of blue.
5. Version/cache bumped to v5.9.3 and the design storage key was changed so the new default palette loads.

Checks:
- node --check app.js
- HTML parser checks for editor.html, index.html, writing-room.html

Rollback:
- Replace changed files with v5.9.2 copies if needed.

Full package excludes older image assets but includes required table icon assets.
