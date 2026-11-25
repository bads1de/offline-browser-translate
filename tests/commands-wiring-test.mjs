import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { read, readBackgroundSources, readContentSources } from './background-source.mjs';

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
        if (detail !== undefined) console.log('      ' + String(detail));
    }
}

const manifest = JSON.parse(read('manifest.json'));
const commands = manifest.commands || {};
const expected = {
    'translate-page': 'Alt+A',
    'toggle-translation': 'Alt+B',
    'translate-selection': 'Alt+S',
    'translate-compose': 'Alt+T'
};

check('manifest declares the commands block', !!manifest.commands);
check('manifest declares exactly the four shortcuts',
    JSON.stringify(Object.keys(commands).sort()) === JSON.stringify(Object.keys(expected).sort()),
    Object.keys(commands));
for (const [id, key] of Object.entries(expected)) {
    check(`${id} uses ${key}`, commands[id]?.suggested_key?.default === key, commands[id]);
    check(`${id} has a description`, typeof commands[id]?.description === 'string' && commands[id].description.length > 0);
}
// Chrome refuses a manifest that suggests more than four shortcut keys.
check('at most four suggested keys',
    Object.values(commands).filter(c => c && c.suggested_key).length <= 4);

const background = readBackgroundSources();
check('background listens for commands',
    /browserAPI\.commands && browserAPI\.commands\.onCommand[\s\S]*?addListener/.test(background));
for (const id of Object.keys(expected)) {
    check(`background handles the ${id} command`, background.includes(`case '${id}':`));
}
// Every entry point has to work on a page where no page-wide feature is on, so
// the content script cannot be assumed to be present.
check('background injects the content script on demand',
    /async function sendToContent[\s\S]*?CONTENT_SCRIPTS[\s\S]*?sendMessage/.test(background));
check('background resolves auto source language before translating',
    /async function resolveSourceLanguage[\s\S]*?detectTabLanguage/.test(background));
check('background skips browser-internal pages',
    /function isRestrictedUrl[\s\S]*?about:/.test(background));
check('background falls back to the active tab when a command has none',
    /function activeTabForCommand[\s\S]*?tabs\.query/.test(background));

// The menu items and the shortcuts must share one implementation, otherwise a
// fix to one path silently misses the other.
check('context menu translates the page through the shared helper',
    /menuItemId === "translate-page"[\s\S]{0,200}?await translatePageInTab\(tab\.id\)/.test(background));
check('context menu translates the selection through the shared helper',
    /menuItemId === "translate-selection"[\s\S]{0,200}?await translateSelectionInTab\(tab\.id\)/.test(background));

const content = readContentSources();
check('content script handles the compose shortcut', content.includes("case 'TRANSLATE_COMPOSE':"));
check('content script hands the shortcut to the compose controller',
    /case 'TRANSLATE_COMPOSE':[\s\S]*?controller\.translate\(\)/.test(content));
check('content script answers the shortcut asynchronously',
    /case 'TRANSLATE_COMPOSE':[\s\S]*?\.then[\s\S]*?return true;/.test(content));
check('content script waits for the controller after an on-demand injection',
    /function waitForComposeController[\s\S]*?case 'TRANSLATE_COMPOSE':[\s\S]*?waitForComposeController\(\)/.test(content));
check('content script explains a disabled compose feature',
    /case 'TRANSLATE_COMPOSE':[\s\S]*?Compose translation is off/.test(content));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
