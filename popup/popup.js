/**
 * Popup Script for Local LLM Translator
 */

// Use browser API with chrome fallback for Firefox compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
const settingsClient = SettingsClient.createSettingsClient(browserAPI);

// Injected in this order; must match background.js CONTENT_SCRIPTS.
const CONTENT_SCRIPTS = [
    '/compose/policy.js',
    '/compose/session.js',
    '/compose/textarea.js',
    '/compose/contenteditable.js',
    '/compose/ui.js',
    '/compose/controller.js',
    '/content.js',
    '/captions/parser.js',
    '/captions/fetcher.js',
    '/captions/session.js'
];

// DEFAULT_SETTINGS lives in ../settings.js, shared with the other pages.

// DOM Elements
const elements = {
    providerStatus: document.getElementById('providerStatus'),
    modelPickerEl: document.getElementById('modelPickerEl'),
    modelTrigger: document.getElementById('modelTrigger'),
    modelTriggerLabel: document.getElementById('modelTriggerLabel'),
    modelMenu: document.getElementById('modelMenu'),
    modelSearch: document.getElementById('modelSearch'),
    modelList: document.getElementById('modelList'),
    refreshModels: document.getElementById('refreshModels'),
    youtubeCaptionBtn: document.getElementById('youtubeCaptionBtn'),
    youtubeCaptionBilingual: document.getElementById('youtubeCaptionBilingual'),
    youtubeCaptionModeRow: document.getElementById('youtubeCaptionModeRow'),
    pdfTranslateBtn: document.getElementById('pdfTranslateBtn'),
    pdfOpenLocalBtn: document.getElementById('pdfOpenLocalBtn'),
    languagePicker: document.getElementById('languagePicker'),
    langTrigger: document.getElementById('langTrigger'),
    langTriggerLabel: document.getElementById('langTriggerLabel'),
    langMenu: document.getElementById('langMenu'),
    langSearch: document.getElementById('langSearch'),
    langList: document.getElementById('langList'),
    sourceLangGroup: document.getElementById('sourceLangGroup'),
    detectedLang: document.getElementById('detectedLang'),
    sourceLangOverride: document.getElementById('sourceLangOverride'),
    translateBtn: document.getElementById('translateBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    restoreBtn: document.getElementById('restoreBtn'),
    openOptionsHeader: document.getElementById('openOptionsHeader'),
    toast: document.getElementById('toast')
};

let currentSettings = { ...DEFAULT_SETTINGS };
function debugLog(...args) { if (currentSettings.debug) console.log(...args); }
let isTranslating = false;
let detectedPageLanguage = 'en';

// Detect page language from active tab (using programmatic injection)
async function detectPageLanguage() {
    if (elements.detectedLang) {
        elements.detectedLang.textContent = t('status.detecting');
    }

    try {
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
            // DIRECT INJECTION: Read language without requiring content script
            const result = await browserAPI.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // Try HTML lang attribute
                    const htmlLang = document.documentElement.lang || document.querySelector('html')?.getAttribute('lang');
                    if (htmlLang) return htmlLang.split('-')[0].toLowerCase();

                    // Try meta tag
                    const metaLang = document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content');
                    if (metaLang) return metaLang.split('-')[0].toLowerCase();

                    return 'en'; // Default
                }
            });

            if (result && result[0] && result[0].result) {
                detectedPageLanguage = result[0].result;
                if (elements.detectedLang) {
                    const langName = LANGUAGES[detectedPageLanguage] || detectedPageLanguage.toUpperCase();
                    elements.detectedLang.textContent = langName;
                }
            } else {
                throw new Error('No result from script');
            }
        }
    } catch (e) {
        console.error('Language detection failed:', e);
        if (elements.detectedLang) {
            elements.detectedLang.textContent = t('status.unknown');
        }
    }
}

