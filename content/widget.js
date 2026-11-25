// Fragment of the Local LLM Translator content script.
//
// The bottom-right progress pill and toast, and page-language detection.
//
// Loaded in order by CONTENT_SCRIPTS (background/content-injection.js, popup)
// together with the other content/*.js fragments. They deliberately share one
// global scope, exactly like the single content.js they were split out of: a
// top-level declaration here is visible to every later fragment.

// ============================================================================
// Translation progress widget (bottom-right)
//
// One small green pill serves both the "in-progress" state (message, stop
// button) and short one-off toasts (e.g. "Restored original text"). While a
// translation is running, it morphs down into a small percent circle after a
// few idle seconds and morphs back open on hover.
// ============================================================================

let widgetEl = null;
let widgetMinimizeTimer = null;
let widgetHideTimer = null;
let widgetHovered = false;
let widgetState = 'idle'; // 'idle' | 'progress' | 'complete'// Set when a cancellation is a step inside a more specific action (e.g.
// "Ignore site") that's about to show its own message - keeps the generic
// "Translation cancelled" from flashing on screen for a moment first.
let suppressCancelMessage = false;

function ensureWidgetStyles() {
    if (document.getElementById('llm-translator-widget-style')) return;
    const style = document.createElement('style');
    style.id = 'llm-translator-widget-style';
    style.textContent = `
        #llm-translator-status.ltw, #llm-translator-status.ltw *, #llm-translator-status.ltw *::before, #llm-translator-status.ltw *::after {
            box-sizing: border-box;
        }
        #llm-translator-status.ltw {
            position: fixed; bottom: 20px; right: 20px; z-index: 999999;
            overflow: hidden; background: #A7C080; color: #1E2326;
            font-family: system-ui, -apple-system, sans-serif; font-size: 13px; line-height: 1.4;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2); user-select: none;
            width: 40px; max-height: 40px; border-radius: 20px;
            opacity: 0; transform: translateY(10px) scale(0.92); pointer-events: none;
            /* --ltw-width-duration lets JS use a near-instant width change when the
               box is already open and just resizing for new text (nothing to morph,
               so no reason to let text sit ellipsis-truncated for 0.35s while it
               catches up) vs the full 0.35s "stretch" when actually morphing open
               from the minimized circle. */
            transition: opacity 0.25s ease, transform 0.25s ease,
                width var(--ltw-width-duration, 0.35s) cubic-bezier(.4,0,.2,1),
                max-height 0.35s cubic-bezier(.4,0,.2,1), border-radius 0.35s cubic-bezier(.4,0,.2,1),
                background-color 0.2s ease;
        }
        #llm-translator-status.ltw.ltw-visible { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
        #llm-translator-status.ltw-error { background: #E67E80; }
        #llm-translator-status.ltw-expanded { width: var(--ltw-expanded-width, 160px); max-height: 42px; border-radius: 12px; }
        #llm-translator-status.ltw-minimized { width: 40px; max-height: 40px; border-radius: 20px; cursor: pointer; }
        #llm-translator-status .ltw-content {
            position: relative; z-index: 1; padding: 8px 8px 8px 12px;
            /* Delayed so text only fades in once the width transition (0.35s) has
               mostly finished - otherwise it's visible (and ellipsis-truncated)
               while the box is still mid-widen, flashing half the message. */
            opacity: 1; transition: opacity 0.15s ease 0.2s;
        }
        #llm-translator-status.ltw-minimized .ltw-content { opacity: 0; pointer-events: none; }
        #llm-translator-status .ltw-row { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; }
        #llm-translator-status .ltw-message {
            flex: 1 1 auto; min-width: 0; font-size: 13px; font-weight: 600;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        #llm-translator-status .ltw-actions { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; margin-left: auto; }
        /* The [hidden] attribute alone loses to the rule above (author CSS always
           beats the UA stylesheet's [hidden]{display:none}, regardless of
           specificity) - without this, "hiding" the actions row did nothing:
           the stop/ignore-site buttons kept rendering and eating into the row's
           width, squeezing the message far narrower than measureContentWidth()
           had budgeted for (which correctly assumes the hidden actions take 0px). */
        #llm-translator-status .ltw-actions[hidden] { display: none; }
        #llm-translator-status .ltw-btn {
            background: rgba(30,35,38,0.14); border: 1px solid rgba(30,35,38,0.4); color: #1E2326;
            padding: 3px 8px; border-radius: 5px; cursor: pointer; font-family: inherit; font-size: 11px; font-weight: 600;
            width: auto; flex-shrink: 0; white-space: nowrap; transition: background 0.15s ease;
        }
        #llm-translator-status .ltw-btn:hover { background: rgba(30,35,38,0.26); }
        #llm-translator-status .ltw-icon-btn {
            display: flex; align-items: center; justify-content: center;
            width: 22px; height: 22px; padding: 0; flex-shrink: 0;
            border-radius: 50%; border: 1px solid rgba(30,35,38,0.3); cursor: pointer;
            transition: background 0.15s ease, filter 0.15s ease;
        }
        /* Same [hidden]-vs-author-display fix as .ltw-actions above. */
        #llm-translator-status .ltw-icon-btn[hidden] { display: none; }
        #llm-translator-status .ltw-icon-btn.ltw-stop { background: #E67E80; color: #1E2326; }
        #llm-translator-status .ltw-icon-btn.ltw-stop:hover { filter: brightness(0.93); }
        #llm-translator-status .ltw-icon-btn svg { width: 9px; height: 9px; }
        #llm-translator-status .ltw-ring {
            position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
            background: conic-gradient(#1E2326 calc(var(--ltw-pct, 0) * 1%), rgba(30,35,38,0.22) 0);
            -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
            mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
            opacity: 0; transition: opacity 0.15s ease;
        }
        #llm-translator-status.ltw-minimized .ltw-ring { opacity: 1; }
        #llm-translator-status .ltw-mini-pct {
            position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: 700; opacity: 0; pointer-events: none; transition: opacity 0.15s ease;
        }
        #llm-translator-status.ltw-minimized .ltw-mini-pct { opacity: 1; }
    `;
    document.head.appendChild(style);
}

