(function (root) {
    'use strict';

    function nativeValueSetter(field) {
        const view = field.ownerDocument && field.ownerDocument.defaultView;
        const prototype = view && view.HTMLTextAreaElement && view.HTMLTextAreaElement.prototype;
        const descriptor = prototype && Object.getOwnPropertyDescriptor(prototype, 'value');
        return descriptor && descriptor.set;
    }

    function dispatchValueEvents(field, view) {
        const EventType = view.Event;
        const InputEventType = view.InputEvent;
        const inputEvent = InputEventType
            ? new InputEventType('input', { bubbles: true, inputType: 'insertText', data: null })
            : new EventType('input', { bubbles: true });
        field.dispatchEvent(inputEvent);
        field.dispatchEvent(new EventType('change', { bubbles: true }));
    }

    function writeValue(field, text, selection, scroll) {
        const view = field.ownerDocument && field.ownerDocument.defaultView;
        const setter = nativeValueSetter(field);
        if (!setter || !view || !view.Event) return false;

        const previousScroll = { top: field.scrollTop, left: field.scrollLeft };
        // React installs an own value property; the prototype setter bypasses its
        // tracker until the input event below asks the framework to resynchronize.
        setter.call(field, String(text));
        dispatchValueEvents(field, view);

        const applied = field.value === String(text);
        if (applied && selection) {
            field.setSelectionRange(selection.start, selection.end);
        }
        field.scrollTop = scroll ? scroll.top : previousScroll.top;
        field.scrollLeft = scroll ? scroll.left : previousScroll.left;
        return applied;
    }

    function read(field) {
        return field.value;
    }

    function capture(field) {
        return {
            text: field.value,
            selectionStart: field.selectionStart,
            selectionEnd: field.selectionEnd,
            scrollTop: field.scrollTop,
            scrollLeft: field.scrollLeft
        };
    }

    function replace(field, text) {
        return writeValue(field, text, { start: text.length, end: text.length });
    }

    function restore(field, snapshot) {
        return writeValue(field, snapshot.text, {
            start: snapshot.selectionStart,
            end: snapshot.selectionEnd
        }, {
            top: snapshot.scrollTop,
            left: snapshot.scrollLeft
        });
    }

    root.LctComposeTextarea = { read, capture, replace, restore };
})(typeof window !== 'undefined' ? window : globalThis);
