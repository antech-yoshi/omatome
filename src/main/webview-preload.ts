import { ipcRenderer } from 'electron';

// Capture-phase click handler: runs before any page-level handlers,
// catches anchor clicks reliably even when the page calls preventDefault
// or rewrites the click into window.open later.
(() => {
  const handleClick = (e: MouseEvent): void => {
    const target = e.target as Element | null;
    if (!target || typeof (target as Element).closest !== 'function') return;

    const anchor = (target as Element).closest('a[href]') as HTMLAnchorElement | null;
    if (!anchor) return;

    const href = anchor.href;
    if (!href || !/^https?:\/\//i.test(href)) return;

    let isCrossOrigin = false;
    try {
      isCrossOrigin = new URL(href).origin !== location.origin;
    } catch {
      isCrossOrigin = true;
    }

    const isNewWindow =
      anchor.target === '_blank' ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.button === 1; // middle click

    // Only intercept clicks that need our routing logic.
    // Same-origin plain clicks are left to the page so SPA routing keeps working.
    if (!isNewWindow && !isCrossOrigin) return;

    e.preventDefault();
    e.stopPropagation();

    ipcRenderer.send('webview:link-click', {
      href,
      sourceUrl: location.href,
      target: anchor.target || '',
      modifiers: {
        meta: e.metaKey,
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        button: e.button,
      },
    });
  };

  document.addEventListener('click', handleClick, true);
  document.addEventListener('auxclick', handleClick, true); // middle/right click
})();
