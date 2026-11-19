/**
 * Text layout helpers for the PDF overlay + translated-PDF export.
 * Pure logic: every function takes a `measure(text, fontSize) -> width` callback
 * so it can be unit-tested in Node and driven by canvas.measureText in the page.
 * Exposed as `LctPdfLayout`. Unit tests: node tests/pdf-layout-test.mjs
 */
(function (scope) {
    'use strict';
    const CJK_RE = /[\u3000-\u9fff\uf900-\ufaff\uff00-\uffef]/;

    /** Split text into minimal break units: each CJK char alone, latin words
     *  carrying their trailing space. Joining the units reproduces the text. */
    function breakUnits(text) {
        const out = [];
        let word = '';
        const flush = () => { if (word) { out.push(word); word = ''; } };
        for (const ch of String(text)) {
            if (CJK_RE.test(ch)) { flush(); out.push(ch); }
            else if (ch === ' ' || ch === '\t') { word += ' '; flush(); }
            else if (ch === '\n') { flush(); out.push('\n'); }
            else word += ch;
        }
        flush();
        return out;
    }

    /** Wrap text to maxWidth at a fixed font size. CJK breaks per character,
     *  latin breaks on words. Returns an array of lines (no trailing spaces). */
    function wrapLines(measure, text, maxWidth, size) {
        const units = breakUnits(text);
        const lines = [];
        let line = '';
        for (const u of units) {
            if (u === '\n') { lines.push(line.replace(/\s+$/, '')); line = ''; continue; }
            const candidate = line + u;
            if (line && measure(candidate, size) > maxWidth) {
                lines.push(line.replace(/\s+$/, ''));
                line = u.replace(/^\s+/, '');
            } else {
                line = candidate;
            }
        }
        if (line.trim()) lines.push(line.replace(/\s+$/, ''));
        return lines.length ? lines : [''];
    }

    /**
     * Shrink the font size until the wrapped block fits inside boxW x boxH.
     * Returns { size, lines, lineHeight }. Never goes below minSize; if it still
     * overflows at minSize the caller clips (overflow:hidden) rather than loops.
     */
    function fitText(measure, text, boxW, boxH, startSize, minSize = 5, lineHeight = 1.25) {
        let size = Math.max(minSize, startSize);
        while (size > minSize) {
            const lines = wrapLines(measure, text, boxW, size);
            if (lines.length * size * lineHeight <= boxH) return { size, lines, lineHeight };
            size = Math.max(minSize, size - 0.5);
        }
        return { size: minSize, lines: wrapLines(measure, text, boxW, minSize), lineHeight };
    }

    scope.LctPdfLayout = { breakUnits, wrapLines, fitText };
})(typeof window !== 'undefined' ? window : globalThis);
