/**
 * Popup: PDF detection and the "translate this PDF" / local-file buttons.
 *
 * A classic script loaded after popup.js; uses its globals.
 */

// ============================================================================
// PDF translation (FR-1): only shown on PDF tabs. The local file entry point
// (FR-4) is always co-located so the feature works without file URL access.
// ============================================================================
const pdfProbeCache = new Map();   // FR-12: url -> isPdf (probe once per popup session)

function isPdfTabUrl(url) {
    const P = typeof LctPdfParagraphs !== 'undefined' ? LctPdfParagraphs : null;
    return !!(P && P.isPdfUrl(url));
}

async function refreshPdfButtons() {
    const btn = elements.pdfTranslateBtn;
    const localBtn = elements.pdfOpenLocalBtn;
    if (!btn || !localBtn) return false;
    const hide = () => { btn.hidden = true; localBtn.hidden = true; };
    try {
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) { hide(); return false; }
        if (isPdfTabUrl(tab.url)) { btn.hidden = false; localBtn.hidden = false; return true; }
        // FR-12: extensionless http(s) URL — HEAD-probe once per URL.
        if (/^https?:/i.test(tab.url)) {
            let isPdf = pdfProbeCache.get(tab.url);
            if (isPdf === undefined) {
                try {
                    const resp = await browserAPI.runtime.sendMessage({ type: 'PROBE_PDF', url: tab.url });
                    isPdf = !!(resp && resp.isPdf);
                } catch (e) { isPdf = false; }
                pdfProbeCache.set(tab.url, isPdf);
            }
            if (isPdf) { btn.hidden = false; localBtn.hidden = false; return true; }
        }
        hide();
        return false;
    } catch (e) {
        hide();
        return false;
    }
}

function openPdfViewer(id) {
    const url = browserAPI.runtime.getURL('pdf/viewer.html') + (id ? ('?id=' + encodeURIComponent(id)) : '');
    return browserAPI.tabs.create({ url });
}

async function translateThisPdf() {
    const btn = elements.pdfTranslateBtn;
    if (!btn || btn.disabled) return;
    const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/^(https?|file):/i.test(tab.url)) {
        showToast(t('toast.pdfOnly'), 'error');
        return;
    }
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = t('pdf.preparing');
    try {
        // Runs with the activeTab grant for this origin (popup was opened by
        // clicking the toolbar icon), so credentials and cookies apply.
        const resp = await browserAPI.runtime.sendMessage({ type: 'FETCH_PDF', url: tab.url });
        if (!resp || !resp.ok) {
            const err = (resp && resp.error) || 'unknown error';
            if (resp && resp.status === 403) {
                showToast(t('toast.pdfForbidden'), 'error', 8000);
            } else if (resp && resp.size) {
                showToast(t('toast.pdfTooLarge'), 'error', 8000);
            } else if (tab.url.startsWith('file://') && (!resp || !resp.status)) {
                showToast(t('toast.pdfFileHint'), 'error', 8000);
            } else {
                showToast(t('toast.pdfFail', { message: err }), 'error', 8000);
            }
            return;
        }
        await openPdfViewer(resp.id);
    } catch (e) {
        showToast(t('toast.pdfFail', { message: e && e.message }), 'error', 8000);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}
