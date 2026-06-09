Capsanoto v5.10.0 route/document-id sanitizer

Rollback anchor:
- v5.9.9 Writing Room collapse bubble

Files changed:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html

Change list:
1. Added route/document ID cleanup for dirty URLs such as:
   - editor.html?doc=project-overview%3Fv%3D2.0
   - doc id: project-overview?v=2.0

2. The app now sanitizes document IDs by stripping accidental query/hash fragments and slugifying the result:
   - project-overview?v=2.0 → project-overview

3. On load, route parsing uses the clean document ID and then replaces the URL with the clean route.

4. Existing dirty document IDs in the workspace/trash/deprecated lists are repaired safely:
   - if no clean ID exists, the dirty ID is renamed to the clean ID
   - if the clean ID is already taken, the dirty document is kept using a unique clean suffix to avoid data loss

5. Parent/sub-file references and internal doc URL references are remapped when a dirty ID is renamed.

6. New documents created from URLs now use clean IDs only.

7. Debug → Filing hierarchy now reports:
   - Dirty file ids: none

8. Version/cache bumped to v5.10.0 and design key bumped.

Checks:
- node --check app.js
- HTML parser checks for editor.html, index.html, writing-room.html
- static assertions for sanitizer functions and debug report line

Expected result after upload:
- Open the current dirty URL once.
- The app should load the same document.
- The address should clean itself to:
  editor.html?doc=project-overview
- Debug report should show Dirty file ids: none.

Rollback:
- Replace these changed files with v5.9.9 copies if needed.

Full package excludes older image assets but includes required table icon assets.
