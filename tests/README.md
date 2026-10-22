# ツール改善の回帰テスト

## 変更前に維持する操作

- 表編集：CSV/TSV/Markdown読み込み、セル編集と行列移動、Undo/Redoとコピー。
- CSV Inspector：ファイル/貼り付け/サンプル読込、欠損・重複・型・日付・外れ値の検査、結果コピー。
- 熱膨張：4条件計算、固定金型温度の10点マップ、逆算、条件保存/復元とCSV出力。
- 一覧：検索、カテゴリー、お気に入り、最近使ったツール、テーマとコンパクト表示。

## 再利用した実装

- 表編集のsnapshot/restoreSnapshot・履歴・行列移動・コピー処理をそのまま拡張。
- CSV Inspectorのパーサー・型判定・IQR・結果描画を拡張。文字コード変換は標準TextDecoderを使用。
- 熱膨張のcalculate・保存キー・4条件・数値フォーマットを再利用。旧形式のmapShaft欠落も継続対応。
- 一覧の既存カード・検索・保存処理を維持して変更説明を追加。
- 単体HTMLの独立性を維持するため、アプリ間の共通ライブラリ化はしない。

## 実行

計算・パーサー・入力境界のテスト（Node.js、追加依存なし）:

```bash
node tests/tools-regression.cjs
```

HTTPサーバーを起動し、別途用意したPlaywright/Chromiumでブラウザテスト:

```bash
python3 -m http.server 8000
TEST_BASE_URL=http://127.0.0.1:8000 node tests/tools-regression.cjs --browser
```

Playwrightが通常のrequireで見つからない場合は `TEST_PLAYWRIGHT_MODULE`、ブラウザ実行ファイルを指定する場合は `TEST_BROWSER_PATH` を利用します。スクリーンショットは `TEST_SCREENSHOT_DIR` 指定時のみ保存します。実行環境には日本語フォントが必要です。

ブラウザテストは320/375/768/1280px、GitHub Pages相当のサブパス、編集・Undo・保存復元・JSON入出力・ルール適用・Shift_JIS読込を確認します。Chromiumのエミュレーションであり、iPhone Safari/Android実機の検証ではありません。

## 今回の確認結果（2026-10-03）

- Node.js：計算・パーサー・保存形式・入力境界の10テスト群に合格。熱膨張は独立した小数計算の4ケースと照合。
- Chromium：3アプリと一覧の16画面幅組み合わせ、編集・Undo/Redo・実クリップボード・保存復元・容量不足・検査条件・Shift_JIS・JSON往復・不正JSON・タッチ操作に合格。
- 日本語フォントを使用したスクリーンショットで確認。ページ全体の意図しない横はみ出し、実行時エラーは確認した範囲でなし。
- GitHub Pages相当の `/my-html-tools/` サブパスで検証。
- iPhone Safari / Androidの実機は未確認。投資シミュレーターは説明のみ更新し、計算コードは変更・再検証していない。

## だいたい職人

採点の代表値・境界・ランク判定：`node tests/rough-craftsman.cjs`。
ローカルHTTPサーバーとPlaywrightがある環境では `node tests/rough-craftsman.cjs --browser` で、4画面幅・3種目のタッチ入力・タイマー・結果・保存・再プレイを確認します。`TEST_BASE_URL`、`TEST_PLAYWRIGHT_MODULE`、`TEST_BROWSER_PATH`、`TEST_SCREENSHOT_DIR` に対応します。

## S電鉄 スマホ表示・速度推移

ローカルHTTPサーバーとPlaywrightを用意し `node tests/sakamoto-railway.cjs`。`TEST_BASE_URL`、`TEST_PLAYWRIGHT_MODULE`、`TEST_BROWSER_PATH`、`TEST_SCREENSHOT_DIR` に対応します。
320×568からのスマホ表示、PC・横向き・回転・表示領域縮小で、縦スクロール不要かつ速度推移が常時見え、主要操作が押せることを確認します。運転・ドア・レバーのタッチドラッグ・非常制動・再開、停車時の景色の静止・走行時の変化、グラフの高さ・常時表示・拡大パネル開閉・ズーム・タッチスクロール・追従切替、得点画面の終了操作も検証します。雨天は複数画面サイズの操作・グラフの可視性、停車中の雨の動き、視差効果低減設定による静止と復帰、晴天への切替も検証します。グラフ位置の境界確認にはDOM入力の固定値0/50/100%を使用し、運転物理の実測とは区別します。

## でんしゃを走らせよう！

`TEST_BASE_URL=http://127.0.0.1:8000 TEST_BROWSER_PATH=/usr/bin/chromium node tests/train-crossing.cjs`。既存のPlaywrightを使い、`TEST_PLAYWRIGHT_MODULE` と `TEST_SCREENSHOT_DIR` に対応します。

320×568・375px・768px・PC・横向きで、縦横のはみ出しと44px以上のタップ領域を確認します。3車種の出発→踏切・トンネル→星3つ→到着→再出発、実際のタッチ長押しブレーキ・解除、キーボード、車種・音・到着回数の保存を検証します。保存・音・全画面APIが使えない場合、モーション低減設定、GitHub Pages相当のサブパスも確認します。エミュレーションであり実機確認ではありません。

## Sのキス釣り

