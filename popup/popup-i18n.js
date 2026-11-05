/**
 * Popup UI translations (English / Japanese).
 *
 * The popup follows the UI language chosen on the settings page
 * (settings.uiLanguage: 'auto' | 'en' | 'ja'); 'auto' resolves from the
 * browser's locale. Static HTML is tagged with data-i18n attributes and
 * painted by applyI18nStatic() below; strings that popup.js builds at
 * runtime (toasts, banners, picker labels, ...) go through t(). The shared
 * helpers live in the root i18n.js.
 */

const POPUP_I18N = {
    en: {
        'page.title': 'Local LLM Translator',

        // Header
        'header.subtitle': 'Privacy-first translation with local LLMs',
        'openFullSettings': 'Open full settings page',
        'status.checking': 'Checking...',
        'status.checkError': 'Error checking providers',
        'status.connected': 'Connected: {providers}',
        'status.corsOllama': 'Ollama is running but blocking the extension (CORS)',
        'status.corsLmstudio': 'LMStudio is running but blocking the extension (CORS)',
        'status.noProviders': 'No providers found',

        // Main controls
        'model.label': 'Model',
        'model.loading': 'Loading models...',
        'model.noneFound': 'No models found',
        'model.loadError': 'Error loading models',
        'model.select': 'Select a model',
        'model.searchPlaceholder': 'Search models…',
        'model.refresh': 'Refresh models',
        'lang.to': 'Translate to',
        'lang.searchPlaceholder': 'Search languages…',
        'sourceLang.label': 'Source language:',
        'sourceLang.useDetected': 'Use detected',
        'status.detecting': 'detecting...',
        'status.unknown': 'unknown',
        'translate.page': 'Translate Page',
        'translate.loading': 'Translating...',
        'translate.cancel': 'Cancel translation',
        'restore.original': 'Original',
        'restore.translated': 'Translated',
        'restore.restore': 'Restore',
        'restore.toggleTitle': 'Toggle original/translated',

        // Quick settings section
        'adv.quickSettings': 'Quick settings',
        'adv.floatingLabel': 'Floating translate button',
        'adv.floatingHint': 'Shows a translate button next to selected text.',
        'adv.floatingHintReq': 'Requires permission to run on all websites.',
        'adv.autoLabel': 'Auto-translate pages on load',
        'adv.autoHint': 'Manage language/site exceptions in',
        'adv.autoHintEnd': '.',
        'adv.settingsLink': 'Settings',
        'adv.ignoreNote': "This site is on the ignore list, so it won't auto-translate.",
        'adv.unignore': 'Un-ignore it',

        // Advanced settings
        'provider.label': 'Provider',
        'provider.auto': 'Auto-detect',
        'provider.ollama': 'Ollama',
        'provider.lmstudio': 'LMStudio / OpenAI-compatible',
        'lmstudioUrl.label': 'LMStudio / OpenAI-compatible URL (llama.cpp, vLLM…)',
        'cache.label': 'Translation cache',
        'cache.newBadge': 'New',
        'cache.mode.off': "Don't cache",
        'cache.mode.session': 'Until I close the browser',
        'cache.mode.persistent': 'Keep across sessions',
        'cache.backendWarning': "⚠️ This browser doesn't support keeping the cache across sessions.",
        'cache.clearPrefix': 'Clear cache (',
        'cache.clearSuffix': ')',
        'cache.clearTitle': 'Delete all cached translations',
        'save.label': 'Save Settings',
        'moreSettings': '⚙️ More Settings',
        'reset.label': 'Reset to defaults',

        // Toasts
        'toast.saved': 'Settings saved!',
        'toast.customServerDenied': "Saved, but permission for the custom server was denied. Remote models won't load until you allow it.",
        'toast.resetToDefaults': 'Settings reset to defaults',
        'toast.permissionDenied': 'Permission denied',
        'toast.floatingEnabled': 'Floating button enabled. Reload pages to activate',
        'toast.floatingDisabled': 'Floating button disabled',
        'toast.autoTranslateEnabled': 'Auto-translate enabled. Reload pages to activate',
        'toast.autoTranslateDisabled': 'Auto-translate disabled',
        'toast.unignored': 'Un-ignored. Reload the page to auto-translate it.',
        'toast.siteListFailed': 'Could not update the site list',
        'toast.cacheCleared': 'Translation cache cleared',
        'toast.cacheClearFailed': 'Failed to clear cache',
        'toast.selectModel': 'Please select a model first',
        'toast.corsBlocked': 'Your LLM provider is blocking the extension (CORS). See the setup instructions above.',
        'toast.noProvider': 'No LLM provider running. Start Ollama or LMStudio first.',
        'toast.error': 'Error: {message}',

        // Footer
        'openTranslator': '📝 Open Translator',
        'footer.privacy': 'All translations stay on your device',
        'resize.handle': 'Drag to resize',

        // Picker shared strings
        'picker.pinned': 'Pinned',
        'picker.allLanguages': 'All languages',
        'picker.allModels': 'All models',
        'picker.noLangMatch': 'No languages match your search',
        'picker.noModels': 'No models available',
        'picker.noModelMatch': 'No models match your search',
        'picker.pin': 'Pin {name}',
        'picker.unpin': 'Unpin {name}',

        // Setup banners (HTML — our own strings, shown via innerHTML as before)
        'banner.noModels': `<div style="font-weight: bold; margin-bottom: 4px; color: var(--yellow, #dbbc7f);">No translation models found</div>
            <div>Your LLM provider is connected, but you have not downloaded a translation model yet.</div>
            <div style="margin-top: 6px;">Recommended model:</div>
            <div style="background: var(--bg1, #2b2b2b); padding: 4px 8px; border-radius: 4px; font-family: monospace; display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                <code>ollama pull translategemma</code>
            </div>
            <div style="margin-top: 6px; font-size: 11px; opacity: 0.8;">Or download a model in LMStudio (search for "translate"). Click the refresh button above when done.</div>`,
        'banner.corsOllama': `<div style="font-weight: bold; margin-bottom: 4px; color: var(--yellow, #dbbc7f);">Ollama is blocking the extension</div>
            <div>Ollama is running, but it is not allowing requests from browser extensions (CORS policy).</div>
            <div style="margin-top: 6px;">Fix: start Ollama with the environment variable <code style="background: var(--bg1, #2b2b2b); padding: 1px 4px; border-radius: 3px;">OLLAMA_ORIGINS=*</code> (e.g. add <code style="background: var(--bg1, #2b2b2b); padding: 1px 4px; border-radius: 3px;">Environment="OLLAMA_ORIGINS=*"</code> to its systemd unit, or set it in the app's environment).</div>
            <div style="margin-top: 6px; font-size: 11px; opacity: 0.8;"><a href="https://github.com/Eldoprano/offline-browser-translate/blob/main/docs/ollama-cors-setup.md" target="_blank" style="color: var(--accent, #a7c080);">More detailed instructions here</a>. Click the refresh button above when done.</div>`,
        'banner.corsLmstudio': `<div style="font-weight: bold; margin-bottom: 4px; color: var(--yellow, #dbbc7f);">LM Studio is blocking the extension</div>
            <div>LM Studio server is running, but Cross-Origin Resource Sharing (CORS) is disabled.</div>
            <div style="margin-top: 6px; line-height: 1.4;">
                To enable CORS:
                <ol style="margin: 4px 0; padding-left: 18px;">
                    <li>Open <b>LM Studio</b></li>
                    <li>Go to the <b>Developer</b> tab (server icon on the left sidebar)</li>
                    <li>Under <b>Server Settings</b>, activate <b>"Enable CORS"</b></li>
                    <li>Restart the server</li>
                </ol>
            </div>
            <div style="margin-top: 6px; font-size: 11px; opacity: 0.8;">Click the refresh button above when done.</div>`,
        'banner.noProvider': `<div style="font-weight: bold; margin-bottom: 4px; color: var(--yellow, #dbbc7f);">No LLM provider detected</div>
            <div>To use this extension, you need a local LLM server running:</div>
            <ol style="margin: 6px 0 2px 18px; padding: 0;">
                <li>Install <a href="https://ollama.com" target="_blank" style="color: var(--accent, #a7c080);">Ollama</a> or <a href="https://lmstudio.ai" target="_blank" style="color: var(--accent, #a7c080);">LMStudio</a></li>
                <li>Load a translation model (e.g. <code style="background: var(--bg1, #2b2b2b); padding: 1px 4px; border-radius: 3px;">ollama pull translategemma</code>)</li>
                <li>Click the refresh button above</li>
            </ol>
            <div style="margin-top: 4px; font-size: 11px; opacity: 0.8;">llama.cpp, vLLM and other OpenAI-compatible servers also work. Put their base URL in the LMStudio URL field.</div>`
    },

    ja: {
        'page.title': 'Local LLM Translator',

        // ヘッダー
        'header.subtitle': 'ローカル LLM によるプライバシー重視の翻訳',
        'openFullSettings': '設定ページを開く',
        'status.checking': '確認中...',
        'status.checkError': 'プロバイダーの確認中にエラーが発生しました',
        'status.connected': '接続済み: {providers}',
        'status.corsOllama': 'Ollama は起動していますが、拡張機能をブロックしています (CORS)',
        'status.corsLmstudio': 'LM Studio は起動していますが、拡張機能をブロックしています (CORS)',
        'status.noProviders': 'プロバイダーが見つかりません',

        // メインコントロール
        'model.label': 'モデル',
        'model.loading': 'モデルを読み込み中...',
        'model.noneFound': 'モデルが見つかりません',
        'model.loadError': 'モデルの読み込みに失敗しました',
        'model.select': 'モデルを選択',
        'model.searchPlaceholder': 'モデルを検索…',
        'model.refresh': 'モデル一覧を更新',
        'lang.to': '翻訳先',
        'lang.searchPlaceholder': '言語を検索…',
        'sourceLang.label': '元の言語:',
        'sourceLang.useDetected': '検出された言語を使用',
        'status.detecting': '検出中...',
        'status.unknown': '不明',
        'translate.page': 'ページを翻訳',
        'translate.loading': '翻訳中...',
        'translate.cancel': '翻訳をキャンセル',
        'restore.original': '原文',
        'restore.translated': '訳文',
        'restore.restore': '復元',
        'restore.toggleTitle': '原文/訳文を切り替えます',

        // クイック設定
        'adv.quickSettings': 'クイック設定',
        'adv.floatingLabel': '浮動翻訳ボタン',
        'adv.floatingHint': '選択テキストの横に翻訳ボタンを表示します。',
        'adv.floatingHintReq': 'すべてのウェブサイトでの実行許可が必要です。',
        'adv.autoLabel': 'ページ読み込み時に自動翻訳',
        'adv.autoHint': '言語・サイトの除外設定は',
        'adv.autoHintEnd': 'で管理できます。',
        'adv.settingsLink': '設定',
        'adv.ignoreNote': 'このサイトは除外リストに含まれるため、自動翻訳されません。',
        'adv.unignore': '除外を解除',

        // 詳細設定
        'provider.label': 'プロバイダー',
        'provider.auto': '自動検出',
        'provider.ollama': 'Ollama',
        'provider.lmstudio': 'LMStudio / OpenAI 互換',
        'lmstudioUrl.label': 'LMStudio / OpenAI 互換 URL (llama.cpp, vLLM…)',
        'cache.label': '翻訳キャッシュ',
        'cache.newBadge': '新規',
        'cache.mode.off': 'キャッシュしない',
        'cache.mode.session': 'ブラウザーを閉じるまで',
        'cache.mode.persistent': 'セッションをまたいで保持',
        'cache.backendWarning': '⚠️ このブラウザーはセッションをまたぐキャッシュ保持に対応していません。',
        'cache.clearPrefix': 'キャッシュを消去 (',
        'cache.clearSuffix': ')',
        'cache.clearTitle': '保存された翻訳をすべて削除します',
        'save.label': '設定を保存',
        'moreSettings': '⚙️ 詳細設定',
        'reset.label': '既定値に戻す',

        // トースト
        'toast.saved': '設定を保存しました！',
        'toast.customServerDenied': '保存しましたが、カスタムサーバーの権限が拒否されました。許可するまでリモートのモデルは読み込めません。',
        'toast.resetToDefaults': '設定を既定値に戻しました',
        'toast.permissionDenied': '権限が拒否されました',
        'toast.floatingEnabled': '浮動ボタンを有効化しました。ページを再読み込みすると反映されます',
        'toast.floatingDisabled': '浮動ボタンを無効化しました',
        'toast.autoTranslateEnabled': '自動翻訳を有効化しました。ページを再読み込みすると反映されます',
        'toast.autoTranslateDisabled': '自動翻訳を無効化しました',
        'toast.unignored': '除外を解除しました。ページを再読み込みすると自動翻訳されます。',
        'toast.siteListFailed': 'サイトリストを更新できませんでした',
        'toast.cacheCleared': '翻訳キャッシュを消去しました',
        'toast.cacheClearFailed': 'キャッシュの消去に失敗しました',
        'toast.selectModel': '先にモデルを選択してください',
        'toast.corsBlocked': 'LLM プロバイダーが拡張機能をブロックしています (CORS)。上記のセットアップ手順を確認してください。',
        'toast.noProvider': 'LLM プロバイダーが起動していません。先に Ollama または LM Studio を起動してください。',
        'toast.error': 'エラー: {message}',

        // フッター
        'openTranslator': '📝 翻訳ページを開く',
        'footer.privacy': 'すべての翻訳は端末内で処理されます',
        'resize.handle': 'ドラッグでサイズを変更できます',

        // ピッカー共通
        'picker.pinned': 'ピン留め',
        'picker.allLanguages': 'すべての言語',
        'picker.allModels': 'すべてのモデル',
        'picker.noLangMatch': '検索に一致する言語はありません',
        'picker.noModels': '利用可能なモデルがありません',
        'picker.noModelMatch': '検索に一致するモデルはありません',
        'picker.pin': '{name} をピン留め',
        'picker.unpin': '{name} のピン留めを解除',

        // セットアップバナー（HTML — 独自文字列のため従来どおり innerHTML で表示）
        'banner.noModels': `<div style="font-weight: bold; margin-bottom: 4px; color: var(--yellow, #dbbc7f);">翻訳モデルが見つかりません</div>
            <div>LLM プロバイダーには接続できていますが、翻訳モデルがまだダウンロードされていません。</div>
            <div style="margin-top: 6px;">おすすめのモデル:</div>
            <div style="background: var(--bg1, #2b2b2b); padding: 4px 8px; border-radius: 4px; font-family: monospace; display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                <code>ollama pull translategemma</code>
            </div>
            <div style="margin-top: 6px; font-size: 11px; opacity: 0.8;">または LM Studio でモデルをダウンロードしてください（"translate" で検索）。完了したら上の更新ボタンをクリックしてください。</div>`,
        'banner.corsOllama': `<div style="font-weight: bold; margin-bottom: 4px; color: var(--yellow, #dbbc7f);">Ollama が拡張機能をブロックしています</div>
            <div>Ollama は起動していますが、ブラウザー拡張機能からのリクエストを許可していません (CORS ポリシー)。</div>
            <div style="margin-top: 6px;">修正: 環境変数 <code style="background: var(--bg1, #2b2b2b); padding: 1px 4px; border-radius: 3px;">OLLAMA_ORIGINS=*</code> を付けて Ollama を起動してください（systemd ユニットの <code style="background: var(--bg1, #2b2b2b); padding: 1px 4px; border-radius: 3px;">Environment="OLLAMA_ORIGINS=*"</code> への追加など、アプリの環境に設定します）。</div>
            <div style="margin-top: 6px; font-size: 11px; opacity: 0.8;"><a href="https://github.com/Eldoprano/offline-browser-translate/blob/main/docs/ollama-cors-setup.md" target="_blank" style="color: var(--accent, #a7c080);">詳細な手順はこちら</a>。完了したら上の更新ボタンをクリックしてください。</div>`,
        'banner.corsLmstudio': `<div style="font-weight: bold; margin-bottom: 4px; color: var(--yellow, #dbbc7f);">LM Studio が拡張機能をブロックしています</div>
            <div>LM Studio のサーバーは起動していますが、CORS (オリジン間リソース共有) が無効です。</div>
            <div style="margin-top: 6px; line-height: 1.4;">
                CORS を有効にするには:
                <ol style="margin: 4px 0; padding-left: 18px;">
                    <li><b>LM Studio</b> を開く</li>
                    <li><b>Developer</b> タブ（左サイドバーのサーバーアイコン）を開く</li>
                    <li><b>Server Settings</b> で <b>"Enable CORS"</b> を有効にする</li>
                    <li>サーバーを再起動する</li>
                </ol>
            </div>
            <div style="margin-top: 6px; font-size: 11px; opacity: 0.8;">完了したら上の更新ボタンをクリックしてください。</div>`,
        'banner.noProvider': `<div style="font-weight: bold; margin-bottom: 4px; color: var(--yellow, #dbbc7f);">LLM プロバイダーが検出されません</div>
            <div>この拡張機能を使うには、ローカル LLM サーバーを起動する必要があります:</div>
            <ol style="margin: 6px 0 2px 18px; padding: 0;">
                <li><a href="https://ollama.com" target="_blank" style="color: var(--accent, #a7c080);">Ollama</a> または <a href="https://lmstudio.ai" target="_blank" style="color: var(--accent, #a7c080);">LMStudio</a> をインストール</li>
                <li>翻訳モデルを読み込む（例: <code style="background: var(--bg1, #2b2b2b); padding: 1px 4px; border-radius: 3px;">ollama pull translategemma</code>）</li>
                <li>上の更新ボタンをクリック</li>
            </ol>
            <div style="margin-top: 4px; font-size: 11px; opacity: 0.8;">llama.cpp、vLLM などその他の OpenAI 互換サーバーでも動作します。ベース URL を LMStudio URL 欄に入力してください。</div>`
    }
};

// Register with the shared i18n core (root i18n.js), then paint static text
// as soon as the script runs (it sits at the end of <body>, so the DOM is
// already parsed). popup.js re-applies once settings arrive, in case the
// saved preference differs from the detected locale.
i18nRegister('popup', POPUP_I18N);
i18nUse('popup');
applyI18nStatic();
