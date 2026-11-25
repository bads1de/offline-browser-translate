// Fragment of the Local LLM Translator content script.
//
// Runtime message router for the popup and background.
//
// Loaded in order by CONTENT_SCRIPTS (background/content-injection.js, popup)
// together with the other content/*.js fragments. They deliberately share one
// global scope, exactly like the single content.js they were split out of: a
// top-level declaration here is visible to every later fragment.


// Injected files can run twice (on-demand injection retries). This fragment
// declares nothing at top level, so abort explicitly instead of stacking a
// second listener that would handle every message twice.
if (window.__lctMessageListenerInstalled) throw new Error('message listener already installed');
window.__lctMessageListenerInstalled = true;

// Listen for messages from background/popup
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // console.log(`[Translator] Received message: ${message.type}`, message);

    switch (message.type) {
        case 'START_TRANSLATION':
            if (message.showGlow !== undefined) showGlow = message.showGlow;
            if (message.maxConcurrentRequests !== undefined) {
                maxConcurrentRequests = Math.max(1, Math.min(32, message.maxConcurrentRequests));
            }
            translatePage(message.targetLanguage, message.sourceLanguage, true);
            sendResponse({ started: true });
            break;

        case 'TRANSLATE_SELECTION':
            if (message.showGlow !== undefined) showGlow = message.showGlow;
            if (message.maxConcurrentRequests !== undefined) {
                maxConcurrentRequests = Math.max(1, Math.min(32, message.maxConcurrentRequests));
            }
            translateSelection(message.targetLanguage, message.sourceLanguage);
            sendResponse({ started: true });
            break;

        case 'SET_GLOW':
            showGlow = message.enabled;
            // Update existing translated elements
            document.querySelectorAll('[data-translated="true"]').forEach(el => {
                el.style.textShadow = showGlow ? '0 0 8px #7FBBB3, 0 0 2px #7FBBB3' : '';
            });
            sendResponse({ showGlow });
            break;

        case 'RESTORE_ORIGINAL':
            restoreOriginalText();
            showToast('Restored original text');
            sendResponse({ restored: true, hasCache: hasTranslationCache });
            break;

        case 'TOGGLE_TRANSLATION':
            // Toggle between translated and original
            if (isShowingTranslations) {
                restoreOriginalText();
                showToast('Showing original text');
                sendResponse({ showing: 'original', hasCache: hasTranslationCache });
            } else if (hasTranslationCache) {
                restoreCachedTranslations();
                showToast('Restored translations');
                sendResponse({ showing: 'translated', hasCache: hasTranslationCache });
            } else {
                sendResponse({ showing: 'original', hasCache: false });
            }
            break;

        case 'TRANSLATE_COMPOSE': {
            // Keyboard shortcut (Alt+T): translate whatever field has the caret.
            // The policy, limits, IME guard, and preview all stay with the
            // compose controller; this only adds a toast for the cases where a
            // click on the trigger would have shown the reason on screen.
            waitForComposeController().then(controller => {
                if (!controller) {
                    showToast('Compose translation is not ready — try again');
                    sendResponse({ ok: false, reason: 'not-ready' });
                    return null;
                }
                if (!controller.status().enabled) {
                    showToast('Compose translation is off — enable it in Settings');
                    sendResponse({ ok: false, reason: 'disabled' });
                    return null;
                }
                return controller.translate().then(result => {
                    if (result && result.ok === false) {
                        const messages = {
                            inactive: 'Click into a text field first',
                            empty: 'Nothing to translate',
                            'same-language': 'Draft is already in the target language',
                            'too-long': 'Draft is too long to translate',
                            composing: 'Finish typing, then try again',
                            loading: 'Already translating',
                            unsupported: 'This editor is not supported'
                        };
                        const text = messages[result.reason];
                        if (text) showToast(text);
                    }
                    sendResponse(result || { ok: false });
                });
            }).catch(error => {
                showToast('Compose translation failed');
                sendResponse({ ok: false, error: String(error) });
            });
            return true;
        }

        case 'TRANSLATION_PROGRESS':
            showToast(message.status);
            sendResponse({ received: true });
            break;

        case 'PARTIAL_TRANSLATION':
            // Streaming apply: the background forwards each item as soon as its
            // single-item translation finishes, so text lands on the page
            // continuously instead of one full batch at a time.
            let applied = 0;
            for (const t of message.translations) {
                if (!t.error && t.text) {
                    if (replaceTextNode(t.id, t.text)) {
                        applied++;
                        if (streamedAppliedCount === 0 && perfRunStartTs) {
                            perfMark('c.first_partial', performance.now() - perfRunStartTs, { n: 1 });
                        }
                        streamedAppliedCount++;
                    }
                }
            }
            if (applied > 0) {
                debugLog(`[Translator] Applied ${applied} partial translations`);
            }
            sendResponse({ applied: true });
            break;

        case 'TOGGLE_AUTO_TRANSLATE':
            if (autoTranslateEnabled) {
                stopAutoTranslate();
                showToast('Auto-translate disabled');
            } else {
                startAutoTranslate(message.targetLanguage || currentTargetLanguage);
                showToast('Auto-translate enabled');
            }
            sendResponse({ autoTranslate: autoTranslateEnabled });
            break;

        case 'CANCEL_TRANSLATION':
            console.log('[Translator] Cancellation requested');
            stopCurrentTranslation();
            sendResponse({ cancelled: true });
            break;

        case 'GET_TRANSLATION_STATUS':
            sendResponse({
                isTranslating: translationInProgress,
                isAutoTranslating: autoTranslateEnabled
            });
            break;

        case 'GET_PAGE_LANGUAGE':
            sendResponse({
                language: getPageLanguage()
            });
            break;

        case 'TOGGLE_YOUTUBE_CAPTIONS':
            (async () => {
                const captions = captionSession();
                try {
                    const state = captions.status();
                    // While an enable() is still loading captions, a second press
                    // means "off": cancel it instead of starting another load.
                    if (state.enabled || state.enabling) {
                        sendResponse(captions.disable({ notify: false }));
                        return;
                    }
                    sendResponse(await captions.enable(message.targetLanguage || currentTargetLanguage));
                } catch (e) {
                    console.error('[Captions] Toggle failed:', e);
                    sendResponse({ ok: false, error: String(e && e.message || e) });
                }
            })();
            return true; // async sendResponse

        case 'SET_YOUTUBE_CAPTION_MODE':
            sendResponse({ ok: true, mode: applyCaptionMode(message.mode) });
            break;

        case 'GET_YOUTUBE_CAPTION_STATUS':
            sendResponse(captionSession().status());
            break;

        case 'PING':
            sendResponse({ pong: true });
            break;

        default:
            sendResponse({ unknown: true });
    }
    return true;
});

console.log('Local LLM Translator content script loaded');

