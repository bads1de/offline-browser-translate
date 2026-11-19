// Self-test for pdf/paragraphs.js (PDF text extraction -> paragraph recovery).
// Loads the real module with a tiny window shim. Run: node tests/pdf-paragraphs-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'pdf', 'paragraphs.js'), 'utf8');
const context = vm.createContext({ window: {}, console, URL });
vm.runInContext(source, context);
const P = context.window.LctPdfParagraphs;

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
    if (cond) { pass++; console.log('PASS', name); }
    else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); }
};

// Helper: build a pdf.js-style text item. PDF coordinates: y grows upwards.
const item = (str, x, y, fontSize = 10, width = null) => ({
    str,
    width: width === null ? str.length * fontSize * 0.5 : width,
    height: fontSize,
    transform: [fontSize, 0, 0, fontSize, x, y],
    fontName: 'g1'
});

// ---------------------------------------------------------------------------
// isPdfUrl (FR-1: extension detection incl. query/fragment; arXiv /pdf/ paths)
// ---------------------------------------------------------------------------
check('url: plain .pdf', P.isPdfUrl('https://example.com/paper.pdf') === true);
check('url: uppercase + query + fragment', P.isPdfUrl('https://example.com/paper.PDF?x=1#page=2') === true);
check('url: query after .pdf', P.isPdfUrl('https://example.com/paper.pdf?download=1') === true);
check('url: html page', P.isPdfUrl('https://example.com/page.html') === false);
check('url: .pdfx is not .pdf', P.isPdfUrl('https://example.com/report.pdfx') === false);
check('url: pdf.js is not a pdf', P.isPdfUrl('https://example.com/pdf.js') === false);
check('url: file:// pdf', P.isPdfUrl('file:///C:/Users/me/paper.pdf') === true);
check('url: arXiv /pdf/ without extension', P.isPdfUrl('https://arxiv.org/pdf/2401.00001v1') === true);
check('url: arXiv abs page is not pdf', P.isPdfUrl('https://arxiv.org/abs/2401.00001') === false);
check('url: empty', P.isPdfUrl('') === false);
check('url: null', P.isPdfUrl(null) === false);
check('url: garbage', P.isPdfUrl('not a url') === false);

// ---------------------------------------------------------------------------
// buildLines: cluster items by baseline Y, sort top-to-bottom, join by X
// ---------------------------------------------------------------------------
const lines1 = P.buildLines([
    item('Hello', 72, 700),
    item(' world', 97, 700),
    item('Next line', 72, 688)
]);
check('lines: count', lines1.length === 2, lines1);
check('lines: same-baseline joined', lines1[0].text === 'Hello world', lines1[0]);
check('lines: top-to-bottom order', lines1[1].text === 'Next line', lines1[1]);
check('lines: fontSize kept', lines1[0].fontSize === 10);

const lines2 = P.buildLines([
    item('Hello', 72, 700, 10, 25),
    item('world', 110, 700, 10, 25)
]);
check('lines: visual gap becomes space', lines2[0].text === 'Hello world', lines2[0]);

const lines3 = P.buildLines([
    item('Hel', 72, 700, 10, 15),
    item('lo', 87, 700, 10, 10)
]);
check('lines: adjacent items no extra space', lines3[0].text === 'Hello', lines3[0]);

const lines4 = P.buildLines([
    item('a', 72, 700),
    item('b', 90, 700.4),
    item('c', 72, 688)
]);
check('lines: small y jitter stays one line', lines4.length === 2 && lines4[0].text === 'a b', lines4);

check('lines: empty items', P.buildLines([]).length === 0);
check('lines: whitespace-only items skipped', P.buildLines([item('   ', 72, 700), item('x', 72, 688)]).length === 1);

// ---------------------------------------------------------------------------
// groupParagraphs: gap / indent splits, hyphen healing, CJK joining
// ---------------------------------------------------------------------------
const paras1 = P.groupParagraphs(P.buildLines([
    item('First line of para', 72, 700),
    item('second line', 72, 688),
    item('third line', 72, 676),
    item('New paragraph after big gap', 72, 650)
]));
check('paras: line gap splits', paras1.length === 2, paras1.map(p => p.text));
check('paras: lines joined with space', paras1[0].text === 'First line of para second line third line', paras1[0]);

const paras2 = P.groupParagraphs(P.buildLines([
    item('Body text here', 72, 700),
    item('Indented new paragraph', 92, 688)
]));
check('paras: indent starts new paragraph', paras2.length === 2, paras2.map(p => p.text));

const paras3 = P.groupParagraphs(P.buildLines([
    item('We study trans-', 72, 700),
    item('lation of documents.', 72, 688)
]));
check('paras: hyphen healed', paras3.length === 1 && paras3[0].text === 'We study translation of documents.', paras3.map(p => p.text));

