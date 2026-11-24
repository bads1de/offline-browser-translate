import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'compose', 'textarea.js'), 'utf8');

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

class FakeEvent {
    constructor(type, options = {}) {
        this.type = type;
        this.bubbles = !!options.bubbles;
        this.inputType = options.inputType;
        this.data = options.data;
    }
}

class FakeInputEvent extends FakeEvent {}

function createTextarea(initial = '日本語の下書き') {
    class FakeTextarea {}
    Object.defineProperty(FakeTextarea.prototype, 'value', {
        configurable: true,
        get() { return this._value || ''; },
        set(value) { this._value = String(value); }
    });

    const field = new FakeTextarea();
    field._value = initial;
    field.selectionStart = 2;
    field.selectionEnd = 4;
    field.scrollTop = 31;
    field.scrollLeft = 7;
    field.instanceWrites = 0;
    field.reactValue = initial;
    field.events = [];
    field.ownerDocument = {
        defaultView: {
            HTMLTextAreaElement: FakeTextarea,
            InputEvent: FakeInputEvent,
            Event: FakeEvent
        }
    };

    Object.defineProperty(field, 'value', {
        configurable: true,
        get() { return this._value || ''; },
        set(value) {
            this._value = String(value);
            this.instanceWrites++;
            this.reactValue = this._value;
        }
    });

    field.dispatchEvent = (event) => {
        field.events.push(event);
        if (event.type === 'input') field.reactValue = field.value;
        return true;
    };
    field.setSelectionRange = (start, end) => {
        field.selectionStart = start;
        field.selectionEnd = end;
    };
    return field;
}

const context = vm.createContext({});
vm.runInContext(source, context);
const adapter = context.LctComposeTextarea;

check('textarea adapter is exported', !!adapter && typeof adapter.replace === 'function');

{
    const field = createTextarea();
    const replaced = adapter.replace(field, 'Japanese draft');

    check('replace reports success', replaced === true, replaced);
    check('replace bypasses the instance value setter', field.instanceWrites === 0, field.instanceWrites);
    check('React-like state receives the translated value', field.reactValue === 'Japanese draft', field.reactValue);
    check('replace dispatches bubbling input and change events',
        field.events.length === 2
        && field.events[0].type === 'input' && field.events[0].bubbles
        && field.events[1].type === 'change' && field.events[1].bubbles,
        field.events.map(event => `${event.type}:${event.bubbles}`).join(','));
    check('replace puts the caret at the end',
        field.selectionStart === 'Japanese draft'.length && field.selectionEnd === 'Japanese draft'.length,
        [field.selectionStart, field.selectionEnd]);
    check('replace preserves scroll position', field.scrollTop === 31 && field.scrollLeft === 7,
        [field.scrollTop, field.scrollLeft]);
}

{
    const field = createTextarea('original');
    field.dispatchEvent = (event) => {
        field.events.push(event);
        if (event.type === 'input') {
            field.reactValue = field.value;
            field._value = 'original';
        }
        return true;
    };

    const replaced = adapter.replace(field, 'translation');
    check('replace detects a site reverting the value', replaced === false, replaced);
    check('failed replacement keeps the original text', field.value === 'original', field.value);
}

{
    const field = createTextarea('translation');
    const restored = adapter.restore(field, {
        text: 'original',
        selectionStart: 1,
        selectionEnd: 3,
        scrollTop: 19,
        scrollLeft: 4
    });

    check('restore reports success', restored === true, restored);
    check('restore updates React-like state', field.reactValue === 'original', field.reactValue);
    check('restore reinstates the selection range',
        field.selectionStart === 1 && field.selectionEnd === 3,
        [field.selectionStart, field.selectionEnd]);
    check('restore reinstates scroll position', field.scrollTop === 19 && field.scrollLeft === 4,
        [field.scrollTop, field.scrollLeft]);
}

{
    const field = createTextarea('capture me');
    const snapshot = adapter.capture(field);
    check('capture stores text, selection, and scroll', snapshot.text === 'capture me'
        && snapshot.selectionStart === 2 && snapshot.selectionEnd === 4
        && snapshot.scrollTop === 31 && snapshot.scrollLeft === 7, snapshot);
}

{
    const field = createTextarea('original');
    delete field.ownerDocument.defaultView.HTMLTextAreaElement;
    const replaced = adapter.replace(field, 'translation');
    check('replace fails safely without a native value setter', replaced === false, replaced);
    check('missing native setter leaves text and events untouched', field.value === 'original'
        && field.events.length === 0, { value: field.value, events: field.events.length });
}

{
    const field = createTextarea('translation');
    field.dispatchEvent = (event) => {
        field.events.push(event);
        if (event.type === 'input') field._value = 'site-managed value';
        return true;
    };
    const restored = adapter.restore(field, {
        text: 'original',
        selectionStart: 0,
        selectionEnd: 0,
        scrollTop: 0,
        scrollLeft: 0
    });
    check('restore detects a site rejecting the value', restored === false, restored);
    check('rejected restore leaves the site-managed value in place', field.value === 'site-managed value', field.value);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
