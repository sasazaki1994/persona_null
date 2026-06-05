import { describe, expect, it } from 'vitest';
import { case000, case001Preview, contradictionTags } from './data/cases';

describe('case000 data', () => {
  it('contains the required playable MVP nodes', () => {
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
    expect(case000.processingRequest.id).toBe('city-security-request');
    expect(case000.operatorCandidates.map((candidate) => candidate.candidate)).toEqual([
      '間宮怜司本人',
      '七瀬未織の未登録人格媒体',
      '旧式認証痕による境界介入',
    ]);
    expect(case000.mvpScope.cutForMvp.length).toBeGreaterThan(0);
    expect(case000.mvpScope.keepForExpansion.length).toBeGreaterThan(0);
  });

  it('provides three final decisions, three resources, and three analysis actions', () => {
    expect(case000.auditResourceMax).toBe(3);
    expect(case000.decisions).toHaveLength(3);
    expect(case000.analysisActions).toHaveLength(3);
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

  it('connects 七瀬未織の媒体 to the Case001 preview without making it playable', () => {
    const victimMedium = case000.nodes.find((node) => node.id === 'victim-medium');
    expect(victimMedium?.simpleFact).toContain('七瀬未織');
    expect(victimMedium?.metrics.Case001接続).toBe('未焼却音声');
    expect(case001Preview.linkedFromNodeId).toBe('victim-medium');
    expect(case001Preview.previewOnly).toBe(true);
  });

  it('result decisions include all result-screen report fields', () => {
    expect(case000.decisions.every((decision) => (
      decision.finalRuling
      && decision.processing
      && decision.prioritizedValue
      && decision.disregardedValue
      && decision.auditNote
      && decision.endingText
    ))).toBe(true);
  });
});
