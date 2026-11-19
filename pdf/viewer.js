/**
 * PDF translation viewer — canvas-first.
 *
 * Renders every page as the real PDF (white sheet on a gray desk) and overlays
 * the Japanese translation at each paragraph's original position, so the result
 * looks like the original document. Three modes (localStorage.pdfViewMode):
 *   overlay    original layout with Japanese painted over the text (default)
 *   original   the original PDF only
 *   bilingual  original page + a flowing original/translation text block below
 *
 * "訳 PDF を保存" exports a PDF with the Japanese painted onto each page
 * (dependency-free JPEG-per-page writer, pdf/pdf-write.js).
 *
 * Debug: localStorage.lctPdfDebug = '1'.
 */
import * as pdfjs from '../vendor/pdfjs/pdf.min.mjs';

const browserAPI = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
const hasExt = !!(browserAPI && browserAPI.runtime && browserAPI.runtime.id);
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

const P = window.LctPdfParagraphs;
const Layout = window.LctPdfLayout;
const PdfWrite = window.LctPdfWrite;
const store = window.LctPdfStore;
const $ = id => document.getElementById(id);
const dbg = (...a) => { if (localStorage.getItem('lctPdfDebug') === '1') console.log('[pdf-viewer]', ...a); };

const FONT = '"Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Noto Sans JP", "Meiryo", system-ui, sans-serif';
const measureCtx = document.createElement('canvas').getContext('2d');
const measureWith = ctx => (text, size) => { ctx.font = size + 'px ' + FONT; return ctx.measureText(text).width; };

const MODE_KEY = 'pdfViewMode';
const THEME_KEY = 'pdfTheme';
const MAX_PDF_BYTES = 100 * 1024 * 1024;
const CHUNK_SIZE = 8;
const MODES = ['overlay', 'original', 'bilingual'];

const state = {
    doc: null,
    meta: { name: '', url: '' },
    pages: [],
    paraMap: new Map(),
    totalParas: 0,
    translating: false,
    generation: 0,
    consecutiveFailures: 0,
    llmFailBanner: false,
    settings: null,
    mode: 'overlay',
    scale: 1,
    observer: null,
    resizeTimer: null
};

init();

async function init() {
    applyStoredPrefs();
    setupToolbar();
    setupDropzone();
    window.addEventListener('unhandledrejection', e => {
        showBanner('error', 'エラー: ' + ((e.reason && e.reason.message) || e.reason));
    });
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { showEmpty(); return; }
    try {
        const rec = await store.loadPdf(id);
        if (!rec) { showBanner('error', 'PDF が見つかりません。もう一度開いてください。'); showEmpty(); return; }
        await openDoc(rec.bytes, { name: rec.name || '', url: rec.url || '' });
    } catch (e) {
        showBanner('error', 'PDF を読み込めませんでした: ' + (e && e.message || e));
        showEmpty();
    }
}

