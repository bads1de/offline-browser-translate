/**
 * Options page: the main event-listener wiring and the sidebar scrollspy.
 *
 * A classic script loaded after options.js; setupEventListeners() is called
 * from the page's init() once settings and pickers are ready.
 */

// Setup event listeners
function setupEventListeners() {
    // Temperature slider
    elements.temperature.addEventListener('input', (e) => {
        elements.temperatureValue.textContent = e.target.value;
    });

    // Parallel requests slider
    if (elements.maxConcurrent) {
        elements.maxConcurrent.addEventListener('input', (e) => {
            if (elements.maxConcurrentValue) {
                elements.maxConcurrentValue.textContent = e.target.value;
            }
        });
    }

    // (Request format selection is handled by requestFormatPicker.onChange.)
    // (Model selection is handled by modelPicker.onChange.)

    // Refresh models
    if (elements.refreshModels) {
        elements.refreshModels.addEventListener('click', async () => {
            await loadModels(true);
            showToast(t('toast.modelsRefreshed'));
        });
    }

    // Provider selection applies immediately (same behavior as the popup):
    // save, then re-list models from the newly selected backend and persist
    // whatever model gets auto-selected so storage never holds a model id
    // that belongs to a different backend.
    providerPicker.onChange = async () => {
        await saveCurrentSettings();
        await loadModels(true);
        await saveCurrentSettings();
    };

    // Save settings
    elements.saveSettings.addEventListener('click', async () => {
        // Request host permission for any non-localhost server URL (opt-in).
        // Must run inside this click gesture, before any other awaits.
        const granted = await ensureHostPermissions([
            elements.ollamaUrl.value,
            elements.lmstudioUrl.value
        ]);
        await saveCurrentSettings();
        if (!granted) {
            showToast(t('toast.customServerDenied'), 'error', 5000);
        } else {
            showToast(t('toast.saved'));
        }
    });

    // Reset settings
    elements.resetSettings.addEventListener('click', async () => {
        currentSettings = { ...DEFAULT_SETTINGS };
        promptDrafts = {};
        activePromptFormat = null;
        currentSettings = await settingsClient.save(currentSettings);
        await browserAPI.runtime.sendMessage({ type: 'SYNC_CONTENT_SCRIPT' });
        if (!currentSettings.floatingButton && !currentSettings.autoTranslatePages
            && !currentSettings.composeTranslationEnabled) {
            try {
                await browserAPI.permissions.remove({ origins: ['<all_urls>'] });
            } catch (e) {
                // Permission may already be absent
            }
        }
        // The reset also restores uiLanguage ('auto'), so re-resolve the UI
        // language before repainting.
        setUiLanguage(resolveUiLanguage());
        updateUiLangToggle();
        applyI18nStatic();
        applySettingsToUI();
        refreshI18nDynamic();
        await loadModels();
        showToast(t('toast.resetToDefaults'));
    });

    // Clear translation cache
    if (elements.clearCache) {
        elements.clearCache.addEventListener('click', async () => {
            try {
                await browserAPI.runtime.sendMessage({ type: 'CLEAR_CACHE' });
                await refreshCacheCount();
                showToast(t('cache.cleared'));
            } catch (e) {
                showToast(t('cache.clearFailed'), 'error');
            }
        });
    }

    // Glossary: collapse/expand the editor immediately when toggled
    if (elements.useGlossary) {
        elements.useGlossary.addEventListener('change', updateGlossaryVisibility);
    }

    // Glossary: filter the visible rows
    if (elements.glossaryFilter) {
        elements.glossaryFilter.addEventListener('input', renderGlossaryRows);
    }

    // Glossary: add a new row via the bottom input bar
    if (elements.addGlossaryTerm) {
        const doAdd = () => {
            const src = elements.newTermSource.value.trim();
            if (!src) return;
            const tgt = elements.newTermTarget.value.trim();
            // Prevent duplicate sources
            const existing = glossaryEditorRows.findIndex(r => r.source === src);
            if (existing !== -1) {
                glossaryEditorRows[existing].target = tgt;
            } else {
                glossaryEditorRows.push({ source: src, target: tgt });
            }
            elements.newTermSource.value = '';
            elements.newTermTarget.value = '';
            elements.newTermSource.focus();
            markGlossaryDirty();

            // A filtered or capped view may not include the row we just added.
            // Filter down to it so the user can see what happened.
            const filterActive = elements.glossaryFilter && elements.glossaryFilter.value.trim();
            if (filterActive || glossaryEditorRows.length > GLOSSARY_RENDER_MAX) {
                if (elements.glossaryFilter) elements.glossaryFilter.value = src;
            }
            renderGlossaryRows();
            // Scroll to bottom of the rows container
            if (elements.glossaryRows) elements.glossaryRows.scrollTop = elements.glossaryRows.scrollHeight;
        };
        elements.addGlossaryTerm.addEventListener('click', doAdd);
        // Allow pressing Enter in either input to add
        [elements.newTermSource, elements.newTermTarget].forEach(input => {
            if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
        });
    }

    // Glossary: save the inline editor contents to storage
    if (elements.saveGlossary) {
        elements.saveGlossary.addEventListener('click', async () => {
            if (!glossaryEditorLoaded) {
                showToast(t('toast.glossaryNotLoadedSave'), 'error');
                return;
            }
            const entries = glossaryEditorRows
                .filter(r => r.source.trim())
                .map(r => [r.source.trim(), r.target.trim()]);
            // Dedupe: last occurrence of a source wins
            const bySource = new Map(entries);
            const deduped = [...bySource.entries()];
            // Read target language from the dropdown
            const targetLang = glossaryTargetLangPicker.getValue();
            const res = await browserAPI.runtime.sendMessage({
                type: 'SAVE_GLOSSARY',
                entries: deduped,
                target: targetLang,
                name: 'inline editor'
            });
            if (res && res.ok) {
                glossaryEditorTargetLang = targetLang;
                await refreshGlossaryStatus();
                showToast(t('toast.glossarySaved', { count: res.count.toLocaleString() }));
            } else {
                showToast(t('toast.glossarySaveFailed'), 'error');
            }
        });
    }

    // Glossary: clear all
    if (elements.clearGlossary) {
        elements.clearGlossary.addEventListener('click', async () => {
            if (!confirm(t('confirm.clearGlossary'))) return;
            const res = await browserAPI.runtime.sendMessage({ type: 'CLEAR_GLOSSARY' });
            if (res && res.ok) {
                glossaryEditorTargetLang = '';
                await refreshGlossaryStatus();
                showToast(t('toast.glossaryCleared'));
            } else {
                showToast(t('toast.glossaryClearFailed'), 'error');
            }
        });
    }

    // Glossary: import from TSV file
    if (elements.glossaryImportFile) {
        elements.glossaryImportFile.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            if (!glossaryEditorLoaded) {
                showToast(t('toast.glossaryNotLoadedImport'), 'error');
                e.target.value = '';
                return;
            }
            try {
                const text = await file.text();
                const { entries, target } = parseGlossaryTSV(text);
                if (!entries.length) {
                    showToast(t('toast.noValidEntries'), 'error');
                    return;
                }
                // Merge into editor: imported entries override existing ones with same source
                const merged = new Map(glossaryEditorRows.map(r => [r.source, r.target]));
                for (const [src, tgt] of entries) merged.set(src, tgt);
                glossaryEditorRows = [...merged.entries()].map(([source, target]) => ({ source, target }));
                if (target) glossaryEditorTargetLang = target;
                renderGlossaryRows();
                updateGlossaryBadge(glossaryEditorRows.length);
                markGlossaryDirty();
                showToast(t('toast.imported', { count: entries.length.toLocaleString() }));
            } catch (err) {
                showToast(t('toast.fileReadFailed'), 'error');
            } finally {
                e.target.value = '';
            }
        });
    }

    // Glossary: export as TSV
    if (elements.glossaryExportBtn) {
        elements.glossaryExportBtn.addEventListener('click', () => {
            const lines = [];
            if (glossaryEditorTargetLang) lines.push(`#target: ${glossaryEditorTargetLang}`);
            for (const { source, target } of glossaryEditorRows) {
                if (source.trim()) lines.push(`${source}\t${target}`);
            }
            const blob = new Blob([lines.join('\n')], { type: 'text/tab-separated-values' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'glossary.tsv';
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // Copy LM Studio template
    elements.copyTemplate.addEventListener('click', () => {
        const template = `{{ bos_token }}
{%- for message in messages -%}
    {%- if message['role'] == 'user' or message['role'] == 'system' -%}
        {{ '<start_of_turn>user\\n' + message['content'] | trim + '<end_of_turn>\\n' }}
    {%- elif message['role'] == 'assistant' -%}
        {{ '<start_of_turn>model\\n' + message['content'] | trim + '<end_of_turn>\\n' }}
    {%- endif -%}
{%- endfor -%}
{%- if add_generation_prompt -%}
    {{ '<start_of_turn>model\\n' }}
{%- endif -%}`;

        navigator.clipboard.writeText(template).then(() => {
            showToast(t('toast.templateCopied'));
        }).catch(() => {
            showToast(t('toast.templateCopyFailed'), 'error');
        });
    });
}

// ============================================================================
// Sidebar scrollspy — highlight the nav link matching the visible section
// ============================================================================
function initSidebarScrollspy() {
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    if (!navLinks.length) return;

    // Only sections that have a nav link. Observing the others (e.g. the
    // conditionally shown custom-prompts section) would clear the highlight
    // entirely whenever one of them scrolled into view.
    const sections = [...navLinks]
        .map(link => document.getElementById(link.dataset.section))
        .filter(Boolean);
    if (!sections.length) return;

    // Highlight the visible section nearest the top of the viewport rather than
    // whichever entry the observer happened to report last.
    const visible = new Set();
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) visible.add(entry.target);
            else visible.delete(entry.target);
        }
        if (!visible.size) return;
        const topmost = [...visible].reduce((best, el) =>
            el.getBoundingClientRect().top < best.getBoundingClientRect().top ? el : best);
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.section === topmost.id);
        });
    }, { threshold: 0.3 });

    sections.forEach(s => observer.observe(s));

    // Smooth-scroll on nav click
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.getElementById(link.dataset.section);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}
