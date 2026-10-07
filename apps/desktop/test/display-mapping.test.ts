import { describe, expect, it } from 'vitest';

import { type SystemDisplay, toDisplayLayout } from '../src/main/display-mapping.js';

const system = (id: number, x: number, frequency = 60): SystemDisplay => ({
  id,
  bounds: { x, y: 0, width: 1920, height: 1080 },
  workArea: { x, y: 32, width: 1920, height: 1048 },
  scaleFactor: 1,
  displayFrequency: frequency,
});

describe('toDisplayLayout', () => {
  it('translates the system monitors and marks the primary one', () => {
    const result = toDisplayLayout([system(7, 0), system(9, 1920, 100)], 9);

    expect(result.ok && result.value.primary.id).toBe('9');
    expect(result.ok && result.value.displays.map((d) => d.refreshRateHz)).toEqual([60, 100]);
  });

  it('assumes 60 Hz when the system does not report the refresh rate', () => {
    const result = toDisplayLayout([system(1, 0, 0)], 1);

    expect(result.ok && result.value.primary.refreshRateHz).toBe(60);
  });

  it('reports a monitor with an impossible size instead of crashing', () => {
    const broken = { ...system(1, 0), bounds: { x: 0, y: 0, width: 0, height: 0 } };

    expect(toDisplayLayout([broken], 1)).toEqual({ ok: false, error: { kind: 'invalid-rect' } });
  });

  it('reports a layout without the primary monitor', () => {
    expect(toDisplayLayout([system(1, 0)], 2)).toMatchObject({
      ok: false,
      error: { kind: 'primary-display-count' },
    });
  });
});
