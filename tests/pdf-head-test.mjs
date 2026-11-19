// FR-12: extensionless PDF detection via HEAD Content-Type.
// Unit (isPdfContentType) + wiring (background PROBE_PDF / FETCH_PDF HEAD, popup probe).
// Run: node tests/pdf-head-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..');
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');
const ctx = vm.createContext({ window: {}, console, URL });
vm.runInContext(read('pdf/paragraphs.js'), ctx);
const P = ctx.window.LctPdfParagraphs;
const bg = read('background.js');
const popup = read('popup/popup.js');
let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('PASS', n); } else { fail++; console.log('FAIL', n, x === undefined ? '' : JSON.stringify(x)); } };

// --- isPdfContentType unit ---
check('isPdfContentType is a function', typeof P.isPdfContentType === 'function');
check('application/pdf', P.isPdfContentType('application/pdf') === true);
check('application/pdf with params', P.isPdfContentType('application/pdf; charset=binary') === true);
check('uppercase APPLICATION/PDF', P.isPdfContentType('APPLICATION/PDF') === true);
check('application/x-pdf', P.isPdfContentType('application/x-pdf') === true);
check('text/html is not pdf', P.isPdfContentType('text/html; charset=utf-8') === false);
check('octet-stream is not pdf (sniff magic instead)', P.isPdfContentType('application/octet-stream') === false);
check('null is not pdf', P.isPdfContentType(null) === false);
check('empty is not pdf', P.isPdfContentType('') === false);

// --- background wiring ---
check("background has case 'PROBE_PDF'", /case\s+'PROBE_PDF'/.test(bg));
check('background issues a HEAD request', /method:\s*'HEAD'/.test(bg));
check('background uses isPdfContentType', /isPdfContentType\s*\(/.test(bg));
check('FETCH_PDF still validates %PDF- magic', bg.includes("'%PDF-'"));

// --- popup wiring ---
check('popup sends PROBE_PDF message', /type:\s*'PROBE_PDF'/.test(popup));
check('popup refreshPdfButtons probes extensionless URLs', /PROBE_PDF/.test(popup) && /isPdf/.test(popup));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
