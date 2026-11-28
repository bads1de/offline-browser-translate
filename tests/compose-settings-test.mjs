import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { read, readBackgroundSources } from './background-source.mjs';

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

const defaults = vm.runInContext(read('settings/defaults.js') + '\nDEFAULT_SETTINGS;', vm.createContext({}));
check('compose translation defaults off', defaults.composeTranslationEnabled === false);
check('compose source language defaults to auto', defaults.composeSourceLanguage === 'auto');
check('compose target language defaults to English', defaults.composeTargetLanguage === 'en');

const background = readBackgroundSources();
const needsMatch = background.match(/function needsContentScript\(settings\) \{[\s\S]*?\n\}/);
check('background exposes needsContentScript', !!needsMatch);
if (needsMatch) {
    const needsContentScript = vm.runInContext(needsMatch[0] + '\nneedsContentScript;', vm.createContext({}));
    check('compose alone keeps content script registered', needsContentScript({ composeTranslationEnabled: true }) === true);
    check('floating button still keeps content script registered', needsContentScript({ floatingButton: true }) === true);
    check('auto-translate still keeps content script registered', needsContentScript({ autoTranslatePages: true }) === true);
    check('all proactive features off unregister content script', needsContentScript({
        composeTranslationEnabled: false,
        floatingButton: false,
        autoTranslatePages: false
    }) === false);
}

const optionsHtml = read('options/options.html');
for (const id of [
    'composeTranslationEnabled',
    'composeSourceLanguagePickerEl',
    'composeSourceLanguageTrigger',
    'composeSourceLanguageTriggerLabel',
    'composeSourceLanguageMenu',
    'composeSourceLanguageList',
    'composeTargetLanguagePickerEl',
    'composeTargetLanguageTrigger',
    'composeTargetLanguageTriggerLabel',
    'composeTargetLanguageMenu',
    'composeTargetLanguageList'
]) {
    check(`options HTML contains ${id}`, optionsHtml.includes(`id="${id}"`));
}

// The options page is split across a core script plus feature modules; scan
// all of them for the compose wiring these checks guard.
const options = ['options.js', 'prompts.js', 'glossary.js', 'autotranslate.js', 'events.js']
    .map(file => read('options/' + file))
    .join('\n');
check('options reads the compose enabled setting', options.includes('currentSettings.composeTranslationEnabled'));
check('options reads the compose source language', options.includes('currentSettings.composeSourceLanguage'));
check('options reads the compose target language', options.includes('currentSettings.composeTargetLanguage'));
check('permission removal guards the compose feature',
    options.includes('!currentSettings.composeTranslationEnabled'));

const translations = vm.runInContext(
    read('options/i18n.js') + '\nOPTIONS_I18N;',
    vm.createContext({ i18nRegister() {}, i18nUse() {}, applyI18nStatic() {} })
);
const requiredKeys = [
    'nav.compose',
    'compose.sectionTitle',
    'compose.sectionDesc',
    'compose.enableTitle',
    'compose.enableDesc',
    'compose.sourceLabel',
    'compose.sourceAuto',
    'compose.targetLabel',
    'compose.privacy',
    'compose.cacheNote',
    'compose.scopeNote',
    'toast.composeDenied',
    'toast.composeEnabled',
    'toast.composeDisabled'
];
for (const lang of ['en', 'ja']) {
    const missing = requiredKeys.filter(key => !translations[lang][key]);
    check(`${lang} options translations cover compose UI`, missing.length === 0, missing.join(', '));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
