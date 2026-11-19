// Integration test (Phase 0 spike): real vendored pdf.js getTextContent()
// output -> LctPdfParagraphs.extractParagraphs(). Run: node tests/pdf-extract-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeFixturePdf } from './pdf-fixture.mjs';

// Keep failures readable: the minified pdf.js source line is huge.
process.on('uncaughtException', e => { console.error('UNCAUGHT:', e && e.message); process.exit(1); });
process.on('unhandledRejection', e => { console.error('REJECTION:', e && e.message); process.exit(1); });

// Node 22 lacks Promise.try / TypedArray.toHex (used by pdf.js 6.x); polyfill for the test harness.
if (typeof Promise.try !== 'function') {
    Promise.try = function (fn, ...args) {
        return new Promise(resolve => resolve(fn(...args)));
    };
}
if (typeof Uint8Array.prototype.toHex !== 'function') {
    Uint8Array.prototype.toHex = function () {
        return Array.from(this, b => b.toString(16).padStart(2, '0')).join('');
    };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..');

// Load the paragraph module exactly as the browser does (classic script).
const source = fs.readFileSync(path.join(repo, 'pdf', 'paragraphs.js'), 'utf8');
const context = vm.createContext({ window: {}, console, URL });
vm.runInContext(source, context);
const P = context.window.LctPdfParagraphs;

const pdfjs = await import(pathToFileURL(path.join(repo, 'vendor', 'pdfjs', 'pdf.min.mjs')).href);
// Node has no real Worker: provide the worker module for pdf.js' fake worker.
globalThis.pdfjsWorker = await import(pathToFileURL(path.join(repo, 'vendor', 'pdfjs', 'pdf.worker.min.mjs')).href);

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
    if (cond) { pass++; console.log('PASS', name); }
    else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); }
};

const data = makeFixturePdf();
const fontUrl = pathToFileURL(path.join(repo, 'vendor', 'pdfjs', 'standard_fonts')).href + '/';
const cmapUrl = pathToFileURL(path.join(repo, 'vendor', 'pdfjs', 'cmaps')).href + '/';
const doc = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: false,
    standardFontDataUrl: fontUrl,
    cMapUrl: cmapUrl,
    cMapPacked: true
}).promise;

check('pdf.js: document opened', doc.numPages === 2, doc.numPages);

// --- Page 1: single column, hyphen healing, gap split -----------------------
const page1 = await doc.getPage(1);
const vp1 = page1.getViewport({ scale: 1 });
const tc1 = await page1.getTextContent();
check('page1: text items extracted', tc1.items.length >= 3, tc1.items.length);
const ex1 = P.extractParagraphs(tc1.items, vp1);
check('page1: two paragraphs', ex1.paragraphs.length === 2, ex1.paragraphs.map(p => p.text));
check('page1: hyphen healed across lines',
    ex1.paragraphs[0].text === 'We study translation of documents.', ex1.paragraphs[0]);
check('page1: second paragraph', ex1.paragraphs[1].text === 'Second paragraph here.', ex1.paragraphs[1]);
check('page1: quality ok', ex1.quality === 'ok');
check('page1: not two-column', ex1.twoColumn === false);

// --- Page 2: full-width title + two columns ---------------------------------
const page2 = await doc.getPage(2);
const vp2 = page2.getViewport({ scale: 1 });
const tc2 = await page2.getTextContent();
const ex2 = P.extractParagraphs(tc2.items, vp2);
check('page2: two-column detected', ex2.twoColumn === true, ex2);
const texts2 = ex2.paragraphs.map(p => p.text);
check('page2: title first', texts2[0] === 'A Great Paper Title That Spans Both Columns Of The Page', texts2);
check('page2: left column reads before right',
    texts2[1] === 'Left column line one. Left column line two. Left column line three.' &&
    texts2[2] === 'Right column line one. Right column line two. Right column line three.',
    texts2);
check('page2: three paragraphs', texts2.length === 3, texts2);

await doc.loadingTask.destroy();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
