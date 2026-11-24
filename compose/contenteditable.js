(function (root) {
    'use strict';

    const SAFE_TAGS = new Set(['BR', 'DIV', 'P', 'SPAN']);

    function normalize(text) {
        return String(text).replace(/\r\n?/g, '\n');
    }

    function read(field) {
        const text = typeof field.innerText === 'string' ? field.innerText : field.textContent;
        return normalize(text || '');
    }

    function canReplace(field) {
        if (!field || !field.isContentEditable) return false;
        const document = field.ownerDocument;
        if (!document) return false;
        if (typeof field.getRootNode === 'function' && field.getRootNode() !== document) return false;

        function safe(node) {
            if (node.nodeType === 3) return true;
            if (node.nodeType !== 1 || !SAFE_TAGS.has(node.tagName)) return false;
            if (node.attrs?.contenteditable === 'false'
                || node.getAttribute?.('contenteditable') === 'false') return false;
            if (node.attrs?.style || node.getAttribute?.('style')) return false;
            return Array.from(node.childNodes).every(safe);
        }

        return Array.from(field.childNodes).every(safe);
    }

    function selectionOffsets(field) {
        const document = field.ownerDocument;
        const view = document && document.defaultView;
        const selection = view && view.getSelection && view.getSelection();
        if (!selection || !selection.rangeCount || !document.createRange) return null;
        if (!field.contains(selection.anchorNode) || !field.contains(selection.focusNode)) return null;

        const range = document.createRange();
        range.selectNodeContents(field);
        range.setEnd(selection.anchorNode, selection.anchorOffset);
        const anchor = normalize(range.toString()).length;
        range.setEnd(selection.focusNode, selection.focusOffset);
        const focus = normalize(range.toString()).length;
        return { start: Math.min(anchor, focus), end: Math.max(anchor, focus) };
    }

    function pointAt(field, offset) {
        let remaining = Math.max(0, offset);

        function visit(parent) {
            for (let index = 0; index < parent.childNodes.length; index++) {
                const node = parent.childNodes[index];
                if (node.nodeType === 3) {
                    if (remaining <= node.data.length) return { node, offset: remaining };
                    remaining -= node.data.length;
                } else if (node.tagName === 'BR') {
                    if (remaining <= 1) return { node: parent, offset: index + 1 };
                    remaining--;
                } else {
                    const point = visit(node);
                    if (point) return point;
                }
            }
            return null;
        }

        return visit(field) || { node: field, offset: field.childNodes.length };
    }

    function setSelection(field, selection) {
        const document = field.ownerDocument;
        const view = document && document.defaultView;
        const current = view && view.getSelection && view.getSelection();
        if (!selection || !current || !document.createRange) return;
        const start = pointAt(field, selection.start);
        const end = pointAt(field, selection.end);
        const range = document.createRange();
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        current.removeAllRanges();
        current.addRange(range);
    }

    function capture(field) {
        return {
            text: read(field),
            selection: selectionOffsets(field),
            scrollTop: field.scrollTop,
            scrollLeft: field.scrollLeft,
            childNodes: [...field.childNodes].map(node => node.cloneNode(true))
        };
    }

    function restoreNodes(field, snapshot) {
        const children = snapshot.childNodes.map(node => node.cloneNode(true));
        field.replaceChildren(...children);
    }

    function makeInputEvent(view, type, text) {
        const EventType = view.InputEvent || view.Event;
        return new EventType(type, {
            bubbles: true,
            cancelable: type === 'beforeinput',
            inputType: 'insertReplacementText',
            data: text
        });
    }

    function dispatchInput(field, type, text) {
        const view = field.ownerDocument && field.ownerDocument.defaultView;
        if (!view || (!view.Event && !view.InputEvent)) return true;
        return field.dispatchEvent(makeInputEvent(view, type, text));
    }

    function appendText(document, fragment, text) {
        const lines = String(text).split('\n');
        lines.forEach((line, index) => {
            if (line) fragment.appendChild(document.createTextNode(line));
            if (index < lines.length - 1) fragment.appendChild(document.createElement('br'));
        });
    }

    function finish(field, text, snapshot) {
        const view = field.ownerDocument.defaultView;
        const selection = view.getSelection();
        if (selection) {
            const point = pointAt(field, text.length);
            selection.collapse(point.node, point.offset);
        }
        field.scrollTop = snapshot.scrollTop;
        field.scrollLeft = snapshot.scrollLeft;
    }

    function replace(field, text) {
        if (!canReplace(field)) return false;
        const document = field.ownerDocument;
        const snapshot = capture(field);
        const nextText = normalize(text);

        if (!dispatchInput(field, 'beforeinput', nextText)) return false;
        const fragment = document.createDocumentFragment();
        appendText(document, fragment, nextText);
        field.replaceChildren(fragment);
        dispatchInput(field, 'input', nextText);

        if (read(field) === nextText) {
            finish(field, nextText, snapshot);
            return true;
        }
        restoreNodes(field, snapshot);
        dispatchInput(field, 'input', snapshot.text);
        return false;
    }

    function restore(field, snapshot) {
        const current = capture(field);
        if (!dispatchInput(field, 'beforeinput', snapshot.text)) return false;
        restoreNodes(field, snapshot);
        dispatchInput(field, 'input', snapshot.text);
        if (read(field) !== snapshot.text) {
            restoreNodes(field, current);
            dispatchInput(field, 'input', current.text);
            return false;
        }
        setSelection(field, snapshot.selection);
        field.scrollTop = snapshot.scrollTop;
        field.scrollLeft = snapshot.scrollLeft;
        return true;
    }

    root.LctComposeContenteditable = { read, capture, canReplace, replace, restore };
})(typeof window !== 'undefined' ? window : globalThis);