function applyStoredPrefs() {
    let mode = localStorage.getItem(MODE_KEY);
    if (mode === 'replace') mode = 'overlay';            // legacy migration
    if (mode === 'side-by-side') mode = 'bilingual';
    if (!MODES.includes(mode)) mode = 'overlay';
    state.mode = mode;
    applyMode(mode, true);
    applyTheme(localStorage.getItem(THEME_KEY) || 'auto', true);
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------
function setupToolbar() {
    document.querySelectorAll('.pdf-mode-switch button').forEach(btn => {
        btn.addEventListener('click', () => applyMode(btn.dataset.mode, false));
    });
    $('zoomIn').addEventListener('click', () => setScale(state.scale + 0.25));
    $('zoomOut').addEventListener('click', () => setScale(state.scale - 0.25));
    $('themeToggle').addEventListener('click', () => {
        applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', false);
    });
    $('openPdfBtn').addEventListener('click', () => $('pdfFileInput').click());
    $('pdfStartBtn').addEventListener('click', startTranslation);
    $('pdfCancelBtn').addEventListener('click', cancelTranslation);
    $('pdfExportBtn').addEventListener('click', exportPdf);
    window.addEventListener('resize', () => {
        clearTimeout(state.resizeTimer);
        state.resizeTimer = setTimeout(() => { markUnrendered(); renderVisible(); }, 200);
    });
}

function applyMode(mode, silent) {
    if (!MODES.includes(mode)) mode = 'overlay';
    state.mode = mode;
    if (!silent) localStorage.setItem(MODE_KEY, mode);
    document.body.dataset.pdfMode = mode;
    document.querySelectorAll('.pdf-mode-switch button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    markUnrendered();
    renderVisible();
    if (mode === 'overlay') for (const p of state.pages) if (p.rendered) layoutOverlay(p);
}

function applyTheme(theme, silent) {
    if (!silent) localStorage.setItem(THEME_KEY, theme);
    const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('themeToggle').textContent = dark ? '☀️' : '🌙';
}

function setScale(s) {
    state.scale = Math.min(2.5, Math.max(0.5, s));
    $('zoomLabel').textContent = Math.round(state.scale * 100) + '%';
    $('pdfPages').style.setProperty('--pdf-scale', state.scale);
    markUnrendered();
    renderVisible();
}

// ---------------------------------------------------------------------------
// Dropzone / file input
// ---------------------------------------------------------------------------
function setupDropzone() {
    const dz = $('pdfDropzone');
    const input = $('pdfFileInput');
    dz.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { handleFile(input.files && input.files[0]); input.value = ''; });
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => {
        e.preventDefault(); dz.classList.remove('dragover');
        handleFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
    });
}

async function handleFile(file) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name || '')) { showBanner('error', 'PDF ファイルを選んでください。'); return; }
    setProgressText('ファイルを読み込んでいます…');
    try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const id = await store.savePdf(bytes, { name: file.name });
        history.replaceState(null, '', '?id=' + encodeURIComponent(id));
        await openDoc(bytes, { name: file.name, url: '' });
    } catch (e) {
        showBanner('error', 'ファイルを読み込めませんでした: ' + (e && e.message || e));
    }
}

// ---------------------------------------------------------------------------
// Empty / banner / progress
// ---------------------------------------------------------------------------
function showEmpty() {
    $('pdfEmpty').hidden = false;
    $('pdfPages').hidden = true;
    $('pdfProgress').hidden = true;
    $('pdfTitle').textContent = 'PDF 翻訳';
    $('pdfOriginalLink').hidden = true;
}

function showBanner(kind, message, action) {
    const b = $('pdfBanner');
    b.className = 'pdf-banner';
    b.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = message;
    b.appendChild(span);
    if (action) {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.textContent = action.label;
        btn.addEventListener('click', action.onClick);
        b.appendChild(btn);
    }
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'pdf-banner-close'; close.textContent = '✕';
    close.addEventListener('click', () => { b.hidden = true; });
    b.appendChild(close);
    b.hidden = false;
}
function hideBanner() { $('pdfBanner').hidden = true; }
function setProgressText(text) { $('pdfProgressText').textContent = text; }

function updateProgressUI() {
    const total = state.totalParas;
    let answered = 0, errors = 0;
    for (const ref of state.paraMap.values()) {
        const s = ref.trans.dataset.state;
        if (s !== 'pending') answered++;
        if (s === 'error') errors++;
    }
    $('pdfProgress').hidden = !state.doc;
    if (state.translating) setProgressText(`翻訳中… ${answered} / ${total} 段落`);
    else if (total > 0 && answered >= total) setProgressText(errors > 0 ? `完了 (${total} 段落、${errors} 失敗)` : `完了 (${total} 段落)`);
    else setProgressText(`未翻訳 ${answered} / ${total} 段落`);
    $('pdfProgressBar').style.width = total ? (answered / total * 100).toFixed(1) + '%' : '0%';
    $('pdfStartBtn').hidden = state.translating;
    $('pdfCancelBtn').hidden = !state.translating;
    $('pdfStartBtn').textContent = answered > 0 ? '再開' : '翻訳';
}

