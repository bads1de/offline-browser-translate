/**
 * YouTube caption session: playback sync, translation queue and overlay.
 *
 * Translations go through the existing background TRANSLATE path one cue at a
 * time (silentPartials keeps them off the page-DOM replacement pipeline).
 */
(() => {
    'use strict';
    if (window.LctCaptionSession) return;

    const PREFETCH_AHEAD_MS = 20000;
    const FAILURE_BACKOFF_MS = 30000;
    const FAILURE_THRESHOLD = 3;
    const TICK_MS = 250;
    const MEMORY_LIMIT = 1000;

    const Parser = window.LctCaptionParser;
    const Fetcher = window.LctCaptionFetcher;

    // Resolved on use, not at load: content.js may be injected after these
    // modules (a re-injection of content.js aborts further files).
    function Bridge() {
        const bridge = window.LctBridge;
        if (!bridge) throw new Error('caption bridge unavailable');
        return bridge;
    }

    let session = null;   // null while disabled
    let mode = 'replace'; // 'replace' | 'bilingual'
    let memory = new Map();
    let queue = [];
    let draining = false;

    const ja = () => (navigator.language || '').toLowerCase().startsWith('ja');
    const t = (en, jp) => (ja() ? jp : en);
    const debug = (...args) => {
        if (window.LctCaptionDebugEnabled || localStorage.getItem('lctCaptionDebug') === '1') {
            console.log('[Captions]', ...args);
        }
    };

    const isWatchPage = () => {
        const h = location.hostname;
        return (h === 'www.youtube.com' || h === 'm.youtube.com' || h === 'youtube.com')
            && location.pathname === '/watch';
    };

    const videoId = () => {
        try { return new URL(location.href).searchParams.get('v') || ''; } catch (e) { return ''; }
    };

    const playerEl = () => document.getElementById('movie_player')
        || document.querySelector('.html5-video-player')
        || document.querySelector('#player');

    // ---------------------------------------------------------------- overlay

    function ensureOverlay() {
        if (!session) return;
        if (session.overlay.host) {
            // The SPA can replace the player element underneath us.
            if (!session.overlay.host.isConnected) attachOverlay();
            return;
        }
        const host = document.createElement('div');
        host.id = 'lct-caption-overlay';
        host.setAttribute('translate', 'no');
        host.style.cssText = 'position:absolute;left:0;right:0;bottom:8%;display:flex;justify-content:center;pointer-events:none;z-index:60;';
        const root = host.attachShadow({ mode: 'closed' });
        const style = document.createElement('style');
        style.textContent = `
.status{display:none;font:12px/1.4 'YouTube Noto',Roboto,Arial,sans-serif;color:#fff;background:rgba(180,30,30,.85);padding:2px 10px;border-radius:4px;margin-bottom:6px;text-align:center;max-width:80%;}
.cue-orig{font:400 clamp(11px,1.8vmin,22px)/1.3 'YouTube Noto',Roboto,Arial,sans-serif;color:#fff;background:rgba(0,0,0,.6);padding:3px 10px 1px;border-radius:6px 6px 0 0;max-width:88%;text-align:center;white-space:pre-wrap;text-shadow:0 1px 2px rgba(0,0,0,.6);}
.cue{font:600 clamp(14px,2.4vmin,30px)/1.35 'YouTube Noto',Roboto,'Hiragino Kaku Gothic ProN',Meiryo,sans-serif;color:#fff;background:rgba(0,0,0,.72);padding:4px 14px;border-radius:6px;max-width:88%;text-align:center;white-space:pre-wrap;text-shadow:0 1px 2px rgba(0,0,0,.6);}
.cue[data-pending="1"]{opacity:.85;}
.cue-orig:empty{display:none;}
.wrap{display:flex;flex-direction:column;align-items:center;gap:0;}
`;
        const wrap = document.createElement('div');
        wrap.className = 'wrap';
        const status = document.createElement('div');
        status.className = 'status';
        const orig = document.createElement('div');
        orig.className = 'cue-orig';
        const cue = document.createElement('div');
        cue.className = 'cue';
        cue.setAttribute('data-pending', '1');
        wrap.append(status, orig, cue);
        root.append(style, wrap);

        session.overlay = { host, status, orig, cue };
        attachOverlay();
    }

    function attachOverlay() {
        const player = playerEl();
        if (!player || !session || !session.overlay.host) return;
        if (getComputedStyle(player).position === 'static') player.style.position = 'relative';
        player.appendChild(session.overlay.host);
    }

    function setStatus(text) {
        if (!session) return;
        session.overlay.status.textContent = text || '';
        session.overlay.status.style.display = text ? 'inline-block' : 'none';
    }

    function paint() {
        if (!session || !session.video) return;
        ensureOverlay();
        const { cue, orig } = session.overlay;

        // Re-attach the mode in case it changed while a cue is on screen.
        const bilingual = mode === 'bilingual' && !session.passthrough;
        const current = Parser.findCue(session.cues, session.video.currentTime * 1000);

        if (!current) {
            cue.textContent = '';
            orig.textContent = '';
            return;
        }
        orig.textContent = bilingual ? current.text : '';
        cue.textContent = current.status === 'done' ? (current.translation || current.text) : current.text;
        cue.setAttribute('data-pending', current.status === 'done' || current.status === 'failed' ? '0' : '1');
        if (current.status === 'done') setStatus('');
    }

    function hideNativeCaptions(hide) {
        const id = 'lct-caption-native-hide';
        const existing = document.getElementById(id);
        if (hide) {
            if (existing) return;
            const style = document.createElement('style');
            style.id = id;
            style.textContent = '.ytp-caption-window-container{display:none !important;}';
            document.head.appendChild(style);
        } else if (existing) {
            existing.remove();
        }
    }

    // ------------------------------------------------------------- translation

    function clean(text) {
        let out = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        out = out.replace(/\s+/g, ' ');
        if (out.length >= 2 && ((out[0] === '"' && out.endsWith('"')) || (out[0] === '“' && out.endsWith('”')))) {
            out = out.slice(1, -1).trim();
        }
        return out;
    }

    async function translate(text) {
        const key = `${session.sourceLanguage}|${session.targetLanguage}|${text}`;
        if (memory.has(key)) return memory.get(key);

        const res = await Bridge().send({
            type: 'TRANSLATE',
            texts: [{ id: 1, text, priority: 10 }],
            targetLanguage: session.targetLanguage,
            sourceLanguage: session.sourceLanguage,
            silentPartials: true
        });
        if (!res) throw new Error('no response from background');
        if (res.error) throw new Error(res.error);

        const ok = (res.translations || []).find(x => x && x.text && !x.error);
        if (!ok) {
            const bad = (res.translations || []).find(x => x && x.error);
            throw new Error(bad ? bad.error : 'translation missing in response');
        }
        const out = clean(ok.text);
        if (!out) throw new Error('empty translation');

        memory.set(key, out);
        if (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value);
        return out;
    }

    function enqueue(cue) {
        if (!cue || cue.status !== 'pending') return;
        cue.status = 'queued';
        queue.push(cue);
        drain();
    }

    async function drain() {
        if (draining) return;
        draining = true;
        while (queue.length > 0) {
            const cue = queue.shift();
            // Session replaced (disable / navigation / language change).
            if (!session || cue._generation !== session.generation) continue;
            if (cue.status !== 'queued') continue;

            if (session.backoffUntil > Date.now()) {
                cue.status = 'failed';
                continue;
            }

            cue.status = 'inflight';
            paint();
            try {
                cue.translation = await translate(cue.text);
                if (session && cue._generation === session.generation) {
                    cue.status = 'done';
                    session.failures = 0;
                }
            } catch (e) {
                debug('translation failed:', e.message);
                cue.status = 'failed';
                cue.translation = '';
                if (session && cue._generation === session.generation) {
                    session.failures++;
                    if (session.failures >= FAILURE_THRESHOLD) {
                        session.backoffUntil = Date.now() + FAILURE_BACKOFF_MS;
                        setStatus(t('Caption translation failed. Check your local LLM.',
                            '字幕の翻訳に失敗しました。ローカル LLM を確認してください。'));
                    }
                }
            }
            paint();
        }
        draining = false;
    }

    function prefetch() {
        if (!session || !session.video) return;
        const nowMs = session.video.currentTime * 1000;
        const rate = session.video.playbackRate > 0 ? session.video.playbackRate : 1;
        const horizon = nowMs + PREFETCH_AHEAD_MS * rate;
        for (const cue of session.cues) {
            if (cue.startMs > horizon) break;
            if (cue.status === 'pending' && cue.endMs > nowMs - 1000) enqueue(cue);
        }
    }

    // ------------------------------------------------------------------ session

    function teardown() {
        if (!session) return;
        session.generation++;
        queue.length = 0;
        draining = false;
        clearInterval(session.timer);
        if (session.handlers && session.video) {
            session.video.removeEventListener('timeupdate', session.handlers.tick);
            session.video.removeEventListener('seeked', session.handlers.seek);
        }
        if (session.overlay.host) session.overlay.host.remove();
        session = null;
        hideNativeCaptions(false);
    }

    function disable({ notify = true } = {}) {
        const wasEnabled = !!session;
        teardown();
        if (notify && wasEnabled) {
            Bridge().toast(t('Caption translation disabled', '字幕翻訳をオフにしました'));
        }
        return { ok: true, enabled: false };
    }

    async function enable(targetLanguage) {
        if (!isWatchPage()) {
            return { ok: false, error: t('Open a YouTube watch page first', 'YouTube の動画ページでのみ使えます') };
        }
        const video = document.querySelector('video');
        if (!video) {
            return { ok: false, error: t('Video player not found', '動画プレイヤーが見つかりません') };
        }
        if (session) disable({ notify: false });

        let info;
        try {
            info = await Bridge().send({ type: 'GET_PLAYER_CAPTIONS' });
        } catch (e) {
            return { ok: false, error: e.message };
        }
        if (!info || info.error || !(info.tracks || []).length) {
            return { ok: false, error: t('No caption tracks found (does this video have captions?)',
                '字幕トラックが見つかりません（この動画に字幕があるか確認してください）') };
        }

        const target = Parser.normalizeLangCode(targetLanguage) || 'en';
        const track = Parser.pickTrack(info.tracks, info.defaultAudioLanguage, target);
        if (!track) {
            return { ok: false, error: t('No usable caption track', '使える字幕トラックがありません') };
        }

        let cues;
        try {
            cues = await Fetcher.loadCues(track, { onDebug: debug });
        } catch (e) {
            return { ok: false, error: `${t('Could not fetch captions', '字幕を取得できませんでした')} (${e.message})` };
        }

        const sourceLanguage = Parser.normalizeLangCode(track.languageCode) || 'en';
        session = {
            video,
            track,
            videoId: info.videoId || videoId(),
            sourceLanguage,
            targetLanguage: target,
            passthrough: sourceLanguage === target,
            cues,
            generation: 0,
            failures: 0,
            backoffUntil: 0,
            overlay: { host: null, status: null, orig: null, cue: null },
            handlers: null,
            timer: null
        };
        for (const cue of cues) {
            cue._generation = 0;
            cue.status = session.passthrough ? 'done' : 'pending';
            cue.translation = session.passthrough ? cue.text : '';
        }

        ensureOverlay();
        hideNativeCaptions(true);

        session.handlers = {
            tick: () => { paint(); prefetch(); },
            seek: () => {
                // Drop stale queued work; in-flight translations stay valid.
                for (const cue of session.cues) if (cue.status === 'queued') cue.status = 'pending';
                queue.length = 0;
                paint();
                prefetch();
            }
        };
        video.addEventListener('timeupdate', session.handlers.tick, { passive: true });
        video.addEventListener('seeked', session.handlers.seek, { passive: true });
        session.timer = setInterval(session.handlers.tick, TICK_MS);

        session.handlers.tick();
        Bridge().toast(t('Caption translation enabled', '字幕翻訳をオンにしました'));
        return { ok: true, enabled: true, passthrough: session.passthrough, track: sourceLanguage };
    }

    async function rebuildForLanguage(language) {
        if (!session || Parser.normalizeLangCode(language) === session.targetLanguage) return;
        teardown();
        await enable(language);
    }

    // ------------------------------------------------------------------- wiring

    function status() {
        return {
            enabled: !!session,
            watchPage: isWatchPage(),
            sourceLanguage: session ? session.sourceLanguage : null,
            passthrough: session ? session.passthrough : false
        };
    }

    function setMode(next) {
        mode = next === 'bilingual' ? 'bilingual' : 'replace';
        paint();
        return mode;
    }

    document.addEventListener('yt-navigate-finish', async () => {
        if (!session) return;
        if (!isWatchPage()) return disable({ notify: false });
        const id = videoId();
        if (id && session.videoId && id === session.videoId) return;
        const language = session.targetLanguage;
        teardown();
        await enable(language);
    }, { passive: true });

    window.LctCaptionSession = {
        enable, disable, status, setMode, rebuildForLanguage, isWatchPage, debugEnabled: false
    };
})();
