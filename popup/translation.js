/**
 * Popup: page translation controls — status check, start/cancel, the restore
 * toggle, and the translate button state.
 *
 * A classic script loaded after popup.js; uses its globals.
 */

// Check if translation is already running in active tab
async function checkTranslationStatus() {
    try {
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
            const response = await browserAPI.tabs.sendMessage(tab.id, { type: 'GET_TRANSLATION_STATUS' });
            if (response && response.isTranslating) {
                isTranslating = true;
                elements.translateBtn.disabled = true;
                elements.translateBtn.querySelector('.btn-text').hidden = true;
                elements.translateBtn.querySelector('.btn-loading').hidden = false;
                elements.cancelBtn.hidden = false;
            }
        }
    } catch (e) {
        // Content script might not be injected yet, which is fine
    }
}

// Reset the translate button back to its idle state
function resetTranslateButton() {
    isTranslating = false;
    elements.translateBtn.disabled = false;
    elements.translateBtn.querySelector('.btn-text').hidden = false;
    elements.translateBtn.querySelector('.btn-loading').hidden = true;
    elements.cancelBtn.hidden = true;
    elements.restoreBtn.textContent = t('restore.original');
}

// Start translation
async function startTranslation() {
    if (isTranslating) return;

    // --- Pre-flight checks with clear error messages ---
    const model = modelPicker.getValue();
    if (!model) {
        showToast(t('toast.selectModel'), 'error');
        return;
    }

    if (!providersAvailable) {
        showToast(providersBlocked
            ? t('toast.corsBlocked')
            : t('toast.noProvider'), 'error');
        return;
    }

    isTranslating = true;
    elements.translateBtn.disabled = true;
    elements.translateBtn.querySelector('.btn-text').hidden = true;
    elements.translateBtn.querySelector('.btn-loading').hidden = false;
    elements.cancelBtn.hidden = false;

    try {
        // Save settings first
        await saveCurrentSettings();

        // Get current tab
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) {
            throw new Error('No active tab found');
        }

        // Check if page is a restricted URL
        if (tab.url && (tab.url.startsWith('about:') || tab.url.startsWith('chrome:') ||
            tab.url.startsWith('moz-extension:') || tab.url.startsWith('chrome-extension:'))) {
            throw new Error('Cannot translate browser internal pages.');
        }

        // Try to inject content script
        try {
            await browserAPI.scripting.executeScript({
                target: { tabId: tab.id },
                files: CONTENT_SCRIPTS
            });
        } catch (injectErr) {
            debugLog('[Popup] Script injection note:', injectErr.message);
            // May already be injected or page doesn't allow scripts
        }

        // Wait for content script readiness (replaces fragile 100ms delay)
        let scriptReady = false;
        for (let i = 0; i < 15; i++) {
            try {
                const resp = await browserAPI.tabs.sendMessage(tab.id, { type: 'PING' });
                if (resp && resp.pong) {
                    scriptReady = true;
                    break;
                }
            } catch { }
            await new Promise(r => setTimeout(r, 100));
        }

        if (!scriptReady) {
            throw new Error('Could not connect to page. Try refreshing the page first.');
        }

        // Resolve source language: if auto, use the detected language we found earlier
        let finalSourceLang = currentSettings.sourceLanguage;
        if (finalSourceLang === 'auto' && detectedPageLanguage) {
            finalSourceLang = detectedPageLanguage;
        }

        // Send translation message (script is confirmed ready)
        try {
            const response = await browserAPI.tabs.sendMessage(tab.id, {
                type: 'START_TRANSLATION',
                targetLanguage: currentSettings.targetLanguage,
                sourceLanguage: finalSourceLang,
                showGlow: currentSettings.showGlow,
                maxConcurrentRequests: currentSettings.maxConcurrentRequests || 4
            });
            if (response && response.started) {
                return; // Success! UI stays in translating state
            }
        } catch (msgErr) {
            throw new Error('Lost connection to page. Please refresh and try again.');
        }

    } catch (e) {
        console.error('Translation error:', e);
        showToast(t('toast.error', { message: e.message }), 'error');

        // Only reset UI on error
        resetTranslateButton();
    }
}

// Cancel translation
async function cancelTranslation() {
    try {
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
            await browserAPI.tabs.sendMessage(tab.id, { type: 'CANCEL_TRANSLATION' });
        }
    } catch (e) {
        console.error('Cancel error:', e);
    }

    resetTranslateButton();
}

// Toggle translation on/off (uses cached translations if available)
async function toggleTranslation() {
    try {
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        const response = await browserAPI.tabs.sendMessage(tab.id, { type: 'TOGGLE_TRANSLATION' });

        // Update button text based on state
        if (response && response.showing === 'translated') {
            elements.restoreBtn.textContent = t('restore.original');
        } else {
            elements.restoreBtn.textContent = response?.hasCache ? t('restore.translated') : t('restore.restore');
        }
    } catch (e) {
        console.error('Toggle error:', e);
    }
}
