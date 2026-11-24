import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'compose', 'contenteditable.js'), 'utf8');

let pass = 0;
let fail = 0;
function check(name, condition, detail) {
    if (condition) {
        pass++;
        console.log('  ok  ' + name);
    } else {
        fail++;
        console.log('FAIL  ' + name);
        if (detail !== undefined) console.log('      ' + String(detail));
    }
}

function createHarness(options = {}) {
    class FakeEvent {
        constructor(type, init = {}) {
            this.type = type;
            this.bubbles = !!init.bubbles;
            this.cancelable = !!init.cancelable;
            this.defaultPrevented = false;
            this.inputType = init.inputType;
            this.data = init.data;
        }
        preventDefault() { this.defaultPrevented = true; }
    }

    class FakeInputEvent extends FakeEvent {}

    class FakeNode {
        constructor(nodeType, tagName = '') {
            this.nodeType = nodeType;
            this.tagName = tagName.toUpperCase();
            this.childNodes = [];
            this.parentNode = null;
            this.handlers = new Map();
            this.attrs = {};
            this.scrollTop = 0;
            this.scrollLeft = 0;
            this.ownerDocument = null;
        }
        appendChild(child) {
            if (child.parentNode) child.parentNode.removeChild(child);
            child.parentNode = this;
            this.childNodes.push(child);
            return child;
        }
        replaceChildren(...children) {
            for (const child of this.childNodes) child.parentNode = null;
            this.childNodes = [];
            for (const child of children) {
                if (child.nodeType === 11) {
                    for (const nested of [...child.childNodes]) this.appendChild(nested);
                } else {
                    this.appendChild(child);
                }
            }
        }
        removeChild(child) {
            const at = this.childNodes.indexOf(child);
            if (at >= 0) this.childNodes.splice(at, 1);
            child.parentNode = null;
        }
        contains(other) {
            if (other === this) return true;
            return this.childNodes.some(child => child.contains(other));
        }
        cloneNode(deep = false) {
            const copy = this.nodeType === 3
                ? new FakeText(this.data)
                : new FakeNode(this.nodeType, this.tagName);
            copy.attrs = { ...this.attrs };
            if (deep) copy.childNodes = this.childNodes.map(child => child.cloneNode(true));
            for (const child of copy.childNodes) child.parentNode = copy;
            return copy;
        }
        addEventListener(type, handler) {
            if (!this.handlers.has(type)) this.handlers.set(type, new Set());
            this.handlers.get(type).add(handler);
        }
        dispatchEvent(event) {
            for (const handler of this.handlers.get(event.type) || []) handler(event);
            this.events.push(event);
            return !event.defaultPrevented;
        }
        getRootNode() { return options.shadowRoot || document; }
    }

    class FakeText extends FakeNode {
        constructor(data) {
            super(3);
            this.data = String(data);
        }
        get textContent() { return this.data; }
    }

    function textOf(node) {
        if (node.nodeType === 3) return node.data;
        if (node.tagName === 'BR') return '\n';
        return node.childNodes.map(textOf).join('');
    }

    const document = {
        defaultView: null,
        createElement(tag) { return new FakeNode(1, tag); },
        createTextNode(text) { return new FakeText(text); },
        createDocumentFragment() { return new FakeNode(11); },
        execCommand: options.execCommand === false ? undefined : (command, ui, value) => {
            calls.exec.push([command, ui, value]);
            if (options.execCommandResult === false) return false;
            field.replaceChildren(document.createTextNode(value));
            selection.collapse(field.childNodes[0], value.length);
            return true;
        }
    };

    const selection = {
        anchorNode: null,
        anchorOffset: 0,
        focusNode: null,
        focusOffset: 0,
        rangeCount: 0,
        removeAllRanges() {
            this.anchorNode = null;
            this.focusNode = null;
            this.rangeCount = 0;
        },
        addRange(range) {
            this.anchorNode = range.startContainer;
            this.anchorOffset = range.startOffset;
            this.focusNode = range.endContainer;
            this.focusOffset = range.endOffset;
            this.rangeCount = 1;
        },
        collapse(node, offset) {
            this.anchorNode = node;
            this.anchorOffset = offset;
            this.focusNode = node;
            this.focusOffset = offset;
            this.rangeCount = 1;
        }
    };

    document.createRange = () => {
        const range = {
            startContainer: field,
            startOffset: 0,
            endContainer: field,
            endOffset: field.childNodes.length,
            selectNodeContents(root) {
                this.startContainer = root;
                this.startOffset = 0;
                this.endContainer = root;
                this.endOffset = root.childNodes.length;
            },
            setStart(container, offset) {
                this.startContainer = container;
                this.startOffset = offset;
            },
            setEnd(container, offset) {
                this.endContainer = container;
                this.endOffset = offset;
            },
            toString() {
                if (this.startContainer === field && this.endContainer === field) {
                    return field.childNodes.slice(0, this.endOffset).map(textOf).join('');
                }
                if (this.endContainer.nodeType === 3) {
                    return this.endContainer.data.slice(0, this.endOffset);
                }
                return textOf(this.endContainer).slice(0, this.endOffset);
            }
        };
        return range;
    };

    const view = {
        Event: FakeEvent,
        InputEvent: FakeInputEvent,
        NodeFilter: { SHOW_TEXT: 4, SHOW_ELEMENT: 1 },
        getSelection: () => selection,
        requestAnimationFrame: callback => setTimeout(callback, 0)
    };
    document.defaultView = view;

    const field = document.createElement('div');
    field.ownerDocument = document;
    field.isContentEditable = true;
    field.isConnected = true;
    field.events = [];
    field.setAttribute = (name, value) => { field.attrs[name] = String(value); };
    field.getAttribute = name => field.attrs[name] === undefined ? null : field.attrs[name];
    Object.defineProperty(field, 'innerText', {
        get: () => textOf(field),
        set: value => field.replaceChildren(document.createTextNode(value))
    });
    Object.defineProperty(field, 'textContent', {
        get: () => field.childNodes.map(child => child.nodeType === 3 ? child.data : child.textContent).join(''),
        set: value => field.replaceChildren(document.createTextNode(value))
    });

    const calls = { exec: [] };
    const context = vm.createContext({ window: {}, document });
    vm.runInContext(source, context);
    const adapter = context.window.LctComposeContenteditable;

    function setText(text) {
        field.replaceChildren(document.createTextNode(text));
        selection.collapse(field.childNodes[0], text.length);
    }

    setText(options.text || '日本語の下書き');
    field.scrollTop = options.scrollTop ?? 12;
    field.scrollLeft = options.scrollLeft ?? 7;
    return { adapter, document, view, field, selection, calls, setText, FakeEvent };
}

