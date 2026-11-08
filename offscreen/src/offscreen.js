/**
 * Offscreen Document — built-in WebGPU inference runtime.
 *
 * Hosts the hachiue engine in a hidden document so the service worker never
 * has to: the SW cannot spawn Worker() or hold a GPUDevice. Lifecycle:
 *
 *   BUILTIN_WEBGPU_LOAD_MODEL  → downloads (first time) + loads into VRAM
 *   BUILTIN_WEBGPU_TRANSLATE   → loads lazily, then translates (idle timer re-armed)
 *   BUILTIN_WEBGPU_UNLOAD      → engine.dispose() (VRAM released, OPFS cache kept)
 *   5 minutes without an inference                      → self-dispose + SW closes this document
 *
 * All messages from the SW carry `target: 'offscreen'`; everything else is ignored.
 * All engine operations are serialized through `workChain` so a load and a
 * translate can never overlap, and the idle timer never fires mid-inference.
 */
import {
    HachiueEngine,
    isModelCached,
    getCachedModelSize,
    clearModelCache,
} from 'hachiue';
import { buildPlamo3Prompt, stripPlamoTags } from './plamo3-prompt.js';

// Pinned to the commit that was current on 2026-11-08. Keep this stable so the
// OPFS chunk cache key stays valid across extension updates.
const MODEL_URL = 'https://huggingface.co/pfnet/plamo-3-translate-0.8b-GGUF/resolve/0c4af2b003fdd94b6868aa955414c1c86ee96997/plamo-3-translate-0.8b-Q4_K_M.gguf';
const MODEL_NAME = 'plamo-3-translate-0.8b-Q4_K_M.gguf';
// Byte size of the pinned file (Hugging Face reports X-Linked-Size: 573125952).
// Used for cache validation and progress display; pinned URL => fixed size.
const MODEL_SIZE_BYTES = 573125952;

const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
let IDLE_TIMEOUT_MS = DEFAULT_IDLE_TIMEOUT_MS;

let engine = null;
let engineState = 'unloaded'; // 'unloaded' | 'loading' | 'ready' | 'error'
let lastError = null;
let backendInfo = null;
let lastActivityAt = 0;
let idleTimer = null;
let workChain = Promise.resolve();
let loadPromise = null;      // in-flight load, so concurrent translates await the same load instead of racing

function log(...args) { console.log('[offscreen]', ...args); }
function warn(...args) { console.warn('[offscreen]', ...args); }

function stopIdleTimer() {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
}

function startIdleTimer() {
    stopIdleTimer();
    if (engineState !== 'ready') return;
    idleTimer = setTimeout(() => { onIdleTimeout(); }, IDLE_TIMEOUT_MS);
}

async function onIdleTimeout() {
    // Never fire while inference is queued or running.
    const pending = workChain;
    idleTimer = null;
    try { await pending; } catch { /* errors already surfaced to callers */ }
    if (Date.now() - lastActivityAt < IDLE_TIMEOUT_MS) { startIdleTimer(); return; }
    log(`idle for ${IDLE_TIMEOUT_MS}ms — disposing engine`);
    await disposeEngine();
    try {
        await chrome.runtime.sendMessage({ type: 'BUILTIN_IDLE_UNLOAD' });
    } catch (e) {
        warn('could not notify SW for document close:', e && e.message);
    }
}

async function disposeEngine() {
    stopIdleTimer();
    if (!engine) { engineState = 'unloaded'; return; }
    try { engine.dispose(); } catch (e) { warn('engine.dispose() threw:', e && e.message); }
    engine = null;
    engineState = 'unloaded';
    backendInfo = null;
}

function enqueue(operation) {
    const result = workChain.then(operation);
    // Keep the chain alive even when an operation rejects.
    workChain = result.then(() => undefined, () => undefined);
    return result;
}

function touchActivity() {
    lastActivityAt = Date.now();
    startIdleTimer();
}

let lastProgressSentAt = 0;
function sendProgress(p) {
    const now = Date.now();
    if (now - lastProgressSentAt < 100 && p.phase !== 'ready') return;
    lastProgressSentAt = now;
    chrome.runtime.sendMessage({
        type: 'OFFSCREEN_PROGRESS',
        phase: p.phase ?? 'weights',
        loadedBytes: p.loadedBytes ?? 0,
        totalBytes: p.totalBytes ?? 0,
        cached: !!p.cached,
    }).catch(() => { /* SW may be starting; drop silently */ });
}

async function ensureEngine() {
    if (engineState === 'ready' && engine) return engine;
    if (loadPromise) return loadPromise; // await the in-flight load
    if (!navigator.gpu) {
        throw new Error('WEBGPU_UNAVAILABLE: this browser cannot run the built-in model');
    }
    engineState = 'loading';
    lastError = null;
    loadPromise = (async () => {
        const t0 = performance.now();
        try {
            engine = await HachiueEngine.create({
                url: MODEL_URL,
                backend: 'webgpu',
                maxSeqLen: 2048,
                onProgress: sendProgress,
                onDeviceLost: (info) => {
                    warn('WebGPU device lost:', info.reason, info.message);
                    // Only treat post-load loss as fatal — during load, hachiue can
                    // report a transient loss and still finish successfully. Killing
                    // the state here would surface a bogus "error" while inference is
                    // about to succeed. After ready, a lost device means the engine
                    // is dead and must be re-created on next use.
                    if (engineState === 'ready') {
                        lastError = `WebGPU device lost (${info.reason})`;
                        engineState = 'error';
                        engine = null;
                    }
                },
            });
        } catch (e) {
            engineState = 'error';
            lastError = (e && e.message) || String(e);
            engine = null;
            throw new Error(`LOAD_FAILED: ${lastError}`);
        }
        backendInfo = { ...engine.backendInfo };
        engineState = 'ready';
        log(`model loaded in ${((performance.now() - t0) / 1000).toFixed(1)}s (${backendInfo.backend}${backendInfo.isWorker ? ' worker' : ''})`);
        sendProgress({ phase: 'ready', loadedBytes: 0, totalBytes: 0, cached: true });
        touchActivity();
        return engine;
    })();
    try {
        return await loadPromise;
    } finally {
        loadPromise = null;
    }
}

