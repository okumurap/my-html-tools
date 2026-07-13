# AGENTS.md

## 1. このリポジトリの目的

このリポジトリは、ブラウザだけで動く小さなHTMLアプリや便利ツールをまとめて公開するためのものです。

- ローカル配置先: `/Users/koji/Developer/my-html-tools`
- GitHubではパブリックリポジトリとして管理する
- GitHub Pagesで各アプリを公開する
- 主な利用端末はPCとスマートフォン
- 原則として、ビルド不要・サーバー不要・静的ホスティング可能な構成にする

Codexは、既存アプリを壊さず、追加・修正・整理・公開設定を行ってください。

---

## 2. 基本方針

### 優先順位

1. 実際に使いやすいこと
2. スマートフォンでも使えること
3. コードが読みやすく、後から直しやすいこと
4. 依存関係が少ないこと
5. 見た目がシンプルであること

過度な抽象化、複雑なフレームワーク導入、不要なビルド環境の追加は避けてください。

### 原則

- 基本はHTML、CSS、JavaScriptだけで作る
- 1アプリは1フォルダにまとめる
- 小規模アプリでは、無理にファイルを細分化しない
- 外部APIや秘密情報が必要な実装は、静的公開に適さないため勝手に追加しない
- npm、Node.js、React、Vue、Viteなどは、明確な必要性がない限り導入しない
- GitHub Pagesでそのまま動く相対パスを使う
- macOS固有のファイルや個人情報をコミットしない

---

## 3. 推奨ディレクトリ構成

```text
my-html-tools/
├── AGENTS.md
├── README.md
├── index.html
├── assets/
│   ├── css/
│   ├── js/
│   └── images/
├── tools/
│   ├── example-tool/
│   │   ├── index.html
│   │   ├── style.css
│   │   ├── script.js
│   │   └── README.md
│   └── another-tool/
│       ├── index.html
│       ├── style.css
│       └── script.js
├── .github/
│   └── workflows/
│       └── pages.yml
└── .gitignore
```

### ルートの `index.html`

ルートの `index.html` は、公開中のアプリ一覧ページとします。

各ツールへのリンク、短い説明、対応端末などを表示してください。

例:

```html
<a href="./tools/example-tool/">Example Tool</a>
```

GitHub Pagesのプロジェクトサイトで動くように、`/tools/example-tool/` のようなルート絶対パスは使わず、`./tools/example-tool/` のような相対パスを使ってください。

---

## 4. アプリ追加時のルール

新しいアプリを追加するときは、次を実施してください。

1. `tools/<app-name>/` を作る
2. 最低限 `index.html` を置く
3. 必要に応じて `style.css` と `script.js` を分ける
4. ルートの `index.html` にアプリへのリンクを追加する
5. ルートの `README.md` にアプリ名と概要を追加する
6. PCとスマートフォンの両方で表示崩れがないか確認する

### フォルダ名

- 半角英小文字を使う
- 単語区切りはハイフンを使う
- 日本語、空白、連番だけの名前は避ける

良い例:

```text
text-formatter
pdf-stamp-planner
clipboard-cleaner
```

避ける例:

```text
アプリ1
tool 01
test
new
```

---

## 5. HTML・CSS・JavaScriptの実装ルール

### HTML

- `<!doctype html>` を使用する
- `lang="ja"` を設定する
- `meta viewport` を必ず入れる
- セマンティックなHTMLを優先する
- ボタン操作には原則として `<button>` を使う
- 入力欄には対応する `<label>` を付ける
- アクセシビリティを損なうクリック可能な `<div>` は避ける

基本形:

```html
<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>アプリ名</title>
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <main>
    <h1>アプリ名</h1>
  </main>

  <script src="./script.js"></script>
</body>
</html>
```

### CSS

- モバイルファーストで作る
- 横幅の狭い画面で横スクロールを発生させない
- タップ領域は小さくしすぎない
- 色だけで状態を表現しない
- CSS変数を使い、主要な色や余白をまとめる
- 必要以上に派手な装飾やアニメーションを追加しない
- OSのダークモードに対応できる場合は `prefers-color-scheme` を使う

### JavaScript

