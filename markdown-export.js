/* Portable reading copies. Complete project backups remain the restore format. */
async function buildMarkdownArchive() {
  if (!window.JSZip) throw new Error('The ZIP exporter could not load. Refresh and try again.');
  validateImportedDocuments(state.documents);
  const zip = new JSZip();
  const docs = JSON.parse(JSON.stringify(state.documents));
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  const label = (doc) => `${safePathPart(doc.title || 'Untitled')}--${slugify(doc.id)}`;
  function documentPath(doc) {
    const ancestors = [];
    let parent = byId.get(doc.parentDocumentId);
    while (parent) { ancestors.unshift(label(parent)); parent = byId.get(parent.parentDocumentId); }
    return ['documents', ...ancestors, `${label(doc)}.md`].join('/');
  }
  const assets = new Map();
  const manifest = { format: 'capsanoto-markdown-copy', version: 1, projectName: state.writingRoomName, exportedAt: new Date().toISOString(), documents: [], tcards: [] };
  for (const doc of docs) {
    const path = documentPath(doc);
    const container = document.createElement('div');
    container.innerHTML = safeDocumentHtml(doc.content);
    for (const img of container.querySelectorAll('img')) {
      const src = img.getAttribute('src') || '';
      const embedded = /^data:image\/(png|jpeg|gif|webp|avif);base64,([A-Za-z0-9+/=\s]+)$/.exec(src);
      let target = src;
      if (embedded) {
        if (!assets.has(src)) {
          const assetPath = `assets/image-${assets.size + 1}.${embedded[1] === 'jpeg' ? 'jpg' : embedded[1]}`;
          zip.file(assetPath, embedded[2].replace(/\s/g, ''), { base64: true });
          assets.set(src, assetPath);
        }
        target = '../'.repeat(path.split('/').length - 1) + assets.get(src);
      }
      if (target) {
        const alt = (img.getAttribute('alt') || 'Image').replace(/[\r\n]/g, ' ').replace(/[\\[\]]/g, '\\$&');
        img.replaceWith(document.createTextNode(`![${alt}](${target.replace(/[() ]/g, (c) => encodeURIComponent(c))})`));
      }
    }
    zip.file(path, documentToCapsMarkdown({ ...doc, content: container.innerHTML }));
    manifest.documents.push({ id: doc.id, title: doc.title, parentDocumentId: doc.parentDocumentId || '', path, tags: doc.tags || [] });
  }
  for (const block of Object.values(state.blocks)) {
    const path = `tcards/${safePathPart(block.id)}.md`;
    zip.file(path, `# ${block.id}\n\n${block.content || ''}\n`);
    manifest.tcards.push({ id: block.id, path });
  }
  zip.file('project-map.json', JSON.stringify(manifest, null, 2));
  zip.file('README.txt', 'CAPSANOTO MARKDOWN COPY\n\nOpen the .md files in the documents folder with a Markdown editor. Nested documents keep their parent folders. Embedded raster images are stored in assets and linked from the Markdown files. TCard references remain {{ID}}; their text is in tcards. project-map.json records document names, IDs, and nesting.\n\nThis is a portable reading/editing copy, not a complete project backup. Some formatting uses inline HTML, and app-specific styles and behaviors may not work in another editor. Use a .caps.json complete backup to restore the original project in Capsanoto. Editing these Markdown copies does not automatically change the Capsanoto project.\n');
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

async function downloadMarkdownProject() {
  syncEditorToDocument();
  setStatus('Preparing Markdown copy…', 'dirty');
  const bytes = await buildMarkdownArchive();
  downloadFile(`${safePathPart(state.writingRoomName || 'Writing Room')}-Markdown.zip`, bytes, 'application/zip');
  setStatus('Markdown copy downloaded · project unchanged', 'saved');
}
