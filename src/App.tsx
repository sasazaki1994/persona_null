import { useEffect, useRef, useState, type ReactNode } from 'react';
import { aggregateAuditTendency } from './auditTendency';
import { canUnlockJudgment, getCurrentGuidance, getJudgmentRequirements, isInvestigationActionUnlocked, isWarningLog, type CurrentGuidance, type JudgmentRequirement } from './auditRules';
import { case000, cases, contradictionTagLabels } from './data/cases';
import { getCaseContinuityEffect, type CaseContinuityEffect } from './caseContinuity';
import { AnnotatedText } from './components/AnnotatedText';
import { TypewriterText } from './components/TypewriterText';
import { PersonProfile } from './components/PersonProfile';
import { MemoryNetwork } from './MemoryNetwork';
import { loadCaseResults, loadReadFlags, markRead, saveCaseResult } from './storage';
import { auditValueLabels } from './types';
import type { InvestigationAction, AnalysisUnlockCondition, CaseRecord, CityStats, ContradictionTag, DecisionOption, MemoryNode, NodeImportance, SavedCaseResult, Screen, TaggedNodes } from './types';
import './styles.css';

const clampStat = (value: number) => Math.max(0, Math.min(100, value));
const addStats = (base: CityStats, delta: CityStats): CityStats => ({
  security: clampStat(base.security + delta.security),
  ethics: clampStat(base.ethics + delta.ethics),
  surveillance: clampStat(base.surveillance + delta.surveillance),
  egoStability: clampStat(base.egoStability + delta.egoStability),
});

const statLabels: Record<keyof CityStats, string> = {
  security: '治安',
  ethics: '倫理',
  surveillance: '監視レベル',
  egoStability: '自我安定度',
};

const cityStatKeys = Object.keys(statLabels) as (keyof CityStats)[];

function getStatTone(key: keyof CityStats, value: number) {
  if (key === 'surveillance') {
    if (value >= 75) return 'critical';
    if (value >= 60) return 'warning';
    return value <= 35 ? 'valid' : 'muted';
  }
  if (value <= 35) return 'critical';
  if (value <= 55) return 'warning';
  return value >= 70 ? 'valid' : 'muted';
}

const importanceLabels: Record<NodeImportance, string> = {
  standard: '標準',
  high: '高',
  critical: '重大',
};

