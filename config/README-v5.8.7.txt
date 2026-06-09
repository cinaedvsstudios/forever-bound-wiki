Capsanoto v5.8.7 table edit icon repair

Rollback anchor:
- v5.8.6 settings scroll/layout repair

Files changed in edited-root package:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html

Change list:
1. Table edit icon now appears immediately when hovering over a table.
2. Table edit icon now appears immediately when clicking inside a table/cell.
3. Removed the 1-second hover delay that made it seem missing.
4. The table toolbar now positions after the browser has calculated its actual width.
5. The selected/hovered table gets a subtle outline so it is clear which table the icon belongs to.
6. Version/cache bumped to v5.8.7.
7. Design key bumped to capsanoto-design-settings-v5-8-7-table-edit-icon.

Checks run:
- node --check app.js
- basic HTML parser check for editor.html, index.html, writing-room.html

Rollback:
- Replace these five files with the v5.8.6 copies if this creates a new problem.

Full non-image package includes all non-image files from the uploaded project plus patched root files.
