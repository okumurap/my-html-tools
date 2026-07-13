# My HTML Tools

ブラウザだけで動く、小さなHTMLアプリや便利ツールをまとめて公開するリポジトリです。原則としてビルドやサーバーを必要とせず、PCとスマートフォンの両方で利用できる静的なツールを収録します。

## 公開URL

<https://okumurap.github.io/my-html-tools/>

GitHubリポジトリの **Settings → Pages → Source** は、`GitHub Actions` に設定します。

## アプリ一覧

現在、公開中のアプリはありません。

アプリを追加したときは、この一覧とルートの `index.html` を同時に更新します。

## ローカルでの開き方

リポジトリのルートでローカルHTTPサーバーを起動します。

```bash
python3 -m http.server 8000
```

ブラウザで <http://localhost:8000/> を開いてください。

## 新しいアプリの追加方法

1. `tools/<app-name>/` を作成します。
2. フォルダ内に最低限 `index.html` を置きます。
3. 必要に応じて `style.css`、`script.js`、`README.md` を追加します。
4. ルートの `index.html` と、このREADMEのアプリ一覧にリンクと概要を追加します。
5. PCとスマートフォンの両方で表示と操作を確認します。

パスはGitHub Pagesで動作するよう、`./tools/example-tool/` のような相対パスを使用します。

## デプロイ

`main` ブランチへのpush、または手動実行により、`.github/workflows/pages.yml` がリポジトリ全体をGitHub Pagesへデプロイします。

## ライセンス

現在、ライセンスは設定していません。
