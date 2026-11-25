import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { readBackgroundSources } from './background-source.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..');
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');

function loadTransport({ fetchImpl, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
    const context = {
        fetch: fetchImpl,
        AbortController,
        setTimeout: setTimeoutImpl,
        clearTimeout: clearTimeoutImpl,
        console
    };
    vm.createContext(context);
    vm.runInContext(read('provider-transport.js'), context);
    return context.ProviderTransport;
}

let pass = 0, fail = 0;
function check(name, condition, detail) {
    if (condition) {
        pass++;
        console.log('PASS ' + name);
    } else {
        fail++;
        console.log('FAIL ' + name);
        if (detail !== undefined) console.log('     ' + JSON.stringify(detail));
    }
}

{
    let captured;
    const cleared = [];
    const transport = loadTransport({
        fetchImpl: async (url, init) => {
            captured = { url, init };
            return { ok: true, json: async () => ({ response: 'ok' }) };
        },
        setTimeoutImpl: () => 42,
        clearTimeoutImpl: id => cleared.push(id)
    });

    const result = await transport.postJson('http://localhost/api/generate', { model: 'test', stream: false });
    check('transport: sends a JSON POST', captured.url === 'http://localhost/api/generate' &&
        captured.init.method === 'POST' &&
        isDeepStrictEqual(structuredClone(captured.init.headers), { 'Content-Type': 'application/json' }) &&
        isDeepStrictEqual(JSON.parse(captured.init.body), { model: 'test', stream: false }));
    check('transport: returns parsed JSON', isDeepStrictEqual(result, { response: 'ok' }));
    check('transport: clears the timeout after success', cleared.length === 1);
}

{
    const timeouts = [];
    const cleared = [];
    const transport = loadTransport({
        fetchImpl: (url, init) => new Promise((resolve, reject) => {
            init.signal.addEventListener('abort', () => {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
            });
        }),
        setTimeoutImpl: (callback, ms) => {
            timeouts.push({ callback, ms });
            return 42;
        },
        clearTimeoutImpl: id => cleared.push(id)
    });

    let error = null;
    const pending = transport.postJson('http://localhost/api', {}, {
        timeoutMs: 123,
        timeoutMessage: 'custom timeout'
    }).catch(e => { error = e; });
    timeouts[0].callback();
    await pending;

    check('transport: timeout aborts the request', timeouts[0].ms === 123);
    check('transport: timeout uses the provider-specific message', error && error.message === 'custom timeout');
    check('transport: clears the timeout after abort', isDeepStrictEqual(cleared, [42]));
}

{
    const transport = loadTransport({
        fetchImpl: async () => { throw new TypeError('network unavailable'); }
    });
    let error = null;
    try {
        await transport.postJson('http://localhost/api', {}, { connectionErrorMessage: 'server offline' });
    } catch (e) {
        error = e;
    }
    check('transport: maps connection errors when requested', error && error.message === 'server offline');
}

{
    const transport = loadTransport({
        fetchImpl: async () => { throw new TypeError('network unavailable'); }
    });
    let error = null;
    try {
        await transport.postJson('http://localhost/api', {});
    } catch (e) {
        error = e;
    }
    check('transport: preserves connection errors without an override',
        error && error.name === 'TypeError' && error.message === 'network unavailable');
}

{
    const cleared = [];
    const transport = loadTransport({
        fetchImpl: async () => ({ ok: false, status: 403, text: async () => 'Forbidden' }),
        setTimeoutImpl: () => 42,
        clearTimeoutImpl: id => cleared.push(id)
    });
    let error = null;
    try {
        await transport.postJson('http://localhost/api', {});
    } catch (e) {
        error = e;
    }
    check('transport: exposes HTTP status and body for provider-specific formatting',
        error && error.status === 403 && error.responseText === 'Forbidden');
    check('transport: clears the timeout after an HTTP error', cleared.length === 1);
}

{
    const manifest = JSON.parse(read('manifest.json'));
    const scripts = manifest.background.scripts;
    check('wiring: manifest loads provider transport before background',
        scripts.includes('provider-transport.js') &&
        scripts.indexOf('provider-transport.js') < scripts.indexOf('background/core.js'));
    check('wiring: service worker imports provider transport',
        /importScripts\([^)]*provider-transport\.js/.test(read('background.js')));
    check('wiring: background uses the shared transport',
        (readBackgroundSources().match(/ProviderTransport\.postJson\(/g) || []).length >= 4);
    check('wiring: provider-specific recovery behavior remains',
        readBackgroundSources().includes("Ollama returned 403 Forbidden") &&
        readBackgroundSources().includes('Server rejected structured output; retrying without response_format'));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
