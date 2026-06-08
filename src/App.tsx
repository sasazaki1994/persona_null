import { useMemo, useState, type ReactNode } from 'react';
import { canUnlockJudgment, getCurrentGuidance, getJudgmentRequirements, isAnalysisActionUnlocked, type CurrentGuidance, type JudgmentRequirement } from './auditRules';
import { case000, case001Preview, contradictionTagLabels } from './case000';
import { AnnotatedText } from './components/AnnotatedText';
import { TypewriterText } from './components/TypewriterText';
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

const importanceLabels: Record<NodeImportance, string> = {
  standard: '標準',
  high: '高',
  critical: '重大',
};

function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [selectedNodeId, setSelectedNodeId] = useState(case000.nodes[0].id);
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

  const selectedNode = case000.nodes.find((node) => node.id === selectedNodeId) ?? case000.nodes[0];
  const visitedCount = visitedNodeIds.length;
  const progress = Math.round((visitedCount / case000.nodes.length) * 100);
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

  const appendLog = (message: string) => setSystemLogs((logs) => [message, ...logs].slice(0, 8));
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
        appendLog('判断根拠上限：3件を超えるピン留めは拒否。');
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
    return <DecisionScreen onBack={() => setScreen('investigation')} onDecide={submitDecision} />;
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
      progress={progress}
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
  return <main className="shell">{children}</main>;
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
          <div>
            <h3>人物ログ</h3>
            {case000.personLogs.map((person) => (
              <p key={person.id}><strong>{person.name}</strong>：<AnnotatedText text={person.summary} /></p>
            ))}
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
  selectedNode: MemoryNode;
  selectedNodeId: string;
  visitedNodeIds: string[];
  pinnedNodeIds: string[];
  taggedNodes: TaggedNodes;
  resources: number;
  executedActionIds: string[];
  systemLogs: string[];
  progress: number;
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

