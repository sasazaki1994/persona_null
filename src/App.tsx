import { useEffect, useRef, useState, type ReactNode } from 'react';
import { aggregateAuditTendency } from './auditTendency';
import { applyAuditPressureEvent, auditPressureLevelLabels, auditPressureMessages, createAuditPressureEvent } from './auditPressure';
import { buildAuditReportCheck } from './auditReport';
import { canUnlockJudgment, getCurrentGuidance, getJudgmentRequirements, isInvestigationActionUnlocked, type CurrentGuidance, type JudgmentRequirement } from './auditRules';
import { case000, cases, contradictionTagLabels } from './data/cases';
import { getCaseContinuityEffect, type CaseContinuityEffect } from './caseContinuity';
import { AnnotatedText } from './components/AnnotatedText';
import { TypewriterText } from './components/TypewriterText';
import { PersonProfile } from './components/PersonProfile';
import { Modal } from './components/Modal';
import { MemoryNetwork } from './MemoryNetwork';
import { loadCaseResults, loadReadFlags, markRead, saveCaseResult } from './storage';
import { auditValueLabels } from './types';
import type { AuditPressureEvent, AuditPressureState, AuditReportCheck, InvestigationAction, AnalysisUnlockCondition, CaseRecord, CityStats, ContradictionTag, DecisionOption, MemoryNode, PersonLog, SavedCaseResult, Screen, TaggedNodes } from './types';
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

type ModalType = 'case_summary' | 'node_detail' | 'decision' | 'audit_hearing' | 'person_roster' | 'person_detail' | null;

type ModalState = {
  type: ModalType;
  nodeId?: string;
  personId?: string;
};

const phaseLabels: Record<CurrentGuidance['phase'], string> = {
  review: '記録確認',
  pin: '根拠選定',
  tag: '矛盾分類',
  judge: '最終裁定',
};

// Defensive filter: keep any production/meta sentence out of player-facing logs.
const metaPatterns = [/プレイヤー/, /Case\s?0\d\d/i, /MVP/, /Jam/, /本編/, /予告/, /シナリオ/];
function stripMetaText(text: string): string {
  return text
    .split('\n')
    .filter((line) => !metaPatterns.some((pattern) => pattern.test(line)))
    .join('\n');
}

function getLegalPersonaStatus(person: { auditLabels?: string[]; metrics: Record<string, string | number>; role: string; summary: string }): string {
  const labelHit = (person.auditLabels ?? []).find((label) => label.includes('法的人格'));
  if (labelHit) return labelHit.split('：').slice(1).join('：') || '未確定';
  const metricHit = Object.entries(person.metrics).find(([key]) => key.includes('法的人格'));
  if (metricHit) return String(metricHit[1]);
  const text = [person.role, person.summary, ...(person.auditLabels ?? []), ...Object.values(person.metrics).map(String)].join(' ');
  return /未確定|不成立|断片|制限|破損/.test(text) ? '未確定' : '照会中';
}

function getPersonRiskBadge(person: { auditLabels?: string[]; metrics: Record<string, string | number> }): string | null {
  const markers = ['未確定', '不成立', '制限', '破損', '欠落'];
  const labelHit = (person.auditLabels ?? []).slice(1).find((label) => markers.some((marker) => label.includes(marker)));
  if (labelHit) return labelHit.replace('：', ' ');
  const metricHit = Object.entries(person.metrics).find(([, value]) => markers.some((marker) => String(value).includes(marker)));
  return metricHit ? `${metricHit[0]} ${metricHit[1]}` : null;
}

