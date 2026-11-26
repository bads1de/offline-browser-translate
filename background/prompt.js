/**
 * Prompt templates, prompt building and response parsing.
 *
 * Exposed as `LctBgPrompt` on the global object. Loaded by background/entry.js
 * (importScripts) and by manifest `background.scripts` for Firefox.
 */

(function (root) {
    'use strict';
    if (root.LctBgPrompt) return;

const PROMPT_TEMPLATES = {
    default: {
        system: `You are a professional translator. Translate the given texts to {{targetLanguage}}. 
Respond ONLY with a JSON object in this exact format:
{"translations": [{"id": 0, "text": "translated text"}, {"id": 1, "text": "another translation"}]}
Maintain the original meaning, tone, and formatting. Do not add explanations.`,
        user: `Translate the following texts to {{targetLanguage}}:\n{{texts}}`
    },
    translategemma: {
        // TranslateGemma EXACT format - do not modify
        system: '',
        user: `You are a professional {{sourceLang}} ({{sourceCode}}) to {{targetLang}} ({{targetCode}}) translator. Your goal is to accurately convey the meaning and nuances of the original {{sourceLang}} text while adhering to {{targetLang}} grammar, vocabulary, and cultural sensitivities.
Produce only the {{targetLang}} translation, without any additional explanations or commentary. Please translate the following {{sourceLang}} text into {{targetLang}}:


{{texts}}`
    },
    simple: {
        system: `You are a translator. Translate to {{targetLanguage}}. Output JSON only:
{"translations": [{"id": N, "text": "translation"}]}`,
        user: `Translate to {{targetLanguage}}:\n{{texts}}`
    },
    hunyuan: {
        system: '',
        user: `Translate the following segment into {{targetLanguage}}, without additional explanation.\n{{texts}}`
    }
};

// ============================================================================
// Translation Logic
// ============================================================================

function formatTextsForPrompt(textItems) {
    return textItems.map(item => `[${item.id}]: ${item.text}`).join('\n');
}

function buildPrompt(template, vars) {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
}

// A small allowlist of inline HTML tags that occasionally leak from models.
// We only strip these — arbitrary "<...>" is left alone so legitimate text like
// "a < b" or "<3" is never mangled.
const LEAKED_HTML_TAG = /<\/?(?:div|span|p|br|b|i|em|strong|ul|ol|li|a|h[1-6])\b[^>]*>/gi;

// Clean translation text - remove ID prefixes and HTML garbage that LLM might include
function cleanTranslationText(text) {
    if (!text) return text;
    // Remove patterns like "[99]: ", "[99]:", "99: ", "99:" at start of text
    let cleaned = text.replace(/^\[?\d+\]?:\s*/g, '');
    // Remove only known HTML tags that occasionally leak through
    cleaned = cleaned.replace(LEAKED_HTML_TAG, '');
    // Normalize multiple spaces to single space (but preserve leading/trailing)
    cleaned = cleaned.replace(/  +/g, ' ');
    // Don't trim - let the content script handle whitespace preservation from original
    return cleaned;
}

// Heuristic: does this string look like leaked structure (JSON/markup) rather
// than an actual translation? Used to reject garbage so the page keeps its
// original text instead of being broken. Be conservative to avoid false positives.
function isSuspiciousTranslation(text) {
    if (text === null || text === undefined) return true;
    const t = String(text).trim();
    if (!t) return true;
    // Must contain at least one letter — pure punctuation/braces is garbage.
    if (!/\p{L}/u.test(t)) return true;
    // Leaked JSON keys from our own schema.
    if (/["']?(?:translations|id|text)["']?\s*:/.test(t)) return true;
    // Wrapped in a JSON object/array container with a quote or colon inside.
    if (/^[\[{][\s\S]*[\]}]$/.test(t) && /["':]/.test(t)) return true;
    // Markdown code fence.
    if (t.includes('```')) return true;
    return false;
}

// Extract the first balanced {...} object from a string, respecting strings and
// escapes. More reliable than a greedy regex when the model adds prose around it.
function extractJsonObject(text) {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
        } else if (ch === '"') {
            inString = true;
        } else if (ch === '{') {
            depth++;
        } else if (ch === '}') {
            depth--;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null; // Unbalanced (e.g. truncated) — let the caller fall back.
}

function parseTranslationResponse(response, originalItems, finishReason) {
    const expectedCount = originalItems.length;
    let translations = [];

    try {
        // Clean up markdown code blocks if present
        let cleanResponse = response
            .replace(/^```json\s*/m, '')
            .replace(/^```\s*/m, '')
            .replace(/\s*```$/m, '')
            .trim();

        // Try to parse as JSON first
        const parsed = JSON.parse(cleanResponse);
        if (parsed.translations && Array.isArray(parsed.translations)) {
            translations = parsed.translations;
        } else if (Array.isArray(parsed)) {
            translations = parsed;
        }
    } catch (e) {
        // Try to extract a balanced JSON object embedded in surrounding prose
        const jsonStr = extractJsonObject(response);
        if (jsonStr) {
            try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.translations && Array.isArray(parsed.translations)) {
                    translations = parsed.translations;
                } else if (Array.isArray(parsed)) {
                    translations = parsed;
                }
            } catch (e2) {
                // Fall through to line-by-line parsing
            }
        }
    }

    // If JSON parsing worked, check if we need to remap IDs
    if (translations.length > 0) {
        // Clean up translations - remove any ID prefixes from the text
        translations = translations.map(t => ({
            ...t,
            text: cleanTranslationText(t.text)
        }));

        // Check if LLM returned sequential IDs (0, 1, 2...) instead of our IDs
        const llmIds = translations.map(t => t.id);
        const ourIds = originalItems.map(t => t.id);
        const llmUsedSequential = llmIds.every((id, i) => id === i);
        const idsMismatch = !llmIds.some(id => ourIds.includes(id));

        if (llmUsedSequential || idsMismatch) {
            // console.log('[Background] LLM used sequential IDs, remapping to original IDs');
            // Map sequential LLM IDs to our original IDs
            translations = translations.map((t, index) => ({
                id: originalItems[index]?.id ?? t.id,
                text: t.text,
                error: t.error
            }));
        }

        return translations;
    }

    // Single item: the entire response is one translation (preserve newlines)
    if (expectedCount === 1) {
        let text = response.trim().replace(/^\[?\d+\]?:\s*/, '');
        return [{ id: originalItems[0].id, text: cleanTranslationText(text) }];
    }

    // Fallback: parse by [id]: markers, grouping continuation lines per segment
    const idMarkerRegex = /^\[?(\d+)\]?:\s*(.*)$/;
    const segments = [];
    let current = null;

    for (const line of response.split('\n')) {
        const match = line.match(idMarkerRegex);
        if (match) {
            if (current) segments.push(current);
            current = { id: parseInt(match[1]), text: match[2] };
        } else if (current) {
            current.text += '\n' + line;
        }
    }
    if (current) segments.push(current);

    // When the server tells us it cut generation off mid-output, the last segment
    // in the response was being written the instant that happened — it may be a
    // half-formed sentence ("Los precios pue"), not a usable translation. Drop it
    // so it's treated as missing and cleanly retried, instead of risking a mangled
    // translation landing on the page. Every earlier segment finished before the
    // cutoff and is unaffected.
    if (finishReason === 'length' && segments.length > 0) {
        const cut = segments.pop();
        debugWarn(`[Background] response was cut off by the output length limit — `
            + `discarding the in-progress last segment (id ${cut.id}) instead of trusting a possibly-truncated translation`);
        if (segments.length === 0) {
            // The one segment we had was the one being cut — nothing usable left.
            // Bail out here rather than falling through to the last-resort parser
            // below, which would re-read the same truncated raw response.
            return [];
        }
    }

    if (segments.length > 0) {
        // Every batch sends the model 0-indexed sequential labels (see requestBatch),
        // so a clean truncation (model stops after item k of N) and a
        // dropped-and-renumbered middle item both produce the same shape: an
        // unbroken run 0..k-1 shorter than expected. finishReason (from the API's
        // finish_reason/done_reason) resolves the ambiguity when it's available:
        // 'length' means the model was cut off mid-output and whatever it emitted
        // up to that point is exactly what it intended — safe to trust. Anything
        // else (usually 'stop', or unknown on servers that don't report it) means
        // the model believed it was done despite the shortfall, which is the more
        // suspicious shape. Either way we trust the prefix and retry only the
        // missing tail — rejecting the whole batch here previously forced every
        // truncated response through the slow per-item fallback, which in practice
        // was most responses. Only reject outright on unambiguous corruption: a
        // label outside our range, or a repeated label.
        const ids = segments.map(s => s.id);
        const ourIds = new Set(originalItems.map(item => item.id));
        const allOurs = ids.every(id => ourIds.has(id));
        const unique = new Set(ids).size === ids.length;
        if (!allOurs || !unique) {
            debugWarn(`[Background] expected ${expectedCount} items, got labels [${ids.join(',')}]`
                + ` - numbering unreliable, rejecting batch`);
            return [];
        }
        if (ids.length < expectedCount) {
            const reason = finishReason === 'length'
                ? 'model hit its output length limit'
                : `model stopped on its own (finish_reason=${finishReason || 'unknown'}) — possible mid-batch skip`;
            debugWarn(`[Background] batch returned ${ids.length}/${expectedCount} items - ${reason}. Trusting the ${ids.length} received, retrying the rest.`);
        }

        for (const seg of segments) {
            const text = seg.text.trim();
            if (!text) continue;
            translations.push({ id: seg.id, text: cleanTranslationText(text) });
        }
        return translations;
    }

    // Last resort: no markers found, one line = one translation
    for (let i = 0; i < Math.min(response.split('\n').filter(l => l.trim()).length, expectedCount); i++) {
        const line = response.split('\n').filter(l => l.trim())[i];
        const originalId = originalItems[i]?.id;
        if (originalId !== undefined) translations.push({ id: originalId, text: cleanTranslationText(line.trim()) });
    }
    return translations;
}

// JSON schema for the batched translation response. The inner shape is shared:
// Ollama wants the bare schema in `format`, LMStudio/OpenAI want it wrapped.
const TRANSLATION_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "translations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": { "type": "integer" },
                    "text": { "type": "string" }
                },
                "required": ["id", "text"],
                "additionalProperties": false
            }
        }
    },
    "required": ["translations"],
    "additionalProperties": false
};

    root.LctBgPrompt = {
        PROMPT_TEMPLATES,
        formatTextsForPrompt,
        buildPrompt,
        cleanTranslationText,
        isSuspiciousTranslation,
        parseTranslationResponse,
        TRANSLATION_JSON_SCHEMA
    };
})(typeof self !== 'undefined' ? self : globalThis);
