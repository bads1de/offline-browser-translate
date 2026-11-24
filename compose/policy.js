(function (root) {
    'use strict';

    const MAX_CHARS = 3000;
    const SENSITIVE_AUTOCOMPLETE = new Set([
        'password',
        'current-password',
        'new-password',
        'one-time-code',
        'name',
        'email',
        'tel',
        'tel-national',
        'address-line1',
        'address-line2',
        'address-level1',
        'address-level2',
        'postal-code',
        'country',
        'cc-name',
        'cc-number',
        'cc-csc',
        'cc-exp',
        'cc-exp-month',
        'cc-exp-year'
    ]);
    const SENSITIVE_LABEL = /(?:password|passwd|passcode|one[\s_-]?time|\botp\b|2fa|credit[\s_-]?card|card[\s_-]?number|cvv|security[\s_-]?code)/i;

    function kindOf(element, options) {
        if (!element || !element.tagName) return null;
        const tag = element.tagName.toUpperCase();
        if (tag === 'TEXTAREA') return 'textarea';
        if (tag === 'INPUT' || tag === 'SELECT') return null;
        if (options.allowContentEditable && element.isContentEditable) return 'contenteditable';
        return null;
    }

    function read(element) {
        if (element.tagName.toUpperCase() === 'TEXTAREA') {
            return typeof element.value === 'string' ? element.value : '';
        }
        if (typeof element.innerText === 'string' && element.innerText) return element.innerText;
        return typeof element.textContent === 'string' ? element.textContent : '';
    }

    function isSensitive(element) {
        const autocomplete = String(element.getAttribute?.('autocomplete') || '').toLowerCase().split(/\s+/);
        if (autocomplete.some(token => SENSITIVE_AUTOCOMPLETE.has(token))) return true;
        const label = [
            element.getAttribute?.('aria-label'),
            element.getAttribute?.('name'),
            element.name,
            element.id,
            element.getAttribute?.('placeholder')
        ].filter(Boolean).join(' ');
        return SENSITIVE_LABEL.test(label);
    }

    function isIgnored(element) {
        let current = element;
        while (current) {
            if (current.getAttribute?.('translate') === 'no') return true;
            const ignored = current.getAttribute?.('data-llm-translator-ignore');
            if (ignored !== null && ignored !== undefined) return true;
            if (current.id === 'llm-translator-float-btn' || current.id === 'llm-translator-status') return true;
            current = current.parentElement;
        }
        return false;
    }

    function isInvisible(element) {
        if (element.hidden || element.disabled || element.readOnly) return true;
        if (element.getAttribute?.('aria-hidden') === 'true') return true;
        const style = element.style || {};
        if (style.display === 'none' || style.visibility === 'hidden') return true;

        const view = element.ownerDocument && element.ownerDocument.defaultView;
        if (view && typeof view.getComputedStyle === 'function') {
            const computed = view.getComputedStyle(element);
            if (computed.display === 'none' || computed.visibility === 'hidden') return true;
        }
        if (typeof element.getClientRects === 'function' && element.getClientRects().length === 0) {
            return true;
        }
        return false;
    }

    function codePointLength(text) {
        let length = 0;
        for (const _ of text) {
            length++;
            if (length > MAX_CHARS) break;
        }
        return length;
    }

    function inspect(element, options = {}) {
        const kind = kindOf(element, options);
        if (!kind) return { ok: false, reason: 'unsupported', kind: null, text: '' };
        if (kind === 'contenteditable' && typeof element.getRootNode === 'function'
            && element.getRootNode() !== element.ownerDocument) {
            return { ok: false, reason: 'unsupported', kind, text: '' };
        }
        if (isSensitive(element)) return { ok: false, reason: 'sensitive', kind, text: '' };
        if (isIgnored(element)) return { ok: false, reason: 'ignored', kind, text: '' };
        if (isInvisible(element)) return { ok: false, reason: 'invisible', kind, text: '' };

        const text = read(element);
        if (!text.trim() || !/\p{L}/u.test(text)) {
            return { ok: false, reason: 'empty', kind, text: '' };
        }
        if (codePointLength(text) > MAX_CHARS) {
            return { ok: false, reason: 'too-long', kind, text: '' };
        }
        if (options.sourceLanguage && options.sourceLanguage !== 'auto'
            && options.sourceLanguage === options.targetLanguage) {
            return { ok: false, reason: 'same-language', kind, text: '' };
        }
        return { ok: true, reason: null, kind, text };
    }

    root.LctComposePolicy = { MAX_CHARS, kindOf, read, inspect };
})(typeof window !== 'undefined' ? window : globalThis);