{
    const h = createHarness({ text: 'first\nsecond' });
    check('adapter is exported', !!h.adapter);
    check('plain contenteditable can be replaced', h.adapter.canReplace(h.field) === true);
    const children = h.field.childNodes;
    h.field.childNodes = {
        length: children.length,
        forEach(callback) { children.forEach(callback); },
        [Symbol.iterator]: () => children[Symbol.iterator]()
    };
    Object.defineProperty(h.field.childNodes, '0', { value: children[0] });
    check('DOM NodeList child collections are supported', h.adapter.canReplace(h.field) === true);
    h.field.childNodes = children;
    check('read preserves line breaks', h.adapter.read(h.field) === 'first\nsecond');

    const br = h.document.createElement('br');
    h.field.replaceChildren(h.document.createTextNode('first'), br, h.document.createTextNode('second'));
    check('text plus br can be replaced', h.adapter.canReplace(h.field) === true);
    check('read preserves br as a newline', h.adapter.read(h.field) === 'first\nsecond');

    for (const tag of ['div', 'p', 'span']) {
        const wrapper = h.document.createElement(tag);
        wrapper.appendChild(h.document.createTextNode('plain text'));
        h.field.replaceChildren(wrapper);
        check(`${tag} text wrapper is supported`, h.adapter.canReplace(h.field) === true);
    }

    for (const tag of ['strong', 'img', 'a']) {
        const wrapper = h.document.createElement(tag);
        wrapper.appendChild(h.document.createTextNode('formatted text'));
        h.field.replaceChildren(wrapper);
        check(`${tag} rich content is rejected`, h.adapter.canReplace(h.field) === false);
    }

    const styled = h.document.createElement('span');
    styled.attrs.style = 'font-weight: bold';
    styled.appendChild(h.document.createTextNode('styled text'));
    h.field.replaceChildren(styled);
    check('styled rich content is rejected', h.adapter.canReplace(h.field) === false);

    h.field.isContentEditable = false;
    check('non-editable content is rejected', h.adapter.canReplace(h.field) === false);
}

{
    const h = createHarness({ shadowRoot: {} });
    check('shadow-root content is rejected', h.adapter.canReplace(h.field) === false);
}

