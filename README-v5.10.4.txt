Capsanoto v5.10.4 TCard/settings panel repair

Rollback anchor:
- v5.10.3 sister-app pill panel styling

Files changed:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html

Change list:
1. Fixed colour swatches in Settings.
   v5.10.3 used an over-broad button selector that made favourite colour buttons inherit the generic dark pill style.
   The colour chips and current colour preview now show the actual selected hex colour again.

2. Reworked the Transclusion Cards panel.
   - Added icons to action buttons:
     💾 Save, ➕ Insert, 🗑️ Delete, ✏️ Edit
   - Improved normal panel spacing and button layout.
   - Made the TCard content textarea larger by default.
   - Repaired the lower TCard list cards so the text is readable instead of huge/uppercase/cramped.

3. Added a popout/full-window button to the TCard panel header.
   - New button: ⛶
   - Clicking it toggles a full-window TCard editing mode.
   - In full-window mode, the content textarea becomes much larger.
   - Clicking it again returns the panel to floating size.

4. Preserved the v5.10.3 sister-app direction for Writing Room/Settings, but corrected the parts that were too broad.

5. Version/cache bumped to v5.10.4 and design key bumped.

Checks:
- node --check app.js
- HTML parser checks for editor.html, index.html, writing-room.html
- static checks for popout button and v5.10.4 version

Rollback:
- Replace changed files with v5.10.3 copies if needed.

Full package excludes older image assets but includes required table icon assets. It references existing root iconcapsanoto.png.
