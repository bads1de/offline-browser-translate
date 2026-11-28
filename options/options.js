/**
 * Options page core: shared state, pickers, settings load/save, model and
 * cache helpers, UI-language plumbing, and the page entry point.
 *
 * The feature sections live in sibling classic scripts loaded after this one
 * (prompts.js, glossary.js, autotranslate.js, events.js). They share these
 * globals: elements, currentSettings, settingsClient/browserAPI, the pickers,
 * and showToast(). init() runs on DOMContentLoaded, after every script loaded.
 */

// Use browser API with chrome fallback for Firefox compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
const settingsClient = SettingsClient.createSettingsClient(browserAPI);

// DEFAULT_SETTINGS lives in ../settings/defaults.js, shared with the other pages.

// DOM Elements
const elements = {
    providerPickerEl: document.getElementById('providerPickerEl'),
    providerTrigger: document.getElementById('providerTrigger'),
    providerTriggerLabel: document.getElementById('providerTriggerLabel'),
    providerMenu: document.getElementById('providerMenu'),
    providerList: document.getElementById('providerList'),
    ollamaUrl: document.getElementById('ollamaUrl'),
    lmstudioUrl: document.getElementById('lmstudioUrl'),
    modelPickerEl: document.getElementById('modelPickerEl'),
    modelTrigger: document.getElementById('modelTrigger'),
    modelTriggerLabel: document.getElementById('modelTriggerLabel'),
    modelMenu: document.getElementById('modelMenu'),
    modelSearch: document.getElementById('modelSearch'),
    modelList: document.getElementById('modelList'),
    refreshModels: document.getElementById('refreshModels'),
    sourceLanguagePickerEl: document.getElementById('sourceLanguagePickerEl'),
    sourceLanguageTrigger: document.getElementById('sourceLanguageTrigger'),
    sourceLanguageTriggerLabel: document.getElementById('sourceLanguageTriggerLabel'),
    sourceLanguageMenu: document.getElementById('sourceLanguageMenu'),
    sourceLanguageList: document.getElementById('sourceLanguageList'),
    sourceLanguageGroup: document.getElementById('sourceLanguageGroup'),
    targetLangPickerEl: document.getElementById('targetLangPickerEl'),
    targetLangTrigger: document.getElementById('targetLangTrigger'),
    targetLangTriggerLabel: document.getElementById('targetLangTriggerLabel'),
    targetLangMenu: document.getElementById('targetLangMenu'),
    targetLangSearch: document.getElementById('targetLangSearch'),
    targetLangList: document.getElementById('targetLangList'),
    requestFormatPickerEl: document.getElementById('requestFormatPickerEl'),
    requestFormatTrigger: document.getElementById('requestFormatTrigger'),
    requestFormatTriggerLabel: document.getElementById('requestFormatTriggerLabel'),
    requestFormatMenu: document.getElementById('requestFormatMenu'),
    requestFormatList: document.getElementById('requestFormatList'),
    formatDescription: document.getElementById('formatDescription'),
    promptEditor: document.getElementById('promptEditor'),
    promptEditorHint: document.getElementById('promptEditorHint'),
    systemPrompt: document.getElementById('systemPrompt'),
    userPrompt: document.getElementById('userPrompt'),
    maxTokens: document.getElementById('maxTokens'),
    maxItems: document.getElementById('maxItems'),
    maxConcurrent: document.getElementById('maxConcurrent'),
    maxConcurrentValue: document.getElementById('maxConcurrentValue'),
    temperature: document.getElementById('temperature'),
    temperatureValue: document.getElementById('temperatureValue'),
    useStructuredOutput: document.getElementById('useStructuredOutput'),
    plainTextFallback: document.getElementById('plainTextFallback'),
    showGlow: document.getElementById('showGlow'),
    cacheModePickerEl: document.getElementById('cacheModePickerEl'),
    cacheModeTrigger: document.getElementById('cacheModeTrigger'),
    cacheModeTriggerLabel: document.getElementById('cacheModeTriggerLabel'),
    cacheModeMenu: document.getElementById('cacheModeMenu'),
    cacheModeList: document.getElementById('cacheModeList'),
    cacheBackendWarning: document.getElementById('cacheBackendWarning'),
    clearCache: document.getElementById('clearCache'),
    cacheCount: document.getElementById('cacheCount'),
    debugLogging: document.getElementById('debugLogging'),
    useGlossary: document.getElementById('useGlossary'),
    glossarySettings: document.getElementById('glossarySettings'),
    // new glossary UI elements
    glossaryTargetLangPickerEl: document.getElementById('glossaryTargetLangPickerEl'),
    glossaryTargetLangTrigger: document.getElementById('glossaryTargetLangTrigger'),
    glossaryTargetLangTriggerLabel: document.getElementById('glossaryTargetLangTriggerLabel'),
    glossaryTargetLangMenu: document.getElementById('glossaryTargetLangMenu'),
    glossaryTargetLangList: document.getElementById('glossaryTargetLangList'),
    glossaryRows: document.getElementById('glossaryRows'),
    glossaryFilter: document.getElementById('glossaryFilter'),
    glossaryRowsNote: document.getElementById('glossaryRowsNote'),
    glossaryStatusBadge: document.getElementById('glossaryStatusBadge'),
    glossaryTargetInfo: document.getElementById('glossaryTargetInfo'),
    glossaryUnsavedHint: document.getElementById('glossaryUnsavedHint'),
    newTermSource: document.getElementById('newTermSource'),
    newTermTarget: document.getElementById('newTermTarget'),
    addGlossaryTerm: document.getElementById('addGlossaryTerm'),
    saveGlossary: document.getElementById('saveGlossary'),
    clearGlossary: document.getElementById('clearGlossary'),
    glossaryImportFile: document.getElementById('glossaryImportFile'),
    glossaryExportBtn: document.getElementById('glossaryExportBtn'),
    floatingButton: document.getElementById('floatingButton'),
    autoTranslatePages: document.getElementById('autoTranslatePages'),
    autoTranslateOptions: document.getElementById('autoTranslateOptions'),
    composeTranslationEnabled: document.getElementById('composeTranslationEnabled'),
    composeOptions: document.getElementById('composeOptions'),
    composeSourceLanguagePickerEl: document.getElementById('composeSourceLanguagePickerEl'),
    composeSourceLanguageTrigger: document.getElementById('composeSourceLanguageTrigger'),
    composeSourceLanguageTriggerLabel: document.getElementById('composeSourceLanguageTriggerLabel'),
    composeSourceLanguageMenu: document.getElementById('composeSourceLanguageMenu'),
    composeSourceLanguageList: document.getElementById('composeSourceLanguageList'),
    composeTargetLanguagePickerEl: document.getElementById('composeTargetLanguagePickerEl'),
    composeTargetLanguageTrigger: document.getElementById('composeTargetLanguageTrigger'),
    composeTargetLanguageTriggerLabel: document.getElementById('composeTargetLanguageTriggerLabel'),
    composeTargetLanguageMenu: document.getElementById('composeTargetLanguageMenu'),
    composeTargetLanguageList: document.getElementById('composeTargetLanguageList'),
    neverLanguagePickerEl: document.getElementById('neverLanguagePickerEl'),
    neverLanguageTrigger: document.getElementById('neverLanguageTrigger'),
    neverLanguageTriggerLabel: document.getElementById('neverLanguageTriggerLabel'),
    neverLanguageMenu: document.getElementById('neverLanguageMenu'),
    neverLanguagePickerList: document.getElementById('neverLanguagePickerList'),
    addNeverLanguage: document.getElementById('addNeverLanguage'),
    neverLanguageList: document.getElementById('neverLanguageList'),
    neverSiteInput: document.getElementById('neverSiteInput'),
    addNeverSite: document.getElementById('addNeverSite'),
    neverSiteList: document.getElementById('neverSiteList'),
    translateGemmaHelp: document.getElementById('translateGemmaHelp'),
    copyTemplate: document.getElementById('copyTemplate'),
    saveSettings: document.getElementById('saveSettings'),
    resetSettings: document.getElementById('resetSettings'),
    uiLangEn: document.getElementById('uiLangEn'),
    uiLangJa: document.getElementById('uiLangJa'),
    toast: document.getElementById('toast')
};

