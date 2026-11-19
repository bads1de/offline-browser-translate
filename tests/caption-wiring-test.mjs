// Smoke-test the caption module wiring: parser + fetcher.loadCues with a
// stubbed bridge, in a vm context that mimics the content script world.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, '..', p), 'utf8');

const calls = [];
const context = vm.createContext({
    window: {},
    URL,
    localStorage: { getItem: () => null },
    navigator: { language: 'ja-JP' },
    console,
    setInterval,
    clearInterval,
    setTimeout,
    DOMParser: class {
        parseFromString() { return { getElementsByTagName: () => [] }; }
    }
});

vm.runInContext(read('captions/parser.js'), context);
vm.runInContext(read('captions/fetcher.js'), context);

const json3 = JSON.stringify({
    events: [
        { tStartMs: 0, dDurationMs: 900, segs: [{ utf8: 'Hello there.' }] },
        { tStartMs: 1000, dDurationMs: 900, segs: [{ utf8: 'Second line.' }] }
    ]
});

context.window.LctBridge = {
    send: async (message) => {
        calls.push(message.type);
        if (message.type === 'CAPTURE_PLAYER_CAPTIONS') {
            return { ok: true, responses: [{ url: 'https://www.youtube.com/api/timedtext?lang=en', text: json3 }] };
        }
        if (message.type === 'FETCH_TIMEDTEXT') return { ok: false, error: 'should not be reached' };
        return {};
    },
    toast: () => {}
};

const fetcher = context.window.LctCaptionFetcher;
const cues = await fetcher.loadCues({ languageCode: 'en', kind: '', baseUrl: 'x' });
console.log('calls:', calls.join(','));
console.log('cues:', cues.map(c => c.text));

const okCapture = calls[0] === 'CAPTURE_PLAYER_CAPTIONS';
const okSkipDirect = calls.length === 1;
const okCues = cues.length === 2 && cues[0].text === 'Hello there.';

// Fallback path: capture fails, direct fetch succeeds.
const calls2 = [];
context.window.LctBridge = {
    send: async (message) => {
        calls2.push(message.type);
        if (message.type === 'CAPTURE_PLAYER_CAPTIONS') return { ok: false, error: 'no player' };
        if (message.type === 'FETCH_TIMEDTEXT') return { ok: true, text: json3 };
        return {};
    },
    toast: () => {}
};
const fallback = await context.window.LctCaptionFetcher.loadCues({ languageCode: 'en', baseUrl: 'x' });
const okFallback = fallback.length === 2 && calls2.includes('FETCH_TIMEDTEXT');

// Language scoring: wrong-language payload must not win over the wanted one.
context.window.LctBridge = {
    send: async () => ({
        ok: true,
        responses: [
            { url: 'https://y/api/timedtext?lang=fr', text: JSON.stringify({ events: Array.from({ length: 9 }, (_, i) => ({ tStartMs: i * 100, dDurationMs: 90, segs: [{ utf8: `fr${i}` }] })) }) },
            { url: 'https://y/api/timedtext?lang=en', text: json3 }
        ]
    }),
    toast: () => {}
};
const scored = await context.window.LctCaptionFetcher.loadCues({ languageCode: 'en', baseUrl: 'x' });
const okScoring = scored.length === 2 && scored[0].text === 'Hello there.';

const results = [
    ['capture used first', okCapture],
    ['direct skipped when captured', okSkipDirect],
    ['captured cues returned', okCues],
    ['falls back to direct fetch', okFallback],
    ['prefers matching language over more cues', okScoring]
];
let failed = 0;
for (const [name, pass] of results) {
    console.log(pass ? 'PASS' : 'FAIL', name);
    if (!pass) failed++;
}
process.exit(failed ? 1 : 0);
