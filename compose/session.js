(function (root) {
    'use strict';

    function createSession() {
        let state = 'idle';
        let generation = 0;
        let request = null;
        let translation = '';
        let error = '';
        let replacedText = '';
        let undo = null;

        function reset() {
            state = 'idle';
            request = null;
            translation = '';
            error = '';
            replacedText = '';
            undo = null;
        }

        function begin(nextRequest) {
            generation++;
            state = 'loading';
            request = { ...nextRequest };
            translation = '';
            error = '';
            replacedText = '';
            undo = null;
            return { generation, request: { ...request } };
        }

        function resolve(resultGeneration, resultText) {
            if (resultGeneration !== generation) return { applied: false, stale: true };
            state = 'preview';
            translation = String(resultText);
            error = '';
            return { applied: true, stale: false };
        }

        function fail(resultGeneration, message) {
            if (resultGeneration !== generation) return { applied: false, stale: true };
            state = 'error';
            error = String(message || 'Translation failed');
            translation = '';
            return { applied: true, stale: false };
        }

        function noteEdit(text) {
            generation++;
            if (state === 'replaced' && text === replacedText) return;
            if (state === 'replaced') state = 'editing';
            else state = 'idle';
            request = null;
            translation = '';
            error = '';
            undo = null;
            if (state === 'idle') replacedText = '';
        }

        function invalidate(options = {}) {
            generation++;
            request = null;
            translation = '';
            error = '';
            if (state === 'replaced' && !options.clearUndo) return;
            reset();
        }

        function replace(currentText, snapshot, nextText) {
            if (state !== 'preview') return { ok: false, stale: false };
            if (!request || request.text !== currentText) {
                noteEdit(currentText);
                return { ok: false, stale: true };
            }
            generation++;
            state = 'replaced';
            undo = { ...snapshot, text: request.text };
            replacedText = String(nextText);
            request = null;
            translation = '';
            error = '';
            return { ok: true, stale: false };
        }

        function canUndo(currentText) {
            return state === 'replaced' && !!undo && currentText === replacedText;
        }

        function undoReplacement(currentText) {
            if (!canUndo(currentText)) return { ok: false, snapshot: null };
            const snapshot = { ...undo };
            generation++;
            reset();
            return { ok: true, snapshot };
        }

        function status() {
            return {
                state,
                generation,
                request: request ? { ...request } : null,
                translation,
                error,
                replacedText,
                undo: undo ? { ...undo } : null
            };
        }

        return {
            begin,
            resolve,
            fail,
            noteEdit,
            invalidate,
            replace,
            canUndo,
            undo: undoReplacement,
            status
        };
    }

    root.LctComposeSession = { createSession };
})(typeof window !== 'undefined' ? window : globalThis);
