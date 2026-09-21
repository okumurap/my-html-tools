# 暮らしのタスク

公開URL: https://okumurap.github.io/my-html-tools/tools/family-tasks/

タスクを追加・完了・手動並び替えできるシンプルな管理ツールです。Firebase未設定ならデモとしてこのブラウザのlocalStorageに保存します。デモはほかの端末・家族とは同期されません。

## 操作

- 右下の「＋」からタスク名を入力して追加。カテゴリと担当は選びません。新しいタスクは互換性のため内部的にカテゴリ「その他」、共有タスクの担当「共同」で保存します。
- 必要なら追加画面の「詳細設定」で公開範囲・期限・メモを指定。既存タスクも「編集」から期限・名前・メモを変更／削除できます。
- チェックボックスで完了・未完了を切り替えます。
- 並び順は**手動順だけ**です。「並び替え」を押し、「↕」の長押しドラッグまたは↑↓ボタンで順番を変え、終了します。端末内デモでは並び順が保存されます。スマホの長押し時はタスクの文字選択を抑制します。
- 検索・状態・公開範囲・期限で絞り込みできます。並び替え中は対象が曖昧にならないよう一時的に全件表示します。
- 設定画面でJSONエクスポート・デモへのJSONインポートが可能です。インポートはデモ専用で、最大2MB・1000件です。破損JSONは拒否します。

## 旧データとの互換性

`family-tasks:demo:v1` とJSON `version: 1` は変更しません。従来のカテゴリ・担当・sortOrderも消去しませんが、カテゴリ／担当の選択UIおよびチップは表示せず、今後の新規タスクにこれらの選択は不要です。旧カテゴリ（家事・住宅→家、子育て→子ども、仕事→その他）の読み替えも継続します。以前の「期限順／新しい順」表示設定は起動時に「手動順」へ切り替えます。既存タスクを一括書き換えることはしません。

FirebaseのデータモデルとFirestoreルールは互換性維持のため変更していません。Firestoreへデータを書き込む場合はリポジトリの `firestore.rules` を実際のFirebase Consoleで既存ルールと統合・適用し、アクセス権とsortOrder更新を検証してください。GitHubにファイルを置くだけでは適用されません。実接続・夫婦間同期・iPhone実機テストは未実施です。

## Firebaseを設定する場合

1. Firebase ConsoleでWebアプリを作成し、AuthenticationのGoogleプロバイダと承認済みドメイン `okumurap.github.io` を設定します。
2. Firestoreを作成し、同梱 `firestore.rules` を他のアプリの既存ルールと統合・検証したうえで適用します。実データの入力前に本人・家族・第三者の権限を検証してください。
3. アプリの設定画面にWeb用firebaseConfig JSONを入力します。必須項目は `apiKey`、`authDomain`、`projectId`、`appId`。**秘密鍵、サービスアカウント、個人情報をGitHubにコミットしないでください。** 共通設定は `my-html-tools:firebase-config:v1`、共通モジュールは `../../assets/js/firebase-shared.js` です。
4. 各自Googleアカウントでログインし、一方が家族スペースを作成。もう一方のUIDを正確に確認して登録します。共有は最大2人までです。誤ったUIDを登録すると別人にデータが見えるため注意してください。

個人タスクは `users/{uid}/tasks`、共有タスクは `families/{familyId}/tasks` に保存します。オフラインキャッシュやログアウト後の端末内キャッシュにも注意してください。JSON書き出しは取得済みデータのみで完全バックアップではなく、デモからFirebaseへの自動移行、通知、PWA、Undo/Redoはありません。

## 検証

HTML・JavaScriptの構文、架空のデモデータでの追加・編集・期限変更・完了・順序変更・localStorage復元・JSON互換、幅320／375／768／1280pxを対象に検証します。iPhone Safari実機、Firebase実接続、Firestore Emulatorの権限・同期は未確認です。`python3 -m http.server 8000` をリポジトリのルートで起動して `http://localhost:8000/tools/family-tasks/` で確認できます。

既存の `tools/family-tasks/script.js` の手動順位・デモ保存・Firestore更新を再利用し、グラフやUndo/Redoは対象外のため追加しません。
