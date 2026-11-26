/**
 * Local LLM provider detection, model listing and model selection.
 *
 * Exposed as `LctBgProviders` on the global object. Loaded by background/entry.js
 * (importScripts) and by manifest `background.scripts` for Firefox.
 */

(function (root) {
    'use strict';
    if (root.LctBgProviders) return;
    function invalidateModelCache() {
        cachedModels = null;
        cachedModelsKey = null;
        modelsCacheTime = 0;
    }


// Cache for models to avoid repeated API calls during translation. Keyed by
// provider + server URLs so switching providers (or pointing at a different
// server) can never be served a stale list from a previous configuration.
let cachedModels = null;
let cachedModelsKey = null;
let modelsCacheTime = 0;
const MODEL_CACHE_TTL = 60000; // 60 seconds

// ============================================================================
// Provider Detection & Model Listing
// ============================================================================

// Normalize a user-entered server URL into a bare base (scheme://host:port):
// trims whitespace and drops trailing slashes and a trailing /v1. Users of
// OpenAI-compatible servers (llama.cpp, vLLM) habitually paste the base URL as
// ".../v1" because that's what OpenAI clients expect, but we append the full
// /v1/... path ourselves. LM Studio's router tolerates the resulting
// /v1/v1/... and //v1/... paths; llama.cpp and vLLM route strictly and 404,
// which made those servers look unsupported (issue #4).
//
// Also rewrites a bare "localhost" host to 127.0.0.1. Ollama's default bind
// is IPv4-only, but on systems where /etc/hosts lists "::1 localhost",
// Firefox resolves "localhost" via IPv6 first and gets a hard connection
// refusal instead of falling back to IPv4 - CORS logic never even runs.
function normalizeServerUrl(rawUrl) {
    let url = (rawUrl || '').trim().replace(/\/+$/, '').replace(/\/v1$/i, '').replace(/\/+$/, '');
    try {
        const parsed = new URL(url);
        if (parsed.hostname === 'localhost') {
            parsed.hostname = '127.0.0.1';
            url = parsed.toString().replace(/\/+$/, '');
        }
    } catch (_) {
        // Malformed input; leave as-is so the caller's fetch surfaces the real error.
    }
    return url;
}

async function probeProvider(url, originProbeUrl) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (response.ok && originProbeUrl) {
            // A GET sent by an extension carries no Origin header, so a server-side
            // origin check (e.g. Ollama without OLLAMA_ORIGINS) lets the probe
            // through even though it will reject the POST translation requests.
            // Send a cheap POST, which always carries an Origin header, and treat
            // a 403 as "running but blocking the extension".
            try {
                const controller3 = new AbortController();
                const timeout3 = setTimeout(() => controller3.abort(), 2000);
                const originResponse = await fetch(originProbeUrl, {
                    method: 'POST',
                    body: '{}',
                    signal: controller3.signal
                });
                clearTimeout(timeout3);
                if (originResponse.status === 403) {
                    return { ok: false, blocked: true };
                }
            } catch (_) {
                // Origin probe failed for another reason; keep the GET verdict.
            }
        }
        return { ok: response.ok, blocked: false };
    } catch (e) {
        // Normal fetch failed — could be server not running, or CORS blocking the response.
        // Try a no-cors fetch: it gives an opaque response (can't read status/body) but
        // will not throw if the server is reachable, only if it is truly unreachable.
        try {
            const controller2 = new AbortController();
            const timeout2 = setTimeout(() => controller2.abort(), 2000);
            await fetch(url, {
                method: 'GET',
                mode: 'no-cors',
                signal: controller2.signal
            });
            clearTimeout(timeout2);
            return { ok: false, blocked: true };
        } catch (_) {
            return { ok: false, blocked: false };
        }
    }
}

async function detectProviders(ollamaUrl, lmstudioUrl, provider = 'auto') {
    ollamaUrl = normalizeServerUrl(ollamaUrl);
    lmstudioUrl = normalizeServerUrl(lmstudioUrl);
    // Probe both providers in parallel, skipping any provider the user has
    // explicitly not selected, so one slow/absent server doesn't delay the other.
    const skipped = { ok: false, blocked: false };
    const [ollama, lmstudio] = await Promise.all([
        (provider === 'ollama' || provider === 'auto') ? probeProvider(`${ollamaUrl}/api/tags`, `${ollamaUrl}/api/show`) : skipped,
        (provider === 'lmstudio' || provider === 'auto') ? probeProvider(`${lmstudioUrl}/v1/models`) : skipped
    ]);

    return {
        ollama: ollama.ok,
        ollama_blocked: ollama.blocked,
        lmstudio: lmstudio.ok,
        lmstudio_blocked: lmstudio.blocked
    };
}

