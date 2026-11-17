/**
 * YouTube caption fetching.
 *
 * A bare /api/timedtext GET returns 200 with an empty body because only the
 * player can attach the proof-of-origin token. So the preferred path asks the
 * player to load the track and captures the body it fetched; a direct fetch
 * stays as a fallback for builds whose baseUrl still works.
 */
(() => {
    'use strict';
    if (window.LctCaptionFetcher) return;

    const DIRECT_FORMATS = ['json3', 'vtt', 'srv3'];

    function send(message) {
        const bridge = window.LctBridge;
        if (!bridge) throw new Error('caption bridge unavailable');
        return bridge.send(message);
    }

    async function captureFromPlayer(track) {
        const res = await send({
            type: 'CAPTURE_PLAYER_CAPTIONS',
            track: {
                languageCode: track.languageCode,
                kind: track.kind,
                vssId: track.vssId,
                baseUrl: track.baseUrl
            }
        });
        if (!res || !res.ok) {
            throw new Error((res && res.error) || 'player capture failed');
        }
        // Several timedtext responses can land (the player may fetch more than
        // the track we asked for). Prefer the one carrying the wanted language.
        const wanted = window.LctCaptionParser.normalizeLangCode(track.languageCode);
        const scored = (res.responses || []).map(r => {
            const cues = window.LctCaptionParser.parsePayload(r.text);
            const lang = /[?&]lang=([^&]+)/.exec(r.url || '');
            const match = lang && window.LctCaptionParser.normalizeLangCode(lang[1]) === wanted;
            return { cues, score: cues.length + (match ? 1000 : 0) };
        }).filter(s => s.cues.length > 0).sort((a, b) => b.score - a.score);
        return scored.length ? scored[0].cues : [];
    }

    async function fetchDirect(track) {
        let lastError = null;
        for (const fmt of DIRECT_FORMATS) {
            const url = window.LctCaptionParser.buildTimedtextUrl(track.baseUrl, fmt);
            try {
                const res = await send({ type: 'FETCH_TIMEDTEXT', url });
                if (!res || !res.ok) throw new Error((res && res.error) || 'timedtext fetch failed');
                const cues = window.LctCaptionParser.parsePayload(res.text);
                if (cues.length) return cues;
                lastError = new Error('empty response body');
            } catch (e) {
                lastError = e;
            }
        }
        if (lastError) throw lastError;
        return [];
    }

    // Returns assembled cues, or throws with the most useful reason available.
    async function loadCues(track, { onDebug } = {}) {
        const debug = onDebug || (() => {});
        let lastError = null;

        try {
            const captured = await captureFromPlayer(track);
            debug('player capture:', captured.length, 'cues');
            if (captured.length) return window.LctCaptionParser.assemble(captured);
        } catch (e) {
            lastError = e;
            debug('player capture failed:', e.message);
        }

        try {
            const direct = await fetchDirect(track);
            debug('direct fetch:', direct.length, 'cues');
            if (direct.length) return window.LctCaptionParser.assemble(direct);
        } catch (e) {
            lastError = e;
            debug('direct fetch failed:', e.message);
        }

        throw lastError || new Error('no caption cues found');
    }

    window.LctCaptionFetcher = { loadCues };
})();
