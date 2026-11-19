/**
 * PDF paragraph recovery for Local LLM Translator (PDF translation, FR-3).
 *
 * Pure logic, no DOM / no pdf.js dependency: takes the raw items returned by
 * pdf.js `page.getTextContent()` and rebuilds reading-order paragraphs.
 * Loaded as a classic script in the viewer page, the popup and the background
 * service worker (importScripts); exposed as `LctPdfParagraphs`.
 *
 * Unit tests: node tests/pdf-paragraphs-test.mjs
 * Integration: node tests/pdf-extract-test.mjs (real pdf.js output)
 */
(function (scope) {
    'use strict';

    // CJK ideographs / kana / fullwidth forms: join adjacent lines without a space.
    const CJK_RE = /[\u3000-\u9fff\uf900-\ufaff\uff00-\uffef]/;

    /**
     * FR-1: does this tab URL point at a PDF?
     * Matches *.pdf (case-insensitive, query/fragment included) on http(s)/file,
     * plus arXiv /pdf/<id> links which serve PDFs without a .pdf extension.
     * Extension-less URLs on other hosts are Phase 2 (HEAD check, FR-12).
     */
    function isPdfUrl(url) {
        if (typeof url !== 'string' || !url) return false;
        try {
            const u = new URL(url);
            if (!/^(https?|file):$/.test(u.protocol)) return false;
            const path = u.pathname.toLowerCase();
            if (path.endsWith('.pdf')) return true;
            if (/(^|\.)arxiv\.org$/.test(u.hostname) && /^\/pdf\//.test(path)) return true;
            return false;
        } catch (e) {
            return /\.pdf(?:[?#]|$)/i.test(url);
        }
    }

    /** Font size of a text item from its transform matrix (vertical scale). */
    function itemFontSize(it) {
        const t = it.transform || [10, 0, 0, 10, 0, 0];
        const size = Math.hypot(t[2] || 0, t[3] || 0);
        return size > 0 ? size : (it.height || 10);
    }

    /**
     * Cluster text items into visual lines.
     * Items sharing a baseline (Y within half a font size) become one line,
     * ordered top-to-bottom (PDF Y grows upwards) then left-to-right.
     * Large horizontal gaps (column gutters) split a line in two; small gaps
     * become spaces. `pageWidth` tunes the gutter threshold.
     */
    function buildLines(items, pageWidth) {
        const W = pageWidth || 612;
        const its = [];
        for (const it of items || []) {
            if (!it || typeof it.str !== 'string' || it.str.trim() === '') continue;
            const t = it.transform || [10, 0, 0, 10, 0, 0];
            const fs = itemFontSize(it);
            its.push({
                str: it.str,
                x: t[4],
                y: t[5],
                fs,
                width: typeof it.width === 'number' && it.width > 0 ? it.width : it.str.length * fs * 0.5
            });
        }
        its.sort((a, b) => b.y - a.y);

        // Cluster into baseline groups first (Y jitter must not break X order).
        const groups = [];
        let g = null;
        for (const it of its) {
            if (g && Math.abs(it.y - g.y) <= Math.max(2, g.fs * 0.5)) {
                g.items.push(it);
                g.fs = Math.max(g.fs, it.fs);
            } else {
                g = { y: it.y, fs: it.fs, items: [it] };
                groups.push(g);
            }
        }

        const lines = [];
        let cur = null;
        const flush = () => {
            if (cur && cur.text.trim() !== '') {
                lines.push({ x0: cur.x0, x1: cur.x1, y: cur.y, fontSize: cur.fs, text: cur.text.trim() });
            }
            cur = null;
        };
        for (const group of groups) {
            group.items.sort((a, b) => a.x - b.x);
            for (const it of group.items) {
                const gap = cur ? it.x - cur.x1 : 0;
                const gutter = Math.max(it.fs * 2.5, W * 0.04);
                if (!cur || gap > gutter) {
                    flush();
                    cur = { y: group.y, fs: it.fs, x0: it.x, x1: it.x + it.width, text: it.str };
                    continue;
                }
                if (gap > it.fs * 0.25 && !cur.text.endsWith(' ') && !it.str.startsWith(' ')) {
                    cur.text += ' ';
                }
                cur.text += it.str;
                cur.x1 = it.x + it.width;
                cur.fs = Math.max(cur.fs, it.fs);
            }
            flush();
        }
        return lines;
    }

    /** Median line width helper. */
    function medianWidth(lines) {
        if (!lines.length) return 0;
        const ws = lines.map(l => l.x1 - l.x0).sort((a, b) => a - b);
        return ws[Math.floor(ws.length / 2)];
    }

    /**
     * FR-3 two-column heuristic: a clean vertical gutter near the page center
     * with substantial text on both sides. Full-width lines (titles/headers)
     * are ignored for the decision; lines crossing the center veto it.
     */
    function detectTwoColumns(lines, pageWidth) {
        const W = pageWidth || 612;
        const mid = W / 2;
        const tol = W * 0.02;
        const spanning = l => (l.x1 - l.x0) > W * 0.6 && l.x0 < mid && l.x1 > mid;
        const cand = lines.filter(l => !spanning(l));
        if (cand.length < 4) return false;
        const left = cand.filter(l => (l.x0 + l.x1) / 2 < mid);
        const right = cand.filter(l => (l.x0 + l.x1) / 2 >= mid);
        if (left.length < 2 || right.length < 2) return false;
        const crossing = cand.filter(l => l.x0 < mid - tol && l.x1 > mid + tol);
        if (crossing.length > cand.length * 0.15) return false;
        const leftMax = Math.max(...left.map(l => l.x1));
        const rightMin = Math.min(...right.map(l => l.x0));
        if (leftMax > rightMin - tol) return false; // no clean gutter
        if (medianWidth(left) < W * 0.12 || medianWidth(right) < W * 0.12) return false;
        return true;
    }

    /**
     * Reading order: single column stays top-to-bottom; two columns read
     * left column then right column, with full-width lines (titles, section
     * headers spanning both columns) kept in place as separators.
     */
    function orderLines(lines, pageWidth) {
        const W = pageWidth || 612;
        const sorted = [...lines].sort((a, b) => (b.y - a.y) || (a.x - b.x));
        if (!detectTwoColumns(sorted, W)) return sorted;
        const mid = W / 2;
        const spanning = l => (l.x1 - l.x0) > W * 0.6 && l.x0 < mid && l.x1 > mid;
        const out = [];
        let run = [];
        const flushRun = () => {
            if (!run.length) return;
            const left = run.filter(l => (l.x0 + l.x1) / 2 < mid);
            const right = run.filter(l => (l.x0 + l.x1) / 2 >= mid);
            out.push(...left, ...right);
            run = [];
        };
        for (const l of sorted) {
            if (spanning(l)) { flushRun(); out.push(l); }
            else run.push(l);
        }
        flushRun();
        return out;
    }

    /** Most frequent font size (ties -> larger): the body text size. */
    function bodyFontSize(lines) {
        const counts = new Map();
        for (const l of lines) {
            const k = Math.round(l.fontSize * 2) / 2;
            counts.set(k, (counts.get(k) || 0) + 1);
        }
        let best = 10, bestN = -1;
        for (const [k, n] of counts) {
            if (n > bestN || (n === bestN && k > best)) { best = k; bestN = n; }
        }
        return best;
    }

    /** Join two line texts: heal hyphen line-breaks, keep CJK tight. */
    function joinLineText(prev, next) {
        if (prev.endsWith('-') && /^[a-z]/.test(next)) {
            return prev.slice(0, -1) + next;
        }
        if (prev.endsWith('\u00ad')) {
            return prev.slice(0, -1) + next;
        }
        const a = prev[prev.length - 1] || '';
        const b = next[0] || '';
        if (CJK_RE.test(a) || CJK_RE.test(b)) return prev + next;
        if (prev.endsWith(' ') || next.startsWith(' ')) return prev + next;
        return prev + ' ' + next;
    }

    /**
     * Group reading-order lines into paragraphs.
     * Splits on: large vertical gaps, first-line indents, column switches
     * (Y jumps back up), and body<->footnote font-size transitions.
     * Footnote lines (much smaller than body) merge with each other so they
     * never interleave with body paragraphs (FR-3).
     */
    function groupParagraphs(orderedLines) {
        if (!orderedLines.length) return [];
        const body = bodyFontSize(orderedLines);
        const footLimit = body * 0.72;
        const paras = [];
        let cur = null;
        for (const l of orderedLines) {
            const isFoot = l.fontSize < footLimit;
            let split = false;
            if (!cur) split = true;
            else if (cur.footnote !== isFoot) split = true;
            else if (l.y > cur.lastY + 1) split = true; // column / block switch
            else if (!isFoot) {
                const gap = cur.lastY - l.y;
                if (gap > l.fontSize * 1.55 + 2) split = true;
                else if (l.x0 > cur.lastX0 + l.fontSize * 1.2) split = true; // indent
            }
            if (split) {
                cur = { text: l.text, y: l.y, lastY: l.y, lastX0: l.x0, fontSize: l.fontSize, footnote: isFoot };
                paras.push(cur);
            } else {
                cur.text = joinLineText(cur.text, l.text);
                cur.lastY = l.y;
                cur.lastX0 = l.x0;
            }
        }
        return paras.map(p => ({ text: p.text, y: p.y, fontSize: p.fontSize, footnote: p.footnote }));
    }

    /**
     * FR-3 extraction quality: replacement chars, control chars, private-use
     * glyphs and (cid:NN) literals indicate broken ToUnicode / CID fonts.
     */
    function assessQuality(text) {
        if (!text) return 'ok';
        let bad = 0;
        const cid = text.match(/\(cid:\d+\)/g);
        if (cid) bad += cid.join('').length;
        for (const ch of text) {
            const c = ch.codePointAt(0);
            if (c === 0xFFFD) bad++;
            else if (c < 32 && c !== 9 && c !== 10 && c !== 13) bad++;
            else if (c >= 0xE000 && c <= 0xF8FF) bad++;
        }
        return text.length >= 10 && bad / text.length > 0.1 ? 'low' : 'ok';
    }

    /**
     * Main entry: raw getTextContent() items + page viewport ->
     * { paragraphs: [{text, y, fontSize, footnote}], quality, twoColumn }.
     */
    function extractParagraphs(items, viewport) {
        const W = (viewport && viewport.width) || 612;
        const lines = buildLines(items, W);
        const twoColumn = detectTwoColumns(lines, W);
        const ordered = orderLines(lines, W);
        const paragraphs = groupParagraphs(ordered);
        const quality = assessQuality(paragraphs.map(p => p.text).join('\n'));
        return { paragraphs, quality, twoColumn };
    }

    scope.LctPdfParagraphs = {
        isPdfUrl,
        buildLines,
        detectTwoColumns,
        orderLines,
        groupParagraphs,
        assessQuality,
        extractParagraphs
    };
})(typeof window !== 'undefined' ? window : globalThis);
