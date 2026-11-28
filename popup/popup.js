/**
 * Popup core: shared state, DOM refs, language/model pickers, page-language
 * detection, settings load/save, and the init entry point.
 *
 * Feature sections live in sibling classic scripts loaded after this one
 * (providers.js, translation.js, youtube.js, pdf.js, events.js, resize.js).
 * They share these globals: elements, currentSettings, settingsClient,
 * browserAPI, CONTENT_SCRIPTS, the pickers, showToast() and debugLog().
 */

// Use browser API with chrome fallback for Firefox compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
const settingsClient = SettingsClient.createSettingsClient(browserAPI);

// Injected in this order; must match background/content-injection.js CONTENT_SCRIPTS.
const CONTENT_SCRIPTS = [
    '/compose/policy.js',
    '/compose/session.js',
    '/compose/textarea.js',
    '/compose/contenteditable.js',
    '/compose/ui.js',
    '/compose/controller.js',
    '/content/core.js',
    '/content/dom.js',
    '/content/widget.js',
    '/content/page.js',
    '/content/messages.js',
    '/content/selection.js',
    '/content/captions.js',
    '/content/startup.js',
    '/captions/parser.js',
    '/captions/fetcher.js',
    '/captions/session.js'
];

// DEFAULT_SETTINGS lives in ../settings/defaults.js, shared with the other pages.

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

// Show toast notification (shared with the options and translator pages).
const showToast = createToast(elements.toast);

// ============================================================================
// UI language — the popup follows the language chosen on the settings page
// (settings.uiLanguage: 'auto' resolves from the browser locale). Static HTML
// is painted in the detected locale when popup-i18n.js loads; once settings
// arrive we resolve the saved preference and, if it differs, re-paint.
// ============================================================================

function resolvePopupUiLanguage() {
    return uiLanguageFromSettings(currentSettings);
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

// Language and model pickers are built by ../picker.js, shared with the
// options page.
const langPicker = createLanguagePicker({
    els: {
        picker: elements.languagePicker,
        trigger: elements.langTrigger,
        label: elements.langTriggerLabel,
        menu: elements.langMenu,
        search: elements.langSearch,
        list: elements.langList,
    },
});

const modelPicker = createModelPicker({
    els: {
        picker: elements.modelPickerEl,
        trigger: elements.modelTrigger,
        label: elements.modelTriggerLabel,
        menu: elements.modelMenu,
        search: elements.modelSearch,
        list: elements.modelList,
    },
});

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

// Load settings from storage
async function loadSettings() {
    try {
        currentSettings = await settingsClient.load(DEFAULT_SETTINGS);
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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
