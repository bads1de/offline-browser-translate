import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'compose', 'session.js'), 'utf8');

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

const context = vm.createContext({});
vm.runInContext(source, context);
const createSession = context.LctComposeSession.createSession;

{
    const session = createSession();
    const request = session.begin({
        text: '日本語',
        sourceLanguage: 'auto',
        targetLanguage: 'en'
    });

    check('begin enters loading with generation 1', request.generation === 1);
    check('begin snapshots the draft and languages', session.status().state === 'loading'
        && session.status().request.text === '日本語'
        && session.status().request.targetLanguage === 'en', session.status());

    const resolved = session.resolve(request.generation, 'Japanese');
    check('current result becomes a preview', resolved.applied === true
        && session.status().state === 'preview'
        && session.status().translation === 'Japanese', resolved);
}

{
    const session = createSession();
    const first = session.begin({ text: 'first', sourceLanguage: 'auto', targetLanguage: 'en' });
    const second = session.begin({ text: 'second', sourceLanguage: 'auto', targetLanguage: 'en' });
    const stale = session.resolve(first.generation, 'old result');

    check('a newer begin invalidates the older request', second.generation > first.generation);
    check('older result is rejected as stale', stale.stale === true && stale.applied === false, stale);
    check('rejected result does not change loading state', session.status().state === 'loading'
        && session.status().translation === '', session.status());
}

{
    const session = createSession();
    const request = session.begin({ text: 'draft', sourceLanguage: 'auto', targetLanguage: 'en' });
    session.noteEdit('draft edited');
    const stale = session.resolve(request.generation, 'translation');

    check('editing during translation invalidates the result', stale.stale === true, stale);
    check('editing returns the session to idle', session.status().state === 'idle', session.status());
}

{
    const session = createSession();
    const request = session.begin({ text: 'draft', sourceLanguage: 'auto', targetLanguage: 'en' });
    const failed = session.fail(request.generation, 'LLM offline');

    check('current failure is applied', failed.applied === true, failed);
    check('failure keeps an error state without a translation', session.status().state === 'error'
        && session.status().error === 'LLM offline'
        && session.status().translation === '', session.status());
}

{
    const session = createSession();
    const request = session.begin({ text: 'original', sourceLanguage: 'auto', targetLanguage: 'en' });
    session.resolve(request.generation, 'translation');
    const replaced = session.replace('original', {
        text: 'original',
        selectionStart: 1,
        selectionEnd: 3,
        scrollTop: 10,
        scrollLeft: 2
    }, 'translation');

    check('replacement enters replaced state', replaced.ok === true
        && session.status().state === 'replaced', replaced);
    check('replacement stores one undo snapshot', session.canUndo('translation') === true);
    check('undo snapshot is retained', session.status().undo.text === 'original'
        && session.status().undo.selectionStart === 1, session.status().undo);
}

{
    const session = createSession();
    const request = session.begin({ text: 'original', sourceLanguage: 'auto', targetLanguage: 'en' });
    session.resolve(request.generation, 'translation');
    const replaced = session.replace('edited after preview', {
        text: 'original',
        selectionStart: 0,
        selectionEnd: 0,
        scrollTop: 0,
        scrollLeft: 0
    }, 'translation');

    check('replacement is rejected when the draft changed', replaced.ok === false
        && replaced.stale === true, replaced);
    check('rejected replacement leaves no undo snapshot', session.canUndo('translation') === false);
}

{
    const session = createSession();
    const request = session.begin({ text: 'original', sourceLanguage: 'auto', targetLanguage: 'en' });
    session.resolve(request.generation, 'translation');
    session.replace('original', {
        text: 'original',
        selectionStart: 2,
        selectionEnd: 4,
        scrollTop: 8,
        scrollLeft: 1
    }, 'translation');

    check('undo is available before further edits', session.canUndo('translation') === true);
    // Editors append a trailing block/br after a programmatic write; that must
    // not be mistaken for a user edit, or undo is lost on Reddit and X.
    check('editor trailing whitespace keeps undo available',
        session.canUndo('translation\n') === true && session.canUndo('translation\n\n') === true);
    check('trailing whitespace is not treated as an edit',
        session.noteEdit('translation\n') === undefined
        && session.status().state === 'replaced' && session.canUndo('translation') === true,
        session.status());
    session.noteEdit('translation edited');
    check('further edits disable undo', session.canUndo('translation edited') === false
        && session.status().state === 'editing', session.status());

    session.noteEdit('translation');
    check('undo stays disabled after editing back to the same text', session.canUndo('translation') === false);
}

{
    const session = createSession();
    const request = session.begin({ text: 'original', sourceLanguage: 'auto', targetLanguage: 'en' });
    session.resolve(request.generation, 'translation');
    session.replace('original', {
        text: 'original',
        selectionStart: 2,
        selectionEnd: 4,
        scrollTop: 8,
        scrollLeft: 1
    }, 'translation');

    const undone = session.undo('translation');
    check('undo returns the original snapshot', undone.ok === true
        && undone.snapshot.text === 'original'
        && undone.snapshot.selectionStart === 2, undone);
    check('undo settles the session in idle', session.status().state === 'idle'
        && session.canUndo('original') === false, session.status());
}

{
    const session = createSession();
    const request = session.begin({ text: 'draft', sourceLanguage: 'auto', targetLanguage: 'en' });
    session.invalidate();
    const stale = session.resolve(request.generation, 'late result');

    check('invalidate rejects an in-flight result', stale.stale === true, stale);
    check('invalidate returns loading to idle', session.status().state === 'idle', session.status());
}

{
    const session = createSession();
    const request = session.begin({ text: 'original', sourceLanguage: 'auto', targetLanguage: 'en' });
    session.resolve(request.generation, 'translation');
    session.replace('original', {
        text: 'original',
        selectionStart: 0,
        selectionEnd: 0,
        scrollTop: 0,
        scrollLeft: 0
    }, 'translation');

    session.invalidate();
    check('outside-click invalidation preserves immediate undo', session.canUndo('translation') === true);
    session.invalidate({ clearUndo: true });
    check('feature shutdown clears undo', session.canUndo('translation') === false
        && session.status().state === 'idle', session.status());
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
