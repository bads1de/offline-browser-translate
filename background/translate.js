/**
 * Translation pipeline: provider calls, batching, cache, glossary and the
 * per-item fallbacks.
 *
 * Exposed as `LctBgTranslate` on the global object. Loaded by background/entry.js
 * (importScripts) and by manifest `background.scripts` for Firefox.
 */

(function (root) {
    'use strict';
    if (root.LctBgTranslate) return;
    const { browserAPI, debugLog, debugWarn, perfMark, hashString } = root.LctBgCore;
    const { normalizeServerUrl, detectModelProvider } = root.LctBgProviders;
    const { PROMPT_TEMPLATES, formatTextsForPrompt, buildPrompt, cleanTranslationText,
        isSuspiciousTranslation, parseTranslationResponse, TRANSLATION_JSON_SCHEMA } = root.LctBgPrompt;
    const { buildGlossaryBlock, getGlossarySignature, getGlossaryExactIndex } = root.LctBgGlossary;

// PLaMo's per-item path is batched by joining segments with newlines. Kept in
// line with the page-side batch size, and capped by characters so one very long
// stretch of text can't overflow the model's context or dilute alignment.
const PLAMO_BATCH_MAX_ITEMS = 8;
const PLAMO_BATCH_MAX_CHARS = 1200;

// PLAIN_TEXT_FORMATS comes from languages.js (shared with the UIs).

async function callOllama(settings, modelId, systemPrompt, userPrompt, jsonOutput) {
    const body = {
        model: modelId,
        stream: false
    };

    // Request a schema-constrained JSON object when the caller wants structure.
    // Passing the full schema (not just 'json') makes Ollama enforce the shape,
    // not just valid-JSON-ness.
    if (jsonOutput) {
        body.format = TRANSLATION_JSON_SCHEMA;
    }

    body.prompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
    body.keep_alive = '30m';
    body.options = {};
    if (settings.temperature !== undefined) body.options.temperature = settings.temperature;
    if (settings.numCtx) body.options.num_ctx = settings.numCtx;

    let data;
    try {
        data = await ProviderTransport.postJson(
            `${normalizeServerUrl(settings.ollamaUrl)}/api/generate`,
            body,
            { timeoutMessage: 'Ollama request timed out after 5 minutes' }
        );
    } catch (e) {
        if (e.status === 403) {
            throw new Error('Ollama returned 403 Forbidden. The extension is being blocked by Ollama\'s CORS policy. You need to enable CORS in Ollama.');
        }
        if (e.status) {
            throw new Error(`Ollama error (${e.status}): ${e.responseText || '(empty response)'}`);
        }
        throw e;
    }
    // done_reason tells us WHY generation stopped ('stop' = the model chose to end,
    // 'length' = it hit num_predict/context and was cut off mid-output). Only
    // present on newer Ollama versions; undefined on older ones.
    debugLog(`[Background] callOllama: response length=${data.response?.length || 0} done_reason=${data.done_reason || 'unknown'}`);
    return { content: data.response, finishReason: data.done_reason || null };
}



async function callLMStudio(settings, modelId, systemPrompt, userPrompt, jsonOutput) {
    const messages = [];

    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });

    const body = {
        model: modelId,
        messages,
        temperature: settings.temperature || 0.3,
        stream: false
    };

    if (jsonOutput) {
        body.response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "translation_response",
                "strict": true,
                "schema": TRANSLATION_JSON_SCHEMA
            }
        };
    }

    let data;
    try {
        data = await ProviderTransport.postJson(
            `${normalizeServerUrl(settings.lmstudioUrl)}/v1/chat/completions`,
            body,
            {
                timeoutMessage: 'LMStudio request timed out after 5 minutes',
                connectionErrorMessage: 'Failed to connect to LMStudio. The extension is being blocked by LMStudio\'s CORS policy or the server is offline. You need to enable CORS in LMStudio.'
            }
        );
    } catch (e) {
        // Older OpenAI-compatible servers (llama.cpp before mid-2024, older vLLM)
        // reject response_format json_schema with a 400. Retry once without it —
        // the prompt already asks for JSON and the parser tolerates loose output.
        if (e.status === 400 && jsonOutput && /response_format|json_schema|guided/i.test(e.responseText || '')) {
            debugWarn('[Background] Server rejected structured output; retrying without response_format');
            return callLMStudio(settings, modelId, systemPrompt, userPrompt, false);
        }
        if (e.status) {
            throw new Error(`LMStudio error: ${e.responseText}`);
        }
        throw e;
    }
    let content = data.choices[0]?.message?.content || '';

    // Clean up markdown code blocks if present
    content = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    // finish_reason: 'stop' = the model chose to end on its own, 'length' = it hit
    // max_tokens/context and was cut off mid-output. Tells us definitively whether
    // a short batch was a token-budget truncation instead of having to guess from
    // the label pattern alone.
    const finishReason = data.choices[0]?.finish_reason || null;
    debugLog(`[Background] callLMStudio: finish_reason=${finishReason || 'unknown'}`);
    return { content, finishReason };
}

