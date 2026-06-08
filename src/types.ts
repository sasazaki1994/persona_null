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

export type StructuredCaseLog = {
  id: string;
  title: string;
  summary: string;
  log: string;
  simpleFact: string;
  warning: string;
  metrics: Record<string, string | number>;
};

export type PersonLog = StructuredCaseLog & {
  name: string;
  role: string;
};

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
  warning: string;
  metrics: Record<string, string | number>;
  hasContradiction: boolean;
  position: [number, number, number];
  links: string[];
};

export type AnalysisAction = {
  id: string;
  title: string;
  description: string;
  resultLog: string;
};

export type DecisionOption = {
  id: string;
  label: string;
  finalRuling: string;
  processing: string;
  prioritizedValue: string;
  disregardedValue: string;
  auditNote: string;
  endingText: string;
  statDelta: CityStats;
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
  processingRequest: StructuredCaseLog;
  operatorCandidates: OperatorCandidate[];
  mvpScope: MvpScope;
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
