import { useMemo, useState, type ReactNode } from 'react';
import { canUnlockJudgment, getCurrentGuidance, getJudgmentRequirements, isAnalysisActionUnlocked, type CurrentGuidance, type JudgmentRequirement } from './auditRules';
import { case000, case001Preview, contradictionTagLabels } from './case000';
import { AnnotatedText } from './components/AnnotatedText';
import { TypewriterText } from './components/TypewriterText';
import { PersonProfile } from './components/PersonProfile';
import { MemoryNetwork } from './MemoryNetwork';
import { loadCaseResults, loadReadFlags, markRead, saveCaseResult } from './storage';
import type { AnalysisAction, AnalysisUnlockCondition, CityStats, ContradictionTag, DecisionOption, MemoryNode, NodeImportance, SavedCaseResult, Screen, TaggedNodes } from './types';
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

const warningLogPattern = /警告|不足|拒否|未解放|矛盾|不可逆/;

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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [visitedNodeIds, setVisitedNodeIds] = useState<string[]>([]);
  const [pinnedNodeIds, setPinnedNodeIds] = useState<string[]>([]);
  const [taggedNodes, setTaggedNodes] = useState<TaggedNodes>({});
  const [resources, setResources] = useState(case000.auditResourceMax);
  const [executedActionIds, setExecutedActionIds] = useState<string[]>([]);
  const [systemLogs, setSystemLogs] = useState<string[]>(['監査室端末を起動。都市OS 基礎公定通知を待機。']);
  const [decision, setDecision] = useState<DecisionOption | null>(null);
  const [resultPayload, setResultPayload] = useState<SavedCaseResult | null>(null);
  const [completedCaseIds, setCompletedCaseIds] = useState<string[]>(() => loadCaseResults().map((result) => result.caseId));
  const [readFlags, setReadFlags] = useState<string[]>(() => loadReadFlags());

  const selectedNode = case000.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const visitedCount = visitedNodeIds.length;
  const requirements = getJudgmentRequirements({
    visitedNodeCount: visitedCount,
    requiredNodesToJudge: case000.requiredNodesToJudge,
    pinnedNodeCount: pinnedNodeIds.length,
    taggedNodes,
  });
  const canJudge = canUnlockJudgment({
    visitedNodeCount: visitedCount,
    requiredNodesToJudge: case000.requiredNodesToJudge,
    pinnedNodeCount: pinnedNodeIds.length,
    taggedNodes,
  });
  const taggedNodeCount = Object.values(taggedNodes).filter((tags) => tags.length > 0).length;
  const guidance = getCurrentGuidance({
    visitedNodeCount: visitedCount,
    requiredNodesToJudge: case000.requiredNodesToJudge,
    pinnedNodeCount: pinnedNodeIds.length,
    taggedNodeCount,
    resources,
    canJudge,
  });
  const finalStats = useMemo(() => (decision ? addStats(case000.initialStats, decision.statDelta) : case000.initialStats), [decision]);

  const submitDecision = (nextDecision: DecisionOption) => {
    const nextFinalStats = addStats(case000.initialStats, nextDecision.statDelta);
    const nextResultPayload: SavedCaseResult = {
      caseId: case000.id,
      decisionId: nextDecision.id,
      pinnedNodeIds,
      taggedNodes,
      executedActionIds,
      finalStats: nextFinalStats,
      completedAt: new Date().toISOString(),
    };

    const saved = saveCaseResult(nextResultPayload);
    if (saved) {
      setCompletedCaseIds((ids) => (ids.includes(nextResultPayload.caseId) ? ids : [...ids, nextResultPayload.caseId]));
    }
    setResultPayload(nextResultPayload);
    setDecision(nextDecision);
    setScreen('result');
  };

  const appendLog = (message: string) => setSystemLogs((logs) => [...logs, message].slice(-8));
  const selectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setVisitedNodeIds((ids) => (ids.includes(nodeId) ? ids : [...ids, nodeId]));
    const node = case000.nodes.find((item) => item.id === nodeId);
    appendLog(`記憶ノード確認：${node?.title ?? nodeId}。公定値と監査記録を照合。`);
  };

  const togglePin = (nodeId: string) => {
    const node = case000.nodes.find((item) => item.id === nodeId);
    setPinnedNodeIds((ids) => {
      if (ids.includes(nodeId)) {
        appendLog(`判断根拠解除：${node?.title ?? nodeId}。`);
        return ids.filter((id) => id !== nodeId);
      }
      if (ids.length >= 3) {
        appendLog('提出根拠上限：3件を超える登録は拒否。');
        return ids;
      }
      appendLog(`判断根拠追加：${node?.title ?? nodeId}。`);
      return [...ids, nodeId];
    });
  };

  const toggleTag = (node: MemoryNode, tag: ContradictionTag) => {
    if (!node.suggestedTags?.includes(tag)) return;
    setTaggedNodes((current) => {
      const currentTags = current[node.id] ?? [];
      const removing = currentTags.includes(tag);
      const nextTags = removing ? currentTags.filter((item) => item !== tag) : [...currentTags, tag];
      appendLog(`${removing ? '矛盾分類解除' : '矛盾分類登録'}：${node.title} / ${contradictionTagLabels[tag]}。`);
      return { ...current, [node.id]: nextTags };
    });
  };

  const executeAction = (actionId: string) => {
    const action = case000.analysisActions.find((item) => item.id === actionId);
    if (!action || executedActionIds.includes(actionId)) return;
    if (!isAnalysisActionUnlocked({ action, visitedNodeIds, pinnedNodeIds, taggedNodes })) {
      appendLog(`解析権限未解放：${action.title}。必要記録を確認してください。`);
      return;
    }
    if (resources <= 0) {
      appendLog('監査リソース不足：追加解析を実行できません。既存記録のみで判断してください。');
      return;
    }
    setResources((value) => value - 1);
    setExecutedActionIds((ids) => [...ids, actionId]);
    appendLog(action.resultLog);
  };

  if (screen === 'title') return <TitleScreen onNext={() => setScreen('briefing')} />;
  if (screen === 'briefing') return <AuthBriefingScreen onNext={() => { markRead('city-os-briefing'); setReadFlags((flags) => (flags.includes('city-os-briefing') ? flags : [...flags, 'city-os-briefing'])); setScreen('caseSelect'); }} read={readFlags.includes('city-os-briefing')} />;
  if (screen === 'caseSelect') return <CaseSelectScreen completed={completedCaseIds.includes(case000.id)} onNext={() => setScreen('caseOverview')} />;
  if (screen === 'caseOverview') return <CaseOverviewScreen onNext={() => setScreen('investigation')} />;
  if (screen === 'decision') {
    return <DecisionScreen pinnedNodeIds={pinnedNodeIds} onBack={() => setScreen('investigation')} onDecide={submitDecision} />;
  }
  if (screen === 'result' && decision && resultPayload) {
    return <ResultScreen decision={decision} finalStats={finalStats} payload={resultPayload} taggedNodes={taggedNodes} />;
  }

  return (
    <InvestigationScreen
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
    />
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <main className="app-shell shell">{children}</main>;
}

