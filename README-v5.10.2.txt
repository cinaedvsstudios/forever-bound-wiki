Capsanoto v5.10.2 TCard cleanup and scroll repair

Rollback anchor:
- v5.10.1 window/favicon icon

Files changed:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html
- content/documents.json

Change list:
1. Removed the old placeholder/sample wording from the app, help text, TCard instructions, starter workspace, and default examples.
   - The sample TCard is now Canon-Example.
   - The sample text is generic reusable canon text.
   - The previous sample word is not present in source text.

2. Added a one-time local workspace cleanup for already-saved browser data.
   - Old sample TCard ID is renamed to Canon-Example.
   - Old sample content is replaced with generic reusable canon text.
   - Existing references in document content are remapped.

3. Fixed the TCard / Transclusion Cards panel scrolling.
   - The panel can scroll vertically again.
   - The sticky header remains at the top.
   - The TCard list has bottom padding so lower items are reachable.

4. Fixed the left writing assist rail TCard icon being clipped.
   - Rail overflow is visible.
   - TCard marker uses a larger marker area.
   - Capsanoto logo is allowed to render wider without being cropped.

5. Version/cache bumped to v5.10.2 and design key bumped.

Checks:
- node --check app.js
- HTML parser checks for editor.html, index.html, writing-room.html
- static scan confirmed the old placeholder word is gone from text/source files

Expected result:
- Open Capsanoto once after upload.
- The old sample TCard should become Canon-Example.
- No old placeholder/sample wording should appear in the TCard panel or starter content.
- Transclusion Cards panel should scroll down again.
- The Capsanoto logo marker in the left rail should not be cut off.

Rollback:
- Replace changed files with v5.10.1 copies if needed.

Full package excludes older image assets but includes required table icon assets. It references existing root iconcapsanoto.png.
