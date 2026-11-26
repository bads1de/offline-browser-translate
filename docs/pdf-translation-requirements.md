# PDF 翻訳 要件定義書

- 対象: 本リポジトリ (Local LLM Translator / offline-browser-translate v2.0.0)
- 作成日: 2026-11-18
- ステータス: **Phase 1 + 訳文オーバーレイ / 訳 PDF 書き出し / FR-12 実装済み (2026-11-19)** — FR-1〜FR-7 / FR-10 / FR-11 / FR-12 (拡張子なし PDF の HEAD 判定) に加え、原文レイアウトへの訳文オーバーレイと画像ベース PDF 書き出し。OCR 等 Phase 3 以降は未着手
- 配布形態: **個人利用** (ローカルで `chrome://extensions` に読み込む)。ストア公開は考慮しない
- 参考: OnlyTranslate（只译, GPL-3.0, 読み流し + 原文併置 + オプショナル版面モデル）、Translate It!（Apache-2.0, PDF Translator: 双語ビュー・OCR・export）、FluentRead（GPL-3.0, 文書翻訳 + TXT/MD/HTML export）、PDFMathTranslate / BabelDOC（AGPL-3.0, レイアウト保持再組版 — **設計の参照のみ、コードは一切流用しない**）、Mozilla pdf.js（Apache-2.0, ビューアの土台）、本リポジトリの `docs/youtube-captions-requirements.md`（同種の要件定義の書式）

---

## 1. 目的・背景

ブラウザの組み込み PDF ビューアで読める論文・技術資料・ドキュメントを、**開いたままオンデバイスで翻訳**して母語で読めるようにする。

字幕テキストと同様に、PDF の文を外部サービスへ送信せず、既存の翻訳基盤 (Ollama / LMStudio / OpenAI 互換サーバー + PLaMo 3 Translate 等) をそのまま使う。

**ブラウザの組み込み PDF ビューアは拡張機能から DOM を触れない**（Chrome は `chrome-extension://` ページ、Firefox は `resource://pdf.js/web/viewer.html`）。したがって実装は「拡張機能ページに自前のビューアを持ち、そこで翻訳して表示する」一択であり、「ビューア内に翻訳ボタンを差す」方式は取れない。

## 2. スコープ

### 2.1 含む

- PDF ファイル（ローカル / URL 直リンク）を拡張機能ページの自前ビューアで開き、翻訳しながら読む
- 表示モード切替: ① 訳文のみ ② 双語（原文の下に訳文）③ 原文ページ併置（左=原文ページ canvas、右=訳文テキスト。図表・数式対応用）
- ポップアップの「この PDF を翻訳」ボタン（PDF タブのときだけ表示）から起動
- ローカル PDF は file input / ドラッグ&ドロップでも開ける（file URL アクセス許可なしでも可）
- 既存の翻訳パイプライン・翻訳キャッシュ・用語集・targetLanguage 設定の再利用
- 段落翻訳（原文の段落単位）。ページ単位の進捗表示・中断

### 2.2 含まない (Phase 以外)

- **レイアウト保持の日本語 PDF への再組版**（PDFMathTranslate / BabelDOC 級。Python + PyMuPDF + AGPL-3.0 が前提。本拡張のスコープ外。必要な人はそちらを使う）
- スキャン PDF の OCR（Phase 3 以降で検討、Tesseract.js Apache-2.0 をオプショナル導入）
- DRM / パスワード付き PDF
- 組み込みビューアへのボタン注入（不可能）
- Chrome Web Store / AMO への公開
- EPUB / DOCX など他形式（将来別要件）

## 3. ユーザー像・利用シーン

- 個人の PC: Windows + Chrome/Firefox、ローカルで LLM サーバー (llama.cpp / Ollama / LMStudio) を動かしている
- arXiv 等の英語論文・技術 PDF を、**元ページを行き来しながら**日本語で読みたい（図表・数式がある）
- PDF をダウンロードして手元に置く派: ダウンロード済み PDF を file input / D&D で開いて読む
- ネットワークがオフラインでも、PDF がローカルにあれば翻訳表示が動くことが望ましい