// Populate source language override dropdown
function populateSourceLangOverride() {
    if (!elements.sourceLangOverride) return;

    elements.sourceLangOverride.replaceChildren();
    const autoOption = document.createElement('option');
    autoOption.value = 'auto';
    autoOption.textContent = t('sourceLang.useDetected');
    elements.sourceLangOverride.appendChild(autoOption);
    const sortedLangs = Object.entries(LANGUAGES).sort((a, b) => a[1].localeCompare(b[1]));

    for (const [code, name] of sortedLangs) {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = name;
        elements.sourceLangOverride.appendChild(option);
    }
}

// Show toast notification
function showToast(message, type = 'success', duration = 3000) {
    const toast = elements.toast;
    const icon = toast.querySelector('.toast-icon');
    const msg = toast.querySelector('.toast-message');

    icon.textContent = type === 'success' ? '✅' : '❌';
    msg.textContent = message;

    if (type === 'error') {
        toast.style.borderColor = 'var(--red)';
        toast.style.color = 'var(--red)';
    } else {
        toast.style.borderColor = 'var(--accent)';
        toast.style.color = 'var(--accent)';
    }

    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// ============================================================================
// UI language — the popup follows the language chosen on the settings page
// (settings.uiLanguage: 'auto' resolves from the browser locale). Static HTML
// is painted in the detected locale when popup-i18n.js loads; once settings
// arrive we resolve the saved preference and, if it differs, re-paint.
// ============================================================================

function resolvePopupUiLanguage() {
    if (currentSettings.uiLanguage === 'ja' || currentSettings.uiLanguage === 'en') {
        return currentSettings.uiLanguage;
    }
    return detectUiLanguage();
}

// Re-render the pieces whose text is computed in JS (static HTML is covered
// by applyI18nStatic). applySettingsToUI() runs right after this in init(),
// so values overwritten here get restored from settings.
function refreshI18nDynamic() {
    langPicker.setValue(langPicker.getValue());
    if (modelPicker.getValue()) modelPicker.setValue(modelPicker.getValue());
    populateSourceLangOverride();
    elements.restoreBtn.textContent = t('restore.original');
}

// Initialize popup
async function init() {
    populateLanguageDropdown();
    initModelPicker();
    populateSourceLangOverride();
    await loadSettings();
    setUiLanguage(resolvePopupUiLanguage());
    applyI18nStatic();
    refreshI18nDynamic();
    applySettingsToUI();
    setupEventListeners();
    await checkProviders();
    await loadModels();
    await checkTranslationStatus();
    await detectPageLanguage();
    await refreshYoutubeCaptionButton();
    await refreshPdfButtons();
}

// createPicker() lives in ../picker.js, shared with the options page.

// Target-language picker: items are [code, name] entries from LANGUAGES.
const langPicker = createPicker({
    els: {
        picker: elements.languagePicker,
        trigger: elements.langTrigger,
        label: elements.langTriggerLabel,
        menu: elements.langMenu,
        search: elements.langSearch,
        list: elements.langList,
    },
    getItems: () => Object.entries(LANGUAGES),
    getId: (entry) => entry[0],
    getName: (entry) => entry[1],
    pinnedGroupLabel: () => t('picker.pinned'),
    restGroupLabel: () => t('picker.allLanguages'),
    emptyText: () => t('picker.noLangMatch'),
    labelFor: (code) => LANGUAGES[code] || code,
    isValidId: (code) => !!LANGUAGES[code],
    initialValue: 'en',
});

// Model picker: items are { id, name, provider } objects loaded from providers.
// allModels lives on the instance and feeds getItems(); model-specific helpers
// (setModels / getSelectedProvider) are attached after creation.
const modelPicker = createPicker({
    els: {
        picker: elements.modelPickerEl,
        trigger: elements.modelTrigger,
        label: elements.modelTriggerLabel,
        menu: elements.modelMenu,
        search: elements.modelSearch,
        list: elements.modelList,
    },
    getItems: () => modelPicker.allModels,
    getId: (m) => m.id,
    getName: (m) => m.name,
    pinnedGroupLabel: () => t('picker.pinned'),
    restGroupLabel: () => t('picker.allModels'),
    emptyText: () => modelPicker.allModels.length === 0 ? t('picker.noModels') : t('picker.noModelMatch'),
    labelFor: (id) => {
        const m = modelPicker.allModels.find(x => x.id === id);
        return m ? m.name : (id || t('model.select'));
    },
    decorateOption: (li, m) => {
        const badge = document.createElement('span');
        badge.className = `model-provider-badge model-provider-badge--${m.provider}`;
        badge.textContent = m.provider;
        li.appendChild(badge);
    },
});

modelPicker.allModels = [];

modelPicker.getSelectedProvider = function () {
    const m = this.allModels.find(x => x.id === this.value);
    return m ? m.provider : null;
};

modelPicker.setModels = function (models) {
    this.allModels = models;
    // Drop pinned ids that no longer exist in the model list
    const ids = new Set(models.map(m => m.id));
    this.pinned = this.pinned.filter(id => ids.has(id));
};

// Initialize the model picker and wire it to settings persistence.
function initModelPicker() {
    modelPicker.onChange = (id) => {
        currentSettings.selectedModel = id;
        saveCurrentSettings();
        updateProviderStatusUI();
    };
    modelPicker.onPinnedChange = (pinned) => {
        currentSettings.pinnedModels = pinned;
        saveCurrentSettings();
    };
    modelPicker.init();
}

// Initialize the language picker and wire it to settings persistence.
function populateLanguageDropdown() {
    langPicker.onChange = (code) => {
        currentSettings.targetLanguage = code;
        saveCurrentSettings();
    };
    langPicker.onPinnedChange = (pinned) => {
        currentSettings.pinnedLanguages = pinned;
        saveCurrentSettings();
    };
    langPicker.init();
}

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

// Load settings from storage
async function loadSettings() {
    try {
        const settings = await settingsClient.load();
        currentSettings = { ...DEFAULT_SETTINGS, ...settings };
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
}

// Apply settings to UI
function applySettingsToUI() {
    langPicker.setPinned(currentSettings.pinnedLanguages || []);
    langPicker.setValue(currentSettings.targetLanguage);
    modelPicker.setPinned(currentSettings.pinnedModels || []);

    // Restore source language override
    if (elements.sourceLangOverride && currentSettings.sourceLanguage) {
        elements.sourceLangOverride.value = currentSettings.sourceLanguage;
    }
    // Restore YouTube caption display mode
    if (elements.youtubeCaptionBilingual) {
        elements.youtubeCaptionBilingual.checked = currentSettings.youtubeCaptionMode === 'bilingual';
    }
}

// Check which providers are available
let providersAvailable = false;
let providersBlocked = false;
let lastProviderDetect = null;

async function checkProviders() {
    const statusWrapper = elements.providerStatus;
    const statusDot = statusWrapper.querySelector('.status-dot');

    try {
        lastProviderDetect = await browserAPI.runtime.sendMessage({ type: 'DETECT_PROVIDERS' });
        updateProviderStatusUI();
    } catch (e) {
        lastProviderDetect = null;
        statusDot.className = 'status-dot error';
        statusWrapper.title = t('status.checkError');
        providersAvailable = false;
        providersBlocked = false;
        showSetupBanner();
    }
}

// Resolve the status dot, setup banner, and Translate button from the last
// detection result and the currently selected model's provider. Called again
// on model selection, so picking a model whose provider is unreachable or
// CORS-blocked updates the UI without another probe.
function updateProviderStatusUI() {
    const providerSetting = currentSettings.provider;
    if (!lastProviderDetect) return;
    const response = lastProviderDetect;
    const statusWrapper = elements.providerStatus;
    const statusDot = statusWrapper.querySelector('.status-dot');

    // Resolve active provider using setting or currently selected model's provider
    const selectedModelProvider = modelPicker.getSelectedProvider();

    let activeProvider = providerSetting;
    if (activeProvider === 'auto' && selectedModelProvider) {
        activeProvider = selectedModelProvider;
    }

    let connected = false;
    let blocked = false;
    let blockedType = ''; // 'ollama' or 'lmstudio'
    const connectedProviders = [];

    if (response.ollama) connectedProviders.push('Ollama');
    if (response.lmstudio) connectedProviders.push('LMStudio');

    if (activeProvider === 'ollama') {
        connected = response.ollama;
        blocked = response.ollama_blocked;
        blockedType = 'ollama';
    } else if (activeProvider === 'lmstudio') {
        connected = response.lmstudio;
        blocked = response.lmstudio_blocked;
        blockedType = 'lmstudio';
    } else {
        // 'auto' mode with no specific model selected yet
        connected = connectedProviders.length > 0;
        if (!connected) {
            blocked = response.ollama_blocked || response.lmstudio_blocked;
            blockedType = response.ollama_blocked ? 'ollama' : 'lmstudio';
        }
    }

    providersBlocked = blocked;

    if (connected) {
        statusDot.className = 'status-dot connected';
        statusWrapper.title = t('status.connected', { providers: connectedProviders.join(', ') });
        providersAvailable = true;
        hideSetupBanner();
    } else if (blocked) {
        statusDot.className = 'status-dot error';
        statusWrapper.title = blockedType === 'ollama'
            ? t('status.corsOllama')
            : t('status.corsLmstudio');
        providersAvailable = false;
        showSetupBanner(blockedType === 'ollama' ? 'cors-blocked-ollama' : 'cors-blocked-lmstudio');
    } else {
        statusDot.className = 'status-dot error';
        statusWrapper.title = t('status.noProviders');
        providersAvailable = false;
        showSetupBanner();
    }

    // Keep the Translate button in sync once models are loaded; until then
    // loadModels controls it. Leave it alone mid-translation.
    if (!isTranslating && modelPicker.allModels.length > 0) {
        elements.translateBtn.disabled = !providersAvailable;
    }
}

// Banner copy lives in the popup i18n dictionary (keys banner.*) because the
// variants carry their own markup; the strings are our own, so innerHTML use
// here is unchanged from before.
function bannerHTML(type) {
    if (type === 'no-models') return t('banner.noModels');
    if (type === 'cors-blocked-ollama') return t('banner.corsOllama');
    if (type === 'cors-blocked-lmstudio') return t('banner.corsLmstudio');
    return t('banner.noProvider');
}

// Show/hide first-run setup guidance banner
function showSetupBanner(type = 'no-provider') {
    let banner = document.getElementById('setup-banner');
    if (banner) {
        banner.hidden = false;
        // Update content if it already exists
        banner.innerHTML = bannerHTML(type);
        return;
    }

    banner = document.createElement('div');
    banner.id = 'setup-banner';
    banner.style.cssText = `
        background: var(--bg3, #3a3a3a);
        border: 1px solid var(--yellow, #dbbc7f);
        border-radius: 8px;
        padding: 10px 14px;
        margin: 8px 0;
        font-size: 12px;
        line-height: 1.5;
        color: var(--fg, #d3c6aa);
    `;
    banner.innerHTML = bannerHTML(type);

    // Insert after the model selector row
    const modelRow = elements.modelPickerEl?.closest('.row') || elements.modelPickerEl?.parentElement;
    if (modelRow) {
        modelRow.parentNode.insertBefore(banner, modelRow.nextSibling);
    } else {
        document.querySelector('.popup-body, .container, body')?.prepend(banner);
    }
}

function hideSetupBanner() {
    const banner = document.getElementById('setup-banner');
    if (banner && providersAvailable) banner.hidden = true;
}

// Load available models
async function loadModels(forceRefresh = false) {
    elements.modelTrigger.disabled = true;
    elements.modelTriggerLabel.textContent = t('model.loading');

    try {
        const response = await browserAPI.runtime.sendMessage({ type: 'LIST_MODELS', forceRefresh });
        const models = response.models || [];

        if (models.length === 0) {
            modelPicker.setModels([]);
            elements.modelTriggerLabel.textContent = t('model.noneFound');
            elements.modelTrigger.disabled = false;
            if (providersAvailable) {
                // If any provider is blocked by CORS, prioritize showing the CORS banner
                const detectResponse = await browserAPI.runtime.sendMessage({ type: 'DETECT_PROVIDERS' }).catch(() => ({}));
                if (detectResponse.ollama_blocked || detectResponse.lmstudio_blocked) {
                    showSetupBanner(detectResponse.ollama_blocked ? 'cors-blocked-ollama' : 'cors-blocked-lmstudio');
                } else {
                    showSetupBanner('no-models');
                }
            }
            return;
        }

        // We have models — hide any setup banner
        hideSetupBanner();
        modelPicker.setModels(models);

        // Apply pinned now that we know the real model ids
        modelPicker.setPinned(currentSettings.pinnedModels || []);

        // Select previously saved model if still available, else first model
        const targetId = currentSettings.selectedModel && models.some(m => m.id === currentSettings.selectedModel)
            ? currentSettings.selectedModel
            : models[0].id;
        modelPicker.setValue(targetId);

        elements.modelTrigger.disabled = false;
        // Sync the Translate button and status dot with the now-selected
        // model's provider (setValue does not fire onChange).
        updateProviderStatusUI();

    } catch (e) {
        console.error('Failed to load models:', e);
        elements.modelTriggerLabel.textContent = t('model.loadError');
        elements.modelTrigger.disabled = false;
    }
}

// Save current settings
async function saveCurrentSettings() {
    const nextSettings = {
        ...currentSettings,
        selectedModel: modelPicker.getValue(),
        pinnedModels: [...modelPicker.pinned],
        targetLanguage: langPicker.getValue(),
        pinnedLanguages: langPicker.pinned,
        // Save the source language override preference
        sourceLanguage: elements.sourceLangOverride ? elements.sourceLangOverride.value : 'auto',
        // YouTube caption display mode
        youtubeCaptionMode: elements.youtubeCaptionBilingual && elements.youtubeCaptionBilingual.checked ? 'bilingual' : 'replace'
        // Provider, connection URLs, cache, floating button and auto-translate
        // are managed in the full Settings page; the patch leaves them untouched.
    };

    currentSettings = await settingsClient.save(nextSettings);
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

// ============================================================================
// PDF translation (FR-1): only shown on PDF tabs. The local file entry point
// (FR-4) is always co-located so the feature works without file URL access.
// ============================================================================
const pdfProbeCache = new Map();   // FR-12: url -> isPdf (probe once per popup session)

function isPdfTabUrl(url) {
    const P = typeof LctPdfParagraphs !== 'undefined' ? LctPdfParagraphs : null;
    return !!(P && P.isPdfUrl(url));
}

async function refreshPdfButtons() {
    const btn = elements.pdfTranslateBtn;
    const localBtn = elements.pdfOpenLocalBtn;
    if (!btn || !localBtn) return false;
    const hide = () => { btn.hidden = true; localBtn.hidden = true; };
    try {
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) { hide(); return false; }
        if (isPdfTabUrl(tab.url)) { btn.hidden = false; localBtn.hidden = false; return true; }
        // FR-12: extensionless http(s) URL — HEAD-probe once per URL.
        if (/^https?:/i.test(tab.url)) {
            let isPdf = pdfProbeCache.get(tab.url);
            if (isPdf === undefined) {
                try {
                    const resp = await browserAPI.runtime.sendMessage({ type: 'PROBE_PDF', url: tab.url });
                    isPdf = !!(resp && resp.isPdf);
                } catch (e) { isPdf = false; }
                pdfProbeCache.set(tab.url, isPdf);
            }
            if (isPdf) { btn.hidden = false; localBtn.hidden = false; return true; }
        }
        hide();
        return false;
    } catch (e) {
        hide();
        return false;
    }
}

function openPdfViewer(id) {
    const url = browserAPI.runtime.getURL('pdf/viewer.html') + (id ? ('?id=' + encodeURIComponent(id)) : '');
    return browserAPI.tabs.create({ url });
}

async function translateThisPdf() {
    const btn = elements.pdfTranslateBtn;
    if (!btn || btn.disabled) return;
    const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/^(https?|file):/i.test(tab.url)) {
        showToast(t('toast.pdfOnly'), 'error');
        return;
    }
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = t('pdf.preparing');
    try {
        // Runs with the activeTab grant for this origin (popup was opened by
        // clicking the toolbar icon), so credentials and cookies apply.
        const resp = await browserAPI.runtime.sendMessage({ type: 'FETCH_PDF', url: tab.url });
        if (!resp || !resp.ok) {
            const err = (resp && resp.error) || 'unknown error';
            if (resp && resp.status === 403) {
                showToast(t('toast.pdfForbidden'), 'error', 8000);
            } else if (resp && resp.size) {
                showToast(t('toast.pdfTooLarge'), 'error', 8000);
            } else if (tab.url.startsWith('file://') && (!resp || !resp.status)) {
                showToast(t('toast.pdfFileHint'), 'error', 8000);
            } else {
                showToast(t('toast.pdfFail', { message: err }), 'error', 8000);
            }
            return;
        }
        await openPdfViewer(resp.id);
    } catch (e) {
        showToast(t('toast.pdfFail', { message: e && e.message }), 'error', 8000);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);

// ============================================================================
// Resizable popup — drag the corner grip to adjust width and height.
// Uses Pointer Capture so the drag keeps working even when the cursor moves
// outside the popup window quickly. Size is persisted to localStorage.
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const handle = document.querySelector('.resize-handle');
    if (!handle) return;

    const MIN_W = 260, MAX_W = 720, MIN_H = 280;
    const STORAGE_KEY_W = 'popupWidth';
    const STORAGE_KEY_H = 'popupHeight';

    // Restore previously saved size
    const savedW = localStorage.getItem(STORAGE_KEY_W);
    const savedH = localStorage.getItem(STORAGE_KEY_H);
    if (savedW) document.body.style.width = Math.max(MIN_W, Math.min(MAX_W, +savedW)) + 'px';
    if (savedH) document.body.style.height = Math.max(MIN_H, +savedH) + 'px';

    let dragging = false;
    let startX, startY, startW, startH;
    let rafId = null;       // pending animation frame
    let pendingW, pendingH; // latest values to commit on next frame

    handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startW = document.body.offsetWidth;
        startH = document.body.offsetHeight;
        handle.setPointerCapture(e.pointerId); // keeps events firing even outside window
        handle.classList.add('dragging');
    });

    handle.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        // Compute the desired size but don't write to the DOM yet
        pendingW = Math.max(MIN_W, Math.min(MAX_W, startW + (startX - e.clientX)));
        pendingH = Math.max(MIN_H, startH + (e.clientY - startY));
        // Schedule a single DOM write per animation frame (drops redundant intermediate events)
        if (!rafId) {
            rafId = requestAnimationFrame(() => {
                document.body.style.width  = pendingW + 'px';
                document.body.style.height = pendingH + 'px';
                rafId = null;
            });
        }
    });

    const stopDrag = () => {
        if (!dragging) return;
        dragging = false;
        handle.classList.remove('dragging');
        localStorage.setItem(STORAGE_KEY_W, document.body.offsetWidth);
        localStorage.setItem(STORAGE_KEY_H, document.body.offsetHeight);
    };

    handle.addEventListener('pointerup', stopDrag);
    handle.addEventListener('pointercancel', stopDrag);
});