function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [selectedCaseId, setSelectedCaseId] = useState(case000.id);
  const caseRecord = cases.find((item) => item.id === selectedCaseId) ?? case000;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [visitedNodeIds, setVisitedNodeIds] = useState<string[]>([]);
  const [pinnedNodeIds, setPinnedNodeIds] = useState<string[]>([]);
  const [taggedNodes, setTaggedNodes] = useState<TaggedNodes>({});
  const [resources, setResources] = useState(caseRecord.auditResourceMax);
  const [executedActionIds, setExecutedActionIds] = useState<string[]>([]);
  const [actionRiskDeltas, setActionRiskDeltas] = useState<Record<string, Partial<CityStats>>>({});
  const [systemLogs, setSystemLogs] = useState<string[]>(['監査室端末を起動。都市OS 基礎公定通知を待機。']);
  const [decision, setDecision] = useState<DecisionOption | null>(null);
  const [resultPayload, setResultPayload] = useState<SavedCaseResult | null>(null);
  const [savedCaseResults, setSavedCaseResults] = useState<SavedCaseResult[]>(() => loadCaseResults());
  const completedCaseIds = savedCaseResults.map((result) => result.caseId);
  const continuityEffect = getCaseContinuityEffect({ currentCaseId: selectedCaseId, savedResults: savedCaseResults, caseRecords: cases });
  const [readFlags, setReadFlags] = useState<string[]>(() => loadReadFlags());
  const [feedback, setFeedback] = useState<{ id: number; message: string } | null>(null);
  const wasJudgmentReady = useRef(false);

  const selectedNode = caseRecord.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const visitedCount = visitedNodeIds.length;
  const requirements = getJudgmentRequirements({
    visitedNodeCount: visitedCount,
    requiredNodesToJudge: caseRecord.requiredNodesToJudge,
    pinnedNodeCount: pinnedNodeIds.length,
    taggedNodes,
  });
  const canJudge = canUnlockJudgment({
    visitedNodeCount: visitedCount,
    requiredNodesToJudge: caseRecord.requiredNodesToJudge,
    pinnedNodeCount: pinnedNodeIds.length,
    taggedNodes,
  });
  const taggedNodeCount = Object.values(taggedNodes).filter((tags) => tags.length > 0).length;
  const guidance = getCurrentGuidance({
    visitedNodeCount: visitedCount,
    requiredNodesToJudge: caseRecord.requiredNodesToJudge,
    pinnedNodeCount: pinnedNodeIds.length,
    taggedNodeCount,
    resources,
    canJudge,
  });
  const finalStats = decision ? addStats(caseRecord.initialStats, decision.statDelta) : caseRecord.initialStats;

  const showFeedback = (message: string) => {
    setFeedback({ id: Date.now(), message });
  };

  useEffect(() => {
    if (canJudge && !wasJudgmentReady.current) showFeedback('JUDGMENT READY');
    wasJudgmentReady.current = canJudge;
  }, [canJudge]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback((current) => current?.id === feedback.id ? null : current), 1400);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const submitDecision = (nextDecision: DecisionOption) => {
    const nextFinalStats = addStats(caseRecord.initialStats, nextDecision.statDelta);
    const nextResultPayload: SavedCaseResult = {
      caseId: caseRecord.id,
      decisionId: nextDecision.id,
      pinnedNodeIds,
      taggedNodes,
      executedActionIds,
      finalStats: nextFinalStats,
      completedAt: new Date().toISOString(),
    };

    const saved = saveCaseResult(nextResultPayload);
    if (saved) {
      setSavedCaseResults((results) => [...results.filter((item) => item.caseId !== nextResultPayload.caseId), nextResultPayload]);
    }
    setResultPayload(nextResultPayload);
    setDecision(nextDecision);
    setScreen('result');
  };

  const appendLog = (message: string) => setSystemLogs((logs) => [...logs, message].slice(-8));
  const selectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setVisitedNodeIds((ids) => (ids.includes(nodeId) ? ids : [...ids, nodeId]));
    const node = caseRecord.nodes.find((item) => item.id === nodeId);
    appendLog(`記憶ノード確認：${node?.title ?? nodeId}。公定値と監査記録を照合。`);
    showFeedback('SCAN COMPLETE');
  };

  const togglePin = (nodeId: string) => {
    const node = caseRecord.nodes.find((item) => item.id === nodeId);
    if (pinnedNodeIds.includes(nodeId)) {
      setPinnedNodeIds((ids) => ids.filter((id) => id !== nodeId));
      appendLog(`判断根拠解除：${node?.title ?? nodeId}。`);
      showFeedback('EVIDENCE RELEASED');
      return;
    }
    if (pinnedNodeIds.length >= 3) {
      appendLog('提出根拠上限：3件を超える登録は拒否。');
      return;
    }
    setPinnedNodeIds((ids) => [...ids, nodeId]);
    appendLog(`判断根拠追加：${node?.title ?? nodeId}。`);
    showFeedback('EVIDENCE PINNED');
  };

  const toggleTag = (node: MemoryNode, tag: ContradictionTag) => {
    if (!node.suggestedTags?.includes(tag)) return;
    const currentTags = taggedNodes[node.id] ?? [];
    const removing = currentTags.includes(tag);
    const nextTags = removing ? currentTags.filter((item) => item !== tag) : [...currentTags, tag];
    setTaggedNodes({ ...taggedNodes, [node.id]: nextTags });
    appendLog(`${removing ? '矛盾分類解除' : '矛盾分類登録'}：${node.title} / ${contradictionTagLabels[tag]}。`);
    if (!removing) showFeedback('CONTRADICTION TAGGED');
  };

  const executeAction = (actionId: string) => {
    const action = caseRecord.actions.find((item) => item.id === actionId);
    if (!action || executedActionIds.includes(actionId)) return;
    if (!isInvestigationActionUnlocked({ action, visitedNodeIds, pinnedNodeIds, taggedNodes })) {
      appendLog(`解析権限未解放：${action.title}。必要記録を確認してください。`);
      return;
    }
    if (resources <= 0) {
      appendLog('監査リソース不足：追加解析を実行できません。既存記録のみで判断してください。');
      return;
    }
    setResources((value) => value - action.cost);
    setExecutedActionIds((ids) => [...ids, actionId]);
    appendLog(action.resultLog);
    if (action.riskDelta) setActionRiskDeltas((deltas) => ({ ...deltas, [actionId]: action.riskDelta ?? {} }));
    if (action.riskNote) appendLog(action.riskNote);
    showFeedback('AUDIT RESOURCE CONSUMED');
  };

  if (screen === 'title') return <TitleScreen onNext={() => setScreen('briefing')} />;
  if (screen === 'briefing') return <AuthBriefingScreen onNext={() => { markRead('city-os-briefing'); setReadFlags((flags) => (flags.includes('city-os-briefing') ? flags : [...flags, 'city-os-briefing'])); setScreen('caseSelect'); }} read={readFlags.includes('city-os-briefing')} />;
  if (screen === 'caseSelect') return <CaseSelectScreen completedCaseIds={completedCaseIds} savedCaseResults={savedCaseResults} onSelect={(nextCase) => {
    setSelectedCaseId(nextCase.id);
    setSelectedNodeId(null);
    setVisitedNodeIds([]);
    setPinnedNodeIds([]);
    setTaggedNodes({});
    setResources(nextCase.auditResourceMax);
    setExecutedActionIds([]);
    setActionRiskDeltas({});
    setSystemLogs(['監査室端末を起動。都市OS 基礎公定通知を待機。', `監査対象選択：${nextCase.id.toUpperCase()} / ${nextCase.recordName}。`]);
    setDecision(null);
    setResultPayload(null);
    wasJudgmentReady.current = false;
    setScreen('caseOverview');
  }} />;
  if (screen === 'caseOverview') return <CaseOverviewScreen caseRecord={caseRecord} continuityEffect={continuityEffect} onNext={() => {
    if (continuityEffect) appendLog(continuityEffect.investigationLog);
    setScreen('investigation');
  }} />;
  if (screen === 'decision') {
    return <DecisionScreen caseRecord={caseRecord} pinnedNodeIds={pinnedNodeIds} onBack={() => setScreen('investigation')} onDecide={submitDecision} />;
  }
  if (screen === 'result' && decision && resultPayload) {
    return <ResultScreen caseRecord={caseRecord} decision={decision} finalStats={finalStats} payload={resultPayload} taggedNodes={taggedNodes} actionRiskDeltas={actionRiskDeltas} onArchive={() => setScreen('caseSelect')} />;
  }

  return (
    <InvestigationScreen
      caseRecord={caseRecord}
      selectedNode={selectedNode}
      selectedNodeId={selectedNodeId}
      visitedNodeIds={visitedNodeIds}
      pinnedNodeIds={pinnedNodeIds}
      taggedNodes={taggedNodes}
      resources={resources}
      executedActionIds={executedActionIds}
      systemLogs={systemLogs}
      guidance={guidance}
      requirements={requirements}
      canJudge={canJudge}
      onSelectNode={selectNode}
      onTogglePin={togglePin}
      onToggleTag={toggleTag}
      onExecuteAction={executeAction}
      onJudge={() => canJudge && setScreen('decision')}
      feedback={feedback?.message ?? null}
    />
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <main className="app-shell shell">{children}</main>;
}

function TitleScreen({ onNext }: { onNext: () => void }) {
  return (
    <Shell>
      <section className="start-card terminal-boot">
        <div className="boot-header" aria-label="端末識別情報">
          <span>CITY OS AUDIT TERMINAL</span>
          <span>ACCESS: PROVISIONAL</span>
        </div>
        <p className="eyebrow">{case000.organizationName}記録 {case000.recordName}</p>
        <h1>Persona Null</h1>
        <p>北霞市 都市OS 判断不能案件処理端末</p>
        <p className="muted">公定値は手続き上の事実であり、真実そのものではありません。</p>
        <button className="terminal-boot-button" onClick={onNext}><span>監査端末を起動</span><small>INITIALIZE AUDIT SESSION</small></button>
        <p className="boot-case-id">KASUMI-GATE-09 / CASE000</p>
      </section>
    </Shell>
  );
}

