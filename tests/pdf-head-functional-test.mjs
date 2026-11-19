// FR-12 functional test: a local server serves an extensionless path as
// application/pdf; verify the HEAD-probe logic detects it (and rejects HTML).
// Self-contained (ephemeral port). Run: node tests/pdf-head-functional-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { makeFixturePdf } from './pdf-fixture.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = vm.createContext({ window: {}, console, URL });
vm.runInContext(fs.readFileSync(path.join(here, '..', 'pdf', 'paragraphs.js'), 'utf8'), ctx);
const P = ctx.window.LctPdfParagraphs;
const pdfBytes = makeFixturePdf();

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('PASS', n); } else { fail++; console.log('FAIL', n, x === undefined ? '' : JSON.stringify(x)); } };

const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/notpdf') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(req.method === 'HEAD' ? undefined : '<html>hi</html>'); return; }
    if (u === '/octet') { res.writeHead(200, { 'Content-Type': 'application/octet-stream' }); res.end(req.method === 'HEAD' ? undefined : Buffer.from(pdfBytes)); return; }
    // /doc (extensionless) and /file.pdf both serve a real PDF
    res.writeHead(200, { 'Content-Type': 'application/pdf' });
    res.end(req.method === 'HEAD' ? undefined : Buffer.from(pdfBytes));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// Replicates background PROBE_PDF / FETCH_PDF guard logic.
async function probe(url) {
    if (P.isPdfUrl(url)) return { isPdf: true, via: 'extension' };
    const head = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const ct = head.headers.get('content-type') || '';
    return { isPdf: head.ok && P.isPdfContentType(ct), via: 'head', ct };
}

const doc = await probe(base + '/doc');
check('extensionless /doc detected as PDF via HEAD', doc.isPdf === true && doc.via === 'head', doc);
check('/doc content-type is application/pdf', /application\/pdf/.test(doc.ct || ''), doc);

const notpdf = await probe(base + '/notpdf');
check('HTML /notpdf rejected', notpdf.isPdf === false, notpdf);

const octet = await probe(base + '/octet');
check('octet-stream not detected by content-type (magic handles .pdf only)', octet.isPdf === false, octet);

const filepdf = await probe(base + '/file.pdf');
check('.pdf URL detected by extension (no HEAD needed)', filepdf.isPdf === true && filepdf.via === 'extension', filepdf);

// Full FETCH_PDF-like flow for /doc: guard passes -> GET -> %PDF magic.
const guard = await probe(base + '/doc');
let fetchOk = false;
if (guard.isPdf) {
    const resp = await fetch(base + '/doc');
    const buf = new Uint8Array(await resp.arrayBuffer());
    const head = new Uint8Array(buf.buffer, 0, Math.min(1024, buf.byteLength));
    fetchOk = String.fromCharCode(...head).includes('%PDF-');
}
check('extensionless /doc full fetch passes %PDF magic', fetchOk === true);

server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
