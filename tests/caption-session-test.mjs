// Regression test for captions/session.js session ownership:
//   - overlapping enable() calls install exactly one session (newest wins)
//   - disable() while captions are loading cancels the pending enable
//   - a translation loop that outlives its session stops instead of draining
//     the replacement session's queue
// Loads the real module with a small DOM/bridge shim, no browser needed.
// Run: node tests/caption-session-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'captions', 'session.js'), 'utf8');

const results = [];
const check = (name, cond, extra) => {
    results.push([name, cond, extra]);
};
const flush = async () => {
    for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r));
};

// One isolated module instance per scenario: session state lives in the IIFE.
function createHarness() {
    const counters = { timeupdate: 0, seeked: 0 };
    const created = [];
    const state = {
        cueTexts: [],
        loads: 0,
        sentTexts: [],
        inFlight: 0,
        maxInFlight: 0,
        captionWaiters: [],
        translateWaiters: [],
        toasts: [],
        timers: new Set()
    };
    const hold = { captions: false, translate: false };

    const makeEl = (tag = 'div') => {
        const el = {
            tagName: tag,
            id: '',
            attrs: {},
            children: [],
            parent: null,
            isConnected: false,
            style: { cssText: '', position: 'static', display: '' },
            textContent: '',
            setAttribute(name, value) { el.attrs[name] = String(value); },
            getAttribute(name) { return el.attrs[name] === undefined ? null : el.attrs[name]; },
            append(...kids) { kids.forEach(k => el.appendChild(k)); },
            appendChild(kid) {
                if (kid.parent) kid.remove();
                el.children.push(kid);
                kid.parent = el;
                kid.isConnected = true;
                return kid;
            },
            insertBefore(kid) { return el.appendChild(kid); },
            remove() {
                el.isConnected = false;
                if (el.parent) {
                    const at = el.parent.children.indexOf(el);
                    if (at >= 0) el.parent.children.splice(at, 1);
                    el.parent = null;
                }
            },
            addEventListener(type) { if (counters[type] !== undefined) counters[type]++; },
            removeEventListener(type) { if (counters[type] !== undefined) counters[type]--; },
            attachShadow() { const root = makeEl('shadow'); el.shadow = root; return root; }
        };
        created.push(el);
        return el;
    };

    const player = makeEl('div');
    const video = makeEl('video');
    video.currentTime = 0;
    video.playbackRate = 1;
    const head = makeEl('head');

    const document = {
        createElement: makeEl,
        getElementById(id) {
            if (id === 'movie_player') return player;
            return head.children.find(c => c.id === id && c.isConnected) || null;
        },
        querySelector(sel) {
            if (sel === 'video') return video;
            if (sel === '.html5-video-player' || sel === '#player') return player;
            return null;
        },
        addEventListener() { },
        head
    };

    const bridge = {
        async send(message) {
            if (message.type === 'GET_PLAYER_CAPTIONS') {
                if (hold.captions) await new Promise(res => state.captionWaiters.push(res));
                return {
                    videoId: 'vid1',
                    defaultAudioLanguage: 'en',
                    tracks: [{ baseUrl: 'https://www.youtube.com/api/timedtext?v=vid1&lang=en', languageCode: 'en', kind: '' }]
                };
            }
            if (message.type === 'TRANSLATE') {
                const text = message.texts[0].text;
                state.sentTexts.push(text);
                state.inFlight++;
                state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
                if (hold.translate) {
                    await new Promise(res => state.translateWaiters.push({ text, release: res }));
                }
                state.inFlight--;
                return { translations: [{ id: 1, text: `T:${text}` }] };
            }
            return {};
        },
        toast(message) { state.toasts.push(message); }
    };

    const realSetInterval = setInterval;
    const realClearInterval = clearInterval;
    const context = vm.createContext({
        console,
        setTimeout,
        clearTimeout,
        setInterval: (fn, ms) => {
            const id = realSetInterval(fn, ms);
            state.timers.add(id);
            return id;
        },
        clearInterval: (id) => {
            state.timers.delete(id);
            realClearInterval(id);
        },
        Date,
        Map,
        URL,
        location: {
            hostname: 'www.youtube.com',
            pathname: '/watch',
            href: 'https://www.youtube.com/watch?v=vid1'
        },
        navigator: { language: 'en-US' },
        localStorage: { getItem: () => null },
        document,
        getComputedStyle: () => ({ position: 'static' }),
        window: {
            LctBridge: bridge,
            LctCaptionParser: {
                normalizeLangCode: (code) => String(code || '').toLowerCase().replace(/^[a-z]\./, '').split('-')[0],
                pickTrack: (tracks) => tracks[0] || null,
                findCue: (cues, ms) => cues.find(c => ms >= c.startMs && ms < c.endMs) || null
            },
            LctCaptionFetcher: {
                async loadCues() {
                    state.loads++;
                    return state.cueTexts.map((text, i) => ({
                        index: i,
                        startMs: i * 1000,
                        endMs: i * 1000 + 900,
                        text,
                        status: 'pending',
                        translation: ''
                    }));
                }
            }
        }
    });
    vm.runInContext(source, context);

    return {
        state,
        hold,
        S: context.window.LctCaptionSession,
        overlayCount: () => created.filter(el => el.id === 'lct-caption-overlay' && el.isConnected).length,
        activeTimers: () => state.timers.size,
        listeners: () => ({ ...counters }),
        releaseCaptions() {
            const waiters = state.captionWaiters.splice(0);
            waiters.forEach(res => res());
        },
        releaseTranslation(text) {
            const ready = text === undefined
                ? state.translateWaiters.splice(0)
                : state.translateWaiters.filter(w => w.text === text);
            for (const waiter of ready) {
                const at = state.translateWaiters.indexOf(waiter);
                if (at >= 0) state.translateWaiters.splice(at, 1);
                waiter.release();
            }
        }
    };
}

