Capsanoto v5.9.9 Writing Room collapse bubble

Rollback anchor:
- v5.9.8 title/color chip repair

Files changed:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html

Change list:
1. Added a new Writing Room header button between Project Settings and X:
   - 🧭 Collapse Writing Room

2. Collapse behaviour:
   - Clicking 🧭 in the Writing Room header saves the current panel layout and collapses the whole Writing Room into a floating compass bubble.
   - The floating bubble sits top-left under the main command/title bar and stays above the editor.
   - Hovering the bubble previews the full Writing Room panel at its saved size/position.
   - Moving outside the previewed panel collapses it back into the bubble.
   - Clicking the bubble locks the full Writing Room open again.
   - Clicking X still fully closes the Writing Room and hides the bubble.

3. Existing Writing Room size/position memory is preserved.

4. Version/cache bumped to v5.9.9 and design key bumped.

Checks:
- node --check app.js
- HTML parser checks for editor.html, index.html, writing-room.html

Rollback:
- Replace these changed files with v5.9.8 copies if needed.

Full package excludes older image assets but includes required table icon assets.
