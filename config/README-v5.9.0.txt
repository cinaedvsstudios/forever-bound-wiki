Capsanoto v5.9.0 layout memory, menu, table icon, and settings repair

Rollback anchor:
- v5.8.9 custom table toolbar icons

Files changed in edited-files package:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html
- assets/icons/table-delete-row.png
- assets/icons/table-delete-column.png

Change list:
1. Table toolbar icons:
   - Removed the visible circular button backgrounds around the table toolbar icons.
   - Increased the icon/button hit area slightly so the icons read bigger.
   - Kept the toolbar capsule itself.
   - Kept color swatches grouped at the end.

2. Top hover menus:
   - Reduced boldness on menu labels.
   - Softened the label brightness.
   - Increased menu icons and added small spacing under the icon.
   - Kept the same hover menu behavior.

3. Layout memory:
   - Settings, Help, Project Settings, and Transclusion Cards floating panels now remember their last dragged position and resized size in localStorage.
   - The writing surface resize is also remembered after refresh.
   - Existing “Save default Writing Room position/size” still works for the Filing Cabinet, but these other windows now save automatically.

4. Settings / Element Designer:
   - Expanded designer cards now use two columns of setting rows where space allows.
   - The preview column remains on the right.
   - Color controls keep thin borders rather than thick white outlines.

5. Version/cache:
   - Version bumped to v5.9.0.
   - HTML loads styles.css?v=5.9.0 and app.js?v=5.9.0.

Checks run:
- node --check app.js
- basic HTML parser check for editor.html, index.html, writing-room.html

Rollback:
- Replace these files with the v5.8.9 copies if needed.

Full package excludes old image assets, but includes the two required table icon PNGs.
