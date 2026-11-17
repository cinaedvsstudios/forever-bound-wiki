# Capsanoto production tools review · 17 November 2026

## Follow-up review · v5.14.0

The user confirmed that cross-device Dropbox project discovery now works. That check is complete. This pass implements Capsanoto's bounded cloud history only; Storyboarder and Scene Mockup were reviewed without changing their functional code, as requested.

### Storyboarder: remaining findings

| Priority | Finding and consequence | Evidence | Proposed repair |
| --- | --- | --- | --- |
| High | Folder backups overwrite episode files before the final project index. A failure after the first episode write leaves the previous backup with a mixture of new and old episode contents. Writing the index last does not make fixed-name episode overwrites atomic. | Reproduced with two episodes and a failing second file write in `saveChangedFiles` / `writeProductionFile`. | Write versioned episode/media files first, then replace the index; retain the previous verified backup until the commit succeeds. |
| High | Clear Draft keeps the previous project's folder handle and save hashes. Saving the new starter project can overwrite the old project's folder index. It also leaves its IndexedDB project and binary assets behind. | Reproduced through the actual Clear Draft handler: the folder handle, old project record, and asset record remained. | Detach the folder and reset write state on replacement; implement a scoped, transactional browser-project delete with explicit asset cleanup. |
| Medium | Editing during Save backup can end with `dirty = false` even though those new notes are absent from the folder backup. The newer work remains in the browser, but the backup status is misleading. | Reproduced by editing a scene while an awaited file write was pending. | Capture one project revision for backup, and clear its dirty state only if no newer revision exists. Prevent project replacement during a pending backup. |
| Medium | Removing media deletes the scene link and runtime URL but leaves its binary IndexedDB record. Repeated replace/remove cycles accumulate unused storage. | Reproduced: the removed media's asset record was still readable. | Garbage-collect project-scoped assets that no saved episode or retained recovery record references. |
| Medium | Reintroducing a removed script scene leaves its `sourceRemoved` flag set. | Reproduced by parse/merge/remove/reintroduce with the same source scene key. | Explicitly clear the flag when a scene returns in the incoming script. |
| Medium | Visited episodes stay loaded, and the storage writer's `written` map keeps full serialized episode strings. A complete backup also loads every episode without subsequently releasing inactive copies. | Source inspection: episode entries retain `data`; `written` has no eviction path. | Retain small hashes for change detection and release persisted inactive episode bodies after switching/exporting. |

Storyboarder still has no Dropbox production sync or cloud project picker. Its existing Capsanoto handoff, per-episode browser save, media persistence, and portable ZIP restore work in automated tests, but planning notes and assets still need their own backup to move devices. Cloud integration would be a separate implementation, not something completed by this review.

### Scene Mockup: remaining findings

| Priority | Finding and consequence | Evidence | Proposed repair |
| --- | --- | --- | --- |
| High | There is no browser autosave or leave-page protection. Refreshing/closing can lose all work since the last manual save. | Source inspection of startup, store and project I/O; only explicit save/export exists. | Add recoverable IndexedDB drafts, visible save/error status, recovery on startup, and leave-page protection while a write is pending or failed. |
| High | Open-project validation checks only the top-level envelope. Invalid canvas dimensions and null layers/assets pass; replacement mutates live state before rendering can fail. The open operation has no rollback. | A direct validation probe accepted negative/infinite dimensions and null layer/asset entries. | Validate and normalize a detached project fully, including dimensions, IDs and image references, before replacing live state. Preserve the previous project on every failure. |
| Medium | Pointer-drag undo bypasses the configured 40-entry history limit. Large image snapshots can therefore accumulate indefinitely during dragging. | Reproduced 65 pointer completions; undo history contained 65 entries despite `MAX_HISTORY = 40`. | Route pointer commits through the store's bounded history API. |
| Medium | Exported project JSON duplicates the same image strings in asset originals/previews and layer originals/previews; additional layers increase duplication. | `makeAsset`, `makeLayer`, `snapshot` and `serializeProject` retain these fields. | Store each unique asset once and reference it from layers; keep masks/derived images separately. Preserve old project import compatibility. |
| Medium | Every stage render discards/rebuilds all layer nodes, including while dragging; eraser previews also encode the canvas into a data URL during rendering. | Source inspection of `renderStage` and pointer handlers. | Reuse layer nodes, update only changed properties, coalesce pointer renders, and display the eraser canvas directly until commit. |
| Medium | GLB loader wiring is likely broken, and failed loads can leak the object URL/WebGL renderer because cleanup runs only on success. | No import map; GLTFLoader has a bare `three` import. URL revocation and renderer disposal follow the awaited successful load. Wiring failure is inferred; an actual rendered GLB was not browser-tested. | Bundle or correctly map pinned Three.js modules and release renderer, URLs, geometry, materials and textures in `finally`. |

There is no direct Scene Mockup-to-Storyboarder transfer or Dropbox storage integration. Today its intended role is a 2D composition canvas: export a frame and attach it to a Storyboarder scene.

### Verification of the review

Five Storyboarder findings and two Scene Mockup findings were reproduced in isolated runtime probes using synthetic documents/assets. Other findings are source-reviewed and labelled above. Probes were kept outside the app repository. No real scripts, bible content, Dropbox files, or user browser drafts were modified for the review. The apps' native rendering and GLB output were not certified in this pass. Recommended repair order: safe Storyboarder folder commits/replacement, Scene Mockup autosave/import validation, storage/memory cleanup, then cloud integration and direct app transfers.

## What each tool does

