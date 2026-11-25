// Fragment of the Local LLM Translator content script.
//
// Page translation: batches, queue, auto-translate of new content, selection
// translation.
//
// Loaded in order by CONTENT_SCRIPTS (background/content-injection.js, popup)
// together with the other content/*.js fragments. They deliberately share one
// global scope, exactly like the single content.js they were split out of: a
// top-level declaration here is visible to every later fragment.


// ============================================================================
// Auto-translate on page load
//
// Opt-in (settings.autoTranslatePages). Only runs when the page *declares* a
// language different from the target one — guessing would mean burning local
// inference on pages that are already readable, so an undeclared page is left
// alone. Two escape hatches are offered on the page itself while it runs.
// ============================================================================

let autoTranslateChecked = false;

// A never-list entry covers its own host and any subdomain, so "example.com"
// also matches "news.example.com".
function hostMatchesNeverSite(hostname, sites) {
    const host = (hostname || '').toLowerCase();
    if (!host || !Array.isArray(sites)) return false;
    return sites.some(entry => {
        const site = String(entry || '').trim().toLowerCase();
        if (!site) return false;
        return host === site || host.endsWith('.' + site);
    });
}

// Decide whether this page should be translated without the user asking, and
// do it. Safe to call more than once — only the first call is acted on.
async function maybeAutoTranslatePage(settings) {
    if (autoTranslateChecked) return;
    autoTranslateChecked = true;

    if (!settings || !settings.autoTranslatePages) return;
    // Top-level documents only. Translating every ad and widget iframe on a page
    // would multiply the request count for text the user mostly cannot see.
    if (window.top !== window.self) return;
    if (translationInProgress) return;

    const pageLang = getDeclaredPageLanguage();
    if (!pageLang) return;

    const target = String(settings.targetLanguage || currentTargetLanguage || 'en')
        .split('-')[0].toLowerCase();
    if (pageLang === target) return;

    const neverLangs = Array.isArray(settings.autoTranslateNeverLanguages)
        ? settings.autoTranslateNeverLanguages
        : [];
    if (neverLangs.includes(pageLang)) return;

    if (hostMatchesNeverSite(location.hostname, settings.autoTranslateNeverSites)) return;

    debugLog(`[Translator] Auto-translating page from ${pageLang} to ${target}`);
    await translatePage(target, pageLang, true, { auto: true });
}

/**
 * Translate a batch of text items with retry logic
 * Returns { applied: number, failed: Array } 
 */
async function translateBatch(textItems, targetLanguage, sourceLanguage = 'auto', retries = 3) {
    if (textItems.length === 0) return { applied: 0, failed: [] };

    debugLog(`[Translator] translateBatch called for ${textItems.length} items:`, textItems);

    // Use passed source language if valid, otherwise detect from page
    const pageLanguage = (sourceLanguage && sourceLanguage !== 'auto')
        ? sourceLanguage
        : getPageLanguage();

    let lastError = null;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            if (attempt > 0) {
                debugLog(`[Translator] Retrying batch, attempt ${attempt + 1}/${retries}`);
            }
            const requestStartTs = performance.now();
            const response = await browserAPI.runtime.sendMessage({
                type: 'TRANSLATE',
                texts: textItems,
                targetLanguage,
                sourceLanguage: pageLanguage // Pass detected page language for TranslateGemma
            });
            perfMark('c.request', performance.now() - requestStartTs, { n: textItems.length });

            debugLog(`[Translator] translateBatch response:`, response);

            // sendMessage resolves undefined if the background worker was asleep
            // or a handler returned without responding — treat as retryable.
            if (!response) {
                throw new Error('No response from background (worker asleep?)');
            }
            if (response.error) {
                throw new Error(response.error);
            }

            const { translations } = response;
            debugLog(`[Translator] Got ${translations?.length} translations back for ${textItems.length} items`);

            let applied = 0;
            const failed = [];
            const receivedIds = new Set();

            // Process received translations
            const applyStartTs = performance.now();
            for (const t of (translations || [])) {
                receivedIds.add(t.id);
                if (!t.error && t.text) {
                    if (replaceTextNode(t.id, t.text)) {
                        applied++;
                    } else {
                        // Node replacement failed
                        const original = textItems.find(item => item.id === t.id);
                        if (original) failed.push(original);
                    }
                } else if (t.error) {
                    console.warn(`[Translator] Translation error for id ${t.id}: ${t.error}`);
                    const original = textItems.find(item => item.id === t.id);
                    if (original) failed.push(original);
                }
            }
            perfMark('c.apply', performance.now() - applyStartTs, { n: translations?.length || 0 });

            // Check for items that weren't returned at all
            for (const item of textItems) {
                if (!receivedIds.has(item.id)) {
                    console.warn(`[Translator] Item ${item.id} was not returned by LLM`);
                    failed.push(item);
                }
            }

            if (failed.length > 0) {
                console.warn(`[Translator] ${failed.length} items failed in this batch`);
            }

            return {
                applied, failed,
                fromCache: response.fromCache || 0,
                total: (typeof response.total === 'number') ? response.total : textItems.length,
                cacheActive: !!response.cacheActive
            };

        } catch (e) {
            lastError = e;
            console.warn(`[Translator] Attempt ${attempt + 1}/${retries} failed:`, e.message);
            debugWarn(`[Translator] Batch translation failed with exception:`, e, 'on items:', textItems);

            // Wait before retry (exponential backoff)
            if (attempt < retries - 1) {
                await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
            }
        }
    }

    // All retries failed - return all items as failed
    console.error(`[Translator] All retries failed for batch of ${textItems.length} items. Last error: ${lastError?.message}`);
    return { applied: 0, failed: textItems, fromCache: 0, total: textItems.length, cacheActive: false };
}


