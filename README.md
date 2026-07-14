# My HTML Tools

ブラウザだけで動く、小さなHTMLアプリや便利ツールをまとめて公開するリポジトリです。原則としてビルドやサーバーを必要とせず、PCとスマートフォンの両方で利用できる静的なツールを収録します。

## 公開URL

<https://okumurap.github.io/my-html-tools/>

GitHubリポジトリの **Settings → Pages → Source** は、`GitHub Actions` に設定します。

## アプリ一覧

### 001 Offset Capability Lab

オフセットと標準偏差を調整し、2つの分布のヒストグラムと工程能力指数（Cp・Cpk）を比較するシミュレーターです。

- [アプリを開く](./tools/offset-capability-lab/)
- PC・スマートフォン対応
- Canvas描画、外部通信なし

### 002 図面注釈ツール

PNGまたはJPEGの画像・図面へ、ペン、矢印、図形、連番ラベルを書き込み、PNGとしてコピーまたは保存するツールです。

- [アプリを開く](./tools/drawing-annotation/)
- PC・スマートフォン・ペン入力対応
- Canvas描画、外部通信なし

### 003 スクリュ径A/B比較ツール

射出成形機のスクリュ径A/Bについて、断面積、外周長、最大周速、理論体積流量、充填体積、必要ストロークを比較するツールです。

- [アプリを開く](./tools/screw-diameter-comparator/)
- PC・スマートフォン対応
- 外部通信なし

### 004 でんしゃを走らせよう！

画面をタップして、駅から踏切とトンネルを越えて次の駅まで電車を走らせるミニゲームです。

- [アプリを開く](./tools/train-crossing/)
- PC・スマートフォン対応
- Canvas描画・効果音、外部通信なし

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
