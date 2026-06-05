import { describe, expect, it } from 'vitest';
import { case000, contradictionTags } from './data/cases';

describe('case000 data', () => {
  it('contains the required playable MVP nodes', () => {
    expect(case000.nodes.map((node) => node.title)).toEqual([
      '発砲ログ',
      '間宮の発砲記憶',
      '義体稼働履歴',
      '被害者媒体',
      '最後の通信',
      'KASUMI-GATE-09認証痕',
    ]);
    expect(case000.requiredNodesToJudge).toBeLessThanOrEqual(case000.nodes.length);
    expect(case000.nodes.every((node) => node.title && node.log && node.simpleFact && node.inspectorNote && node.warning)).toBe(true);
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
