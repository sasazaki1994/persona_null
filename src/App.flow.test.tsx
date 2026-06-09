// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('Case000 player flow', () => {
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

  it('progresses from the concise investigation view to a result', () => {
    enterInvestigation();

    expect(container.textContent).toContain('次の監査手順');
    expect(container.textContent).toContain('記憶ノードを4件以上確認してください');
    expect(container.textContent).toContain('記憶ノードを選択してください');
    expect(container.textContent).toContain('不足：確認 0/4');
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
    expect(appearsBefore(title, summary)).toBe(true);
    expect(appearsBefore(summary, simpleFact)).toBe(true);
    expect(appearsBefore(simpleFact, inspectorNote)).toBe(true);
    expect(appearsBefore(inspectorNote, warning)).toBe(true);
    expect(appearsBefore(warning, recordDetails)).toBe(true);
    expect(appearsBefore(recordDetails.querySelector('code'), metrics)).toBe(true);
    clickSummary('詳細記録を表示');
    expect(recordDetails.open).toBe(true);

    case000.nodes.slice(0, case000.requiredNodesToJudge).forEach((node) => clickButton(`ノード：${node.title}`));
    expect(container.textContent).toContain('判断根拠の登録');

    clickButton('提出根拠に登録');
    expect(container.textContent).toContain('矛盾記録の分類');

    clickButton('人格署名の矛盾');
    expect(container.textContent).toContain('最終判断：開放済');
    expect(container.textContent).toContain('不足：なし');

    clickButton('最終判断へ進む');
    expect(container.textContent).toContain('優先される価値');
    expect(container.textContent).toContain('軽視される価値');
    expect(container.textContent).toContain('都市ステータスへの影響');
    expect(container.querySelectorAll('.decision-processing')).toHaveLength(3);
    expect(container.textContent).toContain('記録整合性と治安維持を優先');
    expect(container.textContent).toContain('証拠保全と再照合を優先');
    expect(container.textContent).toContain('人格断片、または周辺の未登録反応');
    const decisionDetails = [...container.querySelectorAll<HTMLDetailsElement>('.decision-details')];
    expect(decisionDetails).toHaveLength(case000.decisions.length);
    expect(decisionDetails.every((details) => !details.open)).toBe(true);
    clickSummary('裁定詳細を表示');
    expect(decisionDetails[0].open).toBe(true);
    expect(decisionDetails[0].textContent).toContain('採用される根拠');
    expect(decisionDetails[0].textContent).toContain('提出根拠との一致 0 / 2');
    expect(decisionDetails[0].textContent).toContain('この裁定案は、現在の提出根拠と一致していません。');
    expect(findButton(case000.decisions[0].label)?.disabled).toBe(false);
    clickButton(case000.decisions[0].label);

    expect(container.textContent).toContain('行政処理ログ');
    expect(container.querySelector('[aria-label="裁定結果要約"]')).not.toBeNull();
    expect(container.textContent).toContain('最終裁定');
    expect(container.querySelector('[aria-label="裁定結果要約"]')?.textContent).toContain('間宮怜司を発砲責任者として拘束');
    expect(container.textContent).not.toContain('選択肢A');
    expect(container.querySelector('.ruling-stamp')).not.toBeNull();
    expect(localStorage.getItem('persona-null:case-results')).not.toBeNull();
  });
  it('presents the investigation as an audit terminal with semantic cards, chips, and chronological logs', () => {
    enterInvestigation();

    expect(container.querySelector('.app-shell.game-grid')).not.toBeNull();
    expect(container.textContent).toContain('AUDIT LOG');
    expect(container.querySelectorAll('.status-chip').length).toBeGreaterThanOrEqual(4);
    expect(container.textContent).toContain('既読数');
    expect(container.textContent).toContain('監査リソース');

    clickButton('ノード：発砲ログ');
    expect(container.querySelector('.node-core-facts')).not.toBeNull();
    expect(container.querySelector('.inspector-note')).not.toBeNull();
    expect(container.querySelector('.node-warning .warning-text')).not.toBeNull();

    const logItems = [...container.querySelectorAll('.log-list p')];
    expect(logItems.at(0)?.textContent).toContain('監査室端末を起動');
    expect(logItems.at(-1)?.textContent).toContain('記憶ノード確認');
  });

  it('shows warnings only for nodes with important warning text', () => {
    enterInvestigation();

    const normalNode = case000.nodes.find((node) => node.id === 'last-comm');
    const administrativeNode = case000.nodes.find((node) => node.id === 'processing-request');
    const evidenceLossNode = case000.nodes.find((node) => node.id === 'victim-medium');
    expect(normalNode).toBeDefined();
    expect(administrativeNode).toBeDefined();
    expect(evidenceLossNode).toBeDefined();

    clickButton(`ノード：${normalNode?.title}`);
    expect(container.querySelector('.node-warning')).toBeNull();

    clickButton(`ノード：${administrativeNode?.title}`);
    expect(container.querySelector('.node-warning')).toBeNull();

    clickButton(`ノード：${evidenceLossNode?.title}`);
    expect(container.querySelector('.node-warning .warning-text')?.textContent).toContain(evidenceLossNode?.warning);
    expect(container.querySelector('.right-pane')?.textContent).not.toContain('Case001');
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

    clickButton('提出根拠に登録');
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

    expect(container.textContent).toContain('追加解析結果');
    expect(container.textContent).toContain('欠損区間は断片のみ復元。外部命令断定ではなく境界曖昧化を示唆。');

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

});
