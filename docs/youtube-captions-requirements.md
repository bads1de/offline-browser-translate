# YouTube 字幕翻訳 要件定義書

- 対象: 本リポジトリ (Local LLM Translator / offline-browser-translate v2.0.0)
- 作成日: 2026-11-17
- 更新日: 2026-11-18 （実装に合わせて改訂し、Phase 1 完了としてクローズ）
- ステータス: **実装済み (Phase 1 MVP) — 本書は実装のスナップショットとしてクローズ**
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

`ytInitialPlayerResponse` (MAIN world の `player.getPlayerResponse()` を優先し、失敗時は `window.ytInitialPlayerResponse` を直接読む。隔離ワールドのコンテンツスクリプトからは見えないため executeScript 経由で読む) の
`captions.playerCaptionsTracklistRenderer.captionTracks[]` から以下を選定する。

1. 話者言語 (`videoDetails.defaultAudioLanguage`) の**手動**トラック
2. 話者言語の **ASR** (`kind="asr"`) トラック
3. 英語 (en) の手動トラック
4. 英語 (en) の ASR トラック
5. （実装時の追加）上記に無い場合: ターゲット言語以外の先頭トラック → それも無ければ `list[0]`

- 先頭候補がターゲット言語そのものなら翻訳はスキップし FR-9 で処理する
- `vssId` による翻訳済みトラックの除外は未実装（ASR は `kind="asr"` でのみ判別）。誤ったソースを選ぶ懸念があるが、FR-9 のパススルーで吸収できる
- トラック一覧が 0 件 → 「字幕トラックが見つかりません」をトースト表示して何もしない（ネイティブ字幕のまま）

### FR-3 timedtext の取得

- **実装時の方式変更**: bare timedtext の GET は `pot=` (proof of origin。2024-08 頃から付与) なしでは 200・空 body しか返らないことが実機で確認されたため、本線を「**プレイヤーにトラックをロードさせて、その timedtext 応答を横取りする**」方式に変更した (コミット 8c6789f)。直接 GET はフォールバックとする
  1. `CAPTURE_PLAYER_CAPTIONS`: MAIN world の executeScript で fetch/XHR のフックを仕掛け、`player.setOption('captions', 'track', ...)` でトラックをロードさせ、プレイヤー自身が叩く timedtext の body を記録する。フックの後始末 (fetch 差し戻し・フック除去・トラック復元) は `finally` で必ず行う
  2. `FETCH_TIMEDTEXT`: 直接 GET フォールバック。`fmt` を**置き換えて** `json3` → `vtt` → `srv3` の順に試す
  - 追記ではなく置換。`fmt` を二重に書くと `srv3` のまま XML が返る既知の問題を避けるため
- `tlang` パラメータが付いていたら除去する (YouTube 自動翻訳の結果をソースにしない)
- GET / フック仕掛けは**ページワールド** (`chrome.scripting.executeScript({ world: 'MAIN' })`) で行う。隔離ワールドの fetch は拡張機能のオリジン扱いになり、CORS / `pot=` の要件で弾かれるため
- バックグラウンドは要求 URL を `https://*.youtube.com/api/timedtext` の形だけ許可する (ホスト allowlist + パス prefix 検証。要件の「タブのオリジン一致」より厳しい実装)
- `yt-navigate-finish` でトラック一覧を再読込する (SPA 遷移対応)。`popstate` には未対応
- 空 body (HTTP 200 だが body なし) 時の**指数バックオフ再試行は実装していない**。代わりに「プレイヤーキャプチャ → json3/vtt/srv3 の直接 GET」の順次フォールバックで吸収する。それでも取れない場合はオーバーレイを出さず「字幕を取得できませんでした」をトースト表示する (ネイティブ字幕の非表示化は cues 取得成功後にのみ行うため、失敗時はネイティブのまま)

### FR-4 キューの文連結