## 4. 機能要件

### FR-1 ポップアップの「この PDF を翻訳」ボタン

- アクティブタブの URL が拡張子 `.pdf`（クエリ・フラグメント付きを含む）に一致するときだけ、ポップアップにボタンを表示する（それ以外のタブでは非表示）
- オンライン PDF はこれだけでは網羅できない（拡張子なし・`application/pdf` を返す URL）。Phase 2 で HEAD リクエスト検証を足す（FR-12）
- クリック時: バックグラウンドが activeTab 権限（アイコン押下で一時的に有効化される現タブの origin 権限）を使い、**クリックの時点で** PDF bytes を取得して IndexedDB に退避する
  - 理由: activeTab の一時権限はタブ依存ではなく origin 単位だが、実装を「開いた時点で確保」に寄せておくことで、後続のタブ遷移や表示遅延に依存しない
  - ペイウォール・認証付き PDF もユーザーのセッションの Cookie で取れる（`credentials: 'include'`）
- 取得に失敗したら（403 等）ポップアップにエラーを表示する（ビューアは開かない）
- 無事なら新しいタブで `pdf/viewer.html` を開く
- 拡張子あり PDF でも「ファイル選択 / D&D」のローカル入口は常に併設する（FR-4）

### FR-2 自前ビューアページ (`pdf/viewer.html|js|css`)

- 拡張機能ページ。pdf.js（Mozilla 公式 prebuilt、Apache-2.0）を `vendor/pdfjs/` にローカル同梱し、`<script type="module">` で読む（ビルド工程なし）
- `web_accessible_resources` は Phase 1 では**不要**（拡張機能ページを `tabs.create` で開くだけ。Phase 3 の DNR リダイレクトで初めて必要になる）
- レンダリング: 各ページを canvas に描画。テキストは `page.getTextContent()` で抽出
- ページ一覧（サムネイルは Phase 2）・スクロール表示・拡大縮小・ダーク/ライトテーマ
- バイト列の受け渡し: 背景が取得した PDF を IndexedDB に保存 → ビューアが読み出す（`chrome.storage.session` の容量制限回避のため。Phase 2 でファイル D&D も同じ経路で扱う）

### FR-3 テキスト抽出と段落復元

- `getTextContent()` の各アイテム（`str`, `transform` の Y 座標・X 座標・幅）から行を組み立てる
- 行の Y 座標でクラスタリング → 上から順に段落化。段落内は行を連結し、ハイフン改行（`word-\nword`）を結合する
- 2段組みの検出: ページ幅の中央付近に X 方向の空白帯があり、テキストが左右に分かれている場合は左カラム→右カラムの順に読む（簡易ヒューリスティック。誤判定時は従来順で処理）
- フォントサイズが極端に小さい行（脚注）は段落を分けずに連結して誤並びを防ぐ
- 抽出不可（文字化け率が高い、CID フォント破損等）と判断したページは「テキスト抽出の品質が低い可能性があります」と表示して原文セクションを優先表示する（得られたテキストだけでも訳文を出す）
- 画像化 PDF（スキャン）は Phase 3 の OCR まで非対応

### FR-4 ローカル PDF の入口（file input / D&D）

- ビューアページにファイル選択とドラッグ&ドロップの入口を常設する
- `file://` タブの PDF は、拡張への「ファイルの URL へのアクセス」を許可していればポップアップのボタンからも開ける（Phase 2 で誘導 UI を足す）。未許可でも file input 経由なら開け、機能は変わらない旨を表示する

### FR-5 翻訳

