import type { SavedCaseResult } from './types';

const STORAGE_KEY = 'persona-null:case-results';
const READ_KEY = 'persona-null:read-flags';

export function loadCaseResults(): SavedCaseResult[] {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (!existing) return [];
    const value = JSON.parse(existing) as unknown;
    return Array.isArray(value) ? (value as SavedCaseResult[]) : [];
  } catch (error) {
    console.error(`Failed to load ${STORAGE_KEY}.`, error);
    return [];
  }
}

export function saveCaseResult(result: SavedCaseResult) {
  try {
    const parsed = loadCaseResults();
    const next = [...parsed.filter((item) => item.caseId !== result.caseId), result];
    const serialized = JSON.stringify(next);
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error(`Failed to save ${STORAGE_KEY}.`, error);
  }
}

export function loadReadFlags(): string[] {
  try {
    const existing = window.localStorage.getItem(READ_KEY);
    if (!existing) return [];
    const value = JSON.parse(existing) as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch (error) {
    console.error(`Failed to load ${READ_KEY}.`, error);
    return [];
  }
}

export function markRead(flag: string) {
  try {
    const next = Array.from(new Set([...loadReadFlags(), flag]));
    window.localStorage.setItem(READ_KEY, JSON.stringify(next));
  } catch (error) {
    console.error(`Failed to save ${READ_KEY}.`, error);
  }
}