- json3 の `events[]` (`tStartMs`, `dDurationMs`, `segs[].utf8`) をキューに変換する
- 途中の改行 (`\n`) は空白に正規化、繰り返しの overlapping segment (ASR で同じ文が伸びて出てくる) は同一行を上書きで畳む
- 文末句読点 (`.`, `!`, `?`, `。`, `！`, `？`) まで連結してから翻訳する。上限は概ね 200 文字 / 10 秒 span
- 日本語 ASR (空白・句読点ほぼ無し) は連結上限に頼り、文境界なしでもキャップで区切る
- 文連結したキューの `tStartMs`/`endMs` が取れないものは捨てる

### FR-5 翻訳

- 翻訳は既存の `TRANSLATE` メッセージ (`background/translate.js` → `translate()`) をそのまま呼ぶ。新しい LLM クライアントは作らない
- `sourceLanguage` はトラックの `languageCode` (ASR `a.ja` 等は `ja` に正規化)、`targetLanguage` はページ翻訳と同じ設定値を共有する
- 1 セッション 1 文が 1 リクエスト。文連結済みなのでバッチは原則使わない
- 短縮 UI は不要 (キューは画面に出すだけ)。温度などパラメータは既存設定に従う

### FR-6 プリフェッチ・シーク追従

- 再生ヘッド (`video.currentTime`) より **固定 20 秒**先まで (`PREFETCH_AHEAD_MS = 20000`)、`playbackRate` に比例してウィンドウを伸ばしながら翻訳してキャッシュに投入する
  - GPU/ディスクリート (30s) / 低速 CPU (8s) の出し分けは未実装。20s 一律
- 同一文の再翻訳を防ぐため**セッション内メモ** (`Map`) を持つ。キーは `sourceLanguage|targetLanguage|text` で、**videoId は含まず、動画遷移・teardown でもクリアされない** (同一タブ内では再利用される)。既存の翻訳キャッシュ (`cache.js`) にも乗る (`TRANSLATE` 経由)
- `seeked` では queued 状態のキューを pending に戻して再プリフェッチする。**in-flight の翻訳は abort しない** (再生位置が変わっても同じ文なら有効なため)。`ratechange` リスナーは未実装。`yt-navigate-finish` ではセッションを破棄して再作成する (FR-11)
- 全キュー `priority: 10` 固定。8 秒以内優先度の引き上げは未実装
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
- **テストはブラウザフリーのユニットテスト** (live youtube.com で CI しない)。sakutto fixture の流用はせず、`tests/caption-selftest.mjs` (parser) / `caption-wiring-test.mjs` (fetch 経路) / `caption-capture-test.mjs` (MAIN world フックの arm/wait/release) / `caption-session-test.mjs` (enable の世代管理・読み込み中キャンセル・旧 drain 停止) で代替した

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
| `captions/parser.js` | 言語コード正規化・トラック選定・json3/vtt/srv3 パース・文連結 (新規) |
| `captions/fetcher.js` | プレイヤーキャプチャ本線 → 直接 GET フォールバック (新規) |
| `captions/session.js` | 再生同期・翻訳キュー・シャドウルートのオーバーレイ描画 (新規) |
| `content.js` | `LctBridge` の配線と `TOGGLE_YOUTUBE_CAPTIONS` / `SET_YOUTUBE_CAPTION_MODE` / `GET_YOUTUBE_CAPTION_STATUS`。字幕本体は captions/ へ分離済み (e8340e2) |
| `background/captions-bridge.js` | `GET_PLAYER_CAPTIONS` / `CAPTURE_PLAYER_CAPTIONS` / `FETCH_TIMEDTEXT` を追加 (URL はホスト allowlist + パス検証)。翻訳は既存 `TRANSLATE` を再利用 |
| `manifest.json` | 権限変更なし (Phase 1)。MAIN world の executeScript は `scripting` + `activeTab` で可 |
| `popup/popup.html|js|css` | YouTube 字幕 ON/OFF・表示モード (置き換え/バイリンガル) の追加 |
| `tests/caption-*.mjs` | ブラウザ不要のユニットテスト (selftest / wiring / capture) (新規) |
| `cache.js` | 変更なし (キュー文字列でそのままキーになる) |
| `docs/` | 本要件定義。`youtube-captions-design.md` は**作成せず本書の実装メモで代替**してクローズ |

