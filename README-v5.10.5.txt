Capsanoto v5.10.5 Subnoto / Specnoto module integration

Rollback anchor:
- v5.10.4 TCard/settings panel repair

Files changed:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html

Module files expected to already exist in the repo:
- modules/subnoto/subnoto.module.js
- modules/subnoto/icon.png
- modules/specnoto/specnoto.module.js

Change list:
1. Loaded the converted module scripts into all Capsanoto entry pages:
   - modules/specnoto/specnoto.module.js
   - modules/subnoto/subnoto.module.js

2. Wired the existing top-bar buttons as module launchers:
   - Subnoto button now initialises/toggles window.CapsanotoSubnoto
   - Specnoto button now initialises/toggles window.CapsanotoSpecnoto

3. Specnoto initialises against the current editor content:
   - sourceSelector: #editor, .editor[contenteditable="true"], [contenteditable="true"]

4. Added defensive module handling:
   - if a script is missing or the global API does not register, Capsanoto shows a context-status error instead of silently doing nothing
   - errors are logged to the browser console

5. Added small module-ready dot styling to the Subnoto/Specnoto buttons.

6. Version/cache bumped to v5.10.5 and design key bumped.

Checks:
- node --check app.js
- HTML parser checks for editor.html, index.html, writing-room.html
- static checks for module script tags, button metadata, and integration functions

Expected result:
- Click Subnoto: Subnoto panel opens inside Capsanoto.
- Click Specnoto: Specnoto search panel opens and reads the current editor text.
- No index.html module files are required; these are script modules, not standalone pages.

Rollback:
- Replace changed files with v5.10.4 copies if needed.

Full package excludes older image assets but references existing module files in modules/subnoto and modules/specnoto.
