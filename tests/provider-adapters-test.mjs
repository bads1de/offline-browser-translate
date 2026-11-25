import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { backgroundFiles, read } from './background-source.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..');

const listener = { addListener() {} };
const context = {
    chrome: {
        runtime: { onMessage: listener, onStartup: listener, onInstalled: listener },
        contextMenus: { onClicked: listener },
        storage: { local: { get: async () => ({}) } }
    },
    DEFAULT_SETTINGS: {},
    URL,
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    performance,
    ProviderTransport: { postJson: async () => { throw new Error('not stubbed'); } }
};
vm.createContext(context);
for (const file of backgroundFiles()) {
    vm.runInContext(read(file), context, { filename: file });
}
const { callOllama, callLMStudio, translatePlamoItem } = context.LctBgTranslate;

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

function httpError(status, responseText) {
    const error = new Error('HTTP ' + status);
    error.status = status;
    error.responseText = responseText;
    return error;
}

async function expectError(action, expected) {
    try {
        await action();
        return null;
    } catch (e) {
        return e;
    }
}

{
    let captured;
    context.ProviderTransport.postJson = async (url, body, options) => {
        captured = { url, body, options };
        return { response: 'translated', done_reason: 'stop' };
    };
    const result = await callOllama({
        ollamaUrl: 'http://localhost:11434/',
        temperature: 0.2,
        numCtx: 4096
    }, 'test-model', 'system', 'user', true);

    check('ollama: preserves endpoint, prompt and generation options',
        captured.url === 'http://127.0.0.1:11434/api/generate' &&
        captured.body.prompt === 'system\n\nuser' &&
        captured.body.keep_alive === '30m' &&
        isDeepStrictEqual(structuredClone(captured.body.options), { temperature: 0.2, num_ctx: 4096 }) &&
        captured.body.format.type === 'object');
    check('ollama: returns content and finish reason',
        result.content === 'translated' && result.finishReason === 'stop');
}

{
    context.ProviderTransport.postJson = async () => { throw httpError(403, 'Forbidden'); };
    const error = await expectError(() => callOllama({ ollamaUrl: 'http://localhost:11434' }, 'm', '', 'u', false));
    check('ollama: preserves the CORS-specific 403 message',
        error && error.message.includes('Ollama returned 403 Forbidden') && error.message.includes('enable CORS in Ollama'));
}

{
    context.ProviderTransport.postJson = async () => { throw httpError(503, 'unavailable'); };
    const error = await expectError(() => callOllama({ ollamaUrl: 'http://localhost:11434' }, 'm', '', 'u', false));
    check('ollama: preserves HTTP error formatting',
        error && error.message === 'Ollama error (503): unavailable');
}

{
    const calls = [];
    context.ProviderTransport.postJson = async (url, body) => {
        calls.push(structuredClone(body));
        if (calls.length === 1) throw httpError(400, 'response_format is unsupported');
        return { choices: [{ message: { content: '{"translations":[]}' }, finish_reason: 'stop' }] };
    };
    const result = await callLMStudio({ lmstudioUrl: 'http://localhost:1234', temperature: 0.3 }, 'm', 'system', 'user', true);

    check('lmstudio: retries once without structured output',
        calls.length === 2 && calls[0].response_format && !calls[1].response_format);
    check('lmstudio: preserves response cleaning and finish reason',
        result.content === '{"translations":[]}' && result.finishReason === 'stop');
}

{
    context.ProviderTransport.postJson = async () => { throw httpError(500, 'down'); };
    const error = await expectError(() => callLMStudio({ lmstudioUrl: 'http://localhost:1234' }, 'm', '', 'u', false));
    check('lmstudio: preserves HTTP error formatting', error && error.message === 'LMStudio error: down');
}

{
    let captured;
    context.ProviderTransport.postJson = async (url, body, options) => {
        captured = { url, body, options };
        return { message: { content: ' translated ' } };
    };
    const result = await translatePlamoItem('ollama', {
        ollamaUrl: 'http://localhost:11434',
        temperature: 0.1,
        numCtx: 2048
    }, 'plamo', 'source', 'ja');

    check('plamo ollama: preserves chat request options',
        captured.url === 'http://127.0.0.1:11434/api/chat' &&
        isDeepStrictEqual(structuredClone(captured.body.options), {
            temperature: 0.1,
            num_ctx: 2048,
            stop: ['<|plamo:tag|>', '<|plamo:bos|>']
        }));
    check('plamo ollama: trims the translation', result === 'translated');
}

{
    let captured;
    context.ProviderTransport.postJson = async (url, body, options) => {
        captured = { url, body, options };
        return { choices: [{ message: { content: ' translated ' } }] };
    };
    const result = await translatePlamoItem('lmstudio', {
        lmstudioUrl: 'http://localhost:1234',
        temperature: 0
    }, 'plamo', 'source', 'en');

    check('plamo openai: preserves chat template and stop options',
        captured.url === 'http://127.0.0.1:1234/v1/chat/completions' &&
        captured.body.temperature === 0 &&
        isDeepStrictEqual(structuredClone(captured.body.chat_template_kwargs), { target_lang: 'en' }) &&
        isDeepStrictEqual(structuredClone(captured.body.stop), ['<|plamo:tag|>', '<|plamo:bos|>']));
    check('plamo openai: trims the translation', result === 'translated');
}

{
    context.ProviderTransport.postJson = async () => { throw httpError(502, 'bad gateway'); };
    const error = await expectError(() => translatePlamoItem('lmstudio', {
        lmstudioUrl: 'http://localhost:1234'
    }, 'plamo', 'source', 'ja'));
    check('plamo openai: preserves HTTP error formatting',
        error && error.message === 'Server error (502): bad gateway');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