const paras4 = P.groupParagraphs(P.buildLines([
    item('This is well-', 72, 700),
    item('Known fact.', 72, 688)
]));
check('paras: hyphen kept before uppercase', paras4[0].text === 'This is well- Known fact.', paras4[0]);

const paras5 = P.groupParagraphs(P.buildLines([
    item('日本語の', 72, 700),
    item('テキストです', 72, 688)
]));
check('paras: CJK joined without space', paras5.length === 1 && paras5[0].text === '日本語のテキストです', paras5.map(p => p.text));

// ---------------------------------------------------------------------------
// Footnotes: tiny-font lines form their own paragraph, never merge into body
// ---------------------------------------------------------------------------
const footLines = P.buildLines([
    item('Body line one', 72, 700, 10),
    item('Body line two', 72, 688, 10),
    item('1 A small footnote', 72, 100, 6),
    item('continued footnote text', 72, 92, 6)
]);
const footParas = P.groupParagraphs(footLines);
check('footnotes: separate from body', footParas.length === 2, footParas.map(p => p.text));
check('footnotes: body intact', footParas[0].text === 'Body line one Body line two', footParas[0]);
check('footnotes: footnote lines merged', footParas[1].text === '1 A small footnote continued footnote text', footParas[1]);

// ---------------------------------------------------------------------------
// Two-column detection and reading order (FR-3)
// ---------------------------------------------------------------------------
const twoColLines = P.buildLines([
    item('L1', 50, 700, 10, 200),
    item('R1', 320, 700, 10, 200),
    item('L2', 50, 688, 10, 200),
    item('R2', 320, 688, 10, 200),
    item('L3', 50, 676, 10, 200),
    item('R3', 320, 676, 10, 200)
]);
check('2col: detected', P.detectTwoColumns(twoColLines, 600) === true);
const ordered = P.orderLines(twoColLines, 600);
check('2col: left column first', ordered.map(l => l.text).join(',') === 'L1,L2,L3,R1,R2,R3', ordered.map(l => l.text));

const oneColLines = P.buildLines([
    item('Full width line one', 50, 700, 10, 500),
    item('Full width line two', 50, 688, 10, 500)
]);
check('2col: single column not detected', P.detectTwoColumns(oneColLines, 600) === false);
check('2col: single column order unchanged', P.orderLines(oneColLines, 600).map(l => l.text).join(',') === 'Full width line one,Full width line two');

const titleAndCols = P.buildLines([
    item('A Great Paper Title', 50, 750, 14, 500),
    item('L1', 50, 700, 10, 200),
    item('R1', 320, 700, 10, 200),
    item('L2', 50, 688, 10, 200),
    item('R2', 320, 688, 10, 200)
]);
const orderedWithTitle = P.orderLines(titleAndCols, 600);
check('2col: full-width title stays on top', orderedWithTitle.map(l => l.text).join(',') === 'A Great Paper Title,L1,L2,R1,R2', orderedWithTitle.map(l => l.text));

const crossingLines = P.buildLines([
    item('text crossing the middle', 50, 700, 10, 350),
    item('another crossing line', 60, 688, 10, 340),
    item('third crossing line', 55, 676, 10, 345)
]);
check('2col: crossing lines fall back', P.detectTwoColumns(crossingLines, 600) === false);

// ---------------------------------------------------------------------------
// Quality assessment (FR-3: garbled / CID detection)
// ---------------------------------------------------------------------------
check('quality: normal text ok', P.assessQuality('This is perfectly normal English text.') === 'ok');
check('quality: replacement chars low', P.assessQuality('\uFFFD\uFFFD\uFFFD broken \uFFFD\uFFFD text \uFFFD\uFFFD') === 'low');
check('quality: cid glyphs low', P.assessQuality('(cid:12) (cid:34) (cid:56) hello (cid:78)') === 'low');
check('quality: empty ok', P.assessQuality('') === 'ok');

// ---------------------------------------------------------------------------
// extractParagraphs: end-to-end shape
// ---------------------------------------------------------------------------
const extracted = P.extractParagraphs([
    item('Abstract— We present', 72, 700),
    item('a method for translation.', 72, 688),
    item('', 0, 0),
    item('1. Introduction', 72, 650)
], { width: 612, height: 792 });
check('extract: paragraphs', extracted.paragraphs.length === 2, extracted);
check('extract: first paragraph text', extracted.paragraphs[0].text === 'Abstract— We present a method for translation.', extracted.paragraphs[0]);
check('extract: quality ok', extracted.quality === 'ok');
check('extract: twoColumn flag', extracted.twoColumn === false);
const extractedEmpty = P.extractParagraphs([], { width: 612, height: 792 });
check('extract: empty page', extractedEmpty.paragraphs.length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
