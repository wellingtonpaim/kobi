import { describe, expect, it } from 'vitest';

import { approach } from '../../src/motion/approach.js';

const runFor = (seconds: number, hz: number, from: number, to: number): number => {
  let value = from;
  for (let i = 0; i < Math.round(seconds * hz); i++) value = approach(value, to, 1 / hz, 0.08);
  return value;
};

describe('approach', () => {
  it('reproduces the v6 step of one frame at 60 fps', () => {
    expect(approach(0, 1, 1 / 60, 0.08)).toBeCloseTo(0.08, 10);
  });

  it.each([75, 100, 120, 144])('moves the same in one second at %i Hz as at 60 Hz', (hz) => {
    expect(runFor(1, hz, 0, 1)).toBeCloseTo(runFor(1, 60, 0, 1), 10);
  });

  it('stays put when no time passes', () => {
    expect(approach(0.3, 1, 0, 0.08)).toBeCloseTo(0.3, 12);
  });

  it('settles on the target after a long pause', () => {
    expect(approach(0, 1, 10, 0.08)).toBeCloseTo(1, 10);
  });
});
