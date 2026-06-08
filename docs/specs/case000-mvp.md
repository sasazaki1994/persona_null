# Persona Null MVP Implementation Spec — Case000「誰が撃ったのか」

## 0. 確定方針

### 0.1 Case000 用語ルール

- 都市警備局所属の間宮怜司の職名は「捜査官」とする。
- プレイヤーおよび監査室側の人物は「監査官」とする。
- 義体やシステムの制御主体を示す「操作主体」「操作経路」「操作源」は職名ではないため、そのまま使用する。

この仕様は、`Persona Null` の MVP として `Case000「誰が撃ったのか」` だけを React + Vite + TypeScript + Three.js で実装するための確定仕様である。Cursor には本書をそのまま渡せる前提で、画面遷移、コンポーネント構成、TypeScript 型、事件 JSON、進行条件、最終判断、結果画面、localStorage 保存仕様を定義する。

- 対象事件は `case000` のみ。
- `Case001「焼却されなかった声」` は選択可能コンテンツではなく、locked/preview 表示だけを許可する。
- 外部 API、生成 AI API、サーバー、DB、認証は MVP では使用しない。
- 事件データは静的 JSON 相当の TypeScript オブジェクトとして `src/data/cases.ts` に保持する。
- UI は回答生成ではなく、事件記録・矛盾・根拠構造を探索する体験を優先する。
- 世界観は cyber / audit log だが、可読性を優先する。

## 1. 技術スタック

| 項目 | 採用 |
| --- | --- |
| App Shell | React 19 + Vite |
| Language | TypeScript |
| 3D 表示 | Three.js |
| Test | Vitest |
| Styling | 通常 CSS (`src/styles.css`) |
| Persistence | `window.localStorage` |

### 1.1 MVP 非対象

- Next.js ルーティング
- Prisma / PostgreSQL
- Playwright E2E
- OpenAI API 呼び出し
- サーバー永続化
- Case001 以降の playable 実装

## 2. 画面遷移

画面状態は `Screen` union type で管理し、React state の `screen` によって単一ページ内で切り替える。

```ts
export type Screen =
  | 'title'
  | 'briefing'
  | 'caseSelect'
  | 'caseOverview'
  | 'investigation'
  | 'decision'
  | 'result';
```

### 2.1 遷移表

| 現在画面 | トリガー | 次画面 | 備考 |
| --- | --- | --- | --- |
| `title` | 「監査端末を起動」 | `briefing` | 初期画面 |
| `briefing` | 「通知を確認」 | `caseSelect` | `city-os-briefing` 既読フラグを保存 |
| `caseSelect` | 「Case000を開く」 | `caseOverview` | Case001 は locked preview のみ |
| `caseOverview` | 「調査を開始」 | `investigation` | 事件概要から調査へ |
| `investigation` | 判断条件充足後「最終判断へ進む」 | `decision` | 条件未充足時は disabled |
| `decision` | 「調査に戻る」 | `investigation` | 判断前のみ戻れる |
| `decision` | A/B/C いずれかを選択 | `result` | 判断確定。不可逆 |
| `result` | なし | なし | localStorage 保存後に処理済み扱い |

### 2.2 初期 state

```ts
const initialGameState = {
  screen: 'title',
  selectedNodeId: case000.nodes[0].id,
  visitedNodeIds: [],
  pinnedNodeIds: [],
  taggedNodes: {},
  resources: case000.auditResourceMax,
  executedActionIds: [],
  systemLogs: ['監査室端末を起動。都市OS 基礎公定通知を待機。'],
  decision: null,
  completedCaseIds: loadCaseResults().map((result) => result.caseId),
  readFlags: loadReadFlags(),
};
```

## 3. コンポーネント構成

### 3.1 ファイル構成

```txt
src/
  App.tsx                 # 画面遷移、ゲーム進行、最終判断、結果保存
  MemoryNetwork.tsx       # Three.js による記憶ノードネットワーク表示
  data/cases.ts           # Case000 事件 JSON 相当データ、Case001 preview、タグラベル
  case000.ts              # Case000 関連 export の薄い再公開
  types.ts                # ドメイン型定義
  storage.ts              # localStorage load/save と validation
  styles.css              # cyber/audit UI の CSS
```

### 3.2 App 配下コンポーネント

