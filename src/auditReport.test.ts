import { describe, expect, it } from 'vitest';
import { buildAuditReportCheck } from './auditReport';
import { case000, case001 } from './data/cases';

describe('buildAuditReportCheck', () => {
  it.each([case000, case001])('builds the initial insufficient report for $id', (caseRecord) => {
    const report = buildAuditReportCheck({
      caseRecord,
      visitedNodeIds: [],
      pinnedNodeIds: [],
      taggedNodes: {},
      executedActionIds: [],
      canJudge: false,
    });

    expect(report).toMatchObject({
      reviewedNodes: 0,
      totalNodes: 7,
      pinnedEvidence: 0,
      taggedContradictions: 0,
      executedActions: 0,
      state: 'insufficient',
      summary: '裁定条件未達。監査報告書は提出できません。',
    });
    expect(report.unresolvedIssues.every((issue) => issue.state === 'unreviewed')).toBe(true);
    expect(report.warnings).toContain('未確認の争点があります。');
  });

  it('updates counts, issue states, and a possible-ruling summary without grading the player', () => {
    const reviewedNodes = case000.nodes.slice(0, case000.requiredNodesToJudge).map((node) => node.id);
    const report = buildAuditReportCheck({
      caseRecord: case000,
      visitedNodeIds: reviewedNodes,
      pinnedNodeIds: [reviewedNodes[0]],
      taggedNodes: { [reviewedNodes[0]]: ['persona_signature'] },
      executedActionIds: ['scan-persona-signature'],
      canJudge: true,
      auditPressure: { value: 29, level: 'low' },
    });

    expect(report.reviewedNodes).toBe(4);
    expect(report.pinnedEvidence).toBe(1);
    expect(report.taggedContradictions).toBe(1);
    expect(report.executedActions).toBe(1);
    expect(report.unresolvedIssues.some((issue) => issue.state === 'weak')).toBe(true);
    expect(report.state).toBe('ruling_possible');
    expect(report.summary).toContain('裁定可能');
  });

  it('prioritizes pressure-ruling state at high pressure', () => {
    const report = buildAuditReportCheck({
      caseRecord: case001,
      visitedNodeIds: case001.nodes.map((node) => node.id),
      pinnedNodeIds: case001.nodes.map((node) => node.id),
      taggedNodes: Object.fromEntries(case001.nodes.map((node) => [node.id, ['record_integrity']])),
      executedActionIds: case001.actions.map((action) => action.id),
      canJudge: true,
      auditPressure: { value: 60, level: 'high' },
    });

    expect(report.state).toBe('pressure_ruling');
    expect(report.summary).toContain('処理圧力下');
    expect(report.warnings).toContain('処理圧力が高い状態での裁定です。');
  });
});
