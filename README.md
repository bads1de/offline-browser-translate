<h1 align="center">
  <img src="assets/logo.png" width="48" valign="middle"> Local LLM Translator
</h1>

**🌐 [日本語版 README はこちら](README.ja.md)**

A privacy-focused browser extension that translates web pages using local LLMs — via Ollama, LMStudio, or any OpenAI-compatible server such as llama.cpp's `llama-server`. **Your data never leaves your machine.**

[![Get the Add-on](https://extensionworkshop.com/assets/img/documentation/publish/get-the-addon-178x60px.dad84b42.png)](https://addons.mozilla.org/en-GB/firefox/addon/local-llm-translator/)

## Features

- 🔒 **100% Private** - All translations happen on your local machine, via Ollama / LMStudio / llama.cpp
- 🦙 **You run the model** - Install a local LLM server once, load a translation-capable model, and translate — llama.cpp's `llama-server`, Ollama, or LMStudio all work
- 🎯 **Smart Prioritization** - Visible content and headings are translated first
- 🌍 **Many Languages** - Supports many many languages :3
- ⚡ **Translation Cache** - Optional: translate identical text once and reuse it (great for forums). Off by default; stored locally with a session-only or persistent mode
- 📖 **Glossary** - Force consistent translations for proper nouns and UI labels via a user-supplied dictionary
- 🚀 **Auto-Translate** - Optional: translate foreign-language pages the moment they load, with per-language and per-site exclusions

## Requirements

Run one of these locally:

- **[Ollama](https://ollama.ai/)** (default: `http://localhost:11434`)
- **[LMStudio](https://lmstudio.ai/)** (default: `http://localhost:1234`)
- **Any OpenAI-compatible server** — [llama.cpp](https://github.com/ggml-org/llama.cpp)'s `llama-server`, [vLLM](https://github.com/vllm-project/vllm), etc. Put the server's base URL (e.g. `http://localhost:8080`) in the **LMStudio / OpenAI-compatible URL** field; a trailing `/v1` is tolerated and stripped automatically. The easiest local option: [Llama Windows (llama.app)](https://llama.app/) serves the same OpenAI-compatible API; enter `http://127.0.0.1:9931` (its default port) in the **LMStudio / OpenAI-compatible URL** field

With a translation-capable model loaded (e.g. `pfnet/plamo-3-translate-0.8b-GGUF` via llama.cpp, `TranslateGemma`, `tencent.hunyuan-mt`, `qwen3`, etc.), pick **Auto-detect** as the Provider — it finds whichever of the two endpoints above is running.

## Installation

### Firefox / Mullvad Browser

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select the `manifest.json` file

For AMO (Firefox Add-ons) submission, zip the extension folder and use its existing `manifest.json` — it ships with the gecko settings Firefox expects. The extension uses no Chrome-only APIs, so the same package loads in Chrome/Edge and Firefox.

### Chrome / Chromium
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the extension folder

> **No build needed.** The extension ships as plain vanilla JavaScript — no Node.js, npm, bundler, or Docker required.

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

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Translate the page, or put the original back | `Alt+A` |
| Switch between translated and original text | `Alt+B` |
| Translate the selection | `Alt+S` |
| Translate the text in the focused field (Compose Translation) | `Alt+T` |

- **Alt+B needs something to switch to.** Until the page has been translated there is no cached translation to restore, so the shortcut starts a translation run instead of doing nothing.
- **Alt+T needs Compose Translation enabled** (Options → Compose Translation) and the caret already in a field. Empty, over-long, sensitive, and unsupported drafts report the reason in a toast.
- **Changing them.** Chrome/Edge: `chrome://extensions/shortcuts`. Firefox: `about:addons` → the extension → **Manage Extension Shortcuts**. Firefox may leave a default unassigned when it clashes with a browser shortcut; assign it there.
- The same actions are still in the popup and the right-click menu.

## Privacy

This extension is designed to be privacy-focused:

- ✅ Only connects to `localhost` - no external network requests, ever
- ✅ No analytics or tracking
- ✅ No data collection
- ✅ Minimal permissions: `localhost` access by default, with all-site access requested only for page-wide features such as auto-translate or compose translation
- ✅ The translation cache is **off by default**. When enabled it is stored **locally** (in memory, or IndexedDB for the persistent mode) and never leaves your machine; it can be set to clear on browser close, turned off, or cleared at any time

## Settings

Open the full **Settings** page (the gear icon in the popup header) to configure:

| Setting | Description |
|---------|-------------|
| Provider | Auto-detect, Ollama only, or LMStudio / OpenAI-compatible only |
| URLs | Custom endpoints for Ollama/LMStudio |
| Max tokens/items per batch | Control batch sizes |
| Temperature | Model creativity (lower = more consistent) |
| Request Format (*work in progress*) | Default JSON, Hunyuan-MT, Simple, or Custom |
| Show Glow | Toggle visual indicator on translated text |
| Cache translations | Reuse stored translations for identical text — *off* (default), *until browser close*, or *across sessions*; includes a "Clear cache" button |
| Automatically translate pages | Translate foreign-language pages on load, with never-lists for languages and sites — *off* by default |
| Compose translation | Preview and replace translations directly in input fields — *off* by default |

## Auto-Translate

By default nothing is translated until you ask for it. Turn on **Options → Auto-Translate → Automatically translate pages** and a page is instead translated as soon as it loads, whenever it declares a language other than your target language.

- **Undeclared pages are left alone.** The language is read from the page's `lang` attribute (or a `content-language` meta tag). Pages that declare nothing are skipped rather than guessed at — a wrong guess would spend real inference time making a page you can already read worse.
- **Only top-level pages.** Iframes are skipped, so ads and embedded widgets don't multiply the request count.
- **Escape hatches while it runs.** A small bar appears in the corner with **Stop** (halt and put the original text back) and **Never on this site** (same, plus adds the site to the exclusion list).
- **Exclusions.** Keep a list of languages you already read, and a list of sites to leave alone. Site entries cover subdomains, so `example.com` also excludes `news.example.com`.

This needs permission to run on all websites, since the extension has to be present on a page before you have asked for anything. Bear in mind that every page you open now costs a full translation run on your own hardware.

## Compose Translation

Turn on **Options → Compose Translation**, choose source and target languages, then focus an input field. A small translate icon appears at the field's upper-right edge.

1. Write your draft and click the translate icon.
2. Review the translation in the preview, then choose **Replace** to update the draft in place.
3. Keep editing, or click the undo button to restore the previous draft.

- **Manual only.** Draft text is sent to your local LLM only when you click the translate button; typing never sends it automatically.
- **Scope.** Textareas and plain-text `contenteditable` fields are supported. Rich-text editors are left untouched and offer a copy-only fallback.
- **Limits.** Drafts longer than 3,000 Unicode code points are rejected rather than split into requests. Undo is one level and is disabled after you edit the replacement again.
- **Safety.** Password, OTP, payment, and other sensitive-looking fields, plus hidden, disabled, and read-only fields, are excluded.
- **Cache.** Existing translation-cache settings apply; with persistent caching enabled, translated drafts may be stored locally in IndexedDB.

See [docs/compose-translation-requirements.md](docs/compose-translation-requirements.md) for the full specification.

## Translation Cache

To avoid re-translating the same text over and over (forum boilerplate, menus, usernames, repeated phrases), translations can be cached locally and reused — both later on the same page and across other pages. It is **off by default**; enable it in Options.

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

Whole-segment matches take priority over the translation cache, and loading or clearing a glossary wipes the cache (the same source text now translates differently). Models with a fixed prompt format (TranslateGemma, Hunyuan-MT) only get the whole-segment treatment — injecting instruction blocks into their prompts corrupts their output.

## File Structure

```
├── manifest.json      # Extension manifest (MV3)
├── settings/
│   ├── defaults.js    # DEFAULT_SETTINGS, the single source of truth
│   └── client.js      # Settings load/diff/save helper shared by the pages
├── background/        # Background worker (everything below is its code)
│   ├── entry.js       # Entry point (loads the files below)
│   ├── core.js        # Browser API handle, debug/perf helpers
│   ├── providers.js   # Provider detection, model listing
│   ├── settings-store.js # Cached settings
│   ├── glossary.js    # Glossary matching and prompt hints
│   ├── prompt.js      # Prompt templates, response parsing
│   ├── translate.js   # Translation pipeline, batching, cache
│   ├── content-injection.js # Content script registration, entry points
│   ├── captions-bridge.js # YouTube caption bridge
│   ├── pdf-bridge.js  # PDF probe/fetch
│   ├── messages.js    # Runtime message router
│   └── lifecycle.js   # Install, context menu, shortcuts
├── content/           # Content script fragments (loaded in order)
│   ├── core.js        # Bootstrap, compose wiring, settings listener
│   ├── dom.js         # Text extraction, sentence splitting, replacement
│   ├── widget.js      # Progress pill, toasts, page language
│   ├── page.js        # Page/selection translation, auto-translate
│   ├── messages.js    # Runtime message router
│   ├── selection.js   # Floating translate button
│   ├── captions.js    # YouTube caption bridge
│   └── startup.js     # First settings fetch and storage listener
├── compose/           # In-place draft translation
│   ├── policy.js      # Field eligibility and draft limits
│   ├── session.js     # Preview, replacement, undo, stale-result state
│   ├── textarea.js    # Textarea reads, writes, and restoration
│   ├── contenteditable.js # Plain-text contenteditable adapter
│   ├── ui.js          # Trigger, preview, and action UI
│   └── controller.js  # Focus, IME, translation, and lifecycle orchestration
├── captions/          # YouTube caption translation
│   ├── parser.js      # Caption parsing and sentence assembly
│   ├── fetcher.js     # Caption fetching (via the player, then direct)
│   └── session.js     # Playback sync, translation queue, overlay
├── pdf/               # PDF translation viewer
│   ├── viewer.html    # Viewer page (drop zone, toolbar, progress)
│   ├── viewer.js      # pdf.js wiring, translation queue, modes
│   ├── viewer.css     # Viewer styles
│   ├── layout.js      # CJK wrapping + fit-to-box font sizing
│   ├── pdf-write.js   # Dependency-free JPEG-per-page PDF writer
│   ├── paragraphs.js  # text items -> reading-order paragraphs
│   └── pdf-store.js   # IndexedDB handoff for PDF bytes
├── vendor/pdfjs/      # Mozilla pdf.js prebuilt (Apache-2.0, see NOTICE)
├── popup/
│   ├── popup.html     # Popup UI
│   ├── popup.css      # Styles (Everforest Dark theme)
│   └── popup.js       # Popup logic
└── icons/             # Extension icons
```

Caption code has four browser-free self-tests:

```
node tests/caption-selftest.mjs    # parsing, cue assembly, cue lookup
node tests/caption-wiring-test.mjs # fetch paths and fallbacks
node tests/caption-capture-test.mjs # page-side hook arming and release
node tests/caption-session-test.mjs # enable() ownership, loading cancel, stale drain
```

PDF paragraph recovery has eight:

```
node tests/pdf-paragraphs-test.mjs # line rebuild, hyphen healing, 2-column, quality
node tests/pdf-extract-test.mjs    # real vendored pdf.js -> paragraphs (fixture PDF)
node tests/pdf-wiring-test.mjs     # FETCH_PDF wiring (qualified isPdfUrl, %PDF guard)
node tests/pdf-bbox-test.mjs       # per-paragraph bounding boxes
node tests/pdf-layout-test.mjs     # wrapping + fit-to-box sizing
node tests/pdf-write-test.mjs      # PDF writer structure
node tests/pdf-head-test.mjs       # FR-12 content-type + wiring
node tests/pdf-head-functional-test.mjs # FR-12 HEAD probe vs a local server
```

Settings defaults have one guard:

```
node tests/settings-keys-test.mjs  # settings/defaults.js keys vs. keys the scripts read
```

Keyboard shortcuts have one guard:

```
node tests/commands-wiring-test.mjs    # manifest commands vs. background/content wiring
node tests/commands-background-test.mjs # command listener behaviour against a fake browser API
```

Compose translation has browser-free suites for policy, sessions, adapters, UI, controller integration, and script wiring:

```
for test in tests/compose-*.mjs; do node "$test" || exit 1; done
```

## YouTube caption translation (experimental, Phase 1)

Watch YouTube videos in your language. Caption text is sent only to your local LLM — nowhere else.

- **Scope**: `watch` pages only. Live streams and other sites are not supported
- **Usage**: Open the popup on the video page and toggle "Translate YouTube captions"
- **Display**: The popup's "Show original + translation (bilingual)" checkbox switches between translated-only and original+translation
- **How it works**: The caption track the player already uses (`/api/timedtext`) is fetched as `json3`, merged into sentence-length cues, translated through the existing pipeline, and painted on a shadow-root overlay on the player. Native captions are visually hidden but kept in the DOM
- **Note**: The first cues take a few seconds (caption fetch + translation). Only videos that have captions are supported

See [docs/youtube-captions-requirements.md](docs/youtube-captions-requirements.md) for the spec and limitations.

## PDF translation

Read papers and technical PDFs in your language, on-device. PDF text is sent only to your local LLM — nowhere else.

- **Scope**: local PDFs (file picker / drag & drop in the viewer) and PDF tab URLs ending in `.pdf` (arXiv `/pdf/<id>` links included). Extensionless URLs that serve `application/pdf` are detected with a HEAD probe (FR-12). Scanned PDFs need OCR (Phase 3+)
- **Usage**: open a PDF tab and click **Translate this PDF** in the popup — the viewer opens in a new tab and starts translating. Without file-URL access, open the file from the viewer's drop zone instead
- **Display**: each page renders as a white sheet. **Overlay** (default) paints the translation at every paragraph's original position so the page looks like the original, in Japanese; **Original** shows the source PDF; **Bilingual** adds a parallel text block. Zoom and dark mode included
- **How it works**: Mozilla pdf.js (Apache-2.0, vendored under `vendor/pdfjs/`) renders pages and extracts text; paragraphs are rebuilt (line joins, hyphen healing, two-column detection) and translated through the existing TRANSLATE pipeline, so the cache and glossary apply as usual
- **Export**: **Save translated PDF** paints the translation onto each page and downloads a PDF. It is image-based (JPEG per page), so exported text is not selectable; long translations are auto-shrunk to fit the original text box
- **Note**: selectable-text export with embedded CJK fonts is a possible future enhancement

See [docs/pdf-translation-requirements.md](docs/pdf-translation-requirements.md) for the full spec and the phase plan.

## Development

Pure vanilla JavaScript — the extension loads unpacked with no build step:

- No Node.js, npm, bundler, or Docker required
- Works directly in the browser

### Debug Logging

Enable **"Enable debug logging"** in Options → Output Settings, then Save.

To view logs, go to `about:debugging#/runtime/this-firefox`, find **Local LLM Translator**, and click **Inspect** — messages with `[Background]` prefix appear in the Console tab.

## License

MIT — see [LICENSE](LICENSE).

This project is based on [Eldoprano/offline-browser-translate](https://github.com/Eldoprano/offline-browser-translate).
