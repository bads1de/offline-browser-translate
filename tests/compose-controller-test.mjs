import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..');
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');

let pass = 0;
let fail = 0;
function check(name, condition, detail) {
    if (condition) {
        pass++;
        console.log('  ok  ' + name);
    } else {
        fail++;
        console.log('FAIL  ' + name);
        if (detail !== undefined) console.log('      ' + JSON.stringify(detail));
    }
}

class FakeEvent {
    constructor(type, options = {}) {
        this.type = type;
        this.bubbles = !!options.bubbles;
        this.defaultPrevented = false;
        this.cancelable = !!options.cancelable;
        this.inputType = options.inputType;
        this.data = options.data;
    }
    preventDefault() { this.defaultPrevented = true; }
}

class FakeInputEvent extends FakeEvent {}

class FakeComposeNode {
    constructor(nodeType, tagName, document) {
        this.nodeType = nodeType;
        this.tagName = tagName.toUpperCase();
        this.ownerDocument = document;
        this.parentNode = null;
        this.childNodes = [];
        this.handlers = new Map();
        this.events = [];
        this.attrs = {};
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
        const index = this.childNodes.indexOf(child);
        if (index >= 0) this.childNodes.splice(index, 1);
        child.parentNode = null;
    }
    contains(other) {
        return other === this || this.childNodes.some(child => child.contains(other));
    }
    cloneNode(deep = false) {
        const copy = this.nodeType === 3
            ? new FakeComposeText(this.data, this.ownerDocument)
            : new FakeComposeNode(this.nodeType, this.tagName, this.ownerDocument);
        copy.attrs = { ...this.attrs };
        if (deep) {
            for (const child of this.childNodes) copy.appendChild(child.cloneNode(true));
        }
        return copy;
    }
    addEventListener(type, handler) {
        if (!this.handlers.has(type)) this.handlers.set(type, new Set());
        this.handlers.get(type).add(handler);
    }
    dispatchEvent(event) {
        for (const handler of this.handlers.get(event.type) || []) handler(event);
        this.events.push(event);
        this.ownerDocument.dispatch(event.type, this, event);
        return !event.defaultPrevented;
    }
    get textContent() {
        return this.childNodes.map(child => child.nodeType === 3 ? child.data : child.textContent).join('');
    }
    set textContent(value) {
        this.replaceChildren(this.ownerDocument.createTextNode(value));
    }
    get innerText() {
        return this.childNodes.map(child => child.nodeType === 3
            ? child.data : child.tagName === 'BR' ? '\n' : child.innerText).join('');
    }
    set innerText(value) {
        this.replaceChildren(this.ownerDocument.createTextNode(value));
    }
}

class FakeComposeText extends FakeComposeNode {
    constructor(data, document) {
        super(3, '', document);
        this.data = String(data);
    }
    get textContent() { return this.data; }
    get innerText() { return this.data; }
}

