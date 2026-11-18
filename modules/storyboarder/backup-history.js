/* Folder-history pruning runs only after the new current index has committed. */
window.StoryboardBackupHistory = (() => {
  const indexName = /^[a-f0-9]{64}\.project\.json$/;
  const managedPath = /^(?:episodes\/[a-f0-9]{64}\.storyboarder\.json|assets\/[a-f0-9]{64}|scripts\/[a-f0-9]{64}\.md|metadata\/[a-f0-9]{64}\.(?:readme|folders)\.txt)$/;

  async function prune(directory, { projectId, currentText, limit, hash, read }) {
    if (!Number.isInteger(limit) || limit < 0 || limit > 100) throw new Error('Invalid folder history limit.');
    const current = JSON.parse(currentText);
    if (current.projectId !== projectId || current.backupFormat !== 2) throw new Error('The current backup cannot be verified for cleanup.');
    const currentPath = `backups/${await hash(currentText)}.project.json`;
    const backups = await directory.getDirectoryHandle('backups');
    const snapshots = []; const emptyIndexes = [];
    for await (const handle of backups.values()) {
      if (handle.kind !== 'file' || !indexName.test(handle.name)) continue;
      const file = await handle.getFile(); const path = `backups/${handle.name}`;
      if (file.size === 0) { emptyIndexes.push(path); continue; }
      const text = await file.text();
      if (await hash(text) !== handle.name.split('.')[0]) throw new Error('A saved backup index is damaged. Cleanup paused; no backup data was removed.');
      const manifest = JSON.parse(text);
      snapshots.push({ path, manifest, time: file.lastModified || 0 });
    }
    if (!snapshots.some(item => item.path === currentPath)) throw new Error('The current recovery index is missing. Cleanup paused.');
    snapshots.sort((a,b) => b.time - a.time || a.path.localeCompare(b.path));

    function references(manifest) {
      if (!manifest.fileHashes || typeof manifest.fileHashes !== 'object' || Array.isArray(manifest.fileHashes)) throw new Error('A backup has invalid file references. Cleanup paused.');
      for (const [path, expected] of Object.entries(manifest.fileHashes)) {
        if (!managedPath.test(path) || expected !== path.split('/').pop().split('.')[0]) throw new Error('A backup has unsafe managed file references. Cleanup paused.');
      }
      return Object.keys(manifest.fileHashes);
    }
    const verified = new Map();
    async function complete(manifest) {
      for (const path of references(manifest)) {
        if (!verified.has(path)) {
          try { verified.set(path, await hash(await read(path)) === manifest.fileHashes[path]); }
          catch (error) { if (error.name === 'NotFoundError') verified.set(path, false); else throw error; }
        }
        if (!verified.get(path)) return false;
      }
      return true;
    }
    if (!await complete(current)) throw new Error('The current backup is incomplete or damaged. Cleanup paused.');
    const keep = new Set(references(current)); const obsolete = [];
    let retained = 0;
    for (const snapshot of snapshots) {
      if (snapshot.path === currentPath) continue;
      const manifest = snapshot.manifest;
      // Old formats and other projects are outside this policy, but their links
      // still protect any shared files inside the managed directories.
      if (manifest.backupFormat !== 2) {
        if (!Array.isArray(manifest.episodes)) throw new Error('An older backup could not be read safely. Cleanup paused.');
        for (const episode of manifest.episodes) {
          keep.add(episode.fileName);
          const data = JSON.parse(await (await read(episode.fileName)).text());
          for (const act of data.acts || []) for (const scene of act.scenes || []) {
            for (const list of Object.values(scene.media || {})) for (const media of list || []) if (media.assetPath) keep.add(media.assetPath);
          }
          for (const script of episode.scripts || []) keep.add(script.path);
        }
        continue;
      }
      if (manifest.projectId !== projectId) { references(manifest).forEach(path => keep.add(path)); continue; }
      if (retained < limit && await complete(manifest)) { retained++; references(manifest).forEach(path => keep.add(path)); }
      else obsolete.push(snapshot.path);
    }
    async function assertCurrent() {
      if (await (await read('storyboarder.project.json')).text() !== currentText) throw new Error('The folder changed during history cleanup. Cleanup stopped.');
    }
    async function remove(path, verifyIndex = false) {
      await assertCurrent();
      const parts = path.split('/'); const name = parts.pop(); let folder = directory;
      for (const part of parts) folder = await folder.getDirectoryHandle(part);
      try {
        const file = await (await folder.getFileHandle(name)).getFile();
        if (verifyIndex && file.size && await hash(await file.text()) !== name.split('.')[0]) throw new Error('A backup index changed during cleanup. Cleanup stopped.');
        await folder.removeEntry(name);
      } catch (error) { if (error.name !== 'NotFoundError') throw error; }
    }
    // No body is removed until every obsolete index has been removed successfully.
    for (const path of [...obsolete, ...emptyIndexes]) await remove(path, true);
    let removedFiles = 0;
    for (const name of ['episodes', 'assets', 'scripts', 'metadata']) {
      let folder;
      try { folder = await directory.getDirectoryHandle(name); }
      catch (error) { if (error.name === 'NotFoundError') continue; throw error; }
      const candidates = [];
      for await (const file of folder.values()) if (file.kind === 'file') candidates.push(`${name}/${file.name}`);
      for (const path of candidates) if (managedPath.test(path) && !keep.has(path)) { await remove(path); removedFiles++; }
    }
    return { removedBackups: obsolete.length + emptyIndexes.length, removedFiles };
  }
  return { prune };
})();