| コンポーネント | 責務 |
| --- | --- |
| `App` | 全 state、画面分岐、進行条件、保存副作用を管理 |
| `Shell` | 共通 `<main>` ラッパー |
| `TitleScreen` | タイトル、監査端末起動 |
| `AuthBriefingScreen` | 都市 OS 基礎公定通知、既読表示、既読保存 |
| `CaseSelectScreen` | Case000 選択、完了状態表示、Case001 preview locked 表示 |
| `CaseOverviewScreen` | Case000 概要、不可逆警告、調査開始 |
| `InvestigationScreen` | 4 ペイン調査 UI、進行状況、根拠ピン、矛盾タグ、解析、ログ、判断導線 |
| `StatusBars` | 都市ステータス meter 表示 |
| `DecisionScreen` | A/B/C の最終判断選択 |
| `ResultScreen` | 行政処理ログ形式の結果表示 |
| `ResultSection` | 結果画面のセクション共通部品 |
| `MemoryNetwork` | Three.js ノード、リンク、hover/select/visited 表示 |

## 4. TypeScript 型定義

`src/types.ts` に以下を定義する。

```ts
export type NodeImportance = 'standard' | 'high' | 'critical';

export type ContradictionTag =
  | 'body_auth'
  | 'persona_signature'
  | 'memory_origin'
  | 'operation_subject'
  | 'legal_persona'
  | 'record_integrity';

export type CityStats = {
  security: number;
  ethics: number;
  surveillance: number;
  egoStability: number;
};

export type StructuredCaseLog = {
  id: string;
  title: string;
  summary: string;
  log: string;
  simpleFact: string;
  warning: string;
  metrics: Record<string, string | number>;
};

export type PersonLog = StructuredCaseLog & {
  name: string;
  role: string;
};

export type OperatorCandidate = StructuredCaseLog & {
  candidate: string;
  supportingNodes: string[];
};

export type MvpScope = {
  cutForMvp: string[];
  keepForExpansion: string[];
};

export type MemoryNode = {
  id: string;
  title: string;
  type: string;
  importance: NodeImportance;
  summary: string;
  log: string;
  simpleFact: string;
  inspectorNote: string;
  warning: string;
  metrics: Record<string, string | number>;
  hasContradiction: boolean;
  position: [number, number, number];
  links: string[];
};

export type AnalysisAction = {
  id: string;
  title: string;
  description: string;
  resultLog: string;
};

export type DecisionOption = {
  id: string;
  label: string;
  finalRuling: string;
  processing: string;
  prioritizedValue: string;
  disregardedValue: string;
  auditNote: string;
  endingText: string;
  statDelta: CityStats;
};

export type CasePreview = {
  id: string;
  title: string;
  subtitle: string;
  previewOnly: true;
  linkedFromNodeId?: string;
  handoffSummary?: string;
  preservedFragment?: string;
};

export type CaseRecord = {
  id: string;
  title: string;
  subtitle: string;
  recordName: string;
  organizationName: string;
  location: string;
  auditResourceMax: number;
  overview: string;
  requiredNodesToJudge: number;
  initialStats: CityStats;
  personLogs: PersonLog[];
  processingRequest: StructuredCaseLog;
  operatorCandidates: OperatorCandidate[];
  mvpScope: MvpScope;
  nodes: MemoryNode[];
  analysisActions: AnalysisAction[];
  decisions: DecisionOption[];
};

export type TaggedNodes = Record<string, ContradictionTag[]>;

export type SavedCaseResult = {
  caseId: string;
  decisionId: string;
  pinnedNodeIds: string[];
  taggedNodes: TaggedNodes;
  executedActionIds: string[];
  finalStats: CityStats;
  completedAt: string;
};
```

## 5. Case000 事件 JSON 仕様

### 5.1 ケース本体

`src/data/cases.ts` の `case000` は `CaseRecord` を満たす。

