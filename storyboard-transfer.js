/* Pass a single selected document through same-origin browser storage. */
async function sendDocumentToStoryboarder() {
  const target = window.open('about:blank', '_blank');
  if (!target) { setStatus('Allow the Storyboarder tab to open, then try again.', 'dirty'); return; }
  target.opener = null;
  try {
    const doc = activeDocument();
    const projectId = state.projectId;
    const projectName = state.writingRoomName;
    await ensureDocumentContent(doc);
    if (state.projectId !== projectId || state.activeId !== doc.id) throw new Error('The selected document changed. Send it to Storyboarder again.');
    syncEditorToDocument();
    const group = state.filingGroups.find((item) => item.id === doc.filingGroupId);
    const title = group?.label || doc.title;
    const number = /(?:episode|part)\s*(\d+)/i.exec(title)?.[1] || '1';
    const token = crypto.randomUUID();
    const transfer = {
      type: 'capsanoto-storyboard-transfer', version: 1, createdAt: new Date().toISOString(),
      project: { id: projectId, name: projectName },
      episode: { key: doc.source?.documentId || doc.parentDocumentId || doc.id, title, number },
      document: { id: doc.id, title: doc.title, markdown: documentToCapsMarkdown(doc), updatedAt: doc.updatedAt },
    };
    await writeWorkspaceSnapshot();
    await workspaceRecord(`storyboarder-handoff:${token}`, transfer);
    const url = new URL('modules/storyboarder/', location.href);
    url.searchParams.set('import', token);
    target.location.replace(url.href);
    setStatus(`Sent ${doc.title} to Storyboarder`, 'saved');
  } catch (error) {
    target.close(); setStatus(error.message, 'dirty'); showStorageWarning(error.message);
  }
}
