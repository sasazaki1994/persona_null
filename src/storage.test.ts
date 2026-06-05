import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCaseResults, saveCaseResult } from './storage';
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
  };

  vi.stubGlobal('window', { localStorage });
  return localStorage;
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

  it('returns whether saving succeeded', () => {
    const localStorage = installLocalStorage();
    expect(saveCaseResult(validResult)).toBe(true);

    localStorage.setItem.mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });
    expect(saveCaseResult(validResult)).toBe(false);
  });
});