- 翻訳は既存の `TRANSLATE` メッセージ (`background/translate.js` → `translate()`) をそのままバッチで呼ぶ。新しい LLM クライアントは作らない
- 1 段落 = 1 アイテムとして既存のバッチ機構（`maxConcurrentRequests` / `maxTokens` / 既存設定）に乗せる。文連結のような特別な前処理は行わない
- `sourceLanguage` は Phase 1 では既存設定値を流用し、Phase 2 で PDF のメタデータ・フォント情報からの自動推定を検討する
- `targetLanguage` はページ翻訳と同じ設定値を共有する
- 既存の翻訳キャッシュ (`cache.js`) にそのまま乗せる（再度開いたときの再翻訳を防ぐ）
- 用語集 (glossary) もページ翻訳と同様に効く
- 表示前の訳を画面に出さない（バックグラウンド完了後に段落を差し替える。中途半端な表示はしない）

### FR-6 進捗・中断 UI

- ページ下部に進捗バー（翻訳済み段落数 / 全体）とキャンセルボタンを表示する
- キャンセル時は in-flight を捨て、原文表示のまま停止する（UI が壊れない）
- 翻訳失敗した段落は**原文を表示**する（空白にしない）
- 失敗が連続したら1行ステータス（"翻訳に失敗しました。ローカル LLM を確認してください"）を表示する（YouTube 字幕 FR-10 と同方針）

### FR-7 表示モード

ポップアップではなくビューア内で即時切替する（storage キー `pdfViewMode: 'replace' | 'bilingual' | 'side-by-side'` に保存）。初期値は **双語**とし、用途に応じて切り替える。

1. **訳文のみ**: 原文非表示、訳文を段落で表示
2. **双語**: 原文段落の直下に訳文段落（YouTube 字幕の `youtubeCaptionMode` とは別の storage キー `pdfViewMode` に保存する）
3. **原文併置**: 左に原文ページ（pdf.js canvas）、右に訳文テキスト。図表・数式を原位置で参照したい論文向け

### FR-8 翻訳キャッシュ共有

- TRANSLATE パイプライン経由のため自動的に cache.js を再利用する。追加実装は不要
- 段落テキストが同一なら別 PDF 間でも原則キャッシュが効く（有益なので仕様として許容）

### FR-9 ビューア内テキスト操作

- 訳文・原文とも選択・コピー可能（読み流しの当然要件）
- ビューア内の検索は Ctrl/Cmd+F でブラウザの検索は効かないので、Phase 2 で簡易検索を検討（Phase 1 ではスコープ外）

### FR-10 オフライン動作

- ローカル PDF はオフラインで開ける（pdf.js 同梱のため）
- LLM が localhost にあればオフラインでも翻訳が動く

### FR-11 ポップアップの ON/OFF 非依存

- PDF ビューアはページ翻訳の ON/OFF とは独立して動く（有効/無効のグローバルスイッチを設けない）

### FR-12 拡張子なし PDF の検出 (実装済み)

- ポップアップの「この PDF を翻訳」をクリックした時点でバックグラウンドが対象 URL に HEAD を投げ、`Content-Type: application/pdf` なら翻訳フローへ進む
- `.pdf` 拡張子がなくても動くようにするための経路であり、常時監視はしない（DNR による自動検知は Phase 3 の opt-in で検討、FR-13）
- HEAD に失敗した場合はエラーを表示
- **実装 (2026-11-19)**: `PROBE_PDF` メッセージ (HEAD) を追加。ポップアップは拡張子なし http(s) タブで URL 毎に1回 HEAD プローブし、`application/pdf` ならボタンを表示 (`pdfProbeCache`)。`FETCH_PDF` も拡張子なし URL は HEAD で再検証してから GET + %PDF マジック検査。`isPdfContentType` は parameters 付き・大文字小文字を許容。octet-stream 配信の拡張子なし URL は content-type 判定では拾わない (`.pdf` 拡張子ならマジック検査で取得可)

### FR-13 組み込みビューアの自動リダイレクト (Phase 3、opt-in)

