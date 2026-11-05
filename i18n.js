/**
 * Shared UI-translation core for the extension pages (options, popup).
 *
 * Each page loads this file plus its own dictionary file (options/i18n.js,
 * popup/popup-i18n.js). The dictionary file registers its strings with
 * i18nRegister(), selects them with i18nUse(), then paints every
 * [data-i18n] element once at load. Page scripts translate runtime-built
 * strings via t() and re-apply once the saved UI language resolves from
 * settings.uiLanguage ('auto' = browser locale, or 'en' / 'ja').
 */

const UI_I18N_DICTS = {};
let i18nNamespace = '';

// Current UI language: 'en' | 'ja'. Initialised from the browser locale so
// the first paint is usually right; page scripts overwrite this from the
// saved setting once it loads.
let uiLanguage = (typeof navigator !== 'undefined' && (navigator.language || '').toLowerCase().startsWith('ja')) ? 'ja' : 'en';

function i18nRegister(namespace, dict) {
    UI_I18N_DICTS[namespace] = dict;
}

function i18nUse(namespace) {
    i18nNamespace = namespace;
}

function detectUiLanguage() {
    try {
        return (navigator.language || 'en').toLowerCase().startsWith('ja') ? 'ja' : 'en';
    } catch (e) {
        return 'en';
    }
}

function setUiLanguage(lang) {
    uiLanguage = (lang === 'ja' || lang === 'en') ? lang : detectUiLanguage();
    document.documentElement.lang = uiLanguage;
}

function t(key, vars) {
    const dict = UI_I18N_DICTS[i18nNamespace] || {};
    const langPack = dict[uiLanguage] || dict.en || {};
    let str = langPack[key] ?? dict.en?.[key] ?? key;
    if (vars) {
        for (const [name, value] of Object.entries(vars)) {
            str = str.split('{' + name + '}').join(String(value));
        }
    }
    return str;
}

// Replace the text of every [data-i18n] element with the translated string.
// Values come from our own dictionary (never user input), so textContent is
// all that's needed; elements that must keep child nodes (icons, <code>,
// live counters) wrap only their translatable text in a [data-i18n] span.
function applyI18nStatic() {
    document.title = t('page.title');
    document.documentElement.lang = uiLanguage;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.dataset.i18nTitle);
        el.setAttribute('aria-label', el.title);
    });
}
