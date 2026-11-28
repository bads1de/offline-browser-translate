// Unit tests for the popup's provider detection and model loading
// (popup/providers.js), driven against a fake DOM and browser API.
// Run: node tests/popup-providers-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..');
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');

let pass = 0;
let fail = 0;
function check(name, condition, detail) {
    if (condition) {
        pass++;
        console.log('  ok  ' + name);
    } else {
        fail++;
        console.log('FAIL  ' + name);
        if (detail !== undefined) console.log('      ' + JSON.stringify(detail));
    }
}

// Boots popup/providers.js in a fresh vm context. respond(message) decides what
// the background answers (it may throw to simulate an unreachable runtime).
function boot({ respond = async () => ({}), settings = {}, banner = null, models = [], selected = null } = {}) {
    const calls = [];
    const errors = [];
    const statusDot = { className: '', title: '' };
    const statusWrapper = {
        title: '',
        querySelector: sel => (sel === '.status-dot' ? statusDot : null)
    };
    const modelTrigger = { disabled: false, textContent: '' };
    const modelTriggerLabel = { textContent: '' };
    const translateBtn = { disabled: false };
    const created = [];
    const inserted = [];
    const modelRow = { parentNode: { insertBefore: el => inserted.push(el) }, nextSibling: null };
    const modelPickerEl = { closest: () => modelRow, parentElement: modelRow };

    const document = {
        getElementById: id => (id === 'setup-banner' ? banner : null),
        createElement: () => {
            const el = { id: '', hidden: false, innerHTML: '', style: { cssText: '' } };
            created.push(el);
            return el;
        },
        querySelector: () => ({ prepend: el => inserted.push(el) })
    };

    const picker = {
        allModels: models,
        value: selected,
        getSelectedProvider() {
            const m = this.allModels.find(x => x.id === this.value);
            return m ? m.provider : null;
        },
        setModels(list) { this.allModels = list; },
        setPinned() {},
        setValue(id) { this.value = id; }
    };

    const ctx = {
        browserAPI: {
            runtime: {
                sendMessage: async message => {
                    calls.push({ ...message });
                    return respond(message, calls.length);
                }
            }
        },
        elements: {
            providerStatus: statusWrapper,
            modelTrigger,
            modelTriggerLabel,
            translateBtn,
            modelPickerEl
        },
        currentSettings: { provider: 'auto', selectedModel: null, pinnedModels: [], ...settings },
        modelPicker: picker,
        isTranslating: false,
        t: (key, vars) => 't:' + key + (vars
            ? '|' + Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(',')
            : ''),
        document,
        console: { log() {}, error: (...args) => errors.push(args.map(String).join(' ')) }
    };

    vm.createContext(ctx);
    vm.runInContext(read('popup/providers.js'), ctx);
    return { ctx, calls, errors, statusDot, statusWrapper, modelTrigger, modelTriggerLabel, translateBtn, banner, created, inserted, picker };
}

const run = (h, code) => vm.runInContext(code, h.ctx);

console.log('Popup provider detection:');

// --- detection success ---
{
    const h = boot({
        respond: async () => ({ ollama: true, lmstudio: false }),
        banner: { hidden: false, innerHTML: '' }
    });
    await run(h, 'checkProviders()');
    check('asks the background to detect providers', h.calls[0] && h.calls[0].type === 'DETECT_PROVIDERS', h.calls);
    check('connected provider turns the dot green', h.statusDot.className === 'status-dot connected', h.statusDot.className);
    check('status title lists connected providers', h.statusWrapper.title === 't:status.connected|providers=Ollama', h.statusWrapper.title);
    check('providersAvailable is set', run(h, 'providersAvailable') === true);
    check('setup banner is hidden once connected', h.banner.hidden === true);
}

// --- detection failure (runtime unreachable) ---
{
    const h = boot({ respond: async () => { throw new Error('runtime offline'); } });
    await run(h, 'checkProviders()');
    check('failed detection marks the dot as error', h.statusDot.className === 'status-dot error', h.statusDot.className);
    check('failed detection shows the checkError title', h.statusWrapper.title === 't:status.checkError', h.statusWrapper.title);
    check('failed detection clears providersAvailable', run(h, 'providersAvailable') === false);
    check('failed detection clears providersBlocked', run(h, 'providersBlocked') === false);
    check('failed detection creates the setup banner', h.created.length === 1 && h.created[0].id === 'setup-banner', h.created);
    check('failed detection shows the no-provider copy', h.created[0] && h.created[0].innerHTML === 't:banner.noProvider', h.created[0] && h.created[0].innerHTML);
    check('new banner is inserted next to the model row', h.inserted.includes(h.created[0]));
}

// --- explicit provider blocked by CORS ---
{
    const h = boot({
        respond: async () => ({ ollama: false, lmstudio: false, ollama_blocked: true }),
        settings: { provider: 'ollama' },
        banner: { hidden: false, innerHTML: '' }
    });
    await run(h, 'checkProviders()');
    check('blocked Ollama keeps the dot on error', h.statusDot.className === 'status-dot error', h.statusDot.className);
    check('blocked Ollama shows the CORS title', h.statusWrapper.title === 't:status.corsOllama', h.statusWrapper.title);
    check('blocked Ollama sets providersBlocked', run(h, 'providersBlocked') === true);
    check('blocked Ollama shows the CORS banner', h.banner.innerHTML === 't:banner.corsOllama', h.banner.innerHTML);
}