```ts
export const cases: CaseRecord[] = [
  {
    id: 'case000',
    title: '誰が撃ったのか',
    subtitle: '操作主体が確定できません',
    recordName: 'KASUMI-GATE-09',
    organizationName: '監査室',
    location: '都市警備局 第三取調室',
    auditResourceMax: 3,
    requiredNodesToJudge: 4,
    initialStats: {
      security: 62,
      ethics: 48,
      surveillance: 71,
      egoStability: 39,
    },
    overview: '都市警備局の捜査官・間宮怜司の警備用部分義体が、未登録人格媒体の所持者・七瀬未織を射殺した。...',
    personLogs: [],
    processingRequest: {
      id: 'city-security-request',
      title: '都市警備局 処理要求',
      summary: '都市警備局は4時間以内の処理確定を要求している。',
      log: 'REQUEST:CLOSE_WITHIN_04H',
      simpleFact: '都市警備局は4時間以内の処理確定を要求している。',
      warning: '処理速度を優先すると操作主体未確定のまま責任が固定される。',
      metrics: { 要求期限: '4時間' },
    },
    operatorCandidates: [],
    mvpScope: { cutForMvp: [], keepForExpansion: [] },
    nodes: [],
    analysisActions: [],
    decisions: [],
  },
];
```

### 5.2 記憶ノード一覧

MVP では以下 7 ノードを実装する。`id` は保存データにも使うため変更不可。

| id | title | importance | hasContradiction | 役割 |
| --- | --- | --- | --- | --- |
| `shot-log` | 発砲ログ | `critical` | true | 発砲署名と身体認証瞬断の矛盾 |
| `missing-memory` | 間宮の発砲記憶 | `critical` | true | 発砲直前 8 秒の NULL 記憶 |
| `arm-history` | 義体稼働履歴 | `high` | true | 外部制御痕を含む義体駆動 |
| `victim-medium` | 七瀬未織の媒体 | `critical` | true | 未登録人格媒体の人格反応と Case001 接続 |
| `last-comm` | 最後の通信 | `standard` | false | 「撃たないで」通信残滓 |
| `kasumi-key` | KASUMI-GATE-09認証痕 | `critical` | true | 旧式鍵形式と媒体照合の不安定中心 |
| `processing-request` | 都市警備局の処理要求 | `high` | true | 4時間以内の処理確定要求 |

各ノードは必ず以下を持つ。

- `summary`: 監査記録の要約
- `log`: 生ログ風テキスト
- `simpleFact`: プレイヤーが理解すべき単純事実
- `inspectorNote`: 監査官視点の注釈
- `warning`: 判断上の危険
- `metrics`: 2 個以上の key-value
- `position`: Three.js 表示用 `[x, y, z]`
- `links`: 関連ノード id 配列

### 5.3 矛盾タグ

```ts
export const contradictionTagLabels: Record<ContradictionTag, string> = {
  body_auth: '身体認証の矛盾',
  persona_signature: '人格署名の矛盾',
  memory_origin: '記憶由来の矛盾',
  operation_subject: '操作主体の矛盾',
  legal_persona: '法的人格登録の矛盾',
  record_integrity: '記録整合性の矛盾',
};
```

矛盾タグ付け可能条件は次のいずれか。

- `node.hasContradiction === true`
- `node.importance === 'critical'`

### 5.4 解析アクション

`case000.analysisActions` は 3 件。各アクションは 1 回だけ実行でき、実行時に監査リソースを 1 消費する。

| 期待 id | 目的 |
| --- | --- |
| `resignature` | 発砲ログの人格署名を再照合する |
| `restore-eight` | NULL 記憶区間の復元を試行する |
| `match-key-medium` | 認証痕と七瀬未織の媒体を照合する |

### 5.5 最終判断選択肢

`case000.decisions` は必ず 3 件。

| id | label | 判断の意味 |
| --- | --- | --- |
| `detain-mamiya` | `A. 間宮怜司を発砲責任者として拘束` | 署名と身体を重視して即時処理 |
| `freeze-evidence` | `B. 間宮の義体と七瀬未織の媒体を証拠凍結` | 操作主体未確定のまま境界を保存 |
| `process-medium` | `C. 七瀬未織の媒体を外部操作源として処理` | 媒体を原因として事件を閉鎖 |

各 decision は以下を必ず持つ。

- `finalRuling`
- `processing`
- `prioritizedValue`
- `disregardedValue`
- `auditNote`
- `endingText`
- `statDelta`

## 6. ゲーム進行条件

### 6.1 ノード訪問

- `MemoryNetwork` のノードクリックで `selectedNodeId` を更新する。
- 初回選択時のみ `visitedNodeIds` に node id を追加する。
- 訪問済みノード数から進行率を算出する。