function AuthBriefingScreen({ onNext, read }: { onNext: () => void; read: boolean }) {
  return (
    <Shell>
      <section className="document-card">
        <p className="eyebrow">都市OS 基礎公定通知{read ? ' / 既読' : ''}</p>
        <h2>本人性の境界について</h2>
        <ul>
          <li><AnnotatedText text="身体認証：その身体が誰のものか。" /></li>
          <li><AnnotatedText text="人格認証：応答している人格が誰なのか。" /></li>
          <li><AnnotatedText text="操作主体：身体や義体を実際に動かしている主体が誰なのか。" /></li>
          <li><AnnotatedText text="法的人格：都市OSが権利、責任、同意、通行、医療判断を与えてよいと認めた人格。" /></li>
        </ul>
        <p><TypewriterText text="認証失敗または人格未確定の者は、市民生活の端から静かに除外されます。" speed={16} animateKey="auth-briefing" /></p>
        <button onClick={onNext}>通知を確認</button>
      </section>
    </Shell>
  );
}

function CaseSelectScreen({ completedCaseIds, savedCaseResults, onSelect }: { completedCaseIds: string[]; savedCaseResults: SavedCaseResult[]; onSelect: (caseRecord: CaseRecord) => void }) {
  const tendency = aggregateAuditTendency(savedCaseResults, cases);

  return (
    <Shell>
      <section className="document-card case-files-screen">
        <div className="case-files-header">
          <p className="eyebrow">CASE ARCHIVE / 事件ファイル選択</p>
          <h2>監査対象記録</h2>
          <p>都市OSが保留した事件記録から、監査可能なファイルを選択してください。</p>
        </div>
        <AuditTendencyPanel tendency={tendency} />
        <div className="case-file-list">
          {cases.map((caseRecord) => {
            const completed = completedCaseIds.includes(caseRecord.id);
            return (
              <article className="case-file available" key={caseRecord.id}>
                <div className="case-file-topline"><span>{caseRecord.id.toUpperCase()}</span><strong>監査可能</strong></div>
                <p className="case-file-record">RECORD / {caseRecord.recordName}</p>
                <h3>{caseRecord.title}</h3>
                <p>{caseRecord.subtitle}</p>
                <dl>
                  <div><dt>管轄</dt><dd>{caseRecord.organizationName}</dd></div>
                  <div><dt>場所</dt><dd>{caseRecord.location}</dd></div>
                  <div><dt>状態</dt><dd>{completed ? '処理済記録あり / 再監査可能' : '未処理 / 監査可能'}</dd></div>
                </dl>
                <button onClick={() => onSelect(caseRecord)}>{caseRecord.id.replace('case', 'Case')}を開く</button>
              </article>
            );
          })}
        </div>
      </section>
    </Shell>
  );
}


function AuditTendencyPanel({ tendency }: { tendency: ReturnType<typeof aggregateAuditTendency> }) {
  if (tendency.recordedCases === 0) {
    return <section className="audit-tendency empty" aria-label="監査傾向"><h3>監査傾向：未記録</h3></section>;
  }

  return (
    <section className="audit-tendency" aria-label="監査傾向">
      <div className="audit-tendency-heading"><div><p className="eyebrow">CITY OS / REFERENCE PROFILE</p><h3>監査傾向</h3></div><strong>{tendency.recordedCases}件記録</strong></div>
      <div className="audit-tendency-grid">
        <div><h4>優先した価値</h4>{auditValueLabels.map((value) => <p key={value}><span>{value}</span><strong>{tendency.prioritized[value]}</strong></p>)}</div>
        <div><h4>軽視した価値</h4>{auditValueLabels.map((value) => <p key={value}><span>{value}</span><strong>{tendency.sacrificed[value]}</strong></p>)}</div>
        <div><h4>都市変動累計</h4>{cityStatKeys.map((key) => { const delta = tendency.statDelta[key]; return <p key={key}><span>{statLabels[key]}</span><strong className={delta >= 0 ? 'delta-plus' : 'delta-minus'}>{delta >= 0 ? '+' : ''}{delta}</strong></p>; })}</div>
      </div>
    </section>
  );
}

function CaseOverviewScreen({ caseRecord, continuityEffect, onNext }: { caseRecord: CaseRecord; continuityEffect: CaseContinuityEffect | null; onNext: () => void }) {
  return (
    <Shell>
      <section className="document-card wide">
        <p className="eyebrow">事件概要</p>
        <h2>{caseRecord.title}</h2>
        <p><AnnotatedText text={caseRecord.overview} /></p>
        {continuityEffect && (
          <section className={`continuity-panel continuity-${continuityEffect.tone}`} aria-label="前回裁定の参照基準">
            <p className="eyebrow">CITY OS / PRECEDENT REFERENCE</p>
            <h3>前回裁定の参照基準</h3>
            <h4>{continuityEffect.title}</h4>
            <p>{continuityEffect.summary}</p>
            <p className="continuity-notice">{continuityEffect.caseOverviewNotice}</p>
            {continuityEffect.statusBias && (
              <div className="continuity-bias">
                <strong>都市ステータスへの暫定影響</strong>
                <div className="decision-stat-deltas">
                  {cityStatKeys.map((key) => {
                    const delta = continuityEffect.statusBias?.[key];
                    return delta === undefined ? null : <span key={key}>{statLabels[key]} {delta >= 0 ? '+' : ''}{delta}</span>;
                  })}
                </div>
              </div>
            )}
            <small>この影響は事実記録を変更しません。監査室が参照する処理基準のみを変更します。</small>
          </section>
        )}
        <section className="overview-grid">
          <div className="person-profiles-panel">
            <h3>人物プロファイル</h3>
            <div className="person-profile-list">
              {caseRecord.personLogs.map((person) => <PersonProfile key={person.id} person={person} />)}
            </div>
          </div>
          <div>
            <h3>処理要求</h3>
            <p><strong>{caseRecord.processingRequest.title}</strong>：<AnnotatedText text={caseRecord.processingRequest.simpleFact} /></p>
            <p className="processing-note"><strong>処理上の注意：</strong><AnnotatedText text={caseRecord.processingRequest.warning} /></p>
          </div>
        </section>
        <section>
          <h3>操作主体候補</h3>
          <ul>
            {caseRecord.operatorCandidates.map((candidate) => (
              <li key={candidate.id}><strong>{candidate.candidate}</strong>：{candidate.simpleFact}</li>
            ))}
          </ul>
        </section>
        <p className="warning-text">操作主体が確定できません。判断は不可逆です。</p>
        <button onClick={onNext}>調査を開始</button>
      </section>
    </Shell>
  );
}

