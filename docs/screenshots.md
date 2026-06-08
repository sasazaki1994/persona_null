# Jam 提出用スクリーンショット撮影・配置手順

README と Jam 提出ページで、「回答を読む」のではなく「根拠構造を探索して行政判断を提出する」体験が伝わる3カットを用意します。

## README が参照する必須ファイル

| 優先度 | 画面 | 撮影状態 | ファイルパス |
| --- | --- | --- | --- |
| 1 | Case000 調査画面 | 複数ノードを確認し、Memory Network、ノード詳細、判断条件が見える | `docs/images/case000-investigation.png` |
| 2 | Case000 結果画面 | A / B / C のいずれかを提出し、行政処理ログと Case001 予告が見える | `docs/images/case000-result.png` |
| 3 | タイトル画面 | 初回起動直後 | `docs/images/title.png` |

README は上記パスをすでに参照しています。撮影後はファイル名を変えずに `docs/images/` へ配置してください。現在は実画像が未配置のため、Jam提出前に3ファイルを揃える必要があります。

## 撮影手順

1. Production 相当の表示を使うため、確定済みの Vercel Production URL、またはローカルの `npm run dev` を開きます。
2. 16:9、幅 1440px 以上を基準にし、文字が読めるブラウザ倍率へ調整します。
3. タイトル画面を `docs/images/title.png` として保存します。
4. Case000 を開始し、複数ノードを確認します。可能なら根拠を1件以上ピン留めし、矛盾タグを1件以上付けた状態で `docs/images/case000-investigation.png` を保存します。
5. 最終判断を提出し、裁定、処理内容、価値、提出根拠、監査注記、Case001予告の複数セクションが見える状態で `docs/images/case000-result.png` を保存します。
6. README を GitHub または Markdown preview で開き、3画像とキャプションが表示されることを確認します。

## 構図と安全上の注意

- ブラウザの開発者ツール、個人情報、不要なタブや通知を写しません。
- サイバー演出より可読性を優先し、UIテキストが判読できる倍率にします。
- 調査画面では7ノードのネットワークと左右の情報ペインが作品の中核だと分かる構図を優先します。
- 結果画面では単なる勝敗ではなく、提出した根拠構造が行政処理へ接続することを見せます。
- Case001 は予告表示だけを写し、プレイ可能だと誤認させる説明や導線を加えません。

## 配置確認

```bash
for image in \
  docs/images/title.png \
  docs/images/case000-investigation.png \
  docs/images/case000-result.png
do
  test -s "$image" || echo "missing: $image"
done
```

何も表示されなければ3ファイルが存在し、空ファイルではありません。画像の内容とREADME上の見え方は別途目視確認してください。

## 追加推奨カット

- `docs/images/case-select.png`: Case000 と Case001 preview が同時に見える事件選択画面。
- `docs/images/judgment-unlocked.png`: ノード確認、ピン留め、矛盾分類を完了し、最終判断が開放された調査画面。
- `docs/images/decision.png`: A / B / C の3選択肢が見える最終判断画面。
