# Persona Null 監査傾向蓄積表示 Spec

## 1. Purpose

Case000 / Case001 の確定済み裁定を事件横断で集計し、監査室が継続して優先・軽視してきた価値と都市ステータスへの累積影響を事件選択画面で確認できるようにする。

## 2. Source and compatibility

- 保存元は既存の localStorage キー `persona-null:case-results` と `SavedCaseResult[]` のみを使用する。
- `SavedCaseResult` の保存形式、事件進行条件、事件ごとに最新結果だけを保持する既存保存動作は変更しない。
- 保存結果の `caseId` と `decisionId` から対応する `CaseRecord` / `DecisionOption` を解決する。
- 都市ステータスの累積変動は保存された `finalStats` と事件の `initialStats` の差を集計し、裁定データの `statDelta` と同じ指標で表示する。
- JSON 破損、不正な保存要素、未知の事件 ID、未知の裁定 ID は無視し、画面を継続表示する。

## 3. Normalized value taxonomy

各 `DecisionOption` は既存の説明文 `prioritizedValue` / `disregardedValue` に加えて、横断集計用の次の配列を持つ。

- `prioritizedValues`: その裁定で優先した監査価値。
- `sacrificedValues`: その裁定で軽視した監査価値。

初期の共通分類は「人格断片保護」「記録整合性優先」「危険源隔離」「証拠保全」とする。表示件数は、保存済みの各事件の最新裁定に分類が含まれる回数である。

## 4. Presentation

### 4.1 事件選択画面

- 「監査傾向」パネルを事件ファイル一覧より前に表示する。
- 有効な確定済み裁定がない場合は「監査傾向：未記録」と表示する。
- 有効な裁定がある場合は、全共通分類の優先回数、軽視回数、都市ステータス累積変動を表示する。0 件の分類も省略しない。

### 4.2 結果画面

次の都市OS注記を表示する。

> この裁定は、以後の未確定人格案件における参照基準として保存されます。

結果画面から事件選択へ戻った場合、直前に保存できた裁定を監査傾向へ即時反映する。

## 5. Out of scope

- 新規事件の追加
- 保存スキーマ、DB、外部 API の追加
- 複数回行った同一事件の履歴保持
- 価値分類から結末や裁定を自動決定する処理
