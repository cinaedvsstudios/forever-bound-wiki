/* Capsanoto application runtime v5.10.11. */
(() => {
  const version = "v5.10.11";
  const stamp = () => document.querySelectorAll(".app-version").forEach((node) => { node.textContent = version; });
  stamp();
  document.write('<script src="app.core.js?v=5.10.11"><\/script><script>document.querySelectorAll(".app-version").forEach(function(node){node.textContent="v5.10.11";});<\/script>');
})();
