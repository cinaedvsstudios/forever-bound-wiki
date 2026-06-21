/* Capsanoto v5.10.12 — runtime loader and final visible version. */
(() => {
  "use strict";

  const VERSION = "v5.10.12";
  const stampVersion = () => {
    document.querySelectorAll(".app-version").forEach((node) => {
      if (node.textContent !== VERSION) node.textContent = VERSION;
    });
  };

  stampVersion();
  const observer = new MutationObserver(stampVersion);
  observer.observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  const core = document.createElement("script");
  core.src = "app.core.js?v=5.10.12";
  core.async = false;
  core.onload = () => {
    stampVersion();
    requestAnimationFrame(stampVersion);
    window.setTimeout(stampVersion, 0);
    window.setTimeout(stampVersion, 100);
    window.setTimeout(stampVersion, 500);
  };
  core.onerror = () => console.error("Capsanoto core runtime could not load.");
  document.head.appendChild(core);
})();
