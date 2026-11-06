/**
 * Translator page UI translations (English / Japanese).
 *
 * Same mechanism as the popup and options pages: the page follows the UI
 * language chosen on the settings page (settings.uiLanguage: 'auto' | 'en' |
 * 'ja'); 'auto' resolves from the browser's locale. Static HTML is tagged
 * with data-i18n attributes and painted by applyI18nStatic() below; strings
 * that translator.js builds at runtime (toasts, errors, status titles, ...)
 * go through t(). The shared helpers live in the root i18n.js.
 */

const TRANSLATOR_I18N = {
    en: {
        'page.title': 'Local Translator',

        // Header
        'header.title': 'Local Translator',
        'header.subtitle': 'Privacy-first translation with local LLMs',
        'model.badgeTitle': 'Active model',
        'model.loading': 'Loading model...',
        'status.checking': 'Connecting...',
        'status.checkingTitle': 'Checking connection...',
        'theme.toggleTitle': 'Toggle dark/light theme',

        // Language pickers
        'lang.searchPlaceholder': 'Search languages...',
        'lang.autoDetect': 'Auto-detect',

        // Source panel
        'source.placeholder': 'Enter text to translate...',
        'clear.title': 'Clear text',
        'swap.title': 'Swap languages',

        // Target panel
        'output.placeholder': 'Translation will appear here...',
        'copy.label': '📋 Copy',
        'copy.title': 'Copy translation',

        // Translate bar & footer
        'translate.label': 'Translate',
        'translate.loading': 'Translating...',
        'footer.privacy': '🔒 All translations stay on your device — powered by your local LLM',
        'toast.copied': 'Copied!',

        // Runtime strings
        'theme.toLight': 'Switch to light theme',
        'theme.toDark': 'Switch to dark theme',
        'charCount.one': '1 character',
        'charCount.other': '{len} characters',
        'toast.pickSourceLang': 'Pick a specific source language first',
        'error.noModel': 'No model available. Start Ollama or LMStudio and reload.',
        'error.noTranslation': 'No translation returned',
        'error.prefix': 'Error: {message}',
        'toast.copiedClipboard': 'Copied to clipboard!',
        'toast.copyFailed': 'Failed to copy',

        // Status indicator
        'status.corsBlocked': 'CORS Blocked',
        'status.noProvider': 'No provider',
        'status.error': 'Error',
        'status.title.connected': 'Connected: {providers}',
        'status.title.corsOllama': 'Ollama is running but blocking the extension (CORS). Enable CORS in Ollama.',
        'status.title.corsLmstudio': 'LMStudio is running but blocking the extension (CORS). Enable CORS in LMStudio Developer settings.',
        'status.title.noProviders': 'No LLM providers found. Start Ollama or LMStudio.',
        'status.title.error': 'Error connecting to extension background',

        // Model badge
        'model.loadingShort': 'Loading...',
        'model.none': 'No models',
        'model.noneTitle': 'No models found. Make sure Ollama or LMStudio has models loaded.',
        'model.badge': 'Model: {id} ({provider})',
        'model.error': 'Error',
        'model.errorTitle': 'Failed to load models'
    },

    ja: {
        'page.title': 'Local Translator',

        // ヘッダー
        'header.title': 'Local Translator',
        'header.subtitle': 'ローカル LLM によるプライバシー重視の翻訳',
        'model.badgeTitle': '使用中のモデル',
        'model.loading': 'モデルを読み込み中...',
        'status.checking': '接続中...',
        'status.checkingTitle': '接続を確認中...',
        'theme.toggleTitle': 'ダーク/ライトテーマを切り替え',

        // 言語ピッカー
        'lang.searchPlaceholder': '言語を検索…',
        'lang.autoDetect': '自動検出',

        // 翻訳元パネル
        'source.placeholder': '翻訳するテキストを入力...',
        'clear.title': 'テキストを消去',
        'swap.title': '言語を入れ替え',

        // 翻訳先パネル
        'output.placeholder': '翻訳結果がここに表示されます...',
        'copy.label': '📋 コピー',
        'copy.title': '翻訳をコピー',

        // 翻訳ボタン & フッター
        'translate.label': '翻訳',
        'translate.loading': '翻訳中...',
        'footer.privacy': '🔒 すべての翻訳は端末内で処理されます — ローカル LLM で動作',
        'toast.copied': 'コピーしました！',

        // 実行時に生成される文字列
        'theme.toLight': 'ライトテーマに切り替え',
        'theme.toDark': 'ダークテーマに切り替え',
        'charCount.one': '1 文字',
        'charCount.other': '{len} 文字',
        'toast.pickSourceLang': '先に具体的な翻訳元言語を選択してください',
        'error.noModel': '利用可能なモデルがありません。Ollama または LM Studio を起動して再読み込みしてください。',
        'error.noTranslation': '翻訳結果が返されませんでした',
        'error.prefix': 'エラー: {message}',
        'toast.copiedClipboard': 'クリップボードにコピーしました！',
        'toast.copyFailed': 'コピーに失敗しました',

        // ステータス表示
        'status.corsBlocked': 'CORS ブロック',
        'status.noProvider': 'プロバイダーなし',
        'status.error': 'エラー',
        'status.title.connected': '接続済み: {providers}',
        'status.title.corsOllama': 'Ollama は起動していますが、拡張機能をブロックしています (CORS)。Ollama 側で CORS を有効にしてください。',
        'status.title.corsLmstudio': 'LM Studio は起動していますが、拡張機能をブロックしています (CORS)。LM Studio の Developer 設定で CORS を有効にしてください。',
        'status.title.noProviders': 'LLM プロバイダーが見つかりません。Ollama または LM Studio を起動してください。',
        'status.title.error': '拡張機能のバックグラウンドへの接続中にエラーが発生しました',

        // モデルバッジ
        'model.loadingShort': '読み込み中...',
        'model.none': 'モデルなし',
        'model.noneTitle': 'モデルが見つかりません。Ollama または LM Studio にモデルが読み込まれているか確認してください。',
        'model.badge': 'モデル: {id} ({provider})',
        'model.error': 'エラー',
        'model.errorTitle': 'モデルの読み込みに失敗しました'
    }
};

// Register with the shared i18n core (root i18n.js), then paint static text
// as soon as the script runs (it sits at the end of <body>, so the DOM is
// already parsed). translator.js re-applies once settings arrive, in case
// the saved preference differs from the detected locale.
i18nRegister('translator', TRANSLATOR_I18N);
i18nUse('translator');
applyI18nStatic();
