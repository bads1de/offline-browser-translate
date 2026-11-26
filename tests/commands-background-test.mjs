import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { backgroundFiles, read } from './background-source.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..');

let pass = 0;
let fail = 0;
function check(name, condition, detail) {
    if (condition) {
        pass++;
        console.log('  ok  ' + name);
    } else {
        fail++;
        console.log('FAIL  ' + name);
        if (detail !== undefined) console.log('      ' + JSON.stringify(detail));
    }
}

const DEFAULT_SETTINGS = {
    provider: 'auto',
    targetLanguage: 'ja',
    sourceLanguage: 'auto',
    showGlow: true,
    maxConcurrentRequests: 4,
    cacheMode: 'off',
    debug: false
};

// Boots the background worker against a fake browser API so the command listener can be
// driven directly. `respond` decides what the page answers; throwing models a
// tab where the content script is not there yet.
function boot({ respond, detectLanguage = 'en', hasCommands = true } = {}) {
    const calls = [];
    const injected = [];
    const listeners = {};
    const on = name => ({ addListener: fn => { (listeners[name] = listeners[name] || []).push(fn); } });
    const page = respond || (async () => ({ started: true }));

    const browserAPI = {
        runtime: {
            onInstalled: on('installed'),
            onMessage: on('message'),
            onStartup: on('startup'),
            onSuspend: on('suspend'),
            lastError: null,
            getURL: rel => rel,
            sendMessage: async () => ({})
        },
        contextMenus: { onClicked: on('menu'), create: () => {}, removeAll: () => {} },
        tabs: {
            query: async () => [{ id: 7, url: 'https://example.com/a' }],
            sendMessage: async (tabId, message) => {
                calls.push({ tabId, message });
                return page(tabId, message, calls.length);
            }
        },
        scripting: {
            executeScript: async ({ files }) => {
                if (files) { injected.push(files); return [{}]; }
                return [{ result: detectLanguage }];
            },
            registerContentScripts: async () => {},
            unregisterContentScripts: async () => {},
            getRegisteredContentScripts: async () => []
        },
        storage: {
            local: {
                get: async () => ({ settings: { targetLanguage: 'ja', sourceLanguage: 'auto', cacheMode: 'off' } }),
                set: async () => {}
            },
            onChanged: on('changed')
        }
    };
    if (hasCommands) browserAPI.commands = { onCommand: on('command'), getAll: async () => [] };

    const context = vm.createContext({
        browserAPI,
        chrome: browserAPI,
        browser: browserAPI,
        console: { log() {}, error() {}, warn() {}, info() {} },
        setTimeout,
        clearTimeout,
        Promise,
        URL,
        navigator: { language: 'en' },
        DEFAULT_SETTINGS,
        Intl
    });
    // Mirror the browser: every background script in manifest load order.
    for (const file of backgroundFiles()) {
        vm.runInContext(read(file), context, { filename: file });
    }

    async function fire(command, tab = { id: 7, url: 'https://example.com/a' }) {
        const handler = (listeners.command || [])[0];
        if (!handler) return false;
        await handler(command, tab);
        return true;
    }

    return { calls, injected, listeners, fire };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 20));

// --- registration -----------------------------------------------------------
{
    const app = boot();
    await tick();
    check('background registers a command listener', (app.listeners.command || []).length === 1);

    const withoutApi = boot({ hasCommands: false });
    await tick();
    check('background tolerates a browser without the commands API',
        !withoutApi.listeners.command && withoutApi.listeners.menu);
}

// --- Alt+A: translate the page ---------------------------------------------
{
    const app = boot();
    await tick();
    await app.fire('translate-page');
    check('translate-page sends START_TRANSLATION', app.calls.length === 1 && app.calls[0].message.type === 'START_TRANSLATION',
        app.calls);
    check('translate-page uses the saved target language', app.calls[0]?.message.targetLanguage === 'ja', app.calls[0]);
    check('translate-page resolves auto source language from the page',
        app.calls[0]?.message.sourceLanguage === 'en', app.calls[0]);
}

// --- Alt+B: toggle ---------------------------------------------------------
{
    const app = boot({ respond: async () => ({ showing: 'original', hasCache: true }) });
    await tick();
    await app.fire('toggle-translation');
    check('toggle-translation only toggles when a cached translation exists',
        app.calls.length === 1 && app.calls[0].message.type === 'TOGGLE_TRANSLATION', app.calls);
}
{
    const app = boot({
        respond: async (tabId, message, n) => (n === 1
            ? { showing: 'original', hasCache: false }
            : { started: true })
    });
    await tick();
    await app.fire('toggle-translation');
    check('toggle-translation starts a run when there is nothing to restore',
        app.calls.length === 2
        && app.calls[0].message.type === 'TOGGLE_TRANSLATION'
        && app.calls[1].message.type === 'START_TRANSLATION', app.calls);
}

// --- Alt+S: selection ------------------------------------------------------
{
    const app = boot();
    await tick();
    await app.fire('translate-selection');
    check('translate-selection sends TRANSLATE_SELECTION',
        app.calls.length === 1 && app.calls[0].message.type === 'TRANSLATE_SELECTION', app.calls);
    check('translate-selection carries the resolved language',
        app.calls[0]?.message.sourceLanguage === 'en', app.calls[0]);
}

// --- Alt+T: compose --------------------------------------------------------
{
    const app = boot();
    await tick();
    await app.fire('translate-compose');
    check('translate-compose sends TRANSLATE_COMPOSE',
        app.calls.length === 1 && app.calls[0].message.type === 'TRANSLATE_COMPOSE', app.calls);
}

// --- guard rails -----------------------------------------------------------
{
    const app = boot();
    await tick();
    await app.fire('translate-page', { id: 7, url: 'chrome://extensions/' });
    check('browser-internal pages are skipped',
        app.calls.length === 0 && app.injected.length === 0, app.calls);
}
{
    const app = boot({
        respond: async (tabId, message, n) => {
            if (n === 1) throw new Error('Could not establish connection. Receiving end does not exist.');
            return { started: true };
        }
    });
    await tick();
    await app.fire('translate-page');
    check('a missing content script is injected and the message retried',
        app.injected.length === 1
        && app.injected[0].includes('content/core.js')
        && app.calls.length === 2
        && app.calls[1].message.type === 'START_TRANSLATION', { calls: app.calls, injected: app.injected });
}
{
    const app = boot();
    await tick();
    const handled = await app.fire('not-a-real-command');
    check('unknown commands are ignored', handled && app.calls.length === 0, app.calls);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
