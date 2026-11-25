// Fragment of the Local LLM Translator content script.
//
// Text-node registry, extraction, sentence splitting and replacement/restore,
// plus the translation state those paths maintain.
//
// Loaded in order by CONTENT_SCRIPTS (background/content-injection.js, popup)
// together with the other content/*.js fragments. They deliberately share one
// global scope, exactly like the single content.js they were split out of: a
// top-level declaration here is visible to every later fragment.


// Track text nodes and their segments
const textNodeMap = new Map(); // Maps nodeId -> { node, originalText, segments: [...] }
const segmentToNodeIdMap = new Map(); // Maps segmentId -> nodeId
const translatedNodeSet = new Set(); // Track which nodes have been translated
let translationInProgress = false;
let translationCancelled = false;  // Flag to cancel ongoing translation
let nextNodeId = 0;
let nextSegmentId = 0;
let currentTargetLanguage = 'en';
let maxConcurrentRequests = 4; // Default parallel requests (1-32, tunable in Settings > Performance)
let autoTranslateEnabled = false;
let showGlow = false; // Setting for glow effect (disabled by default)
let mutationObserver = null;
let pendingNewNodes = [];
let autoTranslateDebounceTimer = null;

// Translation state for toggle functionality
let hasTranslationCache = false; // True if we have cached translations
let isShowingTranslations = false; // True if currently showing translations

// Queue of pending text items to translate (with dynamic priority)
let pendingTranslationQueue = [];
let scrollDebounceTimer = null;

// Streaming state shared with the PARTIAL_TRANSLATION message handler: the
// current run's start timestamp (for perf marks) and how many items have
// already landed on the page via partial messages.
let perfRunStartTs = 0;
let streamedAppliedCount = 0;

// Elements to skip
const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED',
    'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'CODE', 'PRE', 'KBD',
    'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']);

// Minimum text length to consider for translation
const MIN_TEXT_LENGTH = 2;

/**
 * Check if an element should be skipped
 */
function shouldSkipElement(element) {
    if (!element || !element.tagName) return true;
    if (element.isContentEditable) return true;

    // Check element and ancestors for SKIP_TAGS, translate="no", or our extension elements
    let curr = element;
    while (curr) {
        if (curr.tagName && SKIP_TAGS.has(curr.tagName)) {
            return true;
        }
        if (curr.getAttribute && curr.getAttribute('translate') === 'no') {
            return true;
        }
        if (curr.id === 'llm-translator-status' || curr.id === 'llm-translator-float-btn') {
            return true;
        }
        curr = curr.parentElement;
    }
    
    return false;
}

/**
 * Check if text is worth translating
 */
function isTranslatableText(text) {
    if (!text) return false;
    // Trim and check minimum length
    const trimmed = text.trim();
    if (trimmed.length < MIN_TEXT_LENGTH) return false;
    // Skip if it's only whitespace, numbers, or punctuation
    // Use Unicode-aware check - look for any letter character
    const hasLetters = /\p{L}/u.test(trimmed);
    return hasLetters;
}

/**
 * Split text into sentence-level segments while preserving all whitespace and punctuation
 */
function splitIntoSentences(text) {
    if (!text) return [];
    const segments = [];
    let current = '';

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        current += ch;

        if ('。？！'.includes(ch)) {
            segments.push(current);
            current = '';
            continue;
        }

        if (!'.!?'.includes(ch)) continue;

        const prev = text[i - 1] || '';
        const next = text[i + 1] || '';
        if (ch === '.' && /\d/.test(prev) && /\d/.test(next)) {
            continue;
        }

        while (i + 1 < text.length && '.!?'.includes(text[i + 1])) {
            current += text[++i];
        }

        if (i + 1 >= text.length || /\s/.test(text[i + 1])) {
            while (i + 1 < text.length && /\s/.test(text[i + 1])) {
                current += text[++i];
            }
            segments.push(current);
            current = '';
        }
    }

    if (current) segments.push(current);
    return segments.length > 0 ? segments : [text];
}

/**
 * Check if a text node has already been processed
 */
function isNodeProcessed(node) {
    return translatedNodeSet.has(node);
}

/**
 * Calculate priority score for a text node (higher = more important, translate first)
 * Factors: viewport visibility, semantic context (main vs sidebar), parent tag type.
 */
const TAG_PRIORITY = {
    P: 80, H1: 70, H2: 60, H3: 50, H4: 40, H5: 40, H6: 40,
    LI: 30, BLOCKQUOTE: 25, FIGCAPTION: 25, TD: 20, TH: 20,
    SPAN: 5, DIV: 5, A: -10, LABEL: -30, BUTTON: -50
};

