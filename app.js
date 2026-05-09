const els = {
  searchButton: document.querySelector('#searchButton'),
  topHelpButton: document.querySelector('#topHelpButton'),
  settingsButton: document.querySelector('#settingsButton'),
  iconButtons: document.querySelectorAll('.icon-button[data-tool-name]'),
  menuTriggers: document.querySelectorAll('.tool-menu .tool-menu-trigger[aria-controls]'),
  status: document.querySelector('#editorStatus'),
};

function hydrateIconButtons() {
  els.iconButtons.forEach((button) => {
    const toolName = button.dataset.toolName;

    if (!toolName) return;

    button.setAttribute('aria-label', toolName);
    button.title = toolName;
  });
}

function setStatus(message = 'Ready') {
  if (els.status) {
    els.status.textContent = message;
  }
}

function closeMenus(exceptTrigger = null) {
  els.menuTriggers.forEach((trigger) => {
    if (trigger === exceptTrigger) return;

    trigger.setAttribute('aria-expanded', 'false');
  });
}

function hydrateMenuTriggers() {
  els.menuTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';

      closeMenus(trigger);
      trigger.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.top-command-menus')) {
      closeMenus();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenus();
    }
  });
}

function hydrateStatusHover() {
  els.iconButtons.forEach((button) => {
    button.addEventListener('mouseenter', () => setStatus(button.dataset.toolName));
    button.addEventListener('focus', () => setStatus(button.dataset.toolName));
    button.addEventListener('mouseleave', () => setStatus());
    button.addEventListener('blur', () => setStatus());
  });
}

hydrateIconButtons();
hydrateMenuTriggers();
hydrateStatusHover();