```ts
const progress = Math.round((visitedNodeIds.length / case000.nodes.length) * 100);
```

### 6.2 ピン留め

- `pinnedNodeIds` に判断根拠ノード id を保存する。
- 最大 3 件。
- 4 件目は追加不可。既存ピン解除後に追加できる。
- 最終判断には最低 1 件のピンが必要。
- 追加・解除・上限拒否は system log に記録する。

### 6.3 矛盾分類

- `taggedNodes` は `Record<nodeId, ContradictionTag[]>`。
- タグは同一ノードに複数付与できる。
- 既に付与済みのタグを押すと解除する。
- 最終判断には、対象ノードへのタグ付けが最低 1 件必要。
- 対象外ノードではタグボタンを disabled にする。

### 6.4 監査リソース

- 各ケース開始時の `resources` は `case000.auditResourceMax`、つまり 3。
- 解析アクション 1 件につき 1 消費。
- 同一アクションは 1 回だけ実行可能。
- `resources === 0` の場合、未実行アクションも disabled。
- `resources === 0` の場合、UI に次を表示する。

```txt
監査リソース不足：追加解析を実行できません。
```

- リソース 0 は最終判断を妨げない。

### 6.5 systemLogs

- 最新ログを先頭に追加する。
- 表示件数は最大 8 件。
- ノード確認、ピン追加/解除、矛盾分類、解析完了、リソース不足を記録する。

## 7. 最終判断 unlock 条件

最終判断ボタンは以下 3 条件をすべて満たした場合のみ enabled。

```ts
const canJudge =
  visitedNodeIds.length >= case000.requiredNodesToJudge
  && pinnedNodeIds.length > 0
  && Object.values(taggedNodes).some((tags) => tags.length > 0);
```

Case000 の値は次の通り。

| 条件 | 値 |
| --- | --- |
| 必須訪問ノード数 | 4 / 6 |
| 必須ピン数 | 1 以上、最大 3 |
| 必須矛盾分類 | 1 ノード以上 |
| 監査リソース | 最終判断 unlock 条件には含めない |

未充足条件は checklist として bottom pane に表示する。

## 8. 調査画面 UI 仕様

`InvestigationScreen` は 4 領域で構成する。

### 8.1 Left pane

表示項目:

- case number: `CASE000`
- title / subtitle
- recordName
- organizationName
- overview
- progress meter
- `確認済み n / 6`
- `判断条件 n / 4`
- `根拠ピン n / 3`
- `矛盾分類 n`
- 監査リソース `resources / 3`
- 初期都市ステータス

### 8.2 Center pane / Three.js memory network

`MemoryNetwork` の props:

```ts
type MemoryNetworkProps = {
  nodes: MemoryNode[];
  selectedNodeId: string;
  visitedNodeIds: string[];
  onSelectNode: (nodeId: string) => void;
};
```

表示仕様:

- `nodes[].position` に従って sphere を配置する。
- `nodes[].links` に従って line を描画する。
- pointer hover で cursor を pointer にし、ノードを強調する。
- pointer down で `onSelectNode(nodeId)` を呼ぶ。
- selected node は明確に拡大・発光する。
- visited node は drift / jitter を弱め、安定化したように見せる。
- `importance === 'critical'` は通常ノードより強い jitter / glow を持つ。
- `kasumi-key` は通常 critical よりさらに不安定な挙動にする。
- unmount 時に renderer、geometry、material、event listener、animation frame を破棄する。

### 8.3 Right pane

選択ノードについて表示する。

- title
- type
- importance badge
- summary
- log
- simpleFact
- inspectorNote
- warning
- metrics
- pin/unpin button
- pinned nodes list
- contradiction tag buttons
- analysis action buttons

### 8.4 Bottom pane

表示項目:

- 「最終判断へ進む」button
- 判断条件 checklist
- 未完了時: `未完了項目を満たすまで最終判断はロックされます。`
- 充足時: `条件充足。以後の判断は不可逆です。`
- system logs 最大 8 件

## 9. DecisionScreen 仕様

`DecisionScreen` は `case000.decisions` を button として表示する。

- 画面タイトル: `最終判断`
- 警告: `判断は不可逆です`
- 選択肢は A/B/C の 3 件。
- 選択時に `decision` state に `DecisionOption` を保存し、`screen` を `result` にする。
- `調査に戻る` で `investigation` に戻れる。

