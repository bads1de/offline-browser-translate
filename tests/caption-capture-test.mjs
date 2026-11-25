// Exercises the MAIN-world capture hook that runs inside background.js's
// executeScript func. Extracts that function body and drives it with fake
// fetch/XHR/player objects, so the hook, wait/resolve and release paths are
// covered without a browser.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBackgroundSources } from './background-source.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readBackgroundSources();

const start = src.indexOf('const CAPTURE_TIMEOUT_MS');
const end = src.indexOf('async function releaseCaptionCapture');
if (start < 0 || end < 0) {
    console.error('could not locate capture section');
    process.exit(1);
}
const section = src.slice(start, end);

// Pull the two MAIN-world funcs out as standalone sources.
function extractFunc(name) {
    const at = section.indexOf(`func: async (wanted) => {`);
    if (at < 0) throw new Error('arm func not found');
    // Body is everything between the arrow and the closing "}\n    });"
    const bodyStart = section.indexOf('{', at) + 1;
    let depth = 1;
    let i = bodyStart;
    while (i < section.length && depth > 0) {
        const ch = section[i];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        i++;
    }
    return section.slice(bodyStart, i - 1);
}

function makeEnv() {
    const calls = { fetch: 0, setTrack: [], restored: [] };
    let captionTrack = { languageCode: 'en', kind: '', baseUrl: 'https://y/api/timedtext?lang=en', vssId: '.en' };

    const responses = new Map();
    const fakeWindow = {
        fetch: function (input) {
            calls.fetch++;
            const url = typeof input === 'string' ? input : input.url;
            const body = responses.get(url) || '';
            return Promise.resolve({ ok: true, clone: () => ({ text: () => Promise.resolve(body) }) });
        },
        XMLHttpRequest: function () { },
    };
    fakeWindow.XMLHttpRequest.prototype = { open: function () { } };

    const player = {
        setOption(group, name, value) {
            if (group === 'captions' && name === 'track') {
                calls.setTrack.push(value);
                if (value && value.languageCode) captionTrack = value;
            }
        },
        getOption() { return captionTrack; },
        loadModule: async () => { }
    };

    return { fakeWindow, player, calls, responses };
}

const armBody = extractFunc('arm')
    .replace(/const W = window;/g, '')
    .replace(/\bW\./g, 'window.');
const makeArm = (body) => new Function('window', 'document', 'setTimeout', 'clearTimeout', 'wanted',
    `return (async () => { ${body} })();`);
// Calls the MAIN-world arm body with a fake page.
const run = (win, doc, wanted) => makeArm(armBody)(win, doc, setTimeout, clearTimeout, wanted);

const results = [];
const check = (name, cond, extra) => {
    results.push([name, cond, extra]);
};

// 1. Hook records a body and wait() resolves promptly.
{
    const env = makeEnv();
    const document = { getElementById: () => env.player };
    const armed = await run(env.fakeWindow, document, setTimeout, clearTimeout, { languageCode: 'en' });
    check('arm: reports ok', armed.ok === true, armed);
    check('arm: previous track captured', armed.previous && armed.previous.baseUrl === 'https://y/api/timedtext?lang=en');
    check('arm: fetch patched', env.fakeWindow.fetch !== env.fakeWindow.__orig);

    // Player fetch happens after arming.
    env.responses.set('https://y/api/timedtext?lang=en&fmt=json3', '{"events":[]}');
    await env.fakeWindow.fetch('https://y/api/timedtext?lang=en&fmt=json3');

    const got = await env.fakeWindow.__lctCaptionCapture.wait(500, 0);
    check('wait: resolves with recorded body', got.length === 1 && got[0].text === '{"events":[]}', got);

    const orig = env.fakeWindow.fetch;
    env.fakeWindow.__lctCaptionCapture.release();
    check('release: fetch restored', env.fakeWindow.fetch !== orig);
    check('release: hook removed', !env.fakeWindow.__lctCaptionCapture);
}

// 2. Empty bodies are ignored.
{
    const env = makeEnv();
    const document = { getElementById: () => env.player };
    await run(env.fakeWindow, document, setTimeout, clearTimeout, { languageCode: 'en' });
    env.responses.set('https://y/api/timedtext?lang=en', '   ');
    await env.fakeWindow.fetch('https://y/api/timedtext?lang=en');
    const got = await env.fakeWindow.__lctCaptionCapture.wait(50, 0);
    check('record: empty body dropped', got.length === 0, got);
    env.fakeWindow.__lctCaptionCapture.release();
}

// 3. Non-timedtext traffic is passed through untouched.
{
    const env = makeEnv();
    const document = { getElementById: () => env.player };
    await run(env.fakeWindow, document, setTimeout, clearTimeout, { languageCode: 'en' });
    const res = await env.fakeWindow.fetch('https://y/api/stats?x=1');
    check('hook: non-timedtext untouched', res.ok === true);
    const got = await env.fakeWindow.__lctCaptionCapture.wait(30, 0);
    check('hook: non-timedtext not recorded', got.length === 0, got);
    env.fakeWindow.__lctCaptionCapture.release();
}

// 4. Missing player releases the hook instead of leaving it armed.
{
    const env = makeEnv();
    const document = { getElementById: () => null };
    const before = env.fakeWindow.fetch;
    const armed = await run(env.fakeWindow, document, setTimeout, clearTimeout, { languageCode: 'en' });
    check('arm: no player reports error', armed.error === 'NO_PLAYER', armed);
    check('arm: no player restores fetch', env.fakeWindow.fetch === before);
    check('arm: no player removes hook', !env.fakeWindow.__lctCaptionCapture);
}

// 5. Full track object is kept for restore (baseUrl/name/vssId survive).
{
    const env = makeEnv();
    const document = { getElementById: () => env.player };
    const armed = await run(env.fakeWindow, document, setTimeout, clearTimeout, { languageCode: 'ja' });
    check('restore: full track object retained',
        armed.previous && armed.previous.vssId === '.en' && armed.previous.kind === '' && !!armed.previous.baseUrl,
        armed.previous);
    env.fakeWindow.__lctCaptionCapture.release();
}

let failed = 0;
for (const [name, pass, extra] of results) {
    console.log(pass ? 'PASS' : 'FAIL', name, pass ? '' : JSON.stringify(extra));
    if (!pass) failed++;
}
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
