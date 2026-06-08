# Persona Null

[![CI](https://github.com/sasazaki1994/persona_null/actions/workflows/ci.yml/badge.svg)](https://github.com/sasazaki1994/persona_null/actions/workflows/ci.yml)

> **Demo / Play URL:** Production URL 確定後にここへ記載
>
> **推奨環境:** PC ブラウザ（狭い画面でもテキスト確認は可能ですが、Memory Network の探索はPC推奨）

都市OSが「誰が撃ったのか」を確定できない事件を、監査室の端末から記憶ネットワークとして調査する React + Vite + TypeScript + Three.js 製のプレイアブルMVPです。

## スクリーンショット

以下の3ファイルを [`docs/screenshots.md`](docs/screenshots.md) の手順で撮影し、同じパスへ配置すれば README に反映されます。現在のリポジトリには実画像が未配置のため、Jam提出前に必ず差し替えてください。

### タイトル画面

![Persona Null タイトル画面](docs/images/title.png)

監査端末へ接続するタイトル画面。

### Case000 調査画面

![Case000 記憶ネットワーク調査画面](docs/images/case000-investigation.png)

7つの記憶ノードを探索し、提出根拠への登録、矛盾分類、追加解析を行う中核画面。

### Case000 結果画面

![Case000 行政処理ログ結果画面](docs/images/case000-result.png)

提出した判断、根拠構造、都市ステータスへの影響、Case001予告を確認する結果画面。

## ゲーム概要

**Persona Null / 監査室** は、北霞市の都市OSが処理不能とした人格・身体・記憶の境界案件を、監査官として裁定する短編アドベンチャーです。

Jam提出MVPでは、Case000「誰が撃ったのか」のみをタイトル画面から結果画面までプレイできます。プレイヤーは KASUMI-GATE-09 に接続された記憶ネットワークを調査し、証拠を提出根拠に登録し、矛盾を分類し、限られた監査リソースで追加解析を行い、最後に不可逆の行政判断を提出します。

> **Case001「焼却されなかった声」は `previewOnly` の予告です。プレイ可能な導線・本編ルートは実装していません。**

提出直前の確認は [`docs/jam-submission.md`](docs/jam-submission.md)、Vercel の設定と Production 動作確認は [`docs/deploy.md`](docs/deploy.md) を参照してください。

## 遊び方

1. タイトル画面で **監査端末を起動** を選択します。
2. **都市OS 基礎公定通知** を読み、**通知を確認** を選択します。
3. 事件選択で **Case000を開く** を選択します。
4. Case000 事件概要を確認し、**調査を開始** を選択します。
5. 調査画面中央の **Memory Network** で記憶ノードをクリックして詳細を確認します。
6. 重要だと思うノードを **提出根拠に登録** します。提出根拠は最大3件です。
7. 矛盾対象ノードでは、右側の矛盾分類ボタンからタグを付けます。
8. 必要に応じて監査リソースを消費し、追加解析を実行します。
9. 次の条件をすべて満たすと **最終判断へ進む** が開放されます。
   - `requiredNodesToJudge` 以上の記憶ノードを確認する。
   - 最低1件を提出根拠に登録する。
   - 最低1件の矛盾タグを付ける。
10. 最終判断 A / B / C のいずれかを選ぶと、結果画面に行政処理ログが表示され、localStorage に完了状態が保存されます。

## 実装範囲

### 実装済み

- タイトル画面、都市OS 基礎公定通知、事件選択、Case000 事件概要
- Three.js 製 Memory Network と7つの記憶ノード
- ノード詳細、タイピング演出、用語注釈
- 提出根拠への登録、矛盾分類、監査リソースを使う追加解析
- 開放条件付きの最終判断 A / B / C と結果画面
- Case000 結果と既読フラグの localStorage 保存・破損データ耐性
- Case001 の `previewOnly` 予告表示
- 狭い画面で主要ペインを縦に並べ、テキストを読める最低限のレスポンシブ表示

### 未実装

- Case001 のプレイ可能な本編
- 複数事件の本編進行、最終エンディング分岐
- 音演出
- スマートフォン向けの操作・レイアウト最適化を含む完全なレスポンシブ対応
- Jam提出後の独自ドメイン、OGP画像

## ローカル起動

```bash
npm ci
npm run dev
```

Vite の開発サーバーが起動したら、表示されたローカルURLをブラウザで開いてください。`package-lock.json` をコミットしているため、CI と同じ依存関係を `npm ci` で再現できます。

## 品質確認とビルド

```bash
npm run lint
npm run test
npm run build
```

- `npm run lint`: ESLint で TypeScript / React Hooks ルールを確認します。
- `npm run test`: Vitest で Case000 のデータ構造、判断条件、Case001 のロック状態、localStorage の耐障害性を確認します。
- `npm run build`: `tsc -b` による TypeScript チェック後、Vite の本番成果物を `dist/` に生成します。

## 技術構成

| 分類 | 採用技術 |
| --- | --- |
| UI | React 19 |
| Build | Vite 7 |
| Language | TypeScript strict |
| Memory Network | Three.js |
| State / Save | React state / localStorage |
| Quality | ESLint / Vitest |
| CI / Hosting | GitHub Actions / Vercel |

Jam提出MVPはクライアントのみで動作し、外部 API、データベース、環境変数、秘密情報を必要としません。

## 公開

Vercel では **Framework Preset: Vite / Install: `npm ci` / Build: `npm run build` / Output: `dist`** を指定します。詳細な公開手順と、タイトル画面から Case000 結果画面、保存状態、Case001 preview-only 制約までを確認する Production チェックの正本は [`docs/deploy.md`](docs/deploy.md) です。

Production URL が確定したら、この README 上部の **Demo / Play URL** と Jam 提出ページへ同じURLを記載してください。

## Jam提出資料

- [提出直前チェックリスト](docs/jam-submission.md)
- [スクリーンショット撮影・配置手順](docs/screenshots.md)
- [Vercel公開・Production確認手順](docs/deploy.md)
- [Case000 MVP仕様](docs/specs/case000-mvp.md)
- [Gherkin acceptance spec](features/case000_mvp.feature)

## ライセンス

TBD
