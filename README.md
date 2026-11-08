<h1 align="center">
  <img src="assets/logo.png" width="48" valign="middle"> Local LLM Translator
</h1>

A privacy-focused browser extension that translates web pages using local LLMs — either with a built-in PLaMo 3 Translate model running fully in your browser (WebGPU), or via Ollama / LMStudio. **Your data never leaves your machine.**

[![Get the Add-on](https://extensionworkshop.com/assets/img/documentation/publish/get-the-addon-178x60px.dad84b42.png)](https://addons.mozilla.org/en-GB/firefox/addon/local-llm-translator/)

## Features

- 🔒 **100% Private** - All translations happen on your local machine, either via the built-in WebGPU model or via Ollama / LMStudio
- 🧩 **Zero setup (built-in model)** - No server, no account, no Docker: on Chrome/Edge, translations run on the PLaMo 3 Translate 0.8B model inside the browser itself. The model (~546 MB) is downloaded once, on first use, then loads from local cache in ~1–2 seconds
- 🎯 **Smart Prioritization** - Visible content and headings are translated first
- 🌍 **Many Languages** - Supports many many languages :3
- ⚡ **Translation Cache** - Optional: translate identical text once and reuse it (great for forums). Off by default; stored locally with a session-only or persistent mode
- 📖 **Glossary** - Force consistent translations for proper nouns and UI labels via a user-supplied dictionary
- 🚀 **Auto-Translate** - Optional: translate foreign-language pages the moment they load, with per-language and per-site exclusions

## Requirements

**Either** use the built-in model (Chrome / Edge only) — no install needed:

- **Chrome or Edge** with WebGPU support (hardware acceleration enabled). Nothing to run, no account. On first use of the built-in mode, the PLaMo 3 Translate 0.8B model (~546 MB) is downloaded from Hugging Face once and cached on disk (OPFS)

**Or** run one of these locally (works everywhere, including Firefox):

- **[Ollama](https://ollama.ai/)** (default: `http://localhost:11434`)
- **[LMStudio](https://lmstudio.ai/)** (default: `http://localhost:1234`)
- **Any OpenAI-compatible server** — [llama.cpp](https://github.com/ggml-org/llama.cpp)'s `llama-server`, [vLLM](https://github.com/vllm-project/vllm), etc. Put the server's base URL (e.g. `http://localhost:8080`) in the **LMStudio / OpenAI-compatible URL** field; a trailing `/v1` is tolerated and stripped automatically

With a translation-capable model loaded (e.g. `TranslateGemma`, `tencent.hunyuan-mt`, `qwen3`, etc.)

## Installation

### Firefox / Mullvad Browser
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select the `manifest.json` file

### Chrome / Chromium
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the extension folder

> **No build needed.** The built-in WebGPU module in `offscreen/` is committed as a prebuilt bundle (`offscreen/offscreen.bundle.js`), so a plain `git clone` / branch ZIP loads and runs as-is — no Node.js, npm, bundler, or Docker required. (You only need `npm ci && npm run build` in `offscreen/` if you modify the module's source yourself.)

**Coming Soon:** Extension in Chrome Web Store

## Preview

<p align="center">
  <img src="assets/translating.png" width="600" alt="Extension Screenshot">
</p>

## Usage

1. Click the extension icon
2. Select a model from the dropdown
3. Choose your target language
4. Click **Translate Page**

The extension will:
- Extract all visible text from the page
- Prioritize headings and visible content
- Translate in batches with progress percentage
- Auto-translate new content (infinite scroll)

### Built-in WebGPU mode (Chrome / Edge)

1. Click the extension icon
2. Set **Provider** to **Built-in (PLaMo 3 Translate 0.8B / WebGPU)** (Settings or popup)
3. Click **Translate Page**

First use downloads the model once (~546 MB, one time) — the page widget, the popup, and Options → **Built-in Model** all show download progress. After that, it is cached locally (OPFS) and loads in ~1–2 seconds. After 5 minutes without translating, the model is unloaded to free VRAM; the next translation reloads it from cache. The built-in model is the same PFN PLaMo 3 Translate weights distributed on Hugging Face — the model is not bundled in the extension. Usage of the model is governed by the PLaMo Community License: personal and academic use is free; commercial use requires prior registration with PFN (see `offscreen/MODEL-LICENSE.md`).

The downloaded model can be removed any time from **Options → Built-in Model → Delete model** (frees ~546 MB; you can download it again later). The built-in section also shows the current download state, downloaded size, and the license terms.

This mode is not available on Firefox (it needs the offscreen API) — Firefox defaults to the external-server modes.

## Privacy

This extension is designed to be privacy-focused:

- ✅ Only connects to `localhost` - no external network requests **unless you opt into the built-in model**, which downloads it from Hugging Face once, on first use, and never sends page text anywhere
- ✅ No analytics or tracking
- ✅ No data collection
- ✅ Minimal permissions (only `localhost` host permissions)
- ✅ The translation cache is **off by default**. When enabled it is stored **locally** (in memory, or IndexedDB for the persistent mode) and never leaves your machine; it can be set to clear on browser close, turned off, or cleared at any time

## Settings

Click **Advanced Settings** to configure:

| Setting | Description |
|---------|-------------|
| Provider | Auto-detect, Ollama only, LMStudio only, or Built-in (Chrome/Edge only) |
| URLs | Custom endpoints for Ollama/LMStudio (hidden in Built-in mode) |
| Max tokens/items per batch | Control batch sizes |
| Temperature | Model creativity (lower = more consistent) |
| Request Format (*work in progress*) | Default JSON, Hunyuan-MT, Simple, or Custom |
| Show Glow | Toggle visual indicator on translated text |
| Cache translations | Reuse stored translations for identical text — *off* (default), *until browser close*, or *across sessions*; includes a "Clear cache" button |
| Automatically translate pages | Translate foreign-language pages on load, with never-lists for languages and sites — *off* by default |

## Auto-Translate

By default nothing is translated until you ask for it. Turn on **Options → Auto-Translate → Automatically translate pages** and a page is instead translated as soon as it loads, whenever it declares a language other than your target language.

- **Undeclared pages are left alone.** The language is read from the page's `lang` attribute (or a `content-language` meta tag). Pages that declare nothing are skipped rather than guessed at — a wrong guess would spend real inference time making a page you can already read worse.
- **Only top-level pages.** Iframes are skipped, so ads and embedded widgets don't multiply the request count.
- **Escape hatches while it runs.** A small bar appears in the corner with **Stop** (halt and put the original text back) and **Never on this site** (same, plus adds the site to the exclusion list).
- **Exclusions.** Keep a list of languages you already read, and a list of sites to leave alone. Site entries cover subdomains, so `example.com` also excludes `news.example.com`.

This needs permission to run on all websites, since the extension has to be present on a page before you have asked for anything. Bear in mind that every page you open now costs a full translation run on your own hardware.

## Translation Cache

To avoid re-translating the same text over and over (forum boilerplate, menus, usernames, repeated phrases), translations can be cached locally and reused — both later on the same page and across other pages. It is **off by default**; enable it in Options or the popup's Advanced Settings.

- **Modes (Options → Translation Cache):**
  - **Don't cache** (default) — every segment is translated fresh.
  - **Until I close the browser** — cache speeds things up while you browse, then is wiped on the next browser start. Kept in memory, so nothing translation-related lingers on disk between sessions. Works in every browser.
  - **Keep across sessions** — cache persists on disk (IndexedDB) until you clear it. Best for repeatedly visiting the same sites. Hardened browsers that block IndexedDB (e.g. Mullvad/Tor-based Firefox) disable this option automatically and fall back to the in-memory session cache.
- **What's cached:** the translated output for each source text segment, stored locally (in memory, or IndexedDB for the persistent mode) — nothing is uploaded.
- **How it's keyed:** by the source text plus everything that determines the model's output — model, source & target language, request format, prompt template, structured-output mode, and temperature. Changing any of these yields fresh translations instead of stale cached ones, so the cache never serves output that wouldn't match your current settings.
- **De-duplication:** within a single page, identical strings are translated only once and the result is reused for every occurrence (this happens regardless of cache mode).
- **Clearing:** use **Clear cache** to wipe it at any time (the button shows the current entry count). The cache is capped (oldest entries are evicted first).

## Glossary

Load a TSV dictionary (Options → Glossary) to pin translations for specific terms. Each line is `source<TAB>translation`; leave the second column empty to keep the term untranslated. Matching is case-sensitive. A `#target: ja` line declares the language the glossary translates into — the glossary is then only applied when that target language is selected (recommended, since a glossary maps terms into one specific language).

It works at two levels:

- **Inside sentences** — glossary terms found in the text being translated are injected into the prompt as hard hints, so the model keeps proper nouns consistent (e.g. *The Companions* → *同胞団* everywhere). Only matching terms are sent, so a large dictionary is fine.
- **Whole segments** — when a segment consists *entirely* of a glossary term, the mapping is applied directly and the model is skipped. This is the reliable way to fix short context-free labels that small models mangle — e.g. add `About<TAB>概要` and the nav heading "About" always becomes "概要" instead of the broken "について".

Whole-segment matches take priority over the translation cache, and loading or clearing a glossary wipes the cache (the same source text now translates differently). Models with a fixed prompt format (TranslateGemma, Hunyuan-MT) only get the whole-segment treatment — injecting instruction blocks into their prompts corrupts their output. The built-in PLaMo 3 mode gets terms via the model's native PFML3 glossary instead of instruction blocks. See `examples/` for a sample dictionary.

## File Structure

```
├── manifest.json      # Extension manifest (MV3)
├── background.js      # Background script (LLM API, settings, offscreen lifecycle)
├── offscreen/         # Built-in WebGPU inference module (hachiue + PLaMo 3, bundled)
│   ├── src/           #   offscreen.js + plamo3-prompt.js (PFML3, unit-tested)
│   ├── test/          #   node --test unit tests (no GPU required)
│   └── MODEL-LICENSE.md # PLaMo Community License notice for the downloaded model
├── content.js         # Content script (DOM manipulation)
├── popup/
│   ├── popup.html     # Popup UI
│   ├── popup.css      # Styles (Everforest Dark theme)
│   └── popup.js       # Popup logic
└── icons/             # Extension icons
```

## Development

The extension itself is vanilla JavaScript with no build step, but the built-in WebGPU module in `offscreen/` is built with esbuild (its dependencies are pinned and the bundle is committed, so the extension loads unpacked without any tooling):

```
cd offscreen
npm ci
npm test        # unit tests (PFML3 builder — no GPU needed)
npm run build   # rebuild offscreen.bundle.js after changing src/
```

- Pure vanilla JavaScript for the extension itself
- Works directly in the browser

### Debug Logging

Enable **"Enable debug logging"** in Options → Output Settings, then Save.

To view logs, go to `about:debugging#/runtime/this-firefox`, find **Local LLM Translator**, and click **Inspect** — messages with `[Background]` prefix appear in the Console tab.

## License

MIT — see [LICENSE](LICENSE).

This project is based on [Eldoprano/offline-browser-translate](https://github.com/Eldoprano/offline-browser-translate).
