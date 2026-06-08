import { describe, expect, it } from 'vitest';
import { canUnlockJudgment, getJudgmentRequirements } from './auditRules';
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
    expect(case000.personLogs).toHaveLength(1);
    expect(case000.personLogs[0].name).toBe('間宮怜司');
    expect(case000.personLogs[0].role).toContain('都市警備局 捜査官');
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

  it('types only the newest prepended system log', () => {
    const appSource = terminologyFiles['./App.tsx'];

    expect(appSource).toContain('setSystemLogs((logs) => [message, ...logs].slice(0, 8))');
    expect(appSource).toContain('index === 0');
    expect(appSource).not.toContain('index === props.systemLogs.length - 1');
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

  it('result decisions include all result-screen report fields', () => {
    expect(case000.decisions).toHaveLength(3);
    case000.decisions.forEach((decision) => {
      resultScreenFields.forEach((field) => {
        expect(decision[field], `${decision.id}.${field}`).toBeTruthy();
      });
    });
  });
});