- **Capsanoto** owns the editable scripts, bible tabs, document hierarchy, and Dropbox document workspace.
- **Storyboarder** turns a script into an episode production plan: acts, scene cards, production status, notes, effects, and linked images/video/audio. It is a planner; it does not generate finished artwork or video.
- **Scene Mockup**, in `Forever-Bound-Game/scene-mockup`, is a 2D frame-composition canvas. Arrange backgrounds, characters and props, adjust colour/layer properties, and export a frame. GLB models are intended to become rendered 2D thumbnails rather than editable live 3D scenes.

The intended workflow is script → Storyboarder scene plan → Scene Mockup frame → attach exported frame to the Storyboarder scene.

## Changes in this update

In v5.13.1, confirmed Dropbox document bodies are removed from browser storage, including the open document's disk copy. The open document stays in memory; editing creates a local draft again. Newer edits and failed syncs retain their local bodies. Project indexes retain cloud links, and reopening or exporting a saved file does not leave a growing local cache. Original recovery data and unsynced local projects remain protected. Cloud history and Storyboarder media are outside this cleanup.

The bottom bar now has Workspace settings. The connected Dropbox account defines the workspace; its projects and matching browser drafts are listed automatically. The returning-user route opens Dropbox sign-in instead of requiring another project setup. New project is inside Workspace settings. Project and workspace ZIP downloads preserve the verified current cloud files and separate unsynced browser drafts; Capsanoto can restore projects from these ZIPs. Delete and Format workspace require explicit confirmation and are restricted to recognized project paths in the connected account. They do not erase the entire Dropbox account. Folder deletion has a preflight version check, but Dropbox does not support an atomic revision condition for deleting a whole folder, so close projects on other devices before deletion.

Automatic synchronization now checks every ten minutes by default while the app is open. Workspace settings accepts a different interval, or 0 for manual-only sync. The interval is a preference for this browser and account. Content hashes and Dropbox revisions determine whether data changed; timestamps do not decide which copy replaces another. Unchanged projects do not upload, and remote changes requiring review are reported. Other accounts and unbound recovery snapshots cannot be automatically published into the connected workspace.

Writing Room had a fixed 720-pixel height cap. The cap and its obsolete control were removed. Resizing stays anchored and can reach the viewport bottom; the header’s ⬇️ button fills the available height. Tab/edit/settings/close controls use emoji presentation rather than outline glyphs, including migration of the old default tab symbol.

## Storyboarder findings and repairs

1. **Save could do nothing useful on the website.** It depended on an injected desktop API. Save now writes the project’s required files to a user-selected folder where supported, or downloads one portable ZIP. The index links every episode; episode files and script copies are generated automatically. Project indexes are written after episode/asset files.
2. **Only the active episode was saved.** A production save now includes every episode and its available media, including edits made before switching episodes.
3. **Scripts vanished on refresh and were shared between episodes in memory.** Script sources are now saved with their episode. Scene previews use their own source/excerpt.
4. **Media survived only as runtime blob URLs.** Binary attachments now have independent, project-scoped browser records and are relinked on startup. Portable backups include available asset bytes. Old metadata-only links still require their files to be relinked.
5. **Rendering synchronously rewrote a complete localStorage snapshot.** Browser persistence is now deferred and queued, with separate episode records. Other episodes load on demand. Revision checks stop a stale tab from replacing newer production work.
6. **Unreadable saved drafts could be replaced by defaults.** The original is now retained and offered for download; automatic persistence stops until the user chooses how to proceed.
7. **There was no document-to-planner flow.** Send to Storyboarder transfers the selected document through same-origin browser storage, without putting script text in a URL or posting it externally. It creates or updates a matching episode. Re-import preserves production notes/status/media and retains removed scenes with a warning. It recognizes explicit scenes, act headings, and standard INT./EXT. slug lines; ambiguous documents remain reviewable with their full script source retained.

Storyboarder now includes an in-app “How it works” explanation. Its production records are still independent browser data: **they are not yet included in Capsanoto’s Dropbox synchronization**. Use its Save backup before changing devices or clearing browser data. Automated tests exercise the handoff, updates, media persistence, complete project exports, ZIP restoration, and conflicting tabs. Actual native folder-picking and browser rendering still require manual verification.

## Scene Mockup review

This repository was inspected read-only; its files were not changed.

- Save/open and image export are implemented. PNG/WEBP output can retain transparency. Eraser and chroma-key operations produce image data consumed by the same layer/export pipeline.
- **There is no autosave or before-unload protection in the scene-mockup code.** Save its `.scene-mockup.json` project before closing or refreshing. This is the first reliability improvement to make before relying on it for substantial production work.
- **Saved projects duplicate embedded image data** across the asset records and layer records. Undo history also clones scene snapshots. A shared asset store referenced by IDs would reduce storage and memory use.
- The main subscription redraws assets, stage and inspectors on every update. `renderStage` rebuilds all layer elements; eraser previews also turn the canvas into an image data URL during rendering. Reusing layer nodes, updating only changed panels, and scheduling visual updates once per animation frame would improve interaction with large scenes.
- **The GLB module wiring needs repair.** The page contains no import map, while its CDN-loaded GLTFLoader imports the bare `three` module specifier. That loader dependency is visible in the [official Three.js r166 source](https://github.com/mrdoob/three.js/blob/r166/examples/jsm/loaders/GLTFLoader.js). I infer that this path falls into the generated GLB fallback in a normal browser. It has not been confirmed with a rendered GLB in a browser.
- Importing an image is useful today; live model posing, animation, camera direction, and a direct Scene Mockup → Storyboarder transfer are not implemented. Export a frame and attach it to a scene card.

## Verification limits

Dropbox operations were tested against a simulated service, not the user’s account. No real cloud projects were deleted, reset, or uploaded during this work. The real bible was not read or imported. Google Docs remains an import source only. Existing single-file projects remain readable; migration is separate from project deletion. The top toolbar’s approved source rules remain unchanged.
