import type { AuditReportCheck, AuditReportIssueState, CaseRecord, TaggedNodes } from './types';

export function buildAuditReportCheck(params: {
  caseRecord: CaseRecord;
  visitedNodeIds: string[];
  pinnedNodeIds: string[];
  taggedNodes: TaggedNodes;
  executedActionIds: string[];
  canJudge: boolean;
  auditPressure?: {
    value: number;
    level: 'low' | 'medium' | 'high' | 'critical';
  };
}): AuditReportCheck {
  const taggedContradictions = Object.values(params.taggedNodes).filter((tags) => tags.length > 0).length;
  const issueStates: AuditReportIssueState[] = params.caseRecord.issues.map((issue) => {
    const reviewedNodeCount = issue.relatedNodeIds.filter((nodeId) => params.visitedNodeIds.includes(nodeId)).length;
    const hasPinnedEvidence = issue.relatedNodeIds.some((nodeId) => params.pinnedNodeIds.includes(nodeId));
    const hasTaggedContradiction = issue.relatedNodeIds.some((nodeId) => (params.taggedNodes[nodeId]?.length ?? 0) > 0);
    const state = reviewedNodeCount === 0
      ? 'unreviewed'
      : !hasPinnedEvidence && !hasTaggedContradiction
        ? 'weak'
        : 'reviewed';

    return {
      issueId: issue.id,
      title: issue.title,
      reviewedNodeCount,
      totalNodeCount: issue.relatedNodeIds.length,
      hasPinnedEvidence,
      hasTaggedContradiction,
      state,
    };
  });
  const warnings: string[] = [];
  const highPressure = params.auditPressure?.level === 'high' || params.auditPressure?.level === 'critical';

  if (issueStates.some((issue) => issue.state === 'unreviewed')) warnings.push('未確認の争点があります。');
  if (issueStates.some((issue) => issue.state === 'weak')) warnings.push('確認済みだが、根拠または矛盾分類が不足している争点があります。');
  if (params.pinnedNodeIds.length === 0) warnings.push('提出根拠が登録されていません。');
  if (taggedContradictions === 0) warnings.push('矛盾分類が登録されていません。');
  if (params.executedActionIds.length === 0) warnings.push('追加解析なしで裁定しようとしています。');
  if (highPressure) warnings.push('処理圧力が高い状態での裁定です。');

  let state: AuditReportCheck['state'];
  let summary: string;
  if (!params.canJudge) {
    state = 'insufficient';
    summary = '裁定条件未達。監査報告書は提出できません。';
  } else if (highPressure) {
    state = 'pressure_ruling';
    summary = '裁定可能。ただし、処理圧力下での判断として記録されます。';
  } else if (warnings.length > 0) {
    state = 'ruling_possible';
    summary = '裁定可能。ただし、未整理の争点または不足している根拠があります。';
  } else {
    state = 'ruling_supported';
    summary = '裁定可能。提出根拠と争点整理は最低要件を満たしています。';
  }

  return {
    reviewedNodes: params.visitedNodeIds.length,
    totalNodes: params.caseRecord.nodes.length,
    pinnedEvidence: params.pinnedNodeIds.length,
    taggedContradictions,
    executedActions: params.executedActionIds.length,
    unresolvedIssues: issueStates,
    warnings,
    summary,
    state,
  };
}
