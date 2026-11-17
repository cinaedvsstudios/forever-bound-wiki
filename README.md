# Capsanoto

Capsanoto keeps a themed collection of writing documents: scripts, a series bible, characters, songs, and notes.

## Start with one document

1. Open the app and choose **New project**.
2. Name the collection, for example **Forever Bound**.
3. Choose a Google Docs Word download (`.docx`), or use the read-only Google Docs importer.
4. Preview the content and select the tabs to copy. Each selected Google Docs tab becomes a file. Nested tabs become sub files. Skip alternate copies such as a full-script tab if the acts already contain that material.
5. Use **Room** to browse files, and **Add file** whenever you want to import another document.

A `.docx` download is imported as one file because Word exports do not reliably carry Google's tab relationships. A `capsanoto-google-docs-source` JSON package preserves the tabs supplied by Google. Direct Google Docs reading requires Google Docs API access and an authorized site origin for the configured Google client. Google Docs is only an import source; this workflow does not write back to Google.

**Selecting “all tabs” in Google’s Word download includes their text in one combined file. It does not give Capsanoto a reliable tab tree to rebuild.** You do not need to download every tab separately: use one complete tab-aware source package or the direct Google importer when its account/API access is configured. The import screen identifies combined Word files before you confirm. Preview now opens the complete extracted text with paragraph breaks.

After a Google Doc has been read, choose **Preview all N tabs**. This opens the complete tab list with nesting and content previews before any import. Select the tabs you want there, then use the separate import confirmation. Reading or previewing a Google Doc does not change the project or its source document.

## Navigate a long document

Open **Room**, expand a document card, and open **Headings & scenes**. Search the list, then click a heading or scene label to jump directly to it. The list includes headings 1–6, explicit bookmarks, and short screenplay labels such as `Scene 12: …` or `INT. CASTLE - NIGHT`. Ordinary prose is not treated as a scene. Document tags can also match the search. Repeated heading titles remain separate jump targets.

**Metadata**, **Summary**, and **Headings & scenes** are separate collapsed rows. Their open state and outline search are kept while the Room refreshes. On a wide screen, opening or resizing the Room fits the writing pad beside it. Closing the Room restores the pad’s previous width. On a narrow screen, the Room and pad stack instead of covering one another.

Specnoto has a resize grip at the bottom right. Drag it, or focus the grip and use arrow keys (Shift for larger steps). Its size is remembered in this browser.

The Writing Room also has a resize grip at its bottom-right corner, clear of the jump rail. Drag it or use arrow keys when it is focused. Its dimensions are saved along with its position, and resizing does not exit filing-edit mode.

The main toolbar's layout and appearance are owned by `styles.css`. The generated legacy `settings-consumers.css` layer has been removed: it reintroduced outdated grid and size rules over the current toolbar and prevented Room resizing. Duplicate toolbar controls with no active style consumer were removed rather than allowing them to override the approved layout.

Text, headings, emphasis, lists, and tables are supported. Review Word formatting after import. Direct Google imports mark images, drawings, footnotes, and smart chips with placeholders. Comments, suggestions, and precise page layouts are not migrated. Keep the originals until you have reviewed the imported copy and made a backup.

## Where your files are saved

- **Browser autosave:** documents and project history use IndexedDB, with migration from the previous localStorage save. This copy belongs to this browser, device, and site address. Clearing browser data can remove it.
- **Open project:** reopens projects saved in this browser. Creating or opening another project keeps the current one. **Download previous working copy** recovers the most recent copy before a switch, including before opening a different version of the same project.
- **Download Project Backup:** creates a portable `.caps.json` file containing original editor content, document metadata, TCards, hierarchy, and Markdown copies. Restore it using **Import Project Backup**.
- **Backup folder:** Chrome and Edge can mirror the project into an empty folder on your HDD. The complete project JSON includes original editor content. Markdown files are convenient secondary copies. Existing folders are opened separately, and a folder binding belongs to one project.
- **Dropbox:** optional read/write sync to the connected person's private app folder, normally `Apps/Capsanoto`. No server account or paid Capsanoto subscription is needed. Dropbox's own storage limits apply.

Project Settings separates **Storage**, **Backups & files**, and **Project details**. Account setup for the app owner is under Project details, not among everyday sync actions.

### JSON or Markdown?

The complete `.caps.json` project copy remains the restore and Dropbox sync format. It preserves original editor HTML, styles, IDs, TCards, links, and the document tree. Replacing it with plain Markdown would lose some of that information unless a separate metadata system was introduced.

Use **Room → Project Settings → Backups & files → Download Markdown copy** for a portable ZIP containing an `.md` file per document, nested parent folders, separate raster image assets, TCard text, and a document map. This copy works for reading or editing elsewhere; it does not automatically update the app or replace the complete backup. Some formatting is retained as inline HTML. Embedded images, rather than JSON punctuation, can account for most of a large project’s size.

The main Settings designer uses an aligned list of labels and controls. Apply saves to the project. Image fields can be cleared; custom command labels are honored; Use Defaults applies section defaults while retaining the section’s custom values for when inheritance is turned off.

## Connect Dropbox

The CINAEDVS developer account owns the app registration. Each person connects the Dropbox account where their own files should be stored. These accounts do not need to be the same.

The public app key is in `config/storage.json`. It is safe to distribute. Never put an app secret, generated access token, or account password in source files or commits.

In the Dropbox developer console:

1. Use **Scoped access → App folder**.
2. Enable `account_info.read`, `files.metadata.read`, `files.content.read`, and `files.content.write`.
3. Allow public clients / PKCE.
4. Register the exact callback address. For the existing GitHub Pages site this is `https://cinaedvsstudios.github.io/forever-bound-wiki/dropbox-callback.html`. For local preview, also register `http://localhost:4317/dropbox-callback.html`.
5. Enable additional development users so a separate storage account can connect. Follow Dropbox's production requirements before broad distribution.

In Capsanoto, open **Room → Project Settings → Connect Dropbox**. Sign in with the storage account, then choose **Sync now**. On another device, connect that same storage account and choose **Open from Dropbox**.

Automatic sync is optional and starts five seconds after a browser save. It uploads a complete project snapshot. Sync uses Dropbox revision checks; another device's changed copy stops an upload instead of being overwritten. Review the cloud copy or keep a separate local backup to resolve a conflict. There is no automatic text merge or live collaboration. An offline browser copy remains editable.

Sign-in uses OAuth authorization code with PKCE, without an app secret. If **Remember connection** is selected, a short-lived access token is stored in the browser database. Passwords and refresh tokens are not stored. An expired connection asks for sign-in again. Disconnect removes the local connection and attempts to revoke its token; it keeps your documents.

## Local preview and checks

The static app includes its browser libraries in `vendor`; a deployed copy needs no build step.

For local development:

```text
npm ci --ignore-scripts
npm test
npm start
```

Open `http://localhost:4317`. Keep using the same address if you want the same browser save. `localhost`, `127.0.0.1`, and GitHub Pages have separate browser storage.

The browser importer uses pinned Mammoth and DOMPurify distributions. `npm run vendor` refreshes the bundled files from the locked dependencies. Their licenses are included in `vendor`.
