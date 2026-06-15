# Persona Null 監査報告書チェック仕様

## 目的

監査報告書チェックは、最終判断前にプレイヤーの現在の調査状態を行政端末風に可視化する補助機能である。記録確認、争点整理、根拠登録、矛盾分類、追加解析の状況をまとめ、未整理のまま裁定した場合に軽視される可能性がある事項を示す。

## 原則

- 正解・不正解を判定せず、スコアやランクを付けない。
- 監査報告書の警告は裁定を禁止しない。既存の判断解放条件だけを維持する。
- 未整理争点、根拠不足、矛盾分類不足、追加解析なし、高い処理圧力を注意事項として表示する。
- Case000 / Case001 の `CaseRecord.issues` と調査 state を共通ロジックで評価する。
- 調査画面の JUDGMENT CONSOLE には集計、争点別状態、報告状態、注意事項を表示する。
- DecisionScreen には同じ監査報告書状態の summary を表示する。
- ResultScreen と `SavedCaseResult` には保存しない。localStorage の保存形式は変更しない。

## 状態

- `insufficient`: 既存の裁定条件が未達。
- `ruling_possible`: 裁定可能だが、注意事項が残る。
- `ruling_supported`: 裁定可能で、最低限の争点整理と根拠登録を満たす。
- `pressure_ruling`: HIGH または CRITICAL の処理圧力下で裁定可能。

争点は、関連ノード未確認なら `unreviewed`、確認済みでも根拠登録と矛盾分類がなければ `weak`、それ以外は `reviewed` とする。

## 受け入れ条件

- `npm run lint`、`npm test`、`npm run build` が通る。
- 既存のノード確認、根拠ピン留め、矛盾分類、解析アクション、最終判断、結果保存を壊さない。
- JUDGMENT CONSOLE に監査報告書チェックが表示され、調査状態に応じて報告状態と警告が変わる。
- DecisionScreen に監査報告書状態が表示される。
- Case000 / Case001 の両方で共通利用できる。
- localStorage の保存形式を変更しない。
