/**
 * Options page: inline glossary editor.
 *
 * TSV parsing, the in-memory row list, rendering/filtering, and reading or
 * saving the dictionary through the background worker. A classic script
 * loaded after options.js and sharing its globals.
 */

// Parse a TSV glossary into { entries: Array<[source, target]>, target: string }.
// One entry per line: `source<TAB>translation`. A missing/empty second column
// means "keep as-is". Lines starting with '#' and blank lines are skipped,
// except a `#target: xx` directive, which declares the language the glossary
// translates INTO — it is then only applied when translating to that language.
// Duplicate sources keep the last occurrence.
function parseGlossaryTSV(text) {
    const bySource = new Map();
    let target = '';
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        if (!line) continue;
        if (line[0] === '#') {
            const directive = line.match(/^#\s*target\s*:\s*([A-Za-z-]+)/i);
            if (directive) target = directive[1].split('-')[0].toLowerCase();
            continue;
        }
        const tab = line.indexOf('\t');
        const source = (tab === -1 ? line : line.slice(0, tab)).trim();
        if (!source) continue;
        bySource.set(source, tab === -1 ? '' : line.slice(tab + 1).trim());
    }
    return { entries: [...bySource.entries()], target };
}

// ============================================================================
// Inline glossary editor state
// ============================================================================

// Working copy of the *entire* glossary. Saving writes this array back verbatim,
// so it must always hold every stored term — never a truncated preview.
// Each item: { source: string, target: string }
let glossaryEditorRows = [];
let glossaryEditorDirty = false;
let glossaryEditorTargetLang = ''; // from loaded TSV / storage meta
// False until the full dictionary has been read back from the background. Saving
// while false would overwrite the stored glossary with an incomplete list.
let glossaryEditorLoaded = false;

// Rows are edited in memory but only this many are put in the DOM at once —
// a 20k-term dictionary would otherwise mean 60k input elements. The filter box
// is how users reach terms past the cap.
const GLOSSARY_RENDER_MAX = 300;

function markGlossaryDirty() {
    glossaryEditorDirty = true;
    if (elements.glossaryUnsavedHint) elements.glossaryUnsavedHint.hidden = false;
}

function markGlossaryClean() {
    glossaryEditorDirty = false;
    if (elements.glossaryUnsavedHint) elements.glossaryUnsavedHint.hidden = true;
}

// Render glossaryEditorRows into the DOM table, honouring the filter box and
// the render cap. Handlers close over the row's index in the *full* array, so
// editing a filtered view still writes to the right entry.
function renderGlossaryRows() {
    const container = elements.glossaryRows;
    if (!container) return;

    const query = (elements.glossaryFilter ? elements.glossaryFilter.value : '').trim().toLowerCase();
    const matches = [];
    for (let idx = 0; idx < glossaryEditorRows.length; idx++) {
        const entry = glossaryEditorRows[idx];
        if (!query
            || entry.source.toLowerCase().includes(query)
            || entry.target.toLowerCase().includes(query)) {
            matches.push(idx);
        }
    }

    const shown = matches.slice(0, GLOSSARY_RENDER_MAX);
    container.replaceChildren();
    for (const idx of shown) {
        const entry = glossaryEditorRows[idx];
        const row = document.createElement('div');
        row.className = 'glossary-row';

        const srcInput = document.createElement('input');
        srcInput.type = 'text';
        srcInput.value = entry.source;
        srcInput.placeholder = t('glossary.placeholderSource');
        srcInput.addEventListener('input', () => {
            glossaryEditorRows[idx].source = srcInput.value;
            markGlossaryDirty();
        });

        const tgtInput = document.createElement('input');
        tgtInput.type = 'text';
        tgtInput.value = entry.target;
        tgtInput.placeholder = t('glossary.placeholderKeep');
        tgtInput.addEventListener('input', () => {
            glossaryEditorRows[idx].target = tgtInput.value;
            markGlossaryDirty();
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'glossary-row-delete';
        delBtn.textContent = '×';
        delBtn.title = t('glossary.removeTerm');
        delBtn.addEventListener('click', () => {
            glossaryEditorRows.splice(idx, 1);
            markGlossaryDirty();
            renderGlossaryRows();
        });

        row.append(srcInput, tgtInput, delBtn);
        container.appendChild(row);
    }

    updateGlossaryRowsNote(matches.length, shown.length, !!query);
}

// Line under the table explaining what the visible rows represent, so a capped
// or filtered view is never mistaken for the whole dictionary.
function updateGlossaryRowsNote(matchCount, shownCount, filtered) {
    const note = elements.glossaryRowsNote;
    if (!note) return;
    const total = glossaryEditorRows.length;

    if (!total) {
        note.textContent = t('glossary.noteEmpty');
    } else if (filtered && shownCount < matchCount) {
        note.textContent = t('glossary.noteFilteredCapped', {
            shown: shownCount.toLocaleString(),
            matched: matchCount.toLocaleString(),
            total: total.toLocaleString()
        });
    } else if (filtered) {
        note.textContent = t('glossary.noteFiltered', {
            matched: matchCount.toLocaleString(),
            total: total.toLocaleString()
        });
    } else if (shownCount < total) {
        note.textContent = t('glossary.noteCapped', {
            shown: shownCount.toLocaleString(),
            total: total.toLocaleString()
        });
    } else if (total === 1) {
        note.textContent = t('glossary.noteTotalOne');
    } else {
        note.textContent = t('glossary.noteTotal', { total: total.toLocaleString() });
    }
    note.hidden = false;
}

// Show/hide the glossary editor and its controls — kept collapsed to just the
// toggle when the feature is off so it doesn't clutter the page for users who
// don't use it.
function updateGlossaryVisibility() {
    if (elements.glossarySettings) {
        elements.glossarySettings.hidden = !(elements.useGlossary && elements.useGlossary.checked);
    }
}

// Update the badge showing term count above the table.
function updateGlossaryBadge(count) {
    if (!elements.glossaryStatusBadge) return;
    if (!count) {
        elements.glossaryStatusBadge.textContent = t('glossary.badgeZero');
        elements.glossaryStatusBadge.className = 'glossary-badge';
    } else {
        elements.glossaryStatusBadge.textContent = t('glossary.badgeCount', { count: count.toLocaleString() });
        elements.glossaryStatusBadge.className = 'glossary-badge loaded';
    }
}

// Load the full glossary from the background service and populate the editor.
async function refreshGlossaryStatus() {
    let res = null;
    try {
        res = await browserAPI.runtime.sendMessage({ type: 'GET_GLOSSARY_ENTRIES' });
    } catch (e) { /* background not ready */ }

    if (!res || !Array.isArray(res.entries)) {
        // Couldn't read the dictionary. Leave the editor empty but locked, so a
        // stray Save can't wipe terms we simply failed to load.
        glossaryEditorLoaded = false;
        glossaryEditorRows = [];
        renderGlossaryRows();
        updateGlossaryBadge(0);
        if (elements.glossaryRowsNote) {
            elements.glossaryRowsNote.textContent = t('glossary.loadFailed');
        }
        markGlossaryClean();
        return;
    }

    glossaryEditorLoaded = true;
    glossaryEditorTargetLang = res.target || '';
    glossaryEditorRows = res.entries.map(([source, target]) => ({ source, target: target || '' }));
    renderGlossaryRows();
    updateGlossaryBadge(glossaryEditorRows.length);
    // Sync the target language dropdown
    glossaryTargetLangPicker.setValue(glossaryEditorTargetLang || '');
    markGlossaryClean();
}
