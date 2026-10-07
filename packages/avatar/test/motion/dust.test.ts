import { describe, expect, it } from 'vitest';

import { Dust } from '../../src/motion/dust.js';

const WORLD_PER_PIXEL = 0.02;
const HALF = { width: 3, height: 4 };

/** Velocidade (px/s) de um voo de jerk mínimo para a direita. */
const flightSpeed = (distance: number, duration: number, t: number): number => {
  if (t <= 0 || t >= duration) return 0;
  const u = t / duration;
  return (30 * u ** 2 * (1 - u) ** 2 * distance) / duration;
};

const run = (
  dust: Dust,
  distance: number,
  duration: number,
  from: number,
  to: number,
  hz = 60,
  onFrame?: (t: number) => void,
): void => {
  for (let frame = Math.round(from * hz) + 1; frame <= Math.round(to * hz); frame++) {
    const t = frame / hz;
    dust.update({ x: flightSpeed(distance, duration, t), y: 0 }, 1 / hz, WORLD_PER_PIXEL, HALF);
    onFrame?.(t);
  }
};

const sequence = (values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0.5;
};

describe('Dust', () => {
  it('stays clean on calm flights', () => {
    const dust = new Dust(sequence([0.5]));
    let most = 0;
    run(dust, 500, 2.2, 0, 2.5, 60, () => (most = Math.max(most, dust.puffs.length)));

    expect(most).toBe(0);
  });

  it('kicks dust backwards when a fast flight launches', () => {
    const dust = new Dust(sequence([0.5]));
    run(dust, 2400, 2.2, 0, 0.6);

    expect(dust.puffs.length).toBeGreaterThan(0);
    expect(dust.puffs.every((p) => p.vx < 0)).toBe(true);
  });

  it('throws dust forwards when a fast flight brakes', () => {
    const dust = new Dust(sequence([0.5]));
    run(dust, 2400, 2.2, 0, 1.75);
    run(dust, 2400, 2.2, 1.75, 2.1);
    const braking = dust.puffs.filter((p) => p.age < 0.35);

    expect(braking.length).toBeGreaterThan(0);
    expect(braking.every((p) => p.vx > 0)).toBe(true);
  });

  it('is delicate: few puffs, faint, and gone a moment after the Kobi stops', () => {
    const dust = new Dust(sequence([0.5]));
    let most = 0;
    let faintest = 1;
    run(dust, 2400, 2.2, 0, 2.2, 60, () => {
      most = Math.max(most, dust.puffs.length);
      for (const p of dust.puffs) faintest = Math.min(faintest, 1 - p.opacity);
    });
    run(dust, 0, 1, 2.2, 4);

    expect(most).toBeLessThanOrEqual(Dust.capacity);
    expect(faintest).toBeGreaterThanOrEqual(1 - Dust.maxOpacity);
    expect(dust.puffs).toHaveLength(0);
  });

  it('stays where it was raised on screen while the Kobi flies away', () => {
    const dust = new Dust(sequence([0.5]));
    run(dust, 2400, 2.2, 0, 0.5);
    const puff = dust.puffs[0];
    if (!puff) throw new Error('expected a puff');
    const before = puff.x;
    const own = puff.vx * (1 / 60);
    dust.update({ x: 600, y: 0 }, 1 / 60, WORLD_PER_PIXEL, HALF);

    expect(puff.x).toBeLessThan(before + own);
    expect(before + own - puff.x).toBeCloseTo(600 * (1 / 60) * WORLD_PER_PIXEL, 2);
  });

  it('fades out before reaching the edge of the Kobi window', () => {
    const dust = new Dust(sequence([0.5]));
    run(dust, 2400, 2.2, 0, 0.5);
    const puff = dust.puffs[0];
    if (!puff) throw new Error('expected a puff');
    puff.x = -HALF.width;
    dust.update({ x: 0, y: 0 }, 1 / 60, WORLD_PER_PIXEL, HALF);

    expect(puff.opacity).toBe(0);
  });

  it.each([100, 144])('raises about as much dust at %i Hz as at 60 Hz', (hz) => {
    const count = (rate: number): number => {
      const dust = new Dust(sequence([0.5]));
      let raised = 0;
      run(dust, 2400, 2.2, 0, 2.2, rate, () => {
        raised += dust.puffs.filter((p) => p.age === 0).length;
      });
      return raised;
    };

    expect(Math.abs(count(hz) - count(60))).toBeLessThanOrEqual(2);
  });

  it('raises no dust when the user prefers reduced motion', () => {
    const dust = new Dust(sequence([0.5]), true);
    run(dust, 2400, 2.2, 0, 2.2);

    expect(dust.puffs).toHaveLength(0);
  });
});
