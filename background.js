/**
 * Background entry point for Local LLM Translator.
 *
 * The implementation lives in background/. Chrome loads it here through
 * importScripts(); Firefox loads the same files, in the same order, from
 * manifest `background.scripts` — so keep the two lists in sync.
 *
 * Order matters: core provides the shared helpers, and each later module reads
 * the globals of the ones above it.
 */

if (typeof importScripts === 'function') {
    importScripts(
        // Shared, non-background scripts
        'settings.js',
        'languages.js',
        'cache.js',
        'provider-transport.js',
        'pdf/paragraphs.js',
        'pdf/pdf-store.js',

        // Background modules
        'background/core.js',
        'background/providers.js',
        'background/settings-store.js',
        'background/glossary.js',
        'background/prompt.js',
        'background/translate.js',
        'background/content-injection.js',
        'background/captions-bridge.js',
        'background/pdf-bridge.js',
        'background/messages.js',
        'background/lifecycle.js'
    );
}

// Initialize settings on startup
LctBgSettings.loadSettings().then(() => {
    console.log('[Background] Local LLM Translator background script loaded');
});