// 1. Two enable() calls while the track list is loading: newest wins, one session.
{
    const h = createHarness();
    h.state.cueTexts = ['a1', 'a2', 'a3'];
    h.hold.captions = true;

    const first = h.S.enable('ja');
    const second = h.S.enable('ja');
    check('double enable: status reports loading, not enabled',
        h.S.status().enabling === true && h.S.status().enabled === false, h.S.status());

    h.releaseCaptions();
    const [older, newer] = await Promise.all([first, second]);
    check('double enable: newest request installs the session',
        newer.ok === true && newer.enabled === true, newer);
    check('double enable: older request reports cancelled',
        older.ok === true && older.cancelled === true, older);
    check('double enable: exactly one overlay',
        h.overlayCount() === 1, h.overlayCount());
    check('double enable: exactly one timer',
        h.activeTimers() === 1, h.activeTimers());
    check('double enable: one set of video listeners',
        h.listeners().timeupdate === 1 && h.listeners().seeked === 1, h.listeners());
    check('double enable: status settles',
        h.S.status().enabled === true && h.S.status().enabling === false, h.S.status());

    await flush();
    check('double enable: cues are translated one at a time',
        h.state.maxInFlight === 1 && h.state.sentTexts.join(',') === 'a1,a2,a3',
        { maxInFlight: h.state.maxInFlight, sent: h.state.sentTexts });

    h.S.disable({ notify: false });
    check('disable: removes overlay, timer and listeners',
        h.overlayCount() === 0 && h.activeTimers() === 0
        && h.listeners().timeupdate === 0 && h.listeners().seeked === 0,
        { overlays: h.overlayCount(), timers: h.activeTimers(), listeners: h.listeners() });
}

