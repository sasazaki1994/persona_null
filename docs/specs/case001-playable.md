# Persona Null Case001 Playable Extension Spec

## 1. Purpose

Case001「焼却されなかった声」を Case000 と同じ React + Vite + TypeScript + Three.js の監査フローで最後まで遊べる事件として追加する。Case000 の文言、進行条件、保存キー、既存結果の読込互換性は維持する。

本書は `docs/specs/case000-mvp.md` の拡張仕様である。旧仕様内の「Case001 は previewOnly」という記述は当時の MVP 範囲を示す履歴とし、Case001 の現在仕様には本書を優先する。

## 2. Scope

- 事件選択に Case000 と Case001 を監査可能な記録として表示する。
- 選択した `CaseRecord` を概要、調査、Memory Network、裁定、結果へ渡す。
- Case001 は 7 記憶ノード、3 争点、3 解析アクション、3 最終判断を持つ。
- 判断解放条件は必要ノード確認、判断根拠 1 件以上、矛盾分類 1 件以上とする。
- Case001 の結果は既存の `persona-null:case-results` 配列へ `caseId: "case001"` として保存する。
- Case000 と Case001 は事件ごとに処理済み表示を判定する。
- 裁定印は各事件データが持つ表示名を使用し、Case000 専用文言を Case001 に流用しない。

## 3. Compatibility

- `SavedCaseResult` の必須フィールドと localStorage キーは変更しない。
- 既存 Case000 保存結果をそのまま読み込めること。
- `src/case000.ts` の既存 Case000 export は維持する。
- Case000 の 7 ノード、3 解析、3 裁定および初期都市ステータスは変更しない。

## 4. Case001 content

- Title: 焼却されなかった声
- Subtitle: 不完全な声を証言として扱えるか
- Theme: 本人認証できない人格断片の証言能力、自己保存反応の意味、焼却処理の妥当性
- Nodes: 焼却処理キュー、反復発話ログ、断片記憶、自己保存反応、人格署名の揺らぎ、都市警備局の焼却要求、KASUMI-GATE-09残響
- Issues: 本人の証言性、人格継続要求、焼却停止
- Decisions: 焼却承認、人格断片として証拠保全、異常記録として隔離

## 5. Out of scope

- 外部 API、サーバー、DB、認証
- Case002 以降の playable 実装
- Case001 専用画像素材または音声再生
- 事件途中の進行状態保存（最終結果のみ既存形式で保存）