// ---------------------------------------------------------------------------
// Document loading
// ---------------------------------------------------------------------------
async function openDoc(bytes, meta) {
    if (bytes.byteLength > MAX_PDF_BYTES) { showBanner('error', 'PDF が大きすぎます (100MB 超)。読み込めません。'); return; }
    state.doc = null; state.pages = []; state.paraMap = new Map(); state.totalParas = 0;
    state.generation++; state.translating = false;
    $('pdfPages').innerHTML = '';
    $('pdfEmpty').hidden = true;
    $('pdfPages').hidden = false;
    state.meta = meta;
    $('pdfTitle').textContent = meta.name || 'PDF';
    const link = $('pdfOriginalLink');
    if (meta.url && /^https?:/.test(meta.url)) { link.href = meta.url; link.hidden = false; } else link.hidden = true;
    setProgressText('PDF を読み込んでいます…');
    $('pdfProgress').hidden = false;
    $('pdfStartBtn').hidden = true;
    $('pdfCancelBtn').hidden = true;

    let doc;
    try {
        doc = await pdfjs.getDocument({
            data: bytes, isEvalSupported: false,
            standardFontDataUrl: new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href,
            cMapUrl: new URL('../vendor/pdfjs/cmaps/', import.meta.url).href,
            cMapPacked: true, maxImageSize: -1
        }).promise;
    } catch (e) {
        showBanner('error', 'PDF の解析に失敗しました: ' + ((e && e.message) || e));
        setProgressText('読み込み失敗');
        return;
    }
    state.doc = doc;
    try { await buildPages(doc); }
    catch (e) { showBanner('error', 'ページの処理に失敗しました: ' + ((e && e.message) || e)); }
    afterLoad();
}

function positionBox(box, bbox, vp) {
    const W = vp.width, H = vp.height;
    box.style.left = (bbox.x0 / W * 100) + '%';
    box.style.top = ((H - bbox.top) / H * 100) + '%';
    box.style.width = ((bbox.x1 - bbox.x0) / W * 100) + '%';
    box.style.height = ((bbox.top - bbox.bottom) / H * 100) + '%';
}

async function buildPages(doc) {
    const main = $('pdfPages');
    const N = doc.numPages;
    for (let i = 1; i <= N; i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        const ex = P.extractParagraphs(tc.items, vp);
        dbg(`page ${i}: ${ex.paragraphs.length} paragraphs, twoColumn=${ex.twoColumn}, quality=${ex.quality}`);

        const el = document.createElement('section');
        el.className = 'pdf-page';
        const head = document.createElement('div');
        head.className = 'pdf-page-head';
        const headText = document.createElement('span');
        headText.textContent = `ページ ${i} / ${N}`;
        head.appendChild(headText);
        if (ex.twoColumn) { const tag = document.createElement('span'); tag.textContent = '2カラム'; head.appendChild(tag); }
        el.appendChild(head);

        const sheet = document.createElement('div');
        sheet.className = 'pdf-sheet';
        const canvasWrap = document.createElement('div');
        canvasWrap.className = 'pdf-canvas-wrap';
        canvasWrap.style.aspectRatio = vp.width + ' / ' + vp.height;
        const canvas = document.createElement('canvas');
        const overlay = document.createElement('div');
        overlay.className = 'pdf-overlay';
        canvasWrap.append(canvas, overlay);
        sheet.appendChild(canvasWrap);
        el.appendChild(sheet);

        const textCol = document.createElement('div');
        textCol.className = 'pdf-text';
        const paras = [];
        ex.paragraphs.forEach((p, idx) => {
            const key = `${i}:${idx}`;
            const paraEl = document.createElement('div');
            paraEl.className = 'pdf-para';
            const orig = document.createElement('p');
            orig.className = 'pdf-para-original';
            orig.textContent = p.text;
            const trans = document.createElement('p');
            trans.className = 'pdf-para-translation';
            trans.dataset.key = key;
            trans.dataset.state = 'pending';
            paraEl.append(orig, trans);
            textCol.appendChild(paraEl);

            const box = document.createElement('div');
            box.className = 'pdf-overlay-box';
            box.dataset.key = key;
            box.dataset.state = 'pending';
            if (p.bbox) positionBox(box, p.bbox, vp);
            overlay.appendChild(box);

            const ref = { key, orig, trans, box, bbox: p.bbox, fontSize: p.fontSize || 10, page: null };
            paras.push(ref);
            state.paraMap.set(key, ref);
        });
        el.appendChild(textCol);
        main.appendChild(el);

        const pageObj = { i, page, vp, el, sheet, canvasWrap, canvas, overlay, ctx: canvas.getContext('2d'), paras, rendered: false };
        for (const r of paras) r.page = pageObj;
        state.pages.push(pageObj);
        state.totalParas += ex.paragraphs.length;
    }
}

