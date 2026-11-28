/**
 * Options page: all-sites permission toggles (floating button, auto-translate,
 * compose translation) and the auto-translate never-lists.
 *
 * A classic script loaded after options.js; it adds its own DOMContentLoaded
 * listeners on top of the page's init().
 */

// ============================================================================
// All-sites permission management
//
// The floating button, auto-translate, and compose translation all need
// content.js present on every page. They share one <all_urls> grant and one
// script registration, so each toggle only persists its own setting and then
// asks the background to work out whether the script should still be registered.
// ============================================================================

// True once the setting is saved and (if needed) the permission is granted.
async function applyAllSitesFeature(settingKey, enabled) {
    if (enabled) {
        const granted = await browserAPI.permissions.request({ origins: ['<all_urls>'] });
        if (!granted) return false;
    }

    currentSettings[settingKey] = enabled;
    currentSettings = await settingsClient.save(currentSettings);
    await browserAPI.runtime.sendMessage({ type: 'SYNC_CONTENT_SCRIPT' });

    // Only hand the permission back when nothing else is still using it.
    if (!enabled && !currentSettings.floatingButton && !currentSettings.autoTranslatePages
        && !currentSettings.composeTranslationEnabled) {
        try {
            await browserAPI.permissions.remove({ origins: ['<all_urls>'] });
        } catch (e) {
            // Permission may already be absent
        }
    }
    return true;
}

// ============================================================================
// Auto-translate never-lists
// ============================================================================

// Render one removable chip per entry. Values come from user input, so they are
// written with textContent and never parsed as HTML.
function renderChipList(container, values, onRemove, labelFor) {
    if (!container) return;
    container.replaceChildren();
    if (!values.length) {
        const empty = document.createElement('span');
        empty.className = 'chip-empty';
        empty.textContent = t('chips.empty');
        container.appendChild(empty);
        return;
    }
    values.forEach((value, idx) => {
        const chip = document.createElement('span');
        chip.className = 'chip';

        const text = document.createElement('span');
        text.textContent = labelFor ? labelFor(value) : value;

        const remove = document.createElement('button');
        remove.className = 'chip-remove';
        remove.type = 'button';
        remove.textContent = '×';
        remove.title = t('chips.remove');
        remove.addEventListener('click', () => onRemove(idx));

        chip.append(text, remove);
        container.appendChild(chip);
    });
}

function renderAutoTranslateLists() {
    const langs = Array.isArray(currentSettings.autoTranslateNeverLanguages)
        ? currentSettings.autoTranslateNeverLanguages
        : [];
    const sites = Array.isArray(currentSettings.autoTranslateNeverSites)
        ? currentSettings.autoTranslateNeverSites
        : [];

    renderChipList(elements.neverLanguageList, langs,
        (idx) => {
            langs.splice(idx, 1);
            currentSettings.autoTranslateNeverLanguages = langs;
            persistAutoTranslateLists();
        },
        (code) => (typeof LANGUAGES !== 'undefined' && LANGUAGES[code]) || code);

    renderChipList(elements.neverSiteList, sites, (idx) => {
        sites.splice(idx, 1);
        currentSettings.autoTranslateNeverSites = sites;
        persistAutoTranslateLists();
    });

    if (elements.autoTranslateOptions) {
        elements.autoTranslateOptions.hidden = !currentSettings.autoTranslatePages;
    }
}

async function persistAutoTranslateLists() {
    currentSettings = await settingsClient.save(currentSettings);
    renderAutoTranslateLists();
}

// The on-page banner can add sites while this tab is open. Pick those up so the
// next save from here doesn't write a stale list back over them.
browserAPI.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    const updated = changes.settings.newValue;
    if (!updated) return;
    const sites = updated.autoTranslateNeverSites;
    if (!Array.isArray(sites)) return;
    const current = currentSettings.autoTranslateNeverSites || [];
    if (sites.length === current.length && sites.every((s, i) => s === current[i])) return;
    currentSettings.autoTranslateNeverSites = [...sites];
    renderAutoTranslateLists();
});

// Accepts a bare hostname or a pasted URL, and stores just the host.
function normalizeSiteEntry(raw) {
    let value = String(raw || '').trim().toLowerCase();
    if (!value) return '';
    if (value.includes('/') || value.includes(':')) {
        try {
            value = new URL(value.includes('://') ? value : 'http://' + value).hostname;
        } catch (e) {
            return '';
        }
    }
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(value) || value === 'localhost' ? value : '';
}

document.addEventListener('DOMContentLoaded', () => {
    elements.composeTranslationEnabled.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        const ok = await applyAllSitesFeature('composeTranslationEnabled', enabled);
        if (!ok) {
            elements.composeTranslationEnabled.checked = false;
            showToast(t('toast.composeDenied'), 'error');
            return;
        }
        updateComposeVisibility();
        showToast(enabled
            ? t('toast.composeEnabled')
            : t('toast.composeDisabled'));
    });

    elements.floatingButton.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        const ok = await applyAllSitesFeature('floatingButton', enabled);
        if (!ok) {
            elements.floatingButton.checked = false;
            showToast(t('toast.floatingDenied'), 'error');
            return;
        }
        showToast(enabled
            ? t('toast.floatingEnabled')
            : t('toast.floatingDisabled'));
    });

    if (elements.autoTranslatePages) {
        elements.autoTranslatePages.addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            const ok = await applyAllSitesFeature('autoTranslatePages', enabled);
            if (!ok) {
                elements.autoTranslatePages.checked = false;
                showToast(t('toast.autoTranslateDenied'), 'error');
                return;
            }
            renderAutoTranslateLists();
            showToast(enabled
                ? t('toast.autoTranslateEnabled')
                : t('toast.autoTranslateDisabled'));
        });
    }

    if (elements.addNeverLanguage) {
        elements.addNeverLanguage.addEventListener('click', () => {
            const code = neverLanguagePicker.getValue();
            if (!code) return;
            const langs = Array.isArray(currentSettings.autoTranslateNeverLanguages)
                ? currentSettings.autoTranslateNeverLanguages
                : [];
            if (langs.includes(code)) {
                showToast(t('toast.alreadyInList'), 'warning');
                return;
            }
            langs.push(code);
            currentSettings.autoTranslateNeverLanguages = langs;
            persistAutoTranslateLists();
        });
    }

    if (elements.addNeverSite) {
        const addSite = () => {
            const host = normalizeSiteEntry(elements.neverSiteInput.value);
            if (!host) {
                showToast(t('toast.invalidHostname'), 'error');
                return;
            }
            const sites = Array.isArray(currentSettings.autoTranslateNeverSites)
                ? currentSettings.autoTranslateNeverSites
                : [];
            if (sites.includes(host)) {
                showToast(t('toast.alreadyInList'), 'warning');
                return;
            }
            sites.push(host);
            currentSettings.autoTranslateNeverSites = sites;
            elements.neverSiteInput.value = '';
            persistAutoTranslateLists();
        };
        elements.addNeverSite.addEventListener('click', addSite);
        elements.neverSiteInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addSite(); }
        });
    }
});
