# Capsanoto review · 20 November 2026

Reviewed the published v5.16.1 website and matching HDD source. The requested blue current-file row and blue rail marker are implemented separately as v5.16.2. The findings below are reported for a follow-up repair; their functional code has not been changed during this review.

## Recommended repair order

Fix the three high-priority cases before a large import/reorganisation. They are reproducible content/structure problems rather than cosmetic suggestions. The fourth finding is a theme consistency issue; the final item is inaccurate guidance.

### High · Editing a document ID can redirect edits into another document

**Source:** `app.core.js:2937` (`updateDocumentInlineField`), `app.core.js:1103` (`activeDocument`), `app.core.js:1213` (`syncEditorToDocument`).

Metadata allows editing the internal document ID. The handler changes `doc.id` without updating `state.activeId`, children's `parentDocumentId`, or other references. Once the active ID no longer resolves, `activeDocument()` falls back to the first file. Subsequent typing in the still-visible document writes into that other file.

**Reproduced:** With First, Second and a child of Second, changing Second's ID to `renamed` left the active ID and child reference as `second`. Typing in Second then replaced First's text. A separate probe changed Second's ID to `FIRST`: the raw duplicate check passed, normalisation produced `first`, and two files acquired the same ID.

**Suggested repair:** Make internal IDs read-only in the normal interface; people can still rename titles. If ID changes are retained, validate the normalised ID and update every reference atomically before allowing another edit. Add regression checks for active selection, children, links and collisions.

### High · Reopening a browser project can roll back newer edits

**Source:** `project-library.js:160` (`openLocalProjectRecord`).

The picker holds a saved project record. Opening it parses that older copy before saving the live editor. `prepareProjectReplacement()` correctly saves the newer text, but the function then replaces it with the already-parsed older record and saves that record over the current project.

**Reproduced:** Saved Second, obtained its picker record, typed `NEW UNSAVED TEXT`, then selected the same browser project. The open operation restored `SECOND ORIGINAL` and replaced the newer text in the working document. The previous-working-copy recovery record still existed; this is a silent rollback, not proof that every recovery copy is lost.

**Suggested repair:** When the selected project is already open, switch documents in the current live project. For other browser projects, reread the latest saved record after flushing pending edits and check its revision before replacing state. Do not reopen a stale picker snapshot silently.

### High · Moving a parent file leaves its children owned by the old folder

**Source:** `app.core.js:2975` (`handleFilingDrop`), `app.core.js:2733` (`handleFilingGroupAction`).

Dragging a parent document changes only that document's folder/tab ownership. Children continue to render under the moved parent, but retain the old folder/tab IDs. Folder deletion uses those ownership fields, so an apparently empty old folder can still contain children that are visible elsewhere.

**Reproduced:** Moved Second from Source to Destination while it contained Nested child. Second acquired Destination's IDs; the child retained Source's. Deleting Source through the actual folder-delete operation moved the child to Trash even though it appeared under the parent in Destination. The child was recoverable from Trash.

**Suggested repair:** Move and validate the entire descendant subtree together, and make deletion membership agree with the displayed hierarchy. Cover moving a nested file between siblings as well: the current drop handler also clears its parent link during a reorder.

### Medium · Opening a browser project does not immediately apply its saved theme

**Source:** `project-library.js:169`; compare the complete theme application in `dropbox-storage.js:466`.

The browser-project route stores the selected project's design settings but does not apply them to the page or refresh the settings form. The Dropbox route does both.

**Reproduced:** Opened a record whose folder background was `#445566` after displaying `#112233`. The project's current settings became `#445566`, but the page's `--folder-row-bg` remained `#112233`.

**Suggested repair:** Use one shared project-theme application step for browser, Dropbox and imported-project opens. This should update the displayed theme and form controls together.

### Low · Dropbox instructions still promise offline caching

**Source:** `dropbox-storage.js:45`.

The connected-account description says visited files are cached for offline use. That no longer describes the chosen design: confirmed synced bodies are removed from persistent local storage, while the current file remains in memory and unsynced edits stay local.

**Suggested repair:** Describe the existing online-first behaviour accurately, including that reopening a synced file after refresh may require Dropbox. No change to the agreed cache policy is needed.

## What passed and what was checked

- All 129 existing automated tests passed on the reviewed v5.16.1 source, including the simulated Dropbox conflict/recovery, separate-file storage, cache cleanup, import/export and Storyboarder tests. These newly reproduced cases were gaps in that coverage.
- Five focused runtime probes reproduced the four functional findings above, including two separate ID failures. They used synthetic documents and an isolated browser database; no user documents or Dropbox files were changed.
- A fresh Chrome profile opened the published website successfully. The normal panel, plain rail icons and normal/compact action menus rendered and behaved correctly. Published core/runtime files matched the reviewed local source.
- The requested v5.16.2 selection change passed four targeted checks and a separate local Chrome check: blue current-file background, matching blue rail marker, matching disclosure headers and contained menus.

Real-account OAuth, a live Dropbox sync/deletion and native backup-folder writes were not exercised in this pass. Existing automated checks cover those application flows with simulated storage. Storyboarder production files still require their separate backup workflow; this review did not add production Dropbox sync or repeat the earlier Scene Mockup audit.

## Change made during this review

Only the explicitly requested current-selection appearance was changed: the active file now has a blue fill/border, and its rail marker is blue. The functional findings remain available for a deliberate repair pass.
