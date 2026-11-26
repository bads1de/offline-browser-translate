// Shared loader for the background worker sources.
//
// The worker is split into background/ modules; manifest `background.scripts`
// is the single ordered list of what makes it up (and matches the importScripts
// order in background/entry.js). Tests that used to read the worker as one file
// read the joined sources through here instead.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function read(rel) {
    return fs.readFileSync(path.join(repo, rel), 'utf8');
}

// Every script the background worker is made of, in load order.
export function backgroundFiles() {
    return JSON.parse(read('manifest.json')).background.scripts;
}

// Only the worker's own code (background/ modules and their entry point),
// without the shared page scripts (settings/defaults.js, languages.js, ...)
// that it also imports.
export function backgroundModuleFiles() {
    return backgroundFiles().filter(file => file.startsWith('background/'));
}

// The worker's own sources joined, for the wiring tests that grep for code.
export function readBackgroundSources() {
    return backgroundModuleFiles().map(read).join('\n');
}

// The content scripts injected in order: compose modules, content/ fragments,
// then the caption modules. Read from the background's list so there is one
// source of truth.
export function contentFiles() {
    const source = read('background/content-injection.js');
    const match = source.match(/const CONTENT_SCRIPTS = \[[\s\S]*?\n\];/);
    if (!match) throw new Error('CONTENT_SCRIPTS not found in background/content-injection.js');
    return vm.runInContext(match[0] + '\nCONTENT_SCRIPTS;', vm.createContext({}));
}

// The content script sources joined, for the wiring tests that grep for code.
export function readContentSources() {
    return contentFiles().map(read).join('\n');
}
