import type { AuditPressureEvent, AuditPressureLevel, AuditPressureState } from './types';

export const AUDIT_PRESSURE_MAX = 100;

export function getAuditPressureLevel(value: number): AuditPressureLevel {
  if (value >= 80) return 'critical';
  if (value >= 60) return 'high';
  if (value >= 30) return 'medium';
  return 'low';
}

export function createAuditPressureEvent(params: Omit<AuditPressureEvent, 'id'> & { id?: string }): AuditPressureEvent {
  return {
    ...params,
    id: params.id ?? `${params.source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

export function applyAuditPressureEvent(state: AuditPressureState, event: AuditPressureEvent): AuditPressureState {
  const value = Math.max(0, Math.min(state.max, state.value + event.delta));
  return {
    ...state,
    value,
    level: getAuditPressureLevel(value),
    events: [...state.events, event],
  };
}
