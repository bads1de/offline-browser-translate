/**
 * Minimal, dependency-free PDF writer for the translated-PDF export.
 * Embeds one JPEG image per page (DCTDecode) at the original page size, so the
 * exported PDF preserves the original layout with Japanese painted over it.
 * No external library; pure bytes. Exposed as `LctPdfWrite`.
 * Unit tests: node tests/pdf-write-test.mjs (structure). Real decode is verified
 * in-browser by re-opening the result with pdf.js.
 *
 * buildPdfFromImages([{ jpeg:Uint8Array, width, height, pxWidth, pxHeight }])
 *   width/height  = page size in PDF points (original viewport at scale 1)
 *   pxWidth/pxHeight = JPEG pixel dimensions
 */
(function (scope) {
    'use strict';

    function buildPdfFromImages(pages) {
        const chunks = [];
        let len = 0;
        const enc = s => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xff; return a; };
        const push = x => { const a = typeof x === 'string' ? enc(x) : x; chunks.push(a); len += a.length; };
        const offsets = [];
        const N = pages.length;
        const totalObjs = 2 + N * 3;
        const beginObj = n => { offsets[n] = len; push(n + ' 0 obj\n'); };
        const endObj = () => push('endobj\n');

        push('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');
        beginObj(1); push('<< /Type /Catalog /Pages 2 0 R >>\n'); endObj();
        const kids = pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ');
        beginObj(2); push('<< /Type /Pages /Kids [' + kids + '] /Count ' + N + ' >>\n'); endObj();

        pages.forEach((pg, i) => {
            const pageNo = 3 + i * 3, contentNo = pageNo + 1, imgNo = pageNo + 2;
            const W = pg.width, H = pg.height;
            beginObj(pageNo);
            push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] ' +
                '/Resources << /XObject << /Im0 ' + imgNo + ' 0 R >> >> /Contents ' + contentNo + ' 0 R >>\n');
            endObj();
            const content = 'q\n' + W + ' 0 0 ' + H + ' 0 0 cm\n/Im0 Do\nQ\n';
            beginObj(contentNo);
            push('<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream\n');
            endObj();
            beginObj(imgNo);
            push('<< /Type /XObject /Subtype /Image /Width ' + pg.pxWidth + ' /Height ' + pg.pxHeight +
                ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + pg.jpeg.length + ' >>\nstream\n');
            push(pg.jpeg);
            push('\nendstream\n');
            endObj();
        });

        const xrefPos = len;
        push('xref\n0 ' + (totalObjs + 1) + '\n');
        push('0000000000 65535 f \n');
        for (let n = 1; n <= totalObjs; n++) push(String(offsets[n]).padStart(10, '0') + ' 00000 n \n');
        push('trailer\n<< /Size ' + (totalObjs + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n');

        const out = new Uint8Array(len);
        let o = 0;
        for (const a of chunks) { out.set(a, o); o += a.length; }
        return out;
    }

    scope.LctPdfWrite = { buildPdfFromImages };
})(typeof window !== 'undefined' ? window : globalThis);
