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

  it('progresses from title through the guided investigation to a result', () => {
    enterInvestigation();

    expect(container.textContent).toContain('次の監査手順');
    expect(container.textContent).toContain('記憶ノードを4件以上確認してください');
    expect(container.textContent).toContain('監査官メモ');
    expect(container.textContent).toContain('公式記録上の発砲主体は明確');
    expect(container.textContent).toContain('本人記憶との照合が必要');

    case000.nodes.slice(0, case000.requiredNodesToJudge).forEach((node) => clickButton(`ノード：${node.title}`));
    expect(container.textContent).toContain('判断根拠の登録');

    clickButton('提出根拠に登録');
    expect(container.textContent).toContain('矛盾記録の分類');

    clickButton('人格署名の矛盾');
    expect(container.textContent).toContain('判断条件に必要な操作は完了しています');
    expect(container.textContent).toContain('最終判断まで');

    clickButton('最終判断へ進む');
    expect(container.textContent).toContain('採用される根拠');
    expect(container.textContent).toContain('無視または保留される疑点');
    expect(container.textContent).toContain('都市ステータスへの影響');
    expect(container.textContent).toContain('根拠提出済');
    expect(container.textContent).toContain('未提出');
    expect(container.textContent).toContain('提出根拠との一致 0 / 1');
    expect(container.textContent).toContain('提出根拠との一致 1 / 4');
    clickButton(case000.decisions[0].label);

    expect(container.textContent).toContain('行政処理ログ');
    expect(container.textContent).toContain('最終裁定');
    expect(localStorage.getItem('persona-null:case-results')).not.toBeNull();
  });
  it('shows only suggested contradiction tags and hides controls for unclassified records', () => {
    enterInvestigation();

    clickButton('ノード：間宮の発砲記憶');
    expect(findButton('記憶由来の矛盾')).toBeDefined();
    expect(findButton('操作主体の矛盾')).toBeDefined();
    expect(findButton('身体認証の矛盾')).toBeUndefined();

    clickButton('ノード：都市警備局の処理要求');
    expect(container.textContent).toContain('この記録に分類可能な矛盾は検出されていません');
    expect(findButton('記憶由来の矛盾')).toBeUndefined();
  });

  it('selects nodes from the memory node index and distinguishes review states', () => {
    enterInvestigation();

    expect(container.textContent).toContain('争点別 記憶ノード');
    expect(container.textContent).toContain('発砲操作主体は誰か');
    expect(container.textContent).toContain(`未確認 ${case000.nodes.length}`);
    expect(findButton('発砲ログ')).toBeDefined();
    expect(container.textContent).toContain('確認 0 / 4');
    expect(container.textContent).toContain('根拠 0');

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

  it('keeps analysis actions disabled until their record conditions are met', () => {
    enterInvestigation();

    expect(findButton('欠落8秒の復元')?.disabled).toBe(true);
    expect(container.textContent).toContain('状態：未解放');
    expect(container.textContent).toContain('間宮の発砲記憶');
    expect(container.textContent).toContain('義体稼働履歴');

    clickButton('ノード：間宮の発砲記憶');
    expect(findButton('欠落8秒の復元')?.disabled).toBe(true);
    clickButton('ノード：義体稼働履歴');
    expect(findButton('欠落8秒の復元')?.disabled).toBe(false);
    expect(findButton('認証鍵と媒体の照合')?.disabled).toBe(true);
  });

});
