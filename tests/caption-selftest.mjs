// Self-test for captions/parser.js.
// Loads the real module with a tiny DOM shim. Run: node tests/caption-selftest.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'captions', 'parser.js'), 'utf8');

const context = vm.createContext({
    window: {},
    URL,
    DOMParser: class {
        parseFromString(str) {
            const items = [];
            const re = /<p\b([^>]*)>([\s\S]*?)<\/p>/g;
            let m;
            while ((m = re.exec(str)) !== null) {
                const attrs = m[1];
                const body = m[2];
                items.push({
                    getAttribute: (name) => {
                        const hit = new RegExp(`\\b${name}="(-?\\d+)"`).exec(attrs);
                        return hit ? hit[1] : null;
                    },
                    textContent: body
                        .replace(/<[^>]+>/g, '')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                });
            }
            return { getElementsByTagName: (tag) => (tag === 'p' ? items : []) };
        }
    }
});
vm.runInContext(source, context);
const P = context.window.LctCaptionParser;

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
    if (cond) { pass++; console.log('PASS', name); }
    else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); }
};

// language codes
check('lang: plain', P.normalizeLangCode('ja') === 'ja');
check('lang: region', P.normalizeLangCode('en-US') === 'en');
check('lang: ASR id', P.normalizeLangCode('a.ja') === 'ja');
check('lang: empty', P.normalizeLangCode('') === '');

// track selection
const tracks = [
    { baseUrl: 'af', languageCode: 'af', kind: '' },
    { baseUrl: 'en', languageCode: 'en', kind: '' },
    { baseUrl: 'en-asr', languageCode: 'en', kind: 'asr' },
    { baseUrl: 'ja-asr', languageCode: 'ja', kind: 'asr' }
];
check('pick: spoken language wins', P.pickTrack(tracks, 'ja', 'en').baseUrl === 'ja-asr');
check('pick: manual beats ASR', P.pickTrack([
    { baseUrl: 'm', languageCode: 'en', kind: '' },
    { baseUrl: 'a', languageCode: 'en', kind: 'asr' }
], 'en', 'ja').baseUrl === 'm');
check('pick: english fallback', P.pickTrack([
    { baseUrl: 'af', languageCode: 'af', kind: '' },
    { baseUrl: 'en', languageCode: 'en', kind: '' }
], '', 'ja').baseUrl === 'en');
check('pick: empty -> null', P.pickTrack([], 'en', 'ja') === null);

// timedtext URL
const built = P.buildTimedtextUrl('https://www.youtube.com/api/timedtext?v=x&fmt=srv3&tlang=ja', 'json3');
check('url: fmt replaced', built.includes('fmt=json3') && !built.includes('fmt=srv3'), built);
check('url: tlang stripped', !built.includes('tlang'), built);
check('url: garbage input returned as-is', P.buildTimedtextUrl('not a url', 'json3') === 'not a url');

// parsers
const json3 = JSON.stringify({
    events: [
        { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: 'Hello' }] },
        { tStartMs: 1000, dDurationMs: 1000, segs: [{ utf8: 'Hello world' }] },
        { tStartMs: 2000, dDurationMs: 1000, segs: [{ utf8: 'Hello world.' }] },
        { tStartMs: 3000, dDurationMs: 1000, segs: [{ utf8: 'Next' }] },
        { tStartMs: 4000, dDurationMs: 1000, segs: [] }
    ]
});
check('json3: skips empty segs', P.parseJson3(json3).length === 4);
check('json3: newlines folded', P.parseJson3(JSON.stringify({
    events: [{ tStartMs: 0, dDurationMs: 10, segs: [{ utf8: 'a\nb' }] }]
}))[0].text === 'a b');
check('json3: missing events -> []', P.parseJson3('{"events":null}').length === 0);

const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.500\nHello there\n\n00:00:03.500 --> 00:00:06.000\nGeneral Kenobi\n';
const vttCues = P.parseVtt(vtt);
check('vtt: cue count', vttCues.length === 2);
check('vtt: start ms', vttCues[0].startMs === 1000);
check('vtt: end ms', vttCues[0].endMs === 3500);
check('vtt: inline tags stripped', P.parseVtt('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n<v Bob>Hi</v>')[0].text === 'Hi');

const srv3Cues = P.parseSrv3('<timedtext><body><p t="1500" d="2500">Hi <s>there</s></p></body></timedtext>');
check('srv3: timing', srv3Cues[0].startMs === 1500 && srv3Cues[0].endMs === 4000);
check('srv3: nested tags flattened', srv3Cues[0].text === 'Hi there');
check('srv3: entity decoded', P.parseSrv3('<timedtext><body><p t="0" d="1">a &amp; b</p></body></timedtext>')[0].text === 'a & b');

// payload sniffing
check('payload: empty body', P.parsePayload('').length === 0);
check('payload: whitespace only', P.parsePayload('  \n ').length === 0);
check('payload: truncated json', P.parsePayload('{"events":[{"tStartMs":0,').length === 0);
check('payload: json3', P.parsePayload(json3).length === 4);
check('payload: vtt', P.parsePayload(vtt).length === 2);
check('payload: srv3', P.parsePayload('<timedtext><body><p t="1" d="2">x</p></body></timedtext>').length === 1);
check('payload: unknown shape', P.parsePayload('random text').length === 0);

// assembly
const assembled = P.assemble(P.parseJson3(json3));
check('assemble: rolling windows folded into sentences',
    assembled.length === 2 && assembled[0].text === 'Hello world.' && assembled[1].text === 'Next',
    assembled.map(c => c.text));

check('assemble: CJK joined without space', P.assemble([
    { startMs: 0, endMs: 500, text: 'これは' },
    { startMs: 500, endMs: 1000, text: 'テストです' }
])[0].text === 'これはテストです');

check('assemble: sentence break splits', P.assemble([
    { startMs: 0, endMs: 1000, text: 'One.' },
    { startMs: 1000, endMs: 2000, text: 'Two.' }
]).length === 2);

const word = 'word '.repeat(50).trim();
const term = 'term '.repeat(50).trim();
check('assemble: length cap splits', P.assemble([
    { startMs: 0, endMs: 1000, text: word },
    { startMs: 1000, endMs: 2000, text: term }
]).length === 2);

// cue lookup
const overlapping = [
    { startMs: 0, endMs: 5000, text: 'long' },
    { startMs: 1000, endMs: 1500, text: 'short' },
    { startMs: 2000, endMs: 2500, text: 'inner' }
];
check('find: cue under playhead', P.findCue(overlapping, 2100).text === 'inner');
check('find: falls back to covering cue', P.findCue(overlapping, 3000).text === 'long');
check('find: exact start', P.findCue(overlapping, 0).text === 'long');
check('find: gap between cues', P.findCue([
    { startMs: 0, endMs: 1000, text: 'a' },
    { startMs: 3000, endMs: 4000, text: 'b' }
], 2000) === null);
check('find: empty list', P.findCue([], 100) === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