設計で特に注意する点:

- **隔離ワールドの制約**: `ytInitialPlayerResponse` は MAIN world の `player.getPlayerResponse()` 優先・`window.ytInitialPlayerResponse` フォールバックで読む。script タグの innerText パースは実装していない
- **timedtext と `pot=`**: 本線はプレイヤーの `setOption` に任せ、こちらから URL は組み立てない。直接 GET フォールバック時も `baseUrl` は組み立て直さず `fmt` 置換と `tlang` 除去のみ行う
- **オーバーレイの位置**: ネイティブ字幕の実効位置に合わせ、`fullscreen` 中も追従させる

## 7. 受け入れ基準

検証状況を併記する。ユニットテストは `tests/caption-*.mjs`、実機確認は利用者の環境依存のため未実施のものは「未検証」と明記する。

1. 英語の VOD を開きポップアップで ON にすると、**初回キューは 2 秒以内** (キャッシュ無し・GPU/ローカル LLM 起動済み) に日本語で表示される — **未検証** (実機計測は Phase 3)
2. 再生速度 2x でも字幕が追従する (ウィンドウ自動拡大) — **実装済み・未計測** (`playbackRate` 比例でウィンドウを拡大)
3. シークした場合、新しい位置の字幕が表示される (古い字幕が残らない) — **実装済み** (`seeked` で queued→pending リセット＋再プリフェッチ)
4. 表示モードをバイリンガルに切替えて即時反映される — **実装済み** (`SET_YOUTUBE_CAPTION_MODE` → `paint()` 即時反映)
5. ローカル LLM を停止した状態で ON にしても動画が壊れず、原文が表示される — **実装済み** (3回連続失敗でバックオフ＋失敗文は原文表示)
6. YouTube 以外のサイトでは UI・通信が一切変わらない — **実装済み** (`isWatchPage()` 判定で watch ページ以外は enable を拒否)
7. オフラインでも timedtext が取得できる限り動作する (LLM が localhost にあれば) — **未検証** (プレイヤー経由取得のためネットワーク条件に依存)
8. fixture ベースのテストで、timedtext 空/JSON 破損/トラック無し の各ケースがクラッシュせずフォールバックする — **ブラウザフリーのユニットテストで代替確認済み** (`caption-selftest.mjs`: 空 body / 破損・切断 JSON / トラック無し [pick→null]。37/37 パス)

## 8. リスクと対策

| リスク | 影響 | 対策 |
| --- | --- | --- |
| timedtext が空 (`pot=` 欠如・変更) | 字幕が出ない | プレイヤーキャプチャを本線化して `pot=` 問題を回避。それでも空なら json3→vtt→srv3 の直接 GET を順次試行、最終的にネイティブ表示へ退避 (FR-3) |
| ASR キューの分断・重複 | 字幕がちらつく | 同一行上書き畳み込み + 文連結 + 最大 span キャップ |
| LLM の応答が遅い/失敗 | 字幕おくれ・空白 | プリフェッチ + 原文フォールバック + 失敗バックオフ |
| YouTube DOM/JSON の仕様変更 | 機能全滅 | DOM クラスへの依存を最小化、JSON.parse のみ、ブラウザフリーのユニットテスト |
| 動画が長く翻訳量が膨大 | 時間・電気代 | プリフェッチは再生ヘッド基準、デデュープ、キャッシュ再利用 |
| ターゲットが既に元言語と同じ | 無駄な翻訳 | パススルー (FR-9) |
| プライバシー誤解 (外部送信と混同) | 信頼毀損 | README に「字幕もローカルのみ送信」と明記 |

## 9. フェーズ計画

