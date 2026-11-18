# Storyboarder

Storyboarder turns a script into an episode production plan: acts, scene cards, production status, notes, effects, and attached images, video, or audio. It does not generate artwork or video.

## Start with a script

In Capsanoto, open the document you want to plan and choose **Send to Storyboarder** in the document's bottom-bar actions. The selected document is transferred through local browser storage on the same website. Storyboarder creates the episode and recognizes act headings, numbered scenes, and INT./EXT. location headings. Review the breakdown against the retained script source.

Sending the same document again updates its source scenes while preserving production notes, status, checklists, and media. Removed source scenes remain marked for review. Different tabs from the same Google source document can contribute to the same episode.

The left panel provides Overview, Act, and Scene views. Use scene cards to add notes, set production status, and attach media. **How it works** explains the controls inside the app. A standalone script can also be loaded through Import.

## Saving and moving devices

Edits autosave in this browser using separate project, episode, and media records. Inactive episodes load on demand. Two open tabs cannot silently overwrite a newer saved project. Unreadable legacy saves are preserved for recovery.

Saved inactive episode bodies are released from memory and reopen from their individual browser records. Change detection retains small hashes rather than full serialized script copies. Unused attachments are collected only after updated scene links save successfully; links in inactive episodes, other projects, and newly staged attachments remain protected. Shared attachments stay until their final saved link is removed. A scene that returns in an updated script loses its removed-scene warning while preserving production notes and media.

**Save backup** writes linked project/episode JSON files, source scripts, and attached media. Where the browser supports folder access, choose a folder; otherwise a portable ZIP downloads. Use **Open folder** or **Import** the ZIP on another device. Backups include every episode, not just the one displayed.

Backups capture one project revision and verify file checksums. Episode files, scripts, media and recovery indexes use versioned names; the folder's current project index is committed last. A failed write leaves the previous complete backup intact. Edits made during saving remain in the browser and still need another backup. Starting or clearing a project is blocked while a backup is running.

**Open folder** can recover the most recent complete saved index if the current index is damaged. Opening a folder or importing a ZIP creates an independent browser project and detaches the original folder. Choose another folder for that copy's next backup. Older project ZIPs remain readable. New checksummed backups reject missing or damaged required files before replacing the current project. Legacy metadata-only attachments still need relinking and are reported as missing.

**Clear Draft** removes the current project's browser episodes, attachments and folder connection; it leaves other browser projects and all disk backups alone. A revision marker prevents an old tab from silently recreating the cleared data. Sending the document from Capsanoto again explicitly starts its planner copy again.

In **Settings → Previous folder backups to keep**, choose 0–100 previous complete backups. The default is **5 previous backups plus the current one**. Apply the setting, then use Save backup. After a successful folder commit, older recovery indexes are removed first, followed by versioned files no retained backup needs. Shared files, foreign-project backups, legacy-format backups and unrelated files are preserved. A damaged current backup stops cleanup; incomplete historical copies do not use up the allowance for complete copies. Increasing the limit cannot restore versions already removed. This project preference travels in browser saves and exported backups; it is separate from Capsanoto's Dropbox document-history setting.

Use one writer per backup folder. Same-origin tabs coordinate through browser locks when available, and the writer checks whether the folder index changed before committing and during cleanup. Independent browsers/processes do not share an atomic file-system compare-and-swap. An injected text-only desktop bridge is not used for backup commits; browsers without native folder support download a ZIP. Cleanup errors leave the freshly committed backup usable and retry at the next Save backup.

Storyboarder's production records and attachments are **not included in Capsanoto's Dropbox sync yet**. Save a backup before moving devices or clearing browser data. Old attachments represented only by file metadata need their original files relinked.

## Scene Mockup

Scene Mockup is a separate 2D frame-composition tool. Arrange visual assets there, export a frame, and attach it to a Storyboarder scene. It currently has no autosave: save its project before closing or refreshing. See the root APP-REVIEW-2026-11-17.md for the review.

Serve the repository over HTTP using `npm start`; opening these pages directly as file URLs is not the supported handoff workflow.
