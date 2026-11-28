/**
 * Popup: event-listener wiring for the page controls.
 *
 * A classic script loaded after popup.js; setupEventListeners() is called from
 * the page's init() once settings and pickers are ready.
 */

// Setup event listeners
function setupEventListeners() {
    // Reset the button when the content script signals it's done (e.g. a
    // cache-only run that finishes near-instantly with no progress updates).
    browserAPI.runtime.onMessage.addListener((message) => {
        if (message && message.type === 'TRANSLATION_COMPLETE') {
            resetTranslateButton();
        }
    });

    // Translate button
    elements.translateBtn.addEventListener('click', startTranslation);

    // Cancel button
    elements.cancelBtn.addEventListener('click', cancelTranslation);

    // Restore/Toggle button
    elements.restoreBtn.addEventListener('click', toggleTranslation);

    // YouTube caption translation (only visible on watch pages)
    if (elements.youtubeCaptionBtn) {
        elements.youtubeCaptionBtn.addEventListener('click', toggleYoutubeCaptions);
    }

    // PDF translation (only visible on PDF tabs)
    if (elements.pdfTranslateBtn) {
        elements.pdfTranslateBtn.addEventListener('click', translateThisPdf);
    }
    if (elements.pdfOpenLocalBtn) {
        elements.pdfOpenLocalBtn.addEventListener('click', () => openPdfViewer(null));
    }

    // Bilingual (original + translation) display toggle
    if (elements.youtubeCaptionBilingual) {
        elements.youtubeCaptionBilingual.addEventListener('change', async () => {
            const mode = elements.youtubeCaptionBilingual.checked ? 'bilingual' : 'replace';
            currentSettings = { ...currentSettings, youtubeCaptionMode: mode };
            currentSettings = await settingsClient.save(currentSettings);
            try {
                const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
                if (tab && tab.id && isYoutubeWatchUrl(tab.url)) {
                    await browserAPI.tabs.sendMessage(tab.id, { type: 'SET_YOUTUBE_CAPTION_MODE', mode });
                }
            } catch (e) {
                debugLog('[Popup] Could not push caption mode to tab:', e && e.message);
            }
        });
    }

    // Refresh models
    elements.refreshModels.addEventListener('click', async () => {
        await checkProviders();
        await loadModels(true); // Force refresh, bypass cache
    });

    // (Target-language changes are handled by langPicker.onChange.)
    // (Model changes are handled by modelPicker.onChange.)

    // Open options page
    if (elements.openOptionsHeader) {
        elements.openOptionsHeader.addEventListener('click', () => {
            browserAPI.runtime.openOptionsPage();
        });
    }

    // Open translator page
    const openTranslatorBtn = document.getElementById('openTranslator');
    if (openTranslatorBtn) {
        openTranslatorBtn.addEventListener('click', () => {
            browserAPI.tabs.create({ url: browserAPI.runtime.getURL('translator/translator.html') });
        });
    }

}