function afterLoad() {
    applyMode(state.mode, true);
    setupObserver();
    updateProgressUI();
    let total = 0;
    for (const p of state.pages) total += p.paras.length;
    if (total === 0) { showBanner('info', 'テキストが見つかりません。スキャン PDF には対応していません (OCR は Phase 3 以降)。'); return; }
    const allText = state.pages.map(p => p.paras.map(r => r.orig.textContent).join('\n')).join('\n');
    if (P.assessQuality(allText) === 'low') {
        showBanner('info', 'テキスト抽出の品質が低い可能性があります。対訳モードをご利用ください。', {
            label: '対訳に切り替え', onClick: () => applyMode('bilingual', false)
        });
    }
    if (!hasExt) { showBanner('info', '拡張機能の外で開いているため翻訳はできません (表示のみ)。'); return; }
    startTranslation();
}

// ---------------------------------------------------------------------------
// Canvas rendering (all modes) + overlay layout
// ---------------------------------------------------------------------------
function setupObserver() {
    if (state.observer) state.observer.disconnect();
    state.observer = new IntersectionObserver(entries => {
        for (const en of entries) {
            if (!en.isIntersecting) continue;
            const p = state.pages.find(x => x.canvasWrap === en.target);
            if (p) renderPage(p);
        }
    }, { rootMargin: '400px' });
    for (const p of state.pages) state.observer.observe(p.canvasWrap);
}

function markUnrendered() { for (const p of state.pages) p.rendered = false; }

async function renderVisible() {
    for (const p of state.pages) {
        const r = p.canvasWrap.getBoundingClientRect();
        if (r.bottom > -400 && r.top < window.innerHeight + 400) await renderPage(p);
    }
}

async function renderPage(p) {
    if (p.rendered) return;
    const wrapW = p.canvasWrap.clientWidth;
    if (!wrapW) return;
    const dpr = window.devicePixelRatio || 1;
    const scale = (wrapW / p.vp.width) * state.scale * dpr;
    const viewport = p.page.getViewport({ scale });
    p.canvas.width = Math.max(1, Math.floor(viewport.width));
    p.canvas.height = Math.max(1, Math.floor(viewport.height));
    try {
        // pdf.js leaves the canvas transparent; composite onto white so the
        // paper is white (and background sampling / JPEG export are correct).
        const tmp = document.createElement('canvas');
        tmp.width = p.canvas.width; tmp.height = p.canvas.height;
        await p.page.render({ canvasContext: tmp.getContext('2d'), viewport }).promise;
        p.ctx.fillStyle = '#ffffff';
        p.ctx.fillRect(0, 0, p.canvas.width, p.canvas.height);
        p.ctx.drawImage(tmp, 0, 0);
        p.rendered = true;
        layoutOverlay(p);
    } catch (e) {
        if (e && e.name === 'RenderingCancelledException') return;
        dbg('render failed for page', p.i, e && e.message);
    }
}

function sampleBg(ctx, canvas, vp, bbox) {
    if (!canvas.width || !canvas.height) return { bg: '#ffffff', color: '#111' };
    const dk = canvas.width / vp.width;
    const H = vp.height;
    // Sample the four corners (in the bbox padding zone, usually paper) and keep
    // the lightest, so a corner landing on a dark glyph does not poison the mask.
    const pts = [
        [bbox.x0 + 1, bbox.top - 1], [bbox.x1 - 1, bbox.top - 1],
        [bbox.x0 + 1, bbox.bottom + 1], [bbox.x1 - 1, bbox.bottom + 1]
    ];
    let best = [255, 255, 255], bestLum = -1;
    for (const [px, py] of pts) {
        const sx = Math.max(0, Math.min(canvas.width - 1, Math.floor(px * dk)));
        const sy = Math.max(0, Math.min(canvas.height - 1, Math.floor((H - py) * dk)));
        try {
            const d = ctx.getImageData(sx, sy, 1, 1).data;
            const lum = 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2];
            if (lum > bestLum) { bestLum = lum; best = [d[0], d[1], d[2]]; }
        } catch (e) { /* ignore */ }
    }
    const lum = (0.299 * best[0] + 0.587 * best[1] + 0.114 * best[2]) / 255;
    return { bg: `rgb(${best[0]},${best[1]},${best[2]})`, color: lum > 0.5 ? '#111' : '#f5f5f5' };
}

