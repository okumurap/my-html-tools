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
