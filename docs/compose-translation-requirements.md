# 入力欄翻訳（Compose Translation）要件定義書

- 対象: 本リポジトリ (Local LLM Translator / offline-browser-translate v2.0.0)
- 作成日: 2026-11-24
- ステータス: **実装済み（Phase 1 / Phase 2）**
- 配布形態: **個人利用**（ローカルで `chrome://extensions` / `about:debugging` に読み込む）。ストア公開は考慮しない
- 参考: [sakkuto](https://github.com/jammaru/sakutto)（MIT）の入力欄翻訳の発想。**設計のみを参考にし、コード・文案は流用しない**

---

## 1. 目的・背景

X、Reddit、ブログのコメント欄など、**サイト上の入力欄で書いている途中の文章を、その場でローカル LLM にかけて翻訳し、下書きを差し替えられる**ようにする。

典型的な利用場面は、日本語で返信を書き、英語の翻訳をプレビューしてから入力欄へ反映し、そのまま修正して投稿する流れである。既存の「ページ翻訳」「選択範囲翻訳」「専用 Translator ページ」とは異なり、**サイトから離れず、サイト自身の入力欄・編集状態を維持する**ことが目的である。

- 翻訳には既存の `TRANSLATE` メッセージ → `translate()` パイプラインを使う
- 送信先は既存のローカル LLM エンドポイントのみ
- 入力中に自動翻訳はせず、**ユーザーが翻訳ボタンを押したときだけ**下書きを送信する
- 新規の必須権限・新規 LLM クライアント・ビルド工程は追加しない

## 2. スコープ

### 2.1 含む

- `<textarea>` 内の下書き翻訳（Phase 1）
- プレビュー → 入力欄へ置換 → 元に戻す（Phase 1）
- 翻訳後もそのまま入力・編集を継続できること
- 単一の `contenteditable` 入力欄（X / Reddit 等の返信欄を想定、Phase 2）
- 英語への翻訳を既定とし、翻訳先・翻訳元は設定で変更可能
- React 等の controlled input に対する入力イベント通知
- IME（日本語入力） composing 中の誤翻訳・誤置換防止
- 進行中リクエストの世代管理、古い結果の破棄、キャンセル
- パスワード・OTP 等の機密性が高い欄除外
- 既存の翻訳キャッシュ・用語集・プロバイダー設定の再利用

### 2.2 含まない

- タイピング中の自動翻訳（Phase 3 で検討）
- `<input>` 全般（検索欄・メールアドレス・パスワード等は当面非対応）
- パスワード、OTP、hidden、disabled、readonly の欄
- クロスオリジンの iframe 内
- closed shadow root 内の入力欄
- リッチテキストの書式・埋め込みオブジェクトを完全維持した置換
- 複数段落・長文の自動分割翻訳
- 翻訳結果の外部送信、クラウド翻訳、テレメトリ
- サイト固有の DOM セレクターに依存する専用実装
- Chrome Web Store / AMO 向けの権限最適化・公開作業

## 3. ユーザー像・利用シーン

- 日本語で X / Reddit の返信を作成し、自然な英語に直して投稿したい
- 外国語で下書きを書き、日本語に変換して内容を確認したい
- 翻訳結果をそのまま使わず、少し修正してから投稿したい
- 差し替えた後で「やはり元の日本語に戻したい」ことがある
- LLM は localhost で稼働しており、下書きを外部サービスへ送りたくない

## 4. 機能要件

### FR-1 有効化と権限

- 入力欄翻訳は **既定 OFF**。Options の「入力欄翻訳」から明示的に有効化する
- 有効化時は既存の optional `<all_urls>` を要求し、許可された場合だけ http(s) ページへ content script を常設登録する
- 権限を拒否された場合は設定を有効化せず、理由を表示する
- 新規の必須権限は追加しない
- 無効化時は入力欄ボタン・プレビューを直ちに撤去し、進行中リクエストの結果を無効化する
- `<all_urls>` は floating button / auto-translate / 入力欄翻訳が**すべて OFF のときだけ**返却する
- 有効化は登録済みの新規・再読み込みページに適用する。既存タブへの一括注入は Phase 1 では行わず、必要なら再読み込みを案内する

### FR-2 対象入力欄の判定

Phase 1 の対象は document 配下の `<textarea>` のみとする。以下の欄は除外する。

- `disabled` / `readonly` / `hidden` / 非表示・ゼロサイズ
- `type="password"` 相当の要素、`autocomplete="one-time-code"`、`autocomplete="current-password"`、`autocomplete="new-password"`
- 名前・住所・電話番号・カード番号等の機密入力と判断できる `autocomplete` / `aria-label`
- `translate="no"`、`data-llm-translator-ignore`、拡張機能自身の UI
- 文字が 1 文字もない、空白のみ、数字・記号のみ
- Unicode code point で **3,000 文字を超える**下書き（自動分割しない）

判定はサイト固有のクラス名ではなく、要素の種類・属性・表示状態で行う。

### FR-3 トリガー UI

- 対象欄にフォーカスし、翻訳可能な文字列があるとき、欄の右上に小さなアイコンボタンを表示する。空の欄でも追跡を続け、最初の入力で表示する
- ボタンはアイコンのみ（26px 四方）とし、`あA` のような文字ラベルは使わない
- ボタンのツールチップには翻訳先言語名（既定は英語）を表示する
- ボタンは拡張機能所有の host + closed shadow root に描画し、ページの CSS に影響されない
- ボタン操作で入力欄からフォーカスを奪わない
- 翻訳中はボタンを無効化し、置換後はアイコンを undo 用の矢印に切り替える
- トリガーの再描画は、開いているプレビューやエラー表示を閉じない
- Escape でプレビューを閉じ、進行中結果を無効化できる

### FR-4 翻訳の開始

- ボタンをクリックした時点の下書き・翻訳元・翻訳先をスナップショットとして固定する
- 既存の `TRANSLATE` を 1 アイテムで呼び出す
- `silentPartials: true` を指定し、ページ翻訳用の `PARTIAL_TRANSLATION` を流さない
- `sourceLanguage` は入力欄翻訳用設定（既定 `auto`）、`targetLanguage` は入力欄翻訳用設定（既定 `en`）を使う
- 翻訳元と翻訳先が同じ言語の場合は翻訳せず、設定変更を案内する
- タイピング・フォーカス移動だけでは翻訳を開始しない

### FR-5 プレビュー

- 翻訳が完了するまで入力欄の内容は変更しない
- 完了後、欄の近くに訳文プレビューを表示する
- プレビューには翻訳先言語、訳文、「置き換え」「閉じる」を表示する
- 訳文は `textContent` 等で描画し、モデル出力を HTML として解釈しない
- 原文は入力欄に残したままなので、プレビューと原文を見比べられる
- コピー操作が可能でもよいが、Phase 1 では必須ではない

### FR-6 入力欄への置換

- 「置き換え」を押したとき、翻訳開始時の下書きと現在の下書きが一致することを再検証する
- 一致しない場合は置換せず、「下書きが変更されました」と表示する
- `<textarea>` はネイティブの value setter を使い、`input` / `change` を bubbles 付きで発火する。単なる `.value` 代入だけでは React 等の状態更新を期待しない
- 置換後も欄は editable のまま維持し、そのまま追記・修正できる
- カーソルは訳文末尾へ移動し、欄のスクロール位置は可能な限り維持する
- サイトが入力イベントを処理して値を戻した場合は、置換失敗として原文を保持し、ページを壊さない

### FR-7 元に戻す

- Phase 1 では欄ごとに **1 段階**の undo を提供する
- undo 用スナップショットには元の文字列・選択範囲・スクロール位置を保存する
- 明示的な「元に戻す」ボタンは、置換後にユーザーがさらに編集していない場合だけ有効
- 編集後の undo は、ユーザーの新しい文章を無断で上書きしないため無効化し、理由を表示する
- undo の判定は末尾空白を無視する。エディタが置換後に足す空ブロックを「編集」と誤認して undo を失わないため
- 置換後のトリガーは undo アイコンに切り替わり、クリックで undo を実行する。ラベルと実際の動作を一致させる
- 原生の Ctrl/Cmd+Z は Phase 1 では横取りしない。サイトネイティブの undo が効く場合はそれに委ね、拡張の undo ボタンを確実な復元手段とする

### FR-8 編集・キャンセル・古い結果の破棄

- 欄ごとにセッション ID と世代番号を持ち、input / composition / target language 変更 / 欄の接続解除で世代を進める
- 翻訳中に入力された場合、直前のリクエスト結果は破棄する
- プレビュー表示中に入力された場合、プレビューを閉じて idle に戻す
- 欄外クリック・Escape・機能無効化・ページ離脱では進行中結果を無効化する
- Phase 1 では background の provider リクエスト自体の abort は必須としない。**古い結果を適用しないこと**を保証する
- 複数欄を同時に翻訳してもよいが、1 つの欄につき in-flight は 1 件までとする

### FR-9 IME 対応

- `compositionstart` から `compositionend` まではトリガーを無効化する
- composing 中は翻訳を開始せず、既存リクエストの世代を進めて結果を破棄する
- `compositionend` 後に初めてトリガーを再評価する
- Enter / Space で IME 候補を確定する操作を、拡張機能のショートカットとして横取りしない

### FR-10 失敗時

- LLM 停止・接続失敗・タイムアウト・空レスポンス・不正レスポンスでは、原文を変更しない
- 「翻訳できませんでした。ローカル LLM を確認してください」を 1 行で表示する
- リトライはユーザー操作に限定する
- 例外が発生しても入力欄・ページの既存機能を壊さない

### FR-11 設定

`settings-defaults.js` の `DEFAULT_SETTINGS` に以下を追加する。既定値はこのファイルにのみ定義する。

- `composeTranslationEnabled: false`
- `composeSourceLanguage: 'auto'`
- `composeTargetLanguage: 'en'`

Options に以下を表示する。

- 入力欄翻訳の ON/OFF
- 翻訳元・翻訳先言語
- 「ボタンを押したときだけ下書きを送信する」説明
- キャッシュが有効な場合、下書き訳文も既存キャッシュ設定に従ってローカル保存されうる説明
- 対応範囲（Phase 1 は textarea、Phase 2 で contenteditable）の表示

### FR-12 contenteditable（Phase 2）

- document 配下の単一 `contenteditable="true"` 欄を対象にする
- X / Reddit 等のプレーンテキストに近い返信欄を優先する
- 改行を保持し、テキストノードだけで置換する
- `beforeinput` / `input` を発火し、サイトの編集状態を更新する
- リッチテキストで書式・埋め込み要素の維持が難しい場合は、書式解除を明示するか置換を無効化する
- controlled contenteditable の更新に失敗した場合は原文を保持し、翻訳結果のコピーに退避する
- closed shadow root・クロスオリジン iframe は Phase 2 でも非対応
- フレームワーク製エディタ（Lexical / Draft.js / ProseMirror）では、DOM の直接書き換えではなく、`beforeinput`（`deleteContentBackward` → `insertText`）か合成 `paste` でエディタ自身に編集を処理させる。エディタがモデルを反映するまで結果を読まない
- エディタがキャレットを内部モデルで管理するため、拡張機能側の Range 選択だけでは置換位置を制御できない。選択を DOM に入れた後、モデルへ同期する猶予を置いてから編集イベントを送る
- `execCommand()` は使わない。フレームワークエディタでは DOM だけを書き換え、モデルの選択・本文を残したままになるため、画面上の文字と Backspace / 入力の対象がずれる
- 置換後のカーソルは、エディタが末尾ブロックを追加した後に配置する

## 5. 非機能要件

### NFR-1 プライバシー

- 下書きを送信するのは既存のローカル LLM エンドポイントだけである
- タイピング中の自動送信、外部翻訳 API、アナリティクス、テレメトリは行わない
- デバッグモードでも下書き本文・訳文をログに出さない。記録するのは文字数・世代・エラー種別などに限定する
- 既存の `cacheMode` を尊重する。既定は `off`、永続キャッシュ有効時は IndexedDB に残りうることを UI で明記する
- 用語集もページ翻訳と同様に既存設定に従う

### NFR-2 性能

- 対象判定は focus / input 時に限定し、ページ全体を常時走査しない
- 1 欄 1 リクエストとし、入力中の連続翻訳を発生させない
- 3,000 文字超は送信前に拒否し、不要な推論を防ぐ
- UI スレッドをブロックしない。翻訳待ちの間も入力・スクロールは継続する

### NFR-3 信頼性

- 入力欄が DOM から削除された場合、結果を適用せず安全に終了する
- stale レスポンス、二重クリック、機能 OFF、ページ遷移、LLM 停止で UI が壊れない
- Chrome / Firefox の双方で動くよう、既存の `browserAPI` abstraction を使う
- content script の二重注入は既存の `hasLLMTranslatorContentScript` ガードを壊さない

### NFR-4 権限

- 新規の必須権限は追加しない
- 既存 optional `<all_urls>` を floating button / auto-translate と共有する
- content script 登録条件と permission remove 条件は、両方に `composeTranslationEnabled` を含める
- ブラウザ内部ページ・拡張機能ページでは動作しない

### NFR-5 セキュリティ

- 訳文を HTML として挿入しない
- 入力欄へ差し替えるのはテキストのみとし、スクリプト・属性・URL を生成しない
- 拡張機能 UI は closed shadow root と固有 prefix で隔離する
- 機密欄はローカル判定で除外し、下書きを background へ送らない

### NFR-6 コードスタイル

- 既存どおりバニラ JS、ビルド工程なし、依存追加なし
- `compose/` 配下に責務ごとの小さなモジュールを追加し、`content.js` は配線に徹する
- 入出力境界（DOM・runtime メッセージ）だけを検証し、内部状態は信頼する
- テストは Node の VM / fake DOM によるブラウザフリーユニットテストを基本とする

## 6. 影響範囲・設計ポイント

| ファイル | 変更概要 |
| --- | --- |
| `compose/policy.js` | 対象欄判定・機密欄除外・文字数判定（新規） |
| `compose/session.js` | idle / loading / preview / replaced / error の状態遷移、世代管理、stale 破棄（新規） |
| `compose/textarea.js` | textarea の読み書き、native setter、input/change、選択・スクロール復元（新規、Phase 1） |
| `compose/contenteditable.js` | contenteditable の読み書きと入力イベント（新規、Phase 2） |
| `compose/ui.js` | トリガー・プレビュー・undo の closed shadow root UI（新規） |
| `compose/controller.js` | focus/input/composition イベントと `TRANSLATE` 呼び出しの配線（新規） |
| `content.js` | compose controller の初期化・無効化・page translation との分離 |
| `background.js` | `needsContentScript()` に compose 設定を追加。翻訳処理自体は変更しない |
| `settings-defaults.js` | compose 用設定の既定値を追加 |
| `options/options.html\|js\|css` | 有効化・言語設定・権限要求・説明表示 |
| `_locales/` | 英語・日本語 UI 文言 |
| `manifest.json` | 変更なし（既存 optional `<all_urls>` を使用） |
| `tests/compose-*.mjs` | policy / session / textarea / contenteditable / wiring テスト（新規） |
| `tests/settings-keys-test.mjs` | 新規設定キーの検証を追加 |
| `README.md\|README.ja.md` | 機能・使い方・制限の追記 |
| `docs/` | 本書 |

設計で特に注意する点:

- **ページ翻訳の `translationInProgress` とは独立した compose セッションを持つ**。選択翻訳・ページ翻訳と競合させない
- `content.js` の既存 `SKIP_TAGS` はページ抽出用。compose 側で対象を別途判定する
- `TRANSLATE` は `silentPartials: true` で呼び、相関 ID は compose session が保持する
- React controlled textarea は native setter + 入力イベントが必須。代入後に値を読み戻して検証する
- contenteditable は Phase 2 で別アダプターに分離し、textarea 実装へ DOM 固有処理を混ぜない
- content script の登録・権限返却は floating button / auto-translate との union で管理する

## 7. 受け入れ基準

### Phase 1（textarea）

1. 既定では入力欄ボタンが出ず、新規の必須権限も発生しない
2. Options で有効化し `<all_urls>` を許可すると、対応 textarea に `あA` ボタンが出る
3. 日本語の下書きをボタンで翻訳すると、英語のプレビューが出るまで原文は変わらない
4. 「置き換え」後、textarea の値が更新され、React 等の controlled input も `input` イベントを受け取る
5. 置換後にそのまま追記できる
6. 置換後に編集していなければ「元に戻す」で原文・選択範囲・スクロール位置が復元される
7. 翻訳中に入力すると、古い翻訳結果は適用されない
8. IME  composing 中は翻訳が始まらず、確定後は通常どおり翻訳できる
9. password / OTP / readonly / disabled / 非表示欄にはボタンが出ず、下書きも送信されない
10. 3,000 文字超の下書きは送信前に拒否される
11. LLM を停止しても原文・入力機能は維持され、エラーが 1 行表示される
12. Escape・欄外クリック・機能 OFF でプレビューと進行中結果が無効化される
13. 機能を無効化しても、floating button / auto-translate が ON なら `<all_urls>` は返却されない
14. `node tests/compose-*.mjs` と `node tests/settings-keys-test.mjs` がパスする

### Phase 2（contenteditable）

15. X / Reddit 等の単一 contenteditable 返信欄でプレビュー・置換・undo ができる
16. 改行が保持され、訳文が HTML として解釈されない
17. リッチテキストで安全に置換できない場合、原文を壊さずコピー可能な結果に退避する
18. closed shadow root・クロスオリジン iframe では誤動作せず、非対応であることが分かる

## 8. リスクと対策

| リスク | 影響 | 対策 |
| --- | --- | --- |
| React / framework が programmatic 変更を反映しない | 見た目だけ変わり投稿されない | native setter + input/change + 値の読み戻し検証。失敗時は原文保持 |
| contenteditable が複雑な editor 状態を持つ | 書式破損・サイト側 state 不整合 | Phase 2 はプレーンテキスト優先。失敗時はコピーへ退避 |
| IME 確定前に翻訳・置換する | 日本語入力の破損 | compositionstart/end を最優先で監視し、composing 中は無効化 |
| 入力と古いレスポンスが競合 | 別の下書きで上書き | 欄ごとの世代番号と snapshot 一致検証 |
| native undo と拡張 undo が干渉 | 意図しない復元 | Phase 1 は Ctrl/Cmd+Z を横取りせず、明示ボタンと編集後無効化で安全に戻す |
| 下書きに機密情報が含まれる | 意図しない LLM 送信・キャッシュ | 手動送信、機密欄除外、ログ本文禁止、cacheMode 既定 off |
| 全ページへの常設登録 | 不要な permission / 実行コスト | 既定 OFF、optional permission、focus 時だけ判定 |
| ページ CSP / CSS | UI が表示されない・崩れる | closed shadow root、inline style 依存を最小化、textContent 描画 |
| X / Reddit の DOM 変更 | 特定サイトだけで壊れる | site-specific selector を使わず generic editable 判定 |
| 長文翻訳の待ち時間・出力切れ | ユーザー離脱・不完全な訳 | 3,000 文字上限、自動分割なし、失敗時は原文保持 |

## 9. フェーズ計画

- **Phase 0 — スパイク**: textarea の native setter + input/change が React controlled input を更新できることを最小 DOM で確認
- **Phase 1A — プレビュー**: 対象判定、設定・権限、トリガー UI、`TRANSLATE` 呼び出し、プレビュー、stale 破棄
- **Phase 1B — 置換・undo**: textarea 置換、入力イベント、選択・スクロール復元、1 段階 undo
- **Phase 2 — contenteditable**: X / Reddit 等のプレーンテキスト欄対応、失敗時のコピー退避
- **Phase 3 — 任意拡張**: 入力停止後の自動プレビュー、ショートカット、複数 undo、open shadow root、サイト別許可、長文分割

各フェーズは小さく分割し、変更ごとにブラウザフリーテストを追加する。

## 10. 実装決定

1. **トリガーの配置**: 入力欄の右上に固定表示
2. **翻訳元言語の既定**: `auto`
3. **3,000 文字上限**: Unicode code point で固定
4. **contenteditable の書式**: 書式・埋め込みを検出した場合は置換せず、訳文コピーへ退避
5. **自動プレビュー**: 採用せず、手動操作のみ

## 11. 実装上の結論

- 入力欄翻訳は「入力欄の value を直接書き換えるだけ」では終わらない。**サイトの編集状態へ入力イベントを通知し、stale な結果を適用しないこと**が中核である
- X / Reddit 対応は contenteditable アダプターを分離した Phase 2 で完成させる。Phase 1 は textarea で状態機械・undo・IME・権限を固める
- 背景側の翻訳経路は追加せず、既存 `TRANSLATE` + `silentPartials: true` を再利用する
- 新規必須権限・外部送信・自動送信は行わない

## 12. 実装メモ

- `compose/controller.js` が設定・フォーカス・IME・ stale レスポンス・undo を統括し、`content.js` は初期化と設定変更・pagehide の配線のみを担当する
- textarea はネイティブ value setter と bubbling `input` / `change` で React controlled input へ通知する
- contenteditable は書き込み経路を順に試す: ①エディタが `beforeinput` を cancel する場合はそれに委譲（`deleteContentBackward` → `insertText`）、②合成 `paste` を cancel した場合はそれに委譲（Draft.js はこちらでないと選択が反映されない）、③テキストノードと `<br>` の直接置換。①と②はエディタがモデルを flush した後に読み戻して検証する
- 選択は DOM の Range で全選択した後、2フレーム待ってから編集イベントを送る。エディタは `selectionchange` 経由で選択をモデルへ取り込むため、直後に送ると古いキャレット位置に挿入される
- 置換の適用中は `input` を抑止し、適用中にユーザーが入力した場合は世代番号で検出して結果を破棄する（`applying` 中の二重実行も拒否）
- `execCommand()` は使用しない。フレームワークエディタの DOM だけを書き換え、モデルと画面がずれる原因になる
- 文字列比較は末尾空白を無視する。エディタは末尾に空ブロックや `<br>` を足すため、厳密比較では成功を失敗と誤判定し、undo まで失われる
- 置換後にエディタが発火する `input`（末尾ブロック追加など）は本文が `replacedText` と同一なら編集とみなさず、`replaced` 状態と undo スナップショットを維持する
- トリガーは置換後に undo アイコンへ切り替わり、クリックで undo を実行する（翻訳のやり直しではない）
- contenteditable の安全な置換対象はテキスト、`<br>`、装飾のない `div` / `p` / `span`。スタイル属性、書式タグ、埋め込み要素、`contenteditable="false"` はコピー退避の対象
- サイトが同期的に入力を拒否して原文へ戻した場合は原文を復元し、訳文コピーを表示する
- 翻訳結果・原文はデバッグログへ出力しない
- ブラウザ検証（2026-11-24）で textarea の React-like tracker 更新、contenteditable の改行・選択位置復元、`beforeinput` / `input` の発火、サイト側同期拒否時の原文復元とコピー退避を確認済み
- ブラウザ検証（2026-11-24、追加）で Lexical 0.24 / Draft.js 0.11.7 上での置換・複数行・undo 往復・置換直後の Backspace / 追記を確認済み。Lexical はプログラム的 Range 選択を無視してキャレット位置へ挿入するため `beforeinput` 委譲が必須、Draft.js は `beforeinput` をすべて cancel したうえ操作用に `paste` を必要とする

## 13. 検証コマンド

```bash
for test in tests/compose-*.mjs; do node "$test" || exit 1; done
node tests/settings-keys-test.mjs
```
