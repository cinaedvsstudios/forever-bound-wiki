Capsanoto v5.9.5 logo TCard / table / controls / rail polish

Rollback anchor:
- v5.9.4 emoji gradient polish

Files changed:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html

Change list:
1. TCard menu icon now uses the Capsanoto logo:
   - <img src="iconcapsanoto.png">
   - This expects the existing root-level iconcapsanoto.png already present in the repo.

2. Table default styling now matches the rest of the app:
   - darker app-body table background
   - purple table/header accents
   - app text colours
   - purple hover/active outline

3. Top command controls and status box now use radial gradients:
   - dark centre
   - purple outer edge
   - purple border around the whole command/control strip

4. Writing Room folder/group pills now use a light-brown-to-purple gradient.

5. Writing Room document pills now remain darker but with a purple-touched gradient.

6. Writing Room right navigation rail is now sticky inside the scroll panel, so it should stay visible while scrolling.

7. Version/cache bumped to v5.9.5 and design key bumped to load the new defaults cleanly.

Checks:
- node --check app.js
- HTML parser checks for editor.html, index.html, writing-room.html

Rollback:
- Replace changed files with v5.9.4 copies if needed.

Full package excludes older image assets but includes required table icon assets.