let currentSettings = { ...DEFAULT_SETTINGS };

// The picker factories and createSimpleSelect() live in ../picker.js, shared
// with the popup page.

// Full language list as { value, label } options, sorted by display name —
// shared by every simple-select that offers a language choice.
function sortedLanguageOptions() {
    return Object.entries(LANGUAGES)
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([code, name]) => ({ value: code, label: name }));
}

const langPicker = createLanguagePicker({
    els: {
        picker: elements.targetLangPickerEl,
        trigger: elements.targetLangTrigger,
        label: elements.targetLangTriggerLabel,
        menu: elements.targetLangMenu,
        search: elements.targetLangSearch,
        list: elements.targetLangList,
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

function initTargetLangPicker() {
    langPicker.onChange = (code) => {
        currentSettings.targetLanguage = code;
    };
    langPicker.onPinnedChange = (pinned) => {
        currentSettings.pinnedLanguages = pinned;
        saveCurrentSettings();
    };
    langPicker.init();
}

function initModelPicker() {
    modelPicker.onChange = (id) => {
        currentSettings.selectedModel = id;
        updateFormatDescription(requestFormatPicker.getValue());
        updateVisibility();
    };
    modelPicker.onPinnedChange = (pinned) => {
        currentSettings.pinnedModels = pinned;
        saveCurrentSettings();
    };
    modelPicker.init();
}


// ============================================================================
// Simple-select pickers: provider, source language, request format, cache
// mode, glossary target language, and the "never auto-translate" language
// combo. None of these need search or pinning, just a styled stand-in for
// the plain <select> they used to be.
// ============================================================================

const providerPicker = createSimpleSelect({
    els: {
        picker: elements.providerPickerEl,
        trigger: elements.providerTrigger,
        label: elements.providerTriggerLabel,
        menu: elements.providerMenu,
        list: elements.providerList,
    },
    getOptions: () => {
        return [
            { value: 'auto', label: t('provider.auto') },
            { value: 'ollama', label: t('provider.ollama') },
            { value: 'lmstudio', label: t('provider.lmstudio') },
        ];
    },
    initialValue: 'auto',
});

const sourceLanguagePicker = createSimpleSelect({
    els: {
        picker: elements.sourceLanguagePickerEl,
        trigger: elements.sourceLanguageTrigger,
        label: elements.sourceLanguageTriggerLabel,
        menu: elements.sourceLanguageMenu,
        list: elements.sourceLanguageList,
    },
    getOptions: () => [{ value: 'auto', label: t('sourceLang.auto') }, ...sortedLanguageOptions()],
    initialValue: 'auto',
});

const composeSourceLanguagePicker = createSimpleSelect({
    els: {
        picker: elements.composeSourceLanguagePickerEl,
        trigger: elements.composeSourceLanguageTrigger,
        label: elements.composeSourceLanguageTriggerLabel,
        menu: elements.composeSourceLanguageMenu,
        list: elements.composeSourceLanguageList,
    },
    getOptions: () => [{ value: 'auto', label: t('compose.sourceAuto') }, ...sortedLanguageOptions()],
    initialValue: 'auto',
});

const composeTargetLanguagePicker = createSimpleSelect({
    els: {
        picker: elements.composeTargetLanguagePickerEl,
        trigger: elements.composeTargetLanguageTrigger,
        label: elements.composeTargetLanguageTriggerLabel,
        menu: elements.composeTargetLanguageMenu,
        list: elements.composeTargetLanguageList,
    },
    getOptions: sortedLanguageOptions,
    initialValue: 'en',
});

// Localized display label for a request format id (also used by the
// "Detected for this model" hint).
function formatOptionLabel(format) {
    return t('formatOpt.' + format);
}

const requestFormatPicker = createSimpleSelect({
    els: {
        picker: elements.requestFormatPickerEl,
        trigger: elements.requestFormatTrigger,
        label: elements.requestFormatTriggerLabel,
        menu: elements.requestFormatMenu,
        list: elements.requestFormatList,
    },
    getOptions: () => ['auto', 'default', 'translategemma', 'hunyuan', 'plamo', 'simple', 'custom']
        .map(value => ({ value, label: formatOptionLabel(value) })),
    initialValue: 'auto',
});

// Greyed out (not removed) when the browser can't persist IndexedDB — see refreshCacheBackend().
let cachePersistentAvailable = true;

const cacheModePicker = createSimpleSelect({
    els: {
        picker: elements.cacheModePickerEl,
        trigger: elements.cacheModeTrigger,
        label: elements.cacheModeTriggerLabel,
        menu: elements.cacheModeMenu,
        list: elements.cacheModeList,
    },
    getOptions: () => [
        { value: 'off', label: t('cache.mode.off') },
        { value: 'session', label: t('cache.mode.session') },
        { value: 'persistent', label: t('cache.mode.persistent'), disabled: !cachePersistentAvailable },
    ],
    initialValue: 'off',
});

const glossaryTargetLangPicker = createSimpleSelect({
    els: {
        picker: elements.glossaryTargetLangPickerEl,
        trigger: elements.glossaryTargetLangTrigger,
        label: elements.glossaryTargetLangTriggerLabel,
        menu: elements.glossaryTargetLangMenu,
        list: elements.glossaryTargetLangList,
    },
    getOptions: () => [{ value: '', label: t('glossary.anyLang') }, ...sortedLanguageOptions()],
    initialValue: '',
});

const neverLanguagePicker = createSimpleSelect({
    els: {
        picker: elements.neverLanguagePickerEl,
        trigger: elements.neverLanguageTrigger,
        label: elements.neverLanguageTriggerLabel,
        menu: elements.neverLanguageMenu,
        list: elements.neverLanguagePickerList,
    },
    getOptions: () => sortedLanguageOptions(),
    initialValue: (sortedLanguageOptions()[0] || {}).value || '',
});

function initSimpleSelects() {
    providerPicker.init();
    sourceLanguagePicker.init();
    composeSourceLanguagePicker.onChange = (value) => {
        currentSettings.composeSourceLanguage = value;
    };
    composeSourceLanguagePicker.init();
    composeTargetLanguagePicker.onChange = (value) => {
        currentSettings.composeTargetLanguage = value;
    };
    composeTargetLanguagePicker.init();
    requestFormatPicker.onChange = (value) => {
        updateFormatDescription(value);
        updateVisibility();
    };
    requestFormatPicker.init();
    cacheModePicker.init();
    glossaryTargetLangPicker.init();
    neverLanguagePicker.init();
    // Paint the trigger label for the default selection picked at construction time.
    neverLanguagePicker.setValue(neverLanguagePicker.getValue());
}

// ============================================================================
// UI language (English / Japanese)
//
// The options page is translated via options/i18n.js: static HTML carries
// data-i18n attributes, and runtime-built strings go through t(). The choice
// is persisted in settings.uiLanguage ('auto' resolves from the browser
// locale); every JS-rendered surface is refreshed on switch.
// ============================================================================

function resolveUiLanguage() {
    return uiLanguageFromSettings(currentSettings);
}

function updateUiLangToggle() {
    if (elements.uiLangEn) elements.uiLangEn.classList.toggle('active', uiLanguage === 'en');
    if (elements.uiLangJa) elements.uiLangJa.classList.toggle('active', uiLanguage === 'ja');
}

function initUiLanguage() {
    setUiLanguage(resolveUiLanguage());
    updateUiLangToggle();
    if (elements.uiLangEn) {
        elements.uiLangEn.addEventListener('click', () => switchUiLanguage('en'));
    }
    if (elements.uiLangJa) {
        elements.uiLangJa.addEventListener('click', () => switchUiLanguage('ja'));
    }
}

// Re-render everything options.js builds at runtime. Static HTML is covered by
// applyI18nStatic(); these are the pieces whose text is computed in JS.
function refreshI18nDynamic() {
    // Simple-select trigger labels come from getOptions() at call time.
    providerPicker.setValue(providerPicker.getValue());
    sourceLanguagePicker.setValue(sourceLanguagePicker.getValue());
    composeSourceLanguagePicker.setValue(composeSourceLanguagePicker.getValue());
    composeTargetLanguagePicker.setValue(composeTargetLanguagePicker.getValue());
    requestFormatPicker.setValue(requestFormatPicker.getValue());
    cacheModePicker.setValue(cacheModePicker.getValue());
    glossaryTargetLangPicker.setValue(glossaryTargetLangPicker.getValue());
    neverLanguagePicker.setValue(neverLanguagePicker.getValue());
    if (modelPicker.getValue()) modelPicker.setValue(modelPicker.getValue());

    // Format description + prompt editor hint (updateFormatDescription skips
    // the hint when the format didn't change, so set it here).
    updateFormatDescription(requestFormatPicker.getValue());
    if (elements.promptEditorHint && activePromptFormat && activePromptFormat !== 'auto') {
        elements.promptEditorHint.textContent = t('prompt.editorHint', { format: activePromptFormat });
    }

    renderGlossaryRows();
    updateGlossaryBadge(glossaryEditorRows.length);
    renderAutoTranslateLists();
}

async function switchUiLanguage(lang) {
    if (uiLanguage === lang) return;
    setUiLanguage(lang);
    currentSettings.uiLanguage = lang;
    applyI18nStatic();
    updateUiLangToggle();
    refreshI18nDynamic();
    await saveCurrentSettings();
}

// Initialize
async function init() {
    initTargetLangPicker();
    initModelPicker();
    initSimpleSelects();
    await loadSettings();
    initUiLanguage();
    applyI18nStatic();
    applySettingsToUI();
    initPromptEditors(); // Initialize editors
    await loadModels();
    setupEventListeners();
    await refreshGlossaryStatus();
    initSidebarScrollspy();
    refreshCacheCount();
    refreshCacheBackend();

    // The options page opens in a persistent tab, so init() only runs once. Refresh
    // the cached-entry count whenever the tab is re-focused (e.g. after translating
    // a page in another tab) so it doesn't show a stale value.
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) { refreshCacheCount(); }
    });
}

