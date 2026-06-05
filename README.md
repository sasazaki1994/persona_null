# Persona Null

都市OSが「誰が撃ったのか」を確定できない事件を、監査室の端末から記憶ネットワークとして調査する React + Vite + TypeScript + Three.js 製のプレイアブルMVPです。

## スクリーンショット

Jam提出用のスクリーンショットは `public/screenshots/` に配置する想定です。現時点では画像ファイルを同梱していないため、公開前の監査記録として次の3画面を撮影してください。

- `public/screenshots/title.png`: タイトル画面。「監査端末を起動」が見える状態。
- `public/screenshots/investigation.png`: Case000 調査画面。Three.js の **Memory Network**、ノード詳細、矛盾分類、監査ログが同一画面に見える状態。
- `public/screenshots/result.png`: 結果画面。最終判断後の行政処理ログと Case001 preview が見える状態。

画像を追加した場合は、この欄を実画像への Markdown 参照に差し替えてください。

## ゲーム概要

**Persona Null / 監査室** は、北霞市の都市OSが処理不能とした人格・身体・記憶の境界案件を、監査官として裁定する短編アドベンチャーです。

Jam提出MVPでは、Case000「誰が撃ったのか」のみをタイトル画面から結果画面までプレイできます。プレイヤーは KASUMI-GATE-09 に接続された記憶ネットワークを調査し、証拠をピン留めし、矛盾を分類し、限られた監査リソースで追加解析を行い、最後に不可逆の行政判断を提出します。

Case001「焼却されなかった声」は、事件選択画面と結果画面に表示される previewOnly の予告です。Jam提出MVPではプレイ可能ルートを追加していません。

Jam提出チェックリスト向けの詳細は [`docs/jam-submission.md`](docs/jam-submission.md) を参照してください。この README は GitHub トップページで初めて見る人が、作品内容・起動方法・実装範囲を素早く把握するための概要です。

## 操作方法

1. タイトル画面で **監査端末を起動** を選択します。
2. **都市OS 基礎公定通知** を読み、**通知を確認** を選択します。
3. 事件選択で **Case000を開く** を選択します。
4. Case000 事件概要を確認し、**調査を開始** を選択します。
5. 調査画面中央の **Memory Network** で記憶ノードをクリックして詳細を確認します。
6. 重要だと思うノードを **根拠としてピン留め** します。提出可能なピンは最大3件です。
7. 矛盾対象ノードでは、右側の矛盾分類ボタンからタグを付けます。
8. 必要に応じて監査リソースを消費し、追加解析を実行します。
9. 以下の条件を満たすと **最終判断へ進む** が開放されます。
   - `requiredNodesToJudge` 以上の記憶ノードを確認する。
   - 最低1件の判断根拠をピン留めする。
   - 最低1件の矛盾タグを付ける。
10. 最終判断 A / B / C のいずれかを選ぶと、結果画面に行政処理ログが表示され、localStorage に完了状態が保存されます。

## 現在実装済みの範囲

- タイトル画面
- 都市OS 基礎公定通知
- 事件選択
- Case000 事件概要
- Three.js 記憶ネットワーク
- 7つの記憶ノード
- ノード詳細表示
- 証拠ピン留め
- 矛盾タグ付け
- 監査リソース
- 最終判断
- 結果画面
- localStorage保存
- Case001 preview

## 未実装の範囲

- Case001 playable
- 複数事件の本編進行
- 最終エンディング分岐
- 音演出
- 本格的なレスポンシブ対応
- Case000 以外の本番事件データ

## 起動方法

```bash
npm install
npm run dev
```

Vite の開発サーバーが起動したら、表示されたローカルURLをブラウザで開いてください。

CI と同じインストール経路で確認したい場合も `npm install` を使用します。現時点では lockfile を同梱していないため、GitHub Actions CI も `npm install` の後に lint / test / build を実行します。

## ビルド方法

```bash
npm run build
```

`npm run build` は `tsc -b` による TypeScript チェックの後、Vite の本番ビルドを作成します。

## テスト方法

```bash
npm run lint
npm run test
```

- `npm run lint`: ESLint で TypeScript / React Hooks ルールを確認します。
- `npm run test`: Vitest で Case000 のデータ構造、判断条件、Case001 preview のロック状態、localStorage の耐障害性を確認します。

## 技術構成

- React
- Vite
- TypeScript strict
- Three.js
- ESLint
- Vitest
- localStorage
- GitHub Actions CI
- Vercel 静的公開設定 (`vercel.json`)

## GitHub Actions CI

`.github/workflows/ci.yml` で `push` / `pull_request` 時に以下を自動確認します。

1. Node.js 20 をセットアップする。
2. `npm install` で依存関係をインストールする。
3. `npm run lint` を実行する。
4. `npm run test` を実行する。
5. `npm run build` を実行する。

## Vercel公開手順

`vercel.json` は Vite の静的公開に合わせて、Build Command を `npm run build`、Output Directory を `dist` に固定しています。SPA の直接アクセス/リロードは `index.html` に rewrite されます。

1. GitHub リポジトリを Vercel に Import する。
2. Framework Preset が **Vite** になっていることを確認する。
3. Build Command が `npm run build`、Output Directory が `dist` になっていることを確認する。
4. 環境変数は現時点では不要。
5. Deploy 後、Case000 がタイトル画面から結果画面まで進行できることを確認する。
6. スクリーンショットを提出する場合は `public/screenshots/` の想定ファイル名に合わせて撮影・配置する。

GitHub Pages 向けの `base` 設定変更や Pages workflow は、Jam提出MVPでは追加していません。

## Jam向けMVPの受け入れ条件

- `npm run build` が成功する。
- `npm run lint` が成功する。
- `npm run test` が成功する。
- GitHub Actions CI で lint / test / build が自動実行される。
- README だけでゲーム内容、起動方法、操作方法、実装範囲、未実装範囲、技術構成が分かる。
- README から Jam提出チェックリスト向けの [`docs/jam-submission.md`](docs/jam-submission.md) に移動できる。
- Case000「誰が撃ったのか」をタイトル画面から結果画面までプレイできる。
- Case000 は7つの記憶ノードを持つ。
- 最終判断は、必要ノード確認数、最低1件のピン留め、最低1件の矛盾タグ付けを満たすまで開放されない。
- 最終判断は3件あり、各判断は結果画面に必要な裁定・処理・価値・監査注記・結末文を持つ。
- Case001「焼却されなかった声」は previewOnly の予告表示に留まり、プレイ可能ルートは存在しない。
- localStorage に Case000 の結果が保存され、再起動時に Case000 の処理済み状態が事件選択画面に表示される。
- localStorage 内の不正な保存データや壊れた既読フラグでアプリが落ちない。
- 既存のゲーム体験、サイバー監査室の文体、Case000 シナリオ構造、UI構成を壊していない。

## 今後の拡張候補

- Case001「焼却されなかった声」の本編実装。
- 複数事件をまたぐ監査ログと人格境界テーマの深化。
- 最終判断履歴を参照したエンディング分岐。
- 音演出、警告音、都市OS通知音の追加。
- スマートフォンを含む本格的なレスポンシブUI。
- Jam提出後の GitHub Pages 等、Vercel 以外の公開先に合わせた追加設定。

## ライセンス

TBD
