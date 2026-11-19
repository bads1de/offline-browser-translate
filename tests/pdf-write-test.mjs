// Tests for pdf/pdf-write.js: minimal dependency-free PDF writer that embeds
// one JPEG image per page. Run: node tests/pdf-write-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = vm.createContext({ window: {}, console, Uint8Array });
vm.runInContext(fs.readFileSync(path.join(here, '..', 'pdf', 'pdf-write.js'), 'utf8'), ctx);
const W = ctx.window.LctPdfWrite;
let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('PASS', n); } else { fail++; console.log('FAIL', n, x === undefined ? '' : JSON.stringify(x)); } };

check('module exposed', !!W && typeof W.buildPdfFromImages === 'function');

// Fake JPEG bytes (structure test only; real decode is verified in-browser).
const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0xFF, 0xD9]);
const pages = [
    { jpeg, width: 612, height: 792, pxWidth: 1224, pxHeight: 1584 },
    { jpeg, width: 612, height: 792, pxWidth: 1224, pxHeight: 1584 }
];
const pdf = W.buildPdfFromImages(pages);
check('returns Uint8Array', pdf instanceof Uint8Array, typeof pdf);
const latin = Array.from(pdf, b => String.fromCharCode(b)).join('');
check('starts with %PDF-1.', latin.startsWith('%PDF-1.'), latin.slice(0, 12));
check('has Catalog', /\/Type\s*\/Catalog/.test(latin));
check('has Pages with Count 2', /\/Type\s*\/Pages[\s\S]*\/Count\s+2/.test(latin));
check('two Page objects', (latin.match(/\/Type\s*\/Page[^s]/g) || []).length === 2, (latin.match(/\/Type\s*\/Page[^s]/g) || []).length);
check('two DCTDecode images', (latin.match(/\/Filter\s*\/DCTDecode/g) || []).length === 2);
check('MediaBox present', /\/MediaBox\s*\[\s*0\s+0\s+612\s+792\s*\]/.test(latin));
check('has xref', /\nxref\n/.test(latin));
check('has trailer + Root', /trailer[\s\S]*\/Root\s+1\s+0\s+R/.test(latin));
check('ends with %%EOF', latin.trimEnd().endsWith('%%EOF'), latin.slice(-12));
check('startxref present', /startxref\n\d+\n%%EOF/.test(latin));

// Single page works too.
const one = W.buildPdfFromImages([pages[0]]);
const oneLatin = Array.from(one, b => String.fromCharCode(b)).join('');
check('single page Count 1', /\/Count\s+1/.test(oneLatin));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
