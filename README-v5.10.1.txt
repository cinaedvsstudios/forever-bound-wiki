Capsanoto v5.10.1 window/favicon icon

Rollback anchor:
- v5.10.0 route/document-id sanitizer

Files changed:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html
- manifest.webmanifest

Change list:
1. Added root-level favicon/app icon declarations to all entry pages:
   - rel="icon"
   - rel="shortcut icon"
   - rel="apple-touch-icon"
   - rel="manifest"

2. Added manifest.webmanifest so browser windows / installed shortcuts / app-like launches can use:
   - iconcapsanoto.png

3. The icon source expects the existing root file:
   - iconcapsanoto.png

4. Version/cache bumped to v5.10.1 and design key bumped.

Expected result:
- Browser tab should use the Capsanoto icon.
- If Chrome/Edge creates or refreshes a site shortcut/app window, it should use the Capsanoto icon instead of the generic/default one.
- Existing pinned shortcuts may need to be closed/reopened, recreated, or unpinned/repinned for Windows to refresh the cached icon.

Checks:
- node --check app.js
- HTML parser checks for editor.html, index.html, writing-room.html
- static checks for favicon/manifest references

Rollback:
- Replace these changed files with v5.10.0 copies if needed.

Full package excludes older image assets but includes required table icon assets. It references existing root iconcapsanoto.png.
