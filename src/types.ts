export type Screen =
  | 'title'
  | 'briefing'
  | 'caseSelect'
  | 'caseOverview'
  | 'investigation'
  | 'decision'
  | 'result';

export type NodeImportance = 'standard' | 'high' | 'critical';

export type GlossaryEntry = {
  id: string;
  term: string;
  aliases: string[];
  definition: string;
};

export type ContradictionTag =
  | 'body_auth'
  | 'persona_signature'
  | 'memory_origin'
  | 'operation_subject'
  | 'legal_persona'
  | 'record_integrity';

export type CityStats = {
  security: number;
  ethics: number;
  surveillance: number;
  egoStability: number;
};

// TODO: Split non-node audit annotations into caution/note before they receive dedicated UI.
// PersonLog, OperatorCandidate, and ProcessingRequest warnings are not red Memory Network alerts.
export type StructuredCaseLog = {
  id: string;
  title: string;
  summary: string;
  log: string;
  simpleFact: string;
  warning: string;
  metrics: Record<string, string | number>;
};

export type PortraitFallback = {
  heading: string;
  lines: string[];
};

export type PersonLog = StructuredCaseLog & {
  name: string;
  role: string;
  portrait?: string;
  portraitAlt?: string;
  auditLabel?: string;
  auditLabels?: string[];
  portraitFallback?: PortraitFallback;
};

export type ProcessingRequest = StructuredCaseLog;

export type OperatorCandidate = StructuredCaseLog & {
  candidate: string;
  supportingNodes: string[];
};

export type MvpScope = {
  cutForMvp: string[];
  keepForExpansion: string[];
};

export type MemoryNode = {
  id: string;
  title: string;
  type: string;
  importance: NodeImportance;
  summary: string;
  log: string;
  simpleFact: string;
  inspectorNote: string;
  auditHint?: string;
  warning: string;
  warningLevel?: 'none' | 'notice' | 'critical';
  metrics: Record<string, string | number>;
  hasContradiction: boolean;
  requiresContradictionReview?: boolean;
  suggestedTags?: ContradictionTag[];
  position: [number, number, number];
  links: string[];
};

export type CaseIssue = {
  id: string;
  title: string;
  description: string;
  relatedNodeIds: string[];
};

export type AnalysisUnlockCondition =
  | { type: 'visited_nodes'; nodeIds: string[] }
  | { type: 'pinned_any'; count: number }
  | { type: 'tagged_any'; count: number }
  | { type: 'tagged_node'; nodeId: string };

export type AnalysisAction = {
  id: string;
  title: string;
  description: string;
  resultLog: string;
  targetNodeIds?: string[];
  reportText?: string;
  unlockConditions?: AnalysisUnlockCondition[];
};

export const auditValueLabels = ['人格断片保護', '記録整合性優先', '危険源隔離', '証拠保全'] as const;

export type AuditValue = typeof auditValueLabels[number];

export type DecisionOption = {
  id: string;
  label: string;
  finalRuling: string;
  processing: string;
  prioritizedValues: AuditValue[];
  sacrificedValues: AuditValue[];
  auditNote: string;
  endingText: string;
  statDelta: CityStats;
  resultStampLabel?: string;
  acceptedEvidenceNodeIds?: string[];
  ignoredIssueIds?: string[];
};

export type CasePreview = {
  id: string;
  title: string;
  subtitle: string;
  previewOnly: true;
  linkedFromNodeId?: string;
  handoffSummary?: string;
  preservedFragment?: string;
};

export type CaseRecord = {
  id: string;
  title: string;
  subtitle: string;
  recordName: string;
  organizationName: string;
  location: string;
  auditResourceMax: number;
  overview: string;
  requiredNodesToJudge: number;
  initialStats: CityStats;
  personLogs: PersonLog[];
  processingRequest: ProcessingRequest;
  operatorCandidates: OperatorCandidate[];
  mvpScope: MvpScope;
  issues: CaseIssue[];
  nodes: MemoryNode[];
  analysisActions: AnalysisAction[];
  decisions: DecisionOption[];
};

export type TaggedNodes = Record<string, ContradictionTag[]>;

export type SavedCaseResult = {
  caseId: string;
  decisionId: string;
  pinnedNodeIds: string[];
  taggedNodes: TaggedNodes;
  executedActionIds: string[];
  finalStats: CityStats;
  completedAt: string;
};
