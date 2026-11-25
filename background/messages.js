/**
 * Runtime message router for every feature that talks to the background.
 *
 * Exposed as `LctBgMessages` on the global object. Loaded by background.js
 * (importScripts) and by manifest `background.scripts` for Firefox.
 */

(function (root) {
    'use strict';
    if (root.LctBgMessages) return;
    const { browserAPI, makePartialReporter } = root.LctBgCore;
    const { getSettings, saveSettings } = root.LctBgSettings;
    const { detectProviders, listModels, detectModelProvider, getLMStudioModelState,
        autoDetectAndSelectModel } = root.LctBgProviders;
    const { GLOSSARY_KEY, GLOSSARY_META_KEY, GLOSSARY_PREVIEW_MAX, loadGlossary,
        invalidateGlossary } = root.LctBgGlossary;
    const { translate } = root.LctBgTranslate;
    const { syncContentScriptRegistration } = root.LctBgContent;
    const { getPlayerCaptionsFromPage, captureCaptionsViaPlayer, fetchTimedtextInPage } = root.LctBgCaptions;
    const { probePdf, fetchPdf } = root.LctBgPdf;

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // console.log('[Background] Received message:', message.type);

    (async () => {
        try {
            const settings = await getSettings();

            switch (message.type) {
                case 'GET_SETTINGS':
                    sendResponse({ settings });
                    break;

                case 'SAVE_SETTINGS':
                    const saved = await saveSettings(message.settings);
                    sendResponse({ settings: saved });
                    break;

                case 'DETECT_PROVIDERS':
                    const providers = await detectProviders(
                        settings.ollamaUrl,
                        settings.lmstudioUrl,
                        settings.provider
                    );
                    sendResponse(providers);
                    break;

                case 'LIST_MODELS':
                    // Pass forceRefresh to bypass cache when user clicks refresh
                    const models = await listModels(settings, !message.forceRefresh);
                    sendResponse({ models });
                    break;

                case 'SYNC_CONTENT_SCRIPT': {
                    // Register or unregister based on the *current* settings, so
                    // callers only have to save their setting and ask for a sync.
                    const registered = await syncContentScriptRegistration();
                    sendResponse({ ok: true, registered });
                    break;
                }

                case 'ADD_AUTO_TRANSLATE_NEVER_SITE': {
                    // Sent from the on-page widget's "Ignore site" button.
                    const host = typeof message.hostname === 'string' ? message.hostname.trim().toLowerCase() : '';
                    if (!host) {
                        sendResponse({ ok: false });
                        break;
                    }
                    const current = await getSettings();
                    const sites = Array.isArray(current.autoTranslateNeverSites)
                        ? [...current.autoTranslateNeverSites]
                        : [];
                    if (!sites.includes(host)) sites.push(host);
                    await saveSettings({ autoTranslateNeverSites: sites });
                    sendResponse({ ok: true, sites });
                    break;
                }

                case 'GET_MODEL_STATE': {
                    if (!settings.selectedModel) { sendResponse({ state: null }); break; }
                    const provider = await detectModelProvider(settings.selectedModel, settings);
                    if (provider !== 'lmstudio') { sendResponse({ state: null }); break; }
                    const state = await getLMStudioModelState(settings.lmstudioUrl, settings.selectedModel);
                    sendResponse({ state });
                    break;
                }

                case 'GET_PLAYER_CAPTIONS': {
                    try {
                        const tabId = sender && sender.tab && sender.tab.id;
                        const payload = await getPlayerCaptionsFromPage(tabId);
                        sendResponse(payload);
                    } catch (e) {
                        sendResponse({ error: e && e.message || String(e) });
                    }
                    break;
                }

                case 'CAPTURE_PLAYER_CAPTIONS': {
                    try {
                        const tabId = sender && sender.tab && sender.tab.id;
                        const responses = await captureCaptionsViaPlayer(tabId, message.track || null);
                        sendResponse({ ok: responses.length > 0, responses });
                    } catch (e) {
                        sendResponse({ ok: false, responses: [], error: e && e.message || String(e) });
                    }
                    break;
                }

                case 'FETCH_TIMEDTEXT': {
                    try {
                        const tabId = sender && sender.tab && sender.tab.id;
                        const payload = await fetchTimedtextInPage(tabId, message.url);
                        sendResponse(payload);
                    } catch (e) {
                        sendResponse({ ok: false, status: 0, text: '', error: e && e.message || String(e) });
                    }
                    break;
                }

                case 'PROBE_PDF': {
                    // FR-12: HEAD-probe a URL so the popup can show the PDF button
                    // on extensionless URLs that serve application/pdf.
                    sendResponse(await probePdf(message.url));
                    break;
                }

                case 'FETCH_PDF': {
                    // FR-1: fetch the PDF bytes with the activeTab grant (invoked
                    // from the popup click) and park them in IndexedDB for the
                    // viewer page. Never send bytes back through the message.
                    sendResponse(await fetchPdf(message.url, message.name));
                    break;
                }


                case 'TRANSLATE':
                    // Pass sourceLanguage for TranslateGemma support
                    let settingsWithSource = {
                        ...settings,
                        sourceLanguage: message.sourceLanguage || settings.sourceLanguage || 'en'
                    };

                    // WARNING LOG: Check if source language is missing or 'auto'
                    if (!settingsWithSource.sourceLanguage || settingsWithSource.sourceLanguage === 'auto') {
                        console.warn('[Background] WARNING: Source language is "auto" or missing. Some models (like TranslateGemma) require a specific source language code to function correctly.');
                    }

                    // Auto-detect model if none selected (e.g. fresh install, providers not ready at install time)
                    if (!settingsWithSource.selectedModel) {
                        await autoDetectAndSelectModel();
                        const refreshed = await getSettings();
                        settingsWithSource = {
                            ...settingsWithSource,
                            selectedModel: refreshed.selectedModel,
                            provider: refreshed.provider,
                            requestFormat: refreshed.requestFormat
                        };
                    }

                    const result = await translate(
                        message.texts,
                        message.targetLanguage,
                        settingsWithSource,
                        message.silentPartials ? null : makePartialReporter(sender)
                    );
                    sendResponse({
                        translations: result.translations,
                        fromCache: result.fromCache,
                        total: result.total,
                        cacheActive: result.cacheActive
                    });
                    break;

                case 'CLEAR_CACHE':
                    try {
                        await cacheClear();
                        sendResponse({ ok: true });
                    } catch (e) {
                        sendResponse({ ok: false, error: e && e.message });
                    }
                    break;

                case 'CACHE_COUNT':
                    try {
                        sendResponse({ count: await cacheCount() });
                    } catch (e) {
                        sendResponse({ count: 0, error: e && e.message });
                    }
                    break;

                case 'CACHE_BACKEND':
                    try {
                        sendResponse({ persistent: await cachePersistentAvailable() });
                    } catch (e) {
                        sendResponse({ persistent: false, error: e && e.message });
                    }
                    break;

                case 'SAVE_GLOSSARY': {
                    // entries: Array<[source, target]> already parsed by the options page.
                    const entries = Array.isArray(message.entries) ? message.entries : [];
                    const meta = {
                        name: typeof message.name === 'string' ? message.name : '',
                        // Target language declared by a '#target: xx' line in the
                        // TSV; '' means the glossary applies to any target language.
                        target: typeof message.target === 'string' ? message.target.split('-')[0].toLowerCase() : '',
                        loadedAt: Date.now()
                    };
                    await browserAPI.storage.local.set({ [GLOSSARY_KEY]: entries, [GLOSSARY_META_KEY]: meta });
                    invalidateGlossary();
                    // Glossary changes the output for the same source text — drop stale cache.
                    if (typeof cacheClear === 'function') await cacheClear();
                    sendResponse({ ok: true, count: entries.length });
                    break;
                }

                case 'GET_GLOSSARY_INFO': {
                    const entries = await loadGlossary();
                    let meta = null;
                    try {
                        const result = await browserAPI.storage.local.get(GLOSSARY_META_KEY);
                        meta = result[GLOSSARY_META_KEY] || null;
                    } catch (e) { /* meta is cosmetic — count/preview still work */ }
                    sendResponse({
                        count: entries.length,
                        name: meta && meta.name || '',
                        target: meta && meta.target || '',
                        loadedAt: meta && meta.loadedAt || null,
                        // First rows only: enough to eyeball the dictionary without
                        // shipping tens of thousands of pairs to the options page.
                        preview: entries.slice(0, GLOSSARY_PREVIEW_MAX)
                    });
                    break;
                }

                case 'GET_GLOSSARY_ENTRIES': {
                    // Full dictionary, for the inline editor. GET_GLOSSARY_INFO's
                    // preview is truncated and must never be used as the editor's
                    // working copy — saving it back would drop every term past
                    // GLOSSARY_PREVIEW_MAX.
                    const entries = await loadGlossary();
                    let meta = null;
                    try {
                        const result = await browserAPI.storage.local.get(GLOSSARY_META_KEY);
                        meta = result[GLOSSARY_META_KEY] || null;
                    } catch (e) { /* meta is cosmetic */ }
                    sendResponse({
                        entries,
                        name: meta && meta.name || '',
                        target: meta && meta.target || ''
                    });
                    break;
                }

                case 'CLEAR_GLOSSARY':
                    await browserAPI.storage.local.remove([GLOSSARY_KEY, GLOSSARY_META_KEY]);
                    invalidateGlossary();
                    if (typeof cacheClear === 'function') await cacheClear();
                    sendResponse({ ok: true });
                    break;

                default:
                    sendResponse({ error: 'Unknown message type' });
            }
        } catch (e) {
            console.error('[Background] Error:', e);
            sendResponse({ error: e.message });
        }
    })();

    return true; // Keep the message channel open for async response
});
})(typeof self !== 'undefined' ? self : globalThis);