function NodeActionHint(props: { canJudge: boolean; eligibleForTags: boolean; isPinned: boolean; isTagged: boolean; isVisited: boolean }) {
  const hints = props.canJudge
    ? ['判断条件に必要な操作は完了しています']
    : [
        props.isVisited ? 'このノードは確認済みです' : 'このノードを選択すると確認済みになります',
        props.isPinned ? 'このノードは判断根拠として登録済みです' : 'このノードは根拠としてピン留めできます',
        props.eligibleForTags && (props.isTagged ? 'このノードは矛盾分類済みです' : 'このノードは矛盾分類対象です'),
      ].filter((hint): hint is string => Boolean(hint));

  return (
    <section className="node-action-hint" aria-label="選択ノード操作案内">
      <strong>操作照合</strong>
      {hints.map((hint) => <p key={hint}>› {hint}</p>)}
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
      return [{ completed: props.pinnedNodeIds.length >= condition.count, label: `任意の記録を${condition.count}件以上ピン留め` }];
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
  const suggestedTags = props.selectedNode.suggestedTags ?? [];
  const eligibleForTags = suggestedTags.length > 0;
  const taggedNodeCount = Object.values(props.taggedNodes).filter((tags) => tags.length > 0).length;
  const pinnedNodes = case000.nodes.filter((node) => props.pinnedNodeIds.includes(node.id));

  return (
    <main className="game-grid">
      <aside className="pane left-pane">
        <p className="eyebrow">{case000.organizationName} / {case000.id.toUpperCase()}</p>
        <h2>{case000.title}</h2>
        <p className="case-subtitle">{case000.subtitle}</p>
        <section className="pane-section">
          <h3>事件概要</h3>
          <p>{case000.overview}</p>
        </section>
        <GuidancePanel guidance={props.guidance} />
        <section className="pane-section">
          <h3>進行度</h3>
          <div className="meter"><span style={{ width: `${props.progress}%` }} /></div>
          <div className="status-grid">
            <span>確認済み</span><strong>{props.visitedNodeIds.length}/{case000.nodes.length}</strong>
            <span>判断条件</span><strong>{Math.min(props.visitedNodeIds.length, case000.requiredNodesToJudge)}/{case000.requiredNodesToJudge}</strong>
            <span>根拠ピン</span><strong>{props.pinnedNodeIds.length}/3</strong>
            <span>矛盾分類</span><strong>{taggedNodeCount}</strong>
          </div>
        </section>
        <section className="pane-section resource-card">
          <h3>監査リソース</h3>
          <p className="resource-count">{props.resources} / {case000.auditResourceMax}</p>
          <small>追加解析1件につき1消費。最終判断は残数0でも可能。</small>
          {props.resources === 0 && <p className="warning-text">監査リソース不足：追加解析を実行できません。</p>}
        </section>
        <section className="pane-section compact-stats">
          <h3>初期都市ステータス</h3>
          <StatusBars stats={case000.initialStats} />
        </section>
      </aside>

      <section className="center-pane">
        <div className="network-caption">
          <span>Memory Network</span>
          <small>クリックで選択 / 色で重要度を表示</small>
          <div className="importance-legend" aria-label="問題の重要度">
            {(Object.entries(importanceLabels) as [NodeImportance, string][]).map(([importance, label]) => (
              <span className={`importance-key ${importance}`} key={importance}><i />{label}</span>
            ))}
          </div>
        </div>
        <MemoryNetwork nodes={case000.nodes} selectedNodeId={props.selectedNodeId} visitedNodeIds={props.visitedNodeIds} taggedNodes={props.taggedNodes} onSelectNode={props.onSelectNode} />
      </section>

      <aside className="pane right-pane">
        <section className="node-header">
          <p className="eyebrow">選択ノード詳細</p>
          <h2>{props.selectedNode.title}</h2>
          <div className="node-badges">
            <span>{props.selectedNode.type}</span>
            <span className={`importance ${props.selectedNode.importance}`}>重要度：{importanceLabels[props.selectedNode.importance]}</span>
          </div>
        </section>
        <NodeActionHint
          canJudge={props.canJudge}
          eligibleForTags={eligibleForTags}
          isPinned={props.pinnedNodeIds.includes(props.selectedNode.id)}
          isTagged={(props.taggedNodes[props.selectedNode.id]?.length ?? 0) > 0}
          isVisited={props.visitedNodeIds.includes(props.selectedNode.id)}
        />
        <section className="pane-section">
          <h3>監査記録</h3>
          <p><TypewriterText text={props.selectedNode.summary} speed={14} animateKey={`summary-${props.selectedNode.id}`} /></p>
          <code>{props.selectedNode.log}</code>
          <p><strong>単純事実：</strong><AnnotatedText text={props.selectedNode.simpleFact} /></p>
          <p><strong>監査官注：</strong><TypewriterText text={props.selectedNode.inspectorNote} speed={14} animateKey={`note-${props.selectedNode.id}`} /></p>
          <p className="warning-text"><strong>警告：</strong><AnnotatedText text={props.selectedNode.warning} /></p>
          <dl className="metrics">
            {Object.entries(props.selectedNode.metrics).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
          </dl>
        </section>
        <section className="pane-section pin-box">
          <h3>ピン留め根拠</h3>
          <button onClick={() => props.onTogglePin(props.selectedNode.id)} disabled={!props.pinnedNodeIds.includes(props.selectedNode.id) && props.pinnedNodeIds.length >= 3}>
            {props.pinnedNodeIds.includes(props.selectedNode.id) ? '根拠ピンを解除' : '根拠としてピン留め'}
          </button>
          <div className="pinned-list">
            {pinnedNodes.length ? pinnedNodes.map((node) => <span key={node.id}>{node.title}</span>) : <small>未提出。最低1件が必要。</small>}
          </div>
        </section>
        <section className="pane-section tag-box">
          <h3>矛盾分類</h3>
          {!eligibleForTags && <small>この記録に分類可能な矛盾は検出されていません</small>}
          {suggestedTags.map((tag) => (
            <button className={props.taggedNodes[props.selectedNode.id]?.includes(tag) ? 'active' : ''} key={tag} onClick={() => props.onToggleTag(props.selectedNode, tag)}>
              {contradictionTagLabels[tag]}
            </button>
          ))}
        </section>
        <section className="pane-section actions">
          <h3>解析アクション</h3>
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
        </section>
      </aside>

      <footer className="bottom-pane">
        <button className="judge" disabled={!props.canJudge} onClick={props.onJudge}>{props.canJudge ? '最終判断へ進む' : '最終判断は未開放'}</button>
        <section className="blocker-panel">
          <strong>最終判断まで</strong>
          <div className="requirement-list">
            {props.requirements.map((requirement) => (
              <div className={requirement.completed ? 'complete' : 'incomplete'} key={requirement.id}>
                <span aria-label={requirement.completed ? '完了' : '未完了'}>{requirement.completed ? '✓' : '□'}</span>
                <p>{requirement.label}</p>
                <small>{requirement.detail}</small>
              </div>
            ))}
          </div>
          <p className={props.canJudge ? 'warning-text' : 'muted'}>{props.canJudge ? '条件充足。以後の判断は不可逆です。' : '未完了項目を上から順に照合してください。'}</p>
        </section>
        <section className="logs">
          <strong>システムログ</strong>
          <div className="log-list">
            {props.systemLogs.map((log, index) => (
              <p key={`${index}-${log}`}>
                {index === 0
                  ? <TypewriterText text={log} speed={12} animateKey={`system-log-${props.systemLogs.length}-${log}`} />
                  : log}
              </p>
            ))}
          </div>
        </section>
      </footer>
    </main>
  );
}

function StatusBars({ stats }: { stats: CityStats }) {
  return <div className="status-bars">{cityStatKeys.map((key) => <div key={key}><span>{statLabels[key]}</span><meter min="0" max="100" value={stats[key]} /></div>)}</div>;
}

function DecisionScreen({ onBack, onDecide }: { onBack: () => void; onDecide: (decision: DecisionOption) => void }) {
  return (
    <Shell>
      <section className="document-card wide">
        <p className="eyebrow">最終判断</p>
        <h2>判断は不可逆です</h2>
        <div className="decision-list">
          {case000.decisions.map((option) => <button key={option.id} onClick={() => onDecide(option)}>{option.label}</button>)}
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