type InvestigationProps = {
  caseRecord: CaseRecord;
  selectedNode: MemoryNode | null;
  selectedNodeId: string | null;
  visitedNodeIds: string[];
  pinnedNodeIds: string[];
  taggedNodes: TaggedNodes;
  resources: number;
  executedActionIds: string[];
  systemLogs: string[];
  guidance: CurrentGuidance;
  requirements: JudgmentRequirement[];
  canJudge: boolean;
  onSelectNode: (nodeId: string) => void;
  onTogglePin: (nodeId: string) => void;
  onToggleTag: (node: MemoryNode, tag: ContradictionTag) => void;
  onExecuteAction: (actionId: string) => void;
  onJudge: () => void;
  feedback: string | null;
};

function GuidancePanel({ guidance }: { guidance: CurrentGuidance }) {
  return (
    <section className={`pane-section guidance-panel guidance-${guidance.phase}`} aria-live="polite">
      <p className="eyebrow">次の監査手順</p>
      <h3>{guidance.title}</h3>
      <p className="guidance-instruction">{guidance.instruction}</p>
      <p className="guidance-action"><span>実行</span>{guidance.action}</p>
      <small>{guidance.resourceNote}</small>
    </section>
  );
}

function getAnalysisConditionItems(caseRecord: CaseRecord, condition: AnalysisUnlockCondition, props: Pick<InvestigationProps, 'visitedNodeIds' | 'pinnedNodeIds' | 'taggedNodes'>) {
  const taggedNodeIds = Object.entries(props.taggedNodes).filter(([, tags]) => tags.length > 0).map(([nodeId]) => nodeId);

  switch (condition.type) {
    case 'visited_nodes':
      return condition.nodeIds.map((nodeId) => ({
        completed: props.visitedNodeIds.includes(nodeId),
        label: caseRecord.nodes.find((node) => node.id === nodeId)?.title ?? nodeId,
      }));
    case 'pinned_any':
      return [{ completed: props.pinnedNodeIds.length >= condition.count, label: `任意の記録を${condition.count}件以上提出根拠に登録` }];
    case 'tagged_any':
      return [{ completed: taggedNodeIds.length >= condition.count, label: `任意の記録を${condition.count}件以上矛盾分類` }];
    case 'tagged_node':
      return [{
        completed: taggedNodeIds.includes(condition.nodeId),
        label: `${caseRecord.nodes.find((node) => node.id === condition.nodeId)?.title ?? condition.nodeId}を矛盾分類`,
      }];
  }
}

