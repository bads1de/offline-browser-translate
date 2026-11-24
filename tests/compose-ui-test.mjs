import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'compose', 'ui.js'), 'utf8');

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

function descendants(root) {
    return root.children.flatMap(child => [child, ...descendants(child)]);
}

function createHarness() {
    const created = [];
    const windowListeners = new Map();

    function makeElement(tag) {
        const element = {
            tagName: tag.toUpperCase(),
            style: {},
            hidden: false,
            disabled: false,
            textContent: '',
            _innerHTML: '',
            get innerHTML() { return element._innerHTML; },
            set innerHTML(value) {
                element._innerHTML = String(value);
                const kind = /M4 9h8\.5/.test(element._innerHTML) ? 'undo' : 'translate';
                element.children.length = 0;
                const svg = makeElement('svg');
                svg.icon = kind;
                element.appendChild(svg);
            },
            children: [],
            parent: null,
            attrs: {},
            dataset: {},
            handlers: new Map(),
            offsetHeight: 120,
            offsetWidth: 320,
            get firstChild() { return element.children[0] || null; },
            classList: {
                toggle() {},
                add() {},
                remove() {}
            },
            appendChild(child) {
                if (child.parent) child.remove();
                element.children.push(child);
                child.parent = element;
                return child;
            },
            remove() {
                if (!element.parent) return;
                const at = element.parent.children.indexOf(element);
                if (at >= 0) element.parent.children.splice(at, 1);
                element.parent = null;
            },
            removeChild(child) {
                const at = element.children.indexOf(child);
                if (at >= 0) element.children.splice(at, 1);
                child.parent = null;
                return child;
            },
            addEventListener(type, handler) {
                if (!element.handlers.has(type)) element.handlers.set(type, new Set());
                element.handlers.get(type).add(handler);
            },
            removeEventListener(type, handler) {
                element.handlers.get(type)?.delete(handler);
            },
            dispatch(type, options = {}) {
                const event = { type, target: element, defaultPrevented: false, ...options };
                event.preventDefault = () => { event.defaultPrevented = true; };
                for (const handler of element.handlers.get(type) || []) handler(event);
                return event;
            },
            setAttribute(name, value) { element.attrs[name] = String(value); },
            getAttribute(name) { return element.attrs[name] === undefined ? null : element.attrs[name]; },
            contains(other) {
                if (other === element) return true;
                return element.children.some(child => child.contains(other));
            },
            attachShadow(options) {
                element.shadowRoot = makeElement('shadow-root');
                element.shadowMode = options.mode;
                return element.shadowRoot;
            },
            focus() {}
        };
        created.push(element);
        return element;
    }

    const documentElement = makeElement('html');
    const document = {
        createElement: makeElement,
        documentElement,
        activeElement: null
    };
    const window = {
        innerWidth: 1024,
        innerHeight: 768,
        addEventListener(type, handler) {
            if (!windowListeners.has(type)) windowListeners.set(type, new Set());
            windowListeners.get(type).add(handler);
        },
        removeEventListener(type, handler) {
            windowListeners.get(type)?.delete(handler);
        }
    };
    const field = makeElement('textarea');
    field.getBoundingClientRect = () => ({ left: 100, right: 500, top: 200, bottom: 280, width: 400, height: 80 });

    const calls = { translate: 0, replace: 0, undo: 0, close: 0, copy: 0 };
    const context = vm.createContext({ document, window, navigator: { language: 'ja' }, setTimeout, clearTimeout });
    vm.runInContext(source, context);
    const ui = context.window.LctComposeUI.create({
        document,
        window,
        callbacks: {
            translate: () => calls.translate++,
            replace: () => calls.replace++,
            undo: () => calls.undo++,
            close: () => calls.close++,
            copy: () => calls.copy++
        }
    });

    return { ui, document, documentElement, field, created, calls, windowListeners };
}

{
    const h = createHarness();
    const host = h.documentElement.children.find(child => child.id === 'llm-compose-ui');
    check('UI host is attached to the page', !!host);
    check('UI uses a closed shadow root', host?.shadowMode === 'closed');
    check('UI installs reposition listeners', h.windowListeners.get('scroll')?.size === 1
        && h.windowListeners.get('resize')?.size === 1);
}