/**
 * Handle scroll event - recalculate priorities after user stops scrolling
 */
function onScroll() {
    if (scrollDebounceTimer) {
        clearTimeout(scrollDebounceTimer);
    }
    scrollDebounceTimer = setTimeout(() => {
        if (pendingTranslationQueue.length > 0) {
            recalculatePendingPriorities();
        }
    }, 100); // 100ms debounce for snappier updates
}

/**
 * Main translation function with queue and cancellation support
 */
async function translatePage(targetLanguage, sourceLanguage = 'auto', enableAutoTranslate = true, { auto = false } = {}) {
    if (translationInProgress) {
        showToast('Translation already in progress...', true);
        return;
    }

    currentTargetLanguage = targetLanguage;
    translationInProgress = true;
    translationCancelled = false;
    suppressCancelMessage = false;
    const verb = auto ? 'Auto-translating' : 'Translating';
    startProgressWidget({ auto, message: 'Extracting text...' });

    // Perf run marker: everything measured against this stays on one timeline
    const runStartTs = performance.now();
    perfRunStartTs = runStartTs;
    streamedAppliedCount = 0;

    // Add scroll listener for dynamic priority
    window.addEventListener('scroll', onScroll, { passive: true });
    const stopKeepAlive = startKeepAlive();
    let stopModelWatch = null;

    try {
        const textItems = extractTextNodes();
        perfMark('c.scan', performance.now() - runStartTs, { n: textItems.length });

        if (textItems.length === 0) {
            completeWidget('No translatable text found', true);
            translationInProgress = false;
            return;
        }

        // Initialize queue with all items (already sorted by priority)
        pendingTranslationQueue = [...textItems];

        updateProgressWidget(0, `Found ${textItems.length} text elements. ${verb}...`);

        let totalApplied = 0;
        let totalProcessed = 0; // Track how many items we've attempted
        let totalFromCache = 0; // Elements served from the translation cache
        let cacheActive = false; // Whether the cache was on for this run
        const totalItems = textItems.length;
        const batchSize = 8; // Process in batches
        // The first batch is deliberately tiny: it carries the highest-priority
        // (on-screen) text, and finishing it early is what puts the first
        // translations on the page. Later batches run at full size.
        const FIRST_BATCH_SIZE = 3;
        let isFirstBatch = true;
        const failedItems = []; // Track items that failed for potential retry
        let inFlightBatches = []; // Track in-flight batch promises

        // Started alongside (not before) the real requests below - LM Studio
        // only starts loading once one of those requests actually lands.
        stopModelWatch = watchModelLoading(() => {
            const percent = Math.min(100, Math.round((totalProcessed / totalItems) * 100));
            updateProgressWidget(percent, `${verb} ${percent}%`);
        });

        // Main translation loop with parallel processing
        while ((pendingTranslationQueue.length > 0 || inFlightBatches.length > 0) && !translationCancelled) {
            // Fill up to maxConcurrentRequests parallel batches
            while (inFlightBatches.length < maxConcurrentRequests && pendingTranslationQueue.length > 0) {
                const size = isFirstBatch ? Math.min(batchSize, FIRST_BATCH_SIZE) : batchSize;
                const batch = pendingTranslationQueue.splice(0, size);
                isFirstBatch = false;
                totalProcessed += batch.length;
                perfMark('c.batch.dispatch', performance.now() - runStartTs, { n: batch.length, queued: pendingTranslationQueue.length });

                // Create a trackable batch object with unique ID
                const batchId = Date.now() + Math.random();
                const batchPromise = translateBatch(batch, targetLanguage, sourceLanguage)
                    .then(result => ({ batchId, result, batch, success: true }))
                    .catch(error => ({ batchId, error, batch, success: false }));

                inFlightBatches.push({ batchId, promise: batchPromise });
            }

            // Cap percentage at 100%
            const percent = Math.min(100, Math.round((totalProcessed / totalItems) * 100));
            updateProgressWidget(percent, `${verb} ${percent}%`);

            // Wait for any one batch to complete
            if (inFlightBatches.length > 0) {
                const completed = await Promise.race(inFlightBatches.map(b => b.promise));
                stopModelWatch(); // a response landed, so the model is answering - stop polling its load state

                // Remove the completed batch from inFlightBatches by its ID
                inFlightBatches = inFlightBatches.filter(b => b.batchId !== completed.batchId);

                if (completed.success) {
                    if (totalApplied === 0 && completed.result.applied > 0) {
                        perfMark('c.first_apply', performance.now() - runStartTs, { n: completed.result.applied });
                    }
                    totalApplied += completed.result.applied;
                    totalFromCache += completed.result.fromCache || 0;
                    if (completed.result.cacheActive) cacheActive = true;
                    if (completed.result.failed && completed.result.failed.length > 0) {
                        failedItems.push(...completed.result.failed);
                    }
                } else {
                    console.error('Batch error:', completed.error);
                    failedItems.push(...completed.batch);
                }
            }

            // Check cancellation between batches
            if (translationCancelled) {
                if (!suppressCancelMessage) completeWidget('Translation cancelled');
                break;
            }
        }

        // Whatever got applied before a cancel is real, translated text sitting
        // in the page - the popup's "Original" toggle needs to know about it
        // regardless of whether the run finished or was cut short.
        if (totalApplied > 0) {
            hasTranslationCache = true;
            isShowingTranslations = true;
        }

        perfMark('c.total', performance.now() - runStartTs, { n: totalItems, applied: totalApplied });

        if (!translationCancelled) {
            if (failedItems.length > 0) {
                console.warn(`[Translator] ${failedItems.length} items failed:`,
                    failedItems.slice(0, 5).map(f => f.text.substring(0, 30)));
            }

            if (enableAutoTranslate) startAutoTranslate(targetLanguage);

            // The core "did it work" stat always shows; everything after is a
            // nice-to-have that gets dropped whole (not truncated mid-word) if
            // it doesn't fit the pill - most important clause first.
            const cachePercent = (cacheActive && totalFromCache > 0 && totalItems > 0)
                ? Math.round((totalFromCache / totalItems) * 100) : 0;
            const statusMsg = appendFittingClauses(`Translated ${totalApplied}/${totalItems} elements`, [
                failedItems.length > 0 ? `, ${failedItems.length} failed` : '',
                cachePercent > 0 ? `, ${cachePercent}% cached` : '',
                enableAutoTranslate ? ' · auto-on' : ''            ].filter(Boolean));

            completeWidget(statusMsg);
        }

    } catch (e) {
        console.error('Translation error:', e);
        completeWidget(`Error: ${e.message}`, true);
    } finally {
        stopKeepAlive();
        if (stopModelWatch) stopModelWatch();
        translationInProgress = false;
        translationCancelled = false;
        pendingTranslationQueue = [];
        window.removeEventListener('scroll', onScroll);
        // Let the popup know translation is done so it can reset its button
        // (e.g. when everything was served from cache and finished instantly).
        try {
            browserAPI.runtime.sendMessage({ type: 'TRANSLATION_COMPLETE' }).catch(() => {});
        } catch (e) { /* popup may be closed */ }
    }
}

