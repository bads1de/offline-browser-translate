/**
 * Cached settings shared by every background feature.
 *
 * Exposed as `LctBgSettings` on the global object. Loaded by background/entry.js
 * (importScripts) and by manifest `background.scripts` for Firefox.
 */

(function (root) {
    'use strict';
    if (root.LctBgSettings) return;
    const { browserAPI, setDebug } = root.LctBgCore;

let cachedSettings = null;

// ============================================================================
// Settings Management
// ============================================================================

async function loadSettings() {
    try {
        const result = await browserAPI.storage.local.get('settings');
        cachedSettings = { ...DEFAULT_SETTINGS, ...result.settings };
        // Settings stored by an older version may still name the removed
        // built-in WebGPU engine. Map it to auto-detect so the extension
        // keeps working instead of selecting a dead model.
        if (!['auto', 'ollama', 'lmstudio'].includes(cachedSettings.provider)) {
            cachedSettings.provider = 'auto';
        }
        setDebug(cachedSettings.debug);
        return cachedSettings;
    } catch (e) {
        console.error('Failed to load settings:', e);
        cachedSettings = { ...DEFAULT_SETTINGS };
        return cachedSettings;
    }
}

async function saveSettings(settings) {
    // Merge defaults < cached < new so fields unknown to the caller are preserved
    cachedSettings = { ...DEFAULT_SETTINGS, ...cachedSettings, ...settings };
    // Same guard as loadSettings: never persist the removed built-in provider.
    if (!['auto', 'ollama', 'lmstudio'].includes(cachedSettings.provider)) {
        cachedSettings.provider = 'auto';
    }
    setDebug(cachedSettings.debug);
    // Any settings save may change the provider or server URLs — drop the
    // model-list cache so the next LIST_MODELS re-probes the new backend.
    root.LctBgProviders.invalidateModelCache();
    await browserAPI.storage.local.set({ settings: cachedSettings });
    return cachedSettings;
}

async function getSettings() {
    if (!cachedSettings) {
        return loadSettings();
    }
    return cachedSettings;
}

    root.LctBgSettings = {
        loadSettings,
        saveSettings,
        getSettings
    };
})(typeof self !== 'undefined' ? self : globalThis);