function createHarness(overrides = {}) {
    const listeners = new Map();
    const document = {
        activeElement: null,
        defaultView: { Event: FakeEvent, InputEvent: FakeInputEvent },
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(handler);
        },
        removeEventListener(type, handler) {
            listeners.get(type)?.delete(handler);
        },
        dispatch(type, target, options = {}) {
            const event = new FakeEvent(type, options);
            event.target = target;
            for (const handler of listeners.get(type) || []) handler(event);
            return event;
        },
        contains(element) {
            return !!element && element.isConnected !== false;
        },
        createElement(tag) { return new FakeComposeNode(1, tag, document); },
        createTextNode(text) { return new FakeComposeText(text, document); },
        createDocumentFragment() { return new FakeComposeNode(11, '', document); }
    };

    class FakeTextarea {}
    Object.defineProperty(FakeTextarea.prototype, 'value', {
        configurable: true,
        get() { return this._value || ''; },
        set(value) { this._value = String(value); }
    });

    function makeField(value = '日本語の下書き', attrs = {}) {
        const field = new FakeTextarea();
        field._value = value;
        field.tagName = 'TEXTAREA';
        field.ownerDocument = {
            defaultView: { HTMLTextAreaElement: FakeTextarea, Event: FakeEvent, InputEvent: FakeInputEvent }
        };
        field.parentElement = null;
        field.style = {};
        field.hidden = false;
        field.disabled = false;
        field.readOnly = false;
        field.isContentEditable = false;
        field.isConnected = true;
        field.id = '';
        field.name = '';
        field.selectionStart = 0;
        field.selectionEnd = 0;
        field.scrollTop = 0;
        field.scrollLeft = 0;
        field.attrs = { ...attrs };
        field.reactValue = value;
        field.events = [];
        field.getAttribute = name => field.attrs[name] === undefined ? null : field.attrs[name];
        field.getClientRects = () => [{}];
        field.setSelectionRange = (start, end) => {
            field.selectionStart = start;
            field.selectionEnd = end;
        };
        Object.defineProperty(field, 'value', {
            configurable: true,
            get() { return field._value || ''; },
            set(value) {
                field._value = String(value);
                field.reactValue = field._value;
            }
        });
        field.dispatchEvent = (event) => {
            field.events.push(event);
            if (event.type === 'input') {
                field.reactValue = field.value;
                document.dispatch('input', field, event);
            }
            return true;
        };
        field.focus = () => {
            document.activeElement = field;
            document.dispatch('focusin', field);
        };
        return field;
    }

    const uiCalls = [];
    const ui = {
        showTrigger(field, options) { uiCalls.push(['trigger', field, options]); },
        hideTrigger() { uiCalls.push(['hideTrigger']); },
        showLoading(field, options) { uiCalls.push(['loading', field, options]); },
        showPreview(field, options) { uiCalls.push(['preview', field, options]); },
        showReplaced(field, options) { uiCalls.push(['replaced', field, options]); },
        showError(field, options) { uiCalls.push(['error', field, options]); },
        hidePanel() { uiCalls.push(['hidePanel']); },
        hideAll() { uiCalls.push(['hideAll']); },
        contains() { return false; },
        destroy() { uiCalls.push(['destroy']); }
    };

    const pending = [];
    const clipboard = [];
    const send = (message) => new Promise((resolve, reject) => {
        pending.push({ message, resolve, reject });
    });

    function makeRealEditable(value) {
        const field = document.createElement('div');
        Object.assign(field, {
            parentElement: null,
            style: {},
            hidden: false,
            disabled: false,
            readOnly: false,
            isContentEditable: true,
            isConnected: true,
            id: '',
            name: '',
            scrollTop: 0,
            scrollLeft: 0,
            getClientRects: () => [{}]
        });
        field.getAttribute = name => field.attrs[name] === undefined ? null : field.attrs[name];
        field.innerText = value;
        field.addEventListener('input', event => {
            if (event.data === 'English reply') field.innerText = value;
        });
        field.focus = () => {
            document.activeElement = field;
            document.dispatch('focusin', field);
        };
        return field;
    }

    function makeEditable(value = '日本語の返信') {
        if (overrides.realContentEditable) return makeRealEditable(value);
        const field = {
            tagName: 'DIV',
            ownerDocument: { defaultView: {} },
            parentElement: null,
            style: {},
            hidden: false,
            disabled: false,
            readOnly: false,
            isContentEditable: true,
            isConnected: true,
            innerText: value,
            textContent: value,
            id: '',
            name: '',
            scrollTop: 0,
            scrollLeft: 0,
            attrs: {},
            getAttribute: name => field.attrs[name] === undefined ? null : field.attrs[name],
            getClientRects: () => [{}],
            dispatchEvent(event) {
                if (event.type === 'input') document.dispatch('input', field, event);
                return true;
            },
            focus() {
                document.activeElement = field;
                document.dispatch('focusin', field);
            }
        };
        return field;
    }

    const context = vm.createContext({
        setTimeout,
        clearTimeout,
        Map,
        Set,
        Intl,
        navigator: {
            language: 'ja',
            clipboard: { writeText: async text => { clipboard.push(text); } }
        }
    });
    for (const rel of ['compose/policy.js', 'compose/session.js', 'compose/textarea.js', 'compose/contenteditable.js', 'compose/controller.js']) {
        vm.runInContext(read(rel), context);
    }

    const contenteditable = overrides.contenteditable
        || (overrides.realContentEditable ? context.LctComposeContenteditable : {
            read: field => field.innerText,
            capture: field => ({ text: field.innerText }),
            canReplace: () => true,
            replace(field, text) {
                field.innerText = text;
                field.dispatchEvent(new FakeEvent('input', { bubbles: true }));
                return true;
            },
            restore(field, snapshot) {
                field.innerText = snapshot.text;
                field.dispatchEvent(new FakeEvent('input', { bubbles: true }));
                return true;
            }
        });

    const settings = {
        composeTranslationEnabled: true,
        composeSourceLanguage: 'auto',
        composeTargetLanguage: 'en',
        ...overrides.settings
    };
    const controller = context.LctComposeController.create({
        document,
        ui,
        send,
        settings,
        contenteditable,
        defer: fn => fn(),
        allowContentEditable: !!overrides.allowContentEditable
    });
    controller.start();

    return {
        controller,
        document,
        field: makeField,
        editable: makeEditable,
        uiCalls,
        pending,
        clipboard,
        settings,
        lastCall: name => [...uiCalls].reverse().find(call => call[0] === name)
    };
}

