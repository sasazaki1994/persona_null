import type { SavedCaseResult } from './types';

const STORAGE_KEY = 'persona-null:case-results';

export function saveCaseResult(result: SavedCaseResult) {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  const parsed = existing ? (JSON.parse(existing) as SavedCaseResult[]) : [];
  const next = [...parsed.filter((item) => item.caseId !== result.caseId), result];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