- `declarativeNetRequest` で `Content-Type: application/pdf` の main_frame を `pdf/viewer.html` にリダイレクトする（Chrome 128+ の responseHeaders 条件が必要）
- Firefox は `declarativeNetRequest` または `webRequest`（blocking）で同等実装
- `web_accessible_resources` にビューアを追加する必要がある
- **このリダイレクトはユーザーの明示 opt-in（Options のチェックボックス）が必要**。既定 OFF。理由: PDF ダウンロード意図のユーザーを横取りする問題、サーバへの初回リクエストは避けられない、権限警告が増える
- 有効時も「元の組み込みビューアで開く」リンクをビューア内に必ず表示する

### FR-14 保存 / エクスポート (Phase 2)

- 「このページの翻訳を保存」: 訳文 HTML をダウンロード（印刷メニューから "PDF として保存" すれば PDF 化も可能。要するにブラウザの印刷機能に委ねる）
- 「原文+訳文を TXT 保存」
- **レイアウト保持の翻訳済み .pdf を生成する機能は永久にスコープ外**（FR 冒頭スコープ参照）

## 5. 非機能要件

### NFR-1 プライバシー

- PDF の文は**ローカル LLM 宛のみ**に送信する
- IndexedDB に保存するのはバイト列と翻訳キャッシュ（cache.js 経由）のみ。外部送信なし
- ログは `localStorage.lctPdfDebug = '1'` を立てた時だけ出す（既定で出さない）

### NFR-2 性能

- 目安: 20ページ論文 (約 6,000 〜 12,000 出力トークン) を 0.8B モデルで翻訳する場合、GPU 環境で 3〜10 分程度
- 表示はページ順に段落単位で逐次差し込む（先頭ページから読み始められること）
- 2回目以降の開きはキャッシュヒットで即座に表示されること（FR-8）

### NFR-3 信頼性

- pdf.js のパース失敗・タイムアウト・巨大 PDF（100MB超）でもビューアが落ちずエラーを表示する
- LLM 停止中は原文のみ表示（UI は動く）
- 例外は全て捕捉し、ビューアは操作可能なままにする

### NFR-4 権限

- Phase 1 では**新規の必須権限は追加しない**（既存の `activeTab` / `scripting` / `storage` / `contextMenus` で足りる）
- Phase 2 も必須権限の追加は不要（HEAD 検証はクリック時の一時権限で行う）
- Phase 3 のリダイレクトだけ `declarativeNetRequest` + `web_accessible_resources` を追加し、Options で明示 opt-in にする

### NFR-5 ライセンス

- 個人利用前提。pdf.js は Apache-2.0 のため同梱可。`THIRD_PARTY_NOTICES`（または `vendor/pdfjs/NOTICE`）に帰属を記載する
- GPL / AGPL 系の実装（OnlyTranslate / FluentRead / PDFMathTranslate 等）のコード・文案は流用しない。設計参照のみ
- Translate It! (Apache-2.0) は設計参照として自由に参照可

### NFR-6 コードスタイル

- 既存どおりの**バニラ JS (ビルド工程なし)**
- pdf.js を同梱することは依存の例外として許容する（ビルドを要さない prebuilt 配布物のため）。以外の新規依存は追加しない

## 6. 影響範囲・設計ポイント

| ファイル | 変更概要 |
| --- | --- |
| `pdf/viewer.html` | ビューアの骨組み: ファイル選択 / D&D 領域、ページ canvas、訳文エリア、進捗バー、モード切替（新規） |
| `pdf/viewer.js` | pdf.js 初期化、段落復元、翻訳バッチ呼び出し、モード描画、キャンセル（新規） |
| `pdf/viewer.css` | ビューアスタイル（新規） |
| `vendor/pdfjs/` | Mozilla pdf.js prebuilt (`pdf.min.mjs`, `pdf.worker.min.mjs`)（新規・git 同梱可、数 MB） |
| `tests/pdf-*.mjs` | 段落復元・2カラム判定のブラウザフリーユニットテスト（新規） |
| `popup/popup.html\|js\|css` | PDF タブ検知で「この PDF を翻訳」ボタンを出す（pdf.js には触れない） |
| `background/pdf-bridge.js` | `FETCH_PDF`（activeTab 権限でバイト取得 → IndexedDB 保存）の新メッセージ。翻訳は既存 `TRANSLATE` を再利用 |
| `manifest.json` | Phase 1〜2: 権限変更なし。Phase 3: `declarativeNetRequest` + `web_accessible_resources` |
| `cache.js` | 変更なし |
| `options/` | Phase 2 で表示モード初期値設定（任意）、Phase 3 でリダイレクト opt-in トグル |
| `docs/` | 本要件定義 |

