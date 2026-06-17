import { useEffect, useRef, useState, type ReactNode } from 'react';
import { aggregateAuditTendency } from './auditTendency';
import { applyAuditPressureEvent, createAuditPressureEvent } from './auditPressure';
import { buildAuditReportCheck } from './auditReport';
import { canUnlockJudgment, getCurrentGuidance, getJudgmentRequirements, isInvestigationActionUnlocked, isWarningLog, type CurrentGuidance, type JudgmentRequirement } from './auditRules';
import { case000, cases, contradictionTagLabels } from './data/cases';
import { getCaseContinuityEffect, type CaseContinuityEffect } from './caseContinuity';
import { AnnotatedText } from './components/AnnotatedText';
import { TypewriterText } from './components/TypewriterText';
import { PersonProfile } from './components/PersonProfile';
import { MemoryNetwork } from './MemoryNetwork';
import { loadCaseResults, loadReadFlags, markRead, saveCaseResult } from './storage';
import { auditValueLabels } from './types';
import type { AuditPressureEvent, AuditPressureLevel, AuditPressureState, AuditReportCheck, InvestigationAction, AnalysisUnlockCondition, CaseRecord, CityStats, ContradictionTag, DecisionOption, MemoryNode, SavedCaseResult, Screen, TaggedNodes } from './types';
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



const initialAuditPressure: AuditPressureState = { value: 0, max: 100, level: 'low', events: [] };

type ModalType = 'case_summary' | 'node_detail' | 'decision' | 'audit_hearing' | null;

type ModalState = {
  type: ModalType;
  nodeId?: string;
};