/**
 * Recalculate priorities for pending items based on current viewport
 */
function recalculatePendingPriorities() {
    for (const item of pendingTranslationQueue) {
        const nodeId = segmentToNodeIdMap.get(item.id);
        if (nodeId !== undefined) {
            const entry = textNodeMap.get(nodeId);
            if (entry && entry.node && entry.node.parentElement) {
                item.priority = calculatePriority(entry.node);
            }
        }
    }
    // Re-sort by new priorities
    pendingTranslationQueue.sort((a, b) => b.priority - a.priority);
}

/**
 * Start watching for new content and auto-translate
 */
function startAutoTranslate(targetLanguage) {
    if (mutationObserver) {
        mutationObserver.disconnect();
    }

    autoTranslateEnabled = true;
    currentTargetLanguage = targetLanguage;
    pendingNewNodes = [];

    mutationObserver = new MutationObserver((mutations) => {
        if (!autoTranslateEnabled) return;

        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    pendingNewNodes.push(node);
                }
            }
        }

        // Debounce: wait for DOM to settle before translating
        if (autoTranslateDebounceTimer) {
            clearTimeout(autoTranslateDebounceTimer);
        }
        autoTranslateDebounceTimer = setTimeout(() => {
            translatePendingNodes();
        }, 500);
    });

    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('Auto-translate enabled for new content');
}

