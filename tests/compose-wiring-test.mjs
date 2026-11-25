import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
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

function scriptsFrom(source) {
    const match = source.match(/const CONTENT_SCRIPTS = \[[\s\S]*?\n\];/);
    if (!match) return null;
    return vm.runInContext(match[0] + '\nCONTENT_SCRIPTS;', vm.createContext({}));
}

const backgroundScripts = scriptsFrom(readBackgroundSources());
const popupScripts = scriptsFrom(read('popup/popup.js')).map(file => file.replace(/^\//, ''));
const expected = [
    'compose/policy.js',
    'compose/session.js',
    'compose/textarea.js',
    'compose/contenteditable.js',
    'compose/ui.js',
    'compose/controller.js',
    'content/core.js',
    'content/dom.js',
    'content/widget.js',
    'content/page.js',
    'content/messages.js',
    'content/selection.js',
    'content/captions.js',
    'content/startup.js',
    'captions/parser.js',
    'captions/fetcher.js',
    'captions/session.js'
];
check('background registers every content script in dependency order',
    JSON.stringify(backgroundScripts) === JSON.stringify(expected), backgroundScripts);
check('popup injection matches background registration',
    JSON.stringify(popupScripts) === JSON.stringify(expected), popupScripts);
for (const file of expected) {
    check(`registered script exists: ${file}`, fs.existsSync(path.join(repo, file)));
}

const content = readContentSources();
check('content script preserves its duplicate-injection guard',
    content.includes('if (window.hasLLMTranslatorContentScript)'));
check('content script configures compose after loading settings',
    content.includes('configureComposeTranslation(r.settings)'));
check('content script configures compose after settings changes',
    content.includes('configureComposeTranslation(newSettings)'));
check('content script initializes the compose controller once',
    /if \(!composeController\)[\s\S]*?LctComposeController\.init/.test(content));
check('content script reconfigures an existing compose controller',
    /composeController = window\.LctComposeController\.init\([\s\S]*?composeController\.configure\(composeSettings\)/.test(content));
check('Phase 2 wiring enables contenteditable', content.includes('allowContentEditable: true'));
check('pagehide destroys the compose controller',
    /addEventListener\('pagehide'[\s\S]*?composeController\.destroy\(\)/.test(content));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
