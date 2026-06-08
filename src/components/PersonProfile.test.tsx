// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { case000 } from '../case000';
import { PersonProfile } from './PersonProfile';

describe('PersonProfile image fallback behavior', () => {
  it('replaces Mamiya Reiji missing image with his audit-terminal fallback', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => root.render(<PersonProfile person={case000.personLogs[0]} />));
    const image = container.querySelector('img');
    expect(image?.getAttribute('alt')).toBe('間宮怜司 監査記録ポートレート');

    act(() => image?.dispatchEvent(new Event('error', { bubbles: true })));

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('人物照合記録');
    expect(container.textContent).toContain('義体分類：警備用部分義体');
    expect(container.textContent).toContain('操作主体：未確定');

    act(() => root.unmount());
  });

  it('replaces Nanase Miori missing image with her damaged-medium fallback', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => root.render(<PersonProfile person={case000.personLogs[1]} />));
    act(() => container.querySelector('img')?.dispatchEvent(new Event('error', { bubbles: true })));

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('人格断片記録');
    expect(container.textContent).toContain('証言能力：制限');
    expect(container.textContent).toContain('媒体状態：破損');

    act(() => root.unmount());
  });
});
