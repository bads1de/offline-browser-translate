(function (root) {
    'use strict';

    const SAFE_TAGS = new Set(['BR', 'DIV', 'P', 'SPAN']);

    function normalize(text) {
        return String(text).replace(/\r\n?/g, '\n');
    }

    // Editors rebuild their DOM from their own model, so a trailing empty
    // paragraph (or a <br> on the last line) shows up as extra whitespace that
    // says nothing about the text itself. Compare the visible text only.
    function comparable(text) {
        return normalize(text).replace(/\s+$/u, '');
    }

    function sameText(actual, expected) {
        return comparable(actual) === comparable(expected);
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

    function makeInputEvent(view, type, text, inputType) {
        const EventType = view.InputEvent || view.Event;
        return new EventType(type, {
            bubbles: true,
            cancelable: type === 'beforeinput',
            inputType: inputType || 'insertReplacementText',
            data: text
        });
    }

    function dispatchInput(field, type, text, inputType) {
        const view = field.ownerDocument && field.ownerDocument.defaultView;
        if (!view || (!view.Event && !view.InputEvent)) return true;
        return field.dispatchEvent(makeInputEvent(view, type, text, inputType));
    }

    function appendText(document, fragment, text) {
        const lines = String(text).split('\n');
        lines.forEach((line, index) => {
            if (line) fragment.appendChild(document.createTextNode(line));
            if (index < lines.length - 1) fragment.appendChild(document.createElement('br'));
        });
    }

    function finish(field, text, snapshot) {
        try {
            const view = field.ownerDocument.defaultView;
            const selection = view && view.getSelection && view.getSelection();
            if (selection) {
                const point = pointAt(field, text.length);
                selection.collapse(point.node, point.offset);
            }
            field.scrollTop = snapshot.scrollTop;
            field.scrollLeft = snapshot.scrollLeft;
        } catch (e) {
            // Caret/scroll restoration is cosmetic; the text already landed.
        }
    }

    function focusField(field) {
        const view = field.ownerDocument && field.ownerDocument.defaultView;
        try {
            if (view && typeof view.focus === 'function') view.focus();
            if (typeof field.focus === 'function' && field.ownerDocument.activeElement !== field) {
                field.focus();
            }
        } catch (e) {
            // Best effort: a field that cannot be focused still gets written.
        }
    }

    function selectAll(field) {
        const document = field.ownerDocument;
        const view = document && document.defaultView;
        const selection = view && view.getSelection && view.getSelection();
        if (!selection || typeof document.createRange !== 'function') return false;
        const range = document.createRange();
        range.selectNodeContents(field);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
    }

    // A framework editor keeps its own model of the caret. A Range built by an
    // extension is invisible to that model, so edits have to be handed to the
    // editor through beforeinput: delete the selection, then insert the text.
    // The editor cancels both events, applies them to its model, and rebuilds
    // the DOM from it, which is what keeps Backspace and typing in sync with
    // the text on screen.
    function beforeInput(field, inputType, data) {
        const view = field.ownerDocument && field.ownerDocument.defaultView;
        if (!view || typeof view.InputEvent !== 'function') return null;
        try {
            // A cancelled event means the editor took over the edit.
            return field.dispatchEvent(new view.InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                inputType,
                data
            })) === false;
        } catch (e) {
            return null;
        }
    }

    function settle(field) {
        const view = field.ownerDocument && field.ownerDocument.defaultView;
        return new Promise(resolve => {
            const done = () => (typeof setTimeout === 'function' ? setTimeout(resolve, 0) : resolve());
            if (view && typeof view.requestAnimationFrame === 'function') view.requestAnimationFrame(done);
            else done();
        });
    }

    // Editors apply their own edits asynchronously, so a synchronous read-back
    // says nothing about whether the edit landed. Wait until the DOM has
    // reported the new text on two consecutive frames.
    const SETTLE_FRAMES = 6;

    async function landed(field, text) {
        let streak = 0;
        for (let i = 0; i < SETTLE_FRAMES; i++) {
            await settle(field);
            streak = sameText(read(field), text) ? streak + 1 : 0;
            if (streak >= 2) return true;
        }
        return false;
    }

    // Selecting in the DOM is not instant for a framework editor: it mirrors the
    // range into its own model from selectionchange, and until that lands the
    // editor still thinks the caret is wherever the user left it. Acting before
    // then makes the editor apply the edit at that stale caret, so the write
    // lands mid-word and the model no longer matches the screen.
    async function selectAllAndSync(field) {
        focusField(field);
        if (!selectAll(field)) return false;
        await settle(field);
        await settle(field);
        return true;
    }

    async function insertViaBeforeInput(field, text) {
        if (!await selectAllAndSync(field)) return false;
        if (beforeInput(field, 'deleteContentBackward', null) !== true) return false;
        beforeInput(field, 'insertText', normalize(text));
        return landed(field, text);
    }

    // Editors differ in which synthetic event they trust: Lexical applies
    // beforeinput but ignores a generated paste's selection, while Draft.js
    // applies a paste against its model selection correctly. A consumed event
    // means the editor took the text into its own model, so the caret and
    // Backspace keep working; when nobody consumes it, the DOM was never
    // touched and the next strategy runs.
    async function insertViaPaste(field, text) {
        const document = field.ownerDocument;
        const view = document && document.defaultView;
        if (!view || typeof view.ClipboardEvent !== 'function'
            || typeof view.DataTransfer !== 'function') return false;
        let data;
        try {
            data = new view.DataTransfer();
        } catch (e) {
            return false;
        }
        if (!data || typeof data.setData !== 'function') return false;

        data.setData('text/plain', normalize(text));
        if (!await selectAllAndSync(field)) return false;
        try {
            field.dispatchEvent(new view.ClipboardEvent('paste', {
                clipboardData: data,
                bubbles: true,
                cancelable: true
            }));
        } catch (e) {
            return false;
        }
        return landed(field, text);
    }

    // Deliberately does not use execCommand: on framework editors it edits the
    // DOM around the model, leaving the model's old selection and text behind.
    // The field then shows one thing while Backspace deletes another.
    async function writeDom(field, text) {
        const document = field.ownerDocument;
        const snapshot = capture(field);
        const nextText = normalize(text);
        if (!dispatchInput(field, 'beforeinput', nextText)) return false;
        const fragment = document.createDocumentFragment();
        appendText(document, fragment, nextText);
        field.replaceChildren(fragment);
        dispatchInput(field, 'input', nextText);
        if (await landed(field, nextText)) return true;
        restoreNodes(field, snapshot);
        dispatchInput(field, 'input', snapshot.text);
        return false;
    }

    async function write(field, text) {
        const nextText = normalize(text);
        if (sameText(read(field), nextText)) return true;
        if (await insertViaBeforeInput(field, nextText)) return true;
        if (await insertViaPaste(field, nextText)) return true;
        return writeDom(field, nextText);
    }

    async function replace(field, text) {
        if (!canReplace(field)) return false;
        const snapshot = capture(field);
        const nextText = normalize(text);
        if (!await write(field, nextText)) return false;
        // The editor may still be inserting its trailing block; place the caret
        // once that has happened, or it ends up in front of the new text and
        // Backspace eats the wrong character.
        await settle(field);
        finish(field, nextText, snapshot);
        return true;
    }

    async function restore(field, snapshot) {
        if (!await write(field, snapshot.text)) return false;
        setSelection(field, snapshot.selection);
        field.scrollTop = snapshot.scrollTop;
        field.scrollLeft = snapshot.scrollLeft;
        return true;
    }

    root.LctComposeContenteditable = { read, capture, canReplace, replace, restore };
})(typeof window !== 'undefined' ? window : globalThis);
