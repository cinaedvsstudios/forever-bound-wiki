Capsanoto v5.10.3 sister-app pill panel styling

Rollback anchor:
- v5.10.2 TCard cleanup and scroll repair

Files changed:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html

Change list:
1. Restyled the Writing Room window to borrow the sister app's rounded stacked button language:
   - long pill-shaped folder/tab/document rows
   - purple selected/active pills
   - copper secondary/group pills
   - darker inset panel sections
   - stronger shadows and softer cream borders

2. Restyled the Settings window:
   - top menu tabs are now compact pill controls
   - expanded sections are darker framed cards
   - open section headers use the purple selected style
   - search/input controls use darker rounded fields

3. Restyled the Transclusion Cards panel:
   - help text, inputs, colour grid, action buttons and TCard list use the same pill/panel system
   - action buttons look more like the sister app's sidebar buttons
   - scroll repair from v5.10.2 is preserved

4. Version/cache bumped to v5.10.3 and design key bumped.

Checks:
- node --check app.js
- HTML parser checks for editor.html, index.html, writing-room.html

Rollback:
- Replace changed files with v5.10.2 copies if needed.

Full package excludes older image assets but includes required table icon assets. It references existing root iconcapsanoto.png.
