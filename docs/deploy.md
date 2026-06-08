# Vercel 公開手順

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

## Vercel Dashboard から公開する

1. GitHub 上の Persona Null リポジトリを Vercel に Import します。
2. **Framework Preset** が `Vite` であることを確認します。
3. **Root Directory** はリポジトリ直下のままにします。
4. **Install Command** は `npm ci` を指定します。
5. **Build Command** は `npm run build` を指定します。
6. **Output Directory** は `dist` を指定します。
7. Environment Variables は追加せず、Deploy を実行します。

`vercel.json` は不要です。Vite の単一ページアプリとしてルート URL から起動し、アプリ内の画面遷移は React state で行われます。

## 公開後の確認

公開 URL で次を確認します。

1. タイトル画面が表示される。
2. 都市OS 基礎公定通知から事件選択へ進める。
3. Case000 の事件概要から調査を開始できる。
4. 7つの記憶ノードを確認できる。
5. 必要ノード確認、1件以上のピン留め、1件以上の矛盾タグ付け後に最終判断へ進める。
6. A / B / C の判断を選び、結果画面へ到達できる。
7. 再読み込み後、事件選択画面で Case000 の処理済み状態を確認できる。
8. Case001 は予告表示のままで、プレイ可能な導線がない。

## 更新公開

GitHub 連携済みの場合は、接続ブランチへの push ごとに Preview または Production Deployment が作成されます。Jam の提出 URL を確定する前に、対象コミットの GitHub Actions CI と Vercel Deployment の両方が成功していることを確認してください。
