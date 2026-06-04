import { describe, expect, it } from 'vitest';
import { case000 } from './case000';

describe('case000 data', () => {
  it('contains the required playable MVP nodes', () => {
    expect(case000.nodes).toHaveLength(6);
    expect(case000.requiredNodesToJudge).toBeLessThanOrEqual(case000.nodes.length);
    expect(case000.nodes.every((node) => node.title && node.log && node.simpleFact && node.inspectorNote && node.warning)).toBe(true);
  });

  it('provides three final decisions and three analysis actions', () => {
    expect(case000.decisions).toHaveLength(3);
    expect(case000.analysisActions).toHaveLength(3);
  });
});
