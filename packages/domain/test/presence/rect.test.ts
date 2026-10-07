import { describe, expect, it } from 'vitest';

import { Rect } from '../../src/presence/rect.js';
import { rect } from './fixtures.js';

describe('Rect', () => {
  it.each([
    [{ x: 0, y: 0, width: 0, height: 10 }],
    [{ x: 0, y: 0, width: 10, height: -1 }],
    [{ x: Number.NaN, y: 0, width: 10, height: 10 }],
    [{ x: 0, y: Number.POSITIVE_INFINITY, width: 10, height: 10 }],
  ])('rejects %j', (props) => {
    expect(Rect.create(props)).toEqual({ ok: false, error: { kind: 'invalid-rect', props } });
  });

  it('exposes its edges and center', () => {
    const r = rect(-100, 50, 200, 100);

    expect([r.right, r.bottom]).toEqual([100, 150]);
    expect(r.center).toEqual({ x: 0, y: 100 });
  });

  it('contains points from its top-left edge up to, but excluding, its bottom-right edge', () => {
    const r = rect(0, 0, 100, 100);

    expect(r.contains({ x: 0, y: 0 })).toBe(true);
    expect(r.contains({ x: 99.9, y: 99.9 })).toBe(true);
    expect(r.contains({ x: 100, y: 50 })).toBe(false);
    expect(r.contains({ x: 50, y: -1 })).toBe(false);
  });

  it('measures the area shared with another rect', () => {
    const r = rect(0, 0, 100, 100);

    expect(r.intersectionArea(rect(50, 50, 100, 100))).toBe(2500);
    expect(r.intersectionArea(rect(100, 0, 10, 10))).toBe(0);
    expect(r.intersectionArea(rect(500, 500, 10, 10))).toBe(0);
  });

  it('measures the distance from a point to its nearest edge', () => {
    const r = rect(0, 0, 100, 100);

    expect(r.distanceTo({ x: 50, y: 50 })).toBe(0);
    expect(r.distanceTo({ x: 130, y: 50 })).toBe(30);
    expect(r.distanceTo({ x: -30, y: -40 })).toBe(50);
  });

  it('moves while keeping its size', () => {
    expect(rect(0, 0, 100, 50).movedTo({ x: -10, y: 20 })).toEqual(rect(-10, 20, 100, 50));
  });

  it('is clamped inside a container, moving as little as possible', () => {
    const container = rect(0, 0, 1000, 800);

    expect(rect(950, -30, 100, 100).clampedInside(container)).toEqual(rect(900, 0, 100, 100));
    expect(rect(-50, 750, 100, 100).clampedInside(container)).toEqual(rect(0, 700, 100, 100));
    expect(rect(10, 10, 100, 100).clampedInside(container)).toEqual(rect(10, 10, 100, 100));
  });

  it('is centered on an axis where it is larger than the container', () => {
    expect(rect(0, 0, 400, 100).clampedInside(rect(0, 0, 300, 300))).toEqual(
      rect(-50, 0, 400, 100),
    );
  });
});