function getWidget() {
    if (widgetEl) return widgetEl;
    ensureWidgetStyles();

    const el = document.createElement('div');
    el.id = 'llm-translator-status';
    el.setAttribute('translate', 'no');
    el.className = 'ltw';
    el.innerHTML = `
        <div class="ltw-content">
            <div class="ltw-row">
                <span class="ltw-message"></span>
                <div class="ltw-actions" hidden>
                    <button type="button" class="ltw-btn ltw-never" hidden>Ignore site</button>
                    <button type="button" class="ltw-icon-btn ltw-stop" title="Stop translation" aria-label="Stop translation">
                        <svg viewBox="0 0 10 10" fill="currentColor"><rect x="0" y="0" width="10" height="10" rx="1.5"></rect></svg>
                    </button>
                </div>
            </div>
        </div>
        <div class="ltw-ring"></div>
        <span class="ltw-mini-pct"></span>
    `;
    document.body.appendChild(el);
    widgetEl = el;

    el.querySelector('.ltw-stop').addEventListener('click', () => stopCurrentTranslation());
    el.querySelector('.ltw-never').addEventListener('click', async () => {
        stopCurrentTranslation({ silent: true });
        try {
            await browserAPI.runtime.sendMessage({
                type: 'ADD_AUTO_TRANSLATE_NEVER_SITE',
                hostname: location.hostname
            });
            // Un-ignoring a site lives in the Settings page's Auto-Translate
            // section instead (plenty of room there, and no translation to
            // resume anyway - the page needs a reload regardless once the
            // site's un-ignored).
            showToast(`${location.hostname} won't be auto-translated`);
        } catch (e) {
            showToast('Could not save the site preference', true);
        }
    });

    el.addEventListener('mouseenter', () => {
        widgetHovered = true;
        clearTimeout(widgetMinimizeTimer);
        clearTimeout(widgetHideTimer);
        if (widgetState === 'progress') expandWidgetBox();
    });
    el.addEventListener('mouseleave', () => {
        widgetHovered = false;
        // Any hover-then-leave counts as user interaction, so it always gets
        // the short delay - only a completely untouched widget waits the
        // full 3s (that timer was already set once, at start, and is left
        // alone here since it's still ticking).
        if (widgetState === 'progress') scheduleMinimize(1000);
        else if (widgetState === 'complete') scheduleHide(1500);
    });

    return el;
}

// delay is explicit so callers control the "no interaction yet" (3s, set
// once at start) vs "user just hovered away" (1s) cases. Deliberately NOT
// called from progress updates - only from start and from mouseleave -
// otherwise a fast stream of progress ticks would keep resetting the clock
// and the widget would never get a quiet window to minimize in.
function scheduleMinimize(delay) {
    clearTimeout(widgetMinimizeTimer);
    if (widgetState !== 'progress') return;
    widgetMinimizeTimer = setTimeout(() => {
        if (!widgetHovered && widgetState === 'progress' && widgetEl) {
            widgetEl.classList.remove('ltw-expanded');
            widgetEl.classList.add('ltw-minimized');
        }
    }, delay);
}

