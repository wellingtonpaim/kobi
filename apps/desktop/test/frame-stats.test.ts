import { describe, expect, it } from 'vitest';

import { FrameStats } from '../src/renderer/frame-stats.js';

/** Registra quadros em intervalos regulares, cada um com o mesmo tempo de desenho. */
const run = (stats: FrameStats, from: number, frames: number, everyMs: number, renderMs = 2) => {
  for (let i = 0; i < frames; i += 1) stats.add(from + i * everyMs, renderMs);
};

describe('FrameStats', () => {
  it('counts frames and measures the interval between them', () => {
    const stats = new FrameStats();
    run(stats, 0, 61, 1000 / 60);

    const summary = stats.take(60);

    expect(summary.frames).toBe(61);
    expect(summary.interval.p50).toBeCloseTo(16.67, 1);
    expect(summary.interval.max).toBeCloseTo(16.67, 1);
    expect(summary.render.p50).toBe(2);
    expect(summary.dropped).toBe(0);
  });

  it('counts as dropped every interval longer than one and a half refreshes', () => {
    const stats = new FrameStats();
    run(stats, 0, 50, 10);
    stats.add(49 * 10 + 35, 2);

    const summary = stats.take(100);

    expect(summary.dropped).toBe(1);
    expect(summary.interval.max).toBe(35);
  });

  it('judges drops by the refresh rate of the current monitor', () => {
    const stats = new FrameStats();
    run(stats, 0, 50, 1000 / 60);

    expect(stats.take(100).dropped).toBe(49);
  });

  it('starts a new period after each summary, keeping the interval across it', () => {
    const stats = new FrameStats();
    run(stats, 0, 10, 10);
    stats.take(100);
    stats.add(100, 5);

    const summary = stats.take(100);

    expect(summary.frames).toBe(1);
    expect(summary.interval.p50).toBe(10);
    expect(summary.render.p50).toBe(5);
  });

  it('reports zeros when no frame was drawn', () => {
    const summary = new FrameStats().take(60);

    expect(summary).toEqual({
      frames: 0,
      dropped: 0,
      interval: { p50: 0, p95: 0, p99: 0, max: 0 },
      render: { p50: 0, p95: 0, p99: 0, max: 0 },
    });
  });
});
