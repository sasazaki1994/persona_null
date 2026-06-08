import { describe, expect, it } from 'vitest';
import { canUnlockJudgment, getCurrentGuidance, getJudgmentRequirements, isAnalysisActionUnlocked } from './auditRules';
import { case000, case001Preview, contradictionTags } from './data/cases';
import type { DecisionOption } from './types';

const terminologyFiles = import.meta.glob(
  ['../README.md', '../docs/**/*.md', '../features/**/*.feature', './**/*.{ts,tsx}'],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>;

const resultScreenFields: (keyof DecisionOption)[] = [
  'finalRuling',
  'processing',
  'prioritizedValue',
  'disregardedValue',
  'auditNote',
  'endingText',
];

describe('case000 data', () => {
  it('contains exactly seven playable MVP memory nodes', () => {
    expect(case000.nodes).toHaveLength(7);
    expect(case000.nodes.map((node) => node.title)).toEqual([
      '発砲ログ',
      '間宮の発砲記憶',
      '義体稼働履歴',
      '七瀬未織の媒体',
      '最後の通信',
      'KASUMI-GATE-09認証痕',
      '都市警備局の処理要求',
    ]);
    expect(case000.requiredNodesToJudge).toBeLessThanOrEqual(case000.nodes.length);
    expect(case000.nodes.every((node) => node.title && node.summary && node.log && node.simpleFact && node.inspectorNote && node.warning && Object.keys(node.metrics).length > 0)).toBe(true);
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
      '七瀬未織の未登録人格媒体',
      '旧式認証痕による境界介入',
    ]);
    expect(case000.mvpScope.cutForMvp.length).toBeGreaterThan(0);
    expect(case000.mvpScope.keepForExpansion.length).toBeGreaterThan(0);
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

  it('provides three final decisions, three resources, and three analysis actions', () => {
    expect(case000.auditResourceMax).toBe(3);
    expect(case000.decisions).toHaveLength(3);
    expect(case000.analysisActions).toHaveLength(3);
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

    expect(getCurrentGuidance({ ...base, visitedNodeCount: 0, pinnedNodeCount: 0, taggedNodeCount: 0, canJudge: false }).phase).toBe('review');
    expect(getCurrentGuidance({ ...base, visitedNodeCount: 4, pinnedNodeCount: 0, taggedNodeCount: 0, canJudge: false }).phase).toBe('pin');
    expect(getCurrentGuidance({ ...base, visitedNodeCount: 4, pinnedNodeCount: 1, taggedNodeCount: 0, canJudge: false }).phase).toBe('tag');
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
    expect(case000.analysisActions.map(({ id, targetNodeIds, reportText }) => ({ id, targetNodeIds, reportText }))).toEqual([
      {
        id: 'resignature',
        targetNodeIds: ['shot-log', 'victim-medium'],
        reportText: '署名一致率は改善せず。間宮署名は残るが、単独の責任確定には不足。',
      },
      {
        id: 'restore-eight',
        targetNodeIds: ['missing-memory', 'arm-history'],
        reportText: '欠損区間は断片のみ復元。外部命令断定ではなく境界曖昧化を示唆。',
      },
      {
        id: 'match-key-medium',
        targetNodeIds: ['kasumi-key', 'victim-medium', 'last-comm'],
        reportText: '七瀬未織の媒体側に同鍵形式の応答痕。媒体を操作源と断定するには不足。未焼却音声断片をCase001保全候補へ追加。',
      },
    ]);
  });

  it('unlocks analysis actions only after all configured conditions are met', () => {
    const resignature = case000.analysisActions.find((action) => action.id === 'resignature');
    expect(resignature).toBeDefined();
    if (!resignature) return;

    expect(isAnalysisActionUnlocked({
      action: resignature,
      visitedNodeIds: ['victim-medium'],
      pinnedNodeIds: [],
      taggedNodes: {},
    })).toBe(false);
    expect(isAnalysisActionUnlocked({
      action: resignature,
      visitedNodeIds: ['victim-medium'],
      pinnedNodeIds: ['shot-log'],
      taggedNodes: {},
    })).toBe(true);
  });

  it('supports every analysis unlock condition type', () => {
    const action = {
      id: 'condition-matrix',
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

    expect(isAnalysisActionUnlocked({
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

  it('types only the newest log while preserving chronological audit order', () => {
    const appSource = terminologyFiles['./App.tsx'];

    expect(appSource).toContain('setSystemLogs((logs) => [...logs, message].slice(-8))');
    expect(appSource).toContain("props.systemLogs.at(-1)");
    expect(appSource).toContain('AUDIT LOG');
    expect(appSource).toContain('<summary>ログを表示</summary>');
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
    expect(case000.nodes.find((node) => node.id === 'victim-medium')?.inspectorNote).toContain('Case001');
    expect(case000.nodes.find((node) => node.id === 'last-comm')?.inspectorNote).toContain('未焼却');
  });

  it('connects 七瀬未織の媒体 to the Case001 preview without making it playable', () => {
    const victimMedium = case000.nodes.find((node) => node.id === 'victim-medium');
    expect(victimMedium).toBeDefined();
    expect(victimMedium?.simpleFact).toContain('七瀬未織');
    expect(victimMedium?.metrics.Case001接続).toBe('未焼却音声');
    expect(case001Preview.linkedFromNodeId).toBe('victim-medium');
    expect(case001Preview.previewOnly).toBe(true);
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
    const screenshots = terminologyFiles['../docs/screenshots.md'];
    expect(readme).toContain('Demo / Play URL');
    expect(readme).toContain('docs/images/title.png');
    expect(readme).toContain('docs/images/case000-investigation.png');
    expect(readme).toContain('docs/images/case000-result.png');
    expect(deploy).toContain('Production動作確認');
    expect(screenshots).toContain('README は上記パスをすでに参照しています');
  });

  it('warns only when a decision has adopted evidence with no submitted match', () => {
    const appSource = terminologyFiles['./App.tsx'];

    expect(appSource).toContain('acceptedNodes.length > 0 && submittedAcceptedCount === 0');
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
