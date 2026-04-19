// Runs in the page's MAIN world at document_start — before IndiaMART's JS.
// Overrides the Page Visibility API so IndiaMART always thinks the page is
// visible, ensuring cards are rendered even when the window is minimized or
// Chrome is in the background.
Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