async function run() {
{
    const h = createHarness();
    const field = h.field();
    field.focus();
    check('focusing an eligible textarea shows the trigger', !!h.lastCall('trigger'));
    check('trigger offers English translation', h.lastCall('trigger')[2].targetLanguage === 'en');

    h.controller.translate();
    check('translate sends one item through TRANSLATE', h.pending.length === 1
        && h.pending[0].message.type === 'TRANSLATE'
        && h.pending[0].message.texts.length === 1
        && h.pending[0].message.texts[0].text === '日本語の下書き', h.pending[0]?.message);
    check('compose translation disables partial broadcasts', h.pending[0].message.silentPartials === true);
    check('compose uses its own language settings', h.pending[0].message.sourceLanguage === 'auto'
        && h.pending[0].message.targetLanguage === 'en');
    check('draft is unchanged while translation is pending', field.value === '日本語の下書き');
    check('pending translation shows loading UI', !!h.lastCall('loading'));

    h.pending[0].resolve({ translations: [{ id: 1, text: 'Japanese draft' }] });
    await new Promise(resolve => setImmediate(resolve)).then(() => {
        check('completed translation opens preview', h.lastCall('preview')?.[2].translation === 'Japanese draft');
        check('completed translation releases the busy trigger', h.lastCall('trigger')?.[2].busy === false);
        check('preview does not modify the draft', field.value === '日本語の下書き');

        const replaced = h.controller.replace();
        check('replace succeeds', replaced.ok === true, replaced);
        check('replace updates textarea and React-like state', field.value === 'Japanese draft'
            && field.reactValue === 'Japanese draft', [field.value, field.reactValue]);
        check('replace shows undo UI', h.lastCall('replaced')?.[2].canUndo === true);

        const undone = h.controller.undo();
        check('undo succeeds', undone.ok === true, undone);
        check('undo restores the Japanese draft', field.value === '日本語の下書き'
            && field.reactValue === '日本語の下書き', [field.value, field.reactValue]);
    });
}

{
    const h = createHarness();
    const field = h.field();
    field.focus();
    h.controller.translate();
    field.value = '編集した下書き';
    h.document.dispatch('input', field);
    h.pending[0].resolve({ translations: [{ id: 1, text: 'stale translation' }] });
    await new Promise(resolve => setImmediate(resolve)).then(() => {
        check('editing invalidates an in-flight translation', h.controller.status().state === 'idle');
        check('stale translation never reaches preview UI', !h.uiCalls.some(call => call[0] === 'preview'));
        check('stale translation never changes the draft', field.value === '編集した下書き');
    });
}

{
    const h = createHarness();
    const field = h.field();
    field.focus();
    h.controller.translate();
    h.pending[0].reject(new Error('LLM offline'));
    await new Promise(resolve => setImmediate(resolve)).then(() => {
        check('translation failure keeps the original draft', field.value === '日本語の下書き');
        check('translation failure shows an error', h.lastCall('error')?.[2].message === 'LLM offline');
    });
}

{
    const h = createHarness();
    const field = h.field();
    field.focus();
    h.controller.translate();
    h.pending[0].resolve({ translations: [{ id: 1, text: 'translation' }] });
    await new Promise(resolve => setImmediate(resolve)).then(() => {
        h.controller.replace();
        field.value = 'translation edited';
        h.document.dispatch('input', field);
        const undone = h.controller.undo();
        check('undo is rejected after further edits', undone.ok === false, undone);
        check('edited draft is not overwritten', field.value === 'translation edited');
    });
}

{
    const h = createHarness();
    const field = h.field();
    field.focus();
    h.controller.translate();
    h.document.dispatch('compositionstart', field);
    check('composition start disables the trigger', h.lastCall('trigger')?.[2].disabled === true);
    h.pending[0].resolve({ translations: [{ id: 1, text: 'stale translation' }] });
    await new Promise(resolve => setImmediate(resolve)).then(async () => {
        check('composition start invalidates translation', h.controller.status().state === 'idle');
        check('composition start does not show stale preview', !h.uiCalls.some(call => call[0] === 'preview'));
        check('composition start blocks programmatic translation',
            (await h.controller.translate()).reason === 'composing');
        check('composition start sends no request', h.pending.length === 1);
        h.document.dispatch('compositionend', field);
        check('composition end restores the trigger', !!h.lastCall('trigger'));
    });
}

{
    const h = createHarness();
    const field = h.field('secret', { autocomplete: 'one-time-code' });
    field.focus();
    check('sensitive field never shows a trigger', !h.uiCalls.some(call => call[0] === 'trigger'));
    check('sensitive field cannot be translated', (await h.controller.translate()).ok === false);
    check('sensitive field sends nothing', h.pending.length === 0);
}

{
    const h = createHarness();
    const field = h.field();
    field.focus();
    h.controller.translate();
    h.controller.configure({ ...h.settings, composeTranslationEnabled: false });
    h.pending[0].resolve({ translations: [{ id: 1, text: 'late result' }] });
    await new Promise(resolve => setImmediate(resolve)).then(() => {
        check('disabling the feature invalidates pending work', h.controller.status().state === 'idle');
        check('disabled feature applies no late result', !h.uiCalls.some(call => call[0] === 'preview'));
        check('disabled feature hides its UI', !!h.lastCall('hideAll'));
    });
}

{
    const h = createHarness();
    const field = h.field();
    field.focus();
    h.controller.translate();
    h.controller.configure({ ...h.settings, composeTranslationEnabled: false });
    h.pending[0].reject(new Error('late failure'));
    await new Promise(resolve => setImmediate(resolve)).then(() => {
        check('disabled feature ignores late failures', !h.uiCalls.some(call => call[0] === 'error'));
        check('disabled feature keeps its UI hidden', !!h.lastCall('hideAll'));
    });
}

{
    const h = createHarness();
    const field = h.field();
    field.focus();
    h.controller.translate();
    h.pending[0].resolve({ translations: [{ id: 1, text: 'translation' }] });
    await new Promise(resolve => setImmediate(resolve)).then(() => {
        const outside = { isConnected: true };
        h.document.dispatch('click', outside);
        check('outside click closes the preview', !!h.lastCall('hidePanel'));
        check('outside click invalidates the preview', h.controller.status().state === 'idle');
    });
}

{
    const h = createHarness({ allowContentEditable: true });
    const field = h.editable('日本語\n返信');
    field.focus();
    check('contenteditable focus shows the trigger', !!h.lastCall('trigger'));
    h.controller.translate();
    check('contenteditable translation sends the visible draft', h.pending[0]?.message.texts[0].text === '日本語\n返信');
    h.pending[0].resolve({ translations: [{ id: 1, text: 'Japanese\nreply' }] });
    await new Promise(resolve => setImmediate(resolve)).then(() => {
        check('contenteditable preview keeps the original draft', field.innerText === '日本語\n返信'
            && h.lastCall('preview')?.[2].translation === 'Japanese\nreply');
        check('contenteditable replace succeeds', h.controller.replace().ok === true);
        check('contenteditable replace updates the draft', field.innerText === 'Japanese\nreply');
        check('contenteditable undo succeeds', h.controller.undo().ok === true);
        check('contenteditable undo restores line breaks', field.innerText === '日本語\n返信');
    });
}

{
    const h = createHarness({
        allowContentEditable: true,
        contenteditable: {
            read: field => field.innerText,
            capture: field => ({ text: field.innerText }),
            canReplace: () => false,
            replace: () => false,
            restore: () => false
        }
    });
    const field = h.editable();
    field.focus();
    h.controller.translate();
    h.pending[0].resolve({ translations: [{ id: 1, text: 'English reply' }] });
    await new Promise(resolve => setImmediate(resolve)).then(async () => {
        check('rich contenteditable is not replaced', h.controller.replace().reason === 'rich-text');
        check('rich contenteditable keeps the original draft', field.innerText === '日本語の返信');
        check('rich contenteditable offers a copy fallback', h.lastCall('error')?.[2].copyable === true
            && h.lastCall('error')?.[2].translation === 'English reply');
        check('copy fallback writes the translation', (await h.controller.copy()) === true
            && h.clipboard[0] === 'English reply');
    });
}

{
    const h = createHarness({
        allowContentEditable: true,
        contenteditable: {
            read: field => field.innerText,
            capture: field => ({ text: field.innerText }),
            canReplace: () => true,
            replace: () => false,
            restore: () => false
        }
    });
    const field = h.editable();
    field.focus();
    h.controller.translate();
    h.pending[0].resolve({ translations: [{ id: 1, text: 'English reply' }] });
    await new Promise(resolve => setImmediate(resolve)).then(() => {
        check('rejected contenteditable update reports failure', h.controller.replace().reason === 'apply-failed');
        check('rejected contenteditable update preserves the draft', field.innerText === '日本語の返信');
        check('rejected contenteditable update keeps copy available', h.lastCall('error')?.[2].copyable === true);
    });
}

{
    const h = createHarness({ allowContentEditable: true, realContentEditable: true });
    const field = h.editable();
    field.focus();
    h.controller.translate();
    h.pending[0].resolve({ translations: [{ id: 1, text: 'English reply' }] });
    await new Promise(resolve => setImmediate(resolve)).then(async () => {
        const replaced = h.controller.replace();
        check('site-rejected contenteditable reports apply failure', replaced.reason === 'apply-failed', replaced);
        check('site rejection restoration emits both input events',
            field.events.filter(event => event.type === 'input').length === 2);
        check('site rejection keeps the original draft', field.innerText === '日本語の返信');
        check('site rejection preserves the copy fallback', h.lastCall('error')?.[2].copyable === true
            && h.lastCall('error')?.[2].translation === 'English reply', h.lastCall('error')?.[2]);
        check('copy fallback still writes the rejected translation', (await h.controller.copy()) === true
            && h.clipboard[0] === 'English reply');
    });
}

}

run().then(() => {
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
}).catch(error => {
    console.error(error);
    process.exit(1);
});
