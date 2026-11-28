/**
 * Options page: per-format prompt templates, the prompt editor, and the
 * format description / section-visibility rules.
 *
 * A classic script loaded after options.js; it reads that file's globals
 * (elements, currentSettings, the pickers) and is called from its init().
 */

// Format descriptions, keyed by format — values are i18n dictionary keys.
const FORMAT_DESCRIPTIONS = {
    auto: 'formatDesc.auto',
    default: 'formatDesc.default',
    translategemma: 'formatDesc.translategemma',
    hunyuan: 'formatDesc.hunyuan',
    plamo: 'formatDesc.plamo',
    simple: 'formatDesc.simple',
    custom: 'formatDesc.custom'
};

// Prompt templates for each format
const PROMPT_TEMPLATES = {
    default: {
        system: `You are a professional translator. Translate the given texts to {{targetLanguage}}. 
Respond ONLY with a JSON object in this exact format:
{"translations": [{"id": 0, "text": "translated text"}, {"id": 1, "text": "another translation"}]}
Maintain the original meaning, tone, and formatting. Do not add explanations.`,
        user: `Translate the following texts to {{targetLanguage}}:\n{{texts}}`
    },
    simple: {
        system: `You are a translator. Translate to {{targetLanguage}}. Output JSON only:
{"translations": [{"id": N, "text": "translation"}]}`,
        user: `Translate to {{targetLanguage}}:\n{{texts}}`
    },
    hunyuan: {
        system: '',
        user: `Translate the following segment into {{targetLanguage}}, without additional explanation.\n{{texts}}`
    },
    plamo: {
        system: '',
        user: `{{texts}}`
    },
    translategemma: {
        system: '',
        user: `You are a professional {{sourceLang}} ({{sourceCode}}) to {{targetLang}} ({{targetCode}}) translator. Your goal is to accurately convey the meaning and nuances of the original {{sourceLang}} text while adhering to {{targetLang}} grammar, vocabulary, and cultural sensitivities.
Produce only the {{targetLang}} translation, without any additional explanations or commentary. Please translate the following {{sourceLang}} text into {{targetLang}}:


{{texts}}`
    },
    custom: {
        system: '',
        user: ''
    }
};

// Highlight variables in text
function highlightVariables(text) {
    if (!text) return text;
    // Escape HTML first
    let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Wrap {{variable}} in span
    return escaped.replace(/(\{\{[a-zA-Z0-9_]+\}\})/g, '<span class="highlight-var">$1</span>');
}

// Sync textarea with backdrop for highlighting
function syncEditor(textareaId, backdropId) {
    const textarea = document.getElementById(textareaId);
    const backdrop = document.getElementById(backdropId);

    if (!textarea || !backdrop) return;

    const handleInput = () => {
        // Handle scroll first
        backdrop.scrollTop = textarea.scrollTop;

        let text = textarea.value;
        if (text[text.length - 1] === '\n') {
            text += ' ';
        }
        // Use DOMParser instead of innerHTML to avoid Firefox AMO warnings
        const parser = new DOMParser();
        const doc = parser.parseFromString('<div>' + highlightVariables(text) + '</div>', 'text/html');
        // Clear backdrop using DOM methods
        while (backdrop.firstChild) {
            backdrop.removeChild(backdrop.firstChild);
        }
        // Append parsed content
        const content = doc.body.firstChild;
        while (content.firstChild) {
            backdrop.appendChild(content.firstChild);
        }
    };

    textarea.addEventListener('input', handleInput);
    textarea.addEventListener('scroll', () => {
        backdrop.scrollTop = textarea.scrollTop;
    });

    handleInput();
}

// Initialize prompt editors
function initPromptEditors() {
    syncEditor('systemPrompt', 'systemPromptBackdrop');
    syncEditor('userPrompt', 'userPromptBackdrop');
}

// The effective format = the explicit choice, or (for 'auto') the one detected
// from the selected model. resolveRequestFormat/detectRequestFormat come from languages.js.
function getEffectiveFormat() {
    const modelId = modelPicker.getValue() || currentSettings.selectedModel;
    return resolveRequestFormat({ requestFormat: requestFormatPicker.getValue() }, modelId);
}

// In-memory drafts of per-format prompt edits, keyed by format, plus which
// format the editor is currently showing. Edits aren't written into
// currentSettings.customPrompts until Save — but switching formats before
// saving would otherwise blow away whatever was just typed, since the same
// pair of textareas is reused for every format. Capturing into promptDrafts
// on every switch (and reading it back if the user returns) avoids that.
let promptDrafts = {};
let activePromptFormat = null;

// Update format description and prompt editor. 'auto' has no single template —
// it resolves to a concrete format per model — so the editor is hidden while
// it's selected. For any concrete format, shows (in priority order) an
// in-progress draft, then a saved override, then the built-in template.
function updateFormatDescription(format) {
    let desc = format && FORMAT_DESCRIPTIONS[format] ? t(FORMAT_DESCRIPTIONS[format]) : '';
    if (format === 'auto' && (modelPicker.getValue() || currentSettings.selectedModel)) {
        desc += t('formatDesc.detected', { format: formatOptionLabel(getEffectiveFormat()) });
    }
    elements.formatDescription.textContent = desc;

    if (elements.promptEditor) elements.promptEditor.hidden = (format === 'auto');
    if (format === 'auto') {
        activePromptFormat = 'auto';
        return;
    }

    // Already showing this format — nothing to (re)populate, and doing so
    // anyway would stomp an in-progress edit on every unrelated refresh
    // (e.g. picking a different model while the editor is open).
    if (activePromptFormat === format) return;

    if (activePromptFormat && activePromptFormat !== 'auto' && elements.systemPrompt && elements.userPrompt) {
        promptDrafts[activePromptFormat] = {
            system: elements.systemPrompt.value,
            user: elements.userPrompt.value,
        };
    }

    if (elements.systemPrompt && elements.userPrompt) {
        const draft = promptDrafts[format];
        const override = currentSettings.customPrompts && currentSettings.customPrompts[format];
        const fallback = PROMPT_TEMPLATES[format] || PROMPT_TEMPLATES.default;
        const source = draft || override || fallback;
        elements.systemPrompt.value = source.system || '';
        elements.userPrompt.value = source.user || '';
        elements.systemPrompt.dispatchEvent(new Event('input'));
        elements.userPrompt.dispatchEvent(new Event('input'));
    }
    if (elements.promptEditorHint) {
        elements.promptEditorHint.textContent = t('prompt.editorHint', { format });
    }
    activePromptFormat = format;
}

// Update visibility of sections based on the effective format.
function updateVisibility() {
    const effective = getEffectiveFormat();

    // TranslateGemma help — when the effective format is translategemma
    elements.translateGemmaHelp.hidden = effective !== 'translategemma';

    // Source language only matters for TranslateGemma's prompt
    if (elements.sourceLanguageGroup) {
        elements.sourceLanguageGroup.hidden = effective !== 'translategemma';
    }

    // Structured JSON output is meaningless for plain-text formats; grey it out.
    elements.useStructuredOutput.disabled = PLAIN_TEXT_FORMATS.has(effective);
}
