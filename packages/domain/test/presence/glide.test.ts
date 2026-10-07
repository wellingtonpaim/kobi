import { describe, expect, it } from 'vitest';

import { Glide } from '../../src/presence/glide.js';
import type { Point } from '../../src/presence/rect.js';
import { rect, scenarios } from '../../testing/index.js';

/** Silhueta visível do Kobi dentro da janela de 300×400 (sem margens transparentes nem sombra). */
const BODY = { x: 80, y: 40, width: 140, height: 300 };
const center = (p: Point): Point => ({ x: p.x + 150, y: p.y + 200 });
const bodyAt = (p: Point) => rect(p.x + BODY.x, p.y + BODY.y, BODY.width, BODY.height);
const speed = ({ x, y }: Point): number => Math.hypot(x, y);
const samples = (glide: Glide, count = 400): Point[] =>
  Array.from({ length: count + 1 }, (_, i) => glide.positionAt((glide.duration * i) / count));

describe('Glide', () => {
  const layout = scenarios.reference();
  /** Janela do Kobi no meio do monitor da esquerda (DVI-I-2: x 0–1920, y 120–1200). */
  const onLeftMonitor = { x: 800, y: 460 };

  it('stays put when released without speed', () => {
    const glide = Glide.launch(onLeftMonitor, { x: 3, y: 0 }, BODY, layout);

    expect(glide.duration).toBe(0);
    expect(glide.positionAt(1)).toEqual(onLeftMonitor);
  });

  it('keeps moving in the throw direction, slowing down smoothly until it stops', () => {
    const glide = Glide.launch(onLeftMonitor, { x: 900, y: -300 }, BODY, layout);
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
      Glide.launch({ x: 2000, y: 500 }, { x: vx, y: 0 }, BODY, layout).positionAt(60).x - 2000;

    expect(travelled(600) / travelled(300)).toBeCloseTo(2, 1);
    expect(travelled(300)).toBeCloseTo(300 / Glide.defaults.airResistance, -1);
  });

  it('caps the release speed so an accidental jerk does not fling the Kobi away', () => {
    const wild = Glide.launch(onLeftMonitor, { x: 1e6, y: 0 }, BODY, layout);

    expect(speed(wild.velocityAt(0))).toBeCloseTo(Glide.defaults.maxLaunchSpeed, 6);
  });

  it('can be thrown from the leftmost monitor all the way to the rightmost one', () => {
    const fromLeftEdge = { x: 100, y: 500 };
    const glide = Glide.launch(fromLeftEdge, { x: 4500, y: 0 }, BODY, layout);

    expect(layout.displayAt(center(glide.positionAt(glide.duration)))?.id).toBe('HDMI-1');
    expect(glide.duration).toBeGreaterThan(3.5);
    expect(glide.duration).toBeLessThan(6);
  });

  it('bounces gently off the outer edge, losing most of its energy', () => {
    const glide = Glide.launch({ x: 300, y: 500 }, { x: -2500, y: 0 }, BODY, layout);
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
    const glide = Glide.launch(start, velocity, BODY, layout);

    for (const p of samples(glide)) expect(layout.onScreen(bodyAt(p))).toBe(true);
  });

  it('cannot cross a gap between monitors, bouncing back instead', () => {
    const gap = scenarios.gap();
    const glide = Glide.launch({ x: 1400, y: 300 }, { x: 3000, y: 0 }, BODY, gap);

    for (const p of samples(glide)) expect(gap.onScreen(bodyAt(p))).toBe(true);
  });

  it('reaches the very edge of the screen instead of an invisible wall', () => {
    const glide = Glide.launch({ x: 600, y: 500 }, { x: -3000, y: 0 }, BODY, layout);
    const lefts = samples(glide, 2000).map((p) => bodyAt(p).x);

    expect(Math.min(...lefts)).toBeLessThan(2);
    expect(Math.min(...lefts)).toBeGreaterThanOrEqual(0);
  });

  it('reaches the real top of a side monitor, which starts lower than the laptop', () => {
    const glide = Glide.launch({ x: 300, y: 600 }, { x: 0, y: -3000 }, BODY, layout);
    const tops = samples(glide, 2000).map((p) => bodyAt(p).y);

    expect(Math.min(...tops)).toBeLessThan(122);
    expect(Math.min(...tops)).toBeGreaterThanOrEqual(120);
  });

  it('does not glide when released already partly off screen (it is rescued instead)', () => {
    expect(Glide.launch({ x: -200, y: 500 }, { x: 2000, y: 0 }, BODY, layout).duration).toBe(0);
  });

  it('holds its final position after stopping', () => {
    const glide = Glide.launch(onLeftMonitor, { x: 800, y: 0 }, BODY, layout);

    expect(glide.positionAt(glide.duration + 10)).toEqual(glide.positionAt(glide.duration));
    expect(speed(glide.velocityAt(glide.duration + 10))).toBe(0);
  });
});
