// Self-test for the caption parsing/selection helpers in content.js.
// Extracts the pure helper block from content.js and exercises it with
// realistic json3 / vtt payloads. Run: node tools/caption-selftest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const contentPath = path.join(here, '..', 'content.js');
const src = fs.readFileSync(contentPath, 'utf8');

const startMarker = 'const CAPTION_MAX_CHARS';
const endMarker = 'function ensureOverlay';
const start = src.indexOf(startMarker);
const end = src.indexOf(endMarker);
if (start < 0 || end < 0 || end < start) {
    console.error('Could not locate caption helper block in content.js');
    process.exit(1);
}
const block = src.slice(start, end);

const sandbox = {
    debugEnabled: false,
    localStorage: { getItem: () => null },
    location: { hostname: 'www.youtube.com', pathname: '/watch' },
    navigator: { language: 'ja-JP' },
    browserAPI: { runtime: { sendMessage: async () => ({}) } },
    currentTargetLanguage: 'ja',
    console
};

const factory = new Function('sandbox', `
    const { debugEnabled, localStorage, location, navigator, browserAPI, currentTargetLanguage } = sandbox;
    ${block}
    return { pickCaptionTrack, buildTimedtextUrl, parseJson3Captions, parseVttCaptions, assembleCaptionCues, normalizeCaptionLangCode, findCurrentCue };
`);
const api = factory(sandbox);

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
    if (cond) { pass++; console.log('PASS', name); }
    else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); }
}

// normalizeCaptionLangCode
check('lang: plain', api.normalizeCaptionLangCode('ja') === 'ja');
check('lang: region', api.normalizeCaptionLangCode('en-US') === 'en');
check('lang: vss asr id', api.normalizeCaptionLangCode('a.ja') === 'ja');

// pickCaptionTrack
const tracks = [
    { baseUrl: 'u1', languageCode: 'af', kind: '', vssId: '.af' },
    { baseUrl: 'u2', languageCode: 'en', kind: '', vssId: '.en' },
    { baseUrl: 'u3', languageCode: 'en', kind: 'asr', vssId: 'a.en' },
    { baseUrl: 'u4', languageCode: 'ja', kind: 'asr', vssId: 'a.ja' }
];
check('pick: spoken ASR wins over English manual',
    api.pickCaptionTrack(tracks, 'ja', 'en').baseUrl === 'u4');
check('pick: manual preferred over ASR for same language',
    api.pickCaptionTrack([
        { baseUrl: 'm1', languageCode: 'en', kind: '', vssId: '.en' },
        { baseUrl: 'm2', languageCode: 'en', kind: 'asr', vssId: 'a.en' }
    ], 'en', 'ja').baseUrl === 'm1');
check('pick: never takes the first translated track when spoken exists',
    api.pickCaptionTrack(tracks, 'ja', 'en').languageCode === 'ja');
check('pick: empty list -> null', api.pickCaptionTrack([], 'en', 'ja') === null);

// buildTimedtextUrl
const built = api.buildTimedtextUrl(
    'https://www.youtube.com/api/timedtext?v=abc&lang=en&fmt=srv3&tlang=ja', 'json3');
check('url: replaces fmt', built.includes('fmt=json3') && !built.includes('fmt=srv3'), built);
check('url: strips tlang', !built.includes('tlang'), built);

// parseJson3Captions
const json3 = {
    events: [
        { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: 'Hello' }] },
        { tStartMs: 1000, dDurationMs: 1000, segs: [{ utf8: 'Hello world' }] },
        { tStartMs: 2000, dDurationMs: 1000, segs: [{ utf8: 'Hello world.' }] },
        { tStartMs: 3000, dDurationMs: 1000, segs: [{ utf8: 'Next line' }] },
        { tStartMs: 4000, dDurationMs: 1000, segs: [] }
    ]
};
const parsed = api.parseJson3Captions(JSON.stringify(json3));
check('json3: parses 4 text cues', parsed.length === 4, parsed.length);
check('json3: normalizes newlines', api.parseJson3Captions(JSON.stringify({
    events: [{ tStartMs: 0, dDurationMs: 10, segs: [{ utf8: 'a\nb' }] }]
}))[0].text === 'a b');

// assembleCaptionCues
const assembled = api.assembleCaptionCues(parsed);
check('assemble: rolling windows collapsed then joined into sentences',
    assembled.length === 2 && assembled[0].text === 'Hello world.' && assembled[1].text === 'Next line',
    assembled.map(c => c.text));

const cjk = api.assembleCaptionCues([
    { startMs: 0, endMs: 500, text: 'これは' },
    { startMs: 500, endMs: 1000, text: 'テストです' }
]);
check('assemble: CJK fragments joined without space', cjk[0].text === 'これはテストです', cjk[0].text);

const twoSentences = api.assembleCaptionCues([
    { startMs: 0, endMs: 1000, text: 'First one.' },
    { startMs: 1000, endMs: 2000, text: 'Second one.' }
]);
check('assemble: sentence end splits cues', twoSentences.length === 2, twoSentences.length);

const longA = Array.from({ length: 40 }, () => 'word').join(' ');
const longB = Array.from({ length: 40 }, () => 'term').join(' ');
const longCues = api.assembleCaptionCues([
    { startMs: 0, endMs: 1000, text: longA },
    { startMs: 1000, endMs: 2000, text: longB }
]);
check('assemble: char cap splits long runs', longCues.length === 2, longCues.map(c => c.text.length));

// parseVttCaptions
const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.500
Hello there

00:00:03.500 --> 00:00:06.000
General Kenobi
`;
const vttCues = api.parseVttCaptions(vtt);
check('vtt: parses 2 cues', vttCues.length === 2, vttCues.length);
check('vtt: start time ms', vttCues[0].startMs === 1000, vttCues[0].startMs);
check('vtt: end time ms', vttCues[0].endMs === 3500, vttCues[0].endMs);
check('vtt: strips inline tags',
    api.parseVttCaptions('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n<v Bob>Hi</v>')[0].text === 'Hi');

// findCurrentCue: overlapping (ASR-style) windows
const overlapCues = [
    { startMs: 0, endMs: 5000, text: 'long window' },
    { startMs: 1000, endMs: 1500, text: 'short inside' },
    { startMs: 2000, endMs: 2500, text: 'another inside' }
];
check('find: picks cue covering the playhead',
    api.findCurrentCue(overlapCues, 2100).text === 'another inside',
    api.findCurrentCue(overlapCues, 2100));
check('find: falls back to the still-running earlier cue',
    api.findCurrentCue(overlapCues, 3000).text === 'long window',
    api.findCurrentCue(overlapCues, 3000));
check('find: exactly at a cue start returns that cue',
    api.findCurrentCue(overlapCues, 0).text === 'long window');
check('find: gap with no covering cue -> null',
    api.findCurrentCue([
        { startMs: 0, endMs: 1000, text: 'a' },
        { startMs: 3000, endMs: 4000, text: 'b' }
    ], 2000) === null);
check('find: empty list -> null', api.findCurrentCue([], 100) === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
