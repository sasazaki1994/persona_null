import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { case000, contradictionTagLabels, contradictionTags } from './case000';
import { MemoryNetwork } from './MemoryNetwork';
import { loadCaseResults, loadReadFlags, markRead, saveCaseResult } from './storage';
import type { CityStats, ContradictionTag, DecisionOption, MemoryNode, SavedCaseResult, Screen, TaggedNodes } from './types';
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
  const [completedCaseIds, setCompletedCaseIds] = useState<string[]>(() => loadCaseResults().map((result) => result.caseId));
  const [readFlags, setReadFlags] = useState<string[]>(() => loadReadFlags());

  const selectedNode = case000.nodes.find((node) => node.id === selectedNodeId) ?? case000.nodes[0];
  const visitedCount = visitedNodeIds.length;
  const progress = Math.round((visitedCount / case000.nodes.length) * 100);
  const hasTaggedContradiction = Object.values(taggedNodes).some((tags) => tags.length > 0);
  const blockers = [
    visitedCount < case000.requiredNodesToJudge
      ? `確認済みノード不足：${visitedCount}/${case000.requiredNodesToJudge}`
      : '',
    pinnedNodeIds.length === 0 ? '判断根拠が未提出です。最低1件を追加してください。' : '',
    !hasTaggedContradiction ? '矛盾分類が未完了です。criticalまたは矛盾ノードにタグを付与してください。' : '',
  ].filter(Boolean);
  const canJudge = blockers.length === 0;
  const finalStats = useMemo(() => (decision ? addStats(case000.initialStats, decision.statDelta) : case000.initialStats), [decision]);

  const resultPayload = useMemo<SavedCaseResult | null>(() => {
    if (!decision) return null;
    return {
      caseId: case000.id,
      decisionId: decision.id,
      pinnedNodeIds,
      taggedNodes,
      executedActionIds,
      finalStats,
      completedAt: new Date().toISOString(),
    };
  }, [decision, executedActionIds, finalStats, pinnedNodeIds, taggedNodes]);

  useEffect(() => {
    if (screen === 'result' && resultPayload) {
      saveCaseResult(resultPayload);
      setCompletedCaseIds((ids) => (ids.includes(resultPayload.caseId) ? ids : [...ids, resultPayload.caseId]));
    }
  }, [resultPayload, screen]);

  const appendLog = (message: string) => setSystemLogs((logs) => [message, ...logs].slice(0, 8));
  const selectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setVisitedNodeIds((ids) => (ids.includes(nodeId) ? ids : [...ids, nodeId]));
    const node = case000.nodes.find((item) => item.id === nodeId);
    appendLog(`記憶ノード確認：${node?.title ?? nodeId}。公定値と監査記録を照合。`);
  };

  const togglePin = (nodeId: string) => {
    setPinnedNodeIds((ids) => {
      if (ids.includes(nodeId)) return ids.filter((id) => id !== nodeId);
      if (ids.length >= 3) return ids;
      return [...ids, nodeId];
    });
  };

  const toggleTag = (node: MemoryNode, tag: ContradictionTag) => {
    if (!node.hasContradiction && node.importance !== 'critical') return;
    setTaggedNodes((current) => {
      const currentTags = current[node.id] ?? [];
      const nextTags = currentTags.includes(tag) ? currentTags.filter((item) => item !== tag) : [...currentTags, tag];
      return { ...current, [node.id]: nextTags };
    });
  };

  const executeAction = (actionId: string) => {
    const action = case000.analysisActions.find((item) => item.id === actionId);
    if (!action || executedActionIds.includes(actionId)) return;
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
    return <DecisionScreen onBack={() => setScreen('investigation')} onDecide={(nextDecision) => { setDecision(nextDecision); setScreen('result'); }} />;
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
      blockers={blockers}
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
          <li>身体認証：その身体が誰のものか。</li>
          <li>人格認証：応答している人格が誰なのか。</li>
          <li>操作主体：身体や義体を実際に動かしている主体が誰なのか。</li>
          <li>法的人格：都市OSが権利、責任、同意、通行、医療判断を与えてよいと認めた人格。</li>
        </ul>
        <p>認証失敗または人格未確定の者は、市民生活の端から静かに除外されます。</p>
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
        <p>{case000.overview}</p>
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
  blockers: string[];
  canJudge: boolean;
  onSelectNode: (nodeId: string) => void;
  onTogglePin: (nodeId: string) => void;
  onToggleTag: (node: MemoryNode, tag: ContradictionTag) => void;
  onExecuteAction: (actionId: string) => void;
  onJudge: () => void;
};