function statusSnapshot() {
    return {
        state: engineState,
        lastError,
        backend: backendInfo,
        lastActivityAt,
        idleMs: lastActivityAt ? Date.now() - lastActivityAt : null,
        webgpuAvailable: !!navigator.gpu,
        modelUrl: MODEL_URL,
        modelName: MODEL_NAME,
        modelSizeBytes: MODEL_SIZE_BYTES,
    };
}

async function opStatus() {
    return statusSnapshot();
}

async function opCacheInfo() {
    // hachiue's cache key is hashUrl(url); getCachedModelSize needs the expected
    // total bytes to validate the cached file against <key>.meta.json.
    const cached = await isModelCached(MODEL_URL, MODEL_SIZE_BYTES).catch(() => false);
    const size = cached ? await getCachedModelSize(MODEL_URL, MODEL_SIZE_BYTES).catch(() => MODEL_SIZE_BYTES) : 0;
    return { cached, sizeBytes: size || 0, modelSizeBytes: MODEL_SIZE_BYTES };
}

async function opLoadModel() {
    await ensureEngine();
    return statusSnapshot();
}

async function opTranslate(message) {
    const e = await ensureEngine();
    stopIdleTimer();
    try {
        const text = String(message.text ?? '');
        if (!text.trim()) throw new Error('EMPTY_TEXT');
        const targetLang = String(message.targetLang || 'ja').toLowerCase();
        const sourceLang = typeof message.sourceLang === 'string' ? message.sourceLang : undefined;
        const glossary = Array.isArray(message.glossary) ? message.glossary : undefined;
        const form = (message.form === 'polite' || message.form === 'plain') ? message.form : undefined;
        const context = typeof message.context === 'string' ? message.context : undefined;
        const history = Array.isArray(message.history) ? message.history : undefined;
        const prompt = buildPlamo3Prompt({ text, targetLang, sourceLang, form, glossary, context, history });
        const t0 = performance.now();
        const res = await e.generate(prompt, { maxNewTokens: 512, temperature: 0 });
        touchActivity();
        const translation = stripPlamoTags(res.text);
        return {
            translation,
            stats: {
                promptTokens: res.stats.promptTokens,
                generatedTokens: res.stats.generatedTokens,
                prefillTokensPerSec: res.stats.prefillTokensPerSec,
                decodeTokensPerSec: res.stats.decodeTokensPerSec,
                elapsedMs: performance.now() - t0,
                backend: res.stats.backend,
            },
        };
    } catch (err) {
        touchActivity();
        throw err;
    }
}

async function opUnload() {
    await disposeEngine();
    return statusSnapshot();
}

async function opClearCache() {
    // Free VRAM/GPU first so a cached-but-resident engine can't linger after
    // the user deletes the model to reclaim disk space.
    await disposeEngine();
    // hachiue's clearModelCache() purges OPFS chunks + IndexedDB for ALL models
    // — this extension only ships one, so that's exactly what we want.
    await clearModelCache();
    sendProgress({ phase: 'ready', loadedBytes: 0, totalBytes: 0, cached: false });
    return statusSnapshot();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.target !== 'offscreen') return false;
    const type = message.type;
    log('recv', type);
    (async () => {
        switch (type) {
            case 'OFFSCREEN_STATUS':       sendResponse({ ok: true, status: statusSnapshot() }); return;
            case 'OFFSCREEN_CACHE_INFO':   sendResponse({ ok: true, cache: await opCacheInfo() }); return;
            case 'OFFSCREEN_LOAD_MODEL':   sendResponse({ ok: true, status: await enqueue(opLoadModel) }); return;
            case 'OFFSCREEN_TRANSLATE':    sendResponse({ ok: true, ...(await enqueue(() => opTranslate(message))) }); return;
            case 'OFFSCREEN_UNLOAD':       sendResponse({ ok: true, status: await enqueue(opUnload) }); return;
            case 'OFFSCREEN_CLEAR_CACHE':  sendResponse({ ok: true, status: await enqueue(opClearCache) }); return;
            case 'OFFSCREEN_SET_IDLE_TIMEOUT': {
                const ms = Number(message.ms);
                if (Number.isFinite(ms) && ms >= 1000) {
                    IDLE_TIMEOUT_MS = ms;
                    startIdleTimer();
                    sendResponse({ ok: true, idleTimeoutMs: IDLE_TIMEOUT_MS });
                } else {
                    sendResponse({ ok: false, error: 'ms must be >= 1000' });
                }
                return;
            }
            default:
                sendResponse({ ok: false, error: `unknown offscreen message: ${type}` });
        }
    })().catch(e => {
        sendResponse({ ok: false, error: (e && e.message) || String(e) });
    });
    return true; // async response
});

log('offscreen runtime ready');