設計で特に注意する点:

- **activeTab 権限は「アイコンを押した瞬間」が効力の起点**。クリック後に対象タブが遷移・クローズしても bytes は取得済みなので、必ずクリックハンドラ内で fetch して IndexedDB に退避する（遅延 fetch はしない）
- **bytes の受け渡し**: `runtime.sendMessage` のサイズ制限を避けるため IndexedDB 経由。ビューアは `runtime.onMessage` ではなく自ら IndexedDB を読む
- **pdf.js worker**: `workerSrc` はローカルパス（`vendor/pdfjs/pdf.worker.min.mjs`）を指す。CSP `script-src 'self'` で動くことを確認する
- **タブ URL の判定**: `*.pdf`（クエリ付き含む）正規表現 + 失敗時の案内。拡張子なしは Phase 2 の HEAD 検証に委ねる
- **原文 canvas の解像度**: `devicePixelRatio` を考慮して描画する（ぼやけ防止）
- **翻訳中のスクロール**: 訳文の差し替えでレイアウトがジャンプしないよう、段落の `min-height` を抑える

## 7. 受け入れ基準

1. arXiv の PDF 直リンクを開き、ポップアップの「この PDF を翻訳」を押す → ビューアが新しいタブで開き、翻訳が順次表示され始める（GPU 環境で最初の段落が数秒以内）
2. ローカル PDF を file input / D&D で開ける（file URL アクセス許可なしでも）
3. 「訳文のみ / 双語 / 原文併置」の各モードに即時切り替えられる
4. LLM を停止した状態で開いても、原文が段落単位で表示される（翻訳失敗時も UI は操作可能）
5. 非 PDF タブでは「この PDF を翻訳」ボタンが表示されない
6. オフラインでローカル PDF を開いて翻訳できる（LLM が localhost の場合）
7. 同一 PDF を 2 回開いたとき、翻訳キャッシュにより表示が即座に完了する
8. 段落復元（行連結・ハイフン結合・2カラム判定）のユニットテストが `node tests/pdf-*.mjs` でパスする
9. Phase 3 の自動リダイレクトを有効にした場合、その場で組み込みビューアではなく自前ビューアが開き、ビューア内に「組み込みビューアで開く」リンクがある

## 8. リスクと対策

| リスク | 影響 | 対策 |
| --- | --- | --- |
| PDF のテキスト抽出が壊れる（CID フォント・ToUnicode 欠落・異体漢字） | 文字化けした訳文 | 文字化け率を検出してバナー表示 + 原文 canvas 併置モードを案内 |
| 2カラム・脚注の読み順崩壊 | 段落の順序が混ざる | X 中央の空白帯検出で左右分割、誤判定時は従来順にフォールバック |
| 段落内のハイフン改行を結合し損ねる | 単語が途中で切れる | 行末 `-` + 次行小文字始まりを結合ルールに |
| 数式・表が訳文内で壊れる | 可読性低下 | 原文 canvas 併置モードに逃げる。Phase 1 では数式の特別扱いはしない |
| ペイウォール PDF の fetch が 403 | ビューアが開かない | エラーを明示 + 「Ctrl/Cmd+S で保存して file input で開いてください」と案内 |
| 大容量 PDF の IndexedDB 保存失敗 | bytes を受け渡せない | 保存失敗を捕捉してエラー表示（読める PDFだけで動く設計にはしない） |
| pdf.js 自体の脆弱性 | ビューアが処理されるリモート PDF を食い破られる | 最新版を同梱し、ビューアは任意の PDF を可信に扱わない前提で描画のみ（実行は自ファイルのみ） |
| 全文翻訳の待ち時間 | ユーザー離脱 | 段落単位の逐次表示 + 進捗バー + キャンセル。キャッシュ共有で実質コストは1回だけ |
| スキャン PDF | 抽出テキスト 0 | 「OCR は Phase 3 以降」と表示して非対応と明示 |

