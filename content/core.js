// Fragment of the Local LLM Translator content script.
//
// Duplicate-injection guard, shared browser handle, debug/perf helpers and the
// compose wiring. Settings wiring lives in startup.js, which loads last.
//
// Loaded in order by CONTENT_SCRIPTS (background/content-injection.js, popup)
// together with the other content/*.js fragments. They deliberately share one
// global scope, exactly like the single content.js they were split out of: a
// top-level declaration here is visible to every later fragment.

/**
 * Content Script for Local LLM Translator
 * Handles DOM text extraction, replacement, and auto-translation of new content
 */

// Use browser API with chrome fallback
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Prevent duplicate injection
if (window.hasLLMTranslatorContentScript) {
    console.log('[Translator] Content script already injected, skipping initialization');
    // If we're re-injecting, we might want to ensure the listener returns true to keep the channel open if needed,
    // but usually we just want to stop re-execution.
    throw new Error('Content script already injected'); // Determines this execution stop
}
window.hasLLMTranslatorContentScript = true;

let debugEnabled = false;
function debugLog(...args) { if (debugEnabled) console.log(...args); }
function debugWarn(...args) { if (debugEnabled) console.warn(...args); }

// ============================================================================
// Perf tracing (lightweight, always-on collector)
//
// Pushes { label, ms, ...extra } entries into a global array and mirrors them
// to debugLog, so a run's timing breakdown is available either programmatically
// (window.__perfTrace) or in the console with debug logging enabled. Marks the
// phases of a page translation: DOM scan, per-batch dispatch/done/request/apply,
// first time translated text lands in the page, and the run total.
// ============================================================================
function perfMark(label, ms, extra) {
    const rounded = Math.round(ms * 10) / 10;
    try {
        (globalThis.__perfTrace = globalThis.__perfTrace || []).push(
            Object.assign({ label, ms: rounded }, extra || {}));
    } catch (e) { /* collector unavailable - console only */ }
    debugLog(`[Perf] ${label}${extra && extra.n !== undefined ? ` (n=${extra.n})` : ''}: ${rounded}ms`);
}

let floatingButtonEnabled = false;
let composeController = null;

function configureComposeTranslation(settings) {
    if (!settings || !window.LctComposeController) return;
    const composeSettings = {
        composeTranslationEnabled: !!settings.composeTranslationEnabled,
        composeSourceLanguage: settings.composeSourceLanguage || 'auto',
        composeTargetLanguage: settings.composeTargetLanguage || 'en'
    };
    if (!composeController) {
        composeController = window.LctComposeController.init({
            document,
            settings: composeSettings,
            allowContentEditable: true
        });
        return;
    }
    composeController.configure(composeSettings);
}

// A keyboard shortcut can be the first thing that touches a page: the
// background injects this script on demand and the controller only exists once
// GET_SETTINGS has answered, so give it a moment instead of reporting the
// feature as off.
function waitForComposeController(timeoutMs = 1500) {
    if (composeController) return Promise.resolve(composeController);
    return new Promise(resolve => {
        const startedAt = Date.now();
        const tick = () => {
            if (composeController) { resolve(composeController); return; }
            if (Date.now() - startedAt >= timeoutMs) { resolve(null); return; }
            setTimeout(tick, 100);
        };
        tick();
    });
}

window.addEventListener('pagehide', () => {
    if (!composeController) return;
    composeController.destroy();
    composeController = null;
});

