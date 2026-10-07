import { describe, expect, it } from 'vitest';

import { blendTurn, Pendulum, travelHeading } from '../../src/motion/travel.js';

describe('travelHeading', () => {
  it.each([
    ['right', { x: 600, y: 0 }, Math.PI / 2],
    ['left', { x: -600, y: 0 }, -Math.PI / 2],
    ['up', { x: 0, y: -600 }, 0],
    ['down', { x: 0, y: 600 }, 0],
    ['diagonally right and down', { x: 400, y: 400 }, (Math.PI / 2) * Math.SQRT1_2],
  ])('faces %s', (_, velocity, yaw) => {
    expect(travelHeading(velocity).yaw).toBeCloseTo(yaw, 10);
  });

  it('lets the travel heading take over at cruising speed', () => {
    expect(travelHeading({ x: 600, y: 0 }).weight).toBe(1);
  });

  it('eases between the rest pose and the heading at low speed', () => {
    const { weight } = travelHeading({ x: 30, y: 0 });

    expect(weight).toBeGreaterThan(0);
    expect(weight).toBeLessThan(1);
  });

  it('gives no heading when still', () => {
    expect(travelHeading({ x: 0, y: 0 })).toEqual({ yaw: 0, weight: 0 });
  });
});

describe('blendTurn', () => {
  it('keeps the rest pose when not traveling', () => {
    expect(blendTurn(-0.5, Math.PI / 2, 0)).toBe(-0.5);
  });

  it('turns fully to the heading at cruising speed', () => {
    expect(blendTurn(-0.5, Math.PI / 2, 1)).toBeCloseTo(Math.PI / 2, 10);
  });

  it('takes the short way round, never spinning after the user turned the Kobi many times', () => {
    const rest = 4 * Math.PI + 0.1;

    expect(blendTurn(rest, Math.PI / 2, 1)).toBeCloseTo(4 * Math.PI + Math.PI / 2, 10);
    expect(blendTurn(rest, -Math.PI / 2, 1)).toBeCloseTo(4 * Math.PI - Math.PI / 2, 10);
  });
});

/** Velocidade horizontal de um voo de jerk mínimo de 1200 px em 3,2 s, seguido de repouso. */
const flightSpeed = (t: number): number => {
  const duration = 3.2;
  if (t <= 0 || t >= duration) return 0;
  const u = t / duration;
  return (30 * u ** 2 * (1 - u) ** 2 * 1200) / duration;
};

const simulate = (hz: number, until: number, reducedMotion = false): number[] => {
  const pendulum = new Pendulum(reducedMotion);
  const leans: number[] = [];
  for (let frame = 1; frame <= Math.round(until * hz); frame++) {
    leans.push(pendulum.update(flightSpeed(frame / hz), 1 / hz));
  }
  return leans;
};

const leanAt = (hz: number, t: number): number => simulate(hz, t).at(-1) ?? 0;

describe('Pendulum', () => {
  it('stays upright when still', () => {
    expect(new Pendulum().update(0, 1 / 60)).toBe(0);
  });

  it('leans the head forward while speeding up', () => {
    expect(leanAt(60, 0.9)).toBeGreaterThan(0.05);
  });

  it('throws the head back while braking', () => {
    expect(leanAt(60, 2.7)).toBeLessThan(-0.05);
  });

  it('swings past upright after stopping, then settles', () => {
    const afterStop = simulate(60, 6).slice(Math.round(3.2 * 60));

    expect(Math.max(...afterStop)).toBeGreaterThan(0.005);
    expect(Math.abs(afterStop.at(-1) ?? 1)).toBeLessThan(0.002);
  });

  it('never leans beyond its limit', () => {
    const leans = simulate(60, 6);

    expect(Math.max(...leans.map(Math.abs))).toBeLessThanOrEqual(Pendulum.maxLean);
  });

  it.each([100, 144])('looks the same at %i Hz as at 60 Hz', (hz) => {
    for (const t of [0.9, 2.7, 4]) expect(leanAt(hz, t)).toBeCloseTo(leanAt(60, t), 2);
  });

  it('does not swing when the user prefers reduced motion', () => {
    expect(simulate(60, 6, true).every((lean) => lean === 0)).toBe(true);
  });
});
