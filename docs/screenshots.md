# Jam 提出用スクリーンショット撮影・配置手順

README と Jam 提出ページで、「回答を読む」のではなく「根拠構造を探索して行政判断を提出する」体験が伝わる3カットを用意します。

## README が参照する必須ファイル

| 優先度 | 画面 | 撮影状態 | ファイルパス |
| --- | --- | --- | --- |
| 1 | Case000 調査画面 | 複数ノードを確認し、Memory Network、ノード詳細、判断条件が見える | `docs/images/case000-investigation.svg` |
| 2 | Case000 事件概要 | 事件概要、人物プロフィール、処理要求が見える | `docs/images/case000-overview.svg` |
| 3 | タイトル画面 | 初回起動直後 | `docs/images/title.svg` |

README は上記パスを参照します。3ファイルは確定済みの Vercel Production 版から撮影した実画像を、PNGデータを内包するテキストSVGとして配置します。画面更新時も同じ構図・ファイル名を維持し、バイナリPNGはコミットしません。

## 撮影手順

1. Production の表示を正本とするため、[https://persona-null.vercel.app](https://persona-null.vercel.app) を開きます。
2. 16:9、幅 1440px 以上を基準にし、文字が読めるブラウザ倍率へ調整します。
3. タイトル画面を一時PNGとして撮影し、表示内容と寸法を保持した base64 埋め込みSVG `docs/images/title.svg` へ変換します。
4. Case000 の事件概要を開き、事件説明、人物プロフィール、処理要求が同時に読める状態で一時PNGを撮影し、`docs/images/case000-overview.svg` へ変換します。
5. 調査を開始し、Memory Network、争点別記憶ノード、選択ノード要約、判断条件が見える状態で一時PNGを撮影し、`docs/images/case000-investigation.svg` へ変換します。
6. SVGが `<image href="data:image/png;base64,...">` を持つテキストファイルであることを確認し、変換元の一時PNGはコミットしません。
7. README を GitHub または Markdown preview で開き、3画像とキャプションが表示されることを確認します。

## 構図と安全上の注意

- ブラウザの開発者ツール、個人情報、不要なタブや通知を写しません。
- サイバー演出より可読性を優先し、UIテキストが判読できる倍率にします。
- 調査画面では7ノードのネットワークと左右の情報ペインが作品の中核だと分かる構図を優先します。
- 事件概要では人物と処理要求、調査画面では根拠ネットワークを見せ、導入から探索への二層体験が伝わる構成にします。
- Case001 は予告表示だけを写し、プレイ可能だと誤認させる説明や導線を加えません。

## 配置確認

```bash
for image in \
  docs/images/title.svg \
  docs/images/case000-overview.svg \
  docs/images/case000-investigation.svg
do
  test -s "$image" || echo "missing: $image"
done
```

何も表示されなければ3ファイルが存在し、空ファイルではありません。画像の内容とREADME上の見え方は別途目視確認してください。

## 追加推奨カット

- `docs/images/case000-result.svg`: 最終判断後の行政処理ログと Case001 予告が見える結果画面。
- `docs/images/case-select.svg`: Case000 と Case001 preview が同時に見える事件選択画面。
- `docs/images/judgment-unlocked.svg`: ノード確認、ピン留め、矛盾分類を完了し、最終判断が開放された調査画面。
- `docs/images/decision.svg`: A / B / C の3選択肢が見える最終判断画面。

## 公開ページ用キャプション

itch.io や他の公開ページでは、画像だけで操作内容を推測させず、次の説明を添えます。転記用の正本は [`docs/itch-page.md`](itch-page.md) です。

1. **タイトル画面** — 北霞市の監査端末へ接続する入口。仮アクセス権限と Case000 の識別情報が表示され、行政システムを操作する静かな緊張感を提示します。
2. **Case000 事件概要** — 発砲事件の争点、間宮怜司と七瀬未織の人物プロフィール、都市警備局からの処理要求を確認する導入画面。最初に「何が起きたか」を読み、次の調査で確かめる問いを整理します。
3. **Case000 調査画面** — 7つの記憶ノードを結ぶ Memory Network を探索する中核画面。記録の内容と接続を読み、提出根拠の登録、矛盾分類、追加解析を行いながら最終判断を組み立てます。
