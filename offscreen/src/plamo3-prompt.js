/**
 * PFML3 (PLaMo 3 Translate prompt format) builder — pure functions, no engine.
 *
 * hachiue's `translateText` helper builds a simplified dialect that the model
 * ignores (glossary as <|plamo:msg|>+tab-separated entries; form values with a
 * capitalized first letter). The model card documents index/item pairs and
 * lowercase form values, and the 0.8B model respects exactly that
 * (verified 2026-11-08). Keeping this in a separate module so it can be unit
 * tested without WebGPU.
 *
 * Model card reference ("PFML3 Prompt Format"):
 *   <|plamo:tag|>dataset<|plamo:msg|>translation
 *   [<|plamo:tag|>context<|plamo:msg|>...]
 *   [<|plamo:tag|>glossary<|plamo:index|>src<|plamo:item|>tgt ...]
 *   <|plamo:tag|>input[<|plamo:key|>lang<|plamo:val|>xx]<|plamo:msg|>source text
 *   <|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>ja[<|plamo:key|>form<|plamo:val|>plain|polite]<|plamo:msg|>
 */

// Strip PLaMo control tags from generated output.
export function stripPlamoTags(s) {
    return (s || '').replace(/<\|plamo:[^>]*\|>/g, '').trim();
}

const FORM_VALUES = new Set(['plain', 'polite']);

/**
 * @param {object} opts
 * @param {string} opts.text       Source text to translate (required)
 * @param {string} opts.targetLang Target language code, e.g. 'en', 'ja' (required)
 * @param {string} [opts.sourceLang] Source language code, or 'auto' (omitted)
 * @param {'polite'|'plain'} [opts.form] Japanese politeness level (ja targets only)
 * @param {Array<{source:string,target:string}>} [opts.glossary] Terminology pairs
 * @param {string} [opts.context]  Reference context (document heading, page type, ...)
 * @param {Array<{source:string,translation:string,sourceLang?:string,targetLang?:string}>} [opts.history]
 * @returns {string} PFML3 prompt
 */
export function buildPlamo3Prompt({ text, targetLang, sourceLang, form, glossary, context, history }) {
    const tgt = String(targetLang || 'ja').trim().toLowerCase();
    if (!String(text ?? '').trim()) throw new Error('text must not be empty');

    let prompt = '<|plamo:bos|><|plamo:tag|>dataset<|plamo:msg|>translation';

    if (context && String(context).trim()) {
        prompt += `<|plamo:tag|>context<|plamo:msg|>${String(context).trim()}`;
    }

    if (Array.isArray(glossary) && glossary.length) {
        const valid = glossary.filter(g => g && String(g.source ?? '').trim() && String(g.target ?? '').trim());
        if (valid.length) {
            prompt += '<|plamo:tag|>glossary';
            for (const g of valid) {
                prompt += `<|plamo:index|>${String(g.source).trim()}<|plamo:item|>${String(g.target).trim()}`;
            }
        }
    }

    if (Array.isArray(history)) {
        const hs = sourceLang && sourceLang !== 'auto' ? String(sourceLang).toLowerCase() : '';
        for (const h of history) {
            if (!h || !String(h.source ?? '').trim() || !String(h.translation ?? '').trim()) continue;
            const hSrc = h.sourceLang ? String(h.sourceLang).toLowerCase() : hs;
            const hTgt = h.targetLang ? String(h.targetLang).toLowerCase() : tgt;
            prompt += '<|plamo:tag|>input';
            if (hSrc) prompt += `<|plamo:key|>lang<|plamo:val|>${hSrc}`;
            prompt += `<|plamo:msg|>${String(h.source).trim()}`;
            prompt += `<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>${hTgt}<|plamo:msg|>${String(h.translation).trim()}`;
        }
    }

    prompt += '<|plamo:tag|>input';
    if (sourceLang && String(sourceLang).toLowerCase() !== 'auto') {
        prompt += `<|plamo:key|>lang<|plamo:val|>${String(sourceLang).toLowerCase()}`;
    }
    prompt += `<|plamo:msg|>${String(text)}`;

    prompt += `<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>${tgt}`;
    // form applies only to Japanese output; lowercase values, exactly as PFN documents.
    if (FORM_VALUES.has(form) && tgt.startsWith('ja')) {
        prompt += `<|plamo:key|>form<|plamo:val|>${form}`;
    }
    prompt += '<|plamo:msg|>';

    return prompt;
}
