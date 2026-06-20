import { describe, expect, it } from 'vitest';
import { canUnlockJudgment, getCurrentGuidance, getJudgmentRequirements, isInvestigationActionUnlocked, isWarningLog } from './auditRules';
import { case000, case001, contradictionTags } from './data/cases';
import type { DecisionOption } from './types';

const terminologyFiles = import.meta.glob(
  ['../README.md', '../docs/**/*.md', '../docs/images/*.svg', '../features/**/*.feature', './**/*.{ts,tsx}'],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>;

const resultScreenFields: (keyof DecisionOption)[] = [
  'finalRuling',
  'processing',
  'prioritizedValues',
  'sacrificedValues',
  'auditNote',
  'endingText',
];

describe('case001 playable data', () => {
  it('defines a complete case without production meta text', () => {
    expect(case001.nodes).toHaveLength(7);
    expect(case001.issues).toHaveLength(3);
    expect(case001.actions).toHaveLength(3);
    expect(case001.decisions).toHaveLength(3);
    expect(case001.requiredNodesToJudge).toBe(4);
    expect(case001.decisions.map((decision) => decision.statDelta)).toEqual([
      { security: 6, ethics: -10, surveillance: 3, egoStability: -5 },
      { security: -3, ethics: 8, surveillance: 2, egoStability: 6 },
      { security: 4, ethics: -6, surveillance: 8, egoStability: -3 },
    ]);
    const playableText = JSON.stringify(case001);
    ['previewOnly', 'プレイヤー', 'Case002に続く'].forEach((term) => expect(playableText).not.toContain(term));
  });

  it('defines what the repeated voice witnessed without identifying the command source', () => {
    const voice = case001.nodes.find((node) => node.id === 'repeated-voice');
    const fragment = case001.nodes.find((node) => node.id === 'fragment-memory');
    const reconstruction = case001.actions.find((action) => action.id === 'reconstruct-fragment');

    expect(voice?.simpleFact).toContain('犯人の顔ではなく');
    expect(voice?.simpleFact).toContain('通常認証から KASUMI-GATE-09 へ切り替わり');
    expect(voice?.simpleFact).toContain('人格署名として偽装処理された瞬間');
    expect(fragment?.simpleFact).toContain('右腕義体は発砲動作に入った');
    expect(fragment?.simpleFact).toContain('表情・視線・生体反応に発砲意図は記録されていない');
    expect(fragment?.simpleFact).toContain('発砲命令は間宮怜司の人格署名で処理');
    expect(fragment?.inspectorNote).toContain('間宮の右腕義体が発砲した事実');
    expect(fragment?.inspectorNote).toContain('間宮本人が発砲しようとしていなかった兆候');
    expect(fragment?.inspectorNote).toContain('発砲命令の偽装処理');
    expect(fragment?.metrics).toMatchObject({
      制御表示: '通常認証 → KASUMI-GATE-09',
      発砲意図反応: '検出なし',
      命令署名: '間宮怜司',
      命令元: '未確定',
    });
    expect(fragment?.warning).toContain('発行元と実行主体は断片内に記録されていない');
    expect(reconstruction?.reportText).toContain('命令元は未確定');
  });
});

describe('audit log severity', () => {
  it('reserves warning styling for blocking operations instead of matching incidental words', () => {
    expect(isWarningLog('矛盾分類登録：義体稼働履歴 / 身体認証の矛盾。')).toBe(false);
    expect(isWarningLog('解析完了：署名一致率は改善せず。責任確定には不足。')).toBe(false);
    expect(isWarningLog('提出根拠上限：3件を超える登録は拒否。')).toBe(true);
    expect(isWarningLog('解析権限未解放：人格署名を再照合。必要記録を確認してください。')).toBe(true);
    expect(isWarningLog('監査リソース不足：追加解析を実行できません。')).toBe(true);
  });
});

describe('case000 data', () => {
  it('contains exactly seven playable MVP memory nodes', () => {
    expect(case000.nodes).toHaveLength(7);
    expect(case000.nodes.map((node) => node.title)).toEqual([
      '発砲ログ',
      '間宮の発砲記憶',
      '義体稼働履歴',
      '未登録人格記録装置',
      '最後の通信',
      'KASUMI-GATE-09認証痕',
      '都市警備局の処理要求',
    ]);
    expect(case000.requiredNodesToJudge).toBeLessThanOrEqual(case000.nodes.length);
    expect(case000.nodes.every((node) => node.title && node.summary && node.log && node.simpleFact && node.inspectorNote && typeof node.warning === 'string' && Object.keys(node.metrics).length > 0)).toBe(true);
  });

  it('contains strengthened scenario scaffolding for implementation', () => {
    expect(case000.personLogs).toHaveLength(2);
    expect(case000.personLogs.map((person) => person.name)).toEqual(['間宮怜司', '七瀬未織']);
    expect(case000.personLogs[0].role).toContain('都市警備局 捜査官');
    expect(case000.personLogs.map(({ portrait, portraitAlt }) => ({ portrait, portraitAlt }))).toEqual([
      {
        portrait: '/assets/case000/mamiya-reiji-profile.svg',
        portraitAlt: '間宮怜司 監査記録ポートレート',
      },
      {
        portrait: '/assets/case000/nanase-miori-fragment.svg',
        portraitAlt: '七瀬未織 人格断片プロファイル',
      },
    ]);
    expect(case000.personLogs[0].portraitFallback?.lines).toContain('操作主体：未確定');
    expect(case000.personLogs[1].portraitFallback?.lines).toContain('証言能力：制限');
    expect(case000.processingRequest.id).toBe('city-security-request');
    expect(case000.operatorCandidates.map((candidate) => candidate.candidate)).toEqual([
      '間宮怜司本人',
      '七瀬未織の未登録人格記録装置',
      '旧式認証痕による境界介入',
    ]);
    expect(case000.mvpScope.cutForMvp.length).toBeGreaterThan(0);
    expect(case000.mvpScope.keepForExpansion.length).toBeGreaterThan(0);
  });

  it('defines the recorder without implying a complete Nanase Miori backup', () => {
    const victimRecorder = case000.nodes.find((node) => node.id === 'victim-medium');
    const playerFacingScenario = JSON.stringify({ case000, case001 });

    expect(case000.overview).toContain('都市OSに登録されていない小型の未登録人格記録装置');
    expect(case000.overview).toContain('完全な人格バックアップではない');
    expect(victimRecorder?.summary).toContain('発話ログ、記憶断片、人格署名の一部');
    expect(victimRecorder?.simpleFact).toContain('七瀬未織本人とは認証できない');
    expect(victimRecorder?.warning).toBe('削除処理に対する自己保存反応を検出。');
    expect(case000.nodes.find((node) => node.id === 'last-comm')).toMatchObject({
      warning: '送信者と受信者は未確定。',
      warningLevel: 'none',
    });
    expect(case000.nodes.find((node) => node.id === 'processing-request')).toMatchObject({
      warning: '行政処理期限による判断圧力。',
      warningLevel: 'none',
    });
    expect(victimRecorder?.metrics).toMatchObject({
      人格署名一致率: '49%',
      記憶連続性: '断片的',
      法的人格ステータス: '未確定',
      証言能力: '制限',
    });
    expect(case000.issues.find((issue) => issue.id === 'legal_persona')?.title).toContain('不完全な声を証言として扱う');
    expect(case001.subtitle).toBe('不完全な声を証言として扱えるか');
    expect(case001.nodes.find((node) => node.id === 'repeated-voice')?.simpleFact).toContain('私は、見ていました');
    expect(playerFacingScenario).not.toContain('被害者媒体');
  });

  it('keeps investigator titles distinct from control-system terminology across repository text', () => {
    const deprecatedTitle = ['操作', '官'].join('');
    const filesWithDeprecatedTitle = Object.entries(terminologyFiles)
      .filter(([, content]) => content.includes(deprecatedTitle))
      .map(([filePath]) => filePath);
    const serializedCase = JSON.stringify(case000);

    expect(filesWithDeprecatedTitle).toEqual([]);
    expect(serializedCase).toContain('操作主体');
    expect(serializedCase).toContain('操作経路');
    expect(serializedCase).toContain('操作源');
  });

  it('provides three final decisions, three resources, and four investigation actions', () => {
    expect(case000.auditResourceMax).toBe(3);
    expect(case000.decisions).toHaveLength(3);
    expect(case000.actions).toHaveLength(4);
  });

  it('defines the Case000 audit hearing data for contradiction presentation', () => {
    expect(case000.auditHearing?.title).toBe('都市OS暫定判断');
    expect(case000.auditHearing?.requiredContradictions).toBe(1);
    expect(case000.auditHearing?.statements.map((statement) => statement.text)).toEqual([
      '発砲許可署名は間宮怜司と一致しています。',
      '銃器ログは正常に記録されています。',
      'したがって、間宮怜司を発砲主体として処理可能です。',
    ]);
    expect(case000.auditHearing?.statements.at(-1)?.contradictionNodeId).toBe('missing-memory');
    expect(case000.auditHearing?.statements.at(-1)?.contradictionNodeIds).toEqual(['missing-memory', 'arm-history']);
  });


  it('assigns red warning panels only to critical evidence nodes', () => {
    expect(Object.fromEntries(case000.nodes.map(({ id, warningLevel }) => [id, warningLevel]))).toEqual({
      'shot-log': 'critical',
      'missing-memory': 'critical',
      'arm-history': 'critical',
      'victim-medium': 'critical',
      'last-comm': 'none',
      'kasumi-key': 'critical',
      'processing-request': 'none',
    });
  });

  it('defines audit report issues, audit hints, and decision evidence mappings', () => {
    expect(case000.issues.map((issue) => issue.id)).toEqual(['operation_subject', 'legal_persona', 'public_order']);
    expect(case000.issues.every((issue) => issue.relatedNodeIds.length > 0)).toBe(true);
    expect(case000.nodes.find((node) => node.id === 'shot-log')?.auditHint).toContain('公式記録上の発砲主体');
    expect(case000.nodes.find((node) => node.id === 'victim-medium')?.auditHint).toContain('単なる録音とも断定できない');
    expect(case000.decisions.every((decision) => decision.acceptedEvidenceNodeIds?.length && decision.ignoredIssueIds?.length)).toBe(true);
  });

  it('defines judgment unlock conditions as node visits, pinned evidence, and contradiction tags', () => {
    const locked = getJudgmentRequirements({
      visitedNodeCount: case000.requiredNodesToJudge - 1,
      requiredNodesToJudge: case000.requiredNodesToJudge,
      pinnedNodeCount: 0,
      taggedNodes: {},
    });

    expect(locked.map((requirement) => requirement.id)).toEqual(['nodes', 'pins', 'tags']);
    expect(locked.every((requirement) => requirement.completed)).toBe(false);
    expect(canUnlockJudgment({
      visitedNodeCount: case000.requiredNodesToJudge,
      requiredNodesToJudge: case000.requiredNodesToJudge,
      pinnedNodeCount: 1,
      taggedNodes: { 'shot-log': ['persona_signature'] },
    })).toBe(true);
  });

  it('guides the next required audit action in judgment order', () => {
    const base = {
      requiredNodesToJudge: case000.requiredNodesToJudge,
      resources: case000.auditResourceMax,
    };

    const reviewGuidance = getCurrentGuidance({ ...base, visitedNodeCount: 0, pinnedNodeCount: 0, taggedNodeCount: 0, canJudge: false });
    const tagGuidance = getCurrentGuidance({ ...base, visitedNodeCount: 4, pinnedNodeCount: 1, taggedNodeCount: 0, canJudge: false });
    expect(reviewGuidance.phase).toBe('review');
    expect(reviewGuidance.action).toContain('争点別 記憶ノード');
    expect(getCurrentGuidance({ ...base, visitedNodeCount: 4, pinnedNodeCount: 0, taggedNodeCount: 0, canJudge: false }).phase).toBe('pin');
    expect(tagGuidance.phase).toBe('tag');
    expect(tagGuidance.action).toContain('「矛盾あり」');
    expect(tagGuidance.action).not.toContain('halo');
    expect(getCurrentGuidance({ ...base, visitedNodeCount: 4, pinnedNodeCount: 1, taggedNodeCount: 1, canJudge: true }).phase).toBe('judge');
  });

  it('limits contradiction candidates per node and marks records without classifications', () => {
    expect(case000.nodes.find((node) => node.id === 'missing-memory')?.suggestedTags).toEqual(['memory_origin', 'operation_subject']);
    expect(case000.nodes.find((node) => node.id === 'arm-history')?.suggestedTags).toEqual(['body_auth', 'operation_subject', 'record_integrity']);
    expect(case000.nodes.find((node) => node.id === 'victim-medium')?.suggestedTags).toEqual(['persona_signature', 'legal_persona']);
    expect(case000.nodes.find((node) => node.id === 'kasumi-key')?.suggestedTags).toEqual(['record_integrity', 'operation_subject']);
    expect(case000.nodes.find((node) => node.id === 'processing-request')).toMatchObject({
      hasContradiction: false,
      requiresContradictionReview: false,
      suggestedTags: [],
    });
  });

  it('maps every analysis report to its target memory nodes', () => {
    expect(case000.actions.map(({ id, targetNodeIds, reportText }) => ({ id, targetNodeIds, reportText }))).toEqual([
      {
        id: 'scan-persona-signature',
        targetNodeIds: ['shot-log', 'victim-medium'],
        reportText: '署名一致率は改善せず。間宮署名は残るが、単独の責任確定には不足。',
      },
      {
        id: 'scan-memory-origin',
        targetNodeIds: ['missing-memory'],
        reportText: '欠落は内部保護処理を経由。本人由来か外部干渉由来かは確定不能。',
      },
      {
        id: 'restore-damaged-log',
        targetNodeIds: ['missing-memory', 'arm-history'],
        reportText: '欠損区間は断片のみ復元。外部命令断定ではなく境界曖昧化を示唆。',
      },
      {
        id: 'compare-key-medium',
        targetNodeIds: ['kasumi-key', 'victim-medium', 'last-comm'],
        reportText: '七瀬未織の記録装置側に同鍵形式の応答痕。記録装置を操作源と断定するには不足。未焼却音声断片を保全候補へ追加。',
      },
    ]);
  });

  it('defines visible strategic side effects for every investigation action', () => {
    for (const auditCase of [case000, case001]) {
      expect(auditCase.actions.every((action) => action.riskDelta && Object.keys(action.riskDelta).length > 0)).toBe(true);
      expect(auditCase.actions.every((action) => action.riskNote?.startsWith('解析副作用：'))).toBe(true);
    }
  });

  it('renders ruling evidence alignment, risk states, and ignored issues', () => {
    const appSource = terminologyFiles['./App.tsx'];

    expect(appSource).toContain('提出根拠一致');
    expect(appSource).toContain('あなたが提出していない記録を主要根拠に含みます');
    expect(appSource).toContain('この裁定で保留・軽視される争点');
    expect(appSource).toContain('ruling-risk-${riskLevel}');
    expect(appSource).toContain('actionRiskDeltas');
  });

  it('keeps investigation node details and analysis output free of production metadata', () => {
    const playerFacingInvestigationText = [
      ...case000.nodes.flatMap((node) => [node.summary, node.log, node.simpleFact, node.inspectorNote, node.warning, ...Object.keys(node.metrics), ...Object.values(node.metrics).map(String)]),
      ...case000.actions.flatMap((action) => [action.resultLog, action.reportText ?? '']),
    ].join(' ');

    for (const metaTerm of ['Case001', '後続事件', 'MVP', 'Jam', 'プレイヤー', 'シナリオ', '本編', '予告']) {
      expect(playerFacingInvestigationText).not.toContain(metaTerm);
    }
  });

  it('unlocks analysis actions only after all configured conditions are met', () => {
    const resignature = case000.actions.find((action) => action.id === 'scan-persona-signature');
    expect(resignature).toBeDefined();
    if (!resignature) return;

    expect(isInvestigationActionUnlocked({
      action: resignature,
      visitedNodeIds: ['victim-medium'],
      pinnedNodeIds: [],
      taggedNodes: {},
    })).toBe(false);
    expect(isInvestigationActionUnlocked({
      action: resignature,
      visitedNodeIds: ['victim-medium'],
      pinnedNodeIds: ['shot-log'],
      taggedNodes: {},
    })).toBe(true);
  });

  it('supports every analysis unlock condition type', () => {
    const action = {
      id: 'condition-matrix',
      type: 'compare_nodes' as const,
      cost: 1 as const,
      title: '条件照合',
      description: '条件照合',
      resultLog: '完了',
      unlockConditions: [
        { type: 'visited_nodes' as const, nodeIds: ['shot-log'] },
        { type: 'pinned_any' as const, count: 1 },
        { type: 'tagged_any' as const, count: 1 },
        { type: 'tagged_node' as const, nodeId: 'arm-history' },
      ],
    };

    expect(isInvestigationActionUnlocked({
      action,
      visitedNodeIds: ['shot-log'],
      pinnedNodeIds: ['victim-medium'],
      taggedNodes: { 'arm-history': ['body_auth'] },
    })).toBe(true);
  });

  it('defines all contradiction tags required by the MVP', () => {
    expect(contradictionTags).toEqual([
      'body_auth',
      'persona_signature',
      'memory_origin',
      'operation_subject',
      'legal_persona',
      'record_integrity',
    ]);
  });

  it('shows only the newest log in the compact audit console', () => {
    const appSource = terminologyFiles['./App.tsx'];

    expect(appSource).toContain('setSystemLogs((logs) => [...logs, message].slice(-8))');
    expect(appSource).toContain("props.systemLogs.at(-1)");
    expect(appSource).toContain('AUDIT LOG');
    expect(appSource).not.toContain('<summary>ログを表示</summary>');
  });

  it('separates verified node facts from bounded inspector interpretation', () => {
    const targetNodeIds = [
      'shot-log',
      'missing-memory',
      'arm-history',
      'victim-medium',
      'last-comm',
      'kasumi-key',
      'processing-request',
    ];
    const sentenceCount = (value: string) => value.split('。').filter(Boolean).length;
    const targetNodes = case000.nodes.filter((node) => targetNodeIds.includes(node.id));

    expect(targetNodes).toHaveLength(7);
    expect(targetNodes.every((node) => sentenceCount(node.simpleFact) >= 2 && sentenceCount(node.simpleFact) <= 3)).toBe(true);
    expect(targetNodes.every((node) => sentenceCount(node.inspectorNote) >= 2 && sentenceCount(node.inspectorNote) <= 4)).toBe(true);
    expect(case000.nodes.find((node) => node.id === 'victim-medium')?.inspectorNote).toContain('再照合不能');
    expect(case000.nodes.find((node) => node.id === 'last-comm')?.inspectorNote).toContain('未焼却');
    expect(targetNodes.every((node) => /[一-龠ぁ-んァ-ヶ]/.test(node.log))).toBe(true);
    expect(case000.nodes.find((node) => node.id === 'shot-log')?.simpleFact).toContain('記録した印');
    expect(case000.nodes.find((node) => node.id === 'victim-medium')?.simpleFact).toContain('完全な人格バックアップではない');
    expect(case000.nodes.find((node) => node.id === 'missing-memory')?.simpleFact).toContain('本人側か外部側か');
  });

  it('uses concise action labels and plain audit notes for final decisions', () => {
    expect(case000.decisions.map((decision) => decision.label)).toEqual([
      'A. 間宮怜司を発砲責任者として拘束',
      'B. 義体と記録装置を証拠保全',
      'C. 七瀬未織の記録装置を操作干渉源として隔離',
    ]);
    expect(case000.decisions.every((decision) => decision.auditNote.split('。').filter(Boolean).length === 3)).toBe(true);
    expect(case000.decisions.map((decision) => decision.finalRuling)).toEqual([
      '間宮怜司を発砲責任者として拘束',
      '義体と記録装置を証拠保全',
      '七瀬未織の記録装置を操作干渉源として隔離',
    ]);
    expect(case000.decisions[0].processing).toContain('発砲許可署名と義体稼働履歴');
    expect(case000.decisions[1].processing).toContain('証拠保全と再照合');
    expect(case000.decisions[2].processing).toContain('人格断片、または周辺の未登録反応');
    expect(case000.decisions[2].processing).toContain('間宮怜司の即時拘束は保留');
    expect(case000.decisions[2].auditNote).toContain('七瀬未織本人ではなく');
  });

  it('does not refer to Case000 judgments by letter alone in player-facing data', () => {
    const playerFacingCase = JSON.stringify(case000);

    ['AまたはC', 'AとC', 'Aを選んだ場合', 'Cの場合', '被害者媒体'].forEach((term) => {
      expect(playerFacingCase).not.toContain(term);
    });
  });

  it('connects 七瀬未織の記録装置 to the playable Case001 record', () => {
    const victimMedium = case000.nodes.find((node) => node.id === 'victim-medium');
    expect(victimMedium).toBeDefined();
    expect(victimMedium?.simpleFact).toContain('七瀬未織');
    expect(victimMedium?.metrics.発話状態).toBe('反復');
    expect(case001.id).toBe('case001');
    expect(case001.nodes).toHaveLength(7);
  });

  it('communicates node importance with labeled colors instead of critical instability', () => {
    const appSource = terminologyFiles['./App.tsx'];
    const networkSource = terminologyFiles['./MemoryNetwork.tsx'];

    expect(appSource).toContain('色で重要度を表示');
    expect(appSource).toContain('importance-legend');
    expect(networkSource).toContain('importanceColors[node.importance]');
    expect(networkSource).not.toContain('criticalNoise');
    expect(networkSource).not.toContain('kasumiNoise');
  });

  it('documents Jam URL, screenshot, Production, and narrow-screen readiness', () => {
    const readme = terminologyFiles['../README.md'];
    const deploy = terminologyFiles['../docs/deploy.md'];
    const jamSubmission = terminologyFiles['../docs/jam-submission.md'];
    const itchPage = terminologyFiles['../docs/itch-page.md'];
    const screenshots = terminologyFiles['../docs/screenshots.md'];
    expect(readme).toContain('[https://persona-null.vercel.app](https://persona-null.vercel.app)');
    expect(readme).toContain('docs/images/title.svg');
    expect(readme).toContain('docs/images/case000-overview.svg');
    expect(readme).toContain('docs/images/case000-investigation.svg');
    expect(readme).not.toMatch(/docs\/images\/[^)\s]+\.png/);
    expect(readme).toContain('Case000「誰が撃ったのか」と Case001「焼却されなかった声」');
    expect(readme).toContain('事件選択へ戻る');
    expect(deploy).toContain('Production動作確認');
    expect(deploy).toContain('テキスト確認用の最低限対応');
    expect(jamSubmission).toContain('Production確認（人間による手動確認）');
    expect(itchPage).toContain('Case000「誰が撃ったのか」** と **Case001「焼却されなかった声」');
    expect(itchPage).toContain('調査途中の進行状態は保存されません');
    expect(itchPage).not.toContain('Case001「焼却されなかった声」は予告表示のみ');
    expect(screenshots).toContain('Vercel Production 版から撮影した実画像');
    expect(screenshots).toContain('Case001 は本編としてプレイ可能です');

    [
      '../docs/images/title.svg',
      '../docs/images/case000-overview.svg',
      '../docs/images/case000-investigation.svg',
    ].forEach((path) => {
      expect(terminologyFiles[path]).toMatch(/^<\?xml[\s\S]*<svg/);
      expect(terminologyFiles[path]).toContain('data:image/png;base64,');
    });
  });

  it('warns only when a decision has adopted evidence with no submitted match', () => {
    const appSource = terminologyFiles['./App.tsx'];

    expect(appSource).toContain('acceptedNodes.length > 0 && submittedAcceptedCount === 0');
  });

  it('uses normalized value arrays as the only decision value source', () => {
    [...case000.decisions, ...case001.decisions].forEach((decision) => {
      expect(decision.prioritizedValues.length).toBeGreaterThan(0);
      expect(decision.sacrificedValues.length).toBeGreaterThan(0);
      expect(decision).not.toHaveProperty('prioritizedValue');
      expect(decision).not.toHaveProperty('disregardedValue');
    });
  });

  it('result decisions include all result-screen report fields', () => {
    expect(case000.decisions).toHaveLength(3);
    case000.decisions.forEach((decision) => {
      resultScreenFields.forEach((field) => {
        expect(decision[field], `${decision.id}.${field}`).toBeTruthy();
      });
    });
  });
});
