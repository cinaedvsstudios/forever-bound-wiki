Capsanoto v5.8.8 table toolbar emoji/delete repair

Rollback anchor:
- v5.8.7 table edit icon repair

Files changed in edited-root package:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html

Change list:
1. Added a Delete Entire Table button to the table toolbar.
   - Button: 🗑️
   - It asks for confirmation before deleting the whole table.
   - After deletion it saves and refreshes the writing rail.

2. Replaced unclear compact symbols with clearer emoji-style table controls:
   - 🛠️ open/close table tools
   - ⚖️ equalise column widths
   - ↔️ widen selected column
   - ➕↕️ add row
   - ➕↔️ add column
   - ➖↕️ delete row
   - ➖↔️ delete column
   - 📐 cycle cell alignment
   - 🗑️ delete entire table

3. Fixed the edit icon overlapping the far-right toolbar button.
   - The old global .table-edit-button rule made the button position:absolute.
   - Inside .table-edit-toolbar it is now explicitly position:static.

4. Version/cache bumped to v5.8.8.

Checks run:
- node --check app.js
- basic HTML parser check for editor.html, index.html, writing-room.html

Rollback:
- Replace these five files with the v5.8.7 copies if needed.

Full non-image package includes all non-image files from the working folder.
