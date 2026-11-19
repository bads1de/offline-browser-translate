// Bounding-box tests for pdf/paragraphs.js (overlay + export need per-para bbox).
// Run: node tests/pdf-bbox-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = vm.createContext({ window: {}, console, URL });
vm.runInContext(fs.readFileSync(path.join(here, '..', 'pdf', 'paragraphs.js'), 'utf8'), ctx);
const P = ctx.window.LctPdfParagraphs;
let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('PASS', n); } else { fail++; console.log('FAIL', n, x === undefined ? '' : JSON.stringify(x)); } };
const item = (str, x, y, fs = 10, width = null) => ({ str, width: width === null ? str.length * fs * 0.5 : width, height: fs, transform: [fs, 0, 0, fs, x, y], fontName: 'g1' });

// Two-line paragraph at x=72.., baselines y=700 and y=688, fs=10.
const vp = { width: 612, height: 792 };
const ex = P.extractParagraphs([
    item('Hello world', 72, 700, 10, 60),
    item('second line', 72, 688, 10, 60)
], vp);
check('one paragraph', ex.paragraphs.length === 1, ex.paragraphs);
const b = ex.paragraphs[0].bbox;
check('bbox exists', !!b, ex.paragraphs[0]);
check('bbox.x0 = left edge', b && Math.abs(b.x0 - 72) < 0.01, b);
check('bbox.x1 = right edge', b && Math.abs(b.x1 - 132) < 0.01, b);
check('bbox.top above first baseline', b && b.top > 700 && b.top <= 712, b);
check('bbox.bottom below last baseline', b && b.bottom < 688 && b.bottom >= 680, b);
check('bbox spans both lines', b && (b.top - b.bottom) > 12, b);

// Two separate paragraphs (big gap) get distinct bboxes.
const ex2 = P.extractParagraphs([
    item('Top para', 72, 700, 10, 50),
    item('Bottom para', 72, 600, 10, 50)
], vp);
check('two paragraphs', ex2.paragraphs.length === 2, ex2.paragraphs);
check('distinct bbox y', ex2.paragraphs[0].bbox.top > ex2.paragraphs[1].bbox.top, ex2.paragraphs.map(p => p.bbox));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
