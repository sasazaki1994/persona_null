import { describe, expect, it } from 'vitest';
import { aggregateAuditTendency } from './auditTendency';
import { cases } from './data/cases';
import type { SavedCaseResult } from './types';

const result = (overrides: Partial<SavedCaseResult>): SavedCaseResult => ({
  caseId: 'case000',
  decisionId: 'freeze-evidence',
  pinnedNodeIds: [],
  taggedNodes: {},
  executedActionIds: [],
  finalStats: { security: 59, ethics: 56, surveillance: 73, egoStability: 45 },
  completedAt: '2026-06-12T00:00:00.000Z',
  ...overrides,
});

describe('aggregateAuditTendency', () => {
  it('counts normalized priorities and sacrifices and sums saved final stat deltas', () => {
    const tendency = aggregateAuditTendency([
      result({}),
      result({
        caseId: 'case001',
        decisionId: 'preserve-fragment',
        finalStats: { security: 56, ethics: 60, surveillance: 75, egoStability: 47 },
      }),
    ], cases);

    expect(tendency.recordedCases).toBe(2);
    expect(tendency.prioritized).toEqual({
      人格断片保護: 1,
      記録整合性優先: 0,
      危険源隔離: 0,
      証拠保全: 2,
    });
    expect(tendency.sacrificed.危険源隔離).toBe(2);
    expect(tendency.statDelta).toEqual({ security: -6, ethics: 16, surveillance: 4, egoStability: 12 });
  });

  it('ignores saved results with unknown cases or decisions', () => {
    const tendency = aggregateAuditTendency([
      result({ caseId: 'case999' }),
      result({ decisionId: 'unknown-decision' }),
    ], cases);

    expect(tendency.recordedCases).toBe(0);
  });
});
