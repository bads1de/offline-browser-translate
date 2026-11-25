import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { readBackgroundSources } from './background-source.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..');
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');

const context = { window: {}, structuredClone, console };
vm.createContext(context);
vm.runInContext(read('settings-client.js'), context);
const { settingsPatch, createSettingsClient } = context.window.SettingsClient;

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

function fakeApi(initialSettings) {
    let stored = structuredClone(initialSettings);
    const calls = [];
    return {
        calls,
        runtime: {
            async sendMessage(message) {
                calls.push(structuredClone(message));
                if (message.type === 'GET_SETTINGS') return { settings: structuredClone(stored) };
                if (message.type === 'SAVE_SETTINGS') {
                    stored = { ...stored, ...structuredClone(message.settings) };
                    return { settings: structuredClone(stored) };
                }
                throw new Error('Unexpected message: ' + message.type);
            }
        }
    };
}

const base = {
    targetLanguage: 'en',
    pinnedLanguages: ['en', 'ja'],
    customPrompts: { default: { system: 'system', user: 'user' } },
    showGlow: false,
    maxConcurrentRequests: 4
};

check('patch: unchanged primitives are omitted',
    Object.keys(settingsPatch(base, { ...base })).length === 0);
check('patch: unchanged arrays and objects are omitted',
    Object.keys(settingsPatch(base, structuredClone(base))).length === 0);
check('patch: changed values are included',
    isDeepStrictEqual(structuredClone(settingsPatch(base, { ...base, targetLanguage: 'ja', showGlow: true })),
        { targetLanguage: 'ja', showGlow: true }));
check('patch: mutated arrays and objects are included',
    isDeepStrictEqual(structuredClone(settingsPatch(base, {
        ...base,
        pinnedLanguages: ['en'],
        customPrompts: { default: { system: 'changed', user: 'user' } }
    })), {
        pinnedLanguages: ['en'],
        customPrompts: { default: { system: 'changed', user: 'user' } }
    }));

{
    const api = fakeApi(base);
    const client = createSettingsClient(api);
    const loaded = await client.load();
    loaded.pinnedLanguages.push('fr');

    check('client: loaded settings do not share mutable state with the snapshot',
        JSON.stringify(api.calls[0]) === JSON.stringify({ type: 'GET_SETTINGS' }));

    const saved = await client.save(loaded);
    const saveCalls = api.calls.filter(call => call.type === 'SAVE_SETTINGS');
    check('client: save sends only the changed field',
        saveCalls.length === 1 && isDeepStrictEqual(saveCalls[0].settings,
            { pinnedLanguages: ['en', 'ja', 'fr'] }), saveCalls);
    check('client: save returns the persisted settings',
        JSON.stringify(saved.pinnedLanguages) === JSON.stringify(['en', 'ja', 'fr']));

    await client.save(saved);
    check('client: unchanged save sends no message',
        api.calls.filter(call => call.type === 'SAVE_SETTINGS').length === 1);
}

{
    const api = fakeApi(base);
    const client = createSettingsClient(api);
    const loaded = await client.load();
    api.runtime.sendMessage = async message => {
        api.calls.push(structuredClone(message));
        return { error: 'save failed' };
    };

    let error = null;
    try {
        await client.save({ ...loaded, targetLanguage: 'ja' });
    } catch (e) {
        error = e;
    }
    check('client: save errors are surfaced', error && error.message === 'save failed');

    api.runtime.sendMessage = async message => {
        api.calls.push(structuredClone(message));
        if (message.type === 'SAVE_SETTINGS') return { settings: { ...base, targetLanguage: 'ja' } };
        return { settings: structuredClone(base) };
    };
    const saved = await client.save({ ...loaded, targetLanguage: 'de' });
    check('client: failed save does not advance the snapshot',
        isDeepStrictEqual(api.calls.at(-1).settings, { targetLanguage: 'de' }) &&
        saved.targetLanguage === 'ja');
}

{
    const api = fakeApi(base);
    const popupClient = createSettingsClient(api);
    const optionsClient = createSettingsClient(api);
    const popupSettings = await popupClient.load();
    const optionsSettings = await optionsClient.load();

    await popupClient.save({ ...popupSettings, targetLanguage: 'ja' });
    const saved = await optionsClient.save({ ...optionsSettings, showGlow: true });
    const optionSave = api.calls.filter(call => call.type === 'SAVE_SETTINGS').at(-1);

    check('client: a stale page does not overwrite another page\'s changes',
        isDeepStrictEqual(optionSave.settings, { showGlow: true }) &&
        saved.targetLanguage === 'ja' && saved.showGlow === true, optionSave);
}

{
    const api = fakeApi(base);
    const client = createSettingsClient(api);
    const loaded = await client.load();
    const defaults = { ...base, targetLanguage: 'en', showGlow: false, pinnedLanguages: [] };
    await client.save({ ...loaded, targetLanguage: 'ja', showGlow: true });
    await client.save(defaults);
    const resetCall = api.calls.filter(call => call.type === 'SAVE_SETTINGS').at(-1);
    check('client: reset sends only values that differ from the saved state',
        isDeepStrictEqual(resetCall.settings, {
            targetLanguage: 'en',
            showGlow: false,
            pinnedLanguages: []
        }), resetCall);
}

for (const page of ['popup/popup.html', 'options/options.html', 'translator/translator.html']) {
    const html = read(page);
    const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
    const pageScript = page.split('/')[1].replace(/\.html$/, '.js');
    check('wiring: ' + page + ' loads the settings client before its page script',
        scripts.includes('../settings-client.js') &&
        scripts.indexOf('../settings-client.js') < scripts.indexOf(pageScript));
}
for (const script of ['popup/popup.js', 'options/options.js', 'translator/translator.js']) {
    check('wiring: ' + script + ' has no direct SAVE_SETTINGS message',
        !/type:\s*['"]SAVE_SETTINGS['"]/.test(read(script)));
}
check('wiring: background still handles SAVE_SETTINGS',
    /case\s+['"]SAVE_SETTINGS['"]/.test(readBackgroundSources()));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
