/**
 * Popup: YouTube caption translation button and its display-mode toggle.
 *
 * A classic script loaded after popup.js; uses its globals.
 */

// Toggle YouTube caption translation (FR-1)
function isYoutubeWatchUrl(url) {
    return !!url && /^https:\/\/(www\.|m\.)?youtube\.com\/watch/.test(url);
}

let youtubeCaptionsActive = false;

function setCaptionButtonState(active, busy = false) {
    const btn = elements.youtubeCaptionBtn;
    if (!btn) return;
    youtubeCaptionsActive = active;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    btn.classList.toggle('active', active);
    btn.textContent = t(busy ? 'youtube.captionLoading' : (active ? 'youtube.captionOn' : 'youtube.captionOff'));
    // The display-mode choice only applies while captions are being translated.
    if (elements.youtubeCaptionModeRow) elements.youtubeCaptionModeRow.hidden = !active && !busy;
}

// Only shown on YouTube watch pages; keeps the popup unchanged elsewhere.
async function refreshYoutubeCaptionButton() {
    const btn = elements.youtubeCaptionBtn;
    if (!btn) return false;
    try {
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (!tab || !isYoutubeWatchUrl(tab.url)) {
            btn.hidden = true;
            if (elements.youtubeCaptionModeRow) elements.youtubeCaptionModeRow.hidden = true;
            return false;
        }
        btn.hidden = false;
        // Only ask if the content script is already resident — do not inject
        // just because the popup was opened on a YouTube tab.
        let active = false;
        let busy = false;
        try {
            const status = await browserAPI.tabs.sendMessage(tab.id, { type: 'GET_YOUTUBE_CAPTION_STATUS' });
            active = !!(status && status.enabled);
            // Captions still loading: show progress, and a press will cancel it.
            busy = !active && !!(status && status.enabling);
        } catch (e) {
            debugLog('[Popup] Caption status check (not injected yet):', e && e.message);
        }
        setCaptionButtonState(active || busy, busy);
        return true;
    } catch (e) {
        btn.hidden = true;
        return false;
    }
}

async function toggleYoutubeCaptions() {
    const model = modelPicker.getValue();
    if (!model) {
        showToast(t('toast.selectModel'), 'error');
        return;
    }
    if (!providersAvailable) {
        showToast(providersBlocked ? t('toast.corsBlocked') : t('toast.noProvider'), 'error');
        return;
    }

    await saveCurrentSettings();

    const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !isYoutubeWatchUrl(tab.url)) {
        showToast(t('toast.youtubeOnly'), 'error');
        return;
    }

    // Inject content script (same pattern as startTranslation)
    try {
        await browserAPI.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_SCRIPTS });
    } catch (e) {
        debugLog('[Popup] Caption toggle injection note:', e && e.message);
    }
    for (let i = 0; i < 15; i++) {
        try {
            const resp = await browserAPI.tabs.sendMessage(tab.id, { type: 'PING' });
            if (resp && resp.pong) break;
        } catch { }
        await new Promise(r => setTimeout(r, 100));
    }

    // Turning captions on can take a moment (track list + cue fetch); show the
    // pending state instead of leaving the button on "Translate".
    const wasActive = youtubeCaptionsActive;
    if (!wasActive) setCaptionButtonState(true, true);

    let response;
    try {
        response = await browserAPI.tabs.sendMessage(tab.id, {
            type: 'TOGGLE_YOUTUBE_CAPTIONS',
            targetLanguage: currentSettings.targetLanguage,
            mode: currentSettings.youtubeCaptionMode || 'replace'
        });
    } catch (e) {
        setCaptionButtonState(wasActive);
        showToast(t('toast.youtubeFail', { message: e.message }), 'error');
        return;
    }

    if (!response || response.ok === false) {
        // The content script already returns a user-facing sentence, so show it
        // directly rather than wrapping it in the generic failure toast.
        setCaptionButtonState(wasActive);
        const detail = response && response.error;
        showToast(detail || t('toast.youtubeFail', { message: 'unknown error' }), 'error', 5000);
        return;
    }
    if (response.enabled) {
        setCaptionButtonState(true);
        showToast(t('toast.youtubeOn'));
    } else {
        setCaptionButtonState(false);
        showToast(t('toast.youtubeOff'));
    }
}
