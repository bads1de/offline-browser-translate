/**
 * Extension lifecycle: first-run setup, context menu and keyboard shortcuts.
 *
 * Exposed as `LctBgLifecycle` on the global object. Loaded by background/entry.js
 * (importScripts) and by manifest `background.scripts` for Firefox.
 */

(function (root) {
    'use strict';
    if (root.LctBgLifecycle) return;
    const { browserAPI, debugLog } = root.LctBgCore;
    const { getSettings } = root.LctBgSettings;
    const { autoDetectAndSelectModel } = root.LctBgProviders;
    const { CONTENT_SCRIPTS, syncContentScriptRegistration, translatePageInTab,
        translateSelectionInTab, toggleTranslationInTab, translateComposeInTab } = root.LctBgContent;

// On browser startup, wipe the translation cache if the user chose the
// 'session' mode (keep until the browser closes). onStartup fires when the
// profile launches but not on extension reload/update, so within-session
// worker restarts don't lose the cache — only a real browser restart does.
browserAPI.runtime.onStartup.addListener(async () => {
    try {
        const settings = await getSettings();
        if (settings.cacheMode === 'session' && typeof cacheClear === 'function') {
            await cacheClear();
        }
    } catch (e) {
        // Best-effort; a failed clear just leaves the previous session's cache.
    }
});
// ============================================================================
// Context Menu
// ============================================================================

browserAPI.runtime.onInstalled.addListener(async () => {
    browserAPI.contextMenus.create({
        id: "translate-page",
        title: "Translate Page",
        contexts: ["page"]
    }, () => { if (browserAPI.runtime.lastError) {} });

    browserAPI.contextMenus.create({
        id: "translate-selection",
        title: "Translate Selection",
        contexts: ["selection"]
    }, () => { if (browserAPI.runtime.lastError) {} });

    browserAPI.contextMenus.create({
        id: "translate-youtube-captions",
        title: "Translate YouTube captions",
        contexts: ["page"],
        documentUrlPatterns: ["https://www.youtube.com/*", "https://m.youtube.com/*", "https://youtube.com/*"]
    }, () => { if (browserAPI.runtime.lastError) {} });

    // Auto-detect and select a model on fresh install (when none is configured yet)
    await autoDetectAndSelectModel();

    // Re-register content script auto-injection if a feature still needs it.
    // registerContentScripts() registrations are cleared on extension update/reinstall.
    await syncContentScriptRegistration();
});

browserAPI.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "translate-page") {
        if (!tab || !tab.id) return;

        try {
            await translatePageInTab(tab.id);
        } catch (e) {
            console.error('[Background] Context menu translation failed:', e);
        }
    } else if (info.menuItemId === "translate-youtube-captions") {
        if (!tab || !tab.id) return;

        try {
            const settings = await getSettings();

            const sendToggleMessage = async () => {
                await browserAPI.tabs.sendMessage(tab.id, {
                    type: 'TOGGLE_YOUTUBE_CAPTIONS',
                    targetLanguage: settings.targetLanguage,
                    mode: settings.youtubeCaptionMode || 'replace'
                });
            };

            try {
                await sendToggleMessage();
            } catch (e) {
                console.log('[Background] Caption toggle message failed, injecting content script:', e);
                await browserAPI.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_SCRIPTS });
                await new Promise(resolve => setTimeout(resolve, 200));
                await sendToggleMessage();
            }

        } catch (e) {
            console.error('[Background] YouTube caption toggle failed:', e);
        }
    } else if (info.menuItemId === "translate-selection") {
        if (!tab || !tab.id) return;

        try {
            await translateSelectionInTab(tab.id);
        } catch (e) {
            console.error('[Background] Context menu selection translation failed:', e);
        }
    }
});

// ============================================================================
// Keyboard shortcuts (commands API)
// ============================================================================

// Commands fire for the active tab; `tab` is present on Chrome and Firefox, but
// query it as a fallback so a stray invocation cannot do nothing silently.
async function activeTabForCommand(tab) {
    if (tab && tab.id) return tab;
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    return tabs && tabs[0];
}

function isRestrictedUrl(url) {
    return !!url && /^(about:|chrome:|chrome-extension:|moz-extension:|edge:|view-source:)/.test(url);
}

if (browserAPI.commands && browserAPI.commands.onCommand) {
    browserAPI.commands.onCommand.addListener(async (command, tab) => {
        const target = await activeTabForCommand(tab);
        if (!target || !target.id) return;
        if (isRestrictedUrl(target.url)) return;

        try {
            switch (command) {
                case 'translate-page':
                    await translatePageInTab(target.id);
                    break;
                case 'toggle-translation':
                    await toggleTranslationInTab(target.id);
                    break;
                case 'translate-selection':
                    await translateSelectionInTab(target.id);
                    break;
                case 'translate-compose':
                    await translateComposeInTab(target.id);
                    break;
                default:
                    debugLog('[Background] Unknown shortcut:', command);
            }
        } catch (e) {
            console.error(`[Background] Shortcut ${command} failed:`, e);
        }
    });
}
})(typeof self !== 'undefined' ? self : globalThis);