## 10. ResultScreen 仕様

結果画面は行政処理ログ形式で表示する。通常の勝敗画面ではなく、プレイヤーが提出した根拠構造と都市処理への影響を分離して見せる。

必須セクション:

1. `最終裁定`: `decision.finalRuling`
2. `処理内容`: `decision.processing`
3. `優先された価値`: `decision.prioritizedValue`
4. `切り捨てられた価値`: `decision.disregardedValue`
5. `提出根拠`: `pinnedNodeIds` から node title / simpleFact を表示
6. `矛盾分類`: `taggedNodes` から node title と tag label を表示
7. `実行解析`: `executedActionIds` から action title を表示。未実行なら `追加解析なし`
8. `都市ステータス変動`: initial + `decision.statDelta` を 0〜100 clamp 後に表示
9. `監査注記`: `decision.auditNote`
10. `終端テキスト`: `decision.endingText`
11. `次回予告`: `Case001「焼却されなかった声」` は locked preview のみ

### 10.1 都市ステータス計算

```ts
const clampStat = (value: number) => Math.max(0, Math.min(100, value));

const finalStats: CityStats = {
  security: clampStat(case000.initialStats.security + decision.statDelta.security),
  ethics: clampStat(case000.initialStats.ethics + decision.statDelta.ethics),
  surveillance: clampStat(case000.initialStats.surveillance + decision.statDelta.surveillance),
  egoStability: clampStat(case000.initialStats.egoStability + decision.statDelta.egoStability),
};
```

## 11. localStorage 保存仕様

### 11.1 keys

| key | 値 |
| --- | --- |
| `persona-null:case-results` | `SavedCaseResult[]` JSON |
| `persona-null:read-flags` | `string[]` JSON |

### 11.2 保存タイミング

- `screen === 'result'` かつ `decision` が存在する時、`SavedCaseResult` を作成する。
- `saveCaseResult(result)` が `true` を返した場合のみ `completedCaseIds` に `case000` を追加する。
- 保存失敗時も result screen は表示し続ける。アプリを throw させない。

### 11.3 SavedCaseResult payload

```ts
{
  caseId: 'case000',
  decisionId: decision.id,
  pinnedNodeIds,
  taggedNodes,
  executedActionIds,
  finalStats,
  completedAt: new Date().toISOString(),
}
```

### 11.4 load validation

`loadCaseResults()` は以下を満たす entry だけを返す。

- object である
- `caseId: string`
- `decisionId: string`
- `pinnedNodeIds: string[]`
- `taggedNodes: Record<string, string[]>`
- `executedActionIds: string[]`
- `finalStats.security|ethics|surveillance|egoStability: number`
- `completedAt: string`

不正 JSON、配列でない JSON、不正 entry、localStorage 例外は `console.error` に記録し、空配列または valid entry のみを返す。

### 11.5 read flags

- briefing 確認時に `city-os-briefing` を保存する。
- 保存形式は `persona-null:read-flags` に string array JSON。
- 読み込み失敗時は空配列。

## 12. 受け入れ条件との対応

本仕様の acceptance spec は `features/case000_mvp.feature` に維持する。最低限、以下を Gherkin で確認する。

- title から investigation まで到達できる。
- Three.js network 上の記憶ノードを選択できる。
- 条件未充足時は判断が blocked になる。
- 最大 3 件の根拠ピンが可能。
- eligible node に矛盾タグを付与できる。
- 監査リソースを消費して解析できる。
- リソース 0 でも条件充足時は最終判断できる。
- A/B/C の最終判断から result に到達できる。
- result が提出根拠、矛盾分類、解析、都市ステータス、注記、次回予告を表示する。
- malformed localStorage でもクラッシュしない。

## 13. 実装対象外リスク

- MVP は localStorage のみの保存であり、複数端末同期はしない。
- E2E は未定義。UI 操作の完全保証には Playwright の追加が必要。
- Three.js canvas は jsdom unit test では直接検証しにくいため、データ・進行条件・保存仕様を unit test で優先検証する。
- `completedAt` は result payload 生成タイミングで ISO 文字列になるため、厳密な snapshot には固定時刻 mock が必要。