function getRelatedNodes(person: { name: string }, nodes: MemoryNode[]): MemoryNode[] {
  const surname = person.name.replace(/[（(].*$/, '').slice(0, 2);
  if (!surname) return [];
  return nodes.filter((node) => `${node.summary}${node.simpleFact}${node.log}`.includes(surname));
}

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
    setModal({ type: 'node_detail', nodeId });
    const node = caseRecord.nodes.find((item) => item.id === nodeId);
    appendLog(`記憶ノード確認：${node?.title ?? nodeId}。公定値と監査記録を照合。`);
    if (firstReview) addAuditPressure(createAuditPressureEvent({
      source: 'node_review',
      label: '記憶ノード確認',
      delta: 4,
      message: '処理圧力上昇：記憶ノード確認により、都市警備局の再照会頻度が上昇。',
    }));
    showFeedback('記録を開いた');
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
  const [personId, setPersonId] = useState<string | null>(null);
  const activePerson = caseRecord.personLogs.find((person) => person.id === personId) ?? null;
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
            <h3>関係者</h3>
            <div className="person-roster" aria-label="関係者一覧">
              {caseRecord.personLogs.map((person) => {
                const legalStatus = getLegalPersonaStatus(person);
                const badge = getPersonRiskBadge(person);
                return (
                  <article className="person-roster-row" key={person.id}>
                    <div className="person-roster-main">
                      <strong>{person.name}</strong>
                      <span className="person-roster-state">{person.role}</span>
                      <span className="person-roster-legal">法的人格ステータス：{legalStatus}</span>
                    </div>
                    <div className="person-roster-side">
                      {badge && <i className="person-roster-badge">{badge}</i>}
                      <button type="button" onClick={() => setPersonId(person.id)}>詳細</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
          <div>
            <h3>処理要求</h3>
            <p><strong>{caseRecord.processingRequest.title}</strong>：<AnnotatedText text={caseRecord.processingRequest.simpleFact} /></p>
            <p className="processing-note"><strong>処理上の注意：</strong><AnnotatedText text={caseRecord.processingRequest.warning} /></p>
          </div>
        </section>
        <p className="warning-text">操作主体が確定できません。判断は不可逆です。</p>
        <button onClick={onNext}>調査を開始</button>
        {activePerson && (
          <Modal label="PERSON RECORD" className="audit-modal-person_detail" onClose={() => setPersonId(null)}>
            <PersonDetailModalContent person={activePerson} nodes={caseRecord.nodes} onBack={() => setPersonId(null)} />
          </Modal>
        )}
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

function AuditReportPanel({ report }: { report: AuditReportCheck }) {
  const primaryWarning = report.warnings[0];
  const statusLabel = report.state === 'insufficient'
    ? '裁定条件未達'
    : report.state === 'pressure_ruling'
      ? '圧力下裁定'
      : report.state === 'ruling_supported'
        ? '要件充足'
        : '裁定可能';

  return (
    <section className={`audit-report-check compact-report audit-report-${report.state}`} aria-label="監査報告書チェック">
      <strong>監査報告書：{statusLabel}</strong>
      <span>記録 {report.reviewedNodes}/{report.totalNodes}</span>
      <span>根拠 {report.pinnedEvidence}</span>
      <span>分類 {report.taggedContradictions}</span>
      {primaryWarning && <span className="report-warning">{primaryWarning}</span>}
    </section>
  );
}

function PressureConsole({ auditPressure, canJudge }: { auditPressure: AuditPressureState; canJudge: boolean }) {
  const levelLabel = auditPressureLevelLabels[auditPressure.level];
  const levelMessage = auditPressureMessages[auditPressure.level];

  return (
    <section className={`pressure-console audit-pressure-${auditPressure.level}`} aria-label="処理圧力状態">
      <div className="pressure-console-head">
        <span className="pressure-console-label">処理圧力</span>
        <strong>{auditPressure.value}/{auditPressure.max}</strong>
        <span className="pressure-console-level">{levelLabel}</span>
        {canJudge && <span className="pressure-console-ready">JUDGMENT READY</span>}
      </div>
      <progress value={auditPressure.value} max={auditPressure.max} aria-hidden="true" />
      <p className="pressure-console-message">{levelMessage}</p>
      {auditPressure.level === 'high' && (
        <p className="audit-pressure-warning" role="status">警告：処理遅延により、行政側から裁定期限の再照会が入っています。</p>
      )}
      {auditPressure.level === 'critical' && (
        <p className="audit-pressure-critical" role="alert">警告：未確定人格記録の行政移送要求が発生しています。強制処理は行われませんが、記録に残ります。</p>
      )}
    </section>
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

function ConditionChip({ label, current, required, done }: { label: string; current: number; required: number; done: boolean }) {
  return (
    <span className={`condition-chip ${done ? 'complete' : 'pending'}`}>
      <i aria-hidden="true">{done ? '✓' : '□'}</i>
      <span>{label}</span>
      <strong>{current}/{required}</strong>
    </span>
  );
}

function InvestigationScreen(props: InvestigationProps) {
  const { caseRecord } = props;
  const taggedNodeCount = Object.values(props.taggedNodes).filter((tags) => tags.length > 0).length;
  const reviewedCount = Math.min(props.visitedNodeIds.length, caseRecord.requiredNodesToJudge);
  const analysisReports = props.selectedNode
    ? caseRecord.actions.filter((action) => (
        props.executedActionIds.includes(action.id)
        && action.targetNodeIds?.includes(props.selectedNode?.id ?? '')
        && action.reportText
      ))
    : [];
  const missingRequirements = props.requirements.filter((requirement) => !requirement.completed);
  const blockerText = missingRequirements.map((requirement) => (
    requirement.id === 'nodes' ? '記録確認が不足'
      : requirement.id === 'pins' ? '判断根拠が未登録'
        : '矛盾分類が未完了'
  )).join(' / ');
  const nextStepLine = props.canJudge
    ? '最終裁定が可能です。上部の「最終裁定へ進む」を選択してください。'
    : props.guidance.instruction;
  const remainingUnread = caseRecord.nodes.length - props.visitedNodeIds.length;

  return (
    <main className="app-shell audit-room">
      <header className="audit-topbar">
        <div className="topbar-case">
          <p className="eyebrow">{caseRecord.id.toUpperCase()} / {caseRecord.recordName}</p>
          <h1>{caseRecord.title}</h1>
          <span className={`phase-chip phase-${props.guidance.phase}`}>監査フェーズ：{phaseLabels[props.guidance.phase]}</span>
        </div>
        <div className="topbar-conditions" aria-label="判断条件">
          <span className="conditions-title">判断条件</span>
          <ConditionChip label="必須記録確認" current={reviewedCount} required={caseRecord.requiredNodesToJudge} done={reviewedCount >= caseRecord.requiredNodesToJudge} />
          <ConditionChip label="判断根拠" current={props.pinnedNodeIds.length} required={1} done={props.pinnedNodeIds.length >= 1} />
          <ConditionChip label="矛盾分類" current={taggedNodeCount} required={1} done={taggedNodeCount >= 1} />
          <span className="resource-chip" aria-label="監査リソース">監査リソース {props.resources}/{caseRecord.auditResourceMax}</span>
          <span className={`pressure-chip pressure-${props.auditPressure.level}`} aria-label="処理圧力">
            処理圧力 {props.auditPressure.value}/{props.auditPressure.max} · {auditPressureLevelLabels[props.auditPressure.level]}
          </span>
        </div>
        <div className="topbar-actions">
          <button className="secondary" type="button" onClick={() => props.onOpenModal({ type: 'case_summary' })}>事件概要</button>
          <button className="secondary" type="button" onClick={() => props.onOpenModal({ type: 'person_roster' })}>関係者照会</button>
          {caseRecord.auditHearing && <button className="secondary" type="button" onClick={() => props.onOpenModal({ type: 'audit_hearing' })}>監査尋問</button>}
          <div className="judge-control">
            <button className={`judge ${props.canJudge ? 'ready' : 'locked'}`} type="button" disabled={!props.canJudge} onClick={() => props.onOpenModal({ type: 'decision' })}>最終裁定へ進む</button>
            {!props.canJudge && <p className="judge-reason" role="status">未達条件：{blockerText}</p>}
          </div>
        </div>
      </header>

      <section className="audit-stage" aria-label="記憶ネットワーク">
        <div className="stage-caption">
          <span className="network-action-cue"><span aria-hidden="true">◎</span> ノードをクリックで記録を開く / 色で重要度を表示</span>
          <span className="stage-unread">未読ノード {remainingUnread} / {caseRecord.nodes.length}</span>
          <div className="importance-legend" aria-label="問題の重要度">
            <span className="importance-key standard"><i />標準</span>
            <span className="importance-key high"><i />高</span>
            <span className="importance-key critical"><i />重大</span>
          </div>
        </div>
        <MemoryNetwork actions={caseRecord.actions} nodes={caseRecord.nodes} selectedNodeId={props.selectedNodeId} visitedNodeIds={props.visitedNodeIds} pinnedNodeIds={props.pinnedNodeIds} taggedNodes={props.taggedNodes} executedActionIds={props.executedActionIds} onSelectNode={props.onSelectNode} />
      </section>

      <footer className="audit-next-step" aria-label="裁定コンソール">
        <div className="next-step-main">
          <span className="next-step-label">次の手続き</span>
          <p className={`next-step-line ${props.canJudge ? 'ready' : ''}`}>{nextStepLine}</p>
        </div>
        <AuditReportPanel report={props.auditReportCheck} />
        <PressureConsole auditPressure={props.auditPressure} canJudge={props.canJudge} />
        <p className="latest-log" aria-label="直近の照合">直近：{props.systemLogs.at(-1) ?? '—'}</p>
      </footer>

      <OperationToast message={props.feedback} />
      <AuditModalLayer {...props} analysisReports={analysisReports} />
    </main>
  );
}

function AuditModalLayer(props: InvestigationProps & { analysisReports: InvestigationAction[] }) {
  const { caseRecord, modal } = props;
  const modalNode = modal.type === 'node_detail' ? caseRecord.nodes.find((node) => node.id === modal.nodeId) ?? props.selectedNode : null;
  const modalPerson = modal.type === 'person_detail' ? caseRecord.personLogs.find((person) => person.id === modal.personId) ?? null : null;
  const pinned = caseRecord.nodes.filter((node) => props.pinnedNodeIds.includes(node.id));
  const taggedEntries = Object.entries(props.taggedNodes).filter(([, tags]) => tags.length > 0);

  if (!modal.type) return null;

  const modalLabels: Record<NonNullable<ModalType>, string> = {
    case_summary: 'CASE SUMMARY',
    node_detail: 'OPEN RECORD FILE',
    decision: 'FINAL AUTHORIZATION',
    audit_hearing: 'AUDIT HEARING',
    person_roster: 'PERSON INDEX',
    person_detail: 'PERSON RECORD',
  };

  return (
    <Modal label={modalLabels[modal.type]} className={`audit-modal-${modal.type}`} onClose={props.onCloseModal}>
      {modal.type === 'case_summary' && (
        <>
          <p className="eyebrow">事件概要 / CASE SUMMARY</p>
          <h2>{caseRecord.id.toUpperCase()}：{caseRecord.title}</h2>
          <p className="case-subtitle">{caseRecord.subtitle}</p>
          <p><AnnotatedText text={caseRecord.overview} /></p>
          <section className="modal-grid">
            <div><h3>関係者一覧</h3>{caseRecord.personLogs.map((person) => <p key={person.id}><strong>{person.name}</strong>：{person.role}</p>)}</div>
            <div><h3>判断に必要な条件</h3>{props.requirements.map((requirement) => <p className={requirement.completed ? 'modal-complete' : 'modal-incomplete'} key={requirement.id}>{requirement.completed ? '✓' : '□'} {requirement.label}（{requirement.detail}）</p>)}</div>
          </section>
        </>
      )}
      {modal.type === 'node_detail' && modalNode && (
        <NodeDetailModalContent
          caseRecord={caseRecord}
          node={modalNode}
          visited={props.visitedNodeIds.includes(modalNode.id)}
          pinnedNodeIds={props.pinnedNodeIds}
          taggedNodes={props.taggedNodes}
          visitedNodeIds={props.visitedNodeIds}
          executedActionIds={props.executedActionIds}
          resources={props.resources}
          analysisReports={props.analysisReports}
          onTogglePin={props.onTogglePin}
          onToggleTag={props.onToggleTag}
          onExecuteAction={props.onExecuteAction}
          onClose={props.onCloseModal}
        />
      )}
      {modal.type === 'person_roster' && (
        <PersonRosterModalContent caseRecord={caseRecord} onOpenPerson={(personId) => props.onOpenModal({ type: 'person_detail', personId })} />
      )}
      {modal.type === 'person_detail' && modalPerson && (
        <PersonDetailModalContent
          person={modalPerson}
          nodes={caseRecord.nodes}
          onBack={() => props.onOpenModal({ type: 'person_roster' })}
          onOpenNode={props.onSelectNode}
        />
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
    </Modal>
  );
}

function NodeDetailModalContent(props: {
  caseRecord: CaseRecord;
  node: MemoryNode;
  visited: boolean;
  pinnedNodeIds: string[];
  taggedNodes: TaggedNodes;
  visitedNodeIds: string[];
  executedActionIds: string[];
  resources: number;
  analysisReports: InvestigationAction[];
  onTogglePin: (nodeId: string) => void;
  onToggleTag: (node: MemoryNode, tag: ContradictionTag) => void;
  onExecuteAction: (actionId: string) => void;
  onClose: () => void;
}) {
  const { node, caseRecord } = props;
  const suggestedTags = node.suggestedTags ?? [];
  const importanceLabel = node.importance === 'critical' ? '重大' : node.importance === 'high' ? '重要' : '標準';
  const showWarning = node.warning.trim() !== '' && (node.warningLevel === 'critical' || node.warningLevel === 'notice');
  const isPinned = props.pinnedNodeIds.includes(node.id);
  const pinFull = !isPinned && props.pinnedNodeIds.length >= 3;
  const visibleActions = caseRecord.actions.filter((action) => (
    action.targetNodeIds?.includes(node.id)
    && (
      props.executedActionIds.includes(action.id)
      || isInvestigationActionUnlocked({
        action,
        visitedNodeIds: props.visitedNodeIds,
        pinnedNodeIds: props.pinnedNodeIds,
        taggedNodes: props.taggedNodes,
      })
    )
  ));

  return (
    <>
      <p className="eyebrow">{node.type}</p>
      <h2>{node.title}</h2>
      <p className="record-status-line">{props.visited ? '確認済' : '未確認'} / {importanceLabel}</p>
      <section className="node-summary">
        <h3>記録要約</h3>
        <p><AnnotatedText text={node.summary} /></p>
        <p><AnnotatedText text={node.simpleFact} /></p>
      </section>
      {showWarning && (
        <section className={`node-warning ${node.warningLevel === 'critical' ? 'critical' : 'notice'}`} role="alert">
          <h3>{node.warningLevel === 'critical' ? '重大警告' : '注意'}</h3>
          <p className="warning-text"><AnnotatedText text={node.warning} /></p>
        </section>
      )}
      <section className="node-log-section">
        <h3>詳細ログ</h3>
        <code>{stripMetaText(node.log)}</code>
      </section>
      <section className="node-metrics-section">
        <h3>監査数値</h3>
        <dl className="metrics">{Object.entries(node.metrics).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
      </section>
      <section className="inspector-note">
        <h3>監査官メモ</h3>
        <p><AnnotatedText text={node.auditHint || node.inspectorNote || '追加注記なし。'} /></p>
      </section>
      {props.analysisReports.length > 0 && (
        <section className="analysis-summary"><div className="analysis-report" aria-live="polite"><strong>追加照合結果</strong>{props.analysisReports.map((action) => <p key={action.id}><AnnotatedText text={action.reportText ?? ''} /></p>)}</div></section>
      )}
      <div className="modal-actions node-detail-actions">
        <button onClick={() => props.onTogglePin(node.id)} disabled={pinFull}>{isPinned ? '判断根拠から除外' : '判断根拠に追加'}</button>
        {suggestedTags.map((tag) => (
          <button className={props.taggedNodes[node.id]?.includes(tag) ? 'active' : ''} key={tag} onClick={() => props.onToggleTag(node, tag)}>
            矛盾分類：{contradictionTagLabels[tag]}
          </button>
        ))}
      </div>
      {visibleActions.length > 0 && (
        <section className="node-analysis-actions" aria-label="解析アクション">
          <h3>追加照合</h3>
          <div className="actions">
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
        </section>
      )}
    </>
  );
}

function PersonRosterModalContent({ caseRecord, onOpenPerson }: { caseRecord: CaseRecord; onOpenPerson: (personId: string) => void }) {
  return (
    <>
      <p className="eyebrow">関係者照会 / PERSON INDEX</p>
      <h2>{caseRecord.title}</h2>
      <p className="muted">人格署名スキャンと法的人格ステータスの要点のみ表示します。詳細は各記録を開いてください。</p>
      <div className="person-roster" aria-label="関係者一覧">
        {caseRecord.personLogs.map((person) => {
          const legalStatus = getLegalPersonaStatus(person);
          const badge = getPersonRiskBadge(person);
          return (
            <article className="person-roster-row" key={person.id}>
              <div className="person-roster-main">
                <strong>{person.name}</strong>
                <span className="person-roster-state">{person.role}</span>
                <span className="person-roster-legal">法的人格ステータス：{legalStatus}</span>
              </div>
              <div className="person-roster-side">
                {badge && <i className="person-roster-badge">{badge}</i>}
                <button type="button" onClick={() => onOpenPerson(person.id)}>詳細</button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function PersonDetailModalContent({ person, nodes, onBack, onOpenNode }: { person: PersonLog; nodes: MemoryNode[]; onBack: () => void; onOpenNode?: (nodeId: string) => void }) {
  const relatedNodes = getRelatedNodes(person, nodes);
  const legalStatus = getLegalPersonaStatus(person);

  return (
    <>
      <p className="eyebrow">人物記録 / PERSON RECORD</p>
      <h2>{person.name}</h2>
      <p className="record-status-line">状態：{person.role}</p>
      <p className="person-legal-line">法的人格ステータス：{legalStatus}</p>
      <PersonProfile person={person} />
      {relatedNodes.length > 0 && (
        <section className="person-related-nodes">
          <h3>関係する記録</h3>
          {onOpenNode ? (
            <div className="related-node-links">
              {relatedNodes.map((node) => (
                <button type="button" className="related-node-link" key={node.id} onClick={() => onOpenNode(node.id)}>
                  {node.title}
                </button>
              ))}
            </div>
          ) : (
            <ul>{relatedNodes.map((node) => <li key={node.id}>{node.title}</li>)}</ul>
          )}
        </section>
      )}
      <div className="modal-actions">
        <button className="secondary" type="button" onClick={onBack}>関係者一覧へ戻る</button>
      </div>
    </>
  );
}


function AuditHearingModalContent({ hearing, nodes, pinnedNodeIds, onBack, onResolve }: { hearing: NonNullable<CaseRecord['auditHearing']>; nodes: MemoryNode[]; pinnedNodeIds: string[]; onBack: () => void; onResolve: (nodeId: string) => void }) {
  const [activeStatementId, setActiveStatementId] = useState(hearing.statements[0]?.id ?? '');
  const [presenting, setPresenting] = useState(false);
  const [message, setMessage] = useState('供述ログを確認し、判断根拠との不一致を照合してください。');
  const [resolved, setResolved] = useState(false);
  const pinnedNodes = nodes.filter((node) => pinnedNodeIds.includes(node.id));
  const activeStatement = hearing.statements.find((statement) => statement.id === activeStatementId) ?? hearing.statements[0];
  const validContradictionNodeIds = new Set(
    activeStatement?.contradictionNodeIds
    ?? (activeStatement?.contradictionNodeId ? [activeStatement.contradictionNodeId] : []),
  );

  const presentNode = (node: MemoryNode) => {
    if (validContradictionNodeIds.has(node.id)) {
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
      <section className={`decision-pressure audit-pressure-${auditPressure.level}`} aria-label="処理圧力下での裁定">
        <h3>処理圧力下での裁定</h3>
        <p>
          {auditReportCheck.summary} / 現在 {auditPressure.value}/{auditPressure.max}（{auditPressureLevelLabels[auditPressure.level]}）
        </p>
        <small>{auditPressureMessages[auditPressure.level]}</small>
        {auditReportCheck.warnings.length > 0 && (
          <ul className="decision-pressure-warnings">
            {auditReportCheck.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        )}
      </section>
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
