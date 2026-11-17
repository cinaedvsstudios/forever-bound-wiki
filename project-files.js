/* Project indexes contain metadata; document bodies are independent, immutable files. */
const PROJECT_DOCUMENT_COLLECTIONS = ['documents', 'trash', 'deprecated'];
const savedDocumentBodies = new WeakMap();
const documentLoads = new WeakMap();

async function projectFileHash(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validDocumentBodyRef(ref) {
  return ref && /^[a-f0-9]{64}$/.test(ref.hash);
}

function documentBodyKey(hash) { return `document-body:${hash}`; }
function workspaceProjectKey(projectId, accountId = '') { return accountId ? `project:${accountId}:${projectId}` : `project:${projectId}`; }
function documentIsLoaded(doc) { return typeof doc?.content === 'string'; }

async function encodeProjectIndex(project) {
  const index = { ...project, storageFormat: 'document-files-v1' };
  const bodies = new Map();
  for (const collection of PROJECT_DOCUMENT_COLLECTIONS) {
    index[collection] = await Promise.all((project[collection] || []).map(async (doc) => {
      const { content, _body, ...metadata } = doc;
      if (typeof content !== 'string') {
        if (!validDocumentBodyRef(_body)) throw new Error(`Missing content for ${doc.title || doc.id}. Save stopped; the previous copy is kept.`);
        return { ...metadata, _body };
      }
      const text = JSON.stringify({ type: 'capsanoto-document', schemaVersion: 1, id: doc.id, title: doc.title, content });
      const hash = await projectFileHash(text);
      bodies.set(hash, text);
      const ref = _body?.hash === hash ? _body : { hash };
      return { ...metadata, _body: ref };
    }));
  }
  return { index, bodies };
}

async function checkedDocumentBody(text, hash) {
  if (await projectFileHash(text) !== hash) throw new Error('The document file failed its integrity check. Its saved copy has not been replaced.');
  const body = JSON.parse(text);
  if (body.type !== 'capsanoto-document' || body.schemaVersion !== 1 || typeof body.content !== 'string') throw new Error('The document file is unreadable. Its saved copy has not been replaced.');
  return body;
}

async function ensureDocumentContent(doc) {
  if (!doc) throw new Error('Document not found.');
  if (documentIsLoaded(doc)) return doc;
  if (documentLoads.has(doc)) return documentLoads.get(doc);
  const operation = (async () => {
    const ref = doc._body;
    if (!validDocumentBodyRef(ref)) throw new Error(`The file link for ${doc.title} is missing.`);
    let text = await workspaceRecord(documentBodyKey(ref.hash));
    let body;
    if (typeof text === 'string') {
      try { body = await checkedDocumentBody(text, ref.hash); }
      catch { /* A verified Dropbox copy can repair a damaged local cache. */ }
    }
    if (!body) {
      if (!ref.path || !ref.accountId || dropboxConnection?.accountId !== ref.accountId) throw new Error(`“${doc.title}” is not cached on this device. Connect its Dropbox account to open it. The project and other files are kept.`);
      requireDropboxConnection();
      const downloaded = await dropboxRequest('files/download', { path: ref.path }, { download: true });
      text = downloaded.text;
      body = await checkedDocumentBody(text, ref.hash);
      await cacheDocumentBody(ref.hash, text);
    }
    doc.content = safeDocumentHtml(body.content);
    savedDocumentBodies.set(doc, doc.content === body.content ? doc.content : null);
    return doc;
  })();
  documentLoads.set(doc, operation);
  try { return await operation; }
  catch (error) { throw new Error(`Could not open “${doc.title}”. ${error.message}`); }
  finally { documentLoads.delete(doc); }
}

async function ensureProjectDocumentsLoaded({ archives = false } = {}) {
  const projectId = state.projectId;
  const collections = archives ? PROJECT_DOCUMENT_COLLECTIONS : ['documents'];
  for (const collection of collections) {
    for (const doc of state[collection]) {
      await ensureDocumentContent(doc);
      if (state.projectId !== projectId) throw new Error('The project changed while loading documents. Try again.');
    }
  }
}

function rememberIndexedDocumentBodies(captured, index) {
  if (state.projectId !== captured.projectId) return;
  for (const collection of PROJECT_DOCUMENT_COLLECTIONS) {
    const live = new Map(state[collection].map((doc) => [doc.id, doc]));
    captured[collection]?.forEach((saved, position) => {
      const doc = live.get(saved.id);
      if (doc && doc.content === saved.content) {
        doc._body = index[collection][position]._body;
        if (documentIsLoaded(doc)) savedDocumentBodies.set(doc, doc.content);
      }
    });
  }
}

function releaseDocumentBody(doc) {
  if (doc && doc.id !== state.activeId && validDocumentBodyRef(doc._body) && savedDocumentBodies.get(doc) === doc.content) {
    delete doc.content;
    savedDocumentBodies.delete(doc);
  }
}

function releaseInactiveDocumentBodies() {
  for (const collection of PROJECT_DOCUMENT_COLLECTIONS) state[collection].forEach(releaseDocumentBody);
}

function requireDocumentContent(doc) {
  if (!documentIsLoaded(doc)) throw new Error(`Open “${doc?.title || 'this document'}” before using its content.`);
  return doc.content;
}

async function completeProjectCopy(project) {
  for (const collection of PROJECT_DOCUMENT_COLLECTIONS) {
    for (const doc of project[collection] || []) {
      await ensureDocumentContent(doc);
      delete doc._body;
    }
  }
  return project;
}

async function chooseProjectDocument(project) {
  const result = await openCapsDialog(`Open ${project.writingRoomName || 'project'}`, [
    { html: '<p>Choose the document you want to work on. Other documents stay unloaded until you open them.</p>' },
    { name: 'documentId', label: 'Document', value: project.activeId, options: project.documents.map((doc) => ({ value: doc.id, label: doc.title })) },
  ]);
  if (!result?.documentId || !project.documents.some((doc) => doc.id === result.documentId)) return false;
  project.activeId = result.documentId;
  return true;
}

async function listSavedProjectIndexes() {
  const db = await openWorkspaceDb();
  try {
    return await new Promise((resolve, reject) => {
      const store = db.transaction('records').objectStore('records');
      const request = store.getAllKeys();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        // Do not use getAll(): that would load every cached document body just to list projects.
        const keys = request.result.filter((key) => typeof key === 'string' && key.startsWith('project:'));
        if (!keys.length) { resolve([]); return; }
        const records = new Array(keys.length);
        let remaining = keys.length;
        keys.forEach((key, index) => {
          const record = store.get(key);
          record.onerror = () => reject(record.error);
          record.onsuccess = () => { records[index] = record.result ? { ...record.result, recordKey: key } : null; if (!--remaining) resolve(records.filter(Boolean)); };
        });
      };
    });
  } finally { db.close(); }
}