const auditPressureMessages: Record<AuditPressureLevel, string> = {
  low: '処理圧力：低。追加監査は許容範囲内です。',
  medium: '処理圧力：中。都市警備局から裁定予定時刻の再照会あり。',
  high: '処理圧力：高。処理遅延により、行政裁定圧力が上昇しています。',
  critical: '処理圧力：臨界。未確定人格記録の自動処理要求が発生しています。',
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
  const [auditPressure, setAuditPressure] = useState<AuditPressureState>(initialAuditPressure);
  const [modal, setModal] = useState<ModalState>({ type: null });
  const [hearingResolved, setHearingResolved] = useState(false);
  const wasJudgmentReady = useRef(false);

  const selectedNode = caseRecord.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const visitedCount = visitedNodeIds.length;
  const requirements = getJudgmentRequirements({
    visitedNodeCount: visitedCount,
    requiredNodesToJudge: caseRecord.requiredNodesToJudge,
    pinnedNodeCount: pinnedNodeIds.length,
    taggedNodes: hearingResolved ? { ...taggedNodes, '__audit_hearing__': ['operation_subject'] } : taggedNodes,
  });
  const canJudge = canUnlockJudgment({
    visitedNodeCount: visitedCount,
    requiredNodesToJudge: caseRecord.requiredNodesToJudge,
    pinnedNodeCount: pinnedNodeIds.length,
    taggedNodes: hearingResolved ? { ...taggedNodes, '__audit_hearing__': ['operation_subject'] } : taggedNodes,
  });
  const effectiveTaggedNodes = hearingResolved ? { ...taggedNodes, '__audit_hearing__': ['operation_subject'] as ContradictionTag[] } : taggedNodes;
  const taggedNodeCount = Object.values(effectiveTaggedNodes).filter((tags) => tags.length > 0).length;
  const guidance = getCurrentGuidance({
    visitedNodeCount: visitedCount,
    requiredNodesToJudge: caseRecord.requiredNodesToJudge,
    pinnedNodeCount: pinnedNodeIds.length,
    taggedNodeCount,
    resources,
    canJudge,
  });
  const auditReportCheck = buildAuditReportCheck({
    caseRecord,
    visitedNodeIds,
    pinnedNodeIds,
    taggedNodes: effectiveTaggedNodes,
    executedActionIds,
    canJudge,
    auditPressure: { value: auditPressure.value, level: auditPressure.level },
  });
  const finalStats = decision ? addStats(caseRecord.initialStats, decision.statDelta) : caseRecord.initialStats;

  const showFeedback = (message: string) => {
    setFeedback({ id: Date.now(), message });
  };

  const appendLog = (message: string) => setSystemLogs((logs) => [...logs, message].slice(-8));

  const addAuditPressure = (event: AuditPressureEvent) => {
    setAuditPressure((state) => applyAuditPressureEvent(state, event));
    appendLog(event.message);
  };

  useEffect(() => {
    if (canJudge && !wasJudgmentReady.current) {
      showFeedback('JUDGMENT READY');
      const event = createAuditPressureEvent({
        source: 'judgment_ready',
        label: '裁定可能状態',
        delta: 5,
        message: '裁定可能状態を検出。都市OSは最終判断の提出を待機しています。',
      });
      setAuditPressure((state) => applyAuditPressureEvent(state, event));
      setSystemLogs((logs) => [...logs, event.message].slice(-8));
    }
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
      auditPressure: {
        value: auditPressure.value,
        level: auditPressure.level,
      },
    };

    const saved = saveCaseResult(nextResultPayload);
    if (saved) {
      setSavedCaseResults((results) => [...results.filter((item) => item.caseId !== nextResultPayload.caseId), nextResultPayload]);
    }
    setResultPayload(nextResultPayload);
    setDecision(nextDecision);
    setScreen('result');
  };

  const selectNode = (nodeId: string) => {
    const firstReview = !visitedNodeIds.includes(nodeId);
    setSelectedNodeId(nodeId);
    setVisitedNodeIds((ids) => (ids.includes(nodeId) ? ids : [...ids, nodeId]));
    const node = caseRecord.nodes.find((item) => item.id === nodeId);
    appendLog(`記憶ノード確認：${node?.title ?? nodeId}。公定値と監査記録を照合。`);
    if (firstReview) addAuditPressure(createAuditPressureEvent({
      source: 'node_review',
      label: '記憶ノード確認',
      delta: 4,
      message: '処理圧力上昇：記憶ノード確認により、都市警備局の再照会頻度が上昇。',
    }));
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
    if (!removing) {
      addAuditPressure(createAuditPressureEvent({
        source: 'tagging',
        label: '矛盾分類',
        delta: 3,
        message: '処理圧力上昇：矛盾分類が行政処理系へ通知されました。',
      }));
      showFeedback('CONTRADICTION TAGGED');
    }
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
    addAuditPressure(createAuditPressureEvent({
      source: 'analysis',
      label: '追加解析',
      delta: 8,
      message: '処理圧力上昇：追加解析により、処理期限監視が強化されました。',
    }));
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
    setAuditPressure(initialAuditPressure);
    setHearingResolved(false);
    setSystemLogs(['監査室端末を起動。都市OS 基礎公定通知を待機。', `監査対象選択：${nextCase.id.toUpperCase()} / ${nextCase.recordName}。`]);
    setDecision(null);
    setResultPayload(null);
    wasJudgmentReady.current = false;
    setModal({ type: null });
    setScreen('caseOverview');
  }} />;
  if (screen === 'caseOverview') return <CaseOverviewScreen caseRecord={caseRecord} continuityEffect={continuityEffect} onNext={() => {
    if (continuityEffect) appendLog(continuityEffect.investigationLog);
    setScreen('investigation');
  }} />;
  if (screen === 'result' && decision && resultPayload) {
    return <ResultScreen auditPressure={auditPressure} caseRecord={caseRecord} decision={decision} finalStats={finalStats} payload={resultPayload} taggedNodes={taggedNodes} actionRiskDeltas={actionRiskDeltas} onArchive={() => setScreen('caseSelect')} />;
  }

  return (
    <InvestigationScreen
      caseRecord={caseRecord}
      selectedNode={selectedNode}
      selectedNodeId={selectedNodeId}
      visitedNodeIds={visitedNodeIds}
      pinnedNodeIds={pinnedNodeIds}
      taggedNodes={effectiveTaggedNodes}
      resources={resources}
      executedActionIds={executedActionIds}
      systemLogs={systemLogs}
      guidance={guidance}
      requirements={requirements}
      canJudge={canJudge}
      auditPressure={auditPressure}
      auditReportCheck={auditReportCheck}
      modal={modal}
      onOpenModal={setModal}
      onCloseModal={() => setModal({ type: null })}
      onSelectNode={selectNode}
      onTogglePin={togglePin}
      onToggleTag={toggleTag}
      onExecuteAction={executeAction}
      onResolveHearing={(nodeId) => {
        setHearingResolved(true);
        setTaggedNodes((current) => ({ ...current, [nodeId]: Array.from(new Set([...(current[nodeId] ?? []), 'operation_subject'])) }));
        appendLog('監査尋問：記録矛盾を検出。署名一致のみでは操作主体を確定できません。');
        showFeedback('記録矛盾を検出');
      }}
      onDecide={submitDecision}
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
        <div className="boot-telemetry" aria-label="起動前監査状態">
          <span><strong>CASE</strong> CASE000</span>
          <span><strong>SUBJECT</strong> IDENTITY UNRESOLVED</span>
          <span><strong>AUTH</strong> LIMITED</span>
        </div>
        <div className="boot-signal" aria-hidden="true"><i /><i /><i /><i /></div>
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
        <div className="archive-status-strip" aria-label="事件アーカイブ状態">
          <span><strong>{cases.length}</strong>件の監査ファイル</span>
          <span><strong>{completedCaseIds.length}</strong>件の処理済記録</span>
          <span><strong>{tendency.recordedCases === 0 ? '未記録' : `${tendency.recordedCases}件`}</strong>監査傾向</span>
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
        <div className="case-brief-status" aria-label="事件監査条件">
          <span><strong>{caseRecord.id.toUpperCase()}</strong> RECORD OPEN</span>
          <span><strong>{caseRecord.nodes.length}</strong> MEMORY NODES</span>
          <span><strong>{caseRecord.requiredNodesToJudge}</strong> REQUIRED SCANS</span>
          <span><strong>{caseRecord.auditResourceMax}</strong> AUDIT RESOURCES</span>
        </div>
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
  auditPressure: AuditPressureState;
  auditReportCheck: AuditReportCheck;
  modal: ModalState;
  onOpenModal: (modal: ModalState) => void;
  onCloseModal: () => void;
  onSelectNode: (nodeId: string) => void;
  onTogglePin: (nodeId: string) => void;
  onToggleTag: (node: MemoryNode, tag: ContradictionTag) => void;
  onExecuteAction: (actionId: string) => void;
  onResolveHearing: (nodeId: string) => void;
  onDecide: (decision: DecisionOption) => void;
  feedback: string | null;
};

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
  const requiredNodeProgress = Math.min(1, props.visitedNodeIds.length / caseRecord.requiredNodesToJudge);
  const pinnedProgress = Math.min(1, props.pinnedNodeIds.length);
  const taggedProgress = Math.min(1, taggedNodeCount);
  const resourceProgress = caseRecord.auditResourceMax === 0 ? 0 : props.resources / caseRecord.auditResourceMax;
  const analysisReports = selectedNode
    ? caseRecord.actions.filter((action) => (
        props.executedActionIds.includes(action.id)
        && action.targetNodeIds?.includes(selectedNode.id)
        && action.reportText
      ))
    : [];
  const missingRequirements = props.requirements.filter((requirement) => !requirement.completed);
  const blockerText = missingRequirements.map((requirement) => (
    requirement.id === 'nodes' ? '必要なノードを確認してください'
      : requirement.id === 'pins' ? '判断根拠が未選択です'
        : '矛盾分類が未完了です'
  )).join(' / ');
  const compactRequirementText = props.canJudge
    ? '条件達成：最終判断へ進めます'
    : blockerText;
  const visibleActions = selectedNode
    ? caseRecord.actions.filter((action) => (
        action.targetNodeIds?.includes(selectedNode.id)
        && (
          props.executedActionIds.includes(action.id)
          || isInvestigationActionUnlocked({
            action,
            visitedNodeIds: props.visitedNodeIds,
            pinnedNodeIds: props.pinnedNodeIds,
            taggedNodes: props.taggedNodes,
          })
        )
      ))
    : [];

  return (
    <main className="app-shell game-grid streamlined-audit">
      <aside className="pane left-pane progress-pane">
        <div className="hud-panel-label"><span>01</span> CASE INDEX / PROGRESS</div>
        <p className="eyebrow">{caseRecord.id.toUpperCase()}</p>
        <h2>{caseRecord.title}</h2>
        <div className="case-command-strip simplified" aria-label="監査セッション状態">
          <span>{props.visitedNodeIds.length}/{caseRecord.nodes.length} nodes</span>
          <span aria-label="処理圧力">処理圧力 {props.auditPressure.value} / {props.auditPressure.max}</span>
        </div>
        <section className="case-progress-list" aria-label="監査進行">
          <p className={`status-chip progress-chip ${requiredNodeProgress >= 1 ? 'complete' : 'pending'}`}><span>必要ノード確認</span><strong>{props.visitedNodeIds.length}/{caseRecord.requiredNodesToJudge}</strong><b className="progress-track" aria-hidden="true"><b style={{ width: `${requiredNodeProgress * 100}%` }} /></b></p>
          <p className={`status-chip progress-chip ${pinnedProgress >= 1 ? 'complete' : 'pending'}`}><span>判断根拠</span><strong>{props.pinnedNodeIds.length}/1</strong><b className="progress-track" aria-hidden="true"><b style={{ width: `${pinnedProgress * 100}%` }} /></b></p>
          <p className={`status-chip progress-chip ${taggedProgress >= 1 ? 'complete' : 'pending'}`}><span>矛盾分類</span><strong>{taggedNodeCount}/1</strong><b className="progress-track" aria-hidden="true"><b style={{ width: `${taggedProgress * 100}%` }} /></b></p>
          <p className={`status-chip progress-chip ${resourceProgress <= 0.34 ? 'warning' : 'valid'}`}><span>監査リソース</span><strong>{props.resources} / {caseRecord.auditResourceMax}</strong><b className="progress-track" aria-hidden="true"><b style={{ width: `${resourceProgress * 100}%` }} /></b></p>
        </section>
        {caseRecord.auditHearing && <button className="audit-hearing-open" type="button" onClick={() => props.onOpenModal({ type: 'audit_hearing' })}>監査尋問を開く</button>}
        <section className="pane-section guidance-panel compact-guidance"><p className="eyebrow">次の監査手順</p><h3>{props.guidance.title}</h3><p>{props.guidance.instruction}</p></section>
        <button className="secondary compact-case-button" type="button" onClick={() => props.onOpenModal({ type: 'case_summary' })}>事件概要</button>
        <section className="pane-section memory-node-index" aria-labelledby="memory-node-index-title">
          <div className="node-index-heading">
            <h3 id="memory-node-index-title">記憶ノード</h3>
            <small>未確認 {caseRecord.nodes.length - props.visitedNodeIds.length}</small>
          </div>
          <div className="memory-node-list flat-node-list">
            {caseRecord.nodes.map((node) => {
              const isSelected = node.id === props.selectedNodeId;
              const isVisited = props.visitedNodeIds.includes(node.id);
              const isPinned = props.pinnedNodeIds.includes(node.id);
              const isTagged = (props.taggedNodes[node.id]?.length ?? 0) > 0;
              return (
                <button
                  className={`memory-node-item ${isSelected ? 'selected' : isVisited ? 'visited' : 'unvisited'} importance-${node.importance}`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => props.onSelectNode(node.id)}
                  key={node.id}
                >
                  <strong>{node.title}</strong>
                  <span className="node-state-badges">
                    <i>{isSelected ? '選択中' : isVisited ? '確認済' : '未確認'}</i>
                    {isPinned && <i>根拠</i>}
                    {isTagged && <i>分類済</i>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </aside>

      <section className="center-pane memory-main-pane">
        <div className="hud-panel-label network-panel-label"><span>02</span> MEMORY NETWORK</div>
        <div className="network-caption compact-network-caption">
          <span>Memory Network</span>
          <small className="network-action-cue"><span aria-hidden="true">◎</span> ノードをクリック / 色で重要度を表示</small>
          <div className="importance-legend" aria-label="問題の重要度"><span className="importance-key standard"><i />標準</span><span className="importance-key high"><i />高</span><span className="importance-key critical"><i />重大</span></div>
        </div>
        <MemoryNetwork actions={caseRecord.actions} nodes={caseRecord.nodes} selectedNodeId={props.selectedNodeId} visitedNodeIds={props.visitedNodeIds} pinnedNodeIds={props.pinnedNodeIds} taggedNodes={props.taggedNodes} executedActionIds={props.executedActionIds} onSelectNode={props.onSelectNode} />
      </section>

      <aside className="pane right-pane focused-detail-pane">
        <div className="hud-panel-label"><span>03</span> EVIDENCE DETAIL / NODE DETAIL</div>
        {!selectedNode ? (
          <section className="empty-node-detail" aria-live="polite">
            <h2>記憶ノードを選択してください</h2>
            <p>左の記憶ノード、または中央の Memory Network から確認対象を選択すると、短い記録・単純事実・警告・操作ボタンがここに展開されます。</p>
            <div className="empty-scan-panel" aria-hidden="true">
              <span>WAITING FOR NODE SIGNAL</span>
              <i /><i /><i />
            </div>
          </section>
        ) : <>
          <section className="node-header compact-node-header">
            <p className="eyebrow">{selectedNode.type}</p>
            <h2>{selectedNode.title}</h2>
            <p className="record-status-line">{props.visitedNodeIds.includes(selectedNode.id) ? '確認済' : '未確認'} / {selectedNode.importance === 'critical' ? '重大' : selectedNode.importance === 'high' ? '重要' : '標準'}</p>
          </section>
          <section className="pane-section node-summary short-record always-visible-detail">
            <h3>記録要約</h3>
            <p><AnnotatedText text={selectedNode.summary} /></p>
            <p><AnnotatedText text={selectedNode.simpleFact} /></p>
          </section>
          {selectedNode.warningLevel === 'critical' && selectedNode.warning.trim() !== '' && (
            <section className="pane-section node-warning" role="alert">
              <h3>重大警告</h3>
              <p className="warning-text"><AnnotatedText text={selectedNode.warning} /></p>
            </section>
          )}
          {selectedNode.warning.trim() !== '' && selectedNode.warningLevel !== 'critical' && <p className="node-warning-line">警告：<AnnotatedText text={selectedNode.warning} /></p>}
          <section className="pane-section priority-actions" aria-label="操作ボタン">
            <button onClick={() => props.onOpenModal({ type: 'node_detail', nodeId: selectedNode.id })}>詳細ログを開く</button>
            <button onClick={() => props.onTogglePin(selectedNode.id)} disabled={!props.pinnedNodeIds.includes(selectedNode.id) && props.pinnedNodeIds.length >= 3}>
              {props.pinnedNodeIds.includes(selectedNode.id) ? '判断根拠から外す' : '判断根拠に追加'}
            </button>
            {eligibleForTags ? suggestedTags.map((tag) => (
              <button className={props.taggedNodes[selectedNode.id]?.includes(tag) ? 'active' : ''} key={tag} onClick={() => props.onToggleTag(selectedNode, tag)}>
                矛盾を分類：{contradictionTagLabels[tag]}
              </button>
            )) : null}
            {visibleActions.length > 0 && (
              <div className="actions compact-analysis-actions">
                {visibleActions.map((action) => (
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
              </div>
            )}
          </section>
          {analysisReports.length > 0 && (
            <section className="pane-section analysis-summary"><div className="analysis-report" aria-live="polite">
              <strong>追加解析結果</strong>
              {analysisReports.map((action) => <p key={action.id}><AnnotatedText text={action.reportText ?? ''} /></p>)}
            </div></section>
          )}
        </>}
      </aside>

      <OperationToast message={props.feedback} />
      <footer className="bottom-pane compact-status-bar"><span className="hud-panel-label bottom-panel-label">JUDGMENT CONSOLE</span>
        <p className={`judgment-state ${props.canJudge ? 'ready' : 'locked'}`}><span aria-hidden="true" />{props.canJudge ? 'JUDGMENT READY：' : 'LOCKED：'}{compactRequirementText}</p>
        <AuditReportPanel report={props.auditReportCheck} />
        <section className="audit-log compact-audit-log" aria-label="監査ログ"><strong>AUDIT LOG</strong><p className={`latest-log ${isWarningLog(props.systemLogs.at(-1) ?? '') ? 'warning-log' : ''}`}>{props.systemLogs.at(-1) ?? 'ログなし'}</p></section>
        {props.canJudge && <button className="judge ready" onClick={() => props.onOpenModal({ type: 'decision' })}>最終判断へ進む</button>}
        {props.auditPressure.level === 'critical' && <p className="audit-pressure-critical" role="alert">{auditPressureMessages.critical}</p>}
        {props.auditPressure.level === 'high' && <span className="status-chip warning">warning: 処理圧力 高</span>}
      </footer>
      <AuditModalLayer {...props} analysisReports={analysisReports} selectedNode={selectedNode} />
    </main>
  );
}

function AuditModalLayer(props: InvestigationProps & { analysisReports: InvestigationAction[]; selectedNode: MemoryNode | null }) {
  const { caseRecord, modal } = props;
  const dialogRef = useRef<HTMLDivElement>(null);
  const modalNode = modal.type === 'node_detail' ? caseRecord.nodes.find((node) => node.id === modal.nodeId) ?? props.selectedNode : null;
  const pinned = caseRecord.nodes.filter((node) => props.pinnedNodeIds.includes(node.id));
  const taggedEntries = Object.entries(props.taggedNodes).filter(([, tags]) => tags.length > 0);

  useEffect(() => {
    if (!modal.type) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onCloseModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modal.type, props]);

  if (!modal.type) return null;

  return (
    <div className="audit-modal-backdrop" onMouseDown={props.onCloseModal}>
      <section className={`audit-modal audit-modal-${modal.type}`} role="dialog" aria-modal="true" tabIndex={-1} ref={dialogRef} onMouseDown={(event) => event.stopPropagation()}>
        <div className="audit-modal-shell-label"><span>OPEN RECORD FILE</span><button type="button" className="audit-modal-close" onClick={props.onCloseModal}>閉じる</button></div>
        {modal.type === 'case_summary' && (
          <>
            <p className="eyebrow">事件概要 / CASE SUMMARY</p>
            <h2>{caseRecord.id.toUpperCase()}：{caseRecord.title}</h2>
            <p className="case-subtitle">{caseRecord.subtitle}</p>
            <p><AnnotatedText text={caseRecord.overview} /></p>
            <section className="modal-grid">
              <div><h3>関係者一覧</h3>{caseRecord.personLogs.map((person) => <p key={person.id}><strong>{person.name}</strong>：{person.role}</p>)}</div>
              <div><h3>判断に必要な条件</h3>{props.requirements.map((requirement) => <p className={requirement.completed ? 'modal-complete' : 'modal-incomplete'} key={requirement.id}>{requirement.completed ? '✓' : '□'} {requirement.label}</p>)}</div>
            </section>
          </>
        )}
        {modal.type === 'node_detail' && modalNode && (
          <>
            <p className="eyebrow">詳細ログ / NODE DETAIL</p>
            <h2>{modalNode.title}</h2>
            <code>{modalNode.log}</code>
            <h3>監査数値</h3>
            <dl className="metrics">{Object.entries(modalNode.metrics).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
            <h3>監査室注記</h3>
            <p><AnnotatedText text={modalNode.auditHint || modalNode.inspectorNote || '追加注記なし。'} /></p>
            {props.analysisReports.length > 0 && <div className="analysis-report">{props.analysisReports.map((action) => <p key={action.id}><AnnotatedText text={action.reportText ?? ''} /></p>)}</div>}
            <div className="modal-actions">
              <button onClick={() => props.onTogglePin(modalNode.id)} disabled={!props.pinnedNodeIds.includes(modalNode.id) && props.pinnedNodeIds.length >= 3}>{props.pinnedNodeIds.includes(modalNode.id) ? '判断根拠から外す' : '判断根拠に追加'}</button>
              <button className="secondary" onClick={props.onCloseModal}>閉じる</button>
            </div>
          </>
        )}
        {modal.type === 'audit_hearing' && caseRecord.auditHearing && (
          <AuditHearingModalContent
            hearing={caseRecord.auditHearing}
            nodes={caseRecord.nodes}
            pinnedNodeIds={props.pinnedNodeIds}
            onBack={props.onCloseModal}
            onResolve={props.onResolveHearing}
          />
        )}
        {modal.type === 'decision' && (
          <DecisionModalContent auditPressure={props.auditPressure} auditReportCheck={props.auditReportCheck} caseRecord={caseRecord} pinnedNodeIds={props.pinnedNodeIds} pinnedNodes={pinned} taggedEntries={taggedEntries} onBack={props.onCloseModal} onDecide={props.onDecide} />
        )}
      </section>
    </div>
  );
}


function AuditHearingModalContent({ hearing, nodes, pinnedNodeIds, onBack, onResolve }: { hearing: NonNullable<CaseRecord['auditHearing']>; nodes: MemoryNode[]; pinnedNodeIds: string[]; onBack: () => void; onResolve: (nodeId: string) => void }) {
  const [activeStatementId, setActiveStatementId] = useState(hearing.statements[0]?.id ?? '');
  const [presenting, setPresenting] = useState(false);
  const [message, setMessage] = useState('供述ログを確認し、判断根拠との不一致を照合してください。');
  const [resolved, setResolved] = useState(false);
  const pinnedNodes = nodes.filter((node) => pinnedNodeIds.includes(node.id));
  const activeStatement = hearing.statements.find((statement) => statement.id === activeStatementId) ?? hearing.statements[0];
  const validContradictionNodeIds = new Set(['missing-memory', 'arm-history']);

  const presentNode = (node: MemoryNode) => {
    if (activeStatement?.id === 'provisional-subject' && validContradictionNodeIds.has(node.id)) {
      setResolved(true);
      setPresenting(false);
      setMessage('記録矛盾を検出。署名一致のみでは、操作主体を確定できません。');
      onResolve(node.id);
      return;
    }
    setMessage('この証拠では供述を崩せません');
  };

  return (
    <>
      <p className="eyebrow">監査尋問 / AUDIT HEARING</p>
      <h2>{hearing.title}</h2>
      <p className={`hearing-status ${resolved ? 'resolved' : ''}`} role="status">{message}</p>
      <div className="hearing-statements" aria-label="供述ログ">
        {hearing.statements.map((statement, index) => (
          <button className={statement.id === activeStatement?.id ? 'active' : ''} type="button" key={statement.id} onClick={() => { setActiveStatementId(statement.id); setPresenting(false); setMessage(statement.hint ?? '供述ログを照合中。'); }}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{statement.text}</strong>
          </button>
        ))}
      </div>
      {presenting && (
        <section className="pinned-evidence-picker" aria-label="提示する判断根拠">
          <h3>提示する判断根拠</h3>
          {pinnedNodes.length ? pinnedNodes.map((node) => <button type="button" key={node.id} onClick={() => presentNode(node)}>{node.title}</button>) : <p>ピン留め済み判断根拠がありません。</p>}
        </section>
      )}
      <div className="modal-actions hearing-actions">
        <button type="button" onClick={() => setMessage(activeStatement?.hint ?? '供述ログを追及しました。')}>追及</button>
        <button type="button" onClick={() => setPresenting((value) => !value)}>証拠を提示</button>
        <button className="secondary" type="button" onClick={onBack}>記録に戻る</button>
      </div>
    </>
  );
}

function DecisionModalContent({ auditPressure, auditReportCheck, caseRecord, pinnedNodeIds, pinnedNodes, taggedEntries, onBack, onDecide }: { auditPressure: AuditPressureState; auditReportCheck: AuditReportCheck; caseRecord: CaseRecord; pinnedNodeIds: string[]; pinnedNodes: MemoryNode[]; taggedEntries: [string, ContradictionTag[]][]; onBack: () => void; onDecide: (decision: DecisionOption) => void }) {
  return (
    <>
      <p className="eyebrow">AUDIT RULING / FINAL AUTHORIZATION</p>
      <h2>最終判断</h2>
      <p className="irreversible-notice"><span aria-hidden="true">!</span> 判断は不可逆です</p>
      <section className="modal-grid">
        <div><h3>提出された判断根拠</h3>{pinnedNodes.length ? pinnedNodes.map((node) => <p key={node.id}>・{node.title}：{node.summary}</p>) : <p>根拠提出なし。</p>}</div>
        <div><h3>分類済み矛盾</h3>{taggedEntries.length ? taggedEntries.map(([nodeId, tags]) => {
          const node = caseRecord.nodes.find((item) => item.id === nodeId);
          return <p key={nodeId}>・{node?.title ?? nodeId}：{tags.map((tag) => contradictionTagLabels[tag]).join(' / ')}</p>;
        }) : <p>矛盾分類なし。</p>}</div>
      </section>
      <p>{auditReportCheck.summary} / 処理圧力 {auditPressure.value} ({auditPressure.level.toUpperCase()})</p>
      <div className="decision-list modal-decision-list">
        {caseRecord.decisions.map((option, index) => {
          const acceptedNodes = caseRecord.nodes.filter((node) => option.acceptedEvidenceNodeIds?.includes(node.id));
          const submittedAcceptedCount = acceptedNodes.filter((node) => pinnedNodeIds.includes(node.id)).length;
          const ignoredIssues = caseRecord.issues.filter((issue) => option.ignoredIssueIds?.includes(issue.id));
          const evidenceMismatch = acceptedNodes.length > 0 && submittedAcceptedCount === 0;
          const riskLevel = acceptedNodes.length > 0 && submittedAcceptedCount === acceptedNodes.length ? 'low' : submittedAcceptedCount > 0 ? 'medium' : 'high';
          return <article className={`decision-card ruling-option ruling-risk-${riskLevel}`} key={option.id}><span className="ruling-risk-label">根拠整合リスク：{riskLevel.toUpperCase()}</span><h3>{option.label}</h3><section className="decision-processing"><h4>裁定内容</h4><p><AnnotatedText text={option.processing} /></p></section><p><strong>優先される価値</strong>{option.prioritizedValues.join(' / ')}</p><p><strong>失われる価値</strong>{option.sacrificedValues.join(' / ')}</p><section className="ruling-evidence-section"><h4>採用される根拠</h4><p>提出根拠一致 {submittedAcceptedCount} / {acceptedNodes.length}</p></section>{evidenceMismatch && <div className="decision-evidence-warning" role="alert"><strong>提出根拠との不一致</strong><p>この裁定案は、あなたが提出していない記録を主要根拠に含みます。</p></div>}<section><h4>都市ステータスへの影響</h4><div className="decision-stat-deltas">{cityStatKeys.map((key) => <span className={option.statDelta[key] >= 0 ? 'delta-plus' : 'delta-minus'} key={key}>{statLabels[key]} {option.statDelta[key] >= 0 ? '+' : ''}{option.statDelta[key]}</span>)}</div></section><section className="ruling-ignored-section"><h4>この裁定で保留・軽視される争点</h4><ul>{ignoredIssues.map((issue) => <li key={issue.id}>{issue.title}</li>)}</ul></section><button onClick={() => onDecide(option)}>{option.label.startsWith(`${String.fromCharCode(65 + index)}.`) ? option.label : `${String.fromCharCode(65 + index)}. ${option.label}`}を確定</button></article>;
        })}
      </div>
      <button className="secondary" onClick={onBack}>戻る</button>
    </>
  );
}


function AuditReportPanel({ report }: { report: AuditReportCheck }) {
  const primaryWarning = report.warnings[0];

  return (
    <section className={`audit-report-check compact-report audit-report-${report.state}`} aria-label="監査報告書チェック">
      <strong>監査報告書チェック：{report.state === 'insufficient' ? '裁定条件未達' : '裁定可能'}</strong>
      <span>記録 {report.reviewedNodes}/{report.totalNodes}</span>
      <span>根拠 {report.pinnedEvidence}</span>
      <span>分類 {report.taggedContradictions}</span>
      {primaryWarning && <span className="report-warning">{primaryWarning}</span>}
    </section>
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

function ResultScreen({ auditPressure, caseRecord, decision, finalStats, payload, taggedNodes, actionRiskDeltas, onArchive }: { auditPressure: AuditPressureState; caseRecord: CaseRecord; decision: DecisionOption; finalStats: CityStats; payload: SavedCaseResult; taggedNodes: TaggedNodes; actionRiskDeltas: Record<string, Partial<CityStats>>; onArchive: () => void }) {
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
          <ResultSection title="処理圧力">
            <p>最終処理圧力：{payload.auditPressure?.value ?? auditPressure.value} / {auditPressure.max}</p>
            <p>圧力状態：{(payload.auditPressure?.level ?? auditPressure.level).toUpperCase()}</p>
            <h4>圧力イベント履歴：直近5件</h4>
            {auditPressure.events.slice(-5).map((event) => <p key={event.id}>・{event.label}：+{event.delta}</p>)}
          </ResultSection>
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