function calculatePriority(node) {
    const parent = node.parentElement;
    if (!parent) return 0;

    let priority = 0;
    const rect = parent.getBoundingClientRect();

    // Viewport visibility (dominant factor)
    if (rect.top < window.innerHeight && rect.bottom > 0 &&
        rect.left < window.innerWidth && rect.right > 0) {
        priority += 1000;
    }

    // Semantic context via closest() — main content vs sidebar/nav
    if (parent.closest('main, article, [role="main"], [role="article"]')) {
        priority += 500;
    } else if (parent.closest('nav, aside, footer, header, [role="navigation"], [role="complementary"]')) {
        priority -= 300;
    }

    // Tag type
    priority += TAG_PRIORITY[parent.tagName] || 0;

    return Math.max(0, priority);
}

/**
 * Register a text node: split into segments, add to maps, return text items for translation.
 */
function registerTextNode(node) {
    const nodeId = nextNodeId++;
    const priority = calculatePriority(node);
    const originalText = node.textContent;
    const segments = [];
    const textItems = [];

    const rawSegments = originalText.length > 200
        ? splitIntoSentences(originalText) : [originalText];

    for (const rawSeg of rawSegments) {
        if (isTranslatableText(rawSeg)) {
            const segmentId = nextSegmentId++;
            segmentToNodeIdMap.set(segmentId, nodeId);
            segments.push({
                id: segmentId, originalText: rawSeg,
                translatedText: null, processedTranslatedText: null, translated: false
            });
            textItems.push({ id: segmentId, text: rawSeg.trim(), priority });
        } else {
            segments.push({
                id: null, originalText: rawSeg,
                translatedText: null, processedTranslatedText: null, translated: false
            });
        }
    }

    textNodeMap.set(nodeId, { node, originalText, segments });
    translatedNodeSet.add(node);
    return textItems;
}

/**
 * Extract visible text nodes from the page (or from a specific root)
 */
function extractTextNodes(root = document.body, onlyNew = false) {
    if (!onlyNew) {
        textNodeMap.clear();
        segmentToNodeIdMap.clear();
        translatedNodeSet.clear();
        nextNodeId = 0;
        nextSegmentId = 0;
    }

    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                // Skip if already processed
                if (onlyNew && isNodeProcessed(node)) {
                    return NodeFilter.FILTER_REJECT;
                }
                const parent = node.parentElement;
                if (!parent || shouldSkipElement(parent)) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (!isTranslatableText(node.textContent)) {
                    return NodeFilter.FILTER_REJECT;
                }
                const style = window.getComputedStyle(parent);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const textItems = [];
    let node;
    while (node = walker.nextNode()) {
        textItems.push(...registerTextNode(node));
    }

    // Sort by priority (highest first) - visible headings get translated first
    textItems.sort((a, b) => b.priority - a.priority);

    return textItems;
}

/**
 * Extract text nodes from newly added elements
 */
function extractNewTextNodes(addedNodes) {
    const textItems = [];

    for (const node of addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (!isNodeProcessed(node) && isTranslatableText(node.textContent)) {
                const parent = node.parentElement;
                if (parent && !shouldSkipElement(parent)) {
                    textItems.push(...registerTextNode(node));
                }
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Extract text nodes from the added element (already sorted)
            const items = extractTextNodes(node, true);
            textItems.push(...items);
        }
    }

    // Sort by priority (highest first)
    textItems.sort((a, b) => b.priority - a.priority);

    return textItems;
}

function extractSelectionTextNodes(selection) {
    const textItems = [];
    const seenNodes = new Set();

    for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        const ancestor = range.commonAncestorContainer;
        const root = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : ancestor;
        if (!root) continue;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                if (seenNodes.has(node)) return NodeFilter.FILTER_REJECT;
                if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
                const parent = node.parentElement;
                if (!parent || shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
                if (!isTranslatableText(node.textContent)) return NodeFilter.FILTER_REJECT;
                const style = window.getComputedStyle(parent);
                if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        let node;
        while (node = walker.nextNode()) {
            seenNodes.add(node);
            
            // Reuse existing entry if this node was already registered
            let existingNodeId = null;
            let existingEntry = null;
            for (const [nodeId, entry] of textNodeMap) {
                if (entry.node === node) {
                    existingNodeId = nodeId;
                    existingEntry = entry;
                    break;
                }
            }

            const priority = calculatePriority(node);
            if (existingEntry !== null) {
                // Node already registered, extract its translatable segments
                for (const seg of existingEntry.segments) {
                    if (seg.id !== null) {
                        textItems.push({
                            id: seg.id,
                            text: seg.originalText.trim(),
                            priority
                        });
                    }
                }
            } else {
                // New node, register it
                textItems.push(...registerTextNode(node));
            }
        }
    }

    textItems.sort((a, b) => b.priority - a.priority);
    return textItems;
}

