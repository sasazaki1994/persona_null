import type { AuditValue, CaseRecord, CityStats, SavedCaseResult } from './types';
import { auditValueLabels } from './types';

export type AuditTendency = {
  recordedCases: number;
  prioritized: Record<AuditValue, number>;
  sacrificed: Record<AuditValue, number>;
  statDelta: CityStats;
};

const emptyStats = (): CityStats => ({ security: 0, ethics: 0, surveillance: 0, egoStability: 0 });

const emptyValueCounts = (): Record<AuditValue, number> => Object.fromEntries(
  auditValueLabels.map((value) => [value, 0]),
) as Record<AuditValue, number>;

export function aggregateAuditTendency(results: SavedCaseResult[], caseRecords: CaseRecord[]): AuditTendency {
  const tendency: AuditTendency = {
    recordedCases: 0,
    prioritized: emptyValueCounts(),
    sacrificed: emptyValueCounts(),
    statDelta: emptyStats(),
  };

  for (const result of results) {
    const caseRecord = caseRecords.find((item) => item.id === result.caseId);
    const decision = caseRecord?.decisions.find((item) => item.id === result.decisionId);
    if (!caseRecord || !decision) continue;

    tendency.recordedCases += 1;
    decision.prioritizedValues.forEach((value) => { tendency.prioritized[value] += 1; });
    decision.sacrificedValues.forEach((value) => { tendency.sacrificed[value] += 1; });
    (Object.keys(tendency.statDelta) as (keyof CityStats)[]).forEach((key) => {
      tendency.statDelta[key] += result.finalStats[key] - caseRecord.initialStats[key];
    });
  }

  return tendency;
}