async function cacheDocumentBody(hash, text) {
  const db = await openWorkspaceDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite');
      const records = tx.objectStore('records');
      records.put(text, documentBodyKey(hash));
      pruneDocumentBodyCache(records);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Browser cache write was cancelled.'));
    });
  } finally { db.close(); }
}

function pruneDocumentBodyCache(records, onActiveIndex = () => {}) {
  const request = records.getAllKeys();
  request.onsuccess = () => {
    const keys = request.result;
    const metadataKeys = keys.filter((key) => typeof key === 'string' && (key === 'active' || key === 'previous-project' || key.startsWith('project:') || key.startsWith('legacy-project:') || key.startsWith('dropbox-binding:')));
    const metadata = new Map();
    let remaining = metadataKeys.length;
    if (!remaining) return;
    for (const key of metadataKeys) {
      const indexRequest = records.get(key);
      indexRequest.onsuccess = () => {
        metadata.set(key, indexRequest.result);
        if (!--remaining) prune();
      };
    }

    function prune() {
      const required = new Set();
      const projects = [];
      const cloudCopies = new Map();
      try {
        for (const [key, record] of metadata) {
          if (!record || key.startsWith('dropbox-binding:')) continue;
          if (key.startsWith('legacy-project:')) {
            if (!Array.isArray(record.bodyReferences)) return; // Unreadable recovery data keeps its dependencies.
            record.bodyReferences.forEach(bodyKey => required.add(bodyKey));
          } else projects.push({ key, record, project: JSON.parse(record.json) });
        }
        // Only links from a committed/read cloud index with a matching saved binding
        // can make a local body disposable. An uploaded body alone is insufficient.
        for (const { project } of projects) {
          if (project.cloudSyncPaused) continue;
          for (const collection of PROJECT_DOCUMENT_COLLECTIONS) {
            for (const doc of project[collection] || []) {
              const ref = doc._body;
              if (!validDocumentBodyRef(ref) || !ref.accountId) continue;
              if (project.workspaceAccountId && project.workspaceAccountId !== ref.accountId) continue;
              const binding = metadata.get(`dropbox-binding:${ref.accountId}:${project.projectId}`);
              if (binding?.format !== 'document-files-v1' || !binding.rev || !/^\/[^/]+\.caps-project$/.test(binding.folder || '') || ref.path !== `${binding.folder}/documents/${ref.hash}.doc.json`) continue;
              const identity = `${project.projectId}:${ref.hash}`;
              if (!cloudCopies.has(identity)) cloudCopies.set(identity, []);
              cloudCopies.get(identity).push(ref);
            }
          }
        }
        for (const { key, record, project } of projects) {
          let changed = false;
          for (const collection of PROJECT_DOCUMENT_COLLECTIONS) {
            for (const doc of project[collection] || []) {
              if (!validDocumentBodyRef(doc._body)) continue;
              const owner = project.workspaceAccountId || doc._body.accountId;
              const ref = !project.cloudSyncPaused && cloudCopies.get(`${project.projectId}:${doc._body.hash}`)?.find(copy => !owner || copy.accountId === owner);
              if (ref && (doc._body.path !== ref.path || doc._body.accountId !== ref.accountId)) {
                doc._body = { ...ref }; changed = true;
              }
              // The open document stays in memory; only unsynced bodies need disk copies.
              if (!ref) required.add(documentBodyKey(doc._body.hash));
            }
          }
          if (changed) records.put({ ...record, json: JSON.stringify(project) }, key);
          if (key === 'active') onActiveIndex(project);
        }
      } catch { return; } // Never clean up around unreadable project metadata.
      for (const bodyKey of keys) {
        if (typeof bodyKey === 'string' && /^document-body:[a-f0-9]{64}$/.test(bodyKey) && !required.has(bodyKey)) records.delete(bodyKey);
      }
    }
  };
}

function runProjectFileAction(action) {
  return Promise.resolve().then(action).catch((error) => {
    setStatus(error.message, 'dirty');
    showStorageWarning(error.message);
  });
}
