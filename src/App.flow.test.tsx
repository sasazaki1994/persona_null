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

  const clickButton = (label: string) => {
    const button = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes(label));
    expect(button, `button containing ${label}`).toBeDefined();
    act(() => button?.click());
  };

  it('progresses from title through the guided investigation to a result', () => {
    clickButton('監査端末を起動');
    clickButton('通知を確認');
    clickButton('Case000を開く');
    clickButton('調査を開始');

    expect(container.textContent).toContain('次の監査手順');
    expect(container.textContent).toContain('記憶ノードを4件以上確認してください');

    case000.nodes.slice(0, case000.requiredNodesToJudge).forEach((node) => clickButton(`ノード：${node.title}`));
    expect(container.textContent).toContain('判断根拠の登録');

    clickButton('根拠としてピン留め');
    expect(container.textContent).toContain('矛盾記録の分類');

    clickButton('身体認証の矛盾');
    expect(container.textContent).toContain('判断条件に必要な操作は完了しています');
    expect(container.textContent).toContain('最終判断まで');

    clickButton('最終判断へ進む');
    clickButton(case000.decisions[0].label);

    expect(container.textContent).toContain('行政処理ログ');
    expect(container.textContent).toContain('最終裁定');
    expect(localStorage.getItem('persona-null:case-results')).not.toBeNull();
  });
});