// Grey out "Keep across sessions" when the browser blocks IndexedDB (e.g. hardened
// Firefox forks like Mullvad/Tor), since persistence can't work there.
async function refreshCacheBackend() {
    let persistent = true;
    try {
        const res = await browserAPI.runtime.sendMessage({ type: 'CACHE_BACKEND' });
        persistent = !(res && res.persistent === false);
    } catch (e) { /* assume available on error */ }

    cachePersistentAvailable = persistent;
    if (elements.cacheBackendWarning) elements.cacheBackendWarning.hidden = persistent;
    // If persistence isn't available but it was the saved choice, fall back to session.
    if (!persistent && cacheModePicker.getValue() === 'persistent') {
        cacheModePicker.setValue('session');
        currentSettings.cacheMode = 'session';
    }
}

// Show how many translations are currently cached.
async function refreshCacheCount() {
    if (!elements.cacheCount) return;
    try {
        const res = await browserAPI.runtime.sendMessage({ type: 'CACHE_COUNT' });
        elements.cacheCount.textContent = (res && typeof res.count === 'number') ? res.count.toLocaleString() : '0';
    } catch (e) {
        elements.cacheCount.textContent = '0';
    }
}

// Load available models from providers. forceRefresh bypasses the background's
// 60s model-list cache (used by the refresh button and provider switches).
async function loadModels(forceRefresh = false) {
    if (!elements.modelTrigger) return;

    elements.modelTrigger.disabled = true;
    elements.modelTriggerLabel.textContent = t('model.loading');
    try {
        const response = await browserAPI.runtime.sendMessage({ type: 'LIST_MODELS', forceRefresh });
        const models = response.models || [];

        modelPicker.setModels(models);
        modelPicker.setPinned(currentSettings.pinnedModels || []);

        if (models.length === 0) {
            elements.modelTriggerLabel.textContent = t('model.noneFound');
        } else {
            // Select current model if still available, else the first one
            const targetId = currentSettings.selectedModel && models.some(m => m.id === currentSettings.selectedModel)
                ? currentSettings.selectedModel
                : models[0].id;
            modelPicker.setValue(targetId);
            currentSettings.selectedModel = targetId;

            // Refresh the "Auto → detected format" hint for the selected model
            updateFormatDescription(requestFormatPicker.getValue());
            updateVisibility();
        }
    } catch (e) {
        console.error('Failed to load models:', e);
        elements.modelTriggerLabel.textContent = t('model.loadError');
    } finally {
        elements.modelTrigger.disabled = false;
    }
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
    providerPicker.setValue(currentSettings.provider);
    elements.ollamaUrl.value = currentSettings.ollamaUrl;
    elements.lmstudioUrl.value = currentSettings.lmstudioUrl;
    sourceLanguagePicker.setValue(currentSettings.sourceLanguage || 'auto');
    langPicker.setPinned(currentSettings.pinnedLanguages || []);
    langPicker.setValue(currentSettings.targetLanguage);
    requestFormatPicker.setValue(currentSettings.requestFormat);
    elements.maxTokens.value = currentSettings.maxTokensPerBatch;
    elements.maxItems.value = currentSettings.maxItemsPerBatch || 8;
    elements.temperature.value = currentSettings.temperature;
    elements.temperatureValue.textContent = currentSettings.temperature;
    // Parallel requests slider
    if (elements.maxConcurrent) {
        elements.maxConcurrent.value = currentSettings.maxConcurrentRequests || 4;
        if (elements.maxConcurrentValue) {
            elements.maxConcurrentValue.textContent = currentSettings.maxConcurrentRequests || 4;
        }
    }
    elements.useStructuredOutput.checked = currentSettings.useStructuredOutput;
    if (elements.plainTextFallback) elements.plainTextFallback.checked = currentSettings.plainTextFallback !== false;
    elements.showGlow.checked = currentSettings.showGlow !== false;
    cacheModePicker.setValue(currentSettings.cacheMode || 'off');
    elements.debugLogging.checked = !!currentSettings.debug;
    if (elements.useGlossary) elements.useGlossary.checked = currentSettings.useGlossary !== false;
    updateGlossaryVisibility();
    elements.floatingButton.checked = !!currentSettings.floatingButton;
    if (elements.autoTranslatePages) {
        elements.autoTranslatePages.checked = !!currentSettings.autoTranslatePages;
    }
    elements.composeTranslationEnabled.checked = !!currentSettings.composeTranslationEnabled;
    composeSourceLanguagePicker.setValue(currentSettings.composeSourceLanguage || 'auto');
    composeTargetLanguagePicker.setValue(currentSettings.composeTargetLanguage || 'en');
    updateComposeVisibility();
    renderAutoTranslateLists();

    // Pickers constructed before the saved UI language was resolved painted
    // their trigger labels with the detected locale — repaint them now.
    neverLanguagePicker.setValue(neverLanguagePicker.getValue());

    // Update format description
    updateFormatDescription(currentSettings.requestFormat);

    // Show/hide sections based on format
    updateVisibility();
}