- **Phase 0 — スパイク**: 実施済み。bare timedtext GET が空 body しか返さないことを実機で確認し、FR-3 の方式変更に繋がった
- **Phase 1 — MVP (実装済み)**: FR-1〜FR-5, FR-7 (置き換え), FR-10。手動テスト可能な状態。加えて FR-8 バイリンガルも実装済み。2026-11 に main へマージ済み (PR #1)
- **Phase 2 — 表示と UX (一部前倒し)**: FR-11 の最小実装 (`yt-navigate-finish` でセッション再作成) は Phase 1 に前倒し実装済み。失敗時のネイティブ字幕退避は「enable 失敗時はネイティブ字幕を隠さない」で代替済み。fixture テストは live youtube.com に接続しない方針を維持したまま、`tests/caption-*.mjs` のブラウザフリーユニットテストで代替
- **Phase 3 — 最適化 (未了)**: プリフェッチ (固定 20s × playbackRate) とシーク追従は実装済み。実機計測・長尺動画での調整・GPU/CPU 出し分けは未計測
- **Phase 4 (将来)**: ライブ対応、DOM `.ytp-caption-segment` フォールバック、表示秒数のオプション露出、`ratechange` 対応、in-flight abort、セッション内メモのビデオ跨ぎ整理、`popstate` 対応、`vssId` フィルタ、8 秒優先度

## 10. 未決定事項 (要確認)

1. **モデル選定**: README 推奨の `pfnet/plamo-3-translate-0.8b-GGUF` でよいか。実機速度を Phase 3 の計測で確定したい — **未決定**
2. **バイリンガルの初期値**: 置き換え初期値で問題ないか (FR-8 実装済み。初期値は replace) — **実装確定**。問題があればポップアップのトグルで即時切替可
3. **常時 ON**: youtube.com を開いたとき自動で翻訳を有効化したいか (その場合 optional host permission が必要) — **未決定** (Phase 1 ではポップアップ/右クリック起点のみ)
4. **ソース言語の既定**: 英語固定でよいか、プレイヤーの `defaultAudioLanguage` に従うか — **実装確定** (FR-2/FR-13 の通り `defaultAudioLanguage` 優先)
5. **字幕をダウンロード可能にするか**: Phase 1 では非対応 (UX の話であり ToS 上も望ましくない) — **非対応のままクローズ**

---

## 11. クローズ時の実装メモ (要件からの意図的な乖離と理由)

1. **timedtext 取得方式の変更 (FR-3)**: bare GET が空 body を返すため、プレイヤーキャプチャ本線 + 直接 GET フォールバック (json3→vtt→srv3) に変更した。トレードオフは「プレイヤーが自発的に timedtext を叩くタイミングに依存する」こと。失敗時はトーストを出し、ネイティブ字幕を壊さない
2. **プリフェッチは固定 20 秒 (FR-6)**: GPU/CPU 出し分けは未実装。低速機で字幕が追従しない場合は Phase 3 で計測のうえ調整する
3. **`ratechange` 未対応 / in-flight abort なし (FR-6)**: `timeupdate` の 250ms ポーリング + `playbackRate` 比例ウィンドウで実用上追従するため現状維持。seek 時は queued→pending リセットのみ行い、in-flight は再生位置が変わっても同じ文なら有効なのでキャンセルしない
4. **セッション内メモのキーに videoId を含まない (FR-6)**: 同一タブ内での文の再翻訳を避けるため現状維持。別動画と同一文を共有する副作用は許容
5. **未実装項目**: `popstate` ハンドラ (FR-3)、vssId による翻訳済みトラック除外 (FR-2)、8 秒優先度 (FR-6) — 需要が出た時点で Phase 4 で再検討
6. **テスト方式 (NFR-3)**: sakutto fixture の流用はせず、`tests/caption-*.mjs` のブラウザフリーユニットテストで代替した。live youtube.com に接続しない方針は要件どおり
7. **設計書 (`youtube-captions-design.md`)**: 別途作成はせず、本書が実装のスナップショットを兼ねる形でクローズした

この文書は 2026-11-18 をもってクローズ。以後の変更は新しい要件・設計として別文書または PR で扱うこと。