// Opens a runtime.connect port that keeps the background service worker alive
// during long translation requests (Firefox MV3 terminates idle service workers).
function startKeepAlive() {
    let port = null;
    let interval = null;
    try {
        port = browserAPI.runtime.connect({ name: 'keepalive' });
        port.onDisconnect.addListener(() => {
            port = null;
            if (interval) { clearInterval(interval); interval = null; }
        });
        interval = setInterval(() => {
            if (port) {
                try { port.postMessage({ type: 'ping' }); }
                catch (e) { clearInterval(interval); interval = null; }
            }
        }, 20000);
    } catch (e) {
        console.warn('[Translator] Could not open keep-alive port:', e.message);
    }
    return function stopKeepAlive() {
        if (interval) clearInterval(interval);
        if (port) { try { port.disconnect(); } catch (e) {} }
    };
}

/**
 * Replace text node content with translation
 */
function replaceTextNode(segmentId, translatedText) {
    const nodeId = segmentToNodeIdMap.get(segmentId);
    if (nodeId === undefined) {
        console.warn(`[Translator] Segment ID ${segmentId} not found in lookup map`);
        return false;
    }

    const entry = textNodeMap.get(nodeId);
    if (!entry) {
        console.warn(`[Translator] Node ID ${nodeId} not found in map`);
        return false;
    }

    const { node, originalText, segments } = entry;
    const segment = segments.find(s => s.id === segmentId);
    if (!segment) {
        console.warn(`[Translator] Segment ${segmentId} not found in node ${nodeId}`);
        return false;
    }

    try {
        const segOriginalText = segment.originalText;
        const leadingSpace = segOriginalText.match(/^\s*/)[0];
        const trailingSpace = segOriginalText.match(/\s*$/)[0];

        // Trim LLM's response to get pure text content first, so we don't end up with doubled spaces
        const trimmedTranslation = (translatedText || '').trim();

        // For spaceless languages (Japanese, Chinese, etc.), add spacing when translating
        // to spaced languages if there was no original spacing
        let effectiveTrailingSpace = trailingSpace;
        if (!effectiveTrailingSpace && trimmedTranslation) {
            // Check if original text looks like a spaceless language (contains CJK characters)
            const hasCJK = /[\u3000-\u9fff\uff00-\uffef]/.test(segOriginalText);
            if (hasCJK) {
                // Always add trailing space for CJK source
                effectiveTrailingSpace = ' ';
            }
        }

        const processedText = leadingSpace + trimmedTranslation + effectiveTrailingSpace;
        segment.translatedText = translatedText;
        segment.processedTranslatedText = processedText;
        segment.translated = true;

        // Reconstruct full node text
        const joinedText = segments.map(s => s.translated && s.processedTranslatedText !== null ? s.processedTranslatedText : s.originalText).join('');
        node.textContent = joinedText;

        // Add blue glow effect to parent element (if enabled)
        const parent = node.parentElement;
        if (parent) {
            if (showGlow) {
                parent.style.textShadow = '0 0 8px #7FBBB3, 0 0 2px #7FBBB3';
            }
            parent.dataset.translated = 'true';
        }

        translatedNodeSet.add(node);
        debugLog(`[Translator] Replaced segment ${segmentId} in node ${nodeId}: "${segOriginalText}" -> "${processedText}"`);
        return true;
    } catch (e) {
        console.error(`[Translator] Failed to replace segment ${segmentId} in node ${nodeId}:`, e);
        return false;
    }
}

/**
 * Restore original text for all translated nodes
 */
function restoreOriginalText() {
    for (const [nodeId, entry] of textNodeMap) {
        let hasAnyTranslated = entry.segments.some(s => s.translated);
        if (hasAnyTranslated) {
            try {
                entry.node.textContent = entry.originalText;
                translatedNodeSet.delete(entry.node);
            } catch (e) {
                // Node may have been removed
            }
        }
    }
    isShowingTranslations = false;
    // Stop auto-translate when restoring
    stopAutoTranslate();
}

/**
 * Restore cached translations (toggle back to translated view)
 */
function restoreCachedTranslations() {
    if (!hasTranslationCache) return false;

    let restoredCount = 0;
    for (const [nodeId, entry] of textNodeMap) {
        let hasAnyTranslated = entry.segments.some(s => s.translated && s.processedTranslatedText !== null);
        if (hasAnyTranslated) {
            try {
                const joinedText = entry.segments.map(s => s.translated && s.processedTranslatedText !== null ? s.processedTranslatedText : s.originalText).join('');
                entry.node.textContent = joinedText;
                translatedNodeSet.add(entry.node);
                restoredCount++;
            } catch (e) {
                // Node may have been removed
            }
        }
    }
    isShowingTranslations = true;
    return restoredCount > 0;
}