function InvestigationActionControl(props: {
  caseRecord: CaseRecord;
  action: InvestigationAction;
  executed: boolean;
  onExecute: (actionId: string) => void;
  pinnedNodeIds: string[];
  resources: number;
  taggedNodes: TaggedNodes;
  visitedNodeIds: string[];
}) {
  const unlocked = isInvestigationActionUnlocked(props);
  const requirements = (props.action.unlockConditions ?? []).flatMap((condition) => getAnalysisConditionItems(props.caseRecord, condition, props));

  return (
    <div className={`analysis-action ${unlocked ? 'unlocked' : 'locked'}`}>
      <button onClick={() => props.onExecute(props.action.id)} disabled={props.executed || props.resources === 0 || !unlocked} title={props.action.description}>
        {props.executed ? `実行済：${props.action.title}` : props.action.title}
      </button>
      {!props.executed && !unlocked && (
        <div className="analysis-requirements">
          <small>状態：未解放</small>
          <strong>必要記録：</strong>
          {requirements.map((requirement) => (
            <span className={requirement.completed ? 'complete' : ''} key={requirement.label}>
              {requirement.completed ? '✓' : '□'} {requirement.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceGauge({ caseRecord, resources }: { caseRecord: CaseRecord; resources: number }) {
  return (
    <div className={`resource-gauge ${resources === 0 ? 'depleted' : resources === 1 ? 'low' : ''}`} aria-label={`監査リソース ${resources} / ${caseRecord.auditResourceMax}`}>
      <span className="resource-blocks" aria-hidden="true">
        {Array.from({ length: caseRecord.auditResourceMax }, (_, index) => <i className={index < resources ? 'filled' : ''} key={index} />)}
      </span>
      <strong>{resources} / {caseRecord.auditResourceMax}</strong>
    </div>
  );
}

function OperationToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="operation-toast" role="status" aria-live="polite">
      <span>SYS</span>
      <strong>{message}</strong>
    </div>
  );
}

function InvestigationScreen(props: InvestigationProps) {
  const { caseRecord } = props;
  const selectedNode = props.selectedNode;
  const suggestedTags = selectedNode?.suggestedTags ?? [];
  const eligibleForTags = suggestedTags.length > 0;
  const taggedNodeCount = Object.values(props.taggedNodes).filter((tags) => tags.length > 0).length;
  const pinnedNodes = caseRecord.nodes.filter((node) => props.pinnedNodeIds.includes(node.id));
  const analysisReports = selectedNode
    ? caseRecord.actions.filter((action) => (
        props.executedActionIds.includes(action.id)
        && action.targetNodeIds?.includes(selectedNode.id)
        && action.reportText
      ))
    : [];
  const hasExecutableAnalysis = caseRecord.actions.some((action) => (
    !props.executedActionIds.includes(action.id)
    && props.resources > 0
    && isInvestigationActionUnlocked({
      action,
      visitedNodeIds: props.visitedNodeIds,
      pinnedNodeIds: props.pinnedNodeIds,
      taggedNodes: props.taggedNodes,
    })
  ));
  const analysisStatus = hasExecutableAnalysis
    ? '実行可能あり'
    : props.executedActionIds.length > 0
      ? '実行済'
      : '未解放';
  const requirementLabels: Record<JudgmentRequirement['id'], string> = {
    nodes: '必要ノード確認',
    pins: '判断根拠',
    tags: '矛盾分類',
  };

  return (
    <main className="app-shell game-grid">
      <aside className="pane left-pane">
        <div className="hud-panel-label"><span>01</span> CASE INDEX</div>
        <p className="eyebrow">{caseRecord.organizationName} / {caseRecord.id.toUpperCase()}</p>
        <h2>{caseRecord.title}</h2>
        <GuidancePanel guidance={props.guidance} />
        <section className="pane-section compact-progress status-chip-row" aria-label="監査進行">
          <span className={props.visitedNodeIds.length >= caseRecord.requiredNodesToJudge ? 'status-chip valid' : 'status-chip muted'}>必要ノード確認 <strong>{props.visitedNodeIds.length}/{caseRecord.requiredNodesToJudge}</strong></span>
          <span className={props.pinnedNodeIds.length >= 1 ? 'status-chip valid' : 'status-chip muted'}>提出根拠 <strong>{props.pinnedNodeIds.length}/1</strong></span>
          <span className={taggedNodeCount >= 1 ? 'status-chip valid' : 'status-chip warning'}>矛盾分類 <strong>{taggedNodeCount}/1</strong></span>
          <span className={props.resources === 0 ? 'status-chip critical' : props.resources <= 1 ? 'status-chip warning' : 'status-chip muted'}>監査リソース <strong>{props.resources}/{caseRecord.auditResourceMax}</strong></span>
        </section>
        <section className="pane-section memory-node-index" aria-labelledby="memory-node-index-title">
          <div className="node-index-heading">
            <h3 id="memory-node-index-title">争点別 記憶ノード</h3>
            <small>未確認 {caseRecord.nodes.length - props.visitedNodeIds.length}</small>
          </div>
          <div className="issue-list">
            {caseRecord.issues.map((issue) => {
              const reviewedCount = issue.relatedNodeIds.filter((nodeId) => props.visitedNodeIds.includes(nodeId)).length;
              const submittedCount = issue.relatedNodeIds.filter((nodeId) => props.pinnedNodeIds.includes(nodeId)).length;

              return (
                <section className="issue-group" key={issue.id}>
                  <div className="issue-heading">
                    <span>争点 {issue.id}</span>
                    <h4>{issue.title}</h4>
                    <details className="inline-details">
                      <summary>争点詳細を表示</summary>
                      <p>{issue.description}</p>
                      <div className="issue-progress" aria-label={`${issue.title}の監査進捗`}>
                        <span>確認 {reviewedCount} / {issue.relatedNodeIds.length}</span>
                        <span>根拠 {submittedCount}</span>
                      </div>
                    </details>
                  </div>
                  <div className="memory-node-list">
                    {issue.relatedNodeIds.map((nodeId) => {
                      const node = caseRecord.nodes.find((item) => item.id === nodeId);
                      if (!node) return null;
                      const isSelected = node.id === props.selectedNodeId;
                      const isVisited = props.visitedNodeIds.includes(node.id);
                      const isPinned = props.pinnedNodeIds.includes(node.id);
                      const isTagged = (props.taggedNodes[node.id]?.length ?? 0) > 0;

                      return (
                        <button
                          className={`memory-node-item ${isSelected ? 'selected' : isVisited ? 'visited' : 'unvisited'} importance-${node.importance} ${node.hasContradiction ? 'has-contradiction' : ''}`}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => props.onSelectNode(node.id)}
                          key={`${issue.id}-${node.id}`}
                        >
                          <strong>{node.title}</strong>
                          <span className="node-state-badges">
                            <i>{isVisited ? '確認済' : '未確認'}</i>
                            {node.importance !== 'standard' && <i>{importanceLabels[node.importance]}重要</i>}
                            {node.hasContradiction && <i>矛盾あり</i>}
                            {isSelected && <i>選択中</i>}
                            {isPinned && <i>根拠提出済</i>}
                            {isTagged && <i>矛盾分類済</i>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
        <details className="pane-section disclosure-card">
          <summary>事件・監査情報を表示</summary>
          <h3>事件概要</h3>
          <p className="case-subtitle">{caseRecord.subtitle}</p>
          <p>{caseRecord.overview}</p>
          <h3>監査リソース</h3>
          <ResourceGauge caseRecord={props.caseRecord} resources={props.resources} />
          <small>追加解析1件につき1消費。最終判断は残数0でも可能。</small>
          {props.resources === 0 && <p className="warning-text">監査リソース不足：追加解析を実行できません。</p>}
          <h3>初期都市ステータス</h3>
          <StatusBars stats={caseRecord.initialStats} />
        </details>
      </aside>

      <section className="center-pane">
        <div className="hud-panel-label network-panel-label"><span>02</span> MEMORY NETWORK</div>
        <div className="network-caption">
          <span>Memory Network</span>
          <small className="network-action-cue"><span aria-hidden="true">◎</span> ノードをクリックして記録を開く / 色で重要度を表示</small>
          <div className="network-state-legend" aria-label="ノード監査状態">
            <span><i className="legend-dot unreviewed" />未読</span>
            <span><i className="legend-dot reviewed" />既読</span>
            <span><i className="legend-ring double" />選択中</span>
            <span><i className="legend-frame" />根拠提出済</span>
            <span><i className="legend-ring closed" />矛盾分類済</span>
            <span><i className="legend-halo" />矛盾未分類</span>
          </div>
          <div className="importance-legend" aria-label="問題の重要度">
            {(Object.entries(importanceLabels) as [NodeImportance, string][]).map(([importance, label]) => (
              <span className={`importance-key ${importance}`} key={importance}><i />{label}</span>
            ))}
          </div>
        </div>
        <MemoryNetwork actions={caseRecord.actions} nodes={caseRecord.nodes} selectedNodeId={props.selectedNodeId} visitedNodeIds={props.visitedNodeIds} pinnedNodeIds={props.pinnedNodeIds} taggedNodes={props.taggedNodes} executedActionIds={props.executedActionIds} onSelectNode={props.onSelectNode} />
      </section>

      <aside className="pane right-pane">
        <div className="hud-panel-label"><span>03</span> EVIDENCE DETAIL</div>
        {!selectedNode ? (
          <section className="empty-node-detail" aria-live="polite">
            <p className="eyebrow">選択ノード要約</p>
            <h2>記憶ノードを選択してください</h2>
            <p>左の争点別ノード一覧、または中央の Memory Network から記録を開けます</p>
          </section>
        ) : <>
          <section className="node-header">
            <p className="evidence-id">EVIDENCE ID / {selectedNode.id}</p>
            <p className="eyebrow">選択ノード要約</p>
            <h2>{selectedNode.title}</h2>
          </section>
          <section className="record-status-bar" aria-label="選択記録の状態">
            <div className="record-status-heading"><span>RECORD STATUS</span><small>{selectedNode.type}</small></div>
            <div className="record-status-chips">
              <span className="status-chip valid">{props.visitedNodeIds.includes(selectedNode.id) ? '確認済' : '未確認'}</span>
              <span className={`status-chip importance-${selectedNode.importance}`}>{importanceLabels[selectedNode.importance]}</span>
              <span className={`status-chip ${props.pinnedNodeIds.includes(selectedNode.id) ? 'valid' : 'muted'}`}>{props.pinnedNodeIds.includes(selectedNode.id) ? '根拠提出済' : '根拠未提出'}</span>
              <span className={`status-chip ${(props.taggedNodes[selectedNode.id]?.length ?? 0) > 0 ? 'valid' : eligibleForTags ? 'warning' : 'muted'}`}>
                {(props.taggedNodes[selectedNode.id]?.length ?? 0) > 0 ? '矛盾分類済' : eligibleForTags ? '矛盾未分類' : '分類対象外'}
              </span>
            </div>
          </section>
          <section className="pane-section node-summary">
            <p><AnnotatedText text={selectedNode.summary} /></p>
          </section>
          <section className="pane-section priority-actions" aria-label="判断根拠と矛盾分類">
            <div className="pin-box">
              <h3>判断根拠</h3>
              <button onClick={() => props.onTogglePin(selectedNode.id)} disabled={!props.pinnedNodeIds.includes(selectedNode.id) && props.pinnedNodeIds.length >= 3}>
                {props.pinnedNodeIds.includes(selectedNode.id) ? '判断根拠から外す' : '判断根拠に追加'}
              </button>
              <small>{pinnedNodes.length ? `提出済み ${pinnedNodes.length} / 3` : '最低1件を提出'}</small>
            </div>
            {eligibleForTags ? (
              <div className="tag-box">
                <h3>矛盾分類</h3>
                <div className="tag-actions">
                  {suggestedTags.map((tag) => (
                    <button className={props.taggedNodes[selectedNode.id]?.includes(tag) ? 'active' : ''} key={tag} onClick={() => props.onToggleTag(selectedNode, tag)}>
                      {contradictionTagLabels[tag]}
                    </button>
                  ))}
                </div>
              </div>
            ) : <small>この記録に分類可能な矛盾は検出されていません</small>}
          </section>
          <section className="pane-section right-city-status">
            <h3>都市ステータス</h3>
            <StatusBars stats={caseRecord.initialStats} />
          </section>
          <section className="pane-section node-core-facts">
            <h3>単純事実</h3>
            <p><AnnotatedText text={selectedNode.simpleFact} /></p>
          </section>
          {selectedNode.inspectorNote.trim() !== '' && (
            <section className="pane-section inspector-note">
              <h3>監査官メモ</h3>
              <TypewriterText text={selectedNode.inspectorNote} speed={14} animateKey={`note-${selectedNode.id}`} />
            </section>
          )}
          {selectedNode.warningLevel === 'critical' && selectedNode.warning.trim() !== '' && (
            <section className="pane-section node-warning">
              <h3>警告</h3>
              <p className="warning-text"><AnnotatedText text={selectedNode.warning} /></p>
            </section>
          )}
          <details className="pane-section disclosure-card node-record-details">
            <summary>詳細記録を表示</summary>
            <h3>詳細ログ</h3>
            <code>{selectedNode.log}</code>
            <div className="record-state">
              <p><span>記録状態：</span><strong>{props.visitedNodeIds.includes(selectedNode.id) ? '確認済' : '未確認'}</strong></p>
              <p><span>記録種別：</span>{selectedNode.type}</p>
            </div>
            <div className="node-badges">
              <span className={`importance ${selectedNode.importance}`}>重要度：{importanceLabels[selectedNode.importance]}</span>
            </div>
            <dl className="metrics">
              {Object.entries(selectedNode.metrics).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
            </dl>
            {selectedNode.auditHint && (
              <div className="audit-hint">
                <strong>照合ヒント</strong>
                <p><AnnotatedText text={selectedNode.auditHint} /></p>
              </div>
            )}
          </details>
          <section className="pane-section analysis-summary">
            <div><span>追加解析</span><strong>{analysisStatus}</strong></div>
            <div className="analysis-resource-row"><span>監査リソース残数</span><ResourceGauge caseRecord={props.caseRecord} resources={props.resources} /></div>
            <details className="inline-details actions">
              <summary>解析メニューを表示</summary>
              {caseRecord.actions.map((action) => (
                <InvestigationActionControl
                  caseRecord={caseRecord}
                  action={action}
                  executed={props.executedActionIds.includes(action.id)}
                  key={action.id}
                  onExecute={props.onExecuteAction}
                  pinnedNodeIds={props.pinnedNodeIds}
                  resources={props.resources}
                  taggedNodes={props.taggedNodes}
                  visitedNodeIds={props.visitedNodeIds}
                />
              ))}
            </details>
            {analysisReports.length > 0 && (
              <div className="analysis-report" aria-live="polite">
                <strong>追加解析結果</strong>
                {analysisReports.map((action) => <p key={action.id}><AnnotatedText text={action.reportText ?? ''} /></p>)}
              </div>
            )}
          </section>
        </>}
      </aside>

      <OperationToast message={props.feedback} />
      <footer className="bottom-pane">
        <div className="hud-panel-label bottom-panel-label"><span>04</span> JUDGMENT CONSOLE</div>
        <section className="judgment-summary">
          <p className={`judgment-state ${props.canJudge ? 'ready' : 'locked'}`}><span aria-hidden="true" />{props.canJudge ? 'JUDGMENT READY' : 'LOCKED'}</p>
          <div className="judgment-requirements" aria-label="最終判断の開放条件">
            {props.requirements.map((requirement) => (
              <p className={requirement.completed ? 'complete' : 'incomplete'} key={requirement.id}>
                <span>{requirementLabels[requirement.id]}</span>
                <strong>{requirement.detail.split(' ')[0]}</strong>
                <em>{requirement.completed ? '完了' : '未達成'}</em>
              </p>
            ))}
          </div>
          {!props.canJudge && (
            <ul className="judgment-blockers" aria-label="判断できない理由">
              {props.requirements.filter((requirement) => !requirement.completed).map((requirement) => (
                <li key={requirement.id}>{
                  requirement.id === 'nodes' ? '必要なノードを確認してください'
                    : requirement.id === 'pins' ? '判断根拠が未選択です'
                      : '矛盾分類が未完了です'
                }</li>
              ))}
            </ul>
          )}
          <button className={`judge ${props.canJudge ? 'ready' : ''}`} disabled={!props.canJudge} onClick={props.onJudge}>{props.canJudge ? '最終判断へ進む' : '条件を満たすと判断可能'}</button>
        </section>
        <section className="logs audit-log">
          <div className="audit-log-heading"><strong>AUDIT LOG</strong><span>監査ログ / {String(props.systemLogs.length).padStart(2, '0')}</span></div>
          {(() => {
            const latestLog = props.systemLogs.at(-1) ?? 'ログなし';
            return <p className={`latest-log ${isWarningLog(latestLog) ? 'warning-log' : ''}`}><TypewriterText text={latestLog} speed={12} animateKey={`system-log-${props.systemLogs.length}-${latestLog}`} /></p>;
          })()}
          <details className="inline-details">
            <summary>ログを表示</summary>
            <div className="log-list">
              {props.systemLogs.map((log, index) => <p className={isWarningLog(log) ? 'warning-log' : ''} key={`${index}-${log}`}><span>{String(index + 1).padStart(2, '0')}</span>{log}</p>)}
            </div>
          </details>
        </section>
      </footer>
    </main>
  );
}

function StatusBars({ stats }: { stats: CityStats }) {
  return (
    <div className="status-chips" aria-label="都市ステータス">
      {cityStatKeys.map((key) => (
        <span className={`status-chip ${getStatTone(key, stats[key])}`} key={key}>
          {statLabels[key]} <strong>{stats[key]}</strong>
        </span>
      ))}
    </div>
  );
}

function DecisionScreen({ caseRecord, pinnedNodeIds, onBack, onDecide }: { caseRecord: CaseRecord; pinnedNodeIds: string[]; onBack: () => void; onDecide: (decision: DecisionOption) => void }) {
  return (
    <Shell>
      <section className="document-card wide ruling-sheet">
        <header className="ruling-sheet-header">
          <p className="eyebrow">AUDIT RULING / FINAL AUTHORIZATION</p>
          <h2>監査裁定書</h2>
          <p className="irreversible-notice"><span aria-hidden="true">!</span> 判断は不可逆です</p>
          <p>提出根拠と各裁定案が採用する記録、保留する争点、都市ステータスへの影響を照合してください。</p>
        </header>
        <div className="decision-list">
          {caseRecord.decisions.map((option, index) => {
            const acceptedNodes = caseRecord.nodes.filter((node) => option.acceptedEvidenceNodeIds?.includes(node.id));
            const ignoredIssues = caseRecord.issues.filter((issue) => option.ignoredIssueIds?.includes(issue.id));
            const submittedAcceptedCount = acceptedNodes.filter((node) => pinnedNodeIds.includes(node.id)).length;

            const riskLevel = acceptedNodes.length > 0 && submittedAcceptedCount === acceptedNodes.length
              ? 'low'
              : submittedAcceptedCount > 0 ? 'medium' : 'high';

            return (
              <article className={`decision-card ruling-option ruling-risk-${riskLevel}`} key={option.id}>
                <span className="ruling-risk-label">根拠整合リスク：{riskLevel.toUpperCase()}</span>
                <div className="ruling-option-heading">
                  <span className="ruling-option-index">{String.fromCharCode(65 + index)}</span>
                  <div><p className="eyebrow">裁定名 / RULING</p><h3>{option.label}</h3></div>
                </div>
                <section className="decision-processing">
                  <h4>裁定内容</h4>
                  <p><AnnotatedText text={option.processing} /></p>
                </section>
                <section className="decision-values">
                  <p><strong>優先される価値</strong>{option.prioritizedValues.join(' / ')}</p>
                  <p><strong>失われる価値</strong>{option.sacrificedValues.join(' / ')}</p>
                </section>
                <section className="ruling-evidence-section">
                  <div className="decision-section-heading">
                    <h4>採用される根拠</h4>
                    <span>提出根拠一致 {submittedAcceptedCount} / {acceptedNodes.length}</span>
                  </div>
                  {acceptedNodes.map((node) => (
                    <p className={pinnedNodeIds.includes(node.id) ? 'evidence-submitted' : 'evidence-unsubmitted'} key={node.id}>
                      <span>{pinnedNodeIds.includes(node.id) ? '提出済' : '未提出'}</span>{node.title}：{node.simpleFact}
                    </p>
                  ))}
                  {acceptedNodes.length > 0 && submittedAcceptedCount === 0 && (
                    <div className="decision-evidence-warning" role="alert">
                      <strong>提出根拠との不一致</strong>
                      <p>この裁定案は、あなたが提出していない記録を主要根拠に含みます。</p>
                    </div>
                  )}
                </section>
                <section className="ruling-ignored-section">
                  <h4>この裁定で保留・軽視される争点</h4>
                  <ul>{ignoredIssues.map((issue) => <li key={issue.id}><strong>{issue.title}</strong>：{issue.description}</li>)}</ul>
                </section>
                <section>
                  <h4>都市ステータスへの影響</h4>
                  <div className="decision-stat-deltas">
                    {cityStatKeys.map((key) => <span className={option.statDelta[key] >= 0 ? 'delta-plus' : 'delta-minus'} key={key}>{statLabels[key]} {option.statDelta[key] >= 0 ? '+' : ''}{option.statDelta[key]}</span>)}
                  </div>
                </section>
                <button onClick={() => onDecide(option)}>{option.label}を確定</button>
              </article>
            );
          })}
        </div>
        <button className="secondary" onClick={onBack}>調査に戻る</button>
      </section>
    </Shell>
  );
}

function ResultScreen({ caseRecord, decision, finalStats, payload, taggedNodes, actionRiskDeltas, onArchive }: { caseRecord: CaseRecord; decision: DecisionOption; finalStats: CityStats; payload: SavedCaseResult; taggedNodes: TaggedNodes; actionRiskDeltas: Record<string, Partial<CityStats>>; onArchive: () => void }) {
  const pinned = caseRecord.nodes.filter((node) => payload.pinnedNodeIds.includes(node.id));
  const taggedEntries = Object.entries(taggedNodes).filter(([, tags]) => tags.length);

  return (
    <Shell>
      <section className="document-card result wide admin-log">
        <p className="eyebrow archive-eyebrow">AUDIT RULING ARCHIVED</p>
        <h2 className="ruling-title"><span>裁定記録</span><small>IRREVERSIBLE AUDIT RECORD</small></h2>
        <div className="archive-metadata" aria-label="保存記録情報">
          <span>{caseRecord.id.toUpperCase()}</span><span>{caseRecord.recordName}</span><span>{caseRecord.location}</span><strong>保存完了</strong>
        </div>
        <section className="result-summary" aria-label="裁定結果要約">
          <p><span>裁定</span><strong>{decision.finalRuling}</strong></p>
          <p className="saved-value"><span>救った価値（優先）</span><strong>{decision.prioritizedValues.join(' / ')}</strong></p>
          <p className="sacrificed-value"><span>犠牲にした価値（軽視）</span><strong>{decision.sacrificedValues.join(' / ')}</strong></p>
          <p><span>都市ステータス変動</span><strong>{cityStatKeys.map((key) => `${statLabels[key]} ${decision.statDelta[key] >= 0 ? '+' : ''}${decision.statDelta[key]}`).join(' / ')}</strong></p>
        </section>
        <div className={`ruling-stamp ruling-${decision.id}`} aria-label={`裁定印：${decision.resultStampLabel ?? decision.finalRuling}`}>
          <span>都市OS監査室</span>
          <strong>{decision.resultStampLabel ?? decision.finalRuling}</strong>
          <small>FINAL / {caseRecord.id.toUpperCase()}</small>
        </div>
        <p className="city-os-reference-note">この裁定は、以後の未確定人格案件における参照基準として保存されます。</p>
        <div className="result-grid">
          <ResultSection title="処理内容">
            <p><AnnotatedText text={decision.processing} /></p>
          </ResultSection>
          <ResultSection title="提出された判断根拠">
            {pinned.length ? pinned.map((node) => <p key={node.id}>・{node.title}：{node.summary}</p>) : <p>根拠提出なし。</p>}
          </ResultSection>
          <ResultSection title="分類された矛盾">
            {taggedEntries.length ? taggedEntries.map(([nodeId, tags]) => {
              const node = caseRecord.nodes.find((item) => item.id === nodeId);
              return <p key={nodeId}>・{node?.title ?? nodeId}：{tags.map((tag) => contradictionTagLabels[tag]).join(' / ')}</p>;
            }) : <p>矛盾分類なし。</p>}
          </ResultSection>
          <ResultSection title="実行した解析アクション">
            {payload.executedActionIds.length ? payload.executedActionIds.map((id) => {
              const action = caseRecord.actions.find((item) => item.id === id);
              const riskDelta = actionRiskDeltas[id] ?? action?.riskDelta;
              const riskSummary = riskDelta
                ? cityStatKeys.filter((key) => riskDelta[key] !== undefined).map((key) => `${statLabels[key]} ${(riskDelta[key] ?? 0) >= 0 ? '+' : ''}${riskDelta[key]}`).join(' / ')
                : null;
              return <div className="result-action-risk" key={id}>
                <p>・{action?.title ?? id}</p>
                {riskSummary && <p><strong>副作用：</strong>{riskSummary}</p>}
                {action?.riskNote && <p><strong>注記：</strong>{action.riskNote.replace(/^解析副作用：/, '')}</p>}
              </div>;
            }) : <p>追加解析なし。既存記録のみで判断。</p>}
          </ResultSection>
          <ResultSection title="都市ステータス変動">
            <div className="stat-delta-list">
              {cityStatKeys.map((key) => {
                const before = caseRecord.initialStats[key];
                const after = finalStats[key];
                const delta = after - before;
                return <p key={key}>{statLabels[key]}：{before} → {after} <span className={delta >= 0 ? 'delta-plus' : 'delta-minus'}>({delta >= 0 ? '+' : ''}{delta})</span></p>;
              })}
            </div>
            <StatusBars stats={finalStats} />
          </ResultSection>
          <ResultSection title="監査注記">
            <p><AnnotatedText text={decision.auditNote} /></p>
          </ResultSection>
          <ResultSection title="結末文">
            <p className="ending-text"><TypewriterText text={decision.endingText} speed={18} animateKey={decision.id} /></p>
          </ResultSection>
        </div>
        <button className="secondary result-archive-button" onClick={onArchive}>事件選択へ戻る</button>
      </section>
    </Shell>
  );
}

function ResultSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="result-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export default App;