## 9. フェーズ計画

- **Phase 0 — スパイク**: pdf.js 同梱 → `getTextContent()` → 段落復元 → console 出力までを手元の任意の PDF 1 本で確認
- **Phase 1 — MVP**: FR-1（URL 拡張子検知のみ）、FR-2〜FR-7、FR-10、FR-11。手動テスト可能な状態
- **Phase 2 — 実用化**: FR-12（HEAD 検証）、FR-4 の file URL アクセス誘導、FR-14（保存 / エクスポート）、FR-9（検索）、サムネイル・目次
- **Phase 3 — 統合**: FR-13（DNR 自動リダイレクト、opt-in）、OCR (Tesseract.js)、2カラム・脚注の読み順精度向上
- **Phase 4 (将来)**: EPUB 等の他形式、表構造の認識。**レイアウト保持の再組版は永久にスコープ外**

## 10. 未決定事項 (要確認)

1. **表示モードの初期値**: 双語でよいか、訳文のみ / 原文併置にするか
2. **「原文併置」モードを Phase 1 に含めるか**（論文用途には有用だが、canvas 描画分の実装が増える。Phase 2 送りもあり）
3. **「PDF として保存」機能**: ブラウザの印刷機能経由（実装最小・スコープ内）でよいか、それとも不要か
4. **ソース言語の既定**: 既存設定値でよいか、PDF メタからの自動推定を要るか
5. **本家（Eldoprano/offline-browser-translate）への還元を前提にするか**（その場合、vendoring 対象は Apache-2.0 までに抑える＝現状の方針どおり）
6. **ビューアの URL 設計**: `pdf/viewer.html?src=tab|local&id=<indexeddb-id>` のような識別方式で問題ないか

---

## 11. 設計上の結論と除外事項

- **ブラウザ組み込み PDF ビューアには、翻訳ボタンもオーバーレイも一切挿入できない**。したがって唯一の実装形態は「拡張機能ページの自前ビューア + pdf.js 同梱」である
- **「PDF のページにいってポップアップの翻訳ボタン → 自前ビューアが開いて翻訳済みを表示」が本要件の中核フロー**であり、この方式は組み込みビューアを一切壊さず、権限警告も増やさない（Phase 1〜2 では必須権限追加なし）
- **「組み込みビューアで開いたら自動で翻訳ビューアに飛ぶ」体験 (FR-13)** は技術的に可能だが、横取り被害・権限警告・個人の DL 意図との衝突を避けるため、Phase 3 の明示 opt-in とし、既定では行わない
- **"翻訳済み PDF をダウンロードする" という要望の受け皿は FR-14 (印刷→PDF 保存)**であり、レイアウト完全保持の .pdf 生成は本リポジトリの方針に反する（AGPL 依存 + 別プロセス）

---

## 12. Phase 1 実装メモ (2026-11-19)

未決定事項の確定値と実装の目印:

