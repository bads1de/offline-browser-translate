import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlamo3Prompt, stripPlamoTags } from '../src/plamo3-prompt.js';

const CORE = '<|plamo:bos|><|plamo:tag|>dataset<|plamo:msg|>translation';

test('minimal prompt: dataset + input + output', () => {
    const p = buildPlamo3Prompt({ text: 'Hello.', targetLang: 'ja' });
    assert.equal(
        p,
        `${CORE}<|plamo:tag|>input<|plamo:msg|>Hello.`
        + '<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>ja<|plamo:msg|>',
    );
});

test('sourceLang is embedded when given, lowercased, omitted when auto', () => {
    const withSrc = buildPlamo3Prompt({ text: 'Hello.', targetLang: 'JA', sourceLang: 'EN' });
    assert.match(withSrc, /<\|plamo:tag\|>input<\|plamo:key\|>lang<\|plamo:val\|>en<\|plamo:msg\|>/);
    assert.match(withSrc, /val\|>ja/); // target lowercased too

    const autoSrc = buildPlamo3Prompt({ text: 'Hello.', targetLang: 'ja', sourceLang: 'auto' });
    assert.doesNotMatch(autoSrc, /input<\|plamo:key\|>lang/);
});

test('empty text throws', () => {
    assert.throws(() => buildPlamo3Prompt({ text: '   ', targetLang: 'ja' }), /empty/);
});

test('context is placed between dataset and glossary/input', () => {
    const p = buildPlamo3Prompt({ text: 'A.', targetLang: 'en', context: 'ヘルプページです' });
    assert.match(p, /dataset<\|plamo:msg\|>translation<\|plamo:tag\|>context<\|plamo:msg\|>ヘルプページです<\|plamo:tag\|>input/);
});

test('glossary renders index/item pairs in order and skips malformed entries', () => {
    const p = buildPlamo3Prompt({
        text: 'Open the dashboard and the latency panel.',
        targetLang: 'ja',
        glossary: [
            { source: ' dashboard ', target: ' 管理画面' },
            { source: '', target: 'x' },          // dropped: empty source
            { source: 'panel', target: '' },      // dropped: empty target
            { source: 'latency', target: 'レイテンシ' },
        ],
    });
    assert.match(
        p,
        /glossary<\|plamo:index\|>dashboard<\|plamo:item\|>管理画面<\|plamo:index\|>latency<\|plamo:item\|>レイテンシ<\|plamo:tag\|>input/,
    );
});

test('glossary appears before input and after context', () => {
    const p = buildPlamo3Prompt({
        text: 'x', targetLang: 'ja', context: 'ctx', glossary: [{ source: 'a', target: 'b' }],
    });
    const iContext = p.indexOf('context');
    const iGlossary = p.indexOf('glossary');
    const iInput = p.indexOf('<|plamo:tag|>input');
    assert.ok(iContext < iGlossary && iGlossary < iInput);
});

test('form applies to ja* targets only, with lowercase values', () => {
    const polite = buildPlamo3Prompt({ text: 'This system is convenient.', targetLang: 'ja', form: 'polite' });
    assert.match(polite, /<\|plamo:key\|>form<\|plamo:val\|>polite<\|plamo:msg\|>$/);
    const plain = buildPlamo3Prompt({ text: 'x', targetLang: 'ja', form: 'plain' });
    assert.match(plain, /<\|plamo:val\|>plain/);
    // ignored for non-Japanese targets
    const en = buildPlamo3Prompt({ text: 'x', targetLang: 'en', form: 'polite' });
    assert.doesNotMatch(en, /form/);
    // plain is not accepted when spelled with a capital (defense-in-depth: no accidental pass-through)
    const weird = buildPlamo3Prompt({ text: 'x', targetLang: 'ja', form: 'Polite' });
    assert.doesNotMatch(weird, /<\|plamo:key\|>form/);
});

test('history pairs are interleaved before the current input, in order', () => {
    const p = buildPlamo3Prompt({
        text: '現在の文', targetLang: 'en', sourceLang: 'ja',
        history: [
            { source: '一つ目', translation: 'First.' },
            { source: '二つ目', translation: 'Second.' },
        ],
    });
    const expected =
        `${CORE}`
        + '<|plamo:tag|>input<|plamo:key|>lang<|plamo:val|>ja<|plamo:msg|>一つ目'
        + '<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>en<|plamo:msg|>First.'
        + '<|plamo:tag|>input<|plamo:key|>lang<|plamo:val|>ja<|plamo:msg|>二つ目'
        + '<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>en<|plamo:msg|>Second.'
        + '<|plamo:tag|>input<|plamo:key|>lang<|plamo:val|>ja<|plamo:msg|>現在の文'
        + '<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>en<|plamo:msg|>';
    assert.equal(p, expected);
});

test('history falls back to per-entry source/target langs, and skips empty entries', () => {
    const p = buildPlamo3Prompt({
        text: 'now', targetLang: 'ja', sourceLang: 'en',
        history: [
            { source: 'prev', translation: '前', sourceLang: 'FR', targetLang: 'JA' },
            { source: '  ', translation: 'x' }, // skipped
        ],
    });
    assert.match(p, /input<\|plamo:key\|>lang<\|plamo:val\|>fr<\|plamo:msg\|>prev/);
    assert.match(p, /val\|>ja<\|plamo:msg\|>前/);
    assert.doesNotMatch(p, /  /);
});

test('full prompt with everything, in order', () => {
    const p = buildPlamo3Prompt({
        text: '本文です。', targetLang: 'ja', sourceLang: 'en', form: 'plain',
        glossary: [{ source: 'dashboard', target: '管理画面' }],
        context: '製品ドキュメント',
    });
    const iDataset = p.indexOf('dataset');
    const iContext = p.indexOf('context');
    const iGlossary = p.indexOf('glossary');
    const iInput = p.lastIndexOf('<|plamo:tag|>input');
    const iForm = p.indexOf('form');
    assert.ok(iDataset < iContext && iContext < iGlossary && iGlossary < iInput && iInput < iForm);
    assert.ok(p.endsWith('<|plamo:msg|>'));
});

test('stripPlamoTags removes all plamo control tokens and trims', () => {
    assert.equal(stripPlamoTags('  完了しました。<|plamo:tag|>  '), '完了しました。');
    assert.equal(stripPlamoTags('<|plamo:bos|>訳<|plamo:eot|>'), '訳');
    assert.equal(stripPlamoTags('a\nb\n'), 'a\nb'); // keeps internal newlines (batch alignment!)
    assert.equal(stripPlamoTags(''), '');
    assert.equal(stripPlamoTags(null), '');
});
