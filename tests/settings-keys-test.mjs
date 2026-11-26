// Key-set regression test for the shared settings defaults (settings-defaults.js).
// Guards the drift that used to exist as four separate DEFAULT_SETTINGS copies:
// a script may only read keys that settings-defaults.js defines, and settings-defaults.js may only
// define keys some script actually reads.
// Run: node tests/settings-keys-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { backgroundModuleFiles, contentFiles } from './background-source.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..');
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');

// Scripts that read the settings object. vendor/ is third-party code.
const SCRIPTS = [
    ...backgroundModuleFiles(),
    ...contentFiles(),
    'cache.js',
    'options/options.js',
    'popup/popup.js',
    'translator/translator.js',
    'captions/fetcher.js',
    'captions/parser.js',
    'captions/session.js',
    'pdf/layout.js',
    'pdf/paragraphs.js',
    'pdf/pdf-store.js',
    'pdf/pdf-write.js'
];

// Identifiers that hold the settings object in this codebase.
const SETTINGS_IDS = ['settings', 'cachedSettings', 'currentSettings'];

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log('  ok  ' + name); }
    else {
        fail++;
        console.log('FAIL  ' + name);
        if (detail) console.log('      ' + String(detail).replace(/\n/g, '\n      '));
    }
}

// Drop comments and 'single'/"double" quoted strings so a path mention like
// 'settings-defaults.js' can never be read as a `settings-defaults.js` key. Template literals are
// left intact: `${settings.key}` is a real read. Line-comment removal skips the
// `//` of a URL.
function codeOnly(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/"(?:\\[\s\S]|[^"\\\n])*"/g, '""')
        .replace(/'(?:\\[\s\S]|[^'\\\n])*'/g, '""')
        .replace(/(^|[^:\w])\/\/[^\n]*/g, '$1');
}

// Map key -> Set(files) for every `settings.key` / `cachedSettings.key` read in
// one script. `[ \t]*` keeps `settings.` at end of line from pairing with the
// next line's identifier.
function collectKeyReads(rel) {
    const code = codeOnly(read(rel));
    const found = new Map();
    for (const id of SETTINGS_IDS) {
        const re = new RegExp('(?<![.\\w$])' + id + '[ \\t]*\\.[ \\t]*([A-Za-z_$][\\w$]*)', 'g');
        for (const m of code.matchAll(re)) {
            if (!found.has(m[1])) found.set(m[1], new Set());
            found.get(m[1]).add(rel);
        }
    }
    return found;
}

console.log('Settings key set:');

// 1. settings-defaults.js is the only definition and it exports a real object.
const defaults = vm.runInContext(read('settings-defaults.js') + '\nDEFAULT_SETTINGS;', vm.createContext({}));
const defaultKeys = Object.keys(defaults || {});
check('settings-defaults.js exports DEFAULT_SETTINGS', !!defaults && typeof defaults === 'object');
check('settings-defaults.js defines a usable key set', defaultKeys.length >= 20, defaultKeys.length + ' keys');

const definingFiles = [...SCRIPTS, 'settings-defaults.js'].filter(rel =>
    /DEFAULT_SETTINGS\s*=\s*\{/.test(codeOnly(read(rel))));
check('no other script defines DEFAULT_SETTINGS',
    definingFiles.length === 1 && definingFiles[0] === 'settings-defaults.js',
    'defining files: ' + definingFiles.join(', '));

// 2. Gather every key read anywhere in the extension.
const reads = new Map();
for (const rel of SCRIPTS) {
    for (const [key, files] of collectKeyReads(rel)) {
        if (!reads.has(key)) reads.set(key, new Set());
        for (const f of files) reads.get(key).add(f);
    }
}

// 3. No script may read a key settings-defaults.js doesn't define (typo, or a setting
//    that was removed without updating its reader).
const unknown = [...reads.keys()].filter(k => !defaultKeys.includes(k)).sort();
check('every key read by a script exists in settings-defaults.js', unknown.length === 0,
    unknown.map(k => k + ' <- ' + [...reads.get(k)].join(', ')).join('\n'));

// 4. Every default must have a reader, so a renamed or dropped setting can't
//    leave a stale entry behind that silently does nothing.
const unread = defaultKeys.filter(k => !reads.has(k)).sort();
check('every key in settings-defaults.js is read by some script', unread.length === 0,
    'never read: ' + unread.join(', '));

console.log(`\n${defaultKeys.length} default keys, ${reads.size} distinct keys read`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
