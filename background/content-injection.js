/**
 * Content script registration and the translation entry points shared by the
 * context menu and the keyboard shortcuts.
 *
 * Exposed as `LctBgContent` on the global object. Loaded by background.js
 * (importScripts) and by manifest `background.scripts` for Firefox.
 */

(function (root) {
    'use strict';
    if (root.LctBgContent) return;
    const { browserAPI, debugLog } = root.LctBgCore;
    const { getSettings } = root.LctBgSettings;

// ============================================================================
// Content script auto-injection
//
// Most of the extension works by injecting the content script on demand when the user
// asks for a translation. Proactive features instead need it present before the
// user does anything. Registration is therefore keyed off their union — turning
// one off must not pull the script out from under the others.
// ============================================================================

const CONTENT_SCRIPT_ID = 'llm-translator-content';

// Compose modules must load before the content fragments, which initialize the
// controller. The content/*.js fragments share one global scope and must stay
// in this order. Caption modules attach to window and are wired at the end.
const CONTENT_SCRIPTS = [
    'compose/policy.js',
    'compose/session.js',
    'compose/textarea.js',
    'compose/contenteditable.js',
    'compose/ui.js',
    'compose/controller.js',
    'content/core.js',
    'content/dom.js',
    'content/widget.js',
    'content/page.js',
    'content/messages.js',
    'content/selection.js',
    'content/captions.js',
    'content/startup.js',
    'captions/parser.js',
    'captions/fetcher.js',
    'captions/session.js'
];

function needsContentScript(settings) {
    return !!(settings && (
        settings.floatingButton
        || settings.autoTranslatePages
        || settings.composeTranslationEnabled
    ));
}

async function syncContentScriptRegistration() {
    const settings = await getSettings();
    if (needsContentScript(settings)) {
        try {
            await browserAPI.scripting.registerContentScripts([{
                id: CONTENT_SCRIPT_ID,
                matches: ['http://*/*', 'https://*/*'],
                js: CONTENT_SCRIPTS,
                runAt: 'document_idle'
            }]);
        } catch (e) {
            // Already registered — not an error
        }
        return true;
    }

    try {
        await browserAPI.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
    } catch (e) {
        // Not registered — not an error
    }
    return false;
}

// ============================================================================
// Translation entry points
//
// The context menu and the keyboard shortcuts both land here, so a shortcut
// behaves exactly like the menu item it mirrors.
// ============================================================================

// Resolve 'auto' into the language the page declares, so the model gets a real
// source language instead of guessing.
async function detectTabLanguage(tabId) {
    try {
        const result = await browserAPI.scripting.executeScript({
            target: { tabId },
            func: () => {
                const htmlLang = document.documentElement.lang || document.querySelector('html')?.getAttribute('lang');
                if (htmlLang) return htmlLang.split('-')[0].toLowerCase();
                const metaLang = document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content');
                if (metaLang) return metaLang.split('-')[0].toLowerCase();
                return null;
            }
        });
        return result && result[0] ? result[0].result : null;
    } catch (e) {
        debugLog('[Background] Could not detect page language:', e);
        return null;
    }
}

async function resolveSourceLanguage(tabId, settings) {
    const configured = settings.sourceLanguage;
    if (configured && configured !== 'auto') return configured;
    const detected = await detectTabLanguage(tabId);
    if (detected) debugLog(`[Background] Detected page language: ${detected}`);
    return detected || 'auto';
}

// The content script is only registered up front when a page-wide feature is
// on, so every entry point has to be able to inject it on demand.
async function sendToContent(tabId, message) {
    try {
        return await browserAPI.tabs.sendMessage(tabId, message);
    } catch (e) {
        debugLog('[Background] Content script not ready, injecting:', e);
        await browserAPI.scripting.executeScript({ target: { tabId }, files: CONTENT_SCRIPTS });
        await new Promise(resolve => setTimeout(resolve, 200));
        return browserAPI.tabs.sendMessage(tabId, message);
    }
}

async function translatePageInTab(tabId) {
    const settings = await getSettings();
    return sendToContent(tabId, {
        type: 'START_TRANSLATION',
        targetLanguage: settings.targetLanguage,
        sourceLanguage: await resolveSourceLanguage(tabId, settings),
        showGlow: settings.showGlow,
        maxConcurrentRequests: settings.maxConcurrentRequests || 4
    });
}

async function translateSelectionInTab(tabId) {
    const settings = await getSettings();
    return sendToContent(tabId, {
        type: 'TRANSLATE_SELECTION',
        targetLanguage: settings.targetLanguage,
        sourceLanguage: await resolveSourceLanguage(tabId, settings),
        showGlow: settings.showGlow,
        maxConcurrentRequests: settings.maxConcurrentRequests || 4
    });
}

// Alt+B: translated <-> original. With nothing translated and no cache there is
// nothing to switch back to, so start a run instead of doing nothing.
async function toggleTranslationInTab(tabId) {
    const response = await sendToContent(tabId, { type: 'TOGGLE_TRANSLATION' });
    if (response && response.showing === 'original' && !response.hasCache) {
        return translatePageInTab(tabId);
    }
    return response;
}

// Alt+T: translate the field the caret is in. The compose feature owns the
// policy (eligibility, limits, IME) and falls back to a toast when it is off.
async function translateComposeInTab(tabId) {
    return sendToContent(tabId, { type: 'TRANSLATE_COMPOSE' });
}


    root.LctBgContent = {
        CONTENT_SCRIPTS,
        needsContentScript,
        syncContentScriptRegistration,
        sendToContent,
        detectTabLanguage,
        resolveSourceLanguage,
        translatePageInTab,
        translateSelectionInTab,
        toggleTranslationInTab,
        translateComposeInTab
    };
})(typeof self !== 'undefined' ? self : globalThis);
