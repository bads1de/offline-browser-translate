import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'compose', 'policy.js'), 'utf8');

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

function makeElement(tag, options = {}) {
    const attrs = { ...(options.attrs || {}) };
    const element = {
        tagName: tag.toUpperCase(),
        ownerDocument: {},
        parentElement: options.parent || null,
        style: options.style || {},
        hidden: !!options.hidden,
        disabled: !!options.disabled,
        readOnly: !!options.readOnly,
        isContentEditable: !!options.contentEditable,
        value: options.value === undefined ? '' : options.value,
        innerText: options.innerText === undefined ? '' : options.innerText,
        textContent: options.textContent === undefined ? '' : options.textContent,
        id: options.id || '',
        name: options.name || '',
        getAttribute(name) {
            return attrs[name] === undefined ? null : attrs[name];
        },
        getClientRects() {
            return options.invisible ? [] : [{}];
        }
    };
    return element;
}

const context = vm.createContext({});
vm.runInContext(source, context);
const policy = context.LctComposePolicy;

check('compose policy is exported', !!policy && typeof policy.inspect === 'function');
check('maximum draft length is 3000 code points', policy.MAX_CHARS === 3000);

{
    const field = makeElement('textarea', { value: '日本語の下書き' });
    const result = policy.inspect(field, { targetLanguage: 'en' });
    check('plain textarea is eligible', result.ok && result.kind === 'textarea', result);
    check('eligible text is returned unchanged', result.text === '日本語の下書き', result.text);
}

{
    const result = policy.inspect(makeElement('input', { value: 'hello' }), { targetLanguage: 'en' });
    check('input elements are unsupported', !result.ok && result.reason === 'unsupported', result);
}

{
    const field = makeElement('div', { contentEditable: true, innerText: '日本語の返信' });
    check('contenteditable is excluded by default',
        policy.inspect(field, { targetLanguage: 'en' }).reason === 'unsupported');
    const result = policy.inspect(field, { targetLanguage: 'en', allowContentEditable: true });
    check('contenteditable can be enabled explicitly', result.ok && result.kind === 'contenteditable', result);
}

{
    const field = makeElement('div', { contentEditable: true, innerText: '日本語の返信' });
    field.getRootNode = () => ({});
    check('contenteditable inside a shadow root is unsupported',
        policy.inspect(field, { targetLanguage: 'en', allowContentEditable: true }).reason === 'unsupported');
}

for (const [name, options] of [
    ['password autocomplete', { attrs: { autocomplete: 'current-password' } }],
    ['OTP autocomplete', { attrs: { autocomplete: 'one-time-code' } }],
    ['card number autocomplete', { attrs: { autocomplete: 'cc-number' } }],
    ['password label', { attrs: { 'aria-label': 'Password' } }],
    ['OTP name', { name: 'otp-code' }]
]) {
    const field = makeElement('textarea', { value: 'secret draft', ...options });
    const result = policy.inspect(field, { targetLanguage: 'en' });
    check(`${name} is excluded as sensitive`, !result.ok && result.reason === 'sensitive', result);
    check(`${name} does not expose draft text`, result.text === '', result.text);
}

{
    const parent = makeElement('form', { attrs: { translate: 'no' } });
    const field = makeElement('textarea', { value: 'hello', parent });
    check('translate=no ancestor excludes the field',
        policy.inspect(field, { targetLanguage: 'en' }).reason === 'ignored');
}

{
    const parent = makeElement('div', { attrs: { 'data-llm-translator-ignore': '' } });
    const field = makeElement('textarea', { value: 'hello', parent });
    check('data-llm-translator-ignore ancestor excludes the field',
        policy.inspect(field, { targetLanguage: 'en' }).reason === 'ignored');
}

for (const [name, options] of [
    ['hidden', { hidden: true }],
    ['disabled', { disabled: true }],
    ['readonly', { readOnly: true }],
    ['display none', { style: { display: 'none' } }],
    ['zero-size', { invisible: true }]
]) {
    const field = makeElement('textarea', { value: 'hello', ...options });
    check(`${name} field is excluded`, policy.inspect(field, { targetLanguage: 'en' }).reason === 'invisible');
}

for (const [name, value] of [
    ['empty', ''],
    ['whitespace', '  \n\t'],
    ['punctuation only', '123 !!!']
]) {
    const field = makeElement('textarea', { value });
    check(`${name} draft is rejected`, policy.inspect(field, { targetLanguage: 'en' }).reason === 'empty');
}

{
    const field = makeElement('textarea', { value: 'あ'.repeat(3001) });
    check('3001 code point draft is rejected',
        policy.inspect(field, { targetLanguage: 'en' }).reason === 'too-long');
}

{
    const field = makeElement('textarea', { value: 'あ'.repeat(3000) });
    check('3000 code point draft is accepted',
        policy.inspect(field, { targetLanguage: 'en' }).ok === true);
}

{
    const field = makeElement('textarea', { value: 'hello' });
    const result = policy.inspect(field, { sourceLanguage: 'en', targetLanguage: 'en' });
    check('same explicit source and target is rejected',
        !result.ok && result.reason === 'same-language', result);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
