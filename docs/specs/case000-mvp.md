# Persona Null MVP Implementation Spec — Case000「誰が撃ったのか」

> **現行範囲について:** 本書は Case000 単独MVPを確定した時点の基礎仕様である。現在の提出版では Case001 もプレイ可能であり、Case001 の可否・画面遷移・保存仕様について本書内の `previewOnly` 記述と競合する場合は [`case001-playable.md`](case001-playable.md) を優先する。

## 0. 確定方針

### 0.1 Case000 用語ルール

- 都市警備局所属の間宮怜司の職名は「捜査官」とする。
- プレイヤーおよび監査室側の人物は「監査官」とする。
- 義体やシステムの制御主体を示す「操作主体」「操作経路」「操作源」は職名ではないため、そのまま使用する。
- 旧職名（「操作」+「官」）は、Case000 関連の実装・仕様・ドキュメントに残さない。

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
  selectedNodeId: null,
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
  auditHint?: string;
  warning: string;
  metrics: Record<string, string | number>;
  hasContradiction: boolean;
  requiresContradictionReview?: boolean;
  suggestedTags?: ContradictionTag[];
  position: [number, number, number];
  links: string[];
};

export type CaseIssue = {
  id: string;
  title: string;
  description: string;
  relatedNodeIds: string[];
};

export type AnalysisUnlockCondition =
  | { type: 'visited_nodes'; nodeIds: string[] }
  | { type: 'pinned_any'; count: number }
  | { type: 'tagged_any'; count: number }
  | { type: 'tagged_node'; nodeId: string };

export type InvestigationActionType =
  | 'scan_persona_signature'
  | 'scan_memory_origin'
  | 'restore_damaged_log'
  | 'compare_nodes';

