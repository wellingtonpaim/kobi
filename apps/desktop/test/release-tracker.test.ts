import { describe, expect, it } from 'vitest';

import { ReleaseTracker } from '../src/main/release-tracker.js';

/** Arrasta em linha reta, a uma velocidade (px/s), registrando uma amostra a cada `everyMs`. */
const drag = (
  tracker: ReleaseTracker,
  from: number,
  to: number,
  pxPerSecond: number,
  everyMs = 8,
): void => {
  for (let t = from; t <= to; t += everyMs) tracker.add({ x: (pxPerSecond * t) / 1000, y: 0 }, t);
};

describe('ReleaseTracker', () => {
  it('measures the speed of the mouse just before release', () => {
    const tracker = new ReleaseTracker();
    drag(tracker, 0, 400, 2000);

    expect(tracker.velocityAt(400).x).toBeCloseTo(2000, 6);
  });

  it('only looks at the last moments, not the whole drag', () => {
    const tracker = new ReleaseTracker();
    drag(tracker, 0, 300, 200);
    for (let t = 308; t <= 400; t += 8) tracker.add({ x: 60 + (3000 * (t - 300)) / 1000, y: 0 }, t);

    expect(tracker.velocityAt(400).x).toBeGreaterThan(2500);
  });

  it('does not throw when the mouse stopped before release', () => {
    const tracker = new ReleaseTracker();
    drag(tracker, 0, 300, 2000);

    expect(tracker.velocityAt(420)).toEqual({ x: 0, y: 0 });
  });

  it('does not throw after a simple click', () => {
    const tracker = new ReleaseTracker();
    tracker.add({ x: 10, y: 10 }, 0);

    expect(tracker.velocityAt(5)).toEqual({ x: 0, y: 0 });
  });

  it('forgets the previous drag', () => {
    const tracker = new ReleaseTracker();
    drag(tracker, 0, 100, 2000);
    tracker.reset();

    expect(tracker.velocityAt(100)).toEqual({ x: 0, y: 0 });
  });
});
