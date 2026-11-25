// Fragment of the Local LLM Translator content script.
//
// Settings wiring: the first GET_SETTINGS call and the storage listener that
// keeps the page in step with the popup/options pages.
//
// Loaded last by CONTENT_SCRIPTS (background/content-injection.js, popup) so
// that everything it touches (currentTargetLanguage, the widget, the floating
// button, the caption bridge) has already been declared by earlier fragments.
// Like the other content/*.js fragments it shares one global scope.

// This fragment declares nothing at top level, so a duplicate injection would
// otherwise send a second GET_SETTINGS and stack a second storage listener.
if (window.__lctStartupWired) throw new Error('startup already wired');
window.__lctStartupWired = true;

browserAPI.runtime.sendMessage({ type: 'GET_SETTINGS' }).then(r => {
    if (r?.settings) {
        debugEnabled = !!r.settings.debug;
        if (r.settings.targetLanguage) currentTargetLanguage = r.settings.targetLanguage;
        applyCaptionMode(r.settings.youtubeCaptionMode);
        floatingButtonEnabled = !!r.settings.floatingButton;
        configureComposeTranslation(r.settings);
        maybeAutoTranslatePage(r.settings);
    }
}).catch(() => {});

// Keep currentTargetLanguage in sync when user changes settings in popup/options
browserAPI.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    const newSettings = changes.settings.newValue;
    const newLang = newSettings?.targetLanguage;
    if (newLang && newLang !== currentTargetLanguage) {
        currentTargetLanguage = newLang;
        updateFloatingBtnTitle();
        // A running caption session is pinned to the language it started with.
        // Rebuild it so already-translated cues are redone into the new one.
        if (captionSession().status().enabled) rebuildCaptionSessionForLanguage(newLang);
    }
    if (typeof newSettings?.floatingButton === 'boolean') {
        floatingButtonEnabled = newSettings.floatingButton;
        if (!floatingButtonEnabled) hideFloatingBtn();
    }
    if (newSettings?.youtubeCaptionMode) {
        applyCaptionMode(newSettings.youtubeCaptionMode);
    }
    configureComposeTranslation(newSettings);
});
