/* Separate episode records and binary assets; no media in localStorage. */
window.StoryboardStore = (() => {
  let queue = Promise.resolve();
  const written = new Map();
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
  async function read(projectId) {
    const saved = await record(projectId ? `project:${projectId}` : 'active');
    if (saved?.project?.projectId) revisions.set(saved.project.projectId, saved.revision || 0);
    return saved;
  }
  async function episode(projectId, episodeId) { return record(episodeKey(projectId, episodeId)); }
  function save(payload) {
    // Capture before queuing; a later switch must not change this save's target.
    const captured = JSON.parse(JSON.stringify(payload));
    const operation = queue.catch(() => {}).then(async () => {
      const projectId = captured.project.projectId;
      const index = { ...captured, project: { ...captured.project, episodes: [] } };
      const changed = [];
      for (const entry of captured.project.episodes) {
        const { data, ...metadata } = entry;
        const key = episodeKey(projectId, entry.episodeId);
        if (data) {
          const text = JSON.stringify(data);
          if (written.get(key) !== text) changed.push({ key, data, text });
        } else if (!entry.stored) throw new Error(`Episode ${entry.episodeTitle} is missing its data. The previous save is kept.`);
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
            if ((current.result?.revision || 0) !== (revisions.get(projectId) || 0)) { conflict = true; tx.abort(); return; }
            index.revision = (revisions.get(projectId) || 0) + 1;
            for (const item of changed) store.put(item.data, item.key);
            store.put(index, `project:${projectId}`);
            store.put(index, 'active');
          };
          tx.oncomplete = () => { revisions.set(projectId, index.revision); resolve(); };
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(conflict ? new Error('Another Storyboarder tab saved this project. Download this draft before reloading.') : tx.error || new Error('Storyboarder save was cancelled.'));
        });
        changed.forEach((item) => written.set(item.key, item.text));
      } finally { db.close(); }
      return index;
    });
    queue = operation;
    return operation;
  }
  async function asset(id, file, projectId) {
    if (!projectId) throw new Error("An asset must belong to a Storyboarder project.");
    return record(`asset:${projectId}:${id}`, file);
  }
  async function handoff(token) {
    if (!/^[\w-]{20,100}$/.test(token)) throw new Error('The document transfer link is invalid.');
    return record(`storyboarder-handoff:${token}`, undefined, 'capsanoto-workspaces-v1');
  }
  async function consumeHandoff(token) { return record(`storyboarder-handoff:${token}`, null, 'capsanoto-workspaces-v1'); }
  return { read, save, episode, asset, handoff, consumeHandoff, record };
})();
