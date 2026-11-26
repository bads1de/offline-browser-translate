/**
 * Background core: browser API handle, debug logging, perf marks and the
 * small helpers every other background module shares.
 *
 * Exposed as `LctBgCore` on the global object. Loaded by background/entry.js
 * (importScripts) and by manifest `background.scripts` for Firefox.
 */

(function (root) {
    'use strict';
    if (root.LctBgCore) return;
    const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

let debugEnabled = false;

function setDebug(enabled) { debugEnabled = !!enabled; }

function debugLog(...args) { if (debugEnabled) console.log(...args); }
function debugWarn(...args) { if (debugEnabled) console.warn(...args); }

// Perf tracing collector — mirrors the content-script helper (content/core.js). The
// service worker also gets debugLog-gated console output; the entries land in
// globalThis.__perfTrace for programmatic collection. Background-side marks:
// cache/glossary resolution, per-batch LLM request, response parse, and the
// translate() total.
function perfMark(label, ms, extra) {
    const rounded = Math.round(ms * 10) / 10;
    try {
        (globalThis.__perfTrace = globalThis.__perfTrace || []).push(
            Object.assign({ label, ms: rounded }, extra || {}));
    } catch (e) { /* collector unavailable - console only */ }
    debugLog(`[Perf] ${label}${extra && extra.n !== undefined ? ` (n=${extra.n})` : ''}: ${rounded}ms`);
}

// Small fast non-cryptographic string hash (cyrb53). Folds the prompt shape
// (templates + sampling params) into a compact token for the cache key without
// bloating it with the full template text.
function hashString(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
}

// ============================================================================
// Message Handler
// ============================================================================

// Build a callback that streams per-item results to the requesting tab as they
// finish. Plain-text formats (PLaMo, TranslateGemma, ...) translate item by
// item, so each translation can land on the page long before the batch's
// final response arrives. Callers without a sender tab get no stream.
function makePartialReporter(sender) {
    const tabId = sender && sender.tab && sender.tab.id;
    if (typeof tabId !== 'number') return null;
    return (partial) => {
        try {
            browserAPI.tabs.sendMessage(tabId, { type: 'PARTIAL_TRANSLATION', translations: [partial] })
                .catch(() => { /* tab closed or unloaded mid-run */ });
        } catch (e) { /* never let streaming break translation */ }
    };
}

    root.LctBgCore = {
        browserAPI,
        setDebug,
        debugLog,
        debugWarn,
        perfMark,
        hashString,
        makePartialReporter
    };
})(typeof self !== 'undefined' ? self : globalThis);
