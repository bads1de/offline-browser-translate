(function (root) {
    'use strict';

    const noopUI = {
        showTrigger() {},
        hideTrigger() {},
        showLoading() {},
        showPreview() {},
        showReplaced() {},
        showError() {},
        hidePanel() {},
        hideAll() {},
        contains() { return false; },
        destroy() {}
    };

    // Reasons a field is worth keeping active even though it cannot be
    // translated right now. An empty composer becomes eligible on the next
    // keystroke, so it must stay tracked for onInput() to re-evaluate it.
    const TRACKABLE = new Set(['empty', 'too-long', 'same-language']);

    // Editor-aware text comparison, shared with the session so both agree on
    // when a draft really changed. Falls back to a trimmed comparison.
    function sameText(a, b) {
        const shared = root.LctComposeSession && root.LctComposeSession.sameText;
        if (typeof shared === 'function') return shared(a, b);
        const normalize = text => String(text === null || text === undefined ? '' : text)
            .replace(/\r\n?/g, '\n').replace(/\s+$/u, '');
        return normalize(a) === normalize(b);
    }

    function create(options) {
        const document = options.document;
        const policy = options.policy || root.LctComposePolicy;
        const sessionFactory = options.sessionFactory || root.LctComposeSession;
        const textarea = options.textarea || root.LctComposeTextarea;
        const contenteditable = options.contenteditable || root.LctComposeContenteditable;
        const defer = options.defer || (fn => setTimeout(fn, 0));
        const allowContentEditable = !!options.allowContentEditable;
        const send = options.send || (message => {
            const api = typeof browser !== 'undefined' ? browser : chrome;
            return api.runtime.sendMessage(message);
        });

        let ui = options.ui || noopUI;
        let settings = {
            composeTranslationEnabled: false,
            composeSourceLanguage: 'auto',
            composeTargetLanguage: 'en',
            ...options.settings
        };
        let started = false;
        let activeField = null;
        let suppressInput = null;
        let applying = false;
        let copyText = '';
        const sessions = new Map();
        const snapshots = new Map();
        const composing = new Set();

        function enabled() {
            return !!settings.composeTranslationEnabled;
        }

        function adapterFor(field) {
            const kind = policy.kindOf(field, { allowContentEditable });
            if (kind === 'textarea') return textarea;
            if (kind === 'contenteditable') return contenteditable;
            return null;
        }

        function sessionFor(field) {
            if (!sessions.has(field)) {
                sessions.set(field, sessionFactory.createSession());
            }
            return sessions.get(field);
        }

        function inspect(field) {
            return policy.inspect(field, {
                allowContentEditable,
                sourceLanguage: settings.composeSourceLanguage,
                targetLanguage: settings.composeTargetLanguage
            });
        }

        function targetLabel() {
            try {
                return new Intl.DisplayNames([navigator.language || 'en'], { type: 'language' })
                    .of(settings.composeTargetLanguage);
            } catch (e) {
                return settings.composeTargetLanguage;
            }
        }

        function updateTrigger(field = activeField) {
            if (!started || !enabled() || !field || field.isConnected === false) {
                ui.hideTrigger();
                return;
            }
            const result = inspect(field);
            if (!result.ok) {
                if (result.reason === 'too-long' || result.reason === 'same-language') {
                    ui.showTrigger(field, {
                        targetLanguage: settings.composeTargetLanguage,
                        targetLabel: targetLabel(),
                        busy: false,
                        canUndo: false,
                        disabled: true,
                        reason: result.reason
                    });
                } else {
                    ui.hideTrigger();
                }
                return;
            }

            const session = sessionFor(field);
            const status = session.status();
            const adapter = adapterFor(field);
            ui.showTrigger(field, {
                targetLanguage: settings.composeTargetLanguage,
                targetLabel: targetLabel(),
                busy: status.state === 'loading' || composing.has(field),
                canUndo: adapter && session.canUndo(adapter.read(field)),
                disabled: composing.has(field),
                reason: composing.has(field) ? 'composing' : null
            });
        }

        function activate(field) {
            if (!field || field.isConnected === false) return;
            const result = inspect(field);
            if (!result.ok) {
                if (activeField && activeField !== field) {
                    sessionFor(activeField).invalidate();
                    snapshots.delete(activeField);
                }
                if (sessions.has(field)) sessionFor(field).invalidate();
                snapshots.delete(field);
                copyText = '';
                ui.hidePanel();
                // An empty draft is still a supported field: keep it active so the
                // first input event can offer the trigger. Dropping it here would
                // leave activeField null and onInput() would ignore the field for
                // the rest of the session (X's composer starts empty).
                activeField = TRACKABLE.has(result.reason) ? field : null;
                if (activeField) updateTrigger(field);
                else ui.hideAll();
                return;
            }
            if (activeField && activeField !== field) {
                sessionFor(activeField).invalidate();
                snapshots.delete(activeField);
                copyText = '';
                ui.hidePanel();
            }
            activeField = field;
            sessionFor(field);
            updateTrigger(field);
        }

        function deactivate() {
            if (activeField) sessionFor(activeField).invalidate();
            activeField = null;
            suppressInput = null;
            copyText = '';
            snapshots.clear();
            ui.hideAll();
        }

        function closePanel() {
            if (!activeField) return;
            sessionFor(activeField).invalidate();
            snapshots.delete(activeField);
            copyText = '';
            ui.hidePanel();
            updateTrigger();
        }

        function onFocusIn(event) {
            if (!enabled() || composing.has(event.target)) return;
            activate(event.target);
        }

        function onFocusOut(event) {
            if (!activeField || event.target !== activeField) return;
            const related = event.relatedTarget;
            if (related === activeField || ui.contains(related)) return;
            defer(() => {
                if (!activeField) return;
                const current = document.activeElement;
                if (current !== activeField && !ui.contains(current)) deactivate();
            });
        }

        function onInput(event) {
            if (!activeField || event.target !== activeField) return;
            if (suppressInput === event.target) {
                updateTrigger();
                return;
            }
            if (composing.has(event.target)) return;
            const adapter = adapterFor(event.target);
            if (!adapter) return;
            const session = sessionFor(event.target);
            const text = adapter.read(event.target);
            // Framework editors fire input while re-rendering the text we just
            // wrote (e.g. adding a trailing empty block). That is not a user
            // edit, so the replaced state and its undo snapshot must survive it.
            if (session.status().state === 'replaced' && sameText(text, session.status().replacedText)) {
                updateTrigger();
                return;
            }
            session.noteEdit(text);
            snapshots.delete(event.target);
            copyText = '';
            ui.hidePanel();
            updateTrigger();
        }

        function onCompositionStart(event) {
            composing.add(event.target);
            if (activeField === event.target) {
                sessionFor(event.target).invalidate({ clearUndo: true });
                snapshots.delete(event.target);
                copyText = '';
                ui.hidePanel();
                updateTrigger();
            }
        }

        function onCompositionEnd(event) {
            composing.delete(event.target);
            defer(() => {
                if (activeField === event.target) updateTrigger();
            });
        }

        function onClick(event) {
            if (!activeField || ui.contains(event.target) || event.target === activeField) return;
            closePanel();
        }

        function onKeyDown(event) {
            if (event.key !== 'Escape' || !activeField) return;
            closePanel();
            if (ui.contains(event.target)) event.preventDefault();
        }

        async function translate() {
            if (!started || !enabled() || !activeField) return { ok: false, reason: 'inactive' };
            const field = activeField;
            if (composing.has(field)) return { ok: false, reason: 'composing' };
            const result = inspect(field);
            if (!result.ok) return { ok: false, reason: result.reason };

            const session = sessionFor(field);
            if (session.status().state === 'loading') return { ok: false, reason: 'loading' };
            const adapter = adapterFor(field);
            if (!adapter) return { ok: false, reason: 'unsupported' };

            const snapshot = adapter.capture(field);
            snapshots.set(field, snapshot);
            const request = session.begin({
                text: result.text,
                sourceLanguage: settings.composeSourceLanguage,
                targetLanguage: settings.composeTargetLanguage
            });
            ui.showLoading(field, {
                targetLanguage: settings.composeTargetLanguage,
                targetLabel: targetLabel()
            });
            updateTrigger();

            try {
                const response = await send({
                    type: 'TRANSLATE',
                    texts: [{ id: 1, text: result.text }],
                    sourceLanguage: settings.composeSourceLanguage,
                    targetLanguage: settings.composeTargetLanguage,
                    silentPartials: true
                });
                if (!response || response.error) {
                    throw new Error(response && response.error || 'Translation failed');
                }
                const item = Array.isArray(response.translations)
                    ? response.translations.find(entry => entry.id === 1) || response.translations[0]
                    : null;
                if (!item || item.error) {
                    throw new Error(item && item.error || 'Translation failed');
                }
                if (typeof item.text !== 'string' || !item.text.trim()) {
                    throw new Error('Empty translation');
                }
                if (!enabled() || !started || activeField !== field) {
                    session.invalidate({ clearUndo: true });
                    snapshots.delete(field);
                    copyText = '';
                    ui.hidePanel();
                    return { ok: false, stale: true };
                }
                if (field.isConnected === false) session.invalidate({ clearUndo: true });
                const resolved = session.resolve(request.generation, item.text);
                if (!resolved.applied) {
                    snapshots.delete(field);
                    copyText = '';
                    ui.hidePanel();
                    return { ok: false, stale: true };
                }
                copyText = item.text;
                ui.showPreview(field, {
                    translation: item.text,
                    targetLanguage: settings.composeTargetLanguage,
                    targetLabel: targetLabel()
                });
                updateTrigger();
                return { ok: true };
            } catch (error) {
                if (!enabled() || !started || activeField !== field) {
                    session.invalidate({ clearUndo: true });
                    snapshots.delete(field);
                    copyText = '';
                    ui.hidePanel();
                    return { ok: false, stale: true };
                }
                const message = error && error.message || String(error);
                const failed = session.fail(request.generation, message);
                snapshots.delete(field);
                if (failed.applied) {
                    ui.showError(field, { message });
                    updateTrigger();
                } else {
                    ui.hidePanel();
                }
                return { ok: false, error: message };
            }
        }

        async function replace() {
            if (!activeField) return { ok: false, reason: 'inactive' };
            if (applying) return { ok: false, reason: 'busy' };
            const field = activeField;
            const session = sessionFor(field);
            const status = session.status();
            if (status.state !== 'preview') return { ok: false, reason: 'no-preview' };
            const adapter = adapterFor(field);
            const snapshot = snapshots.get(field);
            if (!adapter || !snapshot) return { ok: false, reason: 'missing-snapshot' };
            if (adapter.canReplace && !adapter.canReplace(field)) {
                ui.showError(field, {
                    message: 'This editor contains formatting that cannot be replaced safely',
                    translation: copyText,
                    copyable: !!copyText
                });
                return { ok: false, reason: 'rich-text' };
            }

            const replaced = session.replace(adapter.read(field), snapshot, status.translation);
            if (!replaced.ok) {
                ui.showError(field, { message: 'Draft changed' });
                return replaced;
            }

            // Applying takes more than one frame on framework editors (they
            // rebuild the DOM themselves), so the field can change under us.
            // Anything the user types meanwhile cancels the pending apply.
            const generation = session.status().generation;
            suppressInput = field;
            applying = true;
            let applied;
            try {
                applied = await adapter.replace(field, status.translation);
            } finally {
                applying = false;
                suppressInput = null;
            }
            snapshots.delete(field);
            if (session.status().generation !== generation) {
                ui.hidePanel();
                updateTrigger();
                return { ok: false, stale: true };
            }
            if (!applied) {
                session.invalidate({ clearUndo: true });
                ui.showError(field, {
                    message: 'Could not update this input field',
                    translation: copyText,
                    copyable: !!copyText
                });
                return { ok: false, reason: 'apply-failed' };
            }
            ui.showReplaced(field, { canUndo: session.canUndo(adapter.read(field)) });
            updateTrigger();
            return { ok: true };
        }

        async function undo() {
            if (!activeField) return { ok: false, reason: 'inactive' };
            if (applying) return { ok: false, reason: 'busy' };
            const field = activeField;
            const session = sessionFor(field);
            const adapter = adapterFor(field);
            if (!adapter) return { ok: false, reason: 'unsupported' };
            const undone = session.undo(adapter.read(field));
            if (!undone.ok) {
                ui.showError(field, { message: 'Undo is no longer available' });
                return undone;
            }

            const generation = session.status().generation;
            suppressInput = field;
            applying = true;
            let restored;
            try {
                restored = await adapter.restore(field, undone.snapshot);
            } finally {
                applying = false;
                suppressInput = null;
            }
            if (session.status().generation !== generation) {
                ui.hidePanel();
                updateTrigger();
                return { ok: false, stale: true };
            }
            if (!restored) {
                session.invalidate({ clearUndo: true });
                ui.showError(field, { message: 'Could not restore this input field' });
                return { ok: false, reason: 'restore-failed' };
            }
            ui.hidePanel();
            updateTrigger();
            return { ok: true };
        }

        async function copy() {
            if (!copyText || !navigator.clipboard?.writeText) return false;
            try {
                await navigator.clipboard.writeText(copyText);
                return true;
            } catch (e) {
                return false;
            }
        }

        function start() {
            if (started) return;
            started = true;
            document.addEventListener('focusin', onFocusIn, true);
            document.addEventListener('focusout', onFocusOut, true);
            document.addEventListener('input', onInput, true);
            document.addEventListener('compositionstart', onCompositionStart, true);
            document.addEventListener('compositionend', onCompositionEnd, true);
            document.addEventListener('click', onClick, true);
            document.addEventListener('keydown', onKeyDown, true);
            if (enabled() && document.activeElement) activate(document.activeElement);
        }

        function stop() {
            if (!started) return;
            started = false;
            document.removeEventListener('focusin', onFocusIn, true);
            document.removeEventListener('focusout', onFocusOut, true);
            document.removeEventListener('input', onInput, true);
            document.removeEventListener('compositionstart', onCompositionStart, true);
            document.removeEventListener('compositionend', onCompositionEnd, true);
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('keydown', onKeyDown, true);
        }

        function configure(nextSettings) {
            settings = { ...settings, ...nextSettings };
            if (!enabled()) {
                stop();
                sessions.clear();
                snapshots.clear();
                composing.clear();
                activeField = null;
                suppressInput = null;
                copyText = '';
                ui.hideAll();
                return;
            }
            start();
            if (activeField) {
                sessionFor(activeField).invalidate();
                snapshots.delete(activeField);
                copyText = '';
                ui.hidePanel();
                updateTrigger();
            }
        }

        function destroy() {
            stop();
            sessions.clear();
            snapshots.clear();
            composing.clear();
            activeField = null;
            copyText = '';
            ui.destroy();
        }

        function status() {
            return {
                enabled: enabled(),
                started,
                active: !!activeField,
                state: activeField ? sessionFor(activeField).status().state : 'idle'
            };
        }

        return {
            start,
            stop,
            configure,
            destroy,
            translate,
            replace,
            undo,
            copy,
            close: closePanel,
            setUI(nextUI) { ui = nextUI || noopUI; },
            status
        };
    }

    function init(options) {
        const controller = create({ ...options, ui: noopUI });
        const ui = root.LctComposeUI.create({
            document: options.document,
            callbacks: {
                translate: () => controller.translate(),
                replace: () => controller.replace(),
                undo: () => controller.undo(),
                copy: () => controller.copy(),
                close: () => controller.close()
            }
        });
        controller.setUI(ui);
        if (controller.status().enabled) controller.start();
        return controller;
    }

    root.LctComposeController = { create, init };
})(typeof window !== 'undefined' ? window : globalThis);