- **表示モード初期値**: 双語 (FR-7 の既定どおり)。`localStorage.pdfViewMode` に保存
- **原文併置モード**: Phase 1 に含めた (pdf.js でページ canvas は常に描画するため追加コストが小さい)
- **PDF として保存**: Phase 2 (FR-14) に送った
- **ソース言語**: 既存設定値を流用 (Phase 1)
- **還元方針**: Apache-2.0 のみ同梱 (pdf.js 6.5.438)。GPL/AGPL コードは流用せず
- **ビューア URL**: `pdf/viewer.html?id=<IndexedDB レコード id>`。ファイル選択時は `history.replaceState` で同じ形式に正規化
- **タブ判定**: FR-1 の `.pdf` 拡張子判定に加え、受入基準 #1 を満たすため arXiv の `/pdf/<id>` パスも PDF タブ扱いにした
- **翻訳キュー**: 段落を 8 個ずつのチャンクで既存 TRANSLATE を順次呼び出し (ページ順=読み順)。部分表示は出さず `silentPartials: true`
- **失敗時**: 段落は原文のまま表示、2 チャンク連続失敗で 1 行ステータスを表示 (YouTube FR-10 と同方針)
- **テスト**: `node tests/pdf-paragraphs-test.mjs` (45 件) / `node tests/pdf-extract-test.mjs` (11 件、同梱 pdf.js 実データ) / `node tests/pdf-wiring-test.mjs` (15 件、FETCH_PDF 配線)。Node 22 では pdf.js 6.x が使う `Promise.try` / `Uint8Array.prototype.toHex` をテスト側で polyfill している
- **実翻訳の確認**: 実 arXiv PDF (1706.03762, 15 ページ) を同梱 pdf.js で抽出し、拡張の PLaMo リクエスト形式そのまま localhost:9931 の PLaMo 3 Translate 0.8B に投げて日本語訳が出ることを確認済み (Node 経由。初回約 6.7 秒=モデル起動込み、以降 0.16 秒)
- **残課題**: 実拡張機能を Chrome にロードしてのポップアップ→FETCH_PDF→ビューア経路は、検証に使った Chrome ビルドが `--load-extension` を受け付けず未通過。手動確認が必要。D&D も同様

## 13. 訳文オーバーレイ + 訳 PDF 書き出し 実装メモ (2026-11-19)

ユーザー要望「元の PDF に日本語を張り付け」「翻訳した PDF のダウンロード」「ビュアーを原文に近づけて」を受け、ビューアを canvas ファーストへ再設計した。

- **表示モード (FR-7 を更新)**: `pdfViewMode: 'overlay' | 'original' | 'bilingual'`。初期値 **overlay**。旧 replace / side-by-side は overlay / bilingual へ移行
  - overlay: 原文ページを白い紙として描画し、各段落の bbox 位置に訳文ボックスを重ねる (原文テキストは背景色でマスク)。原文そのままの見た目で日本語化
  - original: 原文 PDF のみ
  - bilingual: 原文ページ + 下に対訳テキスト
- **段落 bbox**: `paragraphs.js` が各段落に `{x0,x1,top,bottom}` (PDF 座標) を付与。オーバーレイは % ジオメトリで配置し、フォントは `layout.js` の fitText でボックスに収まるよう自動縮小
  - `layout.js`: CJK 対応ラップ + fit-to-box (純ロジック。measure コールバック注入で Node テスト可能)
- **白背景**: pdf.js canvas は透明なので、オフスクリーン描画 → 白背景へ合成 (背景采样・JPEG 書き出しが正しくなる)
- **書き出し**: `pdf-write.js` (依存なし) がページ毎 JPEG を DCTDecode で埋め込んだ PDF 1.4 を生成。「訳 PDF を保存」でダウンロード。**画像ベースのため出力テキストは選択不可**。長い訳文はボックスに収まるよう縮小 (最小 5px、超過はクリップ)
- **表示バグ修正**: `.pdf-empty` 等の `display:flex` が `hidden` 属性を上書きしていた → `[hidden]{display:none!important}` を追加
- **テスト**: pdf-bbox (9) / pdf-layout (9) / pdf-write (13) を追加。実 99helpers PDF + 実 PLaMo で 58 段落の日本語オーバーレイと 3 ページ書き出し PDF の生成を確認
- **制限**: 書き出しはラスター (選択可能テキスト + CJK フォント埋め込みは今後の拡張)。原文より長い訳文は縮小 / クリップされうる