// 2. disable() while captions are loading cancels the in-flight enable.
{
    const h = createHarness();
    h.state.cueTexts = ['b1'];
    h.hold.captions = true;

    const pending = h.S.enable('ja');
    check('cancel: status reports loading before disable',
        h.S.status().enabling === true && h.S.status().enabled === false, h.S.status());

    const off = h.S.disable({ notify: false });
    h.releaseCaptions();
    const late = await pending;

    check('cancel: disable() returns off', off.ok === true && off.enabled === false, off);
    check('cancel: late enable resolves cancelled',
        late.ok === true && late.cancelled === true && late.enabled === false, late);
    check('cancel: nothing is installed',
        h.S.status().enabled === false && h.S.status().enabling === false, h.S.status());
    check('cancel: cues are never fetched', h.state.loads === 0, h.state.loads);
    check('cancel: no overlay, timer or listener leaks',
        h.overlayCount() === 0 && h.activeTimers() === 0
        && h.listeners().timeupdate === 0 && h.listeners().seeked === 0,
        { overlays: h.overlayCount(), timers: h.activeTimers(), listeners: h.listeners() });
}

// 3. A drain() that outlives its session must not touch the replacement.
{
    const h = createHarness();
    h.state.cueTexts = ['a1', 'a2', 'a3'];
    h.hold.translate = true;
    await h.S.enable('ja');
    check('stale drain: first cue is in flight when replacing',
        h.state.sentTexts.join(',') === 'a1' && h.state.inFlight === 1,
        { sent: h.state.sentTexts, inFlight: h.state.inFlight });

    // Replace the session while a1 is still waiting for the model.
    h.state.cueTexts = ['b1', 'b2', 'b3'];
    await h.S.enable('ja');
    check('stale drain: replacement owns the overlay and timer',
        h.overlayCount() === 1 && h.activeTimers() === 1,
        { overlays: h.overlayCount(), timers: h.activeTimers() });

    // Let the old translation finish: its loop must stop, not drain the new queue.
    h.releaseTranslation('a1');
    await flush();
    check('stale drain: old session stops after its in-flight cue',
        h.state.sentTexts.join(',') === 'a1,b1', h.state.sentTexts);
    check('stale drain: old cues are dropped, new cues are not taken',
        !h.state.sentTexts.includes('a2') && !h.state.sentTexts.includes('a3'),
        h.state.sentTexts);

    h.hold.translate = false;
    h.releaseTranslation();
    await flush();
    check('stale drain: replacement completes its own cues in order',
        h.state.sentTexts.join(',') === 'a1,b1,b2,b3', h.state.sentTexts);
    check('stale drain: every new cue is sent exactly once',
        ['b1', 'b2', 'b3'].every(text => h.state.sentTexts.filter(x => x === text).length === 1),
        h.state.sentTexts);

    h.S.disable({ notify: false });
    check('stale drain: disable still cleans up',
        h.overlayCount() === 0 && h.activeTimers() === 0 && h.listeners().timeupdate === 0,
        { overlays: h.overlayCount(), timers: h.activeTimers(), listeners: h.listeners() });
}

// 4. Replacing an already-running session keeps a single overlay/timer, and the
// translation memory avoids re-sending cues that did not change.
{
    const h = createHarness();
    h.state.cueTexts = ['c1'];
    await h.S.enable('ja');
    await h.S.enable('ja');
    check('replace: still exactly one overlay and timer',
        h.overlayCount() === 1 && h.activeTimers() === 1 && h.listeners().timeupdate === 1,
        { overlays: h.overlayCount(), timers: h.activeTimers(), listeners: h.listeners() });
    check('replace: unchanged cue is not translated twice',
        h.state.sentTexts.join(',') === 'c1', h.state.sentTexts);
    h.S.disable({ notify: false });
}

let failed = 0;
for (const [name, pass, extra] of results) {
    console.log(pass ? 'PASS' : 'FAIL', name, pass ? '' : JSON.stringify(extra));
    if (!pass) failed++;
}
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
