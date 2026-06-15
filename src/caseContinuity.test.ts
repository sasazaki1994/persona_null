import { describe, expect, it } from 'vitest';
import { cases } from './data/cases';
import { getCaseContinuityEffect } from './caseContinuity';
import type { SavedCaseResult } from './types';

const savedResult = (decisionId: string): SavedCaseResult => ({
  caseId: 'case000',
  decisionId,
  pinnedNodeIds: [],
  taggedNodes: {},
  executedActionIds: [],
  finalStats: { security: 0, ethics: 0, surveillance: 0, egoStability: 0 },
  completedAt: '2026-06-15T00:00:00.000Z',
});

describe('case continuity', () => {
  it('only applies a saved Case000 decision to Case001', () => {
    expect(getCaseContinuityEffect({ currentCaseId: 'case001', savedResults: [], caseRecords: cases })).toBeNull();
    expect(getCaseContinuityEffect({ currentCaseId: 'case000', savedResults: [savedResult('freeze-evidence')], caseRecords: cases })).toBeNull();
  });

  it('maps the evidence-preservation ruling to display-only processing pressure', () => {
    const effect = getCaseContinuityEffect({
      currentCaseId: 'case001',
      savedResults: [savedResult('freeze-evidence')],
      caseRecords: cases,
    });

    expect(effect).toMatchObject({
      sourceCaseId: 'case000',
      sourceDecisionId: 'freeze-evidence',
      tone: 'preservation_bias',
      statusBias: { security: -1, ethics: 2, surveillance: 0, egoStability: 2 },
    });
    expect(effect?.caseOverviewNotice).toContain('制限付き証拠');
    expect(effect?.investigationLog).toContain('保全猶予');
    expect(Object.keys(savedResult('freeze-evidence'))).toEqual([
      'caseId', 'decisionId', 'pinnedNodeIds', 'taggedNodes', 'executedActionIds', 'finalStats', 'completedAt',
    ]);
  });
});