`node tests/kiss-fishing.cjs` で、独立した加点計算3ケースとアワセの狙い目・海底・誘いの間・根掛かりを照合します。Playwright/Chromiumを用意し、`TEST_BASE_URL=http://127.0.0.1:8000 TEST_BROWSER_PATH=/usr/bin/chromium node tests/kiss-fishing.cjs --browser`。`TEST_PLAYWRIGHT_MODULE` と `TEST_SCREENSHOT_DIR` に対応します。

タッチによる実際のキャスト→アワセ→取り込み・加点、320pxからPC・横向きでの操作、図鑑での一時停止、終了と再プレイ、旧保存キー、日替わりの再現性を確認します。根掛かり・遅合わせ・糸切れ・タイマー終了は明示的なテスト状態で境界を確認します。テスト用の観測口は配信レスポンスにテスト側だけで追加し、本番ファイルには含めません。実機の確認とは区別します。

## GYRO RUSH ジャイロ宇宙船

`TEST_BASE_URL=http://127.0.0.1:8000 TEST_BROWSER_PATH=/usr/bin/chromium node tests/gyro-rush.cjs`。Playwright/Chromiumを使い、`TEST_PLAYWRIGHT_MODULE` と `TEST_SCREENSHOT_DIR` に対応します。

320pxからPCの画面、下部の左・中央・右・フッターへのブーストタッチ、移動との分離、2本指、49/50/100のエネルギー境界、重複発動・キャンセル・キーボード、一時停止・回転・再プレイ・記録を検証します。許可拒否・未対応・タイムアウト・模擬gamma・中央設定も確認します。中央から±0.25/±1/±2度の微小傾きと0度で、左右の入力が連続しデッドゾーンを持たないことを独立した期待座標と比較します。終了と被弾は明示的な状態設定を使い、観測口は本番に含めません。実機のジャイロ性能確認とは区別します。保存・音が使えない場合、モーション低減設定、公開サブパスも確認します。

## レールタウン・レイアウト

`node tests/plarail-layout.cjs` で曲線中点・直線・弧長を独立した期待値と照合します。Playwright/Chromiumを用意し、`TEST_BASE_URL=http://127.0.0.1:8000 TEST_BROWSER_PATH=/usr/bin/chromium node tests/plarail-layout.cjs --browser`。`TEST_PLAYWRIGHT_MODULE` と `TEST_SCREENSHOT_DIR` に対応します。

320pxからPC・横向きの操作、3両の曲線・分岐走行、駅の停車と発車、ポイントの占有ロック、最後尾と踏切、位置を保つ折り返し、複数周回を確認します。タッチ配置・回転・長押し削除・キャンセル・Undo、拡大と移動、保存と旧形式、不正データと保存失敗、公開サブパスを検証します。経路や折り返し等の境界は明示的なテスト状態で確認し、観測口は本番に含めません。実機の確認とは区別します。


## ぐらぐらクレーン！

`node tests/gyro-crane.cjs` で短い画面の作業空間と、手計算した放物運動3ケースを確認します。Playwright/Chromiumを用意し `TEST_BASE_URL=http://127.0.0.1:8000 TEST_BROWSER_PATH=/usr/bin/chromium node tests/gyro-crane.cjs --browser`。`TEST_PLAYWRIGHT_MODULE` と `TEST_SCREENSHOT_DIR` に対応します。

320×568・375px・768px・PCの画面とタッチ操作、キーボード・キャンセル、実時間での落下・加点、風を含む予測と着地点、荷物の速度・傾き境界、精密着地5回・小画面での8段積み・位置ずれによる崩壊・タイマー終了、一時停止・横向き案内・再プレイ、記録と効果音設定、保存失敗・破損データの保持、音未対応・動きの低減・公開サブパスを検証します。完走や境界の確認は荷物の姿勢・タイマーを明示的に設定し、観測口はテスト側でレスポンスに追加します。本番に観測口は含めません。実機の操作・音は未確認です。小画面の作業空間テストは改修前のコードで失敗を確認しています。


## さっとメモ

PlaywrightとChromiumを用意し、HTTPサーバー起動後に `TEST_BASE_URL=http://127.0.0.1:8000 TEST_BROWSER_PATH=/usr/bin/chromium node tests/quick-memo.cjs`。`TEST_PLAYWRIGHT_MODULE` と `TEST_SCREENSHOT_DIR` に対応します。

保存実行と表示更新の分離（仮想時計で499msは据え置き・500msで更新、連続筆記で延期、保存エラーは即時表示）、筆記画面の拡大抑制（touch-action・iOSジェスチャーイベント・2本指の既定動作抑制）と安定したsvh指定、保存表示・タイトル・日付のドラッグによる文字の誤選択防止（修正前の失敗を確認）、初回からの実際のタッチ筆記・保存と再読み込み、部分消しゴム・Undo/Redo、色・太さ、新しい紙と一覧からの再編集、回転時の座標維持、実際のPNGダウンロードと白背景、消しゴム選択中の再タップによる現在の紙だけの削除・キャンセル・復元、一覧を開いたままの削除と復元、他の紙に切り替えないカード単位のプレビュー、共有APIのモックでPNGファイルを確認します。320×568・375px・768px・PCで表示と操作、キャンセル・複数指、容量不足と再保存、別タブによる競合、破損・不正形式の保護、公開サブパスを検証します。タッチと画面サイズはChromiumのエミュレーションで、iPhone/Android実機や実際の共有シートは未確認です。既存アプリに変更はなく、新規ツールなので変更前の専用テストはありません。