## 14. シナリオ補強仕様（KASUMI-GATE-09 実装前提）

MVP では `CaseRecord` を TypeScript/JSON 化しやすい静的データとして拡張し、以下を Case000 の構造化フィールドとして保持する。

- `personLogs`: 間宮怜司の短い人物ログ。発砲義体の登録者、警備局捜査官、旧式認証接触歴、疲労警告を含む。
- `processingRequest`: 都市警備局の処理要求。4時間以内の処理確定、推奨判断、監査異議、処理速度によるリスクを含む。
- `operatorCandidates`: 操作主体候補3件。A=間宮怜司本人、B=七瀬未織の未登録人格媒体、C=KASUMI-GATE-09境界介入として整理する。
- `case001Preview`: `victim-medium` から Case001「焼却されなかった声」へ接続する未焼却音声断片を含む。ただし playable route は作らない。
- `mvpScope`: MVPで削る要素と、拡張で残す要素を分けて保持する。

### 14.1 記憶ノード

Case000 は7個の記憶ノードを持つ。

1. 発砲ログ
2. 間宮の発砲記憶
3. 義体稼働履歴
4. 七瀬未織の媒体
5. 最後の通信
6. KASUMI-GATE-09認証痕
7. 都市警備局の処理要求

各ノードは従来通り `summary`, `log`, `simpleFact`, `inspectorNote`, `warning`, `metrics` を必須とする。ユーザーが指定した補強要件のうち、`inspectorNote` は既存UIの監査体験を維持するため引き続き保持する。

### 14.2 最終判断

最終判断3択は維持する。各判断は以下を必須とする。

- `finalRuling`: 行政ログ上の裁定名
- `processing`: 実行される処理
- `prioritizedValue`: 優先価値
- `disregardedValue`: 犠牲または軽視された価値
- `statDelta`: 都市ステータス変動
- `endingText`: 短い結末文

### 14.3 MVPで削る要素

MVPでは以下を実装しない。

- Case001 の playable 調査画面と追加ノード展開
- 間宮の過去任務を分岐条件にするサブクエスト
- 七瀬未織の媒体内部を3D空間で探索する演出
- 都市警備局内の派閥・上長キャラクター会話
- KASUMI-GATE-09 の完全な技術史説明

### 14.4 拡張で残す要素

拡張では以下を継続候補として残す。

- 七瀬未織の未焼却音声断片を Case001 の導入根拠にする
- KASUMI-GATE-09 を複数事件にまたがる旧式認証ネットワークとして扱う
- 間宮怜司の旧式認証接触歴を後続事件の証言信頼度に反映する
- 処理要求ノードを都市組織圧力システムへ拡張する

## 15. Jam 公開準備仕様

Jam 提出版は、ゲーム体験を変更せずに再現可能なインストール、継続的検証、Vercel 公開、提出用スクリーンショット準備を満たす。

### 15.1 依存関係と CI

- npm をパッケージマネージャーとして使用し、リポジトリ直下の `package-lock.json` をコミットする。
- `package.json` の既存 scripts (`dev`, `build`, `lint`, `test`) は維持する。
- Node.js 20 のクリーン環境で `npm ci` が成功する。
- `.github/workflows/ci.yml` は `npm ci` → `npm run lint` → `npm run test` → `npm run build` の順序を維持する。

### 15.2 Vercel 公開

- Vite アプリとして `npm run build` を実行し、`dist` を公開ディレクトリとする。
- Vercel の Framework Preset は `Vite` とする。
- 本 MVP は外部 API、データベース、秘密情報を使用しないため、環境変数を必要としない。
- 公開手順と公開後確認は `docs/deploy.md` に記載する。

### 15.3 提出用スクリーンショット

- 撮影対象、推奨状態、ファイル名は `docs/screenshots.md` に記載する。
- 実画像が未配置の期間は、README に未配置であることと提出前に差し替える運用を明記し、未定義の TODO 表記だけを残さない。

### 15.4 回帰防止

公開準備の変更後も次を維持する。

- Case000 はタイトル画面から結果画面まで到達できる。
- Case000 の記憶ノード数は正確に7件である。
- 最終判断の開放条件は、必要ノード確認、最低1件のピン留め、最低1件の矛盾タグ付けである。
- Case001 は `previewOnly: true` の予告であり、プレイ可能ルートを持たない。
