# Storyboarder

Storyboarder turns a script into an episode production plan: acts, scene cards, production status, notes, effects, and attached images, video, or audio. It does not generate artwork or video.

## Start with a script

In Capsanoto, open the document you want to plan and choose **Send to Storyboarder** in the document's bottom-bar actions. The selected document is transferred through local browser storage on the same website. Storyboarder creates the episode and recognizes act headings, numbered scenes, and INT./EXT. location headings. Review the breakdown against the retained script source.

Sending the same document again updates its source scenes while preserving production notes, status, checklists, and media. Removed source scenes remain marked for review. Different tabs from the same Google source document can contribute to the same episode.

The left panel provides Overview, Act, and Scene views. Use scene cards to add notes, set production status, and attach media. **How it works** explains the controls inside the app. A standalone script can also be loaded through Import.

## Saving and moving devices

Edits autosave in this browser using separate project, episode, and media records. Inactive episodes load on demand. Two open tabs cannot silently overwrite a newer saved project. Unreadable legacy saves are preserved for recovery.

**Save backup** writes linked project/episode JSON files, source scripts, and attached media. Where the browser supports folder access, choose a folder; otherwise a portable ZIP downloads. Use **Open folder** or **Import** the ZIP on another device. Backups include every episode, not just the one displayed.

Storyboarder's production records and attachments are **not included in Capsanoto's Dropbox sync yet**. Save a backup before moving devices or clearing browser data. Old attachments represented only by file metadata need their original files relinked.

## Scene Mockup

Scene Mockup is a separate 2D frame-composition tool. Arrange visual assets there, export a frame, and attach it to a Storyboarder scene. It currently has no autosave: save its project before closing or refreshing. See the root APP-REVIEW-2026-11-17.md for the review.

Serve the repository over HTTP using `npm start`; opening these pages directly as file URLs is not the supported handoff workflow.
