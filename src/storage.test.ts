import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCaseResults, loadReadFlags, markRead, saveCaseResult } from './storage';
import type { SavedCaseResult } from './types';

const validResult: SavedCaseResult = {
  caseId: 'case000',
  decisionId: 'freeze-evidence',
  pinnedNodeIds: ['shot-log'],
  taggedNodes: { 'shot-log': ['persona_signature'] },
  executedActionIds: ['resignature'],
  finalStats: { security: 59, ethics: 56, surveillance: 73, egoStability: 45 },
  completedAt: '2026-06-05T00:00:00.000Z',
};

function installLocalStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const localStorage = {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      data.delete(key);
    }),
  };

  vi.stubGlobal('window', { localStorage });
  return { localStorage, data };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('case result storage', () => {
  it('filters invalid saved result entries when loading', () => {
    installLocalStorage({
      'persona-null:case-results': JSON.stringify([
        validResult,
        null,
        {},
        { caseId: 'case001' },
        { ...validResult, finalStats: { security: 'bad' } },
      ]),
    });

    expect(loadCaseResults()).toEqual([validResult]);
  });

  it('ignores malformed saved result JSON without throwing', () => {
    const { localStorage, data } = installLocalStorage({
      'persona-null:case-results': '{not-json',
    });

    expect(loadCaseResults()).toEqual([]);
    expect(localStorage.removeItem).toHaveBeenCalledWith('persona-null:case-results');
    expect(data.has('persona-null:case-results')).toBe(false);
  });

  it('returns whether saving succeeded and survives malformed existing data', () => {
    const { localStorage, data } = installLocalStorage({
      'persona-null:case-results': '{not-json',
    });
    expect(saveCaseResult(validResult)).toBe(true);
    expect(JSON.parse(data.get('persona-null:case-results') ?? '[]')).toEqual([validResult]);

    localStorage.setItem.mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });
    expect(saveCaseResult(validResult)).toBe(false);
  });
});

describe('read flag storage', () => {
  it('loads only string read flags and ignores malformed payloads', () => {
    installLocalStorage({
      'persona-null:read-flags': JSON.stringify(['city-os-briefing', 42, null, 'case000-overview']),
    });

    expect(loadReadFlags()).toEqual(['city-os-briefing', 'case000-overview']);

    installLocalStorage({
      'persona-null:read-flags': '{bad-json',
    });
    expect(loadReadFlags()).toEqual([]);
  });

  it('marks the city OS briefing read flag and does not throw when saving fails', () => {
    const { localStorage, data } = installLocalStorage();
    markRead('city-os-briefing');
    markRead('city-os-briefing');

    expect(JSON.parse(data.get('persona-null:read-flags') ?? '[]')).toEqual(['city-os-briefing']);

    localStorage.setItem.mockImplementationOnce(() => {
      throw new Error('read flag quota exceeded');
    });
    expect(() => markRead('case000-overview')).not.toThrow();
  });
});
