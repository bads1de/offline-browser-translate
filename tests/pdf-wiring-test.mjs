// Wiring regression test for the PDF fetch path (FR-1/FR-2).
// Guards against the real bug "isPdfUrl is not defined": background.js must call
// the qualified LctPdfParagraphs.isPdfUrl, never a bare global isPdfUrl().
// Run: node tests/pdf-wiring-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { read, readBackgroundSources } from './background-source.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..');

// Only the worker's own code: pdf/paragraphs.js defines isPdfUrl, so including
// the shared scripts would defeat the bare-call check below.
const bg = readBackgroundSources();
const entry = read('background.js');
const manifest = JSON.parse(read('manifest.json'));
const popup = read('popup/popup.js');

let pass = 0, fail = 0;
function check(name, cond) {
    if (cond) { pass++; console.log('  ok  ' + name); }
    else { fail++; console.log('FAIL  ' + name); }
}

console.log('PDF fetch wiring:');
// 1. Both pdf scripts are loaded in the SW and declared for Firefox.
check('importScripts loads pdf/paragraphs.js', /importScripts\([^)]*['"]pdf\/paragraphs\.js['"]/.test(entry));
check('importScripts loads pdf/pdf-store.js', /importScripts\([^)]*['"]pdf\/pdf-store\.js['"]/.test(entry));
const scripts = manifest.background?.scripts || [];
check('manifest background.scripts has pdf/paragraphs.js', scripts.includes('pdf/paragraphs.js'));
check('manifest background.scripts has pdf/pdf-store.js', scripts.includes('pdf/pdf-store.js'));

// 2. FETCH_PDF handler exists and uses QUALIFIED helpers (the actual bug).
check("background has case 'FETCH_PDF'", /case\s+'FETCH_PDF'/.test(bg));
const bareIsPdfUrl = bg.match(/(?<![.\w])isPdfUrl\s*\(/g) || [];
check('no bare isPdfUrl() call in background.js', bareIsPdfUrl.length === 0);
check('background wires LctPdfParagraphs helper (qualified isPdfUrl)', /self\.LctPdfParagraphs/.test(bg));
check('background uses LctPdfStore.savePdf', /LctPdfStore\.savePdf\s*\(/.test(bg));
check('background validates %PDF- magic bytes', bg.includes("'%PDF-'"));

// 3. Popup sends FETCH_PDF and gates on the qualified isPdfUrl.
check('popup sends FETCH_PDF message', /type:\s*'FETCH_PDF'/.test(popup));
check('popup gates on LctPdfParagraphs.isPdfUrl', /LctPdfParagraphs/.test(popup) && /\.isPdfUrl\s*\(/.test(popup));

// 4. Functional: the real paragraphs.js really classifies the reported URL.
const ctx = vm.createContext({ window: {}, console, URL });
vm.runInContext(read('pdf/paragraphs.js'), ctx);
const P = ctx.window.LctPdfParagraphs;
check('LctPdfParagraphs.isPdfUrl is a function', typeof P?.isPdfUrl === 'function');
check('isPdfUrl(99helpers sample-document.pdf) === true', P.isPdfUrl('https://99helpers.com/samples/pdf/sample-document.pdf') === true);
check('isPdfUrl(arxiv /pdf/1706.03762) === true', P.isPdfUrl('https://arxiv.org/pdf/1706.03762') === true);
check('isPdfUrl(example.com/page) === false', P.isPdfUrl('https://example.com/page') === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
