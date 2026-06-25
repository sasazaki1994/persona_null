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

  const restartWithSavedResults = (results: unknown[]) => {
    act(() => root.unmount());
    localStorage.setItem('persona-null:case-results', JSON.stringify(results));
    root = createRoot(container);
    act(() => root.render(<App />));
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

  it('does not show a continuity reference when Case000 has no saved ruling', () => {
    clickButton('監査端末を起動');
    clickButton('通知を確認');
    clickButton('Case001を開く');

    expect(container.querySelector('[aria-label="前回裁定の参照基準"]')).toBeNull();
    expect(findButton('調査を開始')).toBeDefined();
  });

  it('shows a saved preservation ruling in the Case001 overview and investigation log', () => {
    restartWithSavedResults([{
      caseId: 'case000',
      decisionId: 'freeze-evidence',
      pinnedNodeIds: ['victim-medium'],
      taggedNodes: { 'victim-medium': ['persona_signature'] },
      executedActionIds: [],
      finalStats: { security: 55, ethics: 67, surveillance: 70, egoStability: 64 },
      completedAt: '2026-06-15T00:00:00.000Z',
    }]);

    clickButton('監査端末を起動');
    clickButton('通知を確認');
    clickButton('Case001を開く');

    const continuityPanel = container.querySelector('[aria-label="前回裁定の参照基準"]');
    expect(continuityPanel?.textContent).toContain('前回裁定：証拠保全の優先');
    expect(continuityPanel?.textContent).toContain('制限付き証拠');
    expect(continuityPanel?.textContent).toContain('都市ステータスへの暫定影響');
    expect(continuityPanel?.textContent).toContain('事実記録を変更しません');

    clickButton('調査を開始');
    expect(container.textContent).toContain('未確定人格断片の保全猶予が付与されています');
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

  it('shows a sparse top bar and opens node detail in a modal', () => {
    enterInvestigation();

    // The live screen keeps only the top conditions, the network, and a single next-step line.
    expect(container.querySelector('.app-shell.audit-room')).not.toBeNull();
    expect(container.querySelector('[aria-label="処理圧力"]')?.textContent).toContain('処理圧力 0/100');
    expect(container.querySelector('[aria-label="処理圧力"]')?.textContent).toContain('LOW');
    expect(container.querySelector('[aria-label="監査報告書チェック"]')?.textContent).toContain('監査報告書：裁定条件未達');
    expect(container.querySelector('[aria-label="処理圧力状態"]')?.textContent).toContain('追加監査は許容範囲内');
    expect(container.querySelector('[aria-label="監査リソース"]')?.textContent).toContain('監査リソース 3/3');
    expect(container.querySelector('.audit-modal')).toBeNull();

    clickButton('ノード：発砲ログ');
    expect(container.querySelector('[aria-label="処理圧力"]')?.textContent).toContain('処理圧力 4/100');
    clickButton('ノード：発砲ログ');
    expect(container.querySelector('[aria-label="処理圧力"]')?.textContent).toContain('処理圧力 4/100');

    const modal = container.querySelector('.audit-modal');
    expect(modal).not.toBeNull();
    expect(container.querySelector('.operation-toast')?.textContent).toContain('記録を開いた');
    expect(modal?.querySelector('.record-status-line')?.textContent).toContain('確認済');
    expect(modal?.querySelector('.record-status-line')?.textContent).toContain('重大');

    clickButton('判断根拠に追加');
    expect(container.querySelector('.operation-toast')?.textContent).toContain('EVIDENCE PINNED');
    clickButton('判断根拠から除外');
    expect(container.querySelector('.operation-toast')?.textContent).toContain('EVIDENCE RELEASED');
  });

  it('closes the node modal with the close button, backdrop, and Escape key', () => {
    enterInvestigation();

    clickButton('ノード：発砲ログ');
    expect(container.querySelector('.audit-modal')).not.toBeNull();
    clickButton('閉じる');
    expect(container.querySelector('.audit-modal')).toBeNull();

    clickButton('ノード：発砲ログ');
    act(() => container.querySelector<HTMLElement>('.audit-modal-backdrop')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(container.querySelector('.audit-modal')).toBeNull();

    clickButton('ノード：発砲ログ');
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(container.querySelector('.audit-modal')).toBeNull();
  });

  it.each([
    ['Case000を開く', '発砲ログ'],
    ['Case001を開く', '焼却処理キュー'],
  ])('updates the judgment condition chips while investigating %s', (caseButton, firstNodeTitle) => {
    clickButton('監査端末を起動');
    clickButton('通知を確認');
    clickButton(caseButton);
    clickButton('調査を開始');

    const conditions = container.querySelector('[aria-label="判断条件"]');
    expect(conditions?.textContent).toContain('判断条件');
    expect(conditions?.textContent).toContain('必須記録確認0/4');
    expect(conditions?.textContent).toContain('判断根拠0/1');
    expect(conditions?.textContent).toContain('矛盾分類0/1');
    expect(findButton('最終裁定へ進む')?.disabled).toBe(true);

    clickButton(`ノード：${firstNodeTitle}`);
    expect(conditions?.textContent).toContain('必須記録確認1/4');
    clickButton('判断根拠に追加');
    expect(conditions?.textContent).toContain('判断根拠1/1');
  });

  it('clears operation feedback quickly without requiring another action', () => {
    enterInvestigation();
    vi.useFakeTimers();

    try {
      clickButton('ノード：発砲ログ');
      expect(container.querySelector('.operation-toast')?.textContent).toContain('記録を開いた');

      act(() => vi.advanceTimersByTime(1400));
      expect(container.querySelector('.operation-toast')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('progresses from the concise investigation view to a result through the decision modal', () => {
    expect(container.textContent).toContain('CITY OS AUDIT TERMINAL');
    expect(container.textContent).toContain('ACCESS: PROVISIONAL');
    expect(container.textContent).toContain('KASUMI-GATE-09 / CASE000');
    enterInvestigation();

    expect(container.querySelector('.audit-room')).not.toBeNull();
    expect(container.textContent).toContain('監査フェーズ：記録確認');
    expect(container.querySelector('.next-step-line')?.textContent).toContain('記憶ノードを4件以上確認してください');
    expect(container.querySelector('[aria-label="判断条件"]')?.textContent).toContain('必須記録確認0/4');
    expect(findButton('事件概要')).toBeDefined();
    expect(findButton('関係者照会')).toBeDefined();
    expect(findButton('最終裁定へ進む')?.disabled).toBe(true);
    expect(container.querySelector('.judge-reason')?.textContent).toContain('記録確認が不足');

    clickButton('ノード：発砲ログ');
    const modal = () => container.querySelector('.audit-modal');
    const appearsBefore = (earlier: Element | null, later: Element | null) =>
      Boolean(earlier && later && earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);
    const title = modal()?.querySelector('h2') ?? null;
    const summary = modal()?.querySelector('.node-summary') ?? null;
    const warning = modal()?.querySelector('.node-warning') ?? null;
    const log = modal()?.querySelector('.node-log-section') ?? null;
    const note = modal()?.querySelector('.inspector-note') ?? null;

    expect(summary?.textContent).toContain('記録要約');
    expect(summary?.textContent).toContain('発砲命令を受理');
    expect(summary?.textContent).toContain('命令には間宮');
    expect(summary?.textContent).toContain('身体認証');
    expect(warning?.querySelector('.warning-text')?.textContent).toContain(case000.nodes[0].warning);
    expect(log?.textContent).toContain('詳細ログ');
    expect(note?.textContent).toContain('監査官メモ');
    expect(appearsBefore(title, summary)).toBe(true);
    expect(appearsBefore(summary, log)).toBe(true);
    expect(appearsBefore(log, note)).toBe(true);

    case000.nodes.slice(0, case000.requiredNodesToJudge).forEach((node) => clickButton(`ノード：${node.title}`));
    expect(container.textContent).toContain('監査フェーズ：根拠選定');
    expect(container.querySelector('.next-step-line')?.textContent).toContain('根拠を1件以上登録');

    clickButton('判断根拠に追加');
    expect(container.textContent).toContain('監査フェーズ：矛盾分類');
    expect(container.querySelector('.next-step-line')?.textContent).toContain('矛盾対象ノードを1件以上分類');

    clickButton('人格署名の矛盾');
    expect(container.querySelector('[aria-label="処理圧力"]')?.textContent).toContain('処理圧力 24/100');
    expect(container.querySelector('.operation-toast')?.textContent).toContain('JUDGMENT READY');
    expect(container.querySelector('[aria-label="判断条件"]')?.textContent).toContain('必須記録確認4/4');
    expect(container.querySelector('[aria-label="判断条件"]')?.textContent).toContain('判断根拠1/1');
    expect(container.querySelector('[aria-label="判断条件"]')?.textContent).toContain('矛盾分類1/1');
    expect(findButton('最終裁定へ進む')?.disabled).toBe(false);

    clickButton('最終裁定へ進む');
    expect(container.textContent).toContain('AUDIT RULING');
    expect(container.textContent).toContain('判断は不可逆です');
    expect(container.textContent).toContain('処理圧力下での裁定');
    expect(container.textContent).toContain('追加監査は許容範囲内');
    expect(container.textContent).toContain('優先される価値');
    expect(container.textContent).toContain('失われる価値');
    expect(container.textContent).toContain('採用される根拠');
    expect(container.textContent).toContain('この裁定で保留・軽視される争点');
    expect(container.textContent).toContain('提出根拠一致');
    expect(container.querySelector('.ruling-risk-high')).not.toBeNull();
    expect(container.querySelector('.ruling-risk-medium')).not.toBeNull();
    expect(container.textContent).toContain('都市ステータスへの影響');
    expect(container.querySelectorAll('.decision-processing')).toHaveLength(3);
    expect(container.textContent).toContain('記録整合性と治安維持を優先');
    expect(container.textContent).toContain('証拠保全と再照合を優先');
    expect(container.textContent).toContain('人格断片、または周辺の未登録反応');
    const rulingOptions = [...container.querySelectorAll<HTMLElement>('.ruling-option')];
    expect(rulingOptions).toHaveLength(case000.decisions.length);
    expect(rulingOptions[0].textContent).toContain('優先される価値記録整合性優先');
    expect(rulingOptions[0].textContent).toContain('失われる価値人格断片保護');
    expect(rulingOptions[0].textContent).toContain('提出根拠一致 0 / 2');
    expect(rulingOptions[0].textContent).toContain('この裁定案は、あなたが提出していない記録を主要根拠に含みます。');
    expect(findButton(case000.decisions[0].label)?.disabled).toBe(false);
    clickButton(case000.decisions[0].label);

    expect(container.textContent).toContain('AUDIT RULING ARCHIVED');
    expect(container.textContent).toContain('裁定記録');
    expect(container.textContent).toContain('KASUMI-GATE-09');
    expect(container.textContent).toContain('保存完了');
    expect(container.querySelector('[aria-label="裁定結果要約"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="裁定結果要約"]')?.textContent).toContain('間宮怜司を発砲責任者として拘束');
    expect(container.querySelector('[aria-label="裁定結果要約"]')?.textContent).toContain('救った価値（優先）');
    expect(container.querySelector('[aria-label="裁定結果要約"]')?.textContent).toContain('犠牲にした価値（軽視）');
    expect(container.textContent).toContain('提出された判断根拠');
    expect(container.textContent).toContain('分類された矛盾');
    expect(container.textContent).toContain('最終処理圧力：24 / 100');
    expect(container.textContent).toContain('圧力状態：LOW');
    expect(container.textContent).toContain('この裁定は、以後の未確定人格案件における参照基準として保存されます。');
    expect(container.querySelector('.ruling-stamp')).not.toBeNull();
    expect(localStorage.getItem('persona-null:case-results')).not.toBeNull();
    clickButton('事件選択へ戻る');
    expect(container.querySelector('[aria-label="監査傾向"]')?.textContent).toContain('記録整合性優先1');
  });

  it('opens related memory records from the investigation person detail modal', () => {
    enterInvestigation();

    clickButton('関係者照会');
    const rosterButton = [...(container.querySelectorAll('button') ?? [])].find((button) => button.textContent?.includes('詳細'));
    act(() => rosterButton?.click());

    const relatedLink = [...container.querySelectorAll<HTMLButtonElement>('.related-node-link')].find((button) => button.textContent?.includes('発砲'));
    expect(relatedLink).toBeDefined();
    act(() => relatedLink?.click());

    expect(container.querySelector('.audit-modal-node_detail')).not.toBeNull();
    expect(container.querySelector('.audit-modal .record-status-line')?.textContent).toContain('確認済');
  });

  it('opens person profiles only through a modal from the minimal roster', () => {
    clickButton('監査端末を起動');
    clickButton('通知を確認');
    clickButton('Case000を開く');

    const roster = container.querySelector('[aria-label="関係者一覧"]');
    expect(roster?.textContent).toContain('間宮怜司');
    expect(roster?.textContent).toContain('法的人格ステータス');
    // The roster stays minimal: no long person summary text until the modal opens.
    expect(roster?.textContent).not.toContain('北霞市の再開発区画');
    expect(container.querySelector('.audit-modal')).toBeNull();

    const detailButton = [...(roster?.querySelectorAll('button') ?? [])].find((button) => button.textContent?.includes('詳細'));
    act(() => detailButton?.click());

    const modal = container.querySelector('.audit-modal');
    expect(modal?.textContent).toContain('間宮怜司');
    expect(modal?.textContent).toContain('北霞市の再開発区画');
    expect(modal?.textContent).toContain('関係する記録');
  });

  it('shows warning panels only for critical or notice nodes, and stays free of meta text', () => {
    enterInvestigation();

    const normalNode = case000.nodes.find((node) => node.id === 'last-comm');
    const administrativeNode = case000.nodes.find((node) => node.id === 'processing-request');
    const evidenceLossNode = case000.nodes.find((node) => node.id === 'victim-medium');
    expect(normalNode).toMatchObject({ warningLevel: 'none' });
    expect(administrativeNode).toMatchObject({ warningLevel: 'none' });
    expect(evidenceLossNode).toMatchObject({ warningLevel: 'critical' });

    clickButton(`ノード：${normalNode?.title}`);
    expect(container.querySelector('.audit-modal .node-warning')).toBeNull();

    clickButton(`ノード：${administrativeNode?.title}`);
    expect(container.querySelector('.audit-modal .node-warning')).toBeNull();

    clickButton(`ノード：${evidenceLossNode?.title}`);
    expect(container.querySelector('.audit-modal .node-warning .warning-text')?.textContent).toContain(evidenceLossNode?.warning);
    const investigationText = container.querySelector('.audit-room')?.textContent ?? '';
    for (const metaTerm of ['Case001', 'MVP', 'Jam', 'プレイヤー', '予告', '本編']) {
      expect(investigationText).not.toContain(metaTerm);
    }
  });

  it('shows the audit officer memo even when the inspector note is empty, using the audit hint', () => {
    const node = case000.nodes[0];
    const originalInspectorNote = node.inspectorNote;
    node.inspectorNote = '';

    try {
      enterInvestigation();
      clickButton(`ノード：${node.title}`);

      const note = container.querySelector('.audit-modal .inspector-note');
      expect(note?.textContent).toContain('監査官メモ');
      expect(note?.textContent).toContain('公式記録上の発砲主体は明確');
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
    expect(container.querySelector('.audit-modal .node-detail-actions')?.querySelectorAll('button').length).toBe(1);
    expect(findButton('記憶由来の矛盾')).toBeUndefined();
  });

  it('distinguishes review states and tracks unread nodes on the stage', () => {
    enterInvestigation();

    expect(container.querySelector('.stage-unread')?.textContent).toContain(`未読ノード ${case000.nodes.length} / ${case000.nodes.length}`);
    expect(findButton('ノード：発砲ログ')).toBeDefined();

    clickButton('ノード：発砲ログ');
    expect(container.querySelector('.stage-unread')?.textContent).toContain(`未読ノード ${case000.nodes.length - 1} / ${case000.nodes.length}`);
    expect(container.querySelector('.audit-modal .record-status-line')?.textContent).toContain('確認済');
    expect(container.querySelector('[aria-label="判断条件"]')?.textContent).toContain('必須記録確認1/4');
  });

  it('shows executed analysis reports inside the node modal', () => {
    enterInvestigation();

    clickButton('ノード：間宮の発砲記憶');
    clickButton('ノード：義体稼働履歴');
    clickButton('欠落8秒の復元');

    expect(container.querySelector('.operation-toast')?.textContent).toContain('AUDIT RESOURCE CONSUMED');
    expect(container.querySelector('[aria-label="処理圧力"]')?.textContent).toContain('処理圧力 16/100');
    expect(container.querySelector('[aria-label="監査リソース"]')?.textContent).toContain('監査リソース 2/3');
    expect(container.querySelector('.audit-modal .analysis-summary')?.textContent).toContain('追加照合結果');
    expect(container.querySelector('.audit-modal .analysis-summary')?.textContent).toContain('欠損区間は断片のみ復元。外部命令断定ではなく境界曖昧化を示唆。');

    clickButton('ノード：発砲ログ');
    expect(container.querySelector('.audit-modal .analysis-summary')).toBeNull();
  });

  it('hides analysis actions until their record conditions are met', () => {
    enterInvestigation();
    clickButton('ノード：発砲ログ');

    expect(findButton('欠落8秒の復元')).toBeUndefined();

    clickButton('ノード：間宮の発砲記憶');
    expect(findButton('欠落8秒の復元')).toBeUndefined();
    clickButton('ノード：義体稼働履歴');
    expect(findButton('欠落8秒の復元')?.disabled).toBe(false);
    expect(findButton('認証鍵と記録装置の照合')).toBeUndefined();
  });

  const presentPinnedEvidence = (title: string) => {
    const picker = container.querySelector('.pinned-evidence-picker');
    const button = [...(picker?.querySelectorAll('button') ?? [])].find((candidate) => candidate.textContent?.includes(title));
    expect(button, `pinned evidence button containing ${title}`).toBeDefined();
    act(() => button?.click());
  };

  it('resolves the audit hearing from statement-defined contradiction records', () => {
    enterInvestigation();

    clickButton('ノード：義体稼働履歴');
    clickButton('判断根拠に追加');
    clickButton('監査尋問');

    clickButton('したがって、間宮怜司を発砲主体として処理可能です。');
    clickButton('証拠を提示');
    presentPinnedEvidence('義体稼働履歴');

    expect(container.querySelector('.hearing-status.resolved')?.textContent).toContain('記録矛盾を検出');
  });

  it('rejects hearing evidence that is not a statement contradiction record', () => {
    enterInvestigation();

    clickButton('ノード：発砲ログ');
    clickButton('判断根拠に追加');
    clickButton('監査尋問');

    clickButton('したがって、間宮怜司を発砲主体として処理可能です。');
    clickButton('証拠を提示');
    presentPinnedEvidence('発砲ログ');

    expect(container.querySelector('.hearing-status')?.textContent).toContain('この証拠では供述を崩せません');
    expect(container.querySelector('.hearing-status.resolved')).toBeNull();
  });

  it('plays Case001 through judgment and saves its result', () => {
    clickButton('監査端末を起動');
    clickButton('通知を確認');
    clickButton('Case001を開く');
    expect(container.textContent).toContain('焼却されなかった声');
    clickButton('調査を開始');

    ['焼却処理キュー', '反復発話ログ', '断片記憶', '自己保存反応'].forEach((title) => clickButton(`ノード：${title}`));
    expect(container.querySelector('[aria-label="判断条件"]')?.textContent).toContain('必須記録確認4/4');
    clickButton('ノード：反復発話ログ');
    expect(container.querySelector('.audit-modal')?.textContent).toContain('私は、見ていました');
    expect(container.querySelector('.audit-modal')?.textContent).toContain('犯人の顔ではなく');

    clickButton('ノード：断片記憶');
    expect(container.querySelector('.audit-modal')?.textContent).toContain('表情・視線・生体反応に発砲意図は記録されていない');
    expect(container.querySelector('.audit-modal .node-log-section')?.textContent).toContain('詳細ログ');

    clickButton('判断根拠に追加');
    clickButton('記憶由来の矛盾');
    expect(findButton('最終裁定へ進む')?.disabled).toBe(false);
    clickButton('最終裁定へ進む');

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