// Only fires the actual hide if the user isn't still hovering; mouseleave
// re-arms it once they move away.
function scheduleHide(delay) {
    clearTimeout(widgetHideTimer);
    widgetHideTimer = setTimeout(() => {
        if (widgetHovered) return;
        if (widgetState === 'complete') hideWidget();
    }, delay);
}

// Measures the pill's natural width from its actual text/button content.
// Uses a real offscreen DOM element (not canvas measureText, which turned
// out to under-measure - likely a system-ui font-string mismatch between
// canvas and DOM rendering) so it matches exactly what the browser renders.
let widgetMeasureRuler = null;
function getMeasureRuler() {
    if (widgetMeasureRuler) return widgetMeasureRuler;
    const ruler = document.createElement('span');
    // Without this, every text update here (many per second while translating)
    // looks like new page content to the auto-translate MutationObserver, which
    // queues it, translates it, writes the result back in - which is itself a
    // mutation, re-triggering the loop forever. Same marker the widget itself
    // uses to stay invisible to that pipeline.
    ruler.setAttribute('translate', 'no');
    ruler.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;' +
        'white-space:nowrap;font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:600;';
    document.body.appendChild(ruler);
    widgetMeasureRuler = ruler;
    return ruler;
}
const WIDGET_MAX_WIDTH = 300;

function measureTextWidth(text) {
    const ruler = getMeasureRuler();
    ruler.textContent = text;
    return ruler.getBoundingClientRect().width;
}

function measureContentWidth(el) {
    const messageWidth = measureTextWidth(el.querySelector('.ltw-message').textContent);

    const actionsEl = el.querySelector('.ltw-actions');
    let actionsWidth = 0;
    let gap = 0;
    if (!actionsEl.hidden) {
        actionsWidth = actionsEl.getBoundingClientRect().width;
        gap = 8;
    }

    const horizontalPadding = 12 + 8; // .ltw-content: 8px 8px 8px 12px
    const total = horizontalPadding + messageWidth + gap + actionsWidth + 4; // small safety buffer
    return Math.max(120, Math.min(WIDGET_MAX_WIDTH, Math.ceil(total)));
}

// Appends each clause only if the result still fits the pill's max width -
// a clause that doesn't fit is dropped whole rather than left for CSS to
// chop off mid-word. Clauses should be passed most-important first.
function appendFittingClauses(base, clauses) {
    let msg = base;
    for (const clause of clauses) {
        const candidate = msg + clause;
        const width = 20 + measureTextWidth(candidate) + 4; // .ltw-content horizontal padding + buffer
        if (width <= WIDGET_MAX_WIDTH) msg = candidate;
    }
    return msg;
}

// Does NOT touch widgetMinimizeTimer - resizing the box for new text
// shouldn't disturb an already-running minimize countdown. Only actual
// hover interaction (mouseenter) or a fresh start should reset that clock.
function expandWidgetBox() {
    if (!widgetEl) return;
    // Only a genuine morph-open (from the minimized circle) gets the slow
    // "stretch" animation; a resize of an already-open box (new/longer text)
    // snaps near-instantly so text is never sitting truncated mid-transition.
    const isMorphOpen = widgetEl.classList.contains('ltw-minimized');
    widgetEl.style.setProperty('--ltw-width-duration', isMorphOpen ? '0.35s' : '0.08s');
    widgetEl.style.setProperty('--ltw-expanded-width', measureContentWidth(widgetEl) + 'px');
    widgetEl.classList.remove('ltw-minimized');
    widgetEl.classList.add('ltw-expanded');
}

/**
 * Show the pill and start the minimize timer.
 * Pass auto:true for translations started without the user directly asking.
 */
function startProgressWidget({ auto = false, message = '' } = {}) {
    const el = getWidget();
    clearTimeout(widgetHideTimer);
    widgetState = 'progress';
    el.classList.remove('ltw-error');
    el.classList.add('ltw-visible');
    el.style.setProperty('--ltw-pct', '0');

    el.querySelector('.ltw-message').textContent = message;
    el.querySelector('.ltw-mini-pct').textContent = '0%';
    el.querySelector('.ltw-actions').hidden = false;
    el.querySelector('.ltw-never').hidden = !auto;
    expandWidgetBox();

    // Untouched-widget case: exactly one 3s timer, set here and never reset
    // by progress updates - see expandWidgetBox's comment.
    if (!widgetHovered) scheduleMinimize(3000);
}

function updateProgressWidget(percent, message) {
    if (!widgetEl || widgetState !== 'progress') return;
    const pct = Math.max(0, Math.min(100, Math.round(percent)));
    widgetEl.style.setProperty('--ltw-pct', String(pct));
    widgetEl.querySelector('.ltw-mini-pct').textContent = pct + '%';
    if (message !== undefined) {
        widgetEl.querySelector('.ltw-message').textContent = message;
        // Resizes for the new text without touching the minimize countdown -
        // see expandWidgetBox's comment.
        if (!widgetEl.classList.contains('ltw-minimized')) expandWidgetBox();
    }
}

