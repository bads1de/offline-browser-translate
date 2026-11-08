<h1 align="center">
  <img src="assets/logo.png" width="48" valign="middle"> Local LLM Translator
</h1>

**🌐 [English README](README.md)**

プライバシー重視のブラウザ拡張機能で、ローカル LLM を使ってウェブページを翻訳します。ブラウザ内で完全に動作する内蔵の PLaMo 3 Translate モデル（WebGPU）か、Ollama / LMStudio 経由で利用できます。**あなたのデータがマシンの外に出ることはありません。**

[![Get the Add-on](https://extensionworkshop.com/assets/img/documentation/publish/get-the-addon-178x60px.dad84b42.png)](https://addons.mozilla.org/en-GB/firefox/addon/local-llm-translator/)

## 機能

- 🔒 **100% プライベート** — すべての翻訳はローカルマシン上で行われます。内蔵 WebGPU モデル、または Ollama / LMStudio 経由を選べます
- 🧩 **セットアップ不要（内蔵モデル）** — サーバーもアカウントも Docker も不要。Chrome / Edge では PLaMo 3 Translate 0.8B モデルがブラウザ内部で翻訳を実行します。モデル（約546 MB）は初回使用時に一度だけダウンロードされ、その後はローカルキャッシュから約1〜2秒で読み込まれます
- 🎯 **スマートな優先順位付け** — 表示中のコンテンツや見出しを優先して翻訳します
- 🌍 **多言語対応** — たくさんの言語に対応 :3
- ⚡ **翻訳キャッシュ** — 任意機能：同じテキストを一度だけ翻訳して再利用します（フォーラムなどに便利）。デフォルトはオフ。ローカルに保存され、セッションのみ／永続のモードを選べます
- 📖 **用語集（Glossary）** — ユーザーが用意した辞書で、固有名詞や UI ラベルの訳を統一します
- 🚀 **自動翻訳** — 任意機能：外国語のページを読み込んだ瞬間に自動翻訳します。言語ごと・サイトごとの除外設定が可能です

## 必要要件

**内蔵モデルを使う場合**（Chrome / Edge のみ）— インストール不要：

- **Chrome または Edge** で WebGPU をサポートしていること（ハードウェアアクセラレーション有効）。サーバーもアカウントも不要です。内蔵モードを初めて使用すると、PLaMo 3 Translate 0.8B モデル（約546 MB）が Hugging Face から一度だけダウンロードされ、ディスク（OPFS）にキャッシュされます

**または**、以下をローカルで動かす場合（Firefox を含むすべてのブラウザで動作）：

- **[Ollama](https://ollama.ai/)**（デフォルト: `http://localhost:11434`）
- **[LMStudio](https://lmstudio.ai/)**（デフォルト: `http://localhost:1234`）
- **その他の OpenAI 互換サーバー** — [llama.cpp](https://github.com/ggml-org/llama.cpp) の `llama-server`、[vLLM](https://github.com/vllm-project/vllm) など。サーバーのベース URL（例: `http://localhost:8080`）を **LMStudio / OpenAI-compatible URL** フィールドに入力してください。末尾の `/v1` は許容され、自動的に取り除かれます

翻訳に対応したモデル（例: `TranslateGemma`、`tencent.hunyuan-mt`、`qwen3` など）を読み込んでおく必要があります

## インストール

### Firefox / Mullvad Browser

内蔵 WebGPU モードは Chrome / Edge 専用の `offscreen` 権限を必要とし、Firefox では読み込み時に拒否されます。そのため、リポジトリには `manifest.firefox.json` が同梱されています。これは `manifest.json` から `offscreen` 権限だけを除いたものです（`alarms` はどちらでも問題ありません）。この2つは同期させてください。許される差分は `offscreen` のエントリのみです。

1. Firefox 用マニフェストを配置します：
   ```powershell
   Copy-Item manifest.firefox.json manifest.json   # Windows / PowerShell
   # cp manifest.firefox.json manifest.json          # macOS / Linux
   ```
   （これは作業ツリー内の `manifest.json` を上書きします。元に戻すには `git checkout -- manifest.json`。Chrome / Edge をお使いの方は元のままにしてください。）
2. `about:debugging#/runtime/this-firefox` を開きます
3. **一時的なアドオンを読み込む（Load Temporary Add-on）** をクリックします
4. `manifest.json` ファイルを選択します

AMO（Firefox Add-ons）に提出する場合は、`manifest.firefox.json` を `manifest.json` として zip 化してください。内蔵 WebGPU モードはそちらでも Chrome / Edge 専用のままです。Firefox のユーザーは Chrome 版のデフォルトと同様に外部サーバーモードを利用します。

### Chrome / Chromium
1. `chrome://extensions` を開きます
2. **デベロッパーモード** を有効にします
3. **パッケージ化されていない拡張機能を読み込む（Load unpacked）** をクリックします
4. 拡張機能のフォルダを選択します

> **ビルドは不要です。** `offscreen/` 内の内蔵 WebGPU モジュールはビルド済みバンドル（`offscreen/offscreen.bundle.js`）としてコミットされているため、`git clone` やブランチの ZIP をそのまま読み込んで動作します。Node.js・npm・バンドラー・Docker は不要です。（`offscreen/` 内のモジュールのソースを自分で変更した場合のみ `npm ci && npm run build` が必要です。）

**近日公開予定:** Chrome ウェブストアでの拡張機能

## プレビュー

<p align="center">
  <img src="assets/translating.png" width="600" alt="拡張機能のスクリーンショット">
</p>

## 使い方

1. 拡張機能のアイコンをクリックします
2. ドロップダウンからモデルを選択します
3. 翻訳先の言語を選びます
4. **Translate Page（ページを翻訳）** をクリックします

拡張機能は以下を行います：
- ページ内の表示されているテキストをすべて抽出します
- 見出しと表示中のコンテンツを優先します
- 進捗パーセンテージ付きでバッチ翻訳します
- 新しく読み込まれたコンテンツ（無限スクロール）を自動翻訳します

### 内蔵 WebGPU モード（Chrome / Edge）

1. 拡張機能のアイコンをクリックします
2. **Provider** を **Built-in (PLaMo 3 Translate 0.8B / WebGPU)** に設定します（設定またはポップアップから）
3. **Translate Page（ページを翻訳）** をクリックします

初回使用時にモデルが一度だけダウンロードされます（約546 MB、1回のみ）。ページ上のウィジェット、ポップアップ、および オプション → **Built-in Model** にダウンロード進捗が表示されます。その後はローカル（OPFS）にキャッシュされ、約1〜2秒で読み込まれます。翻訳せずに5分経過すると、VRAM を解放するためにモデルはアンロードされます。次回の翻訳時にキャッシュから再読み込みされます。内蔵モデルは Hugging Face で配布されている PFN PLaMo 3 Translate の重みと同一のもので、拡張機能には同梱されていません。モデルの利用は PLaMo Community License に従います：個人・学術利用は無料、商用利用には PFN への事前登録が必要です（`offscreen/MODEL-LICENSE.md` を参照）。

ダウンロード済みモデルはいつでも **Options（オプション）→ Built-in Model → Delete model** から削除できます（約546 MB が解放されます。あとから再ダウンロードも可能です）。内蔵モデルのセクションには、現在のダウンロード状態、ダウンロード済みサイズ、ライセンス条項も表示されます。

このモードは Firefox では利用できません（offscreen API が必要なため）。Firefox では外部サーバーモードがデフォルトです。

## プライバシー

この拡張機能はプライバシーを重視して設計されています：

- ✅ `localhost` にのみ接続します。**内蔵モデルをオプトインした場合を除き**、外部ネットワークへのリクエストは発生しません。内蔵モデルは初回使用時に一度だけ Hugging Face からダウンロードされ、ページのテキストを外部に送信することは一切ありません
- ✅ アナリティクスやトラッキングなし
- ✅ データ収集なし
- ✅ 必要最小限の権限（`localhost` のホスト権限のみ）
- ✅ 翻訳キャッシュは**デフォルトでオフ**です。有効にしても**ローカルに**保存され（メモリ上、または永続モードの場合は IndexedDB）、マシンの外に出ることはありません。ブラウザ終了時にクリアする設定、オフにする設定、いつでも手動でクリアすることも可能です

## 設定

**Advanced Settings** をクリックして設定します：

| 設定 | 説明 |
|---------|-------------|
| Provider | 自動検出、Ollama のみ、LMStudio のみ、または Built-in（Chrome / Edge のみ） |
| URLs | Ollama / LMStudio のカスタムエンドポイント（Built-in モードでは非表示） |
| Max tokens/items per batch | バッチサイズの制御 |
| Temperature | モデルの創造性（低いほど一貫性が高くなります） |
| Request Format（*作業中*） | デフォルト JSON、Hunyuan-MT、Simple、または Custom |
| Show Glow | 翻訳済みテキストの視覚インジケーターの切り替え |
| Cache translations | 同一テキストの翻訳結果を再利用 — *オフ*（デフォルト）、*ブラウザ終了まで*、または*セッションをまたいで*。「Clear cache」ボタン付き |
| Automatically translate pages | 外国語ページを読み込み時に翻訳。言語とサイトの除外リスト付き — デフォルト*オフ* |

## 自動翻訳

デフォルトでは、何も翻訳されません。**Options（オプション）→ Auto-Translate → Automatically translate pages** を有効にすると、ページの読み込み時に、ターゲット言語以外の言語が宣言されているページが即座に翻訳されます。

- **言語未宣言のページはスキップされます。** 言語はページの `lang` 属性（または `content-language` メタタグ）から読み取ります。何も宣言していないページは推測せずスキップします。誤った推測は、自分で読めるページを悪化させるために実際の推論リソースを浪費するからです。
- **トップレベルのページのみ。** iframe はスキップされるため、広告や埋め込みウィジェットによってリクエスト数が増えることはありません。
- **実行中の緊急停止手段。** 画面の隅に小さなバーが表示され、**Stop**（停止して元のテキストに戻す）と **Never on this site**（同じ処理に加えて、そのサイトを除外リストに追加する）が使えます。
- **除外設定。** すでに読める言語のリストと、除外したいサイトのリストを管理できます。サイトのエントリはサブドメインをカバーするため、`example.com` を指定すると `news.example.com` も除外されます。

全ウェブサイトへの実行権限が必要です。拡張機能は、ユーザーが何かを要求する前にページへ存在している必要があるためです。なお、この機能を有効にすると、開くすべてのページであなた自身のハードウェア上で翻訳処理が実行されることに留意してください。

## 翻訳キャッシュ

同じテキストを何度も翻訳し直さないように（フォーラムの定型文、メニュー、ユーザー名、繰り返しのフレーズなど）、翻訳結果をローカルにキャッシュして再利用できます。同じページ内でも、他のページでも使えます。**デフォルトはオフ**です。Options またはポップアップの Advanced Settings から有効にできます。

- **モード（Options → Translation Cache）：**
  - **Don't cache**（デフォルト）— すべてのセグメントを毎回新規に翻訳します。
  - **Until I close the browser**（ブラウザを閉じるまで）— 閲覧中はキャッシュで高速化し、次回のブラウザ起動時に消去されます。メモリ上に保持されるため、セッション間で翻訳データがディスクに残ることはありません。すべてのブラウザで動作します。
  - **Keep across sessions**（セッションをまたいで保持）— キャッシュはディスク（IndexedDB）に永続化され、自分でクリアするまで残ります。同じサイトを繰り返し訪問する場合に最適です。IndexedDB をブロックする強化ブラウザ（Mullvad / Tor ベースの Firefox など）では、このオプションは自動的に無効化され、メモリ上のセッションキャッシュにフォールバックします。
- **キャッシュされるもの：** 各ソーステキストセグメントの翻訳結果。ローカルに保存され（メモリ上、または永続モードの場合は IndexedDB）、アップロードされることはありません。
- **キーの仕組み：** ソーステキストに加えて、モデルの出力を決定づけるすべての要素 — モデル、ソース言語・ターゲット言語、リクエスト形式、プロンプトテンプレート、構造化出力モード、temperature — でキー付けされます。これらのいずれかを変更すると、古いキャッシュではなく新規の翻訳が得られるため、現在の設定と合わない出力をキャッシュが返すことはありません。
- **重複除去：** 1ページ内の同一文字列は一度だけ翻訳され、その結果がすべての出現箇所で再利用されます（これはキャッシュモードに関係なく行われます）。
- **クリア：** いつでも **Clear cache** で消去できます（ボタンには現在のエントリ数が表示されます）。キャッシュには上限があり、上限を超えると古いエントリから順に削除されます。

## 用語集（Glossary）

TSV 形式の辞書を読み込み（Options → Glossary）、特定の用語の訳を固定します。各行は `source<TAB>translation`（ソースと訳をタブ区切り）で、2列目を空にするとその用語を翻訳せず原文のまま残します。マッチングは大文字小文字を区別します。`#target: ja` という行を入れると、その用語集がどの言語への翻訳用なのかを宣言できます。以降、そのターゲット言語が選択されているときだけ用語集が適用されます（用語集は特定の1言語へのマッピングなので、この方法が推奨です）。

2つのレベルで機能します：

- **文の中** — 翻訳対象のテキスト内で見つかった用語集の用語が、ハードヒントとしてプロンプトに注入されます。これによりモデルは固有名詞の訳を一貫させます（例: *The Companions* → *同胞団* をどこでも同じ訳に）。マッチした用語だけが送信されるため、大きな辞書でも問題ありません。
- **セグメント全体** — セグメントが用語集の用語*のみ*で構成される場合、モデルをバイパスしてマッピングが直接適用されます。これは、コンテキストのない短いラベルを小さなモデルが壊してしまうのを防ぐ確実な方法です。たとえば `About<TAB>概要` を追加しておけば、ナビ見出しの "About" は常に "概要" になります（壊れた "について" にはなりません）。

セグメント全体のマッチは翻訳キャッシュより優先されます。また、用語集を読み込んだりクリアしたりするとキャッシュが消去されます（同じソーステキストが異なる訳になりうるため）。固定プロンプト形式のモデル（TranslateGemma、Hunyuan-MT）ではセグメント全体の処理のみ適用されます。指示ブロックをプロンプトに注入すると出力が壊れるためです。内蔵の PLaMo 3 モードでは、指示ブロックではなくモデルネイティブの PFML3 用語集経由で用語が渡されます。サンプル辞書は `examples/` を参照してください。

## ファイル構成

```
├── manifest.json      # 拡張機能マニフェスト (MV3)
├── background.js      # バックグラウンドスクリプト（LLM API、設定、offscreen のライフサイクル）
├── offscreen/         # 内蔵 WebGPU 推論モジュール（hachiue + PLaMo 3、バンドル済み）
│   ├── src/           #   offscreen.js + plamo3-prompt.js (PFML3、ユニットテスト済み)
│   ├── test/          #   node --test ユニットテスト（GPU 不要）
│   └── MODEL-LICENSE.md # ダウンロードされるモデルの PLaMo Community License 通知
├── content.js         # コンテンツスクリプト（DOM 操作）
├── popup/
│   ├── popup.html     # ポップアップ UI
│   ├── popup.css      # スタイル（Everforest Dark テーマ）
│   └── popup.js       # ポップアップのロジック
└── icons/             # 拡張機能アイコン
```

## 開発

拡張機能本体はビルド不要のバニラ JavaScript ですが、`offscreen/` 内の内蔵 WebGPU モジュールは esbuild でビルドされます（依存関係はピン留めされ、バンドルはコミット済みのため、拡張機能はツールなしでそのまま読み込めます）：

```
cd offscreen
npm ci
npm test        # ユニットテスト（PFML3 ビルダー — GPU 不要）
npm run build   # src/ を変更した後に offscreen.bundle.js を再ビルド
```

- 拡張機能本体は純粋なバニラ JavaScript
- ブラウザ上で直接動作します

### デバッグログ

Options（オプション）→ Output Settings で **"Enable debug logging"** を有効にして保存してください。

ログを見るには、`about:debugging#/runtime/this-firefox` を開き、**Local LLM Translator** を見つけ、**Inspect** をクリックします。`[Background]` プレフィックスのメッセージが Console タブに表示されます。

## ライセンス

MIT — [LICENSE](LICENSE) を参照してください。

このプロジェクトは [Eldoprano/offline-browser-translate](https://github.com/Eldoprano/offline-browser-translate) をベースにしています。
