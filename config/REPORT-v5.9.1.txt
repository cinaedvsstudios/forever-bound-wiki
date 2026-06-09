Capsanoto v5.9.1 debug + sub-file migration support

Rollback anchor:
- v5.9.0 layout memory / menu / settings repair

What we wanted to check/change:
1. Add a Debug area inside Settings.
   - It should have a task list on the left and a copyable text report on the right.
   - The report should help test startup, save data, Filing Cabinet hierarchy, sub files, trash/deprecate logic, localStorage, layout memory, and migration readiness.

2. Clarify the Google Docs tabs-within-tabs migration problem.
   - Current intended hierarchy is Application → Writing Room → Folder → Tab → File → TCard.
   - Google Docs can have deeper tabs, so Capsanoto now adds an optional Sub File layer under File.
   - Practical migration target becomes Application → Writing Room → Folder → Tab → File → Sub File → TCard.

3. Add a first integrated Sub File element.
   - Sub Files are normal files with parentDocumentId.
   - They appear nested under a parent file in the Filing Cabinet.
   - A new ↳ action on a file creates a Sub File.
   - Sub Files can be opened and edited like normal files.
   - Moving a Sub File into a folder/tab promotes it back to a normal file.

4. Double-check delete/deprecate safety.
   - Delete now includes sub files when deleting a parent file.
   - Trash preserves nested deleted files as normal restorable documents.
   - Deprecate remains a non-destructive old-version copy linked to the live file.
   - The new Debug → Trash / deprecate task reports counts and preserved character totals.

5. Preserve portability.
   - Sub Files remain inside the same documents array, so Caps JSON remains simple.
   - The folder-mode manifest now records subFiles under each file.
   - Project payload includes parentDocumentId so the nesting can survive backup/restore.

Suggestions / next steps:
- Do not bulk-import the whole Bible yet. First migrate one folder such as Characters.
- Create the folder/tab/file/sub-file shape manually once, then run Debug → Run All.
- Download a Caps JSON backup after the first successful import test.
- Next useful feature: importer that reads downloaded Google Docs HTML/Markdown files and offers a mapping screen: Folder → Tab → File → Sub File.
- Sub File drag/drop can be expanded later so dropping one file onto another turns it into a Sub File. For this pass, Sub File creation is explicit via the ↳ button to avoid accidental nesting.

Checks run:
- node --check app.js
- basic HTML parser check for editor.html, index.html, writing-room.html
- source checks for debugTaskDefinitions, createSubDocument, parentDocumentId, descendantDocuments, runAllDebugTasks
