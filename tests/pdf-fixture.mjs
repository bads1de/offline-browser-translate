// Minimal hand-built PDF fixtures for the pdf.js integration test.
// No dependencies: emits valid PDF 1.4 bytes with Helvetica text so
// getTextContent() returns predictable items. Run via pdf-extract-test.mjs.

const esc = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

// lines: [{text, x, y, size}]
function contentStream(lines) {
    return lines.map(l =>
        `BT /F1 ${l.size} Tf 1 0 0 1 ${l.x} ${l.y} Tm (${esc(l.text)}) Tj ET`
    ).join('\n');
}

function makePdf(pages) {
    // pages: array of line arrays; page size 612x792 (US Letter)
    const objs = [];
    const pageIds = pages.map((_, i) => 3 + i * 2);
    objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
    objs[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
    pages.forEach((lines, i) => {
        const pid = 3 + i * 2, cid = pid + 1;
        objs[pid] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> /Contents ${cid} 0 R >>`;
        const stream = contentStream(lines);
        objs[cid] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });
    objs[3 + pages.length * 2] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

    let out = '%PDF-1.4\n';
    const offsets = [0];
    for (let i = 1; i < objs.length; i++) {
        offsets[i] = out.length;
        out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
    }
    const xrefPos = out.length;
    out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objs.length; i++) {
        out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
    return new Uint8Array([...out].map(c => c.charCodeAt(0)));
}

// Page 1: single column, hyphen line-break, two paragraphs separated by a gap.
export const simplePage = [
    { text: 'We study trans-', x: 72, y: 700, size: 10 },
    { text: 'lation of documents.', x: 72, y: 688, size: 10 },
    { text: 'Second paragraph here.', x: 72, y: 662, size: 10 }
];

// Page 2: full-width title + two columns with a clean center gutter.
export const twoColumnPage = [
    { text: 'A Great Paper Title That Spans Both Columns Of The Page', x: 50, y: 750, size: 14 },
    { text: 'Left column line one.', x: 50, y: 700, size: 10 },
    { text: 'Left column line two.', x: 50, y: 688, size: 10 },
    { text: 'Left column line three.', x: 50, y: 676, size: 10 },
    { text: 'Right column line one.', x: 330, y: 700, size: 10 },
    { text: 'Right column line two.', x: 330, y: 688, size: 10 },
    { text: 'Right column line three.', x: 330, y: 676, size: 10 }
];

export function makeFixturePdf() {
    return makePdf([simplePage, twoColumnPage]);
}

// 48 paragraphs over 4 pages: enough chunks to exercise cancel/resume/failure.
export function makeBigPdf() {
    const pages = [];
    for (let p = 0; p < 4; p++) {
        const lines = [];
        let y = 750;
        for (let i = 0; i < 12; i++) {
            lines.push({ text: `Page ${p + 1} paragraph ${i + 1} first line.`, x: 72, y, size: 10 });
            y -= 12;
            lines.push({ text: `second line of paragraph ${i + 1}.`, x: 72, y, size: 10 });
            y -= 22;
        }
        pages.push(lines);
    }
    return makePdf(pages);
}
