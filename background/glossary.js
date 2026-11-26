/**
 * User glossary: lazily loaded dictionary, Aho-Corasick matching, and the
 * prompt block built from the terms found in a batch.
 *
 * Exposed as `LctBgGlossary` on the global object. Loaded by background/entry.js
 * (importScripts) and by manifest `background.scripts` for Firefox.
 */

(function (root) {
    'use strict';
    if (root.LctBgGlossary) return;
    const { browserAPI, hashString } = root.LctBgCore;

// ============================================================================
// Glossary
// User-supplied proper-noun dictionary. Only terms that actually appear in the
// batch being translated are injected into the prompt, so the dictionary itself
// can be large (tens of thousands of entries) without bloating requests.
//
// Stored in storage.local under 'glossary' as an array of [source, target]
// pairs. An empty/identical target means "keep as-is" (do not translate).
// Matching is case-sensitive and Latin word-boundary aware (proper nouns); an
// Aho-Corasick automaton is built lazily so a batch is scanned in one pass.
// ============================================================================

const GLOSSARY_KEY = 'glossary';
const GLOSSARY_META_KEY = 'glossaryMeta';  // { name, loadedAt } of the loaded TSV, for the options UI
const GLOSSARY_MAX_HITS = 40;   // cap terms injected per batch to keep prompts small
const GLOSSARY_PREVIEW_MAX = 200; // rows sent to the options page for the preview list

let glossaryEntries = null;     // Array<[source, target]>, lazily loaded
let glossaryAutomaton = null;   // built Aho-Corasick root, or null
let glossaryExactIndex = null;  // Map<source, target> for whole-segment lookups
let glossaryTargetLang = '';    // '#target: xx' TSV directive; '' = apply to any target
let glossarySig = null;         // content hash folded into the cache key (see promptSig)

async function loadGlossary() {
    if (glossaryEntries) return glossaryEntries;
    try {
        const result = await browserAPI.storage.local.get([GLOSSARY_KEY, GLOSSARY_META_KEY]);
        const entries = result[GLOSSARY_KEY];
        glossaryEntries = Array.isArray(entries) ? entries : [];
        glossaryTargetLang = (result[GLOSSARY_META_KEY] && result[GLOSSARY_META_KEY].target) || '';
    } catch (e) {
        console.error('Failed to load glossary:', e);
        glossaryEntries = [];
        glossaryTargetLang = '';
    }
    glossaryAutomaton = null;
    glossaryExactIndex = null;
    glossarySig = null;
    return glossaryEntries;
}

// Reset in-memory glossary so the next translate reloads it. Called after the
// user replaces or clears the dictionary.
function invalidateGlossary() {
    glossaryEntries = null;
    glossaryAutomaton = null;
    glossaryExactIndex = null;
    glossaryTargetLang = '';
    glossarySig = null;
}

// A glossary maps source terms to ONE target language. When the TSV declares it
// (via a `#target: xx` line), only apply the glossary when translating into that
// language — otherwise a Japanese dictionary would inject Japanese into a
// Spanish translation. Undeclared glossaries apply to every target (legacy).
function glossaryAppliesTo(targetLanguage) {
    if (!glossaryTargetLang) return true;
    const base = (targetLanguage || '').split('-')[0].toLowerCase();
    return glossaryTargetLang === base;
}

// Compact token identifying the active glossary for the translation cache key:
// '' when the glossary is off/empty/inapplicable (so keys match the no-glossary
// ones), else a hash of its entries. This keeps cached output honest when the
// user toggles "Use glossary" or switches target language — without it, text
// translated with glossary hints would be served from cache after disabling it.
async function getGlossarySignature(settings, targetLanguage) {
    if (settings.useGlossary === false) return '';
    const entries = await loadGlossary();
    if (!entries.length || !glossaryAppliesTo(targetLanguage)) return '';
    if (glossarySig === null) glossarySig = hashString(JSON.stringify(entries));
    return glossarySig;
}

// Map of source => target for whole-segment lookups. A segment that consists
// entirely of a glossary term (e.g. the nav heading "About") is translated
// deterministically from this map instead of being sent to the model — prompt
// hints only nudge the model, and short context-free labels are exactly where
// small models produce broken output. An empty target means "keep as-is", same
// as the prompt-hint path. Returns null when the glossary is off or empty.
async function getGlossaryExactIndex(settings, targetLanguage) {
    if (settings.useGlossary === false) return null;
    const entries = await loadGlossary();
    if (!entries.length || !glossaryAppliesTo(targetLanguage)) return null;
    if (!glossaryExactIndex) {
        glossaryExactIndex = new Map();
        for (const entry of entries) {
            const src = entry && entry[0];
            if (!src) continue;
            const tgt = entry[1];
            glossaryExactIndex.set(src, (tgt === undefined || tgt === '') ? src : tgt);
        }
    }
    return glossaryExactIndex;
}

function isWordChar(c) {
    return c !== '' && c !== undefined && /[\p{L}\p{N}_]/u.test(c);
}

// Build an Aho-Corasick automaton over the source strings (case-sensitive,
// UTF-16 unit granularity — fine for Latin proper nouns).
function buildGlossaryAutomaton(entries) {
    const root = { next: new Map(), fail: null, out: [] };
    for (let i = 0; i < entries.length; i++) {
        const pat = entries[i] && entries[i][0];
        if (!pat) continue;
        let node = root;
        for (let j = 0; j < pat.length; j++) {
            const ch = pat[j];
            let child = node.next.get(ch);
            if (!child) { child = { next: new Map(), fail: null, out: [] }; node.next.set(ch, child); }
            node = child;
        }
        node.out.push(i);
    }
    const queue = [];
    for (const child of root.next.values()) { child.fail = root; queue.push(child); }
    while (queue.length) {
        const node = queue.shift();
        for (const [ch, child] of node.next) {
            let f = node.fail;
            while (f && !f.next.has(ch)) f = f.fail;
            child.fail = (f && f.next.get(ch)) || root;
            if (child.fail.out.length) child.out = child.out.concat(child.fail.out);
            queue.push(child);
        }
    }
    return root;
}

// Find glossary entries that occur in `text`. Returns an array of entry indices,
// deduped, in first-seen order, capped at GLOSSARY_MAX_HITS. A Latin match is
// rejected when it sits inside a larger word (e.g. "Container" in "Containers").
function scanGlossary(root, entries, text) {
    const seen = new Set();
    const order = [];
    let node = root;
    for (let i = 0; i < text.length && order.length < GLOSSARY_MAX_HITS; i++) {
        const ch = text[i];
        while (node !== root && !node.next.has(ch)) node = node.fail;
        node = node.next.get(ch) || root;
        if (!node.out.length) continue;
        for (const idx of node.out) {
            if (seen.has(idx)) continue;
            const pat = entries[idx][0];
            const end = i + 1;
            const start = end - pat.length;
            const before = start > 0 ? text[start - 1] : '';
            const after = end < text.length ? text[end] : '';
            const cutStart = isWordChar(before) && isWordChar(pat[0]);
            const cutEnd = isWordChar(after) && isWordChar(pat[pat.length - 1]);
            if (cutStart || cutEnd) continue;
            seen.add(idx);
            order.push(idx);
            if (order.length >= GLOSSARY_MAX_HITS) break;
        }
    }
    return order;
}

// Build the glossary instruction block for the terms found in `text`. Returns ''
// when the glossary is empty or nothing matches, so prompts are unchanged.
async function buildGlossaryBlock(settings, text, targetLanguage) {
    if (settings.useGlossary === false) return '';
    const entries = await loadGlossary();
    if (!entries.length || !glossaryAppliesTo(targetLanguage)) return '';
    if (!glossaryAutomaton) glossaryAutomaton = buildGlossaryAutomaton(entries);
    const hits = scanGlossary(glossaryAutomaton, entries, text);
    if (!hits.length) return '';
    const lines = hits.map(idx => {
        const [src, tgt] = entries[idx];
        const target = (tgt === undefined || tgt === '') ? src : tgt;
        return `- "${src}" => "${target}"`;
    });
    return `[Glossary] Use these exact translations for the listed terms. Keep them consistent and do not alter them:\n${lines.join('\n')}`;
}

    root.LctBgGlossary = {
        GLOSSARY_KEY,
        GLOSSARY_META_KEY,
        GLOSSARY_PREVIEW_MAX,
        loadGlossary,
        invalidateGlossary,
        getGlossarySignature,
        getGlossaryExactIndex,
        buildGlossaryBlock
    };
})(typeof self !== 'undefined' ? self : globalThis);
