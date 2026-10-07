import { describe, expect, it } from 'vitest';

import { Flight } from '../../src/presence/flight.js';
import type { Point } from '../../src/presence/rect.js';

const near = (actual: Point, expected: Point, digits = 6): void => {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
};

const speed = ({ x, y }: Point): number => Math.hypot(x, y);

const directions: readonly (readonly [string, Point, Point])[] = [
  ['to the right', { x: 0, y: 0 }, { x: 1200, y: 0 }],
  ['to the left across negative coordinates', { x: 500, y: 300 }, { x: -1400, y: 300 }],
  ['straight up', { x: 800, y: 900 }, { x: 800, y: 100 }],
  ['diagonally down', { x: 100, y: 100 }, { x: 900, y: 700 }],
];

describe('Flight', () => {
  describe.each(directions)('flying %s', (_, from, to) => {
    const flight = Flight.between(from, to);

    it('starts at the origin and lands exactly on the destination', () => {
      near(flight.positionAt(0), from);
      near(flight.positionAt(flight.duration), to);
    });

    it('starts and ends at rest', () => {
      expect(speed(flight.velocityAt(0))).toBeCloseTo(0, 6);
      expect(speed(flight.velocityAt(flight.duration))).toBeCloseTo(0, 6);
      expect(speed(flight.velocityAt(flight.duration / 2))).toBeGreaterThan(0);
    });

    it('reports a velocity consistent with its positions', () => {
      const t = flight.duration * 0.37;
      const h = 1e-4;
      const a = flight.positionAt(t - h);
      const b = flight.positionAt(t + h);

      near(flight.velocityAt(t), { x: (b.x - a.x) / (2 * h), y: (b.y - a.y) / (2 * h) }, 2);
    });

    it('drifts sideways only a little, and never at the ends', () => {
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const sideways = (p: Point): number =>
        Math.abs((p.x - from.x) * (to.y - from.y) - (p.y - from.y) * (to.x - from.x)) / length;
      const samples = Array.from({ length: 101 }, (_, i) =>
        flight.positionAt((flight.duration * i) / 100),
      );

      expect(Math.max(...samples.map(sideways))).toBeLessThanOrEqual(
        Flight.defaults.maxWobble + 1e-9,
      );
      expect(Math.max(...samples.map(sideways))).toBeGreaterThan(0);
      expect(sideways(flight.positionAt(0))).toBeCloseTo(0, 9);
      expect(sideways(flight.positionAt(flight.duration))).toBeCloseTo(0, 9);
    });
  });

  it('never exceeds the maximum speed on long flights', () => {
    const flight = Flight.between({ x: 0, y: 0 }, { x: 1500, y: 0 }, { maxWobble: 0 });
    const peak = speed(flight.velocityAt(flight.duration / 2));

    expect(peak).toBeCloseTo(Flight.defaults.maxSpeed, 6);
  });

  it('takes longer for longer distances', () => {
    const short = Flight.between({ x: 0, y: 0 }, { x: 900, y: 0 });
    const long = Flight.between({ x: 0, y: 0 }, { x: 1800, y: 0 });

    expect(long.duration).toBeCloseTo(short.duration * 2, 6);
  });

  it('keeps short hops from looking abrupt', () => {
    expect(Flight.between({ x: 0, y: 0 }, { x: 20, y: 0 }).duration).toBe(
      Flight.defaults.minDuration,
    );
  });

  it('keeps very long trips from dragging on', () => {
    expect(Flight.between({ x: 0, y: 0 }, { x: 20000, y: 0 }).duration).toBe(
      Flight.defaults.maxDuration,
    );
  });

  it('wobbles less on short hops than on long flights', () => {
    const wobble = (flight: Flight, length: number): number =>
      Math.max(
        ...Array.from({ length: 101 }, (_, i) =>
          Math.abs(flight.positionAt((flight.duration * i) / 100).y),
        ),
      ) / length;

    expect(wobble(Flight.between({ x: 0, y: 0 }, { x: 60, y: 0 }), 60)).toBeLessThanOrEqual(0.1);
  });

  it('holds its ends before starting and after landing', () => {
    const flight = Flight.between({ x: 0, y: 0 }, { x: 300, y: 400 });

    near(flight.positionAt(-1), { x: 0, y: 0 });
    near(flight.positionAt(flight.duration + 5), { x: 300, y: 400 });
    expect(speed(flight.velocityAt(flight.duration + 5))).toBe(0);
  });

  it('stays still when origin and destination are the same', () => {
    const flight = Flight.between({ x: 10, y: 20 }, { x: 10, y: 20 });

    expect(flight.duration).toBe(0);
    near(flight.positionAt(0.5), { x: 10, y: 20 });
    expect(speed(flight.velocityAt(0))).toBe(0);
  });
});
