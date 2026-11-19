/**
 * PDF translation viewer (FR-2, FR-5, FR-6, FR-7, FR-9, FR-10).
 *
 * Self-contained extension page: renders the PDF with the vendored pdf.js,
 * rebuilds paragraphs (LctPdfParagraphs), and translates them through the
 * existing TRANSLATE pipeline (background.js) in reading order, chunk by
 * chunk, so the first page becomes readable while the rest is in flight.
 *
 * Display modes (FR-7, persisted in localStorage.pdfViewMode):
 *   replace      translation only
 *   bilingual    original paragraph, translation below it (default)
 *   side-by-side original page canvas (left) + translation text (right)
 *
 * Debug logging: set localStorage.lctPdfDebug = '1' before loading.
 */
import * as pdfjs from '../vendor/pdfjs/pdf.min.mjs';

const browserAPI = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
const hasExt = !!(browserAPI && browserAPI.runtime && browserAPI.runtime.id);
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

const P = window.LctPdfParagraphs;
const store = window.LctPdfStore;
const $ = id => document.getElementById(id);
const dbg = (...a) => { if (localStorage.getItem('lctPdfDebug') === '1') console.log('[pdf-viewer]', ...a); };

const MODE_KEY = 'pdfViewMode';
const THEME_KEY = 'pdfTheme';
const MAX_PDF_BYTES = 100 * 1024 * 1024; // NFR-3
const CHUNK_SIZE = 8;                    // paragraphs per TRANSLATE call

const state = {
    doc: null,
    meta: { name: '', url: '' },
    pages: [],          // { i, page, vp, el, canvasWrap, canvas, paras:[{key,orig,trans}], rendered }
    paraMap: new Map(), // key -> { orig, trans }
    totalParas: 0,
    translating: false,
    generation: 0,      // cancel token: responses from old runs are discarded
    consecutiveFailures: 0,
    llmFailBanner: false,
    settings: null,
    mode: 'bilingual',
    scale: 1,
    observer: null,
    resizeTimer: null
};

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
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
        if (!rec) {
            showBanner('error', 'PDF が見つかりません。もう一度開いてください。');
            showEmpty();
            return;
        }
        await openDoc(rec.bytes, { name: rec.name || '', url: rec.url || '' });
    } catch (e) {
        showBanner('error', 'PDF を読み込めませんでした: ' + (e && e.message || e));
        showEmpty();
    }
}

function applyStoredPrefs() {
    const mode = localStorage.getItem(MODE_KEY);
    if (mode === 'replace' || mode === 'bilingual' || mode === 'side-by-side') state.mode = mode;
    applyMode(state.mode, true);
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
        const cur = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(cur, false);
    });
    $('openPdfBtn').addEventListener('click', () => $('pdfFileInput').click());
    $('pdfStartBtn').addEventListener('click', startTranslation);
    $('pdfCancelBtn').addEventListener('click', cancelTranslation);
    window.addEventListener('resize', () => {
        clearTimeout(state.resizeTimer);
        state.resizeTimer = setTimeout(() => { markUnrendered(); renderVisible(); }, 200);
    });
}

function applyMode(mode, silent) {
    state.mode = mode;
    if (!silent) localStorage.setItem(MODE_KEY, mode);
    document.body.dataset.pdfMode = mode;
    document.querySelectorAll('.pdf-mode-switch button').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });
    // Canvas columns appear/disappear with the mode; render what becomes visible.
    markUnrendered();
    renderVisible();
}

function applyTheme(theme, silent) {
    if (!silent) localStorage.setItem(THEME_KEY, theme);
    const dark = theme === 'dark' ||
        (theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
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
// Dropzone / file input (FR-4)
// ---------------------------------------------------------------------------
function setupDropzone() {
    const dz = $('pdfDropzone');
    const input = $('pdfFileInput');
    dz.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { handleFile(input.files && input.files[0]); input.value = ''; });
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => {
        e.preventDefault();
        dz.classList.remove('dragover');
        handleFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
    });
}

async function handleFile(file) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name || '')) {
        showBanner('error', 'PDF ファイルを選んでください。');
        return;
    }
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
// Empty state / banner / progress
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
        btn.type = 'button';
        btn.textContent = action.label;
        btn.addEventListener('click', action.onClick);
        b.appendChild(btn);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'pdf-banner-close';
    close.textContent = '✕';
    close.addEventListener('click', () => { b.hidden = true; });
    b.appendChild(close);
    b.hidden = false;
}

function hideBanner() { $('pdfBanner').hidden = true; }

function setProgressText(text) { $('pdfProgressText').textContent = text; }

