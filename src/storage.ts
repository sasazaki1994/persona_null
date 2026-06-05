import type { SavedCaseResult } from './types';

const STORAGE_KEY = 'persona-null:case-results';
const READ_KEY = 'persona-null:read-flags';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isCityStats(value: unknown): value is SavedCaseResult['finalStats'] {
  if (!isRecord(value)) return false;
  return ['security', 'ethics', 'surveillance', 'egoStability'].every((key) => typeof value[key] === 'number');
}

function isTaggedNodes(value: unknown): value is SavedCaseResult['taggedNodes'] {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isStringArray);
}

function isSavedCaseResult(value: unknown): value is SavedCaseResult {
  if (!isRecord(value)) return false;
  return typeof value.caseId === 'string'
    && typeof value.decisionId === 'string'
    && isStringArray(value.pinnedNodeIds)
    && isTaggedNodes(value.taggedNodes)
    && isStringArray(value.executedActionIds)
    && isCityStats(value.finalStats)
    && typeof value.completedAt === 'string';
}

export function loadCaseResults(): SavedCaseResult[] {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (!existing) return [];
    const value = JSON.parse(existing) as unknown;
    if (!Array.isArray(value)) {
      console.error(`Invalid ${STORAGE_KEY}: expected an array.`);
      return [];
    }
    const validResults = value.filter(isSavedCaseResult);
    if (validResults.length !== value.length) {
      console.error(`Invalid ${STORAGE_KEY}: ignored ${value.length - validResults.length} malformed result entries.`);
    }
    return validResults;
  } catch (error) {
    console.error(`Failed to load ${STORAGE_KEY}.`, error);
    return [];
  }
}

export function saveCaseResult(result: SavedCaseResult): boolean {
  try {
    const parsed = loadCaseResults();
    const next = [...parsed.filter((item) => item.caseId !== result.caseId), result];
    const serialized = JSON.stringify(next);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (error) {
    console.error(`Failed to save ${STORAGE_KEY}.`, error);
    return false;
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
