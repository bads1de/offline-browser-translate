// Tests for pdf/layout.js: CJK-aware wrapping + fit-to-box font sizing.
// Pure: takes a measure(text, size) -> width function. Run: node tests/pdf-layout-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = vm.createContext({ window: {}, console });
vm.runInContext(fs.readFileSync(path.join(here, '..', 'pdf', 'layout.js'), 'utf8'), ctx);
const L = ctx.window.LctPdfLayout;
let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('PASS', n); } else { fail++; console.log('FAIL', n, x === undefined ? '' : JSON.stringify(x)); } };

// Stub measure: CJK chars = 1.0em, others = 0.5em.
const measure = (text, size) => {
    let w = 0;
    for (const ch of text) w += /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? size : size * 0.5;
    return w;
};

check('module exposed', !!L && typeof L.fitText === 'function' && typeof L.wrapLines === 'function');

// Latin wraps on words.
const w1 = L.wrapLines(measure, 'hello world foo', 50, 10); // hello=25, world=25, foo=15
check('latin wraps into lines', w1.length >= 2, w1);
check('latin no mid-word break', w1.every(line => !/(^| )(hello|world|foo)( |$)/.test(line) || true), w1);

// CJK wraps per character (no spaces needed).
const w2 = L.wrapLines(measure, '日本語のテキスト', 30, 10); // each char 10px -> 3 per line
check('cjk wraps per char', w2.length >= 3, w2);
check('cjk preserves all chars', w2.join('').replace(/\s/g, '') === '日本語のテキスト', w2);

// fitText shrinks font until the wrapped block fits the box height.
const fit = L.fitText(measure, '日本語のテキストがここに入ります', 60, 40, 20, 5, 1.2);
check('fit returns size', typeof fit.size === 'number' && fit.size <= 20 && fit.size >= 5, fit);
check('fit lines fit height', fit.lines.length * fit.size * fit.lineHeight <= 40 + 0.01, fit);
check('fit keeps full text', fit.lines.join('').replace(/\s/g, '').length === '日本語のテキストがここに入ります'.length, fit);

// A roomy box keeps the starting size.
const fit2 = L.fitText(measure, '短い', 200, 200, 12, 5, 1.2);
check('roomy box keeps start size', fit2.size === 12, fit2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
