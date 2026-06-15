import type { CaseRecord, CityStats, SavedCaseResult } from './types';

export type CaseContinuityEffect = {
  sourceCaseId: string;
  sourceDecisionId: string;
  title: string;
  summary: string;
  caseOverviewNotice: string;
  investigationLog: string;
  statusBias?: Partial<CityStats>;
  tone: 'detention_bias' | 'preservation_bias' | 'isolation_bias' | 'neutral';
};

type ContinuityContent = Omit<CaseContinuityEffect, 'sourceCaseId' | 'sourceDecisionId'>;

const case000Effects: Record<string, ContinuityContent> = {
  'detain-mamiya': {
    title: '前回裁定：署名責任の固定',
    summary: 'Case000では、人格署名と登録義体の一致が重く扱われました。',
    caseOverviewNotice: '前回裁定により、都市警備局は Case001 の人格断片を「証言」ではなく「補助記録」として扱う傾向を強めています。',
    investigationLog: '参照基準適用：前回裁定により、署名名義と登録主体を優先する処理圧力を検出。',
    statusBias: { security: 2, ethics: -2, surveillance: 1, egoStability: -1 },
    tone: 'detention_bias',
  },
  'freeze-evidence': {
    title: '前回裁定：証拠保全の優先',
    summary: 'Case000では、操作主体未確定のまま責任を固定せず、記録保全が優先されました。',
    caseOverviewNotice: '前回裁定により、Case001 の人格断片は直ちに焼却されず、制限付き証拠として扱われます。',
    investigationLog: '参照基準適用：前回裁定により、未確定人格断片の保全猶予が付与されています。',
    statusBias: { security: -1, ethics: 2, surveillance: 0, egoStability: 2 },
    tone: 'preservation_bias',
  },
  'process-medium': {
    title: '前回裁定：危険源隔離の優先',
    summary: 'Case000では、未登録人格記録装置の危険性が重く扱われました。',
    caseOverviewNotice: '前回裁定により、Case001 の反復発話ログは証言ではなく、隔離対象の異常反応として扱われやすくなっています。',
    investigationLog: '参照基準適用：前回裁定により、人格断片の自己保存反応に対する監視閾値が上昇。',
    statusBias: { security: 2, ethics: -2, surveillance: 3, egoStability: -2 },
    tone: 'isolation_bias',
  },
};

export function getCaseContinuityEffect(params: {
  currentCaseId: string;
  savedResults: SavedCaseResult[];
  caseRecords: CaseRecord[];
}): CaseContinuityEffect | null {
  if (params.currentCaseId !== 'case001') return null;

  const sourceCase = params.caseRecords.find((caseRecord) => caseRecord.id === 'case000');
  const savedResult = params.savedResults.find((result) => result.caseId === 'case000');
  if (!sourceCase || !savedResult || !sourceCase.decisions.some((decision) => decision.id === savedResult.decisionId)) return null;

  const content = case000Effects[savedResult.decisionId];
  if (!content) return null;

  return {
    sourceCaseId: savedResult.caseId,
    sourceDecisionId: savedResult.decisionId,
    ...content,
  };
}
