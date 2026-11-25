/**
 * PDF fetch bridge: HEAD-probes and byte fetches for the PDF viewer (FR-1/FR-12).
 *
 * Exposed as `LctBgPdf` on the global object. Loaded by background.js
 * (importScripts) and by manifest `background.scripts` for Firefox.
 */

(function (root) {
    'use strict';
    if (root.LctBgPdf) return;

// FR-1/NFR-3: hard cap on PDF bytes we park in IndexedDB (100MB).
const MAX_PDF_BYTES = 100 * 1024 * 1024;

// FR-12: HEAD-probe a URL so the popup can show the PDF button on
// extensionless URLs that serve application/pdf.
async function probePdf(url) {
    try {
        const Pdf = self.LctPdfParagraphs;
        if (!url || !/^https?:/i.test(url)) return { ok: false, isPdf: false };
        if (Pdf?.isPdfUrl(url)) return { ok: true, isPdf: true, contentType: 'application/pdf' };
        const head = await fetch(url, { method: 'HEAD', credentials: 'include', redirect: 'follow' });
        const ct = head.headers.get('content-type') || '';
        return { ok: head.ok, isPdf: head.ok && !!Pdf?.isPdfContentType(ct), contentType: ct, status: head.status };
    } catch (e) {
        return { ok: false, isPdf: false, error: e && e.message || String(e) };
    }
}

// FR-1: fetch the PDF bytes with the activeTab grant (invoked from the popup
// click) and park them in IndexedDB for the viewer page. Never send bytes back
// through the message.
async function fetchPdf(url, requestedName) {
    try {
        const Pdf = self.LctPdfParagraphs;
        let likelyPdf = !!(url && Pdf?.isPdfUrl(url));
        if (url && !likelyPdf) {
            // FR-12: extensionless URL — HEAD probe for application/pdf.
            try {
                const head = await fetch(url, { method: 'HEAD', credentials: 'include', redirect: 'follow' });
                likelyPdf = head.ok && !!Pdf?.isPdfContentType(head.headers.get('content-type'));
            } catch (e) { likelyPdf = false; }
        }
        if (!likelyPdf) {
            return { ok: false, status: 0, error: 'Not a PDF URL: ' + String(url) };
        }
        const resp = await fetch(url, { credentials: 'include', redirect: 'follow' });
        if (!resp.ok) {
            return { ok: false, status: resp.status, error: 'HTTP ' + resp.status };
        }
        const buf = await resp.arrayBuffer();
        if (buf.byteLength > MAX_PDF_BYTES) {
            return { ok: false, status: 0, size: buf.byteLength, error: 'PDF too large (over 100MB)' };
        }
        // Reject non-PDF payloads (e.g. a login / soft-404 HTML page served at a
        // .pdf URL) before parking them in IndexedDB.
        const head = new Uint8Array(buf, 0, Math.min(1024, buf.byteLength));
        if (!String.fromCharCode(...head).includes('%PDF-')) {
            return { ok: false, status: 0, error: 'Server did not return a PDF file' };
        }
        const name = requestedName || (url.split('/').pop() || 'document.pdf').split('?')[0];
        const id = await LctPdfStore.savePdf(new Uint8Array(buf), { url, name });
        return { ok: true, id, size: buf.byteLength };
    } catch (e) {
        return { ok: false, status: 0, error: e && e.message || String(e) };
    }
}

    root.LctBgPdf = { probePdf, fetchPdf };
})(typeof self !== 'undefined' ? self : globalThis);