async function listOllamaModels(url) {
    url = normalizeServerUrl(url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(`${url}/api/tags`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error('Failed to fetch Ollama models');
        const data = await response.json();
        return (data.models || []).map(m => ({ id: m.name, name: m.name, provider: 'ollama' }));
    } catch (e) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') throw new Error('Ollama model listing timed out');
        throw e;
    }
}

async function listLMStudioModels(url) {
    url = normalizeServerUrl(url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(`${url}/v1/models`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error('Failed to fetch LMStudio models');
        const data = await response.json();
        return (data.data || []).map(m => ({ id: m.id, name: m.id, provider: 'lmstudio' }));
    } catch (e) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') throw new Error('LMStudio model listing timed out');
        throw e;
    }
}

// Stable identity for "which servers are we listing models from". Two calls with
// the same signature hit the same servers, so the 60s TTL cache stays valid; any
// change to provider or URLs invalidates it.
function modelCacheKey(settings) {
    return [
        settings.provider || 'auto',
        normalizeServerUrl(settings.ollamaUrl),
        normalizeServerUrl(settings.lmstudioUrl),
    ].join('|');
}

async function listModels(settings, useCache = true) {
    const key = modelCacheKey(settings);
    // Return cached models if available and not expired
    if (useCache && cachedModels && cachedModelsKey === key && (Date.now() - modelsCacheTime < MODEL_CACHE_TTL)) {
        return cachedModels;
    }

    const models = [];
    const provider = settings.provider;

    // Query both providers in parallel; allSettled keeps results positional so
    // LMStudio models still come first, and a failure only propagates when that
    // provider was explicitly selected.
    const [lmstudioResult, ollamaResult] = await Promise.allSettled([
        (provider === 'lmstudio' || provider === 'auto')
            ? listLMStudioModels(settings.lmstudioUrl) : Promise.resolve([]),
        (provider === 'ollama' || provider === 'auto')
            ? listOllamaModels(settings.ollamaUrl) : Promise.resolve([])
    ]);
    if (lmstudioResult.status === 'fulfilled') models.push(...lmstudioResult.value);
    else if (provider === 'lmstudio') throw lmstudioResult.reason;
    if (ollamaResult.status === 'fulfilled') models.push(...ollamaResult.value);
    else if (provider === 'ollama') throw ollamaResult.reason;

    // Update cache
    cachedModels = models;
    cachedModelsKey = key;
    modelsCacheTime = Date.now();

    return models;
}

async function autoDetectAndSelectModel() {
    try {
        const settings = await root.LctBgSettings.getSettings();
        if (settings.selectedModel) return null; // already configured

        const models = await listModels(settings, false); // force fresh fetch
        if (models.length === 0) return null;

        // Prefer a translation-specialized model if one is loaded, else first available.
        // The request format is derived from the model automatically (requestFormat: 'auto'),
        // so we only need to pick the model and provider here.
        const preferred = models.find(m => detectRequestFormat(m.id) !== 'default') || models[0];

        await root.LctBgSettings.saveSettings({
            selectedModel: preferred.id,
            provider: preferred.provider
        });
        console.log(`[Background] Auto-selected model: ${preferred.id} (${preferred.provider})`);
        return preferred;
    } catch (e) {
        console.warn('[Background] Auto model detection failed:', e.message);
        return null;
    }
}

async function detectModelProvider(modelId, settings) {
    // Use cached models to avoid extra API calls
    const models = await listModels(settings, true);
    const model = models.find(m => m.id === modelId);
    return model ? model.provider : null;
}

// LM Studio's native (non-OpenAI-compatible) REST API exposes per-model load
// state ('not-loaded' | 'loading' | 'loaded'), which the OpenAI-compatible
// /v1/models endpoint doesn't. Used to show "Loading model..." instead of a
// progress bar that looks frozen while LM Studio JIT-loads the model on the
// first request. Returns null if unavailable (older LM Studio, or not LM
// Studio at all) so callers can just skip the check.
async function getLMStudioModelState(url, modelId) {
    const path = modelId.split('/').map(encodeURIComponent).join('/');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
        const response = await fetch(`${normalizeServerUrl(url)}/api/v0/models/${path}`, { signal: controller.signal });
        if (!response.ok) return null;
        const data = await response.json();
        return data.state || null;
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

    root.LctBgProviders = {
        normalizeServerUrl,
        detectProviders,
        listModels,
        detectModelProvider,
        getLMStudioModelState,
        autoDetectAndSelectModel,
        invalidateModelCache
    };
})(typeof self !== 'undefined' ? self : globalThis);
