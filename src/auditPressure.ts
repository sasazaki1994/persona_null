import type { AuditPressureEvent, AuditPressureLevel, AuditPressureState } from './types';

export const AUDIT_PRESSURE_MAX = 100;

export const auditPressureLevelLabels: Record<AuditPressureLevel, string> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
};

export const auditPressureMessages: Record<AuditPressureLevel, string> = {
  low: '処理圧力：低。追加監査は許容範囲内です。',
  medium: '処理圧力：中。都市警備局から裁定予定時刻の再照会あり。',
  high: '処理圧力：高。処理遅延により、行政裁定圧力が上昇しています。',
  critical: '処理圧力：臨界。未確定人格記録の自動処理要求が発生しています。',
};

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