function InvestigationScreen(props: InvestigationProps) {
  const eligibleForTags = props.selectedNode.hasContradiction || props.selectedNode.importance === 'critical';
  return (
    <main className="game-grid">
      <aside className="pane left-pane">
        <p className="eyebrow">{case000.organizationName} / {case000.id.toUpperCase()}</p>
        <h2>{case000.title}</h2>
        <p>{case000.subtitle}</p>
        <p>{case000.overview}</p>
        <StatusBars stats={case000.initialStats} />
        <div className="meter"><span style={{ width: `${props.progress}%` }} /></div>
        <p>調査進行度：{props.progress}%（{props.visitedNodeIds.length}/{case000.nodes.length}）</p>
        <p>監査リソース：{props.resources} / {case000.auditResourceMax}</p>
        <p>判断根拠数：{props.pinnedNodeIds.length} / 3</p>
        <p>矛盾タグ付け数：{Object.values(props.taggedNodes).filter((tags) => tags.length > 0).length}</p>
        {props.resources === 0 && <p className="warning-text">監査リソース不足：追加解析を実行できません。既存記録のみで判断してください。</p>}
      </aside>

      <section className="center-pane">
        <MemoryNetwork nodes={case000.nodes} selectedNodeId={props.selectedNodeId} visitedNodeIds={props.visitedNodeIds} onSelectNode={props.onSelectNode} />
      </section>

      <aside className="pane right-pane">
        <p className="eyebrow">選択中ノード</p>
        <h2>{props.selectedNode.title}</h2>
        <p><strong>type:</strong> {props.selectedNode.type}</p>
        <p><strong>importance:</strong> {props.selectedNode.importance}</p>
        <p>{props.selectedNode.summary}</p>
        <code>{props.selectedNode.log}</code>
        <p><strong>simpleFact:</strong> {props.selectedNode.simpleFact}</p>
        <p><strong>inspectorNote:</strong> {props.selectedNode.inspectorNote}</p>
        <p className="warning-text"><strong>warning:</strong> {props.selectedNode.warning}</p>
        <dl className="metrics">
          {Object.entries(props.selectedNode.metrics).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
        </dl>
        <button onClick={() => props.onTogglePin(props.selectedNode.id)} disabled={!props.pinnedNodeIds.includes(props.selectedNode.id) && props.pinnedNodeIds.length >= 3}>
          {props.pinnedNodeIds.includes(props.selectedNode.id) ? '判断根拠から外す' : '判断根拠に追加'}
        </button>
        <div className="tag-box">
          <p>矛盾分類</p>
          {!eligibleForTags && <small>このノードは矛盾タグ付け対象外です。</small>}
          {contradictionTags.map((tag) => (
            <button className={props.taggedNodes[props.selectedNode.id]?.includes(tag) ? 'active' : ''} disabled={!eligibleForTags} key={tag} onClick={() => props.onToggleTag(props.selectedNode, tag)}>
              {contradictionTagLabels[tag]}
            </button>
          ))}
        </div>
        <div className="actions">
          <p>解析アクション</p>
          {case000.analysisActions.map((action) => (
            <button key={action.id} onClick={() => props.onExecuteAction(action.id)} disabled={props.executedActionIds.includes(action.id) || props.resources === 0} title={action.description}>
              {props.executedActionIds.includes(action.id) ? `実行済：${action.title}` : action.title}
            </button>
          ))}
        </div>
      </aside>

      <footer className="bottom-pane">
        <button className="judge" disabled={!props.canJudge} onClick={props.onJudge}>最終判断へ進む</button>
        <div>
          <strong>判断不可理由</strong>
          {props.blockers.length ? props.blockers.map((blocker) => <p key={blocker}>{blocker}</p>) : <p>条件充足。判断は不可逆です。</p>}
        </div>
        <div className="logs">
          <strong>システムログ</strong>
          {props.systemLogs.map((log) => <p key={log}>{log}</p>)}
        </div>
      </footer>
    </main>
  );
}

function StatusBars({ stats }: { stats: CityStats }) {
  return <div className="status-bars">{(Object.keys(stats) as (keyof CityStats)[]).map((key) => <div key={key}><span>{statLabels[key]}</span><meter min="0" max="100" value={stats[key]} /></div>)}</div>;
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
  return (
    <Shell>
      <section className="document-card result wide">
        <p className="eyebrow">結果画面 / 保存完了</p>
        <h2>{decision.finalRuling}</h2>
        <p><strong>処理内容：</strong>{decision.processing}</p>
        <p><strong>優先された価値：</strong>{decision.prioritizedValue}</p>
        <p><strong>軽視された価値：</strong>{decision.disregardedValue}</p>
        <h3>提出された判断根拠</h3>
        {pinned.map((node) => <p key={node.id}>・{node.title}：{node.simpleFact}</p>)}
        <h3>分類された矛盾</h3>
        {Object.entries(taggedNodes).filter(([, tags]) => tags.length).map(([nodeId, tags]) => {
          const node = case000.nodes.find((item) => item.id === nodeId);
          return <p key={nodeId}>・{node?.title ?? nodeId}：{tags.map((tag) => contradictionTagLabels[tag]).join(' / ')}</p>;
        })}
        <h3>実行した解析アクション</h3>
        {payload.executedActionIds.length ? payload.executedActionIds.map((id) => <p key={id}>・{case000.analysisActions.find((action) => action.id === id)?.title}</p>) : <p>追加解析なし。既存記録のみで判断。</p>}
        <h3>都市ステータス変動</h3>
        <StatusBars stats={finalStats} />
        <p><strong>監査注記：</strong>{decision.auditNote}</p>
        <p className="ending-text">{decision.endingText}</p>
        <p className="warning-text">Case001「焼却されなかった声」：未実装。次回記録として予告のみ表示。</p>
      </section>
    </Shell>
  );
}

export default App;