function layoutOverlay(p) {
    if (state.mode !== 'overlay') return;
    const k = p.canvasWrap.clientWidth / p.vp.width;   // CSS px per PDF unit
    if (!k) return;
    const measure = measureWith(measureCtx);
    for (const ref of p.paras) {
        const box = ref.box;
        const st = ref.trans.dataset.state;
        if (st === 'pending' || !ref.bbox) { box.style.display = 'none'; continue; }
        box.style.display = 'block';
        const { bg, color } = sampleBg(p.ctx, p.canvas, p.vp, ref.bbox);
        box.style.background = bg;
        box.style.color = color;
        const bw = box.clientWidth - 2, bh = box.clientHeight - 2;
        if (bw <= 0 || bh <= 0) continue;
        const fit = Layout.fitText(measure, ref.trans.textContent, bw, bh, ref.fontSize * k, 5, 1.2);
        box.style.fontSize = fit.size + 'px';
        box.style.lineHeight = String(fit.lineHeight);
        box.textContent = fit.lines.join('\n');
    }
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------
function buildQueue() {
    const queue = [];
    for (const p of state.pages) for (const ref of p.paras) {
        if (ref.trans.dataset.state === 'done') continue;
        queue.push({ key: ref.key, text: ref.orig.textContent });
    }
    return queue;
}

async function getSettings() {
    if (state.settings) return state.settings;
    const resp = await browserAPI.runtime.sendMessage({ type: 'GET_SETTINGS' });
    state.settings = (resp && resp.settings) || null;
    return state.settings;
}

async function startTranslation() {
    if (state.translating) return;
    if (!hasExt) { showBanner('error', '拡張機能の外では翻訳できません。'); return; }
    let settings;
    try { settings = await getSettings(); }
    catch (e) { showBanner('error', '設定を取得できませんでした: ' + (e && e.message || e)); return; }
    if (!settings || !settings.selectedModel) { showBanner('error', 'モデルが選択されていません。拡張機能のポップアップでモデルを選んでください。'); return; }
    const queue = buildQueue();
    if (!queue.length) { updateProgressUI(); return; }

    state.translating = true;
    state.consecutiveFailures = 0;
    const gen = ++state.generation;
    updateProgressUI();

    for (let i = 0; i < queue.length; i += CHUNK_SIZE) {
        if (gen !== state.generation) break;
        const chunk = queue.slice(i, i + CHUNK_SIZE);
        let resp = null;
        try {
            resp = await browserAPI.runtime.sendMessage({
                type: 'TRANSLATE',
                texts: chunk.map(c => ({ id: c.key, text: c.text })),
                targetLanguage: settings.targetLanguage,
                sourceLanguage: settings.sourceLanguage,
                silentPartials: true
            });
        } catch (e) { dbg('TRANSLATE failed:', e && e.message); }
        if (gen !== state.generation) break;

        let failed = 0;
        const touched = new Set();
        if (resp && Array.isArray(resp.translations)) {
            for (const t of resp.translations) {
                const ref = typeof t.id === 'string' ? state.paraMap.get(t.id) : null;
                if (!ref) continue;
                if (t.error || !t.text) { failed++; markFailed(ref); }
                else { ref.trans.textContent = t.text; ref.trans.dataset.state = 'done'; ref.box.dataset.state = 'done'; }
                touched.add(ref.page);
            }
        } else {
            failed = chunk.length;
            for (const c of chunk) { const ref = state.paraMap.get(c.key); if (ref) { markFailed(ref); touched.add(ref.page); } }
        }
        for (const pg of touched) layoutOverlay(pg);
        state.consecutiveFailures = (failed === chunk.length) ? state.consecutiveFailures + 1 : 0;
        if (state.consecutiveFailures >= 2) { state.llmFailBanner = true; showBanner('error', '翻訳に失敗しました。ローカル LLM を確認してください。'); }
        else if (state.llmFailBanner && failed < chunk.length) { state.llmFailBanner = false; hideBanner(); }
        updateProgressUI();
        dbg(`chunk ${i / CHUNK_SIZE + 1}: ${chunk.length - failed}/${chunk.length} ok`);
    }
    state.translating = false;
    updateProgressUI();
    for (const p of state.pages) layoutOverlay(p);
}

function markFailed(ref) {
    ref.trans.textContent = ref.orig.textContent;
    ref.trans.dataset.state = 'error';
    ref.box.dataset.state = 'error';
}

function cancelTranslation() {
    state.generation++;
    state.translating = false;
    updateProgressUI();
    setProgressText('キャンセルしました');
}

// ---------------------------------------------------------------------------
// Export: paint Japanese onto each page and write a PDF (no dependencies)
// ---------------------------------------------------------------------------
async function exportPdf() {
    if (!state.doc) return;
    const btn = $('pdfExportBtn');
    btn.disabled = true;
    const gen = state.generation;
    setProgressText('訳 PDF を作成中…');
    try {
        const exportScale = 2;
        const pages = [];
        for (const p of state.pages) {
            if (gen !== state.generation) break;
            const viewport = p.page.getViewport({ scale: exportScale });
            const cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.floor(viewport.width));
            cv.height = Math.max(1, Math.floor(viewport.height));
            const ctx = cv.getContext('2d');
            const tmp = document.createElement('canvas');
            tmp.width = cv.width; tmp.height = cv.height;
            await p.page.render({ canvasContext: tmp.getContext('2d'), viewport }).promise;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, cv.width, cv.height);
            ctx.drawImage(tmp, 0, 0);
            const k = exportScale, H = p.vp.height;
            const measure = measureWith(ctx);
            for (const ref of p.paras) {
                if (ref.trans.dataset.state !== 'done' || !ref.bbox) continue;
                const b = ref.bbox;
                const x = b.x0 * k, y = (H - b.top) * k, w = (b.x1 - b.x0) * k, h = (b.top - b.bottom) * k;
                const { bg, color } = sampleBg(ctx, cv, p.vp, b);
                ctx.fillStyle = bg;
                ctx.fillRect(x, y, w, h);
                ctx.fillStyle = color;
                const fit = Layout.fitText(measure, ref.trans.textContent, w - 2, h - 2, ref.fontSize * k, 5, 1.2);
                ctx.font = fit.size + 'px ' + FONT;
                ctx.textBaseline = 'top';
                let ty = y + 1;
                for (const line of fit.lines) { ctx.fillText(line, x + 1, ty); ty += fit.size * fit.lineHeight; }
            }
            const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.92));
            const jpeg = new Uint8Array(await blob.arrayBuffer());
            pages.push({ jpeg, width: p.vp.width, height: p.vp.height, pxWidth: cv.width, pxHeight: cv.height });
            setProgressText(`訳 PDF を作成中… ${pages.length}/${state.pages.length}`);
        }
        if (!pages.length) { setProgressText('PDF 作成をキャンセルしました'); return; }
        const pdf = PdfWrite.buildPdfFromImages(pages);
        const blob = new Blob([pdf], { type: 'application/pdf' });
        const a = document.createElement('a');
        const base = (state.meta.name || 'document.pdf').replace(/\.pdf$/i, '');
        a.href = URL.createObjectURL(blob);
        a.download = base + '-ja.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        setProgressText(`訳 PDF を保存しました (${pages.length} ページ)`);
    } catch (e) {
        showBanner('error', 'PDF の作成に失敗しました: ' + (e && e.message || e));
        setProgressText('PDF 作成失敗');
    } finally {
        btn.disabled = false;
    }
}

// Debug-only test hook (set localStorage.lctPdfDebug='1').
if (localStorage.getItem('lctPdfDebug') === '1') window.__pdfViewer = { state, exportPdf, applyMode, layoutOverlay };