function updateProgressUI() {
    const total = state.totalParas;
    // Count from the DOM, not an accumulator: cancel/resume/retry must never
    // double-count a paragraph or report "done" while failures remain.
    let answered = 0, errors = 0;
    for (const ref of state.paraMap.values()) {
        const s = ref.trans.dataset.state;
        if (s !== 'pending') answered++;
        if (s === 'error') errors++;
    }
    $('pdfProgress').hidden = !state.doc;
    if (state.translating) {
        setProgressText(`翻訳中… ${answered} / ${total} 段落`);
    } else if (total > 0 && answered >= total) {
        setProgressText(errors > 0 ? `完了 (${total} 段落、${errors} 失敗)` : `完了 (${total} 段落)`);
    } else {
        setProgressText(`未翻訳 ${answered} / ${total} 段落`);
    }
    $('pdfProgressBar').style.width = total ? (answered / total * 100).toFixed(1) + '%' : '0%';
    $('pdfStartBtn').hidden = state.translating;
    $('pdfCancelBtn').hidden = !state.translating;
    $('pdfStartBtn').textContent = answered > 0 ? '再開' : '翻訳';
}

// ---------------------------------------------------------------------------
// Document loading
// ---------------------------------------------------------------------------
async function openDoc(bytes, meta) {
    if (bytes.byteLength > MAX_PDF_BYTES) {
        showBanner('error', 'PDF が大きすぎます (100MB 超)。読み込めません。');
        return;
    }
    state.doc = null;
    state.pages = [];
    state.paraMap = new Map();
    state.totalParas = 0;
    state.generation++;
    state.translating = false;
    $('pdfPages').innerHTML = '';
    $('pdfEmpty').hidden = true;
    $('pdfPages').hidden = false;
    state.meta = meta;
    $('pdfTitle').textContent = meta.name || 'PDF';
    const link = $('pdfOriginalLink');
    if (meta.url && /^https?:/.test(meta.url)) {
        link.href = meta.url;
        link.hidden = false;
    } else {
        link.hidden = true;
    }
    setProgressText('PDF を読み込んでいます…');
    $('pdfProgress').hidden = false;
    $('pdfStartBtn').hidden = true;
    $('pdfCancelBtn').hidden = true;

    let doc;
    try {
        doc = await pdfjs.getDocument({
            data: bytes,
            isEvalSupported: false,
            standardFontDataUrl: new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href,
            cMapUrl: new URL('../vendor/pdfjs/cmaps/', import.meta.url).href,
            cMapPacked: true,
            maxImageSize: -1
        }).promise;
    } catch (e) {
        showBanner('error', 'PDF の解析に失敗しました: ' + ((e && e.message) || e));
        setProgressText('読み込み失敗');
        return;
    }
    state.doc = doc;
    try {
        await buildPages(doc);
    } catch (e) {
        showBanner('error', 'ページの処理に失敗しました: ' + ((e && e.message) || e));
    }
    afterLoad();
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
        if (ex.twoColumn) {
            const tag = document.createElement('span');
            tag.textContent = '2カラム';
            head.appendChild(tag);
        }
        el.appendChild(head);

        const body = document.createElement('div');
        body.className = 'pdf-page-body';

        const canvasWrap = document.createElement('div');
        canvasWrap.className = 'pdf-canvas-wrap';
        const canvas = document.createElement('canvas');
        canvasWrap.appendChild(canvas);
        body.appendChild(canvasWrap);

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
            const ref = { key, orig, trans };
            paras.push(ref);
            state.paraMap.set(key, ref);
        });
        body.appendChild(textCol);
        el.appendChild(body);
        main.appendChild(el);

        state.pages.push({ i, page, vp, el, canvasWrap, canvas, paras, rendered: false });
        state.totalParas += ex.paragraphs.length;
    }

    // Reserve space for translations before switching modes, so layout does
    // not jump when a translation lands (FR-6 / design note).
    for (const ref of state.paraMap.values()) {
        const h = ref.orig.getBoundingClientRect().height;
        if (h > 0) ref.trans.style.minHeight = h + 'px';
    }
}

function afterLoad() {
    applyMode(state.mode, true);
    setupObserver();
    updateProgressUI();

    let total = 0;
    for (const p of state.pages) total += p.paras.length;
    if (total === 0) {
        showBanner('info', 'テキストが見つかりません。スキャン PDF には対応していません (OCR は Phase 3 以降)。');
        return;
    }
    // Low extraction quality: detect from the text we already built (FR-3).
    const allText = state.pages.map(p => p.paras.map(r => r.orig.textContent).join('\n')).join('\n');
    if (P.assessQuality(allText) === 'low') {
        showBanner('info', 'テキスト抽出の品質が低い可能性があります。原文併置モードをご利用ください。', {
            label: '原文併置に切り替え',
            onClick: () => applyMode('side-by-side', false)
        });
    }

    // Auto-start translation when the extension context and a model are ready.
    if (!hasExt) {
        showBanner('info', '拡張機能の外で開いているため翻訳はできません (表示のみ)。');
        return;
    }
    startTranslation();
}