// Low-level call to whichever provider, returning { content, finishReason }.
async function callProvider(provider, settings, modelId, systemPrompt, userPrompt, jsonOutput) {
    if (provider === 'ollama') {
        return callOllama(settings, modelId, systemPrompt, userPrompt, jsonOutput);
    }
    return callLMStudio(settings, modelId, systemPrompt, userPrompt, jsonOutput);
}

// PLaMo Translate models use a dedicated PFML3 chat template: the source text goes
// in a single user message, the target language is passed via chat_template_kwargs,
// and the reply is a bare translation (no JSON). This helper handles that contract
// for both the OpenAI-compatible (llama.cpp / LM Studio) and Ollama paths.
async function translatePlamoItem(provider, settings, modelId, text, targetLangCode) {
    const lang = (targetLangCode || 'ja').toLowerCase();
    if (provider === 'ollama') {
        const body = {
            model: modelId,
            stream: false,
            messages: [{ role: 'user', content: text }],
            options: {}
        };
        if (settings.temperature !== undefined) body.options.temperature = settings.temperature;
        if (settings.numCtx) body.options.num_ctx = settings.numCtx;
        body.options.stop = ['<|plamo:tag|>', '<|plamo:bos|>'];
        let data;
        try {
            data = await ProviderTransport.postJson(
                `${normalizeServerUrl(settings.ollamaUrl)}/api/chat`,
                body,
                { timeoutMessage: 'Ollama request timed out after 5 minutes' }
            );
        } catch (e) {
            if (e.status) {
                throw new Error(`Ollama error (${e.status}): ${e.responseText || '(empty response)'}`);
            }
            throw e;
        }
        const content = data.message?.content || data.response || '';
        return cleanTranslationText((content || '').trim());
    }
    // OpenAI-compatible path (llama.cpp server, LM Studio, vLLM, ...)
    const body = {
        model: modelId,
        messages: [{ role: 'user', content: text }],
        temperature: settings.temperature !== undefined ? settings.temperature : 0.3,
        stream: false,
        stop: ['<|plamo:tag|>', '<|plamo:bos|>'],
        chat_template_kwargs: { target_lang: lang }
    };
    let data;
    try {
        data = await ProviderTransport.postJson(
            `${normalizeServerUrl(settings.lmstudioUrl)}/v1/chat/completions`,
            body,
            {
                timeoutMessage: 'Request timed out after 5 minutes',
                connectionErrorMessage: 'Failed to connect to the server. CORS policy or server offline.'
            }
        );
    } catch (e) {
        if (e.status) {
            throw new Error(`Server error (${e.status}): ${e.responseText || '(empty response)'}`);
        }
        throw e;
    }
    const content = data.choices?.[0]?.message?.content || '';
    return cleanTranslationText((content || '').trim());
}

// Translate a single text as plain text (no JSON), used as the last-resort
// fallback when structured output keeps failing. The whole response IS the
// translation — nothing to parse, nothing to break the page.
async function translatePlainItem(provider, settings, modelId, text, vars) {
    const systemPrompt = `You are a professional translator. Translate the user's text into ${vars.targetLang}. Output ONLY the translation, with no quotes, labels, JSON, or commentary.`;
    const userPrompt = text;
    const { content } = await callProvider(provider, settings, modelId, systemPrompt, userPrompt, false);
    return cleanTranslationText((content || '').trim());
}

