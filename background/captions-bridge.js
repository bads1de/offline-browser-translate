/**
 * YouTube caption bridge: page-world timedtext fetch and player-driven capture.
 *
 * Exposed as `LctBgCaptions` on the global object. Loaded by background/entry.js
 * (importScripts) and by manifest `background.scripts` for Firefox.
 */

(function (root) {
    'use strict';
    if (root.LctBgCaptions) return;
    const { browserAPI } = root.LctBgCore;

// ============================================================================
// Timedtext fetch bridge
// The content script runs in an isolated world, so its fetch would carry the
// extension origin and get CORS/pot-checked by YouTube. The player already
// holds a baseUrl for the same track, so we execute the GET in the page's
// MAIN world with credentials included and hand the raw body back. Host name
// +/watch +/api/timedtext are the only shape allowed.
// ============================================================================
const TIMEDTEXT_ALLOWED_HOSTS = new Set(['www.youtube.com', 'm.youtube.com', 'youtube.com']);

// Read the caption track list from the page's player. The isolated content
// script world cannot see ytInitialPlayerResponse / the movie_player object,
// so this runs in the MAIN world and hands back a plain JSON shape only.
async function getPlayerCaptionsFromPage(tabId) {
    if (typeof tabId !== 'number') throw new Error('No tab id');
    const result = await browserAPI.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
            try {
                const player = document.getElementById('movie_player');
                let pr = null;
                if (player && typeof player.getPlayerResponse === 'function') {
                    try { pr = player.getPlayerResponse(); } catch (e) { pr = null; }
                }
                if (!pr && typeof window.ytInitialPlayerResponse === 'object') {
                    pr = window.ytInitialPlayerResponse;
                }
                if (!pr) return { error: 'NO_PLAYER_RESPONSE' };
                const trackRoot = pr.captions && pr.captions.playerCaptionsTracklistRenderer;
                const tracks = trackRoot && Array.isArray(trackRoot.captionTracks) ? trackRoot.captionTracks : [];
                const vd = pr.videoDetails || {};
                const pickName = (n) => (n && (n.simpleText || (Array.isArray(n.runs) ? n.runs.map(r => r.utf8 || '').join('') : ''))) || '';
                return {
                    videoId: vd.videoId || '',
                    title: vd.title || '',
                    defaultAudioLanguage: vd.defaultAudioLanguage
                        || (Array.isArray(vd.audioTracks) && vd.audioTracks[0] && vd.audioTracks[0].audioTrackId)
                        || '',
                    tracks: tracks.map(tr => ({
                        baseUrl: tr.baseUrl || '',
                        languageCode: tr.languageCode || '',
                        kind: tr.kind || '',
                        name: pickName(tr.name),
                        vssId: tr.vssId || ''
                    })).filter(tr => tr.baseUrl)
                };
            } catch (e) {
                return { error: String(e && e.message || e) };
            }
        }
    });
    const payload = result && result[0] && result[0].result;
    if (!payload) throw new Error('No response from page');
    return payload;
}

// ============================================================================
// Player-driven caption capture
//
// A bare /api/timedtext GET now comes back 200 with an empty body unless it
// carries the player's proof-of-origin token, which only the player can mint.
// So instead of fetching the track ourselves, we let the player fetch it while
// a temporary hook records the response.
//
// The hook is installed only for the duration of the capture and then put
// back, so nothing is left patched on youtube.com afterwards. The armed wait
// resolves on the first usable response instead of polling.
// ============================================================================

const CAPTURE_TIMEOUT_MS = 8000;

// Arms (or re-arms) the hook and asks the player to load the track. The caller
// must release the capture afterwards so nothing stays patched on the page.
async function armCaptionCapture(tabId, track) {
    if (typeof tabId !== 'number') throw new Error('No tab id');
    const result = await browserAPI.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        args: [track || {}],
        func: async (wanted) => {
            const W = window;
            const isTimedtext = (u) => typeof u === 'string' && u.indexOf('/api/timedtext') >= 0;

            // Release any previous hook before installing a new one, so a failed
            // or abandoned capture can never leave fetch patched.
            if (W.__lctCaptionCapture && typeof W.__lctCaptionCapture.release === 'function') {
                try { W.__lctCaptionCapture.release(); } catch (e) { /* ignore */ }
            }

            const state = { responses: [], waiters: [] };
            const settle = (response) => {
                state.responses.push(response);
                const waiters = state.waiters.splice(0, state.waiters.length);
                for (const waiter of waiters) waiter.resolve(state.responses.slice());
            };
            const record = (url, text) => {
                const body = typeof text === 'string' ? text : '';
                if (!body.trim()) return;
                settle({ url: String(url || ''), text: body });
            };

            const origFetch = W.fetch;
            const origOpen = W.XMLHttpRequest.prototype.open;
            const onFetch = function (input) {
                const url = typeof input === 'string' ? input : (input && input.url) || '';
                const promise = origFetch.apply(this, arguments);
                if (isTimedtext(url)) {
                    promise.then(r => r.clone().text()).then(t => record(url, t)).catch(() => { });
                }
                return promise;
            };
            const onOpen = function (method, url) {
                if (isTimedtext(String(url))) {
                    this.addEventListener('load', function () {
                        try { record(url, this.responseText); } catch (e) { /* ignore */ }
                    });
                }
                return origOpen.apply(this, arguments);
            };

            W.fetch = onFetch;
            W.XMLHttpRequest.prototype.open = onOpen;

            const capture = {
                responses: state.responses,
                // Resolves once responses beyond `seen` exist, so the caller can
                // keep waiting for a better match; a bare resolve([]) means the
                // deadline passed with nothing new.
                wait(ms, seen) {
                    const already = state.responses.length;
                    if (already > (seen || 0)) return Promise.resolve(state.responses.slice());
                    return new Promise((resolve) => {
                        const timer = setTimeout(() => {
                            state.waiters = state.waiters.filter(w => w !== waiter);
                            resolve(state.responses.slice());
                        }, ms);
                        const waiter = { resolve: (responses) => { clearTimeout(timer); resolve(responses); } };
                        state.waiters.push(waiter);
                    });
                },
                release() {
                    if (W.fetch === onFetch) W.fetch = origFetch;
                    if (W.XMLHttpRequest.prototype.open === onOpen) {
                        W.XMLHttpRequest.prototype.open = origOpen;
                    }
                    if (W.__lctCaptionCapture === capture) delete W.__lctCaptionCapture;
                }
            };
            W.__lctCaptionCapture = capture;

            const player = document.getElementById('movie_player');
            if (!player || typeof player.setOption !== 'function') {
                capture.release();
                return { error: 'NO_PLAYER' };
            }

            // Keep the whole track object: restoring a rebuilt {languageCode,
            // kind} pair loses baseUrl/name/vssId and leaves captions broken.
            let previous = null;
            try { previous = player.getOption('captions', 'track') || null; } catch (e) { previous = null; }

            try {
                if (typeof player.loadModule === 'function') await player.loadModule('captions');
            } catch (e) { /* module may already be loaded */ }

            try {
                // Toggle off first so the player re-fetches instead of reusing
                // the track it already has in memory.
                player.setOption('captions', 'track', {});
                await new Promise(r => setTimeout(r, 80));
                player.setOption('captions', 'track', wanted);
                player.setOption('captions', 'reload', true);
            } catch (e) {
                capture.release();
                return { error: 'SET_OPTION_FAILED: ' + String(e && e.message || e) };
            }

            return { ok: true, previous };
        }
    });
    const payload = result && result[0] && result[0].result;
    if (!payload) throw new Error('No response from page');
    return payload;
}

