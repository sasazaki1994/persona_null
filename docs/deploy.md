# Vercel 公開・Production確認手順

この文書を Vercel 設定と Production 動作確認の正本とします。README は作品概要と公開URLの入口、`docs/jam-submission.md` は提出物の最終チェックに限定します。

Persona Null はクライアント側だけで動作する React + Vite アプリです。外部 API、データベース、秘密情報を使用していないため、**環境変数は不要**です。

## 公開前確認

Node.js 20 と npm を使用し、リポジトリ直下で CI と同じ順序の確認を実行します。

```bash
npm ci
npm run lint
npm run test
npm run build
```

`npm run build` の完了後に `dist/` が生成されれば、Vercel へ公開できる状態です。

## Vercel Dashboard 設定

1. GitHub 上の Persona Null リポジトリを Vercel に Import します。
2. **Framework Preset**: `Vite`
3. **Root Directory**: リポジトリ直下
4. **Install Command**: `npm ci`
5. **Build Command**: `npm run build`
6. **Output Directory**: `dist`
7. **Environment Variables**: 追加しない
8. Deploy を実行します。

`vercel.json` は不要です。ルート URL から起動し、アプリ内の画面遷移は React state で行われます。

## Production動作確認

確定した Production URL をPCブラウザで開き、次を順番に確認します。

1. タイトル画面が表示され、**監査端末を起動** を選択できる。
2. 都市OS 基礎公定通知を確認し、事件選択へ進める。
3. Case001 が `previewOnly` の予告として表示され、開く／調査開始などのプレイ可能導線がない。
4. Case000 の事件概要から調査を開始できる。
5. 7つの記憶ノードを選択でき、ノード詳細のタイピング演出と用語注釈を確認できる。
6. 根拠をピン留めし、対象ノードへ矛盾タグを付け、監査リソースを使う追加解析を実行できる。
7. 必要ノード数、最低1件のピン留め、最低1件の矛盾タグを満たした後だけ最終判断へ進める。
8. A / B / C のいずれかを選び、結果画面へ到達できる。
9. 結果画面に裁定、処理内容、優先／棄却した価値、提出根拠、矛盾分類、解析履歴、都市ステータス、監査注記、Case001予告が表示される。
10. 再読み込み後に事件選択へ進み、Case000 が処理済みと表示される。
11. 画面幅を狭めた場合、主要ペインが縦に並び、見出し、ボタン、ログを横スクロールなしで読める。完全なスマートフォン最適化は対象外とする。

不具合がある場合は Production URL を提出せず、対象コミットを修正して CI と Deployment を再実行します。

## URL確定後

- README 上部の **Demo / Play URL** を確定URLへ置き換える。
- Jam 提出ページへ同じURLを登録する。
- `docs/jam-submission.md` の最終チェックを完了する。
- Production URL または同一コミットのローカル表示から提出用スクリーンショットを撮影する。

## 更新公開

GitHub 連携済みの場合は、接続ブランチへの push ごとに Preview または Production Deployment が作成されます。Jam の提出 URL を確定する前に、対象コミットの GitHub Actions CI と Vercel Production Deployment の両方が成功していることを確認してください。