// ---------------------------------------------------------------------------
// Canvas rendering (lazy, devicePixelRatio aware)
// ---------------------------------------------------------------------------
function setupObserver() {
    if (state.observer) state.observer.disconnect();
    state.observer = new IntersectionObserver(entries => {
        for (const en of entries) {
            if (!en.isIntersecting) continue;
            const p = state.pages.find(x => x.canvasWrap === en.target);
            if (p) renderPage(p);
        }
    }, { rootMargin: '300px' });
    for (const p of state.pages) state.observer.observe(p.canvasWrap);
}

function markUnrendered() {
    for (const p of state.pages) p.rendered = false;
}

async function renderVisible() {
    if (state.mode !== 'side-by-side') return;
    for (const p of state.pages) {
        const r = p.canvasWrap.getBoundingClientRect();
        const visible = r.bottom > 0 && r.top < window.innerHeight;
        if (visible) await renderPage(p);
    }
}

async function renderPage(p) {
    if (p.rendered) return;
    if (state.mode !== 'side-by-side') return;
    const wrapW = p.canvasWrap.clientWidth;
    if (!wrapW) return;
    const dpr = window.devicePixelRatio || 1;
    const scale = (wrapW / p.vp.width) * state.scale * dpr;
    const viewport = p.page.getViewport({ scale });
    p.canvas.width = Math.max(1, Math.floor(viewport.width));
    p.canvas.height = Math.max(1, Math.floor(viewport.height));
    try {
        await p.page.render({ canvasContext: p.canvas.getContext('2d'), viewport }).promise;
        p.rendered = true;
    } catch (e) {
        if (e && e.name === 'RenderingCancelledException') return;
        dbg('render failed for page', p.i, e && e.message);
    }
}

// ---------------------------------------------------------------------------
// Translation (FR-5 / FR-6)
// ---------------------------------------------------------------------------
function buildQueue() {
    const queue = [];
    for (const p of state.pages) {
        for (const ref of p.paras) {
            if (ref.trans.dataset.state === 'done') continue;
            queue.push({ key: ref.key, text: ref.orig.textContent });
        }
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
    try {
        settings = await getSettings();
    } catch (e) {
        showBanner('error', '設定を取得できませんでした: ' + (e && e.message || e));
        return;
    }
    if (!settings || !settings.selectedModel) {
        showBanner('error', 'モデルが選択されていません。拡張機能のポップアップでモデルを選んでください。');
        return;
    }
    const queue = buildQueue();
    if (!queue.length) { updateProgressUI(); return; }

    state.translating = true;
    state.consecutiveFailures = 0;
    const gen = ++state.generation;
    updateProgressUI();

    for (let i = 0; i < queue.length; i += CHUNK_SIZE) {
        if (gen !== state.generation) break; // cancelled
        const chunk = queue.slice(i, i + CHUNK_SIZE);
        let resp = null;
        try {
            resp = await browserAPI.runtime.sendMessage({
                type: 'TRANSLATE',
                texts: chunk.map(c => ({ id: c.key, text: c.text })),
                targetLanguage: settings.targetLanguage,
                sourceLanguage: settings.sourceLanguage,
                silentPartials: true // FR-5: never paint partial results
            });
        } catch (e) {
            dbg('TRANSLATE failed:', e && e.message);
        }
        if (gen !== state.generation) break; // cancelled mid-flight: discard

        let failed = 0;
        if (resp && Array.isArray(resp.translations)) {
            for (const t of resp.translations) {
                const ref = typeof t.id === 'string' ? state.paraMap.get(t.id) : null;
                if (!ref) continue;
                if (t.error || !t.text) {
                    failed++;
                    markFailed(ref);
                } else {
                    ref.trans.textContent = t.text;
                    ref.trans.dataset.state = 'done';
                }
            }
        } else {
            failed = chunk.length;
            for (const c of chunk) {
                const ref = state.paraMap.get(c.key);
                if (ref) markFailed(ref);
            }
        }
        state.consecutiveFailures = (failed === chunk.length) ? state.consecutiveFailures + 1 : 0;
        if (state.consecutiveFailures >= 2) {
            state.llmFailBanner = true;
            showBanner('error', '翻訳に失敗しました。ローカル LLM を確認してください。');
        } else if (state.llmFailBanner && failed < chunk.length) {
            // Recovered: drop the stale failure banner (keep quality banners).
            state.llmFailBanner = false;
            hideBanner();
        }
        updateProgressUI();
        dbg(`chunk ${i / CHUNK_SIZE + 1}: ${chunk.length - failed}/${chunk.length} ok`);
    }

    state.translating = false;
    updateProgressUI();
}

// FR-6: failed paragraphs keep the original text, never blank.
function markFailed(ref) {
    ref.trans.textContent = ref.orig.textContent;
    ref.trans.dataset.state = 'error';
}

function cancelTranslation() {
    state.generation++; // in-flight response is discarded on arrival
    state.translating = false;
    updateProgressUI();
    setProgressText('キャンセルしました');
}