// --- auto mode follows the selected model's provider ---
{
    const h = boot({
        respond: async () => ({ ollama: false, lmstudio: true }),
        settings: { provider: 'auto' },
        models: [{ id: 'm1', name: 'M1', provider: 'lmstudio' }],
        selected: 'm1'
    });
    await run(h, 'checkProviders()');
    check('auto mode uses the selected model provider', h.statusWrapper.title === 't:status.connected|providers=LMStudio', h.statusWrapper.title);
    check('available providers enable the Translate button', h.translateBtn.disabled === false);
}

// --- no provider at all ---
{
    const h = boot({ respond: async () => ({ ollama: false, lmstudio: false }) });
    await run(h, 'checkProviders()');
    check('no provider shows the noProviders title', h.statusWrapper.title === 't:status.noProviders', h.statusWrapper.title);
    check('no provider shows the no-provider banner', h.created[0] && h.created[0].innerHTML === 't:banner.noProvider', h.created[0] && h.created[0].innerHTML);
}

// --- banner copy mapping ---
{
    const h = boot();
    check('bannerHTML: no-models', run(h, "bannerHTML('no-models')") === 't:banner.noModels');
    check('bannerHTML: cors ollama', run(h, "bannerHTML('cors-blocked-ollama')") === 't:banner.corsOllama');
    check('bannerHTML: cors lmstudio', run(h, "bannerHTML('cors-blocked-lmstudio')") === 't:banner.corsLmstudio');
    check('bannerHTML: default', run(h, "bannerHTML('other')") === 't:banner.noProvider');
}

// --- hideSetupBanner only hides when providers are available ---
{
    const h = boot({ banner: { hidden: false, innerHTML: '' } });
    run(h, 'hideSetupBanner()');
    check('hideSetupBanner leaves the banner while unavailable', h.banner.hidden === false);
    run(h, 'providersAvailable = true; hideSetupBanner()');
    check('hideSetupBanner hides once available', h.banner.hidden === true);
}

// --- model loading: saved model still exists ---
{
    const h = boot({
        respond: async () => ({ models: [
            { id: 'a', name: 'A', provider: 'ollama' },
            { id: 'b', name: 'B', provider: 'lmstudio' }
        ] }),
        settings: { selectedModel: 'b', pinnedModels: ['b'] }
    });
    await run(h, 'loadModels(true)');
    check('loadModels forwards forceRefresh', h.calls[0].type === 'LIST_MODELS' && h.calls[0].forceRefresh === true, h.calls[0]);
    check('loadModels stores the returned list', h.picker.allModels.length === 2);
    check('loadModels keeps a still-present selected model', h.picker.value === 'b', h.picker.value);
    check('loadModels re-enables the model trigger', h.modelTrigger.disabled === false);
}

// --- model loading: saved model is gone -> first model ---
{
    const h = boot({
        respond: async () => ({ models: [{ id: 'a', name: 'A', provider: 'ollama' }] }),
        settings: { selectedModel: 'missing' }
    });
    await run(h, 'loadModels()');
    check('loadModels falls back to the first model', h.picker.value === 'a', h.picker.value);
}

// --- model loading: empty list while a provider is blocked ---
{
    let detect = { ollama: true, lmstudio: false };
    const h = boot({
        respond: message => (message.type === 'LIST_MODELS' ? { models: [] } : detect),
        banner: { hidden: false, innerHTML: '' }
    });
    await run(h, 'checkProviders()');
    detect = { ollama: false, lmstudio: false, ollama_blocked: true };
    await run(h, 'loadModels()');
    check('empty list reports "no models"', h.modelTriggerLabel.textContent === 't:model.noneFound', h.modelTriggerLabel.textContent);
    check('empty list re-enables the model trigger', h.modelTrigger.disabled === false);
    check('empty list prioritizes the CORS banner', h.banner.innerHTML === 't:banner.corsOllama', h.banner.innerHTML);
}

// --- model loading: empty list with a healthy provider ---
{
    const h = boot({
        respond: message => (message.type === 'LIST_MODELS' ? { models: [] } : { ollama: true }),
        banner: { hidden: false, innerHTML: '' }
    });
    await run(h, 'checkProviders()');
    await run(h, 'loadModels()');
    check('healthy but empty provider shows the no-models banner', h.banner.innerHTML === 't:banner.noModels', h.banner.innerHTML);
}

// --- model loading failure ---
{
    const h = boot({ respond: async () => { throw new Error('list failed'); } });
    await run(h, 'loadModels()');
    check('failed load shows the loadError label', h.modelTriggerLabel.textContent === 't:model.loadError', h.modelTriggerLabel.textContent);
    check('failed load re-enables the model trigger', h.modelTrigger.disabled === false);
    check('failed load is logged', h.errors.some(e => e.includes('list failed')), h.errors);
}

// --- translate button is left alone mid-translation ---
{
    const h = boot({
        models: [{ id: 'm1', name: 'M1', provider: 'ollama' }],
        selected: 'm1',
        settings: { provider: 'ollama' }
    });
    run(h, 'isTranslating = true; lastProviderDetect = { ollama: false }');
    run(h, 'updateProviderStatusUI()');
    check('mid-translation keeps the Translate button state', h.translateBtn.disabled === false);
    run(h, 'isTranslating = false; updateProviderStatusUI()');
    check('idle with no connection disables the Translate button', h.translateBtn.disabled === true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
