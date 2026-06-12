# Persona Null — Jam提出直前チェック

この文書は提出物を確定するための最終チェックリストです。ゲームの概要・遊び方・実装範囲・技術構成は [README](../README.md)、itch.io の紹介文・短い説明・画像キャプションは [`docs/itch-page.md`](itch-page.md)、Vercel設定と詳しい Production 動作確認は [`docs/deploy.md`](deploy.md)、画像撮影は [`docs/screenshots.md`](screenshots.md) を正本とします。

## 提出情報

- **作品名:** Persona Null
- **提出版:** Case000 / Case001 プレイアブル版
- **Demo / Play URL:** [https://persona-null.vercel.app](https://persona-null.vercel.app)
- **推奨環境:** PCブラウザ
- **狭幅表示:** テキスト確認用の最低限対応。完全なスマートフォン最適化は未実装
- **Case001:** 「焼却されなかった声」を本編として最後までプレイ可能

## 提出物チェック

- [x] README 上部の **Demo / Play URL** を確定した Vercel Production URL に置き換えた。
- [ ] Jam 提出ページにも同じ Production URL を登録した。
- [x] `docs/images/title.svg` を配置した。
- [x] `docs/images/case000-investigation.svg` を配置した。
- [x] `docs/images/case000-overview.svg` を配置した。
- [x] README がリポジトリ内の3画像を参照し、それぞれに画面の役割を示すキャプションを記載している。
- [x] `docs/itch-page.md` の転記元文面が Case000 / Case001 の両方をプレイ可能な事件として説明している。
- [ ] GitHub 上の README でタイトル、事件概要、調査画面の3画像とキャプションが表示される。
- [ ] 作品説明に Case000 / Case001 の両方がプレイ可能であることを明記した。
- [ ] `docs/itch-page.md` の Short description と紹介文を itch.io に転記した。
- [ ] 3枚のスクリーンショットに、画面の役割と操作内容が分かる説明を設定した。

## 品質ゲート

- [ ] Node.js 20 環境で `npm ci` が成功した。
- [x] `npm run lint` が成功した。
- [x] `npm run test` が成功した。
- [x] `npm run build` が成功し、`dist/` が生成された。
- [ ] 対象コミットの GitHub Actions CI が成功した。
- [ ] 対象コミットの Vercel Production Deployment が成功した。

## Production確認（人間による手動確認）

以下はリポジトリ内の自動テストだけでは完了扱いにしません。[`docs/deploy.md` の Production動作確認](deploy.md#production動作確認) を同じ Production URL で最初から最後まで実施します。

- [ ] タイトル画面から Case000 と Case001 の各結果画面まで進行できた。
- [ ] 7ノード、タイピング演出、用語注釈、ピン留め、矛盾分類、監査リソースを確認した。
- [ ] 判断条件を満たす前は最終判断がロックされ、条件充足後に A / B / C を選択できた。
- [ ] 結果画面に提出した根拠構造と行政処理ログが表示された。
- [ ] 再読み込み後に Case000 の処理済み表示を確認した。
- [ ] Case001 を事件選択から開き、調査・判断・結果保存まで完了できた。
- [ ] 狭い画面で主要ペインが縦に並び、テキストを読めた。

## 実装範囲の最終確認

### 提出版に含む

- Case000 / Case001 のタイトルから結果までの一連の画面
- 各事件7つの記憶ノードを持つ Three.js Memory Network
- タイピング演出と用語注釈
- 根拠のピン留め、矛盾分類、監査リソースによる追加解析
- A / B / C の最終判断と行政処理ログ
- localStorage による結果・既読状態の保存と破損データ耐性

### 提出版に含まない

- Case002 以降のプレイ可能な本編
- 事件をまたぐ分岐、最終エンディング分岐
- 音演出
- 完全なスマートフォン最適化
- 外部 API、データベース、ユーザー認証

## 未解決事項の扱い

- 必須スクリーンショット3枚が未配置なら提出しない。
- Case000 / Case001 の進行または結果保存に回帰があれば提出しない。
- 狭幅表示は読み取り可能性を合格条件とし、Memory Network をPCと同等に操作できることまでは求めない。

## Jam後の拡張候補

- 複数事件をまたぐ監査ログと人格境界テーマの深化
- 最終判断履歴を参照したエンディング分岐
- 音演出、警告音、都市OS通知音
- スマートフォンを含む本格的なレスポンシブUI
- 独自ドメインと OGP 画像
