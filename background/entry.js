/**
 * Background entry point for Local LLM Translator.
 *
 * The worker's modules live next to this file. Chrome loads them here through
 * importScripts(); Firefox loads the same files, in the same order, from
 * manifest `background.scripts` — so keep the two lists in sync.
 *
 * importScripts() resolves paths relative to this file (background/), so every
 * path below is root-absolute.
 *
 * Order matters: core provides the shared helpers, and each later module reads
 * the globals of the ones above it.
 */

if (typeof importScripts === 'function') {
    importScripts(
        // Shared, non-background scripts
        '/settings/defaults.js',
        '/languages.js',
        '/cache.js',
        '/provider-transport.js',
        '/pdf/paragraphs.js',
        '/pdf/pdf-store.js',

        // Background modules
        '/background/core.js',
        '/background/providers.js',
        '/background/settings-store.js',
        '/background/glossary.js',
        '/background/prompt.js',
        '/background/translate.js',
        '/background/content-injection.js',
        '/background/captions-bridge.js',
        '/background/pdf-bridge.js',
        '/background/messages.js',
        '/background/lifecycle.js'
    );
}

// Initialize settings on startup
LctBgSettings.loadSettings().then(() => {
    console.log('[Background] Local LLM Translator background script loaded');
});
