# 国旗覚える君

国旗の4択クイズと、国旗を重ねた世界地図を使って国名と位置を一緒に覚える静的HTMLアプリです。

## v1 の機能

- 国旗 → 国名 / 国名 → 国旗の10問4択クイズ
- 全世界・地域別の出題
- 世界地図上に国旗を表示して確認
- 国名（日本語・英語）検索と国へのズーム
- 地域フィルター
- 「未学習 / 練習中 / 覚えた」を端末内 `localStorage` に保存
- PC・スマートフォン対応

学習対象は国連加盟193か国と国連オブザーバー2（バチカン、パレスチナ）の計195です。

## 地図データ

`world.geojson` は Natural Earth の Admin 0 countries（50m）を簡略化したデータを利用します。Natural Earth のデータは Public Domain です。

- Source: Natural Earth via `nvkelso/natural-earth-vector`
- Derived dataset metadata: `countries-ne-50m`, simplify tolerance 0.04 degrees
- 一部の小国は50m地図形状に含まれないため、国旗マーカーの代表座標で補完しています。

## 保存

習得状態と国旗表示設定のみ、このブラウザの `localStorage` に保存します。外部サーバーへの送信は行いません。