async function translate(textItems, targetLanguage, settings, onPartial = null) {
    const translateStartTs = performance.now();
    const modelId = settings.selectedModel;
    if (!modelId) throw new Error('No model selected');

    // Detect provider if auto
    let provider = settings.provider;
    if (provider === 'auto') {
        provider = await detectModelProvider(modelId, settings);
        if (!provider) throw new Error('Could not detect model provider');
    }

    // Resolve the effective request format ('auto' -> derived from the model).
    const format = resolveRequestFormat(settings, modelId);
    const isPlainText = PLAIN_TEXT_FORMATS.has(format);
    const plamoMode = format === 'plamo' || /plamo/i.test(modelId || '');
    const template = PROMPT_TEMPLATES[format] || PROMPT_TEMPLATES.default;

    // A per-format override (edited and saved on the options page) wins over the
    // built-in template for that format. This applies whether the format was
    // picked explicitly or reached via 'auto' detection — the override is keyed
    // by the resolved format either way.
    const override = settings.customPrompts && settings.customPrompts[format];
    const systemTemplate = (override && override.system) || template.system;
    const userTemplate = (override && override.user) || template.user;

    // Template variables shared across attempts
    const targetLangName = getLanguageName(targetLanguage);
    const sourceLangCode = (settings.sourceLanguage && settings.sourceLanguage !== 'auto')
        ? settings.sourceLanguage
        : 'en';
    const baseVars = {
        targetLanguage: targetLangName,
        sourceLang: getLanguageName(sourceLangCode),
        sourceCode: sourceLangCode.toUpperCase(),
        targetLang: targetLangName,
        targetCode: targetLanguage.toUpperCase()
    };

    // Whether to request schema-constrained JSON for this (structured) format.
    const wantJson = !!settings.useStructuredOutput && !isPlainText;

    // Run one batched request for the given subset of items, returning a Map of
    // id -> good translation text (suspicious/empty results are dropped).
    const requestBatch = async (items) => {
        if (plamoMode) return new Map();
        // Map items to 0-indexed sequential IDs for the prompt to avoid confusing the LLM
        const mappedItems = items.map((item, index) => ({ id: index, text: item.text, originalId: item.id }));
        
        const vars = { ...baseVars, texts: formatTextsForPrompt(mappedItems) };
        let userPrompt = buildPrompt(userTemplate, vars);
        const systemPrompt = buildPrompt(systemTemplate, vars);

        // Prepend matching glossary terms so the model keeps proper nouns
        // consistent. Empty when the glossary is off/unmatched (prompt unchanged).
        // Skipped for plain-text formats (TranslateGemma, Hunyuan-MT): those
        // models expect a fixed prompt shape and would treat an extra instruction
        // block as text to translate. Whole-segment mappings still apply to them.
        if (!isPlainText) {
            const glossaryBlock = await buildGlossaryBlock(settings, mappedItems.map(m => m.text).join('\n'), targetLanguage);
            if (glossaryBlock) userPrompt = `${glossaryBlock}\n\n${userPrompt}`;
        }
        const llmStartTs = performance.now();
        const { content: raw, finishReason } = await callProvider(provider, settings, modelId, systemPrompt, userPrompt, wantJson);
        perfMark('bg.llm', performance.now() - llmStartTs, { n: items.length });
        debugLog(`[Background] Raw LLM response (first 300 chars):`, (raw || '').substring(0, 300));

        // Parse using the mapped items so it expects 0, 1, 2...
        const parseStartTs = performance.now();
        const parsed = parseTranslationResponse(raw, mappedItems, finishReason);
        perfMark('bg.parse', performance.now() - parseStartTs, { n: items.length });
        const good = new Map();
        for (const t of parsed) {
            if (t && t.text && !t.error && !isSuspiciousTranslation(t.text)) {
                // Find the original item to get its real ID
                const originalItem = mappedItems.find(m => m.id === t.id);
                if (originalItem) {
                    good.set(originalItem.originalId, t.text);
                }
            }
        }
        return good;
    };

    // Translate one item on its own, using the format's own template with a single
    // unmarked segment — the shape these models were trained on. There is no batch
    // structure to parse, so the result cannot land on the wrong item.
    const requestOne = async (text) => {
        if (plamoMode) {
            return await translatePlamoItem(provider, settings, modelId, text, targetLanguage);
        }
        const vars = { ...baseVars, texts: text };
        const { content } = await callProvider(provider, settings, modelId,
            buildPrompt(systemTemplate, vars), buildPrompt(userTemplate, vars), false);
        return cleanTranslationText((content || '').trim());
    };

    const results = new Map();          // originalId -> final translated text

    // ---- Cache + de-duplication --------------------------------------------
    // Group items by a key capturing everything that determines the model output
    // (model, languages, prompt shape/params) plus the source text, so each unique
    // string is translated once and identical strings reuse the result across
    // batches, pages, and sessions. promptSig folds in the resolved prompt
    // templates + structured-output mode + temperature so changing any of them
    // doesn't serve stale output. When the cache is off/unavailable we key by raw
    // text, which still de-dups within the request. cacheKey/cache* come from cache.js.
    const cacheEnabled = settings.cacheMode !== 'off'
        && typeof cacheGetMany === 'function' && typeof cacheKey === 'function';
    const promptSig = hashString([
        format, wantJson ? 'json' : 'plain', String(settings.temperature),
        systemTemplate, userTemplate,
        await getGlossarySignature(settings, targetLanguage)
    ].join('\u0000'));
    const keyFor = cacheEnabled
        ? (text) => cacheKey(modelId, sourceLangCode, targetLanguage, promptSig, text)
        : (text) => text;

    // key -> { key, item: representative, ids: [every originalId sharing this text] }
    const groups = new Map();
    for (const item of textItems) {
        const k = keyFor(item.text);
        const g = groups.get(k);
        if (g) g.ids.push(item.id);
        else groups.set(k, { key: k, item, ids: [item.id] });
    }

    // Whole-segment glossary matches resolve deterministically, before the cache
    // and the model — the user's explicit mapping beats both a cached LLM answer
    // and a fresh one. Not written to the cache (the lookup is cheaper than it).
    let glossaryExactCount = 0;
    const exactIndex = await getGlossaryExactIndex(settings, targetLanguage);
    if (exactIndex) {
        for (const g of groups.values()) {
            const direct = exactIndex.get(g.item.text.trim());
            if (direct !== undefined) {
                results.set(g.item.id, direct);
                glossaryExactCount++;
            }
        }
        if (glossaryExactCount) {
            debugLog(`[Background] glossary: ${glossaryExactCount} whole-segment match(es) resolved without the model`);
        }
    }
    const unresolvedGroups = glossaryExactCount
        ? [...groups.values()].filter(g => !results.has(g.item.id))
        : [...groups.values()];

    // Serve cache hits up front; only unresolved groups go to the model.
    let cacheHitCount = 0;      // unique source strings served from cache
    let fromCacheItems = 0;     // text elements served from cache (incl. duplicates)
    let missGroups;
    if (cacheEnabled) {
        try {
            const found = await cacheGetMany(unresolvedGroups.map(g => g.key));
            missGroups = [];
            for (const g of unresolvedGroups) {
                const cached = found.get(g.key);
                if (cached !== undefined) {
                    results.set(g.item.id, cached);
                    cacheHitCount++;
                    fromCacheItems += g.ids.length;
                } else {
                    missGroups.push(g);
                }
            }
        } catch (e) {
            debugWarn('[Background] cache read failed, translating all:', e && e.message);
            missGroups = unresolvedGroups;
        }
    } else {
        missGroups = unresolvedGroups;
    }
    debugLog(`[Background] cache: ${cacheHitCount} hit / ${missGroups.length} miss (${groups.size} unique of ${textItems.length} total)`);
    perfMark('bg.cache', performance.now() - translateStartTs, { n: textItems.length });

    let pending = missGroups.map(g => g.item);   // representative item per unresolved group

    // Attempt the batched request, retrying only the items that came back
    // missing or malformed. maxOutputRetries extra attempts after the first.
    const maxRetries = Number.isInteger(settings.maxOutputRetries) ? settings.maxOutputRetries : 2;
    debugLog(`[Background] translate: provider=${provider} model=${modelId} format=${format} items=${textItems.length} json=${wantJson}`);
    if (!plamoMode) {
        for (let attempt = 0; attempt <= maxRetries && pending.length > 0; attempt++) {
            let good;
            try {
                good = await requestBatch(pending);
            } catch (e) {
                if (attempt === maxRetries) throw e; // bubble transport errors on last try
                debugWarn(`[Background] batch attempt ${attempt + 1} threw:`, e.message);
                continue;
            }
            for (const item of pending) {
                const text = good.get(item.id);
                if (text !== undefined) results.set(item.id, text);
            }
            pending = pending.filter(item => !results.has(item.id));
            if (pending.length) {
                debugWarn(`[Background] ${pending.length} item(s) malformed/missing after attempt ${attempt + 1}`);
            }
            // Nothing usable at all from a multi-item batch means the response could not
            // be aligned. Re-sending identical input to a near-deterministic model just
            // reproduces the same failure, so skip the remaining retries and let the
            // per-item fallback below resolve it.
            if (good.size === 0 && pending.length > 1) {
                debugWarn(`[Background] batch unusable - skipping remaining retries`);
                break;
            }
        }
    }

    // PLaMo is a plain-text model whose per-item path is its main path, so one
    // request per segment dominates page time. It translates a newline-separated
    // block in place (same order, one line per input line), so group segments
    // into a single request instead. A reply whose line count doesn't match is
    // discarded and those items fall through to the per-item loop below, so a
    // misaligned answer can never land on the wrong element.
    if (plamoMode && pending.length > 1 && settings.plainTextFallback !== false) {
        const leftover = [];
        const batchable = [];
        for (const item of pending) {
            // An item containing its own newline would break the 1 line = 1 item
            // mapping; keep those on the exact per-item path.
            (String(item.text).includes('\n') ? leftover : batchable).push(item);
        }
        const chunks = [];
        let chunk = [];
        let chunkChars = 0;
        for (const item of batchable) {
            const len = String(item.text).length;
            if (chunk.length > 0 && (chunk.length >= PLAMO_BATCH_MAX_ITEMS || chunkChars + len > PLAMO_BATCH_MAX_CHARS)) {
                chunks.push(chunk);
                chunk = [];
                chunkChars = 0;
            }
            chunk.push(item);
            chunkChars += len;
        }
        if (chunk.length) chunks.push(chunk);

        for (const group of chunks) {
            const batchStartTs = performance.now();
            try {
                const text = await translatePlamoItem(provider, settings, modelId,
                    group.map(i => i.text).join('\n'), targetLanguage);
                const lines = text.split('\n').map(l => l.trim());
                if (lines.length !== group.length) {
                    debugWarn(`[Background] PLaMo batch returned ${lines.length} line(s) for ${group.length} item(s) - falling back to per-item`);
                    leftover.push(...group);
                    continue;
                }
                perfMark('bg.plamo_batch', performance.now() - batchStartTs, { n: group.length });
                group.forEach((item, index) => {
                    const translated = lines[index];
                    if (!translated || isSuspiciousTranslation(translated)) {
                        leftover.push(item);
                        return;
                    }
                    results.set(item.id, translated);
                    if (onPartial) {
                        try { onPartial({ id: item.id, text: translated }); } catch (e) { /* streaming is best-effort */ }
                    }
                });
            } catch (e) {
                debugWarn(`[Background] PLaMo batch failed (${e.message}) - falling back to per-item`);
                leftover.push(...group);
            }
        }
        pending = leftover;
    }

    // Per-item fallback: translate the still-failing items one at a time, with no
    // batch structure to parse. Plain-text formats need this too — they carry the
    // same [id]: markers in a batched prompt, and a dropped segment shifts the rest.
    // Each finished item is streamed to the tab immediately (onPartial) instead of
    // waiting for the whole batch.
    if (pending.length > 0 && settings.plainTextFallback !== false) {
        debugWarn(`[Background] Falling back to per-item translation for ${pending.length} item(s)`);
        let perItemLastError = null;
        for (const item of pending) {
            try {
                const text = isPlainText
                    ? await requestOne(item.text)
                    : await translatePlainItem(provider, settings, modelId, item.text, baseVars);
                if (text && !isSuspiciousTranslation(text)) {
                    results.set(item.id, text);
                    if (onPartial) {
                        try { onPartial({ id: item.id, text }); } catch (e) { /* streaming is best-effort */ }
                    }
                }
            } catch (e) {
                perItemLastError = e;
                debugWarn(`[Background] per-item fallback failed for id ${item.id}:`, e.message);
            }
        }
    }

    // Persist freshly produced translations. Awaited so an MV3 service worker
    // isn't torn down before the IndexedDB write commits.
    if (cacheEnabled) {
        const entries = [];
        for (const g of missGroups) {
            if (results.has(g.item.id)) entries.push([g.key, results.get(g.item.id)]);
        }
        if (entries.length) {
            try { await cacheSetMany(entries); }
            catch (e) { debugWarn('[Background] cache write failed:', e && e.message); }
        }
    }

    // Fan each group's translation out to every member sharing its source text.
    for (const g of groups.values()) {
        if (!results.has(g.item.id)) continue;
        const text = results.get(g.item.id);
        for (const id of g.ids) results.set(id, text);
    }

    // Build the final array in original order. Items that never succeeded are
    // returned with an error so the content script keeps their original text.
    perfMark('bg.translate', performance.now() - translateStartTs, { n: textItems.length });
    const translations = textItems.map(item => results.has(item.id)
        ? { id: item.id, text: results.get(item.id) }
        : { id: item.id, error: 'translation failed' });
    return { translations, fromCache: fromCacheItems, total: textItems.length, cacheActive: cacheEnabled };
}

    root.LctBgTranslate = {
        translate,
        translatePlamoItem,
        translatePlainItem,
        callOllama,
        callLMStudio,
        callProvider
    };
})(typeof self !== 'undefined' ? self : globalThis);