function TitleScreen({ onNext }: { onNext: () => void }) {
  return (
    <Shell>
      <section className="start-card">
        <p className="eyebrow">{case000.organizationName}記録 {case000.recordName}</p>
        <h1>Persona Null</h1>
        <p>北霞市 都市OS 判断不能案件処理端末</p>
        <p className="muted">公定値は手続き上の事実であり、真実そのものではありません。</p>
        <button onClick={onNext}>監査端末を起動</button>
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

function CaseSelectScreen({ completed, onNext }: { completed: boolean; onNext: () => void }) {
  return (
    <Shell>
      <section className="document-card">
        <p className="eyebrow">事件選択</p>
        <h2>Case000 / {case000.title}</h2>
        <p>{case000.subtitle}</p>
        <p>記録名：{case000.recordName}</p>
        <p>管轄：{case000.organizationName}</p>
        <p>場所：{case000.location}</p>
        {completed && <p className="warning-text">処理済記録あり：localStorageから完了状態を検出。</p>}
        <div className="case-preview locked">
          <span>{case001Preview.id.toUpperCase()}</span>
          <strong>{case001Preview.title}</strong>
          <small>{case001Preview.subtitle} / 予告のみ</small>
        </div>
        <button onClick={onNext}>Case000を開く</button>
      </section>
    </Shell>
  );
}

function CaseOverviewScreen({ onNext }: { onNext: () => void }) {
  return (
    <Shell>
      <section className="document-card wide">
        <p className="eyebrow">事件概要</p>
        <h2>{case000.title}</h2>
        <p><AnnotatedText text={case000.overview} /></p>
        <section className="overview-grid">
          <div className="person-profiles-panel">
            <h3>人物プロファイル</h3>
            <div className="person-profile-list">
              {case000.personLogs.map((person) => <PersonProfile key={person.id} person={person} />)}
            </div>
          </div>
          <div>
            <h3>処理要求</h3>
            <p><strong>{case000.processingRequest.title}</strong>：<AnnotatedText text={case000.processingRequest.simpleFact} /></p>
            <p className="warning-text"><AnnotatedText text={case000.processingRequest.warning} /></p>
          </div>
        </section>
        <section>
          <h3>操作主体候補</h3>
          <ul>
            {case000.operatorCandidates.map((candidate) => (
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

function getAnalysisConditionItems(condition: AnalysisUnlockCondition, props: Pick<InvestigationProps, 'visitedNodeIds' | 'pinnedNodeIds' | 'taggedNodes'>) {
  const taggedNodeIds = Object.entries(props.taggedNodes).filter(([, tags]) => tags.length > 0).map(([nodeId]) => nodeId);

  switch (condition.type) {
    case 'visited_nodes':
      return condition.nodeIds.map((nodeId) => ({
        completed: props.visitedNodeIds.includes(nodeId),
        label: case000.nodes.find((node) => node.id === nodeId)?.title ?? nodeId,
      }));
    case 'pinned_any':
      return [{ completed: props.pinnedNodeIds.length >= condition.count, label: `任意の記録を${condition.count}件以上提出根拠に登録` }];
    case 'tagged_any':
      return [{ completed: taggedNodeIds.length >= condition.count, label: `任意の記録を${condition.count}件以上矛盾分類` }];
    case 'tagged_node':
      return [{
        completed: taggedNodeIds.includes(condition.nodeId),
        label: `${case000.nodes.find((node) => node.id === condition.nodeId)?.title ?? condition.nodeId}を矛盾分類`,
      }];
  }
}

function AnalysisActionControl(props: {
  action: AnalysisAction;
  executed: boolean;
  onExecute: (actionId: string) => void;
  pinnedNodeIds: string[];
  resources: number;
  taggedNodes: TaggedNodes;
  visitedNodeIds: string[];
}) {
  const unlocked = isAnalysisActionUnlocked(props);
  const requirements = (props.action.unlockConditions ?? []).flatMap((condition) => getAnalysisConditionItems(condition, props));

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

function InvestigationScreen(props: InvestigationProps) {
  const selectedNode = props.selectedNode;
  const suggestedTags = selectedNode?.suggestedTags ?? [];
  const eligibleForTags = suggestedTags.length > 0;
  const taggedNodeCount = Object.values(props.taggedNodes).filter((tags) => tags.length > 0).length;
  const pinnedNodes = case000.nodes.filter((node) => props.pinnedNodeIds.includes(node.id));
  const analysisReports = selectedNode
    ? case000.analysisActions.filter((action) => (
        props.executedActionIds.includes(action.id)
        && action.targetNodeIds?.includes(selectedNode.id)
        && action.reportText
      ))
    : [];
  const hasExecutableAnalysis = case000.analysisActions.some((action) => (
    !props.executedActionIds.includes(action.id)
    && props.resources > 0
    && isAnalysisActionUnlocked({
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
  const nextRequirement = props.requirements.find((requirement) => !requirement.completed);
  const requirementLabels: Record<JudgmentRequirement['id'], string> = {
    nodes: '確認',
    pins: '提出根拠',
    tags: '矛盾分類',
  };
  const missingRequirement = nextRequirement
    ? `${requirementLabels[nextRequirement.id]} ${nextRequirement.detail.split(' ')[0]}`
    : 'なし';

  return (
    <main className="app-shell game-grid">
      <aside className="pane left-pane">
        <p className="eyebrow">{case000.organizationName} / {case000.id.toUpperCase()}</p>
        <h2>{case000.title}</h2>
        <GuidancePanel guidance={props.guidance} />
        <section className="pane-section compact-progress status-chip-row" aria-label="監査進行">
          <span className={props.visitedNodeIds.length >= case000.requiredNodesToJudge ? 'status-chip valid' : 'status-chip muted'}>既読数 <strong>{props.visitedNodeIds.length}/{case000.requiredNodesToJudge}</strong></span>
          <span className={props.pinnedNodeIds.length >= 1 ? 'status-chip valid' : 'status-chip muted'}>提出根拠 <strong>{props.pinnedNodeIds.length}/1</strong></span>
          <span className={taggedNodeCount >= 1 ? 'status-chip valid' : 'status-chip warning'}>矛盾分類 <strong>{taggedNodeCount}/1</strong></span>
          <span className={props.resources === 0 ? 'status-chip critical' : props.resources <= 1 ? 'status-chip warning' : 'status-chip muted'}>監査リソース <strong>{props.resources}/{case000.auditResourceMax}</strong></span>
        </section>
        <section className="pane-section memory-node-index" aria-labelledby="memory-node-index-title">
          <div className="node-index-heading">
            <h3 id="memory-node-index-title">争点別 記憶ノード</h3>
            <small>未確認 {case000.nodes.length - props.visitedNodeIds.length}</small>
          </div>
          <div className="issue-list">
            {case000.issues.map((issue) => {
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
                      const node = case000.nodes.find((item) => item.id === nodeId);
                      if (!node) return null;
                      const isSelected = node.id === props.selectedNodeId;
                      const isVisited = props.visitedNodeIds.includes(node.id);
                      const isPinned = props.pinnedNodeIds.includes(node.id);
                      const isTagged = (props.taggedNodes[node.id]?.length ?? 0) > 0;

                      return (
                        <button
                          className={`memory-node-item ${isSelected ? 'selected' : isVisited ? 'visited' : 'unvisited'}`}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => props.onSelectNode(node.id)}
                          key={`${issue.id}-${node.id}`}
                        >
                          <strong>{node.title}</strong>
                          <span className="node-state-badges">
                            <i>{isVisited ? '確認済' : '未確認'}</i>
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
          <p className="case-subtitle">{case000.subtitle}</p>
          <p>{case000.overview}</p>
          <h3>監査リソース</h3>
          <p className="resource-count">{props.resources} / {case000.auditResourceMax}</p>
          <small>追加解析1件につき1消費。最終判断は残数0でも可能。</small>
          {props.resources === 0 && <p className="warning-text">監査リソース不足：追加解析を実行できません。</p>}
          <h3>初期都市ステータス</h3>
          <StatusBars stats={case000.initialStats} />
        </details>
      </aside>

      <section className="center-pane">
        <div className="network-caption">
          <span>Memory Network</span>
          <small>クリックで選択 / 色で重要度を表示・外周で監査状態を表示</small>
          <div className="network-state-legend" aria-label="ノード監査状態">
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
        <MemoryNetwork nodes={case000.nodes} selectedNodeId={props.selectedNodeId} visitedNodeIds={props.visitedNodeIds} pinnedNodeIds={props.pinnedNodeIds} taggedNodes={props.taggedNodes} executedActionIds={props.executedActionIds} onSelectNode={props.onSelectNode} />
      </section>

      <aside className="pane right-pane">
        {!selectedNode ? (
          <section className="empty-node-detail" aria-live="polite">
            <p className="eyebrow">選択ノード要約</p>
            <h2>記憶ノードを選択してください</h2>
            <p>左の争点別ノード一覧、または中央の Memory Network から記録を開けます</p>
          </section>
        ) : <>
          <section className="node-header">
            <p className="eyebrow">選択ノード要約</p>
            <h2>{selectedNode.title}</h2>
          </section>
          <section className="pane-section node-summary">
            <p><AnnotatedText text={selectedNode.summary} /></p>
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
          <section className="pane-section node-warning">
            <h3>警告</h3>
            <p className="warning-text"><AnnotatedText text={selectedNode.warning} /></p>
          </section>
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
            {analysisReports.length > 0 && (
              <div className="analysis-report" aria-live="polite">
                <strong>追加解析結果</strong>
                {analysisReports.map((action) => <p key={action.id}><AnnotatedText text={action.reportText ?? ''} /></p>)}
              </div>
            )}
          </details>
          <section className="pane-section pin-box">
            <h3>提出根拠</h3>
            <button onClick={() => props.onTogglePin(selectedNode.id)} disabled={!props.pinnedNodeIds.includes(selectedNode.id) && props.pinnedNodeIds.length >= 3}>
              {props.pinnedNodeIds.includes(selectedNode.id) ? '提出根拠から解除' : '提出根拠に登録'}
            </button>
            <details className="inline-details">
              <summary>提出状況を表示</summary>
              <div className="pinned-list">
                {pinnedNodes.length ? pinnedNodes.map((node) => <span key={node.id}>{node.title}</span>) : <small>未提出。最低1件が必要。</small>}
              </div>
            </details>
          </section>
          {eligibleForTags && (
            <section className="pane-section tag-box">
              <h3>矛盾分類</h3>
              {suggestedTags.map((tag) => (
                <button className={props.taggedNodes[selectedNode.id]?.includes(tag) ? 'active' : ''} key={tag} onClick={() => props.onToggleTag(selectedNode, tag)}>
                  {contradictionTagLabels[tag]}
                </button>
              ))}
            </section>
          )}
          <section className="pane-section analysis-summary">
            <div><span>追加解析</span><strong>{analysisStatus}</strong></div>
            <div><span>監査リソース残数</span><strong>{props.resources} / {case000.auditResourceMax}</strong></div>
            <details className="inline-details actions">
              <summary>解析メニューを表示</summary>
              {case000.analysisActions.map((action) => (
                <AnalysisActionControl
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
          </section>
        </>}
      </aside>

      <footer className="bottom-pane">
        <section className="judgment-summary">
          <button className="judge" disabled={!props.canJudge} onClick={props.onJudge}>{props.canJudge ? '最終判断へ進む' : '最終判断は未開放'}</button>
          <p><strong>最終判断：{props.canJudge ? '開放済' : '未開放'}</strong></p>
          <p>不足：{missingRequirement}</p>
        </section>
        <section className="logs audit-log">
          <div className="audit-log-heading"><strong>AUDIT LOG</strong><span>監査ログ / {String(props.systemLogs.length).padStart(2, '0')}</span></div>
          {(() => {
            const latestLog = props.systemLogs.at(-1) ?? 'ログなし';
            return <p className={`latest-log ${warningLogPattern.test(latestLog) ? 'warning-log' : ''}`}><TypewriterText text={latestLog} speed={12} animateKey={`system-log-${props.systemLogs.length}-${latestLog}`} /></p>;
          })()}
          <details className="inline-details">
            <summary>ログを表示</summary>
            <div className="log-list">
              {props.systemLogs.map((log, index) => <p className={warningLogPattern.test(log) ? 'warning-log' : ''} key={`${index}-${log}`}><span>{String(index + 1).padStart(2, '0')}</span>{log}</p>)}
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

function DecisionScreen({ pinnedNodeIds, onBack, onDecide }: { pinnedNodeIds: string[]; onBack: () => void; onDecide: (decision: DecisionOption) => void }) {
  return (
    <Shell>
      <section className="document-card wide">
        <p className="eyebrow">最終判断</p>
        <h2>監査報告書 / 裁定案照合</h2>
        <p className="warning-text">各裁定案が採用する根拠、保留する疑点、都市ステータスへの影響を照合してください。判断は不可逆です。</p>
        <div className="decision-list">
          {case000.decisions.map((option) => {
            const acceptedNodes = case000.nodes.filter((node) => option.acceptedEvidenceNodeIds?.includes(node.id));
            const ignoredIssues = case000.issues.filter((issue) => option.ignoredIssueIds?.includes(issue.id));
            const submittedAcceptedCount = acceptedNodes.filter((node) => pinnedNodeIds.includes(node.id)).length;

            return (
              <article className="decision-card" key={option.id}>
                <div>
                  <p className="eyebrow">裁定案</p>
                  <h3>{option.label}</h3>
                </div>
                <section className="decision-values">
                  <p><strong>優先される価値</strong>{option.prioritizedValue}</p>
                  <p><strong>軽視される価値</strong>{option.disregardedValue}</p>
                </section>
                <section>
                  <h4>都市ステータスへの影響</h4>
                  <div className="decision-stat-deltas">
                    {cityStatKeys.map((key) => <span className={option.statDelta[key] >= 0 ? 'delta-plus' : 'delta-minus'} key={key}>{statLabels[key]} {option.statDelta[key] >= 0 ? '+' : ''}{option.statDelta[key]}</span>)}
                  </div>
                </section>
                <details className="decision-details">
                  <summary>裁定詳細を表示</summary>
                  <section>
                    <div className="decision-section-heading">
                      <h4>採用される根拠</h4>
                      <span>提出根拠との一致 {submittedAcceptedCount} / {acceptedNodes.length}</span>
                    </div>
                    {acceptedNodes.map((node) => (
                      <p className={pinnedNodeIds.includes(node.id) ? 'evidence-submitted' : 'evidence-unsubmitted'} key={node.id}>
                        <span>{pinnedNodeIds.includes(node.id) ? '根拠提出済' : '未提出'}</span>{node.title}：{node.simpleFact}
                      </p>
                    ))}
                    {acceptedNodes.length > 0 && submittedAcceptedCount === 0 && (
                      <div className="decision-evidence-warning" role="alert">
                        <strong>警告：</strong>
                        <p>この裁定案は、現在の提出根拠と一致していません。</p>
                        <p>未提出記録を採用根拠として裁定しようとしています。</p>
                      </div>
                    )}
                  </section>
                  <section>
                    <h4>無視または保留される疑点</h4>
                    {ignoredIssues.map((issue) => <p key={issue.id}><strong>{issue.title}</strong>：{issue.description}</p>)}
                  </section>
                </details>
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

function ResultScreen({ decision, finalStats, payload, taggedNodes }: { decision: DecisionOption; finalStats: CityStats; payload: SavedCaseResult; taggedNodes: TaggedNodes }) {
  const pinned = case000.nodes.filter((node) => payload.pinnedNodeIds.includes(node.id));
  const taggedEntries = Object.entries(taggedNodes).filter(([, tags]) => tags.length);

  return (
    <Shell>
      <section className="document-card result wide admin-log">
        <p className="eyebrow">行政処理ログ / {case000.recordName} / 保存完了</p>
        <h2>Case000 処理記録</h2>
        <section className="result-summary" aria-label="裁定結果要約">
          <p><span>裁定</span><strong>{decision.finalRuling.split(':')[0]}</strong></p>
          <p><span>優先</span><strong>{decision.prioritizedValue}</strong></p>
          <p><span>影響</span><strong>{cityStatKeys.map((key) => `${statLabels[key]} ${decision.statDelta[key] >= 0 ? '+' : ''}${decision.statDelta[key]}`).join(' / ')}</strong></p>
        </section>
        <div className={`ruling-stamp ruling-${decision.id}`} aria-label={`裁定印：${decision.finalRuling.split(':')[0]}`}>
          <span>都市OS監査室</span>
          <strong>{decision.finalRuling.split(':')[0]}</strong>
          <small>FINAL / CASE000</small>
        </div>
        <div className="result-grid">
          <ResultSection title="最終裁定">
            <p><AnnotatedText text={decision.finalRuling} /></p>
          </ResultSection>
          <ResultSection title="処理内容">
            <p><AnnotatedText text={decision.processing} /></p>
          </ResultSection>
          <ResultSection title="優先された価値">
            <p>{decision.prioritizedValue}</p>
          </ResultSection>
          <ResultSection title="軽視された価値">
            <p>{decision.disregardedValue}</p>
          </ResultSection>
          <ResultSection title="提出された判断根拠">
            {pinned.length ? pinned.map((node) => <p key={node.id}>・{node.title}：{node.simpleFact}</p>) : <p>根拠提出なし。</p>}
          </ResultSection>
          <ResultSection title="分類された矛盾">
            {taggedEntries.length ? taggedEntries.map(([nodeId, tags]) => {
              const node = case000.nodes.find((item) => item.id === nodeId);
              return <p key={nodeId}>・{node?.title ?? nodeId}：{tags.map((tag) => contradictionTagLabels[tag]).join(' / ')}</p>;
            }) : <p>矛盾分類なし。</p>}
          </ResultSection>
          <ResultSection title="実行した解析アクション">
            {payload.executedActionIds.length ? payload.executedActionIds.map((id) => {
              const action = case000.analysisActions.find((item) => item.id === id);
              return <p key={id}>・{action?.title ?? id}</p>;
            }) : <p>追加解析なし。既存記録のみで判断。</p>}
          </ResultSection>
          <ResultSection title="都市ステータス変動">
            <div className="stat-delta-list">
              {cityStatKeys.map((key) => {
                const before = case000.initialStats[key];
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
          <ResultSection title="次回記録">
            <p className="warning-text">{case001Preview.id.toUpperCase()}「{case001Preview.title}」：{case001Preview.subtitle}。予告のみ表示。Jam提出版では未開放。</p>
            {case001Preview.handoffSummary && <p><AnnotatedText text={case001Preview.handoffSummary} /></p>}
            {case001Preview.preservedFragment && <code><AnnotatedText text={case001Preview.preservedFragment} /></code>}
          </ResultSection>
        </div>
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
