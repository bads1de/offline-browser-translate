# YouTube 字幕翻訳 要件定義書

- 対象: 本リポジトリ (Local LLM Translator / offline-browser-translate v2.0.0)
- 作成日: 2026-11-17
- ステータス: ドラフト (要件定義)
- 配布形態: **個人利用** (ローカルで `chrome://extensions` に読み込む)。ストア公開は考慮しない
- 参考: sakutto (https://github.com/jammaru/sakutto, MIT) の `docs/design/video-subtitles.md`。スコープを YouTube VOD に絞り、常時実行・ストア公開・ライブ対応は除外した形で本フォーク向けに再定義したもの

---

## 1. 目的・背景

英語などの YouTube 動画を、**母語の字幕を見ながらオンデバイスで翻訳**して理解できるようにする。
字幕テキストを外部サービスへ送信せず、既存の翻訳基盤 (Ollama / LMStudio / OpenAI 互換サーバー + PLaMo 3 Translate 等) をそのまま使う。

## 2. スコープ

### 2.1 含む

- YouTube の**通常動画** (`youtube.com/watch`)
- プレイヤー上へのオーバーレイ表示 (置き換え / バイリンガル切替)
- 再生ヘッドより先のプリフェッチ翻訳、シーク追従
- 既存の翻訳パイプライン (`TRANSLATE` メッセージ → `translate()`)・翻訳キャッシュ・用語集の再利用

### 2.2 含まない (Phase 1 では扱わない)

- ライブ配信 (ASR が継続流訂/増殖する問題は別要件)
- 他サイト (X / 一般 HTML5 `<video>`)
- 音声認識 (Whisper 等) による字幕生成 — **字幕が既に存在する動画のみ**
- InnerTube `youtubei/v1/player` への POST (プレイヤー応答はページ内の既存データを読む)
- YouTube 全タブへの常時自動注入 (ポップアップ操作起点で動作させる)
- Chrome Web Store / AMO への公開 (それに伴う権限最小化・ToS 精査・レビュー対応)

## 3. ユーザー像・利用シーン

- 個人のPC: Windows + Chrome/Firefox、ローカルで LLM サーバー (llama.cpp / Ollama / LMStudio) を動かしている
- 英語の技術動画・講演・解説動画を、日本語字幕 (または元字幕併記) で視聴したい
- ネットワークがオフラインでも、字幕が取れる限り翻訳表示が動くことが望ましい

## 4. 機能要件

### FR-1 有効化・無効化

- デフォルト OFF。ポップアップの「YouTube 字幕を翻訳」トグル、または右クリックメニューから ON/OFF できる
- OFF にした時点でオーバーレイを即時撤去し、ネイティブ字幕の非表示 CSS を解除する

### FR-2 字幕トラックの選択

`ytInitialPlayerResponse` (script タグの内容をパースする。隔離ワールドでは `window.ytInitialPlayerResponse` は見えない) の
`captions.playerCaptionsTracklistRenderer.captionTracks[]` から以下を選定する。

1. 話者言語 (`videoDetails.defaultAudioLanguage`) の**手動**トラック
2. 話者言語の **ASR** (`kind="asr"`) トラック
3. 英語 (en) の手動トラック
4. 英語 (en) の ASR トラック

- 翻訳済みトラック (`vssId` が `a.` 以外の先頭が言語でない等) をソースに使わない。先頭候補がターゲット言語そのものなら翻訳はスキップし FR-9 で処理する
- トラックが話者言語ですら無い場合は警告のみ出して何もせず、ネイティブ字幕のままにする

### FR-3 timedtext の取得

- 選定したトラックの `baseUrl` から `fmt` を**置き換えて** `json3` (失敗時は `vtt`) を指定して GET する
  - 追記ではなく置換。`fmt` を二重に書くと `srv3` のまま XML が返る既知の問題を避けるため
- `tlang` パラメータが付いていたら除去する (YouTube 自動翻訳の結果をソースにしない)
- GET は**ページワールド** (`chrome.scripting.executeScript({ world: 'MAIN' })`) で行う。隔離ワールドの fetch は拡張機能のオリジン扱いになり、CORS / `pot=` (proof of origin。2024-08 頃から timedtext に付与され始めた) の要件で弾かれる可能性が高い
- バックグラウンドは「要求 URL がタブのオリジンと一致する」ことだけ検証し、それ以外を拒否する
- `yt-navigate-finish` イベントおよび `popstate` でトラック一覧を再読込する (SPA 遷移対応)
- 取得が空 (HTTP 200 だが body なし) の場合は最大 3 回まで指数バックオフで再試行する。それでも空なら:
  1. `fmt=vtt` で取り直す
  2. それでも空なら VOD は「字幕なし扱い」= オーバーレイ非表示・ネイティブ字幕を表示 (DOM フォールバックは Phase 2)

### FR-4 キューの文連結

- json3 の `events[]` (`tStartMs`, `dDurationMs`, `segs[].utf8`) をキューに変換する
- 途中の改行 (`\n`) は空白に正規化、繰り返しの overlapping segment (ASR で同じ文が伸びて出てくる) は同一行を上書きで畳む
- 文末句読点 (`.`, `!`, `?`, `。`, `！`, `？`) まで連結してから翻訳する。上限は概ね 200 文字 / 10 秒 span
- 日本語 ASR (空白・句読点ほぼ無し) は連結上限に頼り、文境界なしでもキャップで区切る
- 文連結したキューの `tStartMs`/`endMs` が取れないものは捨てる

### FR-5 翻訳

- 翻訳は既存の `TRANSLATE` メッセージ (`background.js` → `translate()`) をそのまま呼ぶ。新しい LLM クライアントは作らない
- `sourceLanguage` はトラックの `languageCode` (ASR `a.ja` 等は `ja` に正規化)、`targetLanguage` はページ翻訳と同じ設定値を共有する
- 1 セッション 1 文が 1 リクエスト。文連結済みなのでバッチは原則使わない
- 短縮 UI は不要 (キューは画面に出すだけ)。温度などパラメータは既存設定に従う

### FR-6 プリフェッチ・シーク追従

- 再生ヘッド (`video.currentTime`) より **GPU/ディスクリート環境 ≒ 30 秒、低速 CPU は ≒ 8 秒**先まで翻訳してキャッシュに投入する。`playbackRate` に比例してウィンドウを伸ばす
- 同一文の再翻訳を防ぐため `videoId + trackId + text` をキーにした**セッション内メモ**を持つ。既存の翻訳キャッシュ (`cache.js`) にも乗る
- `seeked` / `ratechange` / `yt-navigate-finish` では in-flight を abort し、新しい再生位置のウィンドウで再プリフェッチする
- 8 秒以内のキューは優先度を上げる (将来、バッチ側に優先度がある場合に備える)
- キューが翻訳できなかった場合も再生は続行する (FR-10)

### FR-7 オーバーレイ表示

- プレイヤー (`#movie_player` または video の親) に **closed shadow root** の `div` を重ねる
- 行の配置は画面下部中央、字幕互換の位置。文字色/背景はネイティブ字幕に近い黒背景白文字
- ネイティブ字幕 (`.ytp-caption-window-container`) は**視覚のみ非表示**にし、DOM からは消さない (プレイヤーが描き続けても害はない)
- プレイヤーのリサイズ・フルスクリーンでも位置が崩れない (`position: absolute; inset: auto 0 10% 0` 等)
- オーバーレイ自身は `pointer-events: none`

### FR-8 表示モード

- ポップアップで **「置き換え」/「バイリンガル」** を切替えられる
  - 置き換え: 翻訳文のみを表示
  - バイリンガル: 上段=原文、下段=翻訳 (フォントサイズ 80%/100%)
- 初期値は「置き換え」。設定は `storage` に保存する (`youtubeCaptionMode: 'replace' | 'bilingual'`)
- 同じ画面で「有効/無効」を一緒に切り替えられる

### FR-9 同言語パススルー

- 選定したトラックが既にターゲット言語なら翻訳せず、原文テキストをそのままオーバーレイに出す (ネイティブの使用言語設定があることの確認にもなる)

### FR-10 翻訳失敗時

- 翻訳に失敗した文は**原文を表示**する。空白のままにしない
- 繰り返し失敗するエンドポイントを検出したら一定時間バックオフし、バナー風の 1 行ステータス ("翻訳に失敗しました。ローカル LLM を確認してください") を表示する
- ネイティブ字幕を再表示はしない (画面が二重にならないようにするため)

### FR-11 SPA 遷移

- `yt-navigate-finish` でトラック一覧の再パース → オーバーレイの全キューリセット → 新しい動画のプリフェッチを開始する
- 再利用される video 要素を前提に、プレイヤー特定処理をやり直す

### FR-12 設定 UI

- ポップアップ: YouTube 字幕翻訳 ON/OFF・表示モード (置き換え/バイリンガル)
- Options (将来): プリフェッチ秒数・ホールド秒数 (初期値は固定で出し、要望が出たら露出)

### FR-13 ソース/ターゲット言語

- ソース: トラックの `languageCode` (明示。'auto' は送らない)
- ターゲット: 既存ページ翻訳の `targetLanguage` と同一設定を使う
- 出力長の上限 (`maxTokens`) は既存設定を流用。字幕は原文が短いので通常問題にならない

## 5. 非機能要件

### NFR-1 プライバシー

- 字幕テキストは**ローカル LLM 宛のみ**に送信する。到達先は `localhost` / 設定済みエンドポイント以外不可
- timedtext の GET はページ内のユーザー操作に基づくものだけ。バックグラウンドからのバッチ取得・書き出しはしない
- ログは `localStorage.lctCaptionDebug = '1'` を立てた時だけ出す (既定で出さない)

### NFR-2 性能

- 先頭の目安: 0.8B 級モデルで 1 文 (12–25 出力トークン) が cu(2–4 s)以内に返ること。低速機はプリフェッチで吸収
- 翻訳結果は `cache.js` を通じて再利用 (同一文の再表示を高速化)

### NFR-3 信頼性と YouTube 仕様への耐性

- YouTube は `pot=`・JSON 形・DOM クラス名を予告なく変える。**src を正規表現で拾わず JSON.parse / DOM API に限定する**
- ネットワーク・パース例外は全て捕捉して再生を継続させる (再生器を壊さない)
- **テストはローカル fixture のみ** (live youtube.com で CI しない)。sakutto の `e2e/fixtures/youtube-*.html / youtube-timedtext-*.json` (MIT) を流用または同等の fixture を自作する

### NFR-4 権限

- 新規の**必須**権限は追加しない (既存: `activeTab` / `scripting` / `storage` / `contextMenus` + `localhost` と任意の `<all_urls>`)
- timedtext GET は `scripting.executeScript({ world: 'MAIN' })` でページとして実行し、拡張機能のホスト権限を増やさない
- 常時 ON にしたくなった場合のみ、後日 `optional_host_permissions` に `https://www.youtube.com/*` を足す (本 Phase ではやらない)

### NFR-5 ライセンス・ToS

- 個人利用前提。PLaMo 3 Translate (PLaMo Community License) は個人・学術利用は登録不要。商用配布や法人利用は別途 PFN の登録/ライセンスが必要 (要確認)
- YouTube 利用規約: ユーザーが開いたページのプレイヤーが既に指している字幕 URL を、ユーザー操作起点で読むだけ。InnerTube のスクレイピング・一括ダウンロードはしない (本要件でも禁止)

### NFR-6 コードスタイル

- 既存どおりの**バニラ JS (ビルド工程なし)**。依存追加なし
- sakutto のコードは**設計の参考に留める**。丸写ししない (MIT だが、文脈が WXT/Svelte 前提のため)

## 6. 影響範囲・設計ポイント

| ファイル | 変更概要 |
| --- | --- |
| `content.js` | YouTube watch 判定、オーバーレイ生成/更新、`seeked`/`ratechange` 監視、SPA 対応 |
| `background.js` | 新メッセージ `FETCH_TIMEDTEXT` (URL のオリジン検証のみ) と `CAPTION_*` 系。翻訳は既存 `TRANSLATE` を再利用 |
| `manifest.json` | 権限変更なし (Phase 1)。MAIN world の executeScript は `scripting` + `activeTab` で可 |
| `popup/popup.html|js|css` | YouTube 字幕 ON/OFF・表示モードの追加 |
| `cache.js` | 変更なし (キュー文字列でそのままキーになる) |
| `docs/` | 本要件定義 + 後日 `youtube-captions-design.md` |

設計で特に注意する点:

- **隔離ワールドの制約**: `ytInitialPlayerResponse` は script タグ innerText から取る。セレクタ依存を最小化
- **timedtext と `pot=`**: `baseUrl` を player が既に使っているものをそのまま使う。新しい URL を組み立てない
- **オーバーレイの位置**: ネイティブ字幕の実効位置に合わせ、`fullscreen` 中も追従させる

## 7. 受け入れ基準

1. 英語の VOD を開きポップアップで ON にすると、**初回キューは 2 秒以内** (キャッシュ無し・GPU/ローカル LLM 起動済み) に日本語で表示される
2. 再生速度 2x でも字幕が追従する (ウィンドウ自動拡大)
3. シークした場合、新しい位置の字幕が表示される (古い字幕が残らない)
4. 表示モードをバイリンガルに切替えて即時反映される
5. ローカル LLM を停止した状態で ON にしても動画が壊れず、原文が表示される
6. YouTube 以外のサイトでは UI・通信が一切変わらない
7. オフラインでも timedtext が取得できる限り動作する (LLM が localhost にあれば)
8. fixture ベースのテストで、timedtext 空/JSON 破損/トラック無し の各ケースがクラッシュせずフォールバックする

## 8. リスクと対策

| リスク | 影響 | 対策 |
| --- | --- | --- |
| timedtext が空 (`pot=` 欠如・変更) | 字幕が出ない | リトライ+`fmt=vtt` フォールバック、最終的にネイティブ表示へ退避 |
| ASR キューの分断・重複 | 字幕がちらつく | 同一行上書き畳み込み + 文連結 + 最大 span キャップ |
| LLM の応答が遅い/失敗 | 字幕おくれ・空白 | プリフェッチ + 原文フォールバック + 失敗バックオフ |
| YouTube DOM/JSON の仕様変更 | 機能全滅 | DOM クラスへの依存を最小化、JSON.parse のみ、fixture テスト |
| 動画が長く翻訳量が膨大 | 時間・電気代 | プリフェッチは再生ヘッド基準、デデュープ、キャッシュ再利用 |
| ターゲットが既に元言語と同じ | 無駄な翻訳 | パススルー (FR-9) |
| プライバシー誤解 (外部送信と混同) | 信頼毀損 | README に「字幕もローカルのみ送信」と明記 |

## 9. フェーズ計画

- **Phase 0 — スパイク**: 手元の任意の英語 VOD 1 本で、script タグ解析 → timedtext json3 取得 → console 出力までを確認
- **Phase 1 — MVP (実装済み)**: FR-1〜FR-5, FR-7 (置き換え), FR-10。手動テスト可能な状態。加えて FR-8 バイリンガルも実装済み
- **Phase 2 — 表示と UX**: FR-11 の拡充 (失敗時ネイティブ退避など), fixture テスト
- **Phase 3 — 最適化**: FR-6 の計測・調整 (プリフェッチ・シークは実装済み、実機計測が未了), 長尺動画での計測
- **Phase 4 (将来)**: ライブ対応、DOM `.ytp-caption-segment` フォールバック、表示秒数のオプション露出

## 10. 未決定事項 (要確認)

1. **モデル選定**: README 推奨の `pfnet/plamo-3-translate-0.8b-GGUF` でよいか。実機速度を Phase 3 の計測で確定したい
2. **バイリンガルの初期値**: 置き換え初期値で問題ないか (FR-8 実装済み。初期値は replace)
3. **常時 ON**: youtube.com を開いたとき自動で翻訳を有効化したいか (その場合 optional host permission が必要)
4. **ソース言語の既定**: 英語固定でよいか、プレイヤーの `defaultAudioLanguage` に従うか (要件は FR-2/FR-13 の通り選定)
5. **字幕をダウンロード可能にするか**: Phase 1 では非対応 (UX の話であり ToS 上も望ましくない)
