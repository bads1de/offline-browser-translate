/**
 * Default settings for Local LLM Translator — the single source of truth.
 *
 * The background worker merges these underneath whatever is stored, and every
 * page (popup, options, translator) starts from the same object, so there is
 * exactly one answer to "what is the default for X?".
 *
 * Loaded as a classic script before the page scripts, and imported by the
 * background worker (manifest `background.scripts` / importScripts()).
 *
 * Every key here must have its default in exactly one place — this file. If a
 * page needs a default that only it uses, that is a sign the setting belongs
 * in the shared settings object, because the background worker is what
 * ultimately answers SETTINGS_GET for all callers.
 */

const DEFAULT_SETTINGS = {
    provider: 'auto', // 'auto', 'ollama', 'lmstudio'
    ollamaUrl: 'http://localhost:11434',
    lmstudioUrl: 'http://localhost:1234',
    selectedModel: '',
    targetLanguage: 'en',
    sourceLanguage: 'auto', // 'auto' = detect from page, or specific code
    pinnedLanguages: [], // picker favourites, edited on the options page
    pinnedModels: [],
    maxTokensPerBatch: 2000,
    maxItemsPerBatch: 8,
    maxConcurrentRequests: 4, // 1-32 parallel requests (LMStudio 0.4.0+ supports parallelism)
    // Per-format prompt overrides: { [format]: { system, user } }. A format with
    // no entry here falls back to its built-in PROMPT_TEMPLATES text. There's no
    // 'auto' entry — auto resolves to a concrete format first, and that format's
    // (possibly overridden) prompt is what's actually used.
    customPrompts: {},
    requestFormat: 'auto', // 'auto' (detect from model), 'default', 'translategemma', 'hunyuan', 'simple', 'custom'
    temperature: 0.3,
    useStructuredOutput: true,
    maxOutputRetries: 2, // Extra attempts when the model returns malformed/missing translations
    plainTextFallback: true, // After JSON retries fail, translate the failed items one-by-one as plain text
    showGlow: false, // Glow the translated text on the page; off by default
    numCtx: 0, // Ollama context window size (0 = model default)
    // Translation cache: 'persistent' (kept across browser sessions), 'session'
    // (kept until the browser is closed, then wiped), or 'off'. Off by default.
    cacheMode: 'off',
    // Options page UI language: 'auto' (from browser locale), or 'en' / 'ja'
    uiLanguage: 'auto',
    debug: false, // Enable verbose logging
    floatingButton: false, // Show floating translate button on text selection (requires <all_urls> permission)
    useGlossary: false, // Off by default; when on, injects matching glossary terms into the prompt for consistent proper-noun translation
    // Translate a page as soon as it loads when it declares a language other
    // than the target one (requires <all_urls> permission). Off by default:
    // every page load costs real inference time on the user's own machine.
    autoTranslatePages: false,
    autoTranslateNeverLanguages: [], // language codes to leave alone
    autoTranslateNeverSites: [], // hostnames to leave alone (subdomains included)
    youtubeCaptionMode: 'replace', // 'replace': translated line only / 'bilingual': original + translation
    composeTranslationEnabled: false,
    composeSourceLanguage: 'auto',
    composeTargetLanguage: 'en'
};

// Export for the other classic scripts. The background worker shares this
// global scope after importScripts(), so it reads the binding directly.
if (typeof window !== 'undefined') {
    window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
}