{
    const h = createHarness();
    h.ui.showTrigger(h.field, { targetLabel: '英語', busy: false, canUndo: false, disabled: false });
    const host = h.documentElement.children.find(child => child.id === 'llm-compose-ui');
    const button = host.shadowRoot.children.find(child => child.tagName === 'BUTTON');
    check('trigger button becomes visible', button?.hidden === false);
    check('trigger button is labelled for the target language', button?.title.includes('英語'), button?.title);
    check('trigger shows a translate icon instead of text',
        button?.textContent === '' && /<svg/.test(button?.innerHTML || ''), button?.innerHTML);

    const down = button.dispatch('mousedown');
    check('trigger mousedown preserves field focus', down.defaultPrevented === true);
    button.dispatch('click');
    check('trigger click requests translation', h.calls.translate === 1);

    h.ui.showTrigger(h.field, { targetLabel: '英語', busy: true });
    check('busy trigger is disabled', button.disabled === true);

    h.ui.showTrigger(h.field, { targetLabel: '英語', canUndo: true });
    check('undo state swaps the icon', /M4 9h8\.5/.test(button.innerHTML), button.innerHTML);
    check('undo state marks the trigger as an undo action', button.dataset.action === 'undo', button.dataset);
    button.dispatch('click');
    check('clicking the undo icon undoes instead of translating',
        h.calls.undo === 1 && h.calls.translate === 1, h.calls);

    h.ui.showTrigger(h.field, { targetLabel: '英語', canUndo: false });
    button.dispatch('click');
    check('trigger returns to translating once undo is gone',
        h.calls.translate === 2 && h.calls.undo === 1, h.calls);
}

{
    const h = createHarness();
    h.ui.showPreview(h.field, { translation: '<script>alert(1)</script>', targetLabel: '英語' });
    const host = h.documentElement.children.find(child => child.id === 'llm-compose-ui');
    const panel = host.shadowRoot.children.find(child => child.attrs['data-panel'] === 'true');
    const text = JSON.stringify(descendants(host.shadowRoot).map(child => child.textContent));
    check('preview renders model output as text', text.includes('<script>alert(1)</script>'));
    check('preview exposes replace and close actions', text.includes('置き換え') && text.includes('閉じる'));

    const buttons = descendants(host.shadowRoot).filter(child => child.tagName === 'BUTTON');
    const replace = buttons.find(button => button.textContent === '置き換え');
    const close = buttons.find(button => button.textContent === '閉じる');
    replace.dispatch('click');
    close.dispatch('click');
    check('preview actions invoke controller callbacks', h.calls.replace === 1 && h.calls.close === 1);
}

{
    const h = createHarness();
    h.ui.showReplaced(h.field, { canUndo: true });
    const host = h.documentElement.children.find(child => child.id === 'llm-compose-ui');
    const undo = descendants(host.shadowRoot)
        .filter(child => child.tagName === 'BUTTON')
        .find(button => button.textContent === '元に戻す');
    check('replaced state exposes undo', !!undo);
    undo.dispatch('click');
    check('undo button invokes controller callback', h.calls.undo === 1);
}

{
    const h = createHarness();
    h.ui.showError(h.field, { message: 'LLM offline' });
    const host = h.documentElement.children.find(child => child.id === 'llm-compose-ui');
    check('error message is displayed', descendants(host.shadowRoot).some(child => child.textContent === 'LLM offline'));

    h.ui.showError(h.field, { message: 'Could not replace', translation: 'English reply', copyable: true });
    const copy = descendants(host.shadowRoot).find(child => child.tagName === 'BUTTON'
        && child.textContent === 'コピー');
    check('copy fallback action is displayed', !!copy);
    copy?.dispatch('click');
    check('copy action invokes controller callback', h.calls.copy === 1);

    h.ui.hideAll();
    check('hideAll hides trigger and panel', host.shadowRoot.children
        .filter(child => child.tagName === 'BUTTON' || child.attrs['data-panel'] === 'true')
        .every(child => child.hidden === true));
}

{
    const h = createHarness();
    h.ui.showPreview(h.field, { translation: 'English reply', targetLabel: '英語' });
    const host = h.documentElement.children.find(child => child.id === 'llm-compose-ui');
    const panel = host.shadowRoot.children.find(child => child.attrs['data-panel'] === 'true');
    check('preview is open', panel.hidden === false);

    // The controller refreshes the trigger right after opening a panel (busy
    // state, undo availability). That refresh must not close what it just opened.
    h.ui.showTrigger(h.field, { targetLabel: '英語', busy: true, canUndo: false, disabled: true });
    check('refreshing the trigger keeps an open preview visible', panel.hidden === false);
    h.ui.hidePanel();
    check('preview can still be closed explicitly', panel.hidden === true);
}

{
    const h = createHarness();
    h.ui.showError(h.field, { message: 'LLM offline' });
    const host = h.documentElement.children.find(child => child.id === 'llm-compose-ui');
    const panel = host.shadowRoot.children.find(child => child.attrs['data-panel'] === 'true');
    h.ui.showTrigger(h.field, { targetLabel: '英語' });
    check('refreshing the trigger keeps an error panel visible', panel.hidden === false);
}

{
    const h = createHarness();
    h.ui.destroy();
    check('destroy removes the UI host', h.documentElement.children.length === 0);
    check('destroy removes reposition listeners', h.windowListeners.get('scroll')?.size === 0
        && h.windowListeners.get('resize')?.size === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
