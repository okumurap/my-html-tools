# 開発用の雛形と初回セットアップ

この資料は [AGENTS.md](../AGENTS.md) から移した参考例です。作業規則はルートと [tools/AGENTS.md](../tools/AGENTS.md) を参照します。既存の構成・実ファイルを優先し、雛形で既存機能を上書きしません。

## HTMLの最小例

CSS・JSの分割は必要な場合だけ行います。単体HTMLの既存アプリはその独立性を維持します。

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

## Pagesワークフローの参考例

既存の [.github/workflows/pages.yml](../.github/workflows/pages.yml) が実際の設定です。以下は既存ルールから移した参考例で、Actionsの最新版を保証するものではありません。通常のアプリ変更ではワークフローの作り直し・バージョン変更は不要です。

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

## 未整備リポジトリの初回セットアップ

現在のリポジトリはセットアップ済みです。以下は新規構築・復旧時のみの参考です。

1. `.gitignore` を用意し、秘密情報・依存ディレクトリ・不要な生成物を除外します。
2. READMEに目的・公開URL・起動方法・アプリ一覧・追加方法・ライセンスを記載します。
3. 一覧用の `index.html` と `assets/js/catalog.js`、アプリ用の `tools/` を用意します。
4. 必要な場合だけPagesワークフローを作り、一覧データとREADMEにアプリを登録します。
5. リポジトリのルートで `python3 -m http.server 8000` を起動し、HTTPと公開用サブパスの表示・操作を確認します。
6. GitHubのPagesのSourceは `GitHub Actions` を想定します。公開設定の変更にはユーザーの明示的な依頼が必要です。

## テストの実行先

[tests/README.md](../tests/README.md) に実行手順があります。そこに記載のテストが全アプリを網羅するとは限らないため、対象アプリ内のテストも確認します。実行結果の過去記録を今回の合格結果として流用しません。