function updateComposeVisibility() {
    if (elements.composeOptions) {
        elements.composeOptions.hidden = !elements.composeTranslationEnabled.checked;
    }
}

// Save current settings
async function saveCurrentSettings() {
    // Whatever's currently in the editor belongs to activePromptFormat and hasn't
    // been captured into promptDrafts yet unless the user already switched away
    // from it (updateFormatDescription does that capture on every switch).
    if (activePromptFormat && activePromptFormat !== 'auto' && elements.systemPrompt && elements.userPrompt) {
        promptDrafts[activePromptFormat] = {
            system: elements.systemPrompt.value,
            user: elements.userPrompt.value,
        };
    }

    const nextSettings = {
        ...currentSettings,
        provider: providerPicker.getValue(),
        ollamaUrl: elements.ollamaUrl.value,
        lmstudioUrl: elements.lmstudioUrl.value,
        selectedModel: modelPicker.getValue() || currentSettings.selectedModel,
        pinnedModels: [...modelPicker.pinned],
        sourceLanguage: sourceLanguagePicker.getValue(),
        targetLanguage: langPicker.getValue(),
        pinnedLanguages: [...langPicker.pinned],
        requestFormat: requestFormatPicker.getValue(),
        maxTokensPerBatch: parseInt(elements.maxTokens.value) || 2000,
        maxItemsPerBatch: parseInt(elements.maxItems.value) || 8,
        maxConcurrentRequests: parseInt(elements.maxConcurrent?.value) || 4,
        temperature: parseFloat(elements.temperature.value) || 0.3,
        useStructuredOutput: elements.useStructuredOutput.checked,
        plainTextFallback: elements.plainTextFallback ? elements.plainTextFallback.checked : true,
        showGlow: elements.showGlow.checked,
        cacheMode: cacheModePicker.getValue() || 'off',
        debug: elements.debugLogging.checked,
        useGlossary: elements.useGlossary ? elements.useGlossary.checked : false,
        floatingButton: elements.floatingButton.checked,
        composeTranslationEnabled: elements.composeTranslationEnabled.checked,
        composeSourceLanguage: composeSourceLanguagePicker.getValue(),
        composeTargetLanguage: composeTargetLanguagePicker.getValue(),
        // Merge in this session's prompt edits, keyed by the format each one belongs to.
        customPrompts: { ...currentSettings.customPrompts, ...promptDrafts }
    };

    currentSettings = await settingsClient.save(nextSettings);
}

// Show toast notification
function showToast(message, type = 'success', duration = 3000) {
    const toast = elements.toast;
    const icon = toast.querySelector('.toast-icon');
    const msg = toast.querySelector('.toast-message');

    icon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
    msg.textContent = message;

    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
