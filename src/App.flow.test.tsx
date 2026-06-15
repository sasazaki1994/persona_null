// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import itchPage from '../docs/itch-page.md?raw';
import { case000 } from './case000';

vi.mock('./MemoryNetwork', () => ({
  MemoryNetwork: ({ nodes, onSelectNode }: { nodes: typeof case000.nodes; onSelectNode: (nodeId: string) => void }) => (
    <div aria-label="記憶ノードネットワーク">
      {nodes.map((node) => <button key={node.id} onClick={() => onSelectNode(node.id)}>ノード：{node.title}</button>)}
    </div>
  ),
}));

import App from './App';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Persona Null player flow', () => {
  it('keeps the public incident description aligned with the Case000 records', () => {
    const mamiya = case000.personLogs.find((person) => person.id === 'person-mamiya-reiji');
    const nanase = case000.personLogs.find((person) => person.id === 'person-nanase-miori');

    expect(mamiya?.simpleFact).toContain('間宮怜司は発砲義体の登録者');
    expect(nanase?.summary).toContain('所持品の未登録人格記録装置');
    expect(itchPage).toContain('都市警備局所属の間宮怜司に登録された警備用右腕義体');
    expect(itchPage).toContain('被害者の七瀬未織');
    expect(itchPage).not.toContain('七瀬未織の所有物');
  });

  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<App />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const findButton = (label: string) => [...container.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes(label));

  const findSummary = (label: string) => [...container.querySelectorAll('summary')].find((candidate) => candidate.textContent?.includes(label));

  const clickSummary = (label: string) => {
    const summary = findSummary(label);
    expect(summary, `summary containing ${label}`).toBeDefined();
    act(() => summary?.click());
  };

  const clickButton = (label: string) => {
    const button = findButton(label);
    expect(button, `button containing ${label}`).toBeDefined();
    act(() => button?.click());
  };

  const enterInvestigation = () => {
    clickButton('監査端末を起動');
    clickButton('通知を確認');
    clickButton('Case000を開く');
    clickButton('調査を開始');
  };

  it('presents Case000 and Case001 as available incident files', () => {
    clickButton('監査端末を起動');
    clickButton('通知を確認');

    expect(container.textContent).toContain('CASE ARCHIVE');
    expect(container.textContent).toContain('監査可能');
    expect(container.textContent).toContain('焼却されなかった声');
    expect(container.textContent).not.toContain('previewOnly');
    expect(container.textContent).not.toContain('凍結中');
    expect(findButton('Case001を開く')).toBeDefined();
    expect(container.querySelector('[aria-label="監査傾向"]')?.textContent).toContain('監査傾向：未記録');
  });

  it('shows a saved Case001 result as processed in the case archive', () => {
    act(() => root.unmount());
    localStorage.setItem('persona-null:case-results', JSON.stringify([{
      caseId: 'case001',
      decisionId: 'preserve-fragment',
      pinnedNodeIds: ['repeated-voice'],
      taggedNodes: { 'repeated-voice': ['persona_signature'] },
      executedActionIds: [],
      finalStats: { security: 56, ethics: 60, surveillance: 75, egoStability: 47 },
      completedAt: '2026-06-10T00:00:00.000Z',
    }]));
    root = createRoot(container);
    act(() => root.render(<App />));

    clickButton('監査端末を起動');
    clickButton('通知を確認');
    const case001Button = findButton('Case001を開く');
    const case001Card = case001Button?.closest('.case-file');
    expect(case001Card?.textContent).toContain('処理済記録あり / 再監査可能');
    const tendency = container.querySelector('[aria-label="監査傾向"]');
    expect(tendency?.textContent).toContain('人格断片保護1');
    expect(tendency?.textContent).toContain('証拠保全1');
    expect(tendency?.textContent).toContain('都市変動累計');
  });

  it('keeps the case archive available when saved result JSON is malformed', () => {
    act(() => root.unmount());
    localStorage.setItem('persona-null:case-results', '{not-json');
    root = createRoot(container);
    act(() => root.render(<App />));

    clickButton('監査端末を起動');
    clickButton('通知を確認');
    expect(container.querySelector('[aria-label="監査傾向"]')?.textContent).toContain('監査傾向：未記録');
    expect(findButton('Case000を開く')).toBeDefined();
    expect(findButton('Case001を開く')).toBeDefined();
  });

  it('shows record status, resource gauge, and restrained operation feedback', () => {
    enterInvestigation();
    expect(container.querySelectorAll('.resource-blocks i.filled')).toHaveLength(3);

    clickButton('ノード：発砲ログ');
    expect(container.querySelector('.operation-toast')?.textContent).toContain('SCAN COMPLETE');
    expect(container.querySelector('.record-status-bar')?.textContent).toContain('RECORD STATUS');
    expect(container.querySelector('.record-status-bar')?.textContent).toContain('確認済');
    expect(container.querySelector('.record-status-bar')?.textContent).toContain('重大');
    expect(container.querySelector('.record-status-bar')?.textContent).toContain('根拠未提出');
    expect(container.querySelector('.record-status-bar')?.textContent).toContain('矛盾未分類');

    clickButton('判断根拠に追加');
    expect(container.querySelector('.operation-toast')?.textContent).toContain('EVIDENCE PINNED');
    expect(container.querySelector('.record-status-bar')?.textContent).toContain('根拠提出済');
    clickButton('判断根拠から外す');
    expect(container.querySelector('.operation-toast')?.textContent).toContain('EVIDENCE RELEASED');
  });

  it('clears operation feedback quickly without requiring another action', () => {
    enterInvestigation();
    vi.useFakeTimers();

    try {
      clickButton('ノード：発砲ログ');
      expect(container.querySelector('.operation-toast')?.textContent).toContain('SCAN COMPLETE');

      act(() => vi.advanceTimersByTime(1400));
      expect(container.querySelector('.operation-toast')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('progresses from the concise investigation view to a result', () => {
    expect(container.textContent).toContain('CITY OS AUDIT TERMINAL');
    expect(container.textContent).toContain('ACCESS: PROVISIONAL');
    expect(container.textContent).toContain('KASUMI-GATE-09 / CASE000');
    enterInvestigation();

    expect(container.textContent).toContain('CASE INDEX');
    expect(container.textContent).toContain('MEMORY NETWORK');
    expect(container.textContent).toContain('EVIDENCE DETAIL');
    expect(container.textContent).toContain('JUDGMENT CONSOLE');
    expect(container.querySelector('.judgment-state.locked')?.textContent).toContain('LOCKED');

    expect(container.textContent).toContain('次の監査手順');
    expect(container.textContent).toContain('記憶ノードを4件以上確認してください');
    expect(container.textContent).toContain('記憶ノードを選択してください');
    expect(container.textContent).toContain('必要ノード確認0/4未達成');
    expect(container.textContent).toContain('判断根拠0/1未達成');
    expect(container.textContent).toContain('矛盾分類0/1未達成');
    expect((findSummary('事件・監査情報を表示')?.parentElement as HTMLDetailsElement).open).toBe(false);

    clickButton('ノード：発砲ログ');
    const recordDetails = findSummary('詳細記録を表示')?.parentElement as HTMLDetailsElement;
    expect(recordDetails.open).toBe(false);
    const selectedNode = case000.nodes[0];
    const title = container.querySelector('.node-header h2');
    const summary = container.querySelector('.node-summary');
    const simpleFact = container.querySelector('.node-core-facts');
    const inspectorNote = container.querySelector('.inspector-note');
    const warning = container.querySelector('.node-warning');
    const metrics = recordDetails.querySelector('.metrics');
    const appearsBefore = (earlier: Element | null, later: Element | null) =>
      Boolean(earlier && later && earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(simpleFact?.textContent).toContain('単純事実');
    expect(inspectorNote?.textContent).toContain('監査官メモ');
    expect(warning?.querySelector('.warning-text')?.textContent).toContain(selectedNode.warning);
    expect(recordDetails.querySelector('h3')?.textContent).toBe('詳細ログ');
    expect(recordDetails.querySelector('code')?.textContent).toBe(selectedNode.log);
    expect(metrics).not.toBeNull();
    const statusBar = container.querySelector('.record-status-bar');
    expect(appearsBefore(title, statusBar)).toBe(true);
    expect(appearsBefore(statusBar, summary)).toBe(true);
    expect(appearsBefore(summary, simpleFact)).toBe(true);
    expect(appearsBefore(simpleFact, inspectorNote)).toBe(true);
    expect(appearsBefore(inspectorNote, warning)).toBe(true);
    expect(appearsBefore(warning, recordDetails)).toBe(true);
    expect(appearsBefore(recordDetails.querySelector('code'), metrics)).toBe(true);
    clickSummary('詳細記録を表示');
    expect(recordDetails.open).toBe(true);

    case000.nodes.slice(0, case000.requiredNodesToJudge).forEach((node) => clickButton(`ノード：${node.title}`));
    expect(container.textContent).toContain('判断根拠の登録');

    clickButton('判断根拠に追加');
    expect(container.textContent).toContain('矛盾記録の分類');

    clickButton('人格署名の矛盾');
    expect(container.querySelector('.operation-toast')?.textContent).toContain('JUDGMENT READY');
    expect(container.querySelector('.judgment-state.ready')?.textContent).toContain('JUDGMENT READY');
    expect(container.textContent).toContain('必要ノード確認4/4完了');
    expect(container.textContent).toContain('判断根拠1/1完了');
    expect(container.textContent).toContain('矛盾分類1/1完了');

    clickButton('最終判断へ進む');
    expect(container.textContent).toContain('AUDIT RULING');
    expect(container.textContent).toContain('判断は不可逆です');
    expect(container.textContent).toContain('優先される価値');
    expect(container.textContent).toContain('失われる価値');
    expect(container.textContent).toContain('採用される根拠');
    expect(container.textContent).toContain('無視される争点');
    expect(container.textContent).toContain('都市ステータスへの影響');
    expect(container.querySelectorAll('.decision-processing')).toHaveLength(3);
    expect(container.textContent).toContain('記録整合性と治安維持を優先');
    expect(container.textContent).toContain('証拠保全と再照合を優先');
    expect(container.textContent).toContain('人格断片、または周辺の未登録反応');
    const rulingOptions = [...container.querySelectorAll<HTMLElement>('.ruling-option')];
    expect(rulingOptions).toHaveLength(case000.decisions.length);
    expect(rulingOptions[0].textContent).toContain('優先される価値記録整合性優先');
    expect(rulingOptions[0].textContent).toContain('失われる価値人格断片保護');
    expect(rulingOptions[0].textContent).toContain('採用される根拠');
    expect(rulingOptions[0].textContent).toContain('提出一致 0 / 2');
    expect(rulingOptions[0].textContent).toContain('この裁定案は未提出記録を採用根拠に含みます。');
    expect(findButton(case000.decisions[0].label)?.disabled).toBe(false);
    clickButton(case000.decisions[0].label);

    expect(container.textContent).toContain('AUDIT RULING');
    expect(container.textContent).toContain('AUDIT RULING ARCHIVED');
    expect(container.textContent).toContain('裁定記録');
    expect(container.textContent).toContain('KASUMI-GATE-09');
    expect(container.textContent).toContain('保存完了');
    expect(container.querySelector('[aria-label="裁定結果要約"]')).not.toBeNull();
    expect([...container.querySelectorAll('.result-section h3')].map((heading) => heading.textContent)).not.toContain('最終裁定');
    expect([...container.querySelectorAll('.result-section h3')].map((heading) => heading.textContent)).not.toContain('優先された価値');
    expect([...container.querySelectorAll('.result-section h3')].map((heading) => heading.textContent)).not.toContain('軽視された価値');
    expect(container.querySelector('[aria-label="裁定結果要約"]')?.textContent).toContain('間宮怜司を発砲責任者として拘束');
    expect(container.querySelector('[aria-label="裁定結果要約"]')?.textContent).toContain('救った価値（優先）');
    expect(container.querySelector('[aria-label="裁定結果要約"]')?.textContent).toContain('犠牲にした価値（軽視）');
    expect(container.querySelector('[aria-label="裁定結果要約"]')?.textContent).toContain('記録整合性優先');
    expect(container.querySelector('[aria-label="裁定結果要約"]')?.textContent).toContain('人格断片保護');
    expect(container.textContent).toContain('提出された判断根拠');
    expect(container.textContent).toContain('分類された矛盾');
    expect(container.textContent).toContain('都市ステータス変動');
    expect(container.textContent).toContain('この裁定は、以後の未確定人格案件における参照基準として保存されます。');
    expect(container.textContent).not.toContain('選択肢A');
    expect(container.querySelector('.ruling-stamp')).not.toBeNull();
    expect(localStorage.getItem('persona-null:case-results')).not.toBeNull();
    clickButton('事件選択へ戻る');
    expect(container.querySelector('[aria-label="監査傾向"]')?.textContent).toContain('記録整合性優先1');
  });
  it('presents the investigation as an audit terminal with semantic cards, chips, and chronological logs', () => {
    enterInvestigation();

    expect(container.querySelector('.app-shell.game-grid')).not.toBeNull();
    expect(container.textContent).toContain('AUDIT LOG');
    expect(container.querySelectorAll('.status-chip').length).toBeGreaterThanOrEqual(4);
    expect(container.textContent).toContain('必要ノード確認');
    expect(container.textContent).toContain('監査リソース');

    clickButton('ノード：発砲ログ');
    expect(container.querySelector('.node-core-facts')).not.toBeNull();
    expect(container.querySelector('.inspector-note')).not.toBeNull();
    expect(container.querySelector('.node-warning .warning-text')).not.toBeNull();

    const logItems = [...container.querySelectorAll('.log-list p')];
    expect(logItems.at(0)?.textContent).toContain('監査室端末を起動');
    expect(logItems.at(-1)?.textContent).toContain('記憶ノード確認');
  });

  it('shows warning panels only for critical nodes, even when other nodes have warning text', () => {
    enterInvestigation();

    const normalNode = case000.nodes.find((node) => node.id === 'last-comm');
    const administrativeNode = case000.nodes.find((node) => node.id === 'processing-request');
    const evidenceLossNode = case000.nodes.find((node) => node.id === 'victim-medium');
    expect(normalNode).toBeDefined();
    expect(administrativeNode).toBeDefined();
    expect(evidenceLossNode).toBeDefined();
    expect(normalNode).toMatchObject({ warningLevel: 'none' });
    expect(normalNode?.warning.trim()).not.toBe('');
    expect(administrativeNode).toMatchObject({ warningLevel: 'none' });
    expect(administrativeNode?.warning.trim()).not.toBe('');
    expect(evidenceLossNode).toMatchObject({ warningLevel: 'critical' });

    clickButton(`ノード：${normalNode?.title}`);
    expect(container.querySelector('.node-warning')).toBeNull();

    clickButton(`ノード：${administrativeNode?.title}`);
    expect(container.querySelector('.node-warning')).toBeNull();

    clickButton(`ノード：${evidenceLossNode?.title}`);
    expect(container.querySelector('.node-warning .warning-text')?.textContent).toContain(evidenceLossNode?.warning);
    const investigationText = container.querySelector('.game-grid')?.textContent ?? '';
    for (const metaTerm of ['Case001', 'MVP', 'Jam', 'プレイヤー', '予告', '本編']) {
      expect(investigationText).not.toContain(metaTerm);
    }
  });

  it('omits the inspector note section when the selected node has no inspector note', () => {
    const node = case000.nodes[0];
    const originalInspectorNote = node.inspectorNote;
    node.inspectorNote = '';

    try {
      enterInvestigation();
      clickButton(`ノード：${node.title}`);

      expect(container.querySelector('.inspector-note')).toBeNull();
      const rightPaneText = container.querySelector('.right-pane')?.textContent ?? '';
      expect(rightPaneText.indexOf('単純事実')).toBeLessThan(rightPaneText.indexOf('警告'));
      expect(rightPaneText.indexOf('警告')).toBeLessThan(rightPaneText.indexOf('詳細ログ'));
    } finally {
      node.inspectorNote = originalInspectorNote;
    }
  });

  it('shows only suggested contradiction tags and hides controls for unclassified records', () => {
    enterInvestigation();

    clickButton('ノード：間宮の発砲記憶');
    expect(findButton('記憶由来の矛盾')).toBeDefined();
    expect(findButton('操作主体の矛盾')).toBeDefined();
    expect(findButton('身体認証の矛盾')).toBeUndefined();

    clickButton('ノード：都市警備局の処理要求');
    expect(container.querySelector('.tag-box')).toBeNull();
    expect(findButton('記憶由来の矛盾')).toBeUndefined();
  });

  it('selects nodes from the memory node index and distinguishes review states', () => {
    enterInvestigation();

    expect(container.textContent).toContain('争点別 記憶ノード');
    expect(container.textContent).toContain('発砲操作主体は誰か');
    expect(container.textContent).toContain(`未確認 ${case000.nodes.length}`);
    expect(findButton('発砲ログ')).toBeDefined();
    const issueDetails = findSummary('争点詳細を表示')?.parentElement as HTMLDetailsElement;
    expect(issueDetails.open).toBe(false);
    clickSummary('争点詳細を表示');
    expect(issueDetails.open).toBe(true);
    expect(issueDetails.textContent).toContain('確認 0 / 4');
    expect(issueDetails.textContent).toContain('根拠 0');

    clickButton('発砲ログ');
    expect(container.textContent).toContain(`未確認 ${case000.nodes.length - 1}`);
    expect(container.textContent).toContain('記録状態：確認済');
    expect(container.textContent).toContain(`記録種別：${case000.nodes[0].type}`);
    expect(container.textContent).toContain('確認 1 / 4');

    clickButton('判断根拠に追加');
    expect(container.textContent).toContain('根拠 1');

    clickButton('間宮の発砲記憶');
    expect(container.textContent).toContain('確認済');
    expect(container.textContent).toContain('選択中');
  });


  it('shows executed analysis reports on each target node', () => {
    enterInvestigation();

    clickButton('ノード：間宮の発砲記憶');
    clickButton('ノード：義体稼働履歴');
    expect((findSummary('解析メニューを表示')?.parentElement as HTMLDetailsElement).open).toBe(false);
    clickSummary('解析メニューを表示');
    clickButton('欠落8秒の復元');

    expect(container.querySelector('.operation-toast')?.textContent).toContain('AUDIT RESOURCE CONSUMED');
    expect(container.querySelector('.resource-gauge')?.textContent).toContain('2 / 3');
    expect(container.textContent).toContain('追加解析結果');
    expect(container.textContent).toContain('欠損区間は断片のみ復元。外部命令断定ではなく境界曖昧化を示唆。');
    expect(container.querySelector('.node-record-details .analysis-report')).toBeNull();
    expect(container.querySelector('.analysis-summary > .analysis-report')).not.toBeNull();

    clickButton('ノード：発砲ログ');
    expect(container.querySelector('.analysis-report')).toBeNull();
  });

  it('keeps analysis actions disabled until their record conditions are met', () => {
    enterInvestigation();
    clickButton('ノード：発砲ログ');
    clickSummary('解析メニューを表示');

    expect(findButton('欠落8秒の復元')?.disabled).toBe(true);
    expect(container.textContent).toContain('状態：未解放');
    expect(container.textContent).toContain('間宮の発砲記憶');
    expect(container.textContent).toContain('義体稼働履歴');

    clickButton('ノード：間宮の発砲記憶');
    expect(findButton('欠落8秒の復元')?.disabled).toBe(true);
    clickButton('ノード：義体稼働履歴');
    expect(findButton('欠落8秒の復元')?.disabled).toBe(false);
    expect(findButton('認証鍵と記録装置の照合')?.disabled).toBe(true);
  });


  it('plays Case001 through judgment and saves its result', () => {
    clickButton('監査端末を起動');
    clickButton('通知を確認');
    clickButton('Case001を開く');
    expect(container.textContent).toContain('焼却されなかった声');
    clickButton('調査を開始');

    ['焼却処理キュー', '反復発話ログ', '断片記憶', '自己保存反応'].forEach((title) => clickButton(`ノード：${title}`));
    expect(container.textContent).toContain('必要ノード確認 4/4');
    clickButton('ノード：反復発話ログ');
    expect(container.textContent).toContain('私は、見ていました');
    expect(container.textContent).toContain('犯人の顔ではなく');
    expect(container.textContent).toContain('通常認証から');
    expect(container.textContent).toContain('へ切り替わり');
    expect(container.textContent).toContain('偽装処理された瞬間');

    clickButton('ノード：断片記憶');
    expect(container.querySelector('.node-warning')).toBeNull();
    expect(container.textContent).toContain('表情・視線・生体反応に発砲意図は記録されていない');
    expect(container.textContent).toContain('発砲命令は');
    expect(container.textContent).toContain('で処理されている');
    expect(container.textContent).toContain('命令元');
    expect(container.textContent).toContain('未確定');
    expect(container.textContent).toContain('監査官メモ');
    expect(container.textContent).toContain('詳細ログ');

    clickButton('判断根拠に追加');
    clickButton('記憶由来の矛盾');
    expect(findButton('最終判断へ進む')?.disabled).toBe(false);
    clickButton('最終判断へ進む');

    expect(container.textContent).toContain('証言能力なしとして焼却処理を承認');
    expect(container.textContent).toContain('人格断片として証拠保全');
    expect(container.textContent).toContain('証言ではなく異常記録として隔離');
    clickButton('B. 人格断片として証拠保全を確定');

    expect(container.textContent).toContain('救った価値（優先）');
    expect(container.textContent).toContain('犠牲にした価値（軽視）');
    expect(container.textContent).toContain('人格断片保全');
    const saved = JSON.parse(localStorage.getItem('persona-null:case-results') ?? '[]');
    expect(saved).toEqual([expect.objectContaining({ caseId: 'case001', decisionId: 'preserve-fragment' })]);
  });

});