- 原則としてVanilla JavaScriptを使う
- `const` を基本とし、再代入が必要な場合のみ `let` を使う
- グローバル変数を増やさない
- DOM取得、イベント登録、処理ロジックを分かりやすく整理する
- 入力値を必ず検証する
- エラー時は画面上に日本語で分かるメッセージを表示する
- `console.log` を残したまま完成扱いにしない
- `localStorage` を使う場合は、保存キーにアプリ固有の接頭辞を付ける

例:

```js
const STORAGE_KEY = "text-formatter:settings";
```

---

## 6. スマートフォン対応

各アプリは、iPhoneのSafariおよび一般的なAndroidブラウザで使えることを意識してください。

- 幅320px程度でも主要操作ができる
- 入力欄やボタンが画面外にはみ出さない
- hover前提の操作にしない
- ドラッグ操作だけを必須にしない
- ファイル読み込みを実装する場合、スマートフォンでも代替操作が可能な構成にする
- コピー機能はClipboard APIが失敗した場合のエラー表示を用意する
- PWA化は、明示的に依頼された場合のみ行う

---

## 7. GitHub Pages対応

このリポジトリはGitHub Pagesで公開します。

### 公開方式

原則として、GitHub Actionsを使ってリポジトリ全体を静的サイトとして公開します。

`.github/workflows/pages.yml` の基本形:

```yaml
name: Deploy static content to Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: .

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### パスに関する注意

GitHub PagesのURLは通常、次の形式になります。

```text
https://<github-user>.github.io/<repository-name>/
```

そのため、HTML、CSS、JavaScript、画像、アプリ間リンクは原則として相対パスを使ってください。

良い例:

```html
<link rel="stylesheet" href="./style.css">
<a href="../../index.html">ツール一覧へ戻る</a>
<img src="./images/sample.png" alt="">
```

避ける例:

```html
<link rel="stylesheet" href="/style.css">
<a href="/index.html">ツール一覧へ戻る</a>
```

---

## 8. 公開リポジトリとしての安全ルール

このリポジトリは公開されるため、次の情報を絶対にコミットしないでください。

- APIキー
- アクセストークン
- パスワード
- Cookie
- セッション情報
- 個人のメール本文
- 住所、電話番号などの個人情報
- 会社の機密情報
- 社内ファイルや社内URL
- 実在する顧客名、製品名、図面番号
- ローカルPCの不要な絶対パス
- `.env` ファイル
- 秘密鍵
- 認証情報を含む設定ファイル

公開前に、差分内に秘密情報がないか確認してください。

ブラウザ内のJavaScriptに記載した値は、GitHub Pages上ですべて閲覧可能です。秘密情報をフロントエンドへ埋め込まないでください。

---

## 9. `.gitignore`

最低限、次を含めてください。

```gitignore
.DS_Store
.env
.env.*
*.log
node_modules/
dist/
.vscode/
```

ただし、`.vscode/` に共有すべき設定を置く方針になった場合は、必要なファイルだけ例外指定してください。

---

## 10. READMEのルール

ルートの `README.md` には、最低限次を記載してください。

- リポジトリの目的
- GitHub Pagesの公開URL
- アプリ一覧
- ローカルでの開き方
- 新しいアプリの追加方法
- ライセンス

各アプリに説明が必要な場合は、アプリフォルダ内に `README.md` を置いてください。

アプリ一覧は、ルートの `index.html` と `README.md` で内容が食い違わないようにしてください。

---

## 11. ローカル確認方法

単純なアプリでも、可能な限り `file://` で直接開くだけではなく、ローカルHTTPサーバーで確認してください。

Pythonが使える場合:

```bash
cd /Users/koji/Developer/my-html-tools
python3 -m http.server 8000
```

確認URL:

```text
http://localhost:8000/
```

Codexは、利用可能であればHTML、CSS、JavaScriptの構文エラーも確認してください。

---

## 12. Codexが作業するときの手順

Codexは、変更前に次を確認してください。

```bash
pwd
git status
find . -maxdepth 3 -type f | sort
```

作業時は次の流れを基本とします。