/**
 * Stop auto-translate
 */
function stopAutoTranslate() {
    autoTranslateEnabled = false;
    if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
    }
    if (autoTranslateDebounceTimer) {
        clearTimeout(autoTranslateDebounceTimer);
        autoTranslateDebounceTimer = null;
    }
    pendingNewNodes = [];
    console.log('Auto-translate disabled');
}

/**
 * Translate pending new nodes
 */
async function translatePendingNodes() {
    if (pendingNewNodes.length === 0 || translationInProgress) return;

    const nodesToProcess = [...pendingNewNodes];
    pendingNewNodes = [];

    const textItems = extractNewTextNodes(nodesToProcess);

    if (textItems.length === 0) return;

    translationInProgress = true;
    showToast(`Translating ${textItems.length} new elements...`);

    try {
        const result = await translateBatch(textItems, currentTargetLanguage);
        showToast(`Translated ${result.applied} new elements`);
    } catch (e) {
        console.error('Auto-translate error:', e);
        showToast(`Auto-translate error: ${e.message}`, true);
    } finally {
        translationInProgress = false;
    }
}

async function translateSelection(targetLanguage, sourceLanguage = 'auto') {
    if (translationInProgress) {
        showToast('Translation already in progress...', true);
        return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        showToast('No text selected', true);
        return;
    }

    currentTargetLanguage = targetLanguage;
    translationInProgress = true;
    translationCancelled = false;
    perfRunStartTs = performance.now();
    streamedAppliedCount = 0;
    const stopKeepAlive = startKeepAlive();
    let stopModelWatch = null;
    startProgressWidget({ message: 'Extracting selected text...' });

    try {
        const textItems = extractSelectionTextNodes(selection);

        if (textItems.length === 0) {
            completeWidget('No translatable text in selection', true);
            return;
        }

        updateProgressWidget(0, `Translating ${textItems.length} selected elements...`);

        let totalApplied = 0;
        const batchSize = 8;
        const failedItems = [];

        // Started alongside (not before) the real requests below - LM Studio
        // only starts loading once one of those requests actually lands.
        stopModelWatch = watchModelLoading(() => {
            updateProgressWidget(0, `Translating ${textItems.length} selected elements...`);
        });

        for (let i = 0; i < textItems.length && !translationCancelled; i += batchSize) {
            const batch = textItems.slice(i, i + batchSize);
            const result = await translateBatch(batch, targetLanguage, sourceLanguage);
            stopModelWatch(); // a response landed, so the model is answering - stop polling its load state
            totalApplied += result.applied;
            if (result.failed && result.failed.length > 0) failedItems.push(...result.failed);
            const percent = Math.min(100, Math.round(((i + batch.length) / textItems.length) * 100));
            updateProgressWidget(percent, `Translating selection ${percent}%`);
        }

        if (totalApplied > 0) {
            hasTranslationCache = true;
            isShowingTranslations = true;
        }

        let statusMsg = translationCancelled
            ? `Translation cancelled - ${totalApplied}/${textItems.length} selected elements translated`
            : `Translated ${totalApplied}/${textItems.length} selected elements`;
        if (failedItems.length > 0) statusMsg += ` - ${failedItems.length} failed`;
        completeWidget(statusMsg);

    } catch (e) {
        console.error('[Translator] Selection translation error:', e);
        completeWidget(`Error: ${e.message}`, true);
    } finally {
        stopKeepAlive();
        if (stopModelWatch) stopModelWatch();
        translationInProgress = false;
        translationCancelled = false;
        // Suppress the button briefly so it doesn't reappear on the now-translated selection
        suppressFloatingBtn = true;
        setTimeout(() => { suppressFloatingBtn = false; }, 1000);
    }
}
