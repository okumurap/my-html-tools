# 暮らしのタスク（プロトタイプ）

夫婦共有と複数端末同期を想定したタスク管理ツールです。通知・PWA・Cloud Functionsは使用しません。Firebaseを設定するまではデモとして端末内だけで動作します。

- 公開URL: https://okumurap.github.io/my-html-tools/tools/family-tasks/
- デモ: タスク追加・編集・完了・削除、期限、担当、カテゴリ、メモ、検索と絞り込み、JSONバックアップと復元。
- デモの保存キー: `family-tasks:demo:v1`。同じブラウザの別タブ以外には共有しません。デモデータはFirebaseへ自動移行しません。
- Firebaseモード: `users/{uid}/tasks` を個人用、`families/{familyId}/tasks` を家族用とし、Firestoreのリアルタイム同期と永続ローカルキャッシュを利用します。

## デモの使い方

公開URLにアクセスすると、設定なしで架空のタスク3件が表示されます。追加・完了・編集・削除を試せます。「設定」からJSONを書き出せます。実際の家族情報・個人情報はデモには入力しないでください。ブラウザデータを消すとデモのタスクも消えます。

## Firebaseを利用するときの設定

1. Firebase Consoleで1つのプロジェクト（Spark無料プラン）とWebアプリを登録します。Google AnalyticsとCloud Functionsは不要です。
2. AuthenticationのGoogleプロバイダを有効にして承認済みドメインに `okumurap.github.io` を追加します。ローカルで認証する場合は `localhost` も追加します。
3. Cloud Firestore Standardの `(default)` データベースを本番モードで作ります。**同梱の `firestore.rules` を既存のルールと統合し、実データ入力前にFirebase Consoleで適用・検証してください。** 公開リポジトリに置いただけではルールは有効になりません。別アプリのルールを上書きしないでください。
4. アプリ右上「設定」にWebアプリの `firebaseConfig` をJSON形式で貼り付けて保存します。必須項目は `apiKey`、`authDomain`、`projectId`、`appId`。サービスアカウントや秘密鍵は絶対に入力しないでください。実際の設定値はリポジトリにはコミットしません。
5. 各自の端末で同じFirebase設定を保存し、各自のGoogleアカウントでログインします。片方が「家族スペースを作成」し、相手のログイン画面で表示されるUIDを正確に確認して「招待を許可」欄に登録します。プロトタイプは2人までです。

共通設定は同一GitHub Pagesオリジンの `my-html-tools:firebase-config:v1` に保存し、`../../assets/js/firebase-shared.js` と Firebaseアプリ名 `my-html-tools` を複数ツールで再利用します。ログインは端末ごとに必要です。Firebase Web SDKはバージョン12.19.0に固定し公式CDNから取得します。

## セキュリティ・制約

- 自分専用と家族用は別コレクション。**アクセス権はFirestore Security Rulesで制限します。** 実環境・Emulatorでの本人・配偶者・第三者のアクセス検証は未実施なので、ルールを検証するまでは実データを投入しないでください。
- 誤ったUIDを登録すると別人に共有タスクが見えます。家族スペースの削除・参加者解除UIは未実装です。
- 同じ端末を他人と共有すると、ログアウト後もFirestoreのキャッシュやJSONが端末内に残る可能性があります。
- オフライン初回ログインは不可。既存キャッシュはストレージ設定に依存します。競合した同一ドキュメントは後から行われた書き込みが優先されます。
- Googleログインはポップアップ方式で、iPhone Safari等ではブラウザ側の制限で失敗する場合があります。実機検証は未実施です。
- JSONのエクスポートは現在画面に取得済みの情報だけなのでFirebaseの完全バックアップではありません。インポートはデモ専用、最大2MB・1000件まで、置換前に確認します。
- 通知、繰り返し、添付、Undo/Redo、個人↔共有の移動、デモデータのFirebase一括移行は未実装です。

## 開発・テスト

`python3 -m http.server 8000` をリポジトリのルートで起動し、`http://localhost:8000/tools/family-tasks/` を開きます。前回のプロトタイプ作成時、ChromiumのDOM操作と幅320・375・768・1280pxのエミュレーションで追加・編集・完了・削除・JSON入出力・保存復元・境界入力等を確認しています。ローカルHTTP URLへのブラウザ直接ナビゲーション、iPhone実機、Firebase認証・アクセス権・複数端末同期は未検証です。

再利用調査：既存の `tools/life-dashboard/script.js` のlocalStorage保存方式、`assets/js/catalog.js` のカタログ方式を確認。グラフやUndo/Redoは本アプリに不要のため流用せず、既存ツールの実装は変更していません。