1. 既存構成を確認する
2. 関係するファイルだけ読む
3. 変更内容を簡潔に整理する
4. 最小限の差分で実装する
5. ローカル確認または静的検証を行う
6. `git diff` を確認する
7. 変更内容と確認結果を報告する

### 変更時の注意

- ユーザーが明示していない既存機能を削除しない
- 大規模なリファクタリングを勝手に行わない
- フォルダ名やURLを変更する場合は、既存リンクへの影響を確認する
- 既存デザインがある場合は、その方向性を尊重する
- 依頼範囲外のファイルを大量に整形しない
- 自動生成ファイルを不用意に追加しない
- 不要なライブラリを追加しない
- コミットやpushは、明示的に依頼された場合のみ行う
- GitHubリポジトリの公開設定変更も、明示的に依頼された場合のみ行う

---

## 13. Codexへの依頼を受けた際の判断基準

### 小さな修正

文言変更、色変更、ボタン追加、軽微な不具合修正などは、既存構成を維持して直接修正してください。

### 新規アプリ

新しいフォルダを `tools/` に追加し、一覧ページとREADMEも更新してください。

### 共通化

同じCSSやJavaScriptが複数アプリで繰り返されていても、2～3個程度なら無理に共通化しなくて構いません。

共通化により、各アプリ単独での理解や移動が難しくなる場合は、各フォルダ内に保持してください。

### 外部ライブラリ

外部ライブラリを使う場合は、以下を満たすときだけ採用してください。

- Vanilla JavaScriptだけでは実装負担が大きい
- ライブラリ導入による利点が明確
- GitHub Pagesで動作する
- ライセンス上の問題がない
- CDN停止時の影響を許容できる
- 導入理由をREADMEまたはコードコメントで説明できる

---

## 14. 品質チェック

変更後は、該当する項目を確認してください。

- HTMLのタグ崩れがない
- JavaScriptの構文エラーがない
- コンソールエラーがない
- 主要ボタンが動く
- 入力が空の場合でも壊れない
- 長い文字列を入力してもレイアウトが壊れない
- 画面幅が狭くても操作できる
- GitHub Pages上で相対パスが正しく解決される
- 戻るリンクが正しい
- 外部通信失敗時に無反応にならない
- 個人情報や秘密情報が差分に含まれていない
- `git status` に意図しないファイルが出ていない

---

## 15. Git操作ルール

### ブランチ

小規模な個人開発では、ユーザーから指定がなければ現在のブランチ上で作業してください。

ただし、変更量が多い場合や試験的な変更では、作業ブランチを提案せず、必要に応じて作成してよいかを作業報告内で明示してください。勝手に既存ブランチを削除しないでください。

### コミット

コミットを依頼された場合、1コミットには1つの目的を持たせてください。

コミットメッセージ例:

```text
feat: add text formatter tool
fix: correct mobile button layout
docs: update tool list
chore: add GitHub Pages workflow
```

### push

明示的な依頼がない限り、pushしないでください。

push前には次を確認してください。

```bash
git status
git diff --check
git log -1 --oneline
```

---

## 16. 初回セットアップで行うこと

リポジトリが未整備の場合、次を順に整えてください。

1. `.gitignore` を作る
2. `README.md` を作る
3. ルートの `index.html` を作る
4. `tools/` を作る
5. `.github/workflows/pages.yml` を作る
6. サンプルまたは既存アプリを一覧へ登録する
7. ローカルHTTPサーバーで確認する
8. GitHub Pages向け相対パスを確認する

GitHub側では、リポジトリの Settings → Pages で、Sourceを `GitHub Actions` に設定する想定です。

---

## 17. 作業完了時の報告形式

作業完了時は、次の順で簡潔に報告してください。

1. 変更した内容
2. 変更した主なファイル
3. 実施した確認
4. 残っている注意点

コマンドを実行できなかった場合や、ブラウザでの動作確認ができなかった場合は、その点を明記してください。

---

## 18. このファイルの扱い

このファイルは、Codexがリポジトリ内で作業する際の基本指示です。

個別の依頼内容がこのファイルと矛盾する場合は、ユーザーの最新の明示的な依頼を優先してください。

特定のアプリだけに追加ルールが必要な場合は、そのアプリのフォルダ内に追加の `AGENTS.md` を置くことができます。
