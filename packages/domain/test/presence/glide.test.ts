import { describe, expect, it } from 'vitest';

import { Glide } from '../../src/presence/glide.js';
import type { Point } from '../../src/presence/rect.js';
import { scenarios } from '../../testing/index.js';

const SIZE = { width: 300, height: 400 };
const center = (p: Point): Point => ({ x: p.x + SIZE.width / 2, y: p.y + SIZE.height / 2 });
const speed = ({ x, y }: Point): number => Math.hypot(x, y);
const samples = (glide: Glide, count = 400): Point[] =>
  Array.from({ length: count + 1 }, (_, i) => glide.positionAt((glide.duration * i) / count));

describe('Glide', () => {
  const layout = scenarios.reference();
  /** Janela do Kobi no meio do monitor da esquerda (DVI-I-2: x 0–1920, y 120–1200). */
  const onLeftMonitor = { x: 800, y: 460 };

  it('stays put when released without speed', () => {
    const glide = Glide.launch(onLeftMonitor, { x: 3, y: 0 }, SIZE, layout);

    expect(glide.duration).toBe(0);
    expect(glide.positionAt(1)).toEqual(onLeftMonitor);
  });

  it('keeps moving in the throw direction, slowing down smoothly until it stops', () => {
    const glide = Glide.launch(onLeftMonitor, { x: 900, y: -300 }, SIZE, layout);
    const speeds = Array.from({ length: 50 }, (_, i) =>
      speed(glide.velocityAt((glide.duration * i) / 50)),
    );

    expect(glide.positionAt(glide.duration).x).toBeGreaterThan(onLeftMonitor.x);
    expect(glide.positionAt(glide.duration).y).toBeLessThan(onLeftMonitor.y);
    expect(speeds.every((s, i) => i === 0 || s <= (speeds[i - 1] ?? 0))).toBe(true);
    expect(speed(glide.velocityAt(glide.duration))).toBe(0);
  });

  it('travels a distance proportional to the release speed (air resistance)', () => {
    const travelled = (vx: number): number =>
      Glide.launch({ x: 2000, y: 500 }, { x: vx, y: 0 }, SIZE, layout).positionAt(60).x - 2000;

    expect(travelled(600) / travelled(300)).toBeCloseTo(2, 1);
    expect(travelled(300)).toBeCloseTo(300 / Glide.defaults.airResistance, -1);
  });

  it('caps the release speed so an accidental jerk does not fling the Kobi away', () => {
    const wild = Glide.launch(onLeftMonitor, { x: 1e6, y: 0 }, SIZE, layout);

    expect(speed(wild.velocityAt(0))).toBeCloseTo(Glide.defaults.maxLaunchSpeed, 6);
  });

  it('can be thrown from the leftmost monitor all the way to the rightmost one', () => {
    const fromLeftEdge = { x: 100, y: 500 };
    const glide = Glide.launch(fromLeftEdge, { x: 4500, y: 0 }, SIZE, layout);

    expect(layout.displayAt(center(glide.positionAt(glide.duration)))?.id).toBe('HDMI-1');
    expect(glide.duration).toBeGreaterThan(3.5);
    expect(glide.duration).toBeLessThan(6);
  });

  it('bounces gently off the outer edge, losing most of its energy', () => {
    const glide = Glide.launch({ x: 300, y: 500 }, { x: -2500, y: 0 }, SIZE, layout);
    const vx = Array.from(
      { length: 200 },
      (_, i) => glide.velocityAt((glide.duration * i) / 200).x,
    );
    const reboundSpeed = Math.max(...vx);

    expect(Math.min(...vx)).toBeLessThan(0);
    expect(reboundSpeed).toBeGreaterThan(0);
    expect(reboundSpeed).toBeLessThan(2500 * Glide.defaults.restitution);
  });

  it.each([
    ['up into the void above the side monitor', { x: 300, y: 300 }, { x: 0, y: -3000 }],
    ['down past the bottom', { x: 2500, y: 600 }, { x: 500, y: 3000 }],
    ['diagonally out of the corner', { x: 4800, y: 300 }, { x: 3000, y: -3000 }],
  ])('never leaves the usable area when thrown %s', (_, start, velocity) => {
    const glide = Glide.launch(start, velocity, SIZE, layout);

    for (const p of samples(glide)) expect(layout.inWorkArea(center(p))).toBe(true);
  });

  it('cannot cross a gap between monitors, bouncing back instead', () => {
    const gap = scenarios.gap();
    const glide = Glide.launch({ x: 1400, y: 300 }, { x: 3000, y: 0 }, SIZE, gap);

    for (const p of samples(glide)) expect(gap.inWorkArea(center(p))).toBe(true);
  });

  it('holds its final position after stopping', () => {
    const glide = Glide.launch(onLeftMonitor, { x: 800, y: 0 }, SIZE, layout);

    expect(glide.positionAt(glide.duration + 10)).toEqual(glide.positionAt(glide.duration));
    expect(speed(glide.velocityAt(glide.duration + 10))).toBe(0);
  });
});
