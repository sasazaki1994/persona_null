import { describe, expect, it } from 'vitest';
import { applyAuditPressureEvent, auditPressureLevelLabels, auditPressureMessages, createAuditPressureEvent, getAuditPressureLevel } from './auditPressure';
import type { AuditPressureLevel } from './types';
import type { AuditPressureState } from './types';

describe('audit pressure rules', () => {
  it('maps every pressure threshold to its level', () => {
    expect([0, 29, 30, 59, 60, 79, 80, 100].map(getAuditPressureLevel)).toEqual([
      'low', 'low', 'medium', 'medium', 'high', 'high', 'critical', 'critical',
    ]);
  });

  it('provides a label and player-facing message for every pressure level', () => {
    (['low', 'medium', 'high', 'critical'] as AuditPressureLevel[]).forEach((level) => {
      expect(auditPressureLevelLabels[level].length).toBeGreaterThan(0);
      expect(auditPressureMessages[level]).toContain('処理圧力');
    });
  });

  it('applies events, retains history, and clamps the value at 100', () => {
    const state: AuditPressureState = { value: 96, max: 100, level: 'critical', events: [] };
    const event = createAuditPressureEvent({
      id: 'analysis-1',
      source: 'analysis',
      label: '追加解析',
      delta: 8,
      message: 'pressure increased',
    });

    expect(applyAuditPressureEvent(state, event)).toEqual({
      value: 100,
      max: 100,
      level: 'critical',
      events: [event],
    });
  });
});