/**
 * Show the final result, forcing the pill back open so the user sees it,
 * then fade the whole widget out after a delay (unless the user is hovering).
 */
function completeWidget(message, isError = false) {
    const el = getWidget();
    clearTimeout(widgetMinimizeTimer);
    widgetState = 'complete';
    el.classList.toggle('ltw-error', isError);
    el.classList.add('ltw-visible');
    el.querySelector('.ltw-message').textContent = message;
    el.querySelector('.ltw-actions').hidden = true;
    expandWidgetBox();
    scheduleHide(isError ? 5000 : 4000);
}

function hideWidget() {
    clearTimeout(widgetMinimizeTimer);
    clearTimeout(widgetHideTimer);
    widgetState = 'idle';
    // Without this, a mouse that's sitting still over the widget's screen
    // position when it hides never fires a fresh mouseleave/mouseenter pair,
    // so the stale "hovered" flag survives into the next run and blocks
    // both scheduleMinimize (start) and scheduleHide (complete) from firing.
    widgetHovered = false;
    if (widgetEl) widgetEl.classList.remove('ltw-visible', 'ltw-minimized', 'ltw-expanded');
}

/** A short one-off message with no stop button. */
function showToast(message, isError = false) {
    const el = getWidget();
    clearTimeout(widgetMinimizeTimer);
    widgetState = 'complete';
    el.classList.toggle('ltw-error', isError);
    el.classList.add('ltw-visible');
    el.querySelector('.ltw-actions').hidden = true;
    el.querySelector('.ltw-message').textContent = message;
    expandWidgetBox();
    scheduleHide(isError ? 4000 : 2500);
}

/** Stop button handler: just cancel remaining work. Already-translated text
 * (even from an auto-triggered run) is left as-is. Pass silent:true when the
 * caller is about to show its own, more specific completion message. */
function stopCurrentTranslation({ silent = false } = {}) {
    translationCancelled = true;
    suppressCancelMessage = silent;
    pendingTranslationQueue = [];
    stopAutoTranslate();
}

// LM Studio JIT-loads models on the first request, which can take a while
// and would otherwise leave the widget looking frozen at "0%" with no
// requests yet answered. This only *observes* the load state via polling and
// updates the widget accordingly - it never triggers a load itself, so it
// must be started alongside (not before) the actual translation requests,
// which are what cause LM Studio to load the model. No-ops for Ollama/older
// LM Studio, since GET_MODEL_STATE reports state: null there.
//
// onReady fires the instant "loaded" is observed, so the caller can switch
// the widget straight to its normal progress text instead of leaving
// "Loading model..." stuck on screen until the next unrelated widget update
// (which might not happen until the first translation batch finishes,
// seconds later). Returns a stop() function; call it once real responses
// start arriving, so this doesn't keep polling for the rest of the run.
function watchModelLoading(onReady) {
    let stopped = false;
    const maxWaitMs = 180000; // safety cap so a stuck/unknown state never polls forever
    const startedAt = Date.now();
    (async () => {
        try {
            while (!stopped && !translationCancelled && Date.now() - startedAt < maxWaitMs) {
                const res = await browserAPI.runtime.sendMessage({ type: 'GET_MODEL_STATE' });
                if (stopped) return;
                if (!res || !res.state || res.state === 'loaded') {
                    if (onReady) onReady();
                    return;
                }
                updateProgressWidget(0, 'Loading model...');
                await new Promise(r => setTimeout(r, 300));
            }
        } catch (e) {
            // Background worker unreachable or message type unsupported - just stop watching.
        }
    })();
    return () => { stopped = true; };
}

/**
 * Detect page source language from HTML lang attribute
 * Returns base language code (e.g., "en" from "en-US")
 */
// Returns the page's explicitly declared language code, or null when the page
// declares none. Kept separate from getPageLanguage() so callers that need to
// reason about "unknown" (e.g. the floating button) aren't fooled by a default.
function getDeclaredPageLanguage() {
    const htmlLang = document.documentElement.lang || document.querySelector('html')?.getAttribute('lang');
    if (htmlLang) {
        // Extract base language code (e.g., "en" from "en-US")
        return htmlLang.split('-')[0].toLowerCase();
    }
    // Fallback: try meta tag
    const metaLang = document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content');
    if (metaLang) {
        return metaLang.split('-')[0].toLowerCase();
    }
    return null; // No declared language
}

function getPageLanguage() {
    return getDeclaredPageLanguage() || 'en'; // Default fallback for translation source
}
