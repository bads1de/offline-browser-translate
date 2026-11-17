/**
 * YouTube caption parsing helpers.
 *
 * Pure functions: no DOM state, no messaging. Exposed on
 * window.LctCaptionParser so the content scripts can share them and the tools
 * self-test can load this file directly.
 */
(() => {
    'use strict';
    if (window.LctCaptionParser) return;

    const CAPTION_MAX_CHARS = 200;
    const CAPTION_MAX_SPAN_MS = 10000;
    const CAPTION_SENTENCE_END = /[.!?。！？]["')\]」』）】]*$/;
    const CJK = /[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef]/;

    // "en-US" -> "en"; ASR ids look like "a.ja".
    function normalizeLangCode(code) {
        if (!code) return '';
        const c = String(code).trim().toLowerCase();
        const asr = c.match(/^[a-z]+\.([a-z-]+)/);
        return (asr ? asr[1] : c).split('-')[0];
    }

    // Prefer the spoken language (manual, then ASR) over an English fallback so
    // we translate what the video actually says, not a translation of it.
    function pickTrack(tracks, defaultAudioLanguage, targetLanguage) {
        const target = normalizeLangCode(targetLanguage);
        const audio = normalizeLangCode(defaultAudioLanguage);
        const list = (tracks || []).filter(t => t && t.baseUrl);
        if (list.length === 0) return null;
        const find = (lang, asr) => list.find(t =>
            normalizeLangCode(t.languageCode) === lang && ((t.kind || '') === 'asr') === asr);
        return (audio && (find(audio, false) || find(audio, true)))
            || find('en', false)
            || find('en', true)
            || list.find(t => normalizeLangCode(t.languageCode) !== target)
            || list[0];
    }

    function buildTimedtextUrl(baseUrl, fmt) {
        try {
            const u = new URL(baseUrl);
            u.searchParams.set('fmt', fmt);
            u.searchParams.delete('tlang');
            return u.toString();
        } catch (e) {
            return baseUrl;
        }
    }

    function parseJson3(text) {
        const data = JSON.parse(text);
        const cues = [];
        for (const ev of Array.isArray(data.events) ? data.events : []) {
            if (!ev || typeof ev.tStartMs !== 'number') continue;
            const segs = Array.isArray(ev.segs) ? ev.segs : [];
            const cleaned = segs.map(s => (s && s.utf8) || '').join('')
                .replace(/\r/g, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
            if (!cleaned) continue;
            cues.push({
                startMs: ev.tStartMs,
                endMs: ev.tStartMs + (typeof ev.dDurationMs === 'number' ? ev.dDurationMs : 0),
                text: cleaned
            });
        }
        return cues;
    }

    function parseVtt(text) {
        const timeToMs = (s) => {
            const m = String(s).trim().match(/(\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d+))?/);
            if (!m) return null;
            const frac = m[4] ? +String(m[4]).padEnd(3, '0').slice(0, 3) : 0;
            return ((+m[1]) * 3600 + (+m[2]) * 60 + (+m[3])) * 1000 + frac;
        };
        const cues = [];
        for (const block of String(text).replace(/\r/g, '').split(/\n\n+/)) {
            const lines = block.split('\n').filter(l => l.trim());
            const timeIdx = lines.findIndex(l => l.includes('-->'));
            if (timeIdx < 0) continue;
            const parts = lines[timeIdx].split('-->');
            if (parts.length !== 2) continue;
            const startMs = timeToMs(parts[0]);
            if (startMs === null) continue;
            const cleaned = lines.slice(timeIdx + 1).join(' ')
                .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (!cleaned) continue;
            const endMs = timeToMs(parts[1].trim().split(/\s+/)[0]);
            cues.push({ startMs, endMs: endMs === null ? startMs + 2000 : endMs, text: cleaned });
        }
        return cues;
    }

    // srv3: <timedtext><p t="ms" d="ms">...</p></timedtext>
    function parseSrv3(text) {
        const doc = new DOMParser().parseFromString(String(text), 'text/xml');
        if (doc.getElementsByTagName('parsererror').length > 0) return [];
        const cues = [];
        for (const p of Array.from(doc.getElementsByTagName('p'))) {
            const startMs = parseInt(p.getAttribute('t') || '', 10);
            if (!isFinite(startMs)) continue;
            const durMs = parseInt(p.getAttribute('d') || '', 10);
            const cleaned = (p.textContent || '')
                .replace(/\r/g, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
            if (!cleaned) continue;
            cues.push({ startMs, endMs: startMs + (isFinite(durMs) ? durMs : 0), text: cleaned });
        }
        return cues;
    }

    // The server can ignore the requested fmt, so sniff the body. An empty or
    // truncated payload means "no cues here" rather than a hard failure.
    function parsePayload(text) {
        const body = String(text || '').trim();
        if (!body) return [];
        try {
            if (body.startsWith('{')) return parseJson3(body);
            if (body.startsWith('<')) return parseSrv3(body);
            if (body.startsWith('WEBVTT')) return parseVtt(body);
        } catch (e) {
            return [];
        }
        return [];
    }

    // Collapse rolling ASR windows (a cue repeated or extended in place) and
    // join fragments into sentence-sized cues for translation.
    function assemble(rawCues) {
        const collapsed = [];
        for (const cue of rawCues.slice().sort((a, b) => a.startMs - b.startMs)) {
            const prev = collapsed[collapsed.length - 1];
            if (prev) {
                if (cue.text === prev.text) { prev.endMs = Math.max(prev.endMs, cue.endMs); continue; }
                if (cue.text.startsWith(prev.text) && cue.text.length > prev.text.length) {
                    prev.text = cue.text;
                    prev.endMs = Math.max(prev.endMs, cue.endMs);
                    continue;
                }
            }
            collapsed.push({ ...cue });
        }

        const joined = [];
        let cur = null;
        for (const cue of collapsed) {
            if (!cur) { cur = { ...cue }; continue; }
            const glue = CJK.test(cur.text.slice(-1)) || CJK.test(cue.text.slice(0, 1)) ? '' : ' ';
            const candidate = cur.text + glue + cue.text;
            const tooLong = candidate.length > CAPTION_MAX_CHARS
                || cue.endMs - cur.startMs > CAPTION_MAX_SPAN_MS;
            if (CAPTION_SENTENCE_END.test(cur.text) || tooLong) {
                joined.push(cur);
                cur = { ...cue };
            } else {
                cur.text = candidate;
                cur.endMs = cue.endMs;
            }
        }
        if (cur) joined.push(cur);
        return joined.filter(c => c.text && isFinite(c.startMs) && isFinite(c.endMs));
    }

    // Cues overlap on ASR tracks, so find the last cue starting before the
    // playhead and walk back a little for a window that has not ended yet.
    function findCue(cues, timeMs) {
        let lo = 0, hi = cues.length - 1, idx = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (cues[mid].startMs <= timeMs) { idx = mid; lo = mid + 1; }
            else hi = mid - 1;
        }
        if (idx < 0) return null;
        if (timeMs < cues[idx].endMs) return cues[idx];
        for (let i = idx - 1; i >= Math.max(0, idx - 8); i--) {
            if (cues[i].startMs <= timeMs && timeMs < cues[i].endMs) return cues[i];
        }
        return cues[idx].endMs === cues[idx].startMs ? cues[idx] : null;
    }

    window.LctCaptionParser = {
        normalizeLangCode,
        pickTrack,
        buildTimedtextUrl,
        parseJson3,
        parseVtt,
        parseSrv3,
        parsePayload,
        assemble,
        findCue
    };
})();
