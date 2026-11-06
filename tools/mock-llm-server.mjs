/**
 * Mock LLM server for measuring the extension's own overhead.
 *
 * Speaks both the Ollama and the OpenAI-compatible subset of the API surface
 * background.js uses, and answers instantly with deterministic "translations"
 * derived from the batch prompt it received. Point the extension at this
 * server (Provider: LM Studio/OpenAI-compatible, URL http://127.0.0.1:9101)
 * and every measured millisecond is extension overhead, not model time.
 *
 * Usage:
 *   node tools/mock-llm-server.mjs                 # instant replies
 *   MOCK_LLM_DELAY_MS=250 node tools/mock-llm-server.mjs   # simulate model latency
 *
 * Responds with fake Japanese like:
 *   【MT0】The quick brown fox...
 * so results are visibly non-source and per-segment unique.
 */

import http from 'node:http';

const PORT = Number(process.env.MOCK_LLM_PORT || 9101);
const DELAY_MS = Number(process.env.MOCK_LLM_DELAY_MS || 0);
const MODEL = 'mock-model';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function sleep(ms) {
    return ms > 0 ? new Promise(r => setTimeout(r, ms)) : Promise.resolve();
}

// Extract `[N]: text` batch lines from a prompt. Returns null when the prompt
// carries no batch structure (per-item / plain-text / PLaMo paths).
function parseBatch(text) {
    if (typeof text !== 'string') return null;
    const items = [];
    for (const line of text.split('\n')) {
        const m = line.match(/^\s*\[(\d+)\]:\s?(.*)$/);
        if (m) items.push({ id: Number(m[1]), text: m[2] });
    }
    return items.length ? items : null;
}

function mockTranslation(item) {
    const peek = item.text.length > 14 ? item.text.slice(0, 14) + '…' : item.text;
    return `【MT${item.id}】${peek}`;
}

// Build the model's reply for a user prompt.
function replyFor(userText) {
    const batch = parseBatch(userText);
    if (batch) {
        const payload = {
            translations: batch.map(b => ({ id: b.id, text: mockTranslation(b) }))
        };
        return JSON.stringify(payload);
    }
    // Single-segment (plain text) request — the whole reply is the translation.
    return `【MT】${userText.slice(0, 40)}`;
}

function lastUserMessage(body) {
    if (Array.isArray(body?.messages)) {
        for (let i = body.messages.length - 1; i >= 0; i--) {
            if (body.messages[i]?.role === 'user') return body.messages[i]?.content ?? '';
        }
    }
    return body?.prompt ?? body?.input ?? '';
}

function send(res, status, obj) {
    const data = JSON.stringify(obj);
    res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
    res.end(data);
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS);
        res.end();
        return;
    }

    let body = '';
    for await (const chunk of req) body += chunk;

    let parsed = {};
    try { parsed = body ? JSON.parse(body) : {}; } catch (e) { /* leave empty */ }

    const url = req.url.split('?')[0];

    if (req.method === 'GET' && (url === '/v1/models' || url === '/api/tags')) {
        return send(res, 200, url === '/api/tags'
            ? { models: [{ name: MODEL, model: MODEL }] }
            : { data: [{ id: MODEL, object: 'model' }] });
    }

    if (req.method === 'POST' && (url === '/v1/chat/completions' || url === '/api/chat' || url === '/api/generate')) {
        const started = process.hrtime.bigint();
        await sleep(DELAY_MS);
        const reply = replyFor(lastUserMessage(parsed));
        const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
        const segments = (reply.match(/【MT/g) || []).length;
        console.log(`[mock-llm] ${url} -> ${segments} segment(s) in ${elapsedMs.toFixed(1)}ms`);

        if (url === '/v1/chat/completions') {
            return send(res, 200, {
                id: 'mock', object: 'chat.completion', model: parsed.model || MODEL,
                choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: reply } }]
            });
        }
        if (url === '/api/chat') {
            return send(res, 200, { model: MODEL, message: { role: 'assistant', content: reply }, done: true });
        }
        return send(res, 200, { model: MODEL, response: reply, done: true });
    }

    send(res, 404, { error: `mock-llm: no handler for ${req.method} ${url}` });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`[mock-llm] listening on http://127.0.0.1:${PORT} (delay=${DELAY_MS}ms, model=${MODEL})`);
});
