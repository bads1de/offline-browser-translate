/**
 * Measures how a local translation server scales with concurrent requests.
 *
 * The extension translates PLaMo/plain-text models item by item, so page-level
 * wall time is governed by how many requests the server can actually run in
 * parallel. This sends the same PLaMo-shaped chat request N times at several
 * concurrency levels and reports wall time / throughput for each.
 *
 * Usage:
 *   node tools/bench-server-concurrency.mjs                     # 127.0.0.1:8080, 16 items
 *   BENCH_URL=http://127.0.0.1:8080 BENCH_N=32 node tools/bench-server-concurrency.mjs
 */

const BASE = (process.env.BENCH_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
const N = Number(process.env.BENCH_N || 16);
const LEVELS = (process.env.BENCH_LEVELS || '1,2,4,8').split(',').map(Number);
const TARGET_LANG = process.env.BENCH_TARGET || 'ja';

// A realistic page mix: short nav labels, headings, and a few full sentences.
const TEXTS = [
    'Getting Started',
    'Documentation',
    'The quick brown fox jumps over the lazy dog.',
    'This guide explains how to install the extension and configure a local model.',
    'Pricing',
    'Translation runs entirely on your own machine, so no text ever leaves the browser.',
    'Frequently Asked Questions',
    'If the model is still loading, the first request can take several seconds.',
    'Contact',
    'Select the language you want the page translated into, then press Translate.',
    'Overview',
    'Caching keeps repeated phrases from being sent to the model more than once.',
    'Settings',
    'Large pages are split into batches so translations appear while the rest is still running.',
    'Blog',
    'You can stop a translation at any time and keep whatever has already been translated.',
];

let modelId = 'local-model';
async function resolveModel() {
    try {
        const r = await fetch(`${BASE}/v1/models`);
        const d = await r.json();
        if (d.data && d.data[0] && d.data[0].id) modelId = d.data[0].id;
    } catch (e) { /* server not up yet; the first request will report it */ }
}

async function translateOne(text) {
    const started = performance.now();
    const r = await fetch(`${BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: text }],
            temperature: 0.3,
            stream: false,
            stop: ['<|plamo:tag|>', '<|plamo:bos|>'],
            chat_template_kwargs: { target_lang: TARGET_LANG },
        }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json();
    const out = d.choices?.[0]?.message?.content || '';
    return { ms: performance.now() - started, out };
}

async function runLevel(concurrency) {
    const started = performance.now();
    let next = 0;
    const latencies = [];
    const errors = [];
    const workers = Array.from({ length: Math.min(concurrency, N) }, async () => {
        while (next < N) {
            const i = next++;
            try {
                const { ms } = await translateOne(TEXTS[i % TEXTS.length]);
                latencies.push(ms);
            } catch (e) {
                errors.push(e.message);
            }
        }
    });
    await Promise.all(workers);
    const wall = performance.now() - started;
    const avg = latencies.reduce((a, b) => a + b, 0) / Math.max(1, latencies.length);
    return { concurrency, wall, avg, errors: errors.length, sample: errors[0] || '' };
}

await resolveModel();
console.log(`server=${BASE} model=${modelId} items=${N} levels=${LEVELS.join(',')}`);

// Warm up: first request includes any lazy init and is not representative.
await translateOne(TEXTS[0]);

const rows = [];
for (const c of LEVELS) {
    const row = await runLevel(c);
    rows.push(row);
    const perItem = row.wall / N;
    console.log(`concurrency=${String(c).padStart(2)}  total=${row.wall.toFixed(0)}ms  ` +
        `per-item=${perItem.toFixed(0)}ms  avg-latency=${row.avg.toFixed(0)}ms  ` +
        `throughput=${(N / (row.wall / 1000)).toFixed(2)} items/s` +
        (row.errors ? `  errors=${row.errors} (${row.sample})` : ''));
}

const best = rows.filter(r => !r.errors).sort((a, b) => a.wall - b.wall)[0];
if (best) {
    const baseline = rows[0];
    console.log(`\nbest: concurrency=${best.concurrency} ` +
        `${(baseline.wall / best.wall).toFixed(2)}x faster than concurrency=${baseline.concurrency}`);
}
