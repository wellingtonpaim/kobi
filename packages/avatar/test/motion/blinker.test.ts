import { describe, expect, it } from 'vitest';

import { Blinker } from '../../src/motion/blinker.js';

describe('Blinker', () => {
  it('keeps the eyes open before the first blink', () => {
    expect(new Blinker(() => 0).openness(2.4)).toBe(1);
  });

  it('closes the eyes quickly and reopens them, as in v6', () => {
    const blinker = new Blinker(() => 0);

    expect(blinker.openness(2.55)).toBeCloseTo(0.65, 10);
    expect(blinker.openness(2.64)).toBeCloseTo(0.12, 10);
    expect(blinker.openness(2.7)).toBeCloseTo(0.54, 10);
    expect(blinker.openness(2.79)).toBe(1);
  });

  it('schedules the next blink 2.5 to 5.5 seconds later', () => {
    const late = new Blinker(() => 1);
    late.openness(2.81);

    expect(late.openness(8.2)).toBe(1);
    expect(late.openness(8.4)).toBeLessThan(1);
  });

  it('never blinks when the user prefers reduced motion', () => {
    expect(new Blinker(() => 0, true).openness(2.64)).toBe(1);
  });
});
