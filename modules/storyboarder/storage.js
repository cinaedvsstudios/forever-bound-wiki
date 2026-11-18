/* Separate episode records and binary assets; no media in localStorage. */
window.StoryboardStore = (() => {
  let queue = Promise.resolve();
  const writtenHashes = new Map();
  const revisions = new Map();
  function database(name = 'capsanoto-storyboarder-v1') {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records'); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close other Storyboarder tabs and try again.'));
    });
  }
  async function record(key, value, dbName) {
    const db = await database(dbName);
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('records', value === undefined ? 'readonly' : 'readwrite');
        const store = tx.objectStore('records');
        const request = value === undefined ? store.get(key) : store.put(value, key);
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Storyboarder save was cancelled.'));
      });
    } finally { db.close(); }
  }
  function episodeKey(projectId, episodeId) { return `episode:${projectId}:${episodeId}`; }
  function mediaIds(data) {
    return [...new Set((data.acts || []).flatMap(act => (act.scenes || []).flatMap(scene => Object.values(scene.media || {}).flat().map(item => item.id))))];
  }
  async function episodeHash(data) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function pruneAssets(store, projectId, assetIds) {
    const request = store.getAllKeys();
    request.onsuccess = () => {
      const prefix = `asset:${projectId}:`; const staging = `asset-staging:${projectId}:`;
      const protectedIds = new Set(request.result.filter(key => typeof key === 'string' && key.startsWith(staging)).map(key => key.slice(staging.length)));
      for (const id of assetIds) store.delete(staging + id);
      for (const key of request.result) {
        if (typeof key === 'string' && key.startsWith(prefix) && !assetIds.has(key.slice(prefix.length)) && !protectedIds.has(key.slice(prefix.length))) store.delete(key);
      }
    };
  }
  async function read(projectId) {
    const saved = await record(projectId ? `project:${projectId}` : 'active');
    if (saved?.project?.projectId || saved?.projectId) revisions.set(saved.project?.projectId || saved.projectId, saved.revision || 0);
    return saved;
  }
  async function episode(projectId, episodeId) { return record(episodeKey(projectId, episodeId)); }
  function save(payload) {
    // Capture before queuing; a later switch must not change this save's target.
    const captured = JSON.parse(JSON.stringify(payload));
    const operation = queue.catch(() => {}).then(async () => {
      const projectId = captured.project.projectId;
      const expectedRevision = revisions.get(projectId) || 0;
      const index = { ...captured, project: { ...captured.project, episodes: [] } };
      const changed = [];
      for (const entry of captured.project.episodes) {
        const { data, ...metadata } = entry;
        const key = episodeKey(projectId, entry.episodeId);
        if (data) {
          metadata.contentHash = await episodeHash(data);
          metadata.assetIds = mediaIds(data);
          if (writtenHashes.get(key) !== metadata.contentHash) changed.push({ key, data, hash: metadata.contentHash });
        } else if (!entry.stored) throw new Error(`Episode ${entry.episodeTitle} is missing its data. The previous save is kept.`);
        else if (!metadata.contentHash || !Array.isArray(metadata.assetIds)) {
          // Upgrade old indexes once without retaining the episode in the live editor.
          const saved = await episode(projectId, entry.episodeId);
          if (!saved) throw new Error(`Episode ${entry.episodeTitle} is missing. Cleanup was stopped.`);
          metadata.contentHash = await episodeHash(saved); metadata.assetIds = mediaIds(saved);
        }
        index.project.episodes.push({ ...metadata, stored: true });
      }
      const db = await database();
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction('records', 'readwrite');
          const store = tx.objectStore('records');
          let conflict = false;
          const current = store.get(`project:${projectId}`);
          current.onsuccess = () => {
            if ((current.result?.revision || 0) !== expectedRevision) { conflict = true; tx.abort(); return; }
            index.revision = expectedRevision + 1;
            for (const item of changed) store.put(item.data, item.key);
            store.put(index, `project:${projectId}`);
            store.put(index, 'active');
            pruneAssets(store, projectId, new Set(index.project.episodes.flatMap(entry => entry.assetIds)));
          };
          tx.oncomplete = () => { revisions.set(projectId, index.revision); resolve(); };
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(conflict ? new Error('Another Storyboarder tab saved this project. Download this draft before reloading.') : tx.error || new Error('Storyboarder save was cancelled.'));
        });
        changed.forEach((item) => writtenHashes.set(item.key, item.hash));
      } finally { db.close(); }
      return index;
    });
    queue = operation;
    return operation;
  }
  async function asset(id, file, projectId) {
    if (!projectId) throw new Error("An asset must belong to a Storyboarder project.");
    if (file === undefined) return record(`asset:${projectId}:${id}`);
    const db = await database();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('records', 'readwrite'); const store = tx.objectStore('records');
        store.put(file, `asset:${projectId}:${id}`);
        // An attachment is protected until its first scene save or explicit removal.
        store.put(true, `asset-staging:${projectId}:${id}`);
        const current = store.get(`project:${projectId}`);
        current.onsuccess = () => { if (current.result?.deleted) tx.abort(); };
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('This project was cleared before the attachment could be saved.'));
      });
    } finally { db.close(); }
  }

  function discardStagedAsset(id, projectId) {
    const operation = queue.catch(() => {}).then(async () => {
      const db = await database();
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction('records', 'readwrite');
          tx.objectStore('records').delete(`asset-staging:${projectId}:${id}`);
          tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
        });
      } finally { db.close(); }
    });
    queue = operation; return operation;
  }

  async function snapshot(project) {
    const captured = JSON.parse(JSON.stringify(project));
    await queue.catch(() => {});
    const db = await database();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('records'); const store = tx.objectStore('records');
        const assets = new Map(); let problem = null; let stale = false;
        const current = store.get(`project:${captured.projectId}`);
        const fail = message => { problem = new Error(message); tx.abort(); };
        current.onsuccess = () => {
          stale = (current.result?.revision || 0) !== (revisions.get(captured.projectId) || 0) || Boolean(current.result?.deleted);
          if (stale && captured.episodes.some(entry => !entry.data)) {
            fail('Another Storyboarder tab changed or cleared this project. The backup was stopped.'); return;
          }
          function readAssets(data) {
            for (const act of data.acts || []) for (const scene of act.scenes || []) {
              for (const list of Object.values(scene.media || {})) for (const media of list || []) {
                if (assets.has(media.id)) continue;
                assets.set(media.id, null);
                const request = store.get(`asset:${captured.projectId}:${media.id}`);
                request.onsuccess = () => assets.set(media.id, request.result || null);
              }
            }
          }
          for (const entry of captured.episodes) {
            if (entry.data) readAssets(entry.data);
            else {
              const request = store.get(episodeKey(captured.projectId, entry.episodeId));
              request.onsuccess = () => {
                if (!request.result) { fail(`Episode ${entry.episodeTitle} is missing. The backup was stopped.`); return; }
                entry.data = request.result; readAssets(entry.data);
              };
            }
          }
        };
        tx.oncomplete = () => resolve({ project: captured, assets, stale });
        tx.onerror = () => reject(problem || tx.error);
        tx.onabort = () => reject(problem || tx.error || new Error('Backup capture was cancelled.'));
      });
    } finally { db.close(); }
  }

  function removeProject(projectId) {
    const operation = queue.catch(() => {}).then(async () => {
      const db = await database();
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction('records', 'readwrite'); const store = tx.objectStore('records');
          let conflict = false;
          const current = store.get(`project:${projectId}`);
          current.onsuccess = () => {
            if ((current.result?.revision || 0) !== (revisions.get(projectId) || 0)) { conflict = true; tx.abort(); return; }
            const request = store.getAllKeys();
            request.onsuccess = () => {
              for (const key of request.result) {
                if (typeof key === 'string' && (key.startsWith(`episode:${projectId}:`) || key.startsWith(`asset:${projectId}:`) || key.startsWith(`asset-staging:${projectId}:`) || key === `folder:${projectId}`)) store.delete(key);
              }
              // Retain only a revision tombstone, so a stale tab cannot resurrect cleared data.
              store.put({ projectId, deleted: true, revision: (current.result?.revision || 0) + 1 }, `project:${projectId}`);
              const active = store.get('active');
              active.onsuccess = () => { if (active.result?.project?.projectId === projectId) store.delete('active'); };
            };
          };
          tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(conflict ? new Error('Another Storyboarder tab changed this project. Reload before clearing it.') : tx.error);
        });
        for (const key of writtenHashes.keys()) if (key.startsWith(`episode:${projectId}:`)) writtenHashes.delete(key);
        revisions.delete(projectId);
      } finally { db.close(); }
    });
    queue = operation; return operation;
  }
  async function handoff(token) {
    if (!/^[\w-]{20,100}$/.test(token)) throw new Error('The document transfer link is invalid.');
    return record(`storyboarder-handoff:${token}`, undefined, 'capsanoto-workspaces-v1');
  }
  async function consumeHandoff(token) { return record(`storyboarder-handoff:${token}`, null, 'capsanoto-workspaces-v1'); }
  return { read, save, episode, episodeHash, asset, discardStagedAsset, snapshot, removeProject, handoff, consumeHandoff, record };
})();
