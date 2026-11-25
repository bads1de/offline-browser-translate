// Fragment of the Local LLM Translator content script.
//
// Floating translate button shown on text selection.
//
// Loaded in order by CONTENT_SCRIPTS (background/content-injection.js, popup)
// together with the other content/*.js fragments. They deliberately share one
// global scope, exactly like the single content.js they were split out of: a
// top-level declaration here is visible to every later fragment.

// ============================================================================
// Floating translate button (only active when auto-injected via optional permission)
// ============================================================================

let floatingTranslateBtn = null;
let suppressFloatingBtn = false;

function getLanguageName(code) {
    try {
        return new Intl.DisplayNames([navigator.language || 'en'], { type: 'language' }).of(code);
    } catch (e) {
        return code.toUpperCase();
    }
}

function updateFloatingBtnTitle() {
    if (floatingTranslateBtn) {
        floatingTranslateBtn.title = `Translate to ${getLanguageName(currentTargetLanguage)}`;
    }
}

function getFloatingTranslateBtn() {
    if (floatingTranslateBtn) return floatingTranslateBtn;

    const btn = document.createElement('div');
    btn.id = 'llm-translator-float-btn';
    btn.setAttribute('translate', 'no');
    btn.title = `Translate to ${getLanguageName(currentTargetLanguage)}`;
    btn.style.cssText = [
        'position:absolute', 'width:2em', 'height:2em', 'cursor:pointer',
        'z-index:999999', 'display:none', 'align-items:center', 'justify-content:center',
        'transition:opacity 0.1s,transform 0.1s', 'opacity:0', 'transform:scale(0.8)'    ].join(';');

    const img = document.createElement('img');
    img.src = browserAPI.runtime.getURL('icons/icon48.png');
    img.style.cssText = 'width:100%;height:100%;pointer-events:none;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.35))';
    btn.appendChild(img);

    btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.65'; });
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideFloatingBtn();
        translateSelection(currentTargetLanguage, getPageLanguage());
    });

    document.body.appendChild(btn);
    floatingTranslateBtn = btn;
    return btn;
}

function showFloatingBtn(selection) {
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(selection.rangeCount - 1);
    const rects = range.getClientRects();
    const rect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const btn = getFloatingTranslateBtn();
    btn.style.left = (rect.right + window.scrollX + 4) + 'px';
    btn.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    btn.style.display = 'flex';
    requestAnimationFrame(() => { btn.style.opacity = '0.65'; btn.style.transform = 'scale(1)'; });
}

function hideFloatingBtn() {
    if (!floatingTranslateBtn) return;
    floatingTranslateBtn.style.opacity = '0';
    floatingTranslateBtn.style.transform = 'scale(0.8)';
    setTimeout(() => { if (floatingTranslateBtn) floatingTranslateBtn.style.display = 'none'; }, 80);
}

function tryShowFloatingBtn() {
    if (!floatingButtonEnabled) return;
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';
    // Only suppress when the page *explicitly* declares the target language; an
    // undeclared page (null) is treated as unknown so the button still appears.
    const declaredLang = getDeclaredPageLanguage();
    const sameLanguage = declaredLang !== null && declaredLang === currentTargetLanguage;
    if (selection && !selection.isCollapsed && selectedText.length >= MIN_TEXT_LENGTH
            && !sameLanguage && !translationInProgress && !suppressFloatingBtn) {
        showFloatingBtn(selection);
    }
}

// mouseup/keyup: selection is final, safe to show the button.
// selectionchange: only used to hide when selection is cleared, avoiding
// the double-click problem where it briefly collapses before expanding.
document.addEventListener('mouseup', tryShowFloatingBtn);
document.addEventListener('keyup', (e) => {
    if (e.shiftKey || e.key === 'End' || e.key === 'Home') tryShowFloatingBtn();
});

document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';
    if (!selection || selection.isCollapsed || selectedText.length < MIN_TEXT_LENGTH) {
        hideFloatingBtn();
    }
});

window.addEventListener('scroll', () => {
    if (floatingTranslateBtn && floatingTranslateBtn.style.display !== 'none') hideFloatingBtn();
}, { passive: true });
