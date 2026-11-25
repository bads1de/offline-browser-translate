// Fragment of the Local LLM Translator content script.
//
// Glue between the content script and captions/ (bridge, toast, mode).
//
// Loaded in order by CONTENT_SCRIPTS (background/content-injection.js, popup)
// together with the other content/*.js fragments. They deliberately share one
// global scope, exactly like the single content.js they were split out of: a
// top-level declaration here is visible to every later fragment.

// ============================================================================
// YouTube captions: the feature itself lives in captions/ (parser, fetcher,
// session). This is the only glue it needs from the page script.
// ============================================================================

window.LctCaptionDebugEnabled = false;
window.LctBridge = {
    send: (message) => browserAPI.runtime.sendMessage(message),
    toast: (text) => showToast(text)
};

function captionSession() {
    return window.LctCaptionSession;
}

// Keeps the session's display mode in step with the saved setting.
function applyCaptionMode(mode) {
    const next = mode === 'bilingual' ? 'bilingual' : 'replace';
    if (window.LctCaptionSession) window.LctCaptionSession.setMode(next);
    return next;
}

function rebuildCaptionSessionForLanguage(language) {
    if (window.LctCaptionSession) window.LctCaptionSession.rebuildForLanguage(language);
}

