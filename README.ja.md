<h1 align="center">
  <img src="assets/logo.png" width="48" valign="middle"> Local LLM Translator
</h1>

**🌐 [English README](README.md)**

プライバシー重視のブラウザ拡張機能で、ローカル LLM を使ってウェブページを翻訳します。Ollama / LMStudio、または llama.cpp の `llama-server` などの OpenAI 互換サーバー経由で利用できます。**あなたのデータがマシンの外に出ることはありません。**

[![Get the Add-on](https://extensionworkshop.com/assets/img/documentation/publish/get-the-addon-178x60px.dad84b42.png)](https://addons.mozilla.org/en-GB/firefox/addon/local-llm-translator/)

## 機能

- 🔒 **100% プライベート** — すべての翻訳はローカルマシン上で行われます。Ollama / LMStudio / llama.cpp 経由
- 🦙 **自分でモデルを動かす** — ローカル LLM サーバーを一度インストールして翻訳モデルを読み込めば使えます。llama.cpp の `llama-server`、Ollama、LMStudio のいずれでも動作します
- 🎯 **スマートな優先順位付け** — 表示中のコンテンツや見出しを優先して翻訳します
- 🌍 **多言語対応** — たくさんの言語に対応 :3
- ⚡ **翻訳キャッシュ** — 任意機能：同じテキストを一度だけ翻訳して再利用します（フォーラムなどに便利）。デフォルトはオフ。ローカルに保存され、セッションのみ／永続のモードを選べます
- 📖 **用語集（Glossary）** — ユーザーが用意した辞書で、固有名詞や UI ラベルの訳を統一します
- 🚀 **自動翻訳** — 任意機能：外国語のページを読み込んだ瞬間に自動翻訳します。言語ごと・サイトごとの除外設定が可能です

## 必要要件

以下をローカルで動かしてください：

- **[Ollama](https://ollama.ai/)**（デフォルト: `http://localhost:11434`）
- **[LMStudio](https://lmstudio.ai/)**（デフォルト: `http://localhost:1234`）
- **その他の OpenAI 互換サーバー** — [llama.cpp](https://github.com/ggml-org/llama.cpp) の `llama-server`、[vLLM](https://github.com/vllm-project/vllm) など。サーバーのベース URL（例: `http://localhost:8080`）を **LMStudio / OpenAI-compatible URL** フィールドに入力してください。末尾の `/v1` は許容され、自動的に取り除かれます。いちばん手軽な選択肢は [Llama Windows (llama.app)](https://llama.app/) です — **LMStudio / OpenAI-compatible URL** フィールドに `http://127.0.0.1:9931`（デフォルトポート）を入力してください

翻訳に対応したモデル（例: `pfnet/plamo-3-translate-0.8b-GGUF`（llama.cpp）、`TranslateGemma`、`tencent.hunyuan-mt`、`qwen3` など）を読み込んだ上で、Provider は **Auto-detect（自動検出）** を選択すれば、上記2つのエンドポイントのどちらかが動いていれば自動で使われます

## インストール

### Firefox / Mullvad Browser

1. `about:debugging#/runtime/this-firefox` を開きます
2. **一時的なアドオンを読み込む（Load Temporary Add-on）** をクリックします
3. `manifest.json` ファイルを選択します

AMO（Firefox Add-ons）に提出する場合は、拡張機能フォルダをそのまま zip にして `manifest.json` を同梱してください（Firefox 向けの gecko 設定を含む状態のまま出荷します）。Chrome 専用の API は使っていないため、同じパッケージが Chrome / Edge と Firefox の両方で読み込めます。

### Chrome / Chromium
1. `chrome://extensions` を開きます
2. **デベロッパーモード** を有効にします
3. **パッケージ化されていない拡張機能を読み込む（Load unpacked）** をクリックします
4. 拡張機能のフォルダを選択します

> **ビルドは不要です。** 拡張機能は純粋なバニラ JavaScript で提供されています。Node.js・npm・バンドラー・Docker は不要です。

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

## キーボードショートカット

| 操作 | ショートカット |
|------|----------------|
| ページを翻訳する／原文に戻す | `Alt+A` |
| 訳文と原文を切り替える | `Alt+B` |
| 選択範囲を翻訳する | `Alt+S` |
| フォーカス中の入力欄の文章を翻訳する（入力欄翻訳） | `Alt+T` |

- **Alt+B は切り替え先があるときだけ効きます。** まだ翻訳しておらずキャッシュも無い場合は、何も起きない代わりに翻訳を開始します。
- **Alt+T は設定の「入力欄翻訳」を有効にし、あらかじめ入力欄にフォーカスしておく必要があります。** 空・長すぎる・機密扱いの欄・未対応エディタの場合はトーストで理由を表示します。
- **キーの変更:** Chrome / Edge は `chrome://extensions/shortcuts`、Firefox は `about:addons` → 拡張機能 → **拡張機能のショートカットを管理** から変更できます。Firefox ではブラウザ側のショートカットと衝突すると既定値が未割り当てのままになることがあるため、その場合は手動で割り当ててください。
- ポップアップと右クリックメニューからも同じ操作ができます。

## プライバシー

この拡張機能はプライバシーを重視して設計されています：

- ✅ `localhost` にのみ接続します。外部ネットワークへのリクエストは一切発生しません
- ✅ アナリティクスやトラッキングなし
- ✅ データ収集なし
- ✅ 必要最小限の権限：既定では `localhost` へのアクセスのみ。自動翻訳や入力欄翻訳などのページ全体を使う機能を有効にした場合だけ、全サイトへのアクセスを任意で要求します
- ✅ 翻訳キャッシュは**デフォルトでオフ**です。有効にしても**ローカルに**保存され（メモリ上、または永続モードの場合は IndexedDB）、マシンの外に出ることはありません。ブラウザ終了時にクリアする設定、オフにする設定、いつでも手動でクリアすることも可能です

## 設定

ポップアップのヘッダーにある歯車アイコンからフルの **Settings** ページを開いて設定します：

| 設定 | 説明 |
|---------|-------------|
| Provider | 自動検出、Ollama のみ、または LMStudio / OpenAI 互換のみ |
| URLs | Ollama / LMStudio のカスタムエンドポイント |
| Max tokens/items per batch | バッチサイズの制御 |
| Temperature | モデルの創造性（低いほど一貫性が高くなります） |
| Request Format（*作業中*） | デフォルト JSON、Hunyuan-MT、Simple、または Custom |
| Show Glow | 翻訳済みテキストの視覚インジケーターの切り替え |
| Cache translations | 同一テキストの翻訳結果を再利用 — *オフ*（デフォルト）、*ブラウザ終了まで*、または*セッションをまたいで*。「Clear cache」ボタン付き |
| Automatically translate pages | 外国語ページを読み込み時に翻訳。言語とサイトの除外リスト付き — デフォルト*オフ* |
| Compose translation | 入力欄で訳文をプレビューし、その場で差し替え — デフォルト*オフ* |

## 自動翻訳

デフォルトでは、何も翻訳されません。**Options（オプション）→ Auto-Translate → Automatically translate pages** を有効にすると、ページの読み込み時に、ターゲット言語以外の言語が宣言されているページが即座に翻訳されます。

- **言語未宣言のページはスキップされます。** 言語はページの `lang` 属性（または `content-language` メタタグ）から読み取ります。何も宣言していないページは推測せずスキップします。誤った推測は、自分で読めるページを悪化させるために実際の推論リソースを浪費するからです。
- **トップレベルのページのみ。** iframe はスキップされるため、広告や埋め込みウィジェットによってリクエスト数が増えることはありません。
- **実行中の緊急停止手段。** 画面の隅に小さなバーが表示され、**Stop**（停止して元のテキストに戻す）と **Never on this site**（同じ処理に加えて、そのサイトを除外リストに追加する）が使えます。
- **除外設定。** すでに読める言語のリストと、除外したいサイトのリストを管理できます。サイトのエントリはサブドメインをカバーするため、`example.com` を指定すると `news.example.com` も除外されます。

全ウェブサイトへの実行権限が必要です。拡張機能は、ユーザーが何かを要求する前にページへ存在している必要があるためです。なお、この機能を有効にすると、開くすべてのページであなた自身のハードウェア上で翻訳処理が実行されることに留意してください。

## 入力欄翻訳（Compose Translation）

**Options → Compose Translation** を有効にし、原文言語と翻訳先言語を選びます。入力欄にフォーカスすると、右上端に小さな翻訳アイコンが表示されます。

1. 下書きを入力してアイコンをクリックします
2. プレビューで訳文を確認し、**Replace** を選ぶとその場で下書きを差し替えます
3. そのまま編集を続けるか、undo ボタンで差し替え前の下書きに戻せます

- **手動操作のみ。** 下書きは翻訳ボタンを押したときだけローカル LLM に送信され、入力中に自動送信されることはありません
- **対象。** textarea とプレーンテキストの `contenteditable` 欄に対応します。リッチテキスト欄は上書きせず、訳文のコピーに退避します
- **制限。** 3,000 Unicode code point を超える下書きは分割せず拒否します。undo は 1 段階のみで、差し替え後にさらに編集すると使えません
- **安全性。** パスワード、OTP、決済情報などの機密欄と思われるフィールド、非表示・無効・読み取り専用の欄は除外します
- **キャッシュ。** 既存の翻訳キャッシュ設定が適用され、永続キャッシュが有効な場合は訳文がローカルの IndexedDB に保存され得ます

完全な仕様は [docs/compose-translation-requirements.md](docs/compose-translation-requirements.md) を参照してください。

## 翻訳キャッシュ

同じテキストを何度も翻訳し直さないように（フォーラムの定型文、メニュー、ユーザー名、繰り返しのフレーズなど）、翻訳結果をローカルにキャッシュして再利用できます。同じページ内でも、他のページでも使えます。**デフォルトはオフ**です。Options から有効にできます。

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

セグメント全体のマッチは翻訳キャッシュより優先されます。また、用語集を読み込んだりクリアしたりするとキャッシュが消去されます（同じソーステキストが異なる訳になりうるため）。固定プロンプト形式のモデル（TranslateGemma、Hunyuan-MT）ではセグメント全体の処理のみ適用されます。指示ブロックをプロンプトに注入すると出力が壊れるためです。

## YouTube 字幕翻訳（実験的・Phase 1）

英語などの YouTube 動画を、日本語字幕で見られます。字幕テキストはローカル LLM にだけ送信され、外部サービスには送られません。

- **対象**: 通常動画の `watch` ページのみ。ライブ配信・他サイトは未対応
- **使い方**: 動画ページで拡張機能のポップアップを開き、「YouTube の字幕を翻訳」をオンにする
- **表示**: ポップアップの「原文と訳を併記する（バイリンガル）」で、原文＋訳の併記／訳のみを切り替えられます
- **仕組み**: プレイヤーが使う字幕トラック（`/api/timedtext`）を `json3` で取得し、文単位に連結して既存の翻訳パイプラインで翻訳、プレイヤー上にオーバーレイ表示します。ネイティブ字幕は視覚的に隠します（DOM には残します）
- **注意**: 初回は字幕取得と翻訳に数秒かかります。字幕が存在する動画でのみ動作します

仕様と制限は [docs/youtube-captions-requirements.md](docs/youtube-captions-requirements.md) を参照してください。

## PDF 翻訳

論文や技術資料の PDF を、開いたままオンデバイスで翻訳して読めます。PDF のテキストはローカル LLM にだけ送信され、外部サービスには送られません。

- **対象**: ローカル PDF（ビューアのファイル選択 / ドラッグ&ドロップ）と、`.pdf` で終わるタブ URL（arXiv の `/pdf/<id>` リンク含む）。拡張子なしでも `application/pdf` を返す URL は HEAD プローブで判定（FR-12）。スキャン PDF の OCR は Phase 3 以降
- **使い方**: PDF タブでポップアップを開き、「この PDF を翻訳」を押すとビューアが新しいタブで開き、翻訳を開始します。file URL アクセス未許可なら、ビューアのドロップゾーンから開いてください
- **表示**: 各ページを白い紙として描画。**訳文**（初期値）は原文の各段落位置に日本語を重ね、原文そのままの見た目で日本語化。**原文**は元 PDF のみ。**対訳**はページ下に対訳テキストを追加。ズームとダークモードあり
- **仕組み**: Mozilla pdf.js（Apache-2.0、`vendor/pdfjs/` に同梱）でページを描画しテキストを抽出。段落を復元（行連結・ハイフン結合・2カラム判定）してから既存の TRANSLATE パイプラインで翻訳するため、キャッシュや用語集もそのまま効きます
- **書き出し**: 「訳 PDF を保存」で各ページに訳文を重ねた PDF をダウンロード。画像ベース（ページ毎 JPEG）のため出力テキストは選択不可。長い訳文は元の文字ボックスに収まるよう自動縮小
- **注意**: CJK フォント埋め込みによる選択可能テキスト出力は今後の拡張候補

仕様とフェーズ計画は [docs/pdf-translation-requirements.md](docs/pdf-translation-requirements.md) を参照してください。

## ファイル構成

```
├── manifest.json      # 拡張機能マニフェスト (MV3)
├── background.js      # バックグラウンドのエントリポイント（background/* を読み込む）
├── background/        # バックグラウンドのモジュール群
│   ├── core.js        # ブラウザ API、デバッグ・perf ヘルパー
│   ├── providers.js   # プロバイダ検出・モデル一覧
│   ├── settings-store.js # 設定キャッシュ
│   ├── glossary.js    # 用語集マッチングとプロンプトヒント
│   ├── prompt.js      # プロンプトテンプレートと応答パース
│   ├── translate.js   # 翻訳パイプライン・バッチ・キャッシュ
│   ├── content-injection.js # コンテンツスクリプト登録・各エントリポイント
│   ├── captions-bridge.js # YouTube 字幕ブリッジ
│   ├── pdf-bridge.js  # PDF の probe/fetch
│   ├── messages.js    # メッセージルーター
│   └── lifecycle.js   # インストール・コンテキストメニュー・ショートカット
├── content/           # コンテンツスクリプトの断片（この順で読み込み）
│   ├── core.js        # 起動処理・compose 配線・設定リスナー
│   ├── dom.js         # テキスト抽出・文分割・差し替え
│   ├── widget.js      # 進捗ピル・トースト・ページ言語判定
│   ├── page.js        # ページ/選択範囲の翻訳・自動翻訳
│   ├── messages.js    # メッセージルーター
│   ├── selection.js   # 選択時のフローティングボタン
│   ├── captions.js    # YouTube 字幕ブリッジ
│   └── startup.js     # 初回の設定取得と設定変更リスナー
├── compose/           # 入力欄でのその場翻訳
│   ├── policy.js      # 対象判定と下書きの上限
│   ├── session.js     # プレビュー・差し替え・undo・古い結果の破棄
│   ├── textarea.js    # textarea の読み書きと復元
│   ├── contenteditable.js # プレーンテキスト contenteditable アダプター
│   ├── ui.js          # トリガー・プレビュー・操作 UI
│   └── controller.js  # フォーカス・IME・翻訳・ライフサイクル制御
├── captions/          # YouTube 字幕翻訳
│   ├── parser.js      # 字幕の解析・文単位への連結
│   ├── fetcher.js     # 字幕の取得（プレイヤー経由 / 直接）
│   └── session.js     # 再生同期・翻訳キュー・オーバーレイ
├── pdf/               # PDF 翻訳ビューア
│   ├── viewer.html    # ビューア画面（ドロップゾーン、ツールバー、進捗）
│   ├── viewer.js      # pdf.js 配線、翻訳キュー、モード切替
│   ├── layout.js      # CJK ラップ + ボックス収めフォントサイズ
│   ├── pdf-write.js   # 依存なし JPEG 埋め込み PDF ライタ
│   ├── viewer.css     # ビューアのスタイル
│   ├── paragraphs.js  # テキストアイテム → 読み順段落復元
│   └── pdf-store.js   # PDF バイト列の IndexedDB 受け渡し
├── vendor/pdfjs/      # Mozilla pdf.js prebuilt（Apache-2.0、NOTICE 参照）
├── popup/
│   ├── popup.html     # ポップアップ UI
│   ├── popup.css      # スタイル（Everforest Dark テーマ）
│   └── popup.js       # ポップアップのロジック
└── icons/             # 拡張機能アイコン
```

字幕まわりを触ったら、次の自己テストで解析ロジックを検証できます。

```
node tests/caption-selftest.mjs    # 解析・連結・キュー検索
node tests/caption-wiring-test.mjs # 取得経路のフォールバック
node tests/caption-capture-test.mjs # ページ側フックの設置と解放
node tests/caption-session-test.mjs # enable の世代管理・読み込み中キャンセル・旧 drain 停止
```

PDF の段落復元には次の 8 つのテストがあります。

```
node tests/pdf-paragraphs-test.mjs # 行復元・ハイフン結合・2カラム・品質判定
node tests/pdf-extract-test.mjs    # 同梱 pdf.js 実データ → 段落復元（フィクスチャ PDF）
node tests/pdf-wiring-test.mjs     # FETCH_PDF 配線（修飾された isPdfUrl・%PDF ガード）
node tests/pdf-bbox-test.mjs       # 段落バウンディングボックス
node tests/pdf-layout-test.mjs     # ラップ + ボックス収めサイズ
node tests/pdf-write-test.mjs      # PDF ライタ構造
node tests/pdf-head-test.mjs       # FR-12 content-type + 配線
node tests/pdf-head-functional-test.mjs # FR-12 HEAD プローブ（ローカルサーバ）
```

入力欄翻訳には、policy・session・アダプター・UI・controller の統合・スクリプト配線を検証するブラウザ不要テストがあります。

```
for test in tests/compose-*.mjs; do node "$test" || exit 1; done
node tests/settings-keys-test.mjs # settings-defaults.js のキーと各スクリプトの参照
```

## 開発

拡張機能は純粋なバニラ JavaScript です。ビルドは不要です：

- Node.js・npm・バンドラー・Docker は不要です
- ブラウザ上で直接動作します

### デバッグログ

Options（オプション）→ Output Settings で **"Enable debug logging"** を有効にして保存してください。

ログを見るには、`about:debugging#/runtime/this-firefox` を開き、**Local LLM Translator** を見つけ、**Inspect** をクリックします。`[Background]` プレフィックスのメッセージが Console タブに表示されます。

## ライセンス

MIT — [LICENSE](LICENSE) を参照してください。

このプロジェクトは [Eldoprano/offline-browser-translate](https://github.com/Eldoprano/offline-browser-translate) をベースにしています。
