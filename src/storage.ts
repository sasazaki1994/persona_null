import type { SavedCaseResult } from './types';

const STORAGE_KEY = 'persona-null:case-results';

export function saveCaseResult(result: SavedCaseResult) {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    let parsed: SavedCaseResult[] = [];

    if (existing) {
      try {
        const value = JSON.parse(existing) as unknown;
        parsed = Array.isArray(value) ? (value as SavedCaseResult[]) : [];
      } catch (error) {
        console.error(`Failed to parse ${STORAGE_KEY}; replacing stored results.`, error);
      }
    }

    const next = [...parsed.filter((item) => item.caseId !== result.caseId), result];
    const serialized = JSON.stringify(next);
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error(`Failed to save ${STORAGE_KEY}.`, error);
  }
}