async function run() {
{
    const h = createHarness({ text: '日本語の下書き' });
    h.selection.collapse(h.field.childNodes[0], 3);
    const snapshot = h.adapter.capture(h.field);
    check('capture stores text and selection', snapshot.text === '日本語の下書き'
        && snapshot.selection.start === 3 && snapshot.selection.end === 3, snapshot.selection);

    const replaced = await h.adapter.replace(h.field, 'English draft');
    check('direct text replacement updates the draft', replaced === true
        && h.adapter.read(h.field) === 'English draft');
    check('replacement keeps the field editable', h.field.isContentEditable === true);
    check('replacement preserves scroll position', h.field.scrollTop === 12 && h.field.scrollLeft === 7);
    check('replacement moves the caret to the end', h.selection.anchorOffset === 'English draft'.length);

    const restored = await h.adapter.restore(h.field, snapshot);
    check('restore recovers the original draft', restored === true
        && h.adapter.read(h.field) === '日本語の下書き');
    check('restore recovers the original selection', h.selection.anchorOffset === 3
        && h.selection.focusOffset === 3);
    check('restore recovers scroll position', h.field.scrollTop === 12 && h.field.scrollLeft === 7);
}

{
    const h = createHarness({ execCommand: false, text: 'original' });
    const replaced = await h.adapter.replace(h.field, '<script>alert(1)</script>\nsecond');
    check('direct replacement handles multiline text', replaced === true);
    check('direct replacement keeps model output as text', h.field.childNodes[0]?.nodeType === 3
        && h.adapter.read(h.field) === '<script>alert(1)</script>\nsecond');
    check('direct replacement preserves newlines with br nodes', h.field.childNodes.some(node => node.tagName === 'BR'));
    const tail = h.field.events.slice(-2).map(event => event.type).join(',');
    check('direct replacement ends with beforeinput then input', tail === 'beforeinput,input'
        && h.field.events.every(event => event.bubbles), h.field.events.map(event => event.type));
}

// A framework editor owns the caret and cancels beforeinput. The adapter must
// hand the edit to it (delete the selection, then insert) and read the result
// only after the editor has flushed its model.
{
    const h = createHarness({ execCommand: false, text: 'original' });
    h.field.addEventListener('beforeinput', event => {
        event.preventDefault();
        if (event.inputType === 'deleteContentBackward') h.setText('');
        if (event.inputType === 'insertText') h.setText(event.data);
    });
    const replaced = await h.adapter.replace(h.field, 'translation');
    check('framework editor receives delete then insert', replaced === true
        && h.adapter.read(h.field) === 'translation', h.adapter.read(h.field));
    check('framework path does not fall back to DOM writes',
        h.field.events.filter(event => event.type === 'input').length === 0,
        h.field.events.map(event => event.type + ':' + event.inputType));
    check('framework path avoids deprecated editing commands', h.calls.exec.length === 0);
}

{
    const h = createHarness({ execCommand: false, text: 'original' });
    h.field.addEventListener('beforeinput', event => event.preventDefault());
    check('cancelled beforeinput prevents replacement', await h.adapter.replace(h.field, 'translation') === false);
    check('cancelled replacement preserves the draft', h.adapter.read(h.field) === 'original');
}

// Draft.js-style editor: it cancels every beforeinput but only acts on paste,
// which is where a real user insert lands. The adapter must fall through to it.
{
    const h = createHarness({ execCommand: false, text: 'original' });
    h.view.ClipboardEvent = class extends h.FakeEvent {
        constructor(type, init = {}) {
            super(type, init);
            this.clipboardData = init.clipboardData;
        }
    };
    h.view.DataTransfer = class {
        constructor() { this.data = {}; }
        setData(kind, value) { this.data[kind] = value; }
        getData(kind) { return this.data[kind] || ''; }
    };
    h.field.addEventListener('beforeinput', event => event.preventDefault());
    h.field.addEventListener('paste', event => {
        h.setText(event.clipboardData.getData('text/plain'));
        event.preventDefault();
    });
    const replaced = await h.adapter.replace(h.field, 'translation');
    check('editor that only accepts paste still gets the text', replaced === true
        && h.adapter.read(h.field) === 'translation', h.adapter.read(h.field));
    check('paste path writes no raw DOM', h.field.events.filter(event => event.type === 'input').length === 0,
        h.field.events.map(event => event.type));
}

{
    const h = createHarness({ execCommand: false, text: 'original' });
    h.field.addEventListener('input', () => h.setText('original'));
    check('site rejection reports replacement failure', await h.adapter.replace(h.field, 'translation') === false);
    check('site rejection preserves the original draft', h.adapter.read(h.field) === 'original');
}

{
    const h = createHarness({ text: 'original' });
    const strong = h.document.createElement('strong');
    strong.appendChild(h.document.createTextNode('formatted'));
    h.field.replaceChildren(strong);
    check('rich text is not destructively replaced', await h.adapter.replace(h.field, 'translation') === false);
    check('rich text remains unchanged', h.field.childNodes[0] === strong);
}

{
    // Editors add their own trailing block/br; the comparison must ignore it.
    const h = createHarness({ execCommand: false, text: 'original' });
    h.field.addEventListener('input', () => h.setText('translation\n'));
    check('trailing editor whitespace still counts as replaced',
        await h.adapter.replace(h.field, 'translation') === true);
}

}

run().then(() => {
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
}).catch(error => {
    console.error(error);
    process.exit(1);
});