export type InvestigationAction = {
  id: string;
  type: InvestigationActionType;
  title: string;
  description: string;
  cost: 1;
  resultLog: string;
  targetNodeIds?: string[];
  reportText?: string;
  unlockConditions?: AnalysisUnlockCondition[];
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
  acceptedEvidenceNodeIds?: string[];
  ignoredIssueIds?: string[];
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
  issues: CaseIssue[];
  nodes: MemoryNode[];
  actions: InvestigationAction[];
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
    overview: '都市警備局の捜査官・間宮怜司の警備用部分義体が、未登録人格記録装置の所持者・七瀬未織を射殺した。...',
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
    issues: [],
    nodes: [],
    actions: [],
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
| `victim-medium` | 未登録人格記録装置 | `critical` | true | 発話ログ・記憶断片・人格署名の一部を含む不完全な人格断片 |
| `last-comm` | 最後の通信 | `standard` | false | 「撃たないで」通信残滓 |
| `kasumi-key` | KASUMI-GATE-09認証痕 | `critical` | true | 旧式鍵形式と記録装置照合の不安定中心 |
| `processing-request` | 都市警備局の処理要求 | `high` | false | 矛盾候補ではなく行政圧力を示す4時間以内の処理確定要求 |

各ノードは必ず以下を持つ。

- `summary`: 監査記録の要約
- `log`: 生ログ風テキスト
- `simpleFact`: プレイヤーが理解すべき単純事実
- `inspectorNote`: 監査官視点の注釈
- `warning`: 判断上の危険
- `metrics`: 2 個以上の key-value
- `position`: Three.js 表示用 `[x, y, z]`
- `links`: 関連ノード id 配列

重要ノードは `auditHint` を持ち、右ペインの追加情報内で `照合ヒント` として表示する。文体は答えを断定せず、どの証拠を何と照合すべきかを短く示す。

#### 5.2.A ノード本文の情報設計

- `summary` は一覧性を優先し、従来どおり短文を維持する。
- `simpleFact` は 2〜3 文とし、当該ノードの記録と metrics から確実に確認できる事実だけを記載する。操作主体、人格性、因果関係について未確定の推測を加えない。
- `inspectorNote` は 2〜4 文とし、監査上の注意点、判断を迷わせる補足、次に照合または疑うべき矛盾軸、裁定上の含意を記載する。結論は断定しない。
- `warning` は従来どおり短文とし、詳細説明を重複させない。
- 文体は行政文書、監査ログ、都市OS警告に準じた硬質な記述とし、会話劇や感情の直接描写を避ける。
- `victim-medium` と `last-comm` は、未焼却音声を事件内の証拠として保全する含意を `inspectorNote` で示す。
- 右ペインのノード情報は、ノードタイトル、証拠状態バー、`summary`、`simpleFact`、`inspectorNote`、`warningLevel === "critical"` の場合のみ `warning`、詳細記録、提出根拠、矛盾分類、追加解析、の順に固定する。
- `inspectorNote` は見出し `監査官メモ` とともに `simpleFact` の直下へ常時表示し、空文字など内容がない場合だけセクション自体を表示しない。
- `warning` は `warningLevel === "critical"` かつ空文字でない場合だけ、見出し `警告` とともに `inspectorNote` の下へ表示する。`none` / `notice` では warning テキストが存在しても赤警告パネルを表示しない。
- `log` は見出し `詳細ログ` とともに「詳細記録を表示」内の先頭へ配置し、`metrics`、`auditHint` はその後へ配置する。追加解析結果は詳細記録内へ重複表示せず、追加解析領域の末尾へ配置する。
- `simpleFact` の見出しは `単純事実` とする。

### 5.2.1 争点一覧

`case000.issues` は、調査を監査報告書の争点として組み立てるための一覧である。左ペインでは各争点の `relatedNodeIds` の下に関連ノードをクリック可能に表示する。

| id | title | 関連ノード例 |
| --- | --- | --- |
| `operation_subject` | 発砲操作主体は誰か | `shot-log`, `missing-memory`, `arm-history`, `kasumi-key` |
| `legal_persona` | 七瀬未織の不完全な声を証言として扱うべきか | `victim-medium`, `last-comm`, `kasumi-key` |
| `public_order` | 都市警備局の処理要求を受け入れるか | `processing-request`, `shot-log`, `victim-medium` |

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

`case000.actions` は `scan_persona_signature`、`scan_memory_origin`、`restore_damaged_log`、`compare_nodes` の4種を各1件持つ。各アクションの `cost` は1で、各アクションは 1 回だけ実行でき、解放条件をすべて満たした場合に限り実行時に監査リソースを 1 消費する。未解放アクションは disabled とし、未達条件をチェックリスト表示する。実行済みアクションの `targetNodeIds` に選択ノードが含まれる場合、右ペインへ `reportText` を「追加解析結果」として表示する。

| id | type | 目的 | 解放条件 |
| --- | --- | --- | --- |
| `scan-persona-signature` | `scan_persona_signature` | 人格署名を再照合する | 七瀬未織の記録装置を確認済み、かつ任意の記録を1件以上判断根拠に追加 |
| `scan-memory-origin` | `scan_memory_origin` | 欠落8秒の記憶由来を走査する | 間宮の発砲記憶を確認済み |
| `restore-damaged-log` | `restore_damaged_log` | NULL 記憶区間の復元を試行する | 間宮の発砲記憶と義体稼働履歴を確認済み |
| `compare-key-medium` | `compare_nodes` | 認証痕と七瀬未織の記録装置を照合する | KASUMI-GATE-09認証痕と最後の通信を確認済み |

解放条件は `visited_nodes`、`pinned_any`、`tagged_any`、`tagged_node` を扱い、`isInvestigationActionUnlocked` が `visitedNodeIds`、`pinnedNodeIds`、`taggedNodes` を照合する。

### 5.5 最終判断選択肢

`case000.decisions` は必ず 3 件。

| id | label | 判断の意味 |
| --- | --- | --- |
| `detain-mamiya` | `A. 間宮怜司を発砲責任者として拘束` | 発砲許可署名と義体稼働履歴を根拠に、間宮怜司を責任主体として処理する |
| `freeze-evidence` | `B. 義体と記録装置を証拠保全` | 操作主体を確定せず、右腕義体と七瀬未織の記録装置を凍結して再照合する |
| `process-medium` | `C. 七瀬未織の記録装置を操作干渉源として隔離` | 装置内の人格断片または周辺の未登録反応を、義体操作への干渉源として隔離する |

- A/B/C は内部識別と選択肢先頭の識別記号としてのみ使用し、説明、行政要求、監査注記、結果画面で `Aを選んだ場合`、`AまたはC`、`Cの場合` のように記号だけで参照しない。
- 各カードは `processing` を判断説明として初期表示し、ボタンを見るだけでも処理対象と処理内容が分かる label にする。
- C は七瀬未織本人を発砲主体または犯人として扱わない。隔離対象は記録装置内の人格断片、または装置周辺に接続していた未登録反応である。
- 結果画面の `最終裁定` と裁定結果要約は `finalRuling` の具体的な処理名を省略せず表示し、`選択肢A`、`選択肢C` と表示しない。

各 decision は以下を必ず持つ。

- `finalRuling`
- `processing`
- `prioritizedValue`
- `disregardedValue`
- `auditNote`
- `endingText`
- `statDelta`
- `acceptedEvidenceNodeIds`: 裁定案が採用する記憶ノード id
- `ignoredIssueIds`: 裁定案が無視または保留する争点 id

## 6. ゲーム進行条件

### 6.1 ノード訪問

- `MemoryNetwork` のノードクリックで `selectedNodeId` を更新する。
- `selectedNodeId` の初期値は `null` とし、調査開始だけではノードを確認済みにしない。
- 左ペインの争点別一覧クリックも同じ選択処理を使用する。
- 初回選択時のみ `visitedNodeIds` に node id を追加する。
- 訪問済みノード数から進行率を算出する。

```ts
const progress = Math.round((visitedNodeIds.length / case000.nodes.length) * 100);
```

### 6.2 提出根拠への登録

- UI 文言は `提出根拠に登録` / `根拠提出済` を使用し、内部 state 名は `pinnedNodeIds` のまま判断根拠ノード id を保存する。
- 最大 3 件。
- 4 件目は追加不可。既存ピン解除後に追加できる。
- 最終判断には最低 1 件の提出根拠が必要。
- 追加・解除・上限拒否は system log に記録する。

### 6.3 矛盾分類

- 各 `MemoryNode` は `suggestedTags` に、その記録から分類可能な候補だけを持つ。
- 右ペインは全 `ContradictionTag` を常時表示せず、選択ノードの `suggestedTags` のみをボタン表示する。
- `suggestedTags` が空配列または未定義なら分類ボタンを表示せず、`この記録に分類可能な矛盾は検出されていません` と表示する。
- 分類ハンドラも `suggestedTags` にないタグ登録を拒否する。
- 最終判断には、対象ノードへのタグ付けが最低 1 件必要。
- `requiresContradictionReview` は監査上の分類推奨を表し、Case000 では候補を持つノードに設定する。Memory Network の未分類 halo もこの値を参照する。

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
| 必須訪問ノード数 | 4 / 7 |
| 必須ピン数 | 1 以上、最大 3 |
| 必須矛盾分類 | 1 ノード以上 |
| 監査リソース | 最終判断 unlock 条件には含めない |

未充足条件は checklist として bottom pane に表示する。

## 8. 調査画面 UI 仕様

`InvestigationScreen` は 4 領域で構成する。デスクトップ（幅 900px 以上）では調査画面全体を `100dvh` 以内に固定し、ページ自体をスクロールせず主要な監査操作へアクセスできるようにする。情報量が収まらない場合は各ペイン内だけをスクロール対象とし、4 領域の配置は崩さない。

### 8.1 Left pane

表示項目:

- case number: `CASE000`
- title / subtitle
- recordName
- organizationName
- overview
- progress meter
- `確認済 n / 7`
- `判断条件 n / 4`
- `根拠ピン n / 3`
- `矛盾分類 n`
- 監査リソース `resources / 3`
- 初期都市ステータス
- 全記憶ノードをクリック可能な「記憶ノード一覧」として表示する。
- 一覧では各ノードを `未確認`、`確認済`、`選択中` のいずれかで表示し、`選択中` を最優先する。
- 一覧上部に残り未確認ノード数を表示する。
- 一覧クリックは MemoryNetwork と同じ選択処理を呼び、初回選択時に `visitedNodeIds` へ追加する。

### 8.2 Center pane / Three.js memory network

`MemoryNetwork` の props:

```ts
type MemoryNetworkProps = {
  nodes: MemoryNode[];
  selectedNodeId: string | null;
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
- importance は固定色で識別する。`standard` は cyan、`high` は amber、`critical` は red/pink とする。
- importance 凡例をネットワーク上に常時表示し、色だけに依存せずテキストラベルも併記する。
- `critical` を jitter、点滅、位置ノイズなどの不安定な動きで表現しない。選択・hover は importance に関係なく同じ拡大・発光規則を使う。
- 未確認状態は通常より少し強い発光、確認済状態は見失わない範囲で弱い発光にし、importance の色を変えずに区別する。
- selected 状態は未確認・確認済より優先し、従来どおり明確に拡大・発光する。
- unmount 時に renderer、geometry、material、event listener、animation frame を破棄する。

### 8.3 Right pane

`selectedNodeId === null` の場合は、記憶ノードを選択する案内、左の争点別一覧または Memory Network から開けること、初回確認で記録状態が確認済みに変わることを表示する。選択後は選択ノードについて表示する。

- title
- 証拠状態バー: 記録状態 (`確認済` または `未確認`)、`記録種別：${type}`、importance、提出根拠、矛盾分類
- summary
- simpleFact
- inspectorNote（空文字なら非表示）
- warning（`warningLevel === "critical"` かつ warning が空でない場合のみ赤警告として表示）
- 詳細記録: log、metrics、auditHint
- pin/unpin button と pinned nodes list
- 選択ノードの suggestedTags に対応する contradiction tag buttons
- analysis action buttons
- 選択ノードを対象とする実行済み解析の `reportText`（見出し: `追加解析結果`、追加解析領域の末尾に表示）

状態バーは解析結果の有無を重複表示せず、判断に直結する状態だけを短いチップで示す。操作フィードバックは 1.5 秒以内に消え、画面上端中央に表示して Memory Network、右ペイン、最終判断ボタンを覆わない。

### 8.4 Bottom pane

表示項目:

- 「最終判断へ進む」button
- 判断条件 checklist
- 未完了時: `未完了項目を満たすまで最終判断はロックされます。`
- 充足時: `条件充足。以後の判断は不可逆です。`
- system logs 最大 8 件

## 9. DecisionScreen 仕様

`DecisionScreen` は `case000.decisions` を裁定案カードとして表示し、各カード内の確定 button から選択する。

- 画面タイトル: `最終判断`
- 警告: 判断が不可逆であることを行政監査端末文言で示す。
- 選択肢は3件。各 label は識別記号に続けて、対象と処理を省略せず表示する。
- 各カードは label に加えて、`processing` の判断説明を初期表示する。
- 各裁定案は `acceptedEvidenceNodeIds` から採用される根拠を表示し、現在の `pinnedNodeIds` に含まれる根拠は `根拠提出済` として示す。
- 各裁定案は `ignoredIssueIds` から無視または保留される疑点を表示する。
- 各裁定案は `statDelta` から都市ステータスへの影響を表示する。
- `acceptedEvidenceNodeIds` が1件以上あり、現在の `pinnedNodeIds` との一致数が 0 件の場合、現在の提出根拠と一致せず未提出記録を採用しようとしている旨を警告する。ただし価値判断を妨げないため確定 button は disabled にしない。
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

不正 JSON は `console.error` に記録して `persona-null:case-results` を削除し、空配列を返す。配列でない JSON、不正 entry、localStorage 例外は `console.error` に記録し、空配列または valid entry のみを返す。

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

- `personLogs`: 間宮怜司と七瀬未織の人物プロファイル。監査画像パス、画像代替テキスト、監査ラベル、人物別 fallback を含む。
- `processingRequest`: 都市警備局の処理要求。4時間以内の処理確定、推奨判断、監査異議、処理速度によるリスクを含む。
- `operatorCandidates`: 操作主体候補3件。A=間宮怜司本人、B=七瀬未織の未登録人格記録装置、C=KASUMI-GATE-09境界介入として整理する。
- `case001Preview`: Case000 の記憶ノードや解析本文から独立した locked preview として保持し、playable route は作らない。
- `mvpScope`: MVPで削る要素と、拡張で残す要素を分けて保持する。

### 14.1 記憶ノード

Case000 は7個の記憶ノードを持つ。

1. 発砲ログ
2. 間宮の発砲記憶
3. 義体稼働履歴
4. 七瀬未織の記録装置
5. 最後の通信
6. KASUMI-GATE-09認証痕
7. 都市警備局の処理要求

各ノードは従来通り `summary`, `log`, `simpleFact`, `inspectorNote`, `warning`, `metrics` を必須とする。ユーザーが指定した補強要件のうち、`inspectorNote` は既存UIの監査体験を維持するため引き続き保持する。

#### 14.1.1 監査文面の可読性

- `log` は時刻・状態・主体を短く並べる硬質な記録文とし、英字キーだけに依存しない。
- `simpleFact` は1文1事実を基本とし、2文から3文で「何が起きたか」を示す。推測や裁定誘導は混ぜない。
- `inspectorNote` は2文から4文で、断定できない点、次に照合する記録、裁定時のリスクを示す。
- 「人格署名」「法的人格」「公定値」「記憶由来」「操作経路」「操作源」などの用語を使う場合は、同じ文または直後の文で短く意味を説明する。
- 事件概要、最終判断ボタン、結果画面の監査注記も短文で記述し、判断に関係しない技術史や設定説明は含めない。
- 冷たい行政ログ／監査端末の語調は維持するが、抽象語や専門用語を一文に重ねない。

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
- 七瀬未織の記録装置内部を3D空間で探索する演出
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
- README は `docs/images/title.svg`、`docs/images/case000-overview.svg`、`docs/images/case000-investigation.svg` の Production 実画像と短いキャプションを掲載する。
- 画像差し替え時も同じファイル名を維持し、事件説明から根拠構造の探索へ進む体験が伝わる構図にする。

### 15.4 公開 URL と Production 確認の責務

- README 上部の `Demo / Play URL` 欄は、確定済みの `https://persona-null.vercel.app` を示す。
- README は作品概要、遊び方、実装／未実装範囲、技術構成、公開 URL の入口を担当し、Production 確認手順を重複掲載しない。
- `docs/deploy.md` は Vercel 設定と Production 動作確認の正本とする。
- `docs/jam-submission.md` は Jam 提出物、公開 URL、スクリーンショット、CI、Production 確認済みであることを確認する最終チェックリストとする。
- PC ブラウザを推奨環境としつつ、幅 899px 以下では主要ペインを1列化し、幅 520px 以下では見出し、ボタン、キャプション、ログのテキストが横方向にはみ出さず読めることを最低条件とする。

### 15.5 回帰防止

公開準備の変更後も次を維持する。

- Case000 はタイトル画面から結果画面まで到達できる。
- Case000 の記憶ノード数は正確に7件である。
- 最終判断の開放条件は、必要ノード確認、最低1件の提出根拠登録、最低1件の矛盾タグ付けである。
- Case001 は `previewOnly: true` の予告であり、プレイ可能ルートを持たない。

## 16. 記録復元演出と用語注釈

- 認証通知の主要説明、選択中ノードの監査記録・監査官注、最新システムログ、結果の結末文だけを軽量なタイピング表示にする。事件概要全文や履歴ログ全件には適用しない。
- タイピング速度は 12〜20ms を基準とし、選択ノード変更時は対象テキストを先頭から再生する。
- タイピング中も全文相当の表示領域を確保し、クリックまたは「全文表示」で復元を完了できる。
- `prefers-reduced-motion: reduce` ではタイピングとカーソル点滅を行わず、全文を即時表示する。
- Case000本文中の義体、認証、操作主体、法的人格、組織・人物などの登録語を注釈対象にする。長い別名を優先して一致させ、HTML文字列の挿入は行わない。
- 注釈はマウスホバー、キーボードフォーカス、クリックまたはタップで確認できる。ツールチップは暗い監査UIに合わせ、狭い画面でも画面幅を超えにくい寸法にする。
- 表示演出はCase000の7ノード、3判断、判断解放条件、Case001のpreviewOnly状態、localStorage保存形式を変更しない。

## 17. 調査操作ガイダンス

調査画面は既存の判断条件を変更せず、初回監査官が次の操作を常に把握できる導線を追加する。

- 左ペインの「次の監査手順」は、`記憶ノード確認 → 提出根拠の登録 → 矛盾分類 → 最終判断` の優先順で未完了操作を1件案内する。
- 監査リソースによる追加解析は任意操作であり、最終判断の解除条件には追加しない。残数だけを補助情報として示す。
- 右ペインは選択ノードについて、確認済み状態、提出根拠への登録可否、矛盾分類対象、または判断条件完了を短い行政端末文言で示す。
- bottom pane は「最終判断まで」とし、完了・未完了を責めない進行チェックリストとして表示する。
- Memory Network は未確認ノードを通常発光、確認済みノードを減光、選択中ノードを強調する。矛盾対象かつ未分類のノードは halo を少し濃くする。
- 点滅、位置ノイズ、過剰な追加アニメーションは使用しない。

## 18. 争点別監査報告書体験

調査画面は単なる時系列ログ閲覧ではなく、最終裁定へ提出する監査報告書の構造を組み立てる画面として扱う。

- 左ペインは `case000.issues` の順に争点を表示し、各争点の説明と関連ノードを同じ区画内に置く。
- 関連ノードはクリック可能で、`未確認` / `確認済` / `選択中` / `根拠提出済` / `矛盾分類済` の状態バッジを表示する。同一ノードが複数争点に関係する場合は各争点に再掲してよい。
- 各争点には関連ノードの確認数と提出根拠数を併記し、監査報告書としてどの争点が調査済みかを一覧で比較できるようにする。
- 右ペインは重要ノードの `auditHint` を `監査官メモ` 見出しで表示し、操作主体や法的人格を断定せず、追加照合が必要な境界を示す。
- 根拠登録 UI は `提出根拠に登録`、登録済み状態は `根拠提出済` と表記する。内部 state と保存形式の `pinnedNodeIds` は変更しない。
- bottom pane の判断条件見出しは `最終判断まで` とする。
- 最終判断画面は、裁定案ごとに `採用される根拠`、`無視または保留される疑点`、`都市ステータスへの影響` を裁定確定前に表示する。
- 採用される根拠がプレイヤーの `pinnedNodeIds` に含まれる場合は `根拠提出済`、含まれない場合は `未提出` と示し、提出根拠と裁定案の接続を可視化する。
- 裁定案ごとに採用根拠のうち何件が提出済みかを `提出根拠との一致 n / m` で集計し、裁定確定前に根拠不足を比較できるようにする。
- 争点表示と裁定案表示は既存の訪問数、矛盾分類候補、解析ロック、監査リソース、最大3件制限、保存形式、Case001 previewOnly を変更しない。

## 19. 行政監査端末ビジュアルと Memory Network 状態表現

重要度の意味は既存の `standard / high / critical` カラーだけに保持し、監査状態を新しい塗り色で表現しない。状態はノード外周のリング、フレーム、halo、発光強度、中央ペイン上の HTML ラベルで重ねて示す。

- 未確認ノードは重要度色の通常発光と外周 wireframe を保つ。
- 確認済ノードは発光を弱めるが、輪郭とリンクから見失わない濃度を維持する。
- 選択中ノードは同心の二重リングで示す。
- 根拠提出済ノードは角ばった証拠フレームで囲む。
- 矛盾分類対象かつ未分類のノードは、点滅しない強い警告 halo で示す。
- 矛盾分類済ノードは閉じた細いリングで示す。
- 実行済み解析の対象ノードは、細い解析マーカーを追加する。
- hover または選択中ノードについて、タイトル、記録種別、重要度、確認状態、根拠提出、矛盾分類、解析結果の有無を中央ペイン内の HTML overlay に表示する。
- 背景には薄いグリッド、遠景微粒子、弱いスキャンライン、低速の一方向性揺らぎを置く。激しい点滅、ジッター、位置ノイズは使用せず、`prefers-reduced-motion` を尊重する。
- UI パネルは細い罫線、角欠け形状、低彩度の青白い文字を基調とし、赤系は警告・不可逆処理に限定する。操作ボタンは情報表示より明確な境界と hover/focus 状態を持つ。
- 結果画面は `decision.id` に応じて「発砲責任拘束」「証拠保全」「操作干渉源隔離」の半透明な裁定印を表示する。
- この視覚強化は Case000 の7ノード、争点一覧、進行条件、監査リソース、保存形式、TypewriterText、AnnotatedText、Case001 previewOnly を変更しない。

## 12. 調査画面の情報階層

初見プレイヤーが次の操作と選択中記録の核心を優先して読めるよう、既存情報は削除せず、初期表示と展開表示に分ける。

### 12.1 初期表示

- 左ペインは Case000 タイトル、次の監査手順、確認・提出根拠・矛盾分類の最小進捗、争点別の記憶ノード一覧を表示する。
- 争点別一覧は争点名、ノード名、各ノードの状態バッジを表示する。
- 右ペインは選択ノードのタイトル、記録状態、記録種別、重要度、`simpleFact`、`warning`、提出根拠操作を表示する。矛盾分類操作は `suggestedTags` があるノードだけ表示する。
- 解析欄は実行可能状態と監査リソース残数だけ表示する。
- 下部ペインは最終判断の開放状態、最短の不足条件、最新システムログ1件だけ表示する。
- 最終判断の裁定カードは裁定名、優先される価値、軽視される価値、都市ステータス変動、確定操作を表示する。

### 12.2 展開表示

- 左ペインの事件概要、初期都市ステータス、監査リソース説明は「事件・監査情報を表示」に格納する。
- 争点の説明、確認数、根拠数は各争点の「争点詳細を表示」に格納する。
- ノードの `summary`、raw log、`inspectorNote`、`auditHint`、`metrics`、追加解析結果は「詳細記録を表示」に格納する。
- 解析アクションと未解放条件は「解析メニューを表示」に格納する。
- 全システムログは「ログを表示」に格納する。
- 通常のノード確認、根拠登録、矛盾分類、解析完了は通常色で表示し、赤い警告ログは登録上限、未解放操作、監査リソース枯渇など操作を阻害する重要事象だけに限定する。ログ本文に「矛盾」や「不足」という語が含まれるだけでは警告扱いにしない。
- 採用される根拠、提出根拠との一致、無視または保留される疑点は「裁定詳細を表示」に格納する。

`TypewriterText`、`AnnotatedText`、ノード既読、提出根拠、矛盾分類、解析解放条件、監査リソース、最終判断条件、保存形式には変更を加えない。

## 14. 監査端末ビジュアル整理

- アプリ全体は `app-shell` で包み、暗い都市OS背景、弱い青緑の radial gradient、低コントラストの scanline を共通表示する。
- 調査画面の左右ペインと下部バーは、半透明パネル、1px 境界、blur、角丸、弱い青緑の影を持つ監査カードとする。
- 右ペインは既存の情報順を維持し、`単純事実`、`監査官メモ` をカード化する。`警告` は `warningLevel === "critical"` かつ警告本文が空でないノードだけに表示する。`importance` や `hasContradiction` は赤警告の表示条件に使用しない。色は順に cyan、green、red の左罫線を使い、赤い発光は警告だけに限定する。
- ノードの `log`、`inspectorNote`、`warning`、解析結果には、後続コンテンツ名、制作範囲、遊び手やシナリオ構造を示すメタ文言を含めず、事件内で確認できる事実と監査上の影響だけを記載する。
- 都市ステータス、監査リソース、既読数は compact chip として表示し、通常は muted、valid は green、warning / critical は red 系で区別する。
- 監査ログは古い記録から新しい記録へ下方向に蓄積し、warning 系だけ赤で表示する。
- Three.js の事件データ構造と座標は変更しない。未読、既読、選択、矛盾、critical を材質の明度・彩度・外周リングで区別し、接続線は弱い cyan とする。
- `prefers-reduced-motion` が有効な場合、未読の明滅、矛盾の揺らぎ、背景の走査表現を停止または静止表示する。

## 12. Case000 人物監査画像

- 事件概要の人物プロファイル欄は、間宮怜司と七瀬未織の2件を表示する。
- `PersonLog` は任意の `portrait`、`portraitAlt`、`auditLabel`、`auditLabels`、`portraitFallback` を保持できる。
- 間宮怜司の画像パスは `/assets/case000/mamiya-reiji-profile.svg`、七瀬未織の画像パスは `/assets/case000/nanase-miori-fragment.svg` とする。
- portrait が設定された人物のみ、16:9 の小型監査画像カードを表示する。
- 画像読込に失敗した場合は、人物ごとに定義した監査端末風 fallback へ置き換え、壊れた画像アイコンは残さない。
- 画像は `object-fit: cover` と中央寄せを基本とし、人物ごとの代替テキストを必須とする。
- 画像カード下には短い監査ラベルを表示する。
- 狭幅では画像を上、人物情報を下に積み、既存のCase000進行、判断条件、保存仕様には影響させない。
- 提供された男性画像を間宮怜司、女性画像を七瀬未織として、上記パスへ配置する。
- コードレビュー環境がバイナリ差分を扱えないため、提供PNGは表示内容を保持した base64 埋め込みSVGとして管理し、画像資産自体をテキスト差分として扱えるようにする。
- 人物名と画像の対応を入れ替えない。生成用プロンプトは将来の再生成・差し替え資料として `docs/image-prompts/` に保管する。

## 15. 七瀬未織の記録装置と Case001 の証言テーマ

### 15.1 用語

- プレイヤー向け表示では `未登録人格記録装置` を正式名称とする。
- 初出時に「都市OSに登録されていない小型記録装置」と説明する。
- 七瀬未織に紐づけて短く示す場合は `七瀬未織の記録装置` とする。
- 雰囲気を優先する文章では `未登録人格媒体` を使用してよいが、正式名称と機能を先に説明した後に限る。
- 意味を補わず `媒体` を単独の対象名としてプレイヤー向け表示に使用しない。

### 15.2 記録内容と認証上の制約

- 未登録人格記録装置には、七瀬未織の発話ログ、記憶断片、人格署名の一部だけが残る。
- 七瀬未織本人または完全な人格バックアップが保存されているとは表現しない。
- 都市OSは装置内の人格断片を七瀬未織本人と認証できず、記憶連続性も断片的なため、証言能力を `制限` とする。
- 装置は削除処理に対して自己保存反応を返すため、単なる破損データとも断定できない。
- 主要メトリクスは `人格署名一致率: 49%`、`記憶連続性: 断片的`、`法的人格ステータス: 未確定`、`証言能力: 制限` とする。

### 15.3 Case001 preview

- Case001 の問いは「装置が七瀬未織本人か」ではなく、「不完全な声を証言として扱えるか」とする。
- preview は七瀬未織の身体が死亡し、完全な人格バックアップが確認されていないことを明示する。
- そのうえで、装置に残った声と記憶断片を都市OSが正式な証言として扱えないこと、装置が「私は、見ていました」を反復していることを示す。
- Case001 は引き続き `previewOnly: true` とし、プレイ可能ルートを追加しない。

## 20. Production 公開資料

Jam 提出版の公開資料は、実際に公開されている画面と探索体験を正確に示す。

- Production URL は `https://persona-null.vercel.app` とし、README、提出チェック、公開手順で同じURLを参照する。
- README の必須スクリーンショットは、Production 版から撮影した `title`、`caseOverview`、`investigation` の3画面とする。
- コードレビュー環境へバイナリ差分を持ち込まないため、3画面は元PNGの表示内容と寸法を保持した base64 埋め込みSVGとして `docs/images/*.svg` に保存する。
- 元の `.png` ファイルはコミットせず、README、撮影手順、提出チェック、回帰テストは `.svg` の正本だけを参照する。
- `caseOverview` は事件概要、人物プロフィール、処理要求を示し、`investigation` は争点別記憶ノード、Memory Network、選択ノード要約、判断条件を示す。
- スクリーンショットは回答文だけで完結する印象を避け、事件説明から根拠構造の探索へ進む二層体験が伝わる構成にする。
- 結果画面は追加推奨カットとしてよいが、実画像がない状態で README の必須画像として参照しない。
- URL と画像の更新は公開資料だけに限定し、Case000 の進行条件、保存形式、7ノード、3判断、Case001 の `previewOnly` 制約を変更しない。

## 20. 記憶ノードの警告レベルと提出用文面

- `MemoryNode.warning` は監査上の注記本文を保持し、赤い警告欄として表示するかどうかは `warningLevel` で独立して指定する。
- `warningLevel` は `none / notice / critical` とし、`.node-warning` は `critical` かつ警告本文が空でない場合だけ表示する。
- `none` または `notice` のノードは警告本文を保持していても赤い警告欄を表示しない。これにより、後続事件の追加時にも文字列の有無だけで赤警告が再発しないようにする。
- Case000 では `last-comm` と `processing-request` を `none` とし、赤い警告が必要な証拠ノードだけを `critical` とする。
- 人物ログ、操作主体候補、行政処理要求にある `warning` は現時点では構造化された監査注記であり、Memory Network の赤警告契約には含めない。将来 `caution` / `note` に分離する。
- 調査画面に表示する事件本文には、制作工程や公開計画を示す `Case001 / MVP / Jam / プレイヤー / 予告 / 本編` を含めない。

## 21. 公開ページ用コピー

README と itch.io の公開ページでは、作品世界の導入だけでなく、プレイヤーが行う操作と実装範囲を短時間で判断できる文面を用意する。

- 公開コピーの正本は `docs/itch-page.md` とし、itch.io の short description、本文、スクリーンショット説明へそのまま転記できる構成にする。
- short description は一段落で、都市OSが確定できない事件、記憶ネットワークの探索、監査判断という3要素を含める。
- itch.io 本文は、作品のフック、プレイヤーの行動、Case000 の問い、操作方法、プレイ可能範囲、推奨環境、Production URL を見出しで分ける。
- 公開文面では、単に回答を読む作品ではなく、記録同士の接続、根拠、矛盾、監査状態を探索して判断を組み立てる体験だと説明する。
- スクリーンショット説明は `title`、`caseOverview`、`investigation` の各画像について、画面に写る情報と体験上の役割を1〜2文で示す。
- `investigation` の説明では Memory Network、7つの記憶ノード、根拠登録、矛盾分類のうち複数を明示し、中核操作が画像だけに依存しないようにする。
- Case000 のみがプレイ可能であり、Case001 は予告のみであることを README と itch.io 本文の双方に明記する。
- 音演出、Case001 本編、完全なスマートフォン最適化など、未実装の機能を示唆しない。
- cyber な世界観語彙は使用してよいが、固有名詞だけで操作説明を置き換えず、初見の読者がゲーム内容を理解できる可読性を優先する。
- 公開コピーの整備は文書変更に限定し、Case000 の進行条件、保存形式、データ構造、画面実装を変更しない。

## 22. 公開文面の人物・所有関係

- 発砲した義体は、間宮怜司に登録された都市警備局の警備用右腕部分義体とする。
- 七瀬未織は発砲事件の被害者であり、未登録人格記録装置は七瀬未織の所持品から発見されたものとする。
- README、itch.io 紹介文、提出資料では、発砲義体を七瀬未織の所有物または登録義体として説明しない。
- 公開文面の修正は、Case000 の7ノード、`requiredNodesToJudge`、`warningLevel`、localStorage 保存形式、Case001 の `previewOnly` 状態を変更しない。

## 12. 公開用 MVP の情報設計

### 12.1 調査画面の優先順位

- デスクトップでは Memory Network を補助的な探索面として扱い、選択記録を読む右ペインより広くしない。
- Memory Network の操作説明と凡例は canvas の外側に置き、ノードと重ねない。
- 未読、既読、重要、矛盾、選択中、提出済みを色だけに依存せず、ラベルまたは形状でも識別できるようにする。
- 右ペインは「選択中ノード」「提出根拠・矛盾分類」「都市ステータス」を先に表示し、詳細ログと追加解析は折りたたむ。
- 赤い警告パネルは `warningLevel === "critical"` かつ警告本文が空でない記録だけに表示する。`importance` が `high` / `critical` であることや、矛盾を持つことだけでは表示しない。

### 12.2 最終判断への導線

- 判断コンソールは次の3条件を常時表示する。
  - 必要ノード確認：現在数 / 4
  - 判断根拠：現在数 / 1
  - 矛盾分類：現在数 / 1
- 未達成条件には「未達成」、達成条件には「完了」を表示する。
- 全条件達成時は判断ボタンのラベル、色、状態表示を同時に `JUDGMENT READY` 相当に変える。

### 12.3 結果画面

- 冒頭要約は行政用語だけでなく、`救った価値（優先）` と `犠牲にした価値（軽視）` を対で表示し、裁定のトレードオフを初見でも読み取れるようにする。
- 提出根拠、分類した矛盾、都市ステータス変動、結末文は既存の保存 payload から表示し、新しい永続化項目は追加しない。

- 結果冒頭で、最終裁定、優先された価値、軽視された価値を一続きの要約として確認できる。
- 提出された判断根拠と分類された矛盾は、プレイヤーが行った操作だけを記録する。
- 都市ステータスは変更前、変更後、差分を同じ行に表示する。
- 結末文は短く独立表示し、判断によって残った余韻を示す。

## 23. 公開直前の情報階層

- 調査画面の次手案内は、未確認ノード、提出根拠、矛盾分類、最終判断の順で、画面上に存在する日本語ラベルを直接示す。色や `halo` などの視覚表現だけを操作指示にしない。
- PCブラウザでは Memory Network の選択記録ラベルを描画領域の外に配置し、ノード、接続線、説明文、凡例を覆わない。中央ペインは証拠詳細と判断操作より大きくしない。
- ノード詳細の本文順は「単純事実 → 監査官メモ → critical 警告 → 詳細ログ」を維持する。`none` / `notice` の警告本文は赤い警告枠へ昇格させない。
- 結果画面の上部要約を、裁定、救った価値、犠牲にした価値、都市ステータス変動の正本とする。詳細欄では同じ裁定名と価値分類を繰り返さず、処理内容、提出根拠、矛盾分類、解析履歴、都市ステータス、監査注記、結末文を表示する。

## 24. Visual refinement: intelligent cyber audit terminal

- The audit UI should present a smarter cybernetic terminal mood inspired by high-density city-OS interfaces while preserving readability and the two-layer answer/evidence-map experience.
- Panels, case files, decision cards, and memory records may use subtle glass, angled corner, circuit-line, and scanline treatments, but text contrast and action hierarchy must remain primary.
- The Memory Network should feel like an active intelligence graph by adding restrained depth, glow, status-label, and hover/selection feedback without obscuring node state semantics.
- Motion and shimmer must remain non-essential and respect `prefers-reduced-motion`.
- This refinement is visual only: no schema changes, no public API changes, no dependency additions, and no change to the OpenAI-centered three-stage pipeline assumptions.