async function waitForCaptionCapture(tabId, timeoutMs, wantedLang) {
    const result = await browserAPI.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        args: [timeoutMs, wantedLang || ''],
        func: async (ms, wanted) => {
            const capture = window.__lctCaptionCapture;
            if (!capture) return { responses: [] };
            const matches = (url) => {
                if (!wanted) return false;
                const m = /[?&]lang=([^&]+)/.exec(String(url || ''));
                return !!m && decodeURIComponent(m[1]).toLowerCase().split('-')[0] === wanted;
            };
            const deadline = Date.now() + ms;
            let seen = 0;
            let responses = [];
            // A track switch can make the player fetch more than one track, and
            // the first body is not always the one asked for. Wait for a
            // matching language when the caller named one; otherwise take the
            // first usable body.
            while (Date.now() < deadline) {
                responses = await capture.wait(Math.min(1500, deadline - Date.now()), seen);
                seen = responses.length;
                if (responses.some(r => matches(r.url))) return { responses };
                if (responses.length > 0 && !wanted) return { responses };
            }
            return { responses };
        }
    });
    const payload = result && result[0] && result[0].result;
    return (payload && payload.responses) || [];
}

async function releaseCaptionCapture(tabId, previous) {
    try {
        await browserAPI.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            args: [previous || null],
            func: (prev) => {
                const capture = window.__lctCaptionCapture;
                if (capture && typeof capture.release === 'function') {
                    try { capture.release(); } catch (e) { /* ignore */ }
                }
                const player = document.getElementById('movie_player');
                if (!player || typeof player.setOption !== 'function') return false;
                try {
                    player.setOption('captions', 'track', prev || {});
                } catch (e) { /* nothing to restore to */ }
                return true;
            }
        });
    } catch (e) { /* best effort */ }
}

// Ask the player to load the track and wait for the timedtext body it fetches.
async function captureCaptionsViaPlayer(tabId, track) {
    const armed = await armCaptionCapture(tabId, track);
    if (armed.error) throw new Error(armed.error);
    try {
        const wanted = String(track.languageCode || '').toLowerCase().split('-')[0];
        const responses = await waitForCaptionCapture(tabId, CAPTURE_TIMEOUT_MS, wanted);
        return (responses || []).filter(r => r && r.text && r.text.trim());
    } finally {
        await releaseCaptionCapture(tabId, armed.previous);
    }
}

async function fetchTimedtextInPage(tabId, url) {
    if (typeof tabId !== 'number') throw new Error('No tab id');
    let parsed;
    try { parsed = new URL(url); } catch (e) { throw new Error('Invalid timedtext URL'); }
    if (parsed.protocol !== 'https:') throw new Error('Only https timedtext URLs are allowed');
    if (!TIMEDTEXT_ALLOWED_HOSTS.has(parsed.hostname)) throw new Error('Only youtube.com timedtext URLs are allowed');
    if (!parsed.pathname.startsWith('/api/timedtext')) throw new Error('Only /api/timedtext paths are allowed');

    const result = await browserAPI.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        args: [url],
        func: async (targetUrl) => {
            try {
                const resp = await fetch(targetUrl, {
                    method: 'GET',
                    credentials: 'include',
                    redirect: 'follow'
                });
                const text = await resp.text();
                return { ok: resp.ok, status: resp.status, text };
            } catch (e) {
                return { ok: false, status: 0, text: '', error: String(e && e.message || e) };
            }
        }
    });
    const payload = result && result[0] && result[0].result;
    if (!payload) throw new Error('No response from page fetch');
    return payload;
}

    root.LctBgCaptions = {
        getPlayerCaptionsFromPage,
        captureCaptionsViaPlayer,
        fetchTimedtextInPage
    };
})(typeof self !== 'undefined' ? self : globalThis);
