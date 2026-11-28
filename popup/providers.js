/**
 * Popup: provider detection, the status dot / setup banner, and the model list.
 *
 * A classic script loaded after popup.js; uses its globals and is called from
 * the page's init().
 */

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
