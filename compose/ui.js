(function (root) {
    'use strict';

    function create(options) {
        const document = options.document;
        const view = options.window || document.defaultView;
        const callbacks = options.callbacks || {};
        const japanese = String(navigator.language || '').toLowerCase().startsWith('ja');
        const labels = japanese
            ? {
                translateTitle: target => `${target}に翻訳`,
                undoTitle: '元に戻す',
                loading: '翻訳中…',
                previewTitle: target => `${target}への翻訳`,
                replacedTitle: '翻訳しました',
                replacedText: 'そのまま編集できます。',
                errorTitle: '翻訳エラー',
                replace: '置き換え',
                undo: '元に戻す',
                copy: 'コピー',
                copied: 'コピーしました',
                copyFailed: 'コピー失敗',
                close: '閉じる'
            }
            : {
                translateTitle: target => `Translate to ${target}`,
                undoTitle: 'Undo',
                loading: 'Translating…',
                previewTitle: target => `Translation to ${target}`,
                replacedTitle: 'Translation applied',
                replacedText: 'You can keep editing the draft.',
                errorTitle: 'Translation error',
                replace: 'Replace',
                undo: 'Undo',
                copy: 'Copy',
                copied: 'Copied',
                copyFailed: 'Copy failed',
                close: 'Close'
            };

        const host = document.createElement('div');
        host.id = 'llm-compose-ui';
        document.documentElement.appendChild(host);
        const shadow = host.attachShadow({ mode: 'closed' });

        const style = document.createElement('style');
        style.textContent = `
            :host {
                position: fixed;
                inset: 0 auto auto 0;
                z-index: 2147483647;
                pointer-events: none;
                color-scheme: light dark;
            }
            * { box-sizing: border-box; }
            button {
                font: inherit;
                cursor: pointer;
                pointer-events: auto;
                border: 1px solid #4b5563;
                border-radius: 6px;
                background: #111827;
                color: #f9fafb;
                padding: 6px 10px;
            }
            button:hover { background: #1f2937; }
            button:focus-visible { outline: 2px solid #60a5fa; outline-offset: 2px; }
            button:disabled { cursor: default; opacity: .55; }
            #trigger {
                position: absolute;
                min-width: 34px;
                height: 30px;
                padding: 3px 7px;
                font-weight: 700;
                box-shadow: 0 2px 10px rgba(0, 0, 0, .22);
            }
            #panel {
                position: absolute;
                width: min(360px, calc(100vw - 16px));
                max-height: min(42vh, 420px);
                overflow: auto;
                padding: 12px;
                border: 1px solid #4b5563;
                border-radius: 10px;
                background: #111827;
                color: #f9fafb;
                box-shadow: 0 12px 32px rgba(0, 0, 0, .3);
                pointer-events: auto;
                font: 13px/1.5 system-ui, sans-serif;
            }
            #title { font-weight: 700; margin-bottom: 8px; }
            #text { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0 0 12px; }
            #text.error { color: #fca5a5; }
            #actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
            @media (prefers-color-scheme: light) {
                button { background: #ffffff; color: #111827; border-color: #cbd5e1; }
                button:hover { background: #f1f5f9; }
                #panel { background: #ffffff; color: #111827; border-color: #cbd5e1; }
                #text.error { color: #b91c1c; }
            }
        `;
        shadow.appendChild(style);

        const trigger = document.createElement('button');
        trigger.id = 'trigger';
        trigger.type = 'button';
        trigger.hidden = true;
        trigger.textContent = 'あA';
        trigger.addEventListener('mousedown', event => event.preventDefault());
        trigger.addEventListener('click', () => callbacks.translate?.());
        shadow.appendChild(trigger);

        const panel = document.createElement('div');
        panel.id = 'panel';
        panel.hidden = true;
        panel.setAttribute('data-panel', 'true');
        panel.setAttribute('role', 'status');
        panel.setAttribute('aria-live', 'polite');
        shadow.appendChild(panel);

        let activeField = null;

        function clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }

        function position() {
            if (!activeField || activeField.isConnected === false) return;
            const rect = activeField.getBoundingClientRect();
            const width = view.innerWidth;
            const height = view.innerHeight;

            if (!trigger.hidden) {
                trigger.style.left = `${clamp(rect.right - 38, 8, Math.max(8, width - 44))}px`;
                trigger.style.top = `${clamp(rect.top + 6, 8, Math.max(8, height - 38))}px`;
            }
            if (!panel.hidden) {
                const panelWidth = Math.min(360, Math.max(200, width - 16));
                const panelHeight = panel.offsetHeight || 160;
                panel.style.width = `${panelWidth}px`;
                panel.style.left = `${clamp(rect.left, 8, Math.max(8, width - panelWidth - 8))}px`;
                let top = rect.bottom + 8;
                if (top + panelHeight > height - 8) top = rect.top - panelHeight - 8;
                panel.style.top = `${clamp(top, 8, Math.max(8, height - panelHeight - 8))}px`;
            }
        }

        function onScroll() {
            position();
        }

        view.addEventListener('scroll', onScroll, true);
        view.addEventListener('resize', onScroll);

        function showTrigger(field, state = {}) {
            activeField = field;
            trigger.hidden = false;
            trigger.disabled = !!state.disabled || !!state.busy;
            trigger.textContent = state.canUndo ? '↶' : 'あA';
            trigger.title = state.canUndo
                ? labels.undoTitle
                : labels.translateTitle(state.targetLabel || state.targetLanguage || '');
            trigger.setAttribute('aria-label', trigger.title);
            panel.hidden = true;
            position();
        }

        function hideTrigger() {
            trigger.hidden = true;
        }

        function makeButton(label, action) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.addEventListener('mousedown', event => event.preventDefault());
            button.addEventListener('click', async () => {
                const result = await action.handler();
                if (result === true && action.successLabel) {
                    button.textContent = action.successLabel;
                    button.disabled = true;
                } else if (result === false && action.failureLabel) {
                    button.textContent = action.failureLabel;
                }
            });
            return button;
        }

        function renderPanel(title, text, actions, error = false) {
            while (panel.firstChild) panel.removeChild(panel.firstChild);
            const heading = document.createElement('div');
            heading.id = 'title';
            heading.textContent = title;
            panel.appendChild(heading);

            const body = document.createElement('div');
            body.id = 'text';
            body.classList.toggle('error', error);
            body.textContent = text;
            panel.appendChild(body);

            const actionRow = document.createElement('div');
            actionRow.id = 'actions';
            for (const action of actions) {
                actionRow.appendChild(makeButton(action.label, action));
            }
            panel.appendChild(actionRow);
            panel.hidden = false;
            position();
        }

        function closeAction() {
            return { label: labels.close, handler: () => callbacks.close?.() };
        }

        function showLoading(field, state = {}) {
            activeField = field;
            renderPanel(labels.loading, '', [closeAction()]);
        }

        function showPreview(field, state = {}) {
            activeField = field;
            renderPanel(
                labels.previewTitle(state.targetLabel || state.targetLanguage || ''),
                state.translation || '',
                [
                    { label: labels.replace, handler: () => callbacks.replace?.() },
                    closeAction()
                ]
            );
        }

        function showReplaced(field, state = {}) {
            activeField = field;
            const actions = [];
            if (state.canUndo) actions.push({ label: labels.undo, handler: () => callbacks.undo?.() });
            actions.push(closeAction());
            renderPanel(labels.replacedTitle, labels.replacedText, actions);
        }

        function showError(field, state = {}) {
            activeField = field;
            const actions = [];
            if (state.copyable && state.translation) {
                actions.push({
                    label: labels.copy,
                    successLabel: labels.copied,
                    failureLabel: labels.copyFailed,
                    handler: () => callbacks.copy?.()
                });
            }
            actions.push(closeAction());
            renderPanel(labels.errorTitle, state.message || 'Translation failed', actions, true);
        }

        function hidePanel() {
            panel.hidden = true;
        }

        function hideAll() {
            trigger.hidden = true;
            panel.hidden = true;
        }

        function destroy() {
            view.removeEventListener('scroll', onScroll, true);
            view.removeEventListener('resize', onScroll);
            host.remove();
            activeField = null;
        }

        return {
            showTrigger,
            hideTrigger,
            showLoading,
            showPreview,
            showReplaced,
            showError,
            hidePanel,
            hideAll,
            contains: target => host.contains(target),
            destroy
        };
    }

    root.LctComposeUI = { create };
})(typeof window !== 'undefined' ? window : globalThis);
