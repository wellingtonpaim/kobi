import { describe, expect, it } from 'vitest';

import { pointerInRegions, receivesPointer } from '../region.js';

const frame = { x: 1000, y: 500 };
const regions = [
  [10, 20, 30, 40],
  [100, 100, 5, 5],
];

describe('pointerInRegions', () => {
  it('is inside when the pointer is over a region, in screen coordinates', () => {
    expect(pointerInRegions(frame, regions, [1010, 520])).toBe(true);
    expect(pointerInRegions(frame, regions, [1104, 604])).toBe(true);
  });

  it('is outside on the transparent parts of the window', () => {
    expect(pointerInRegions(frame, regions, [1000, 500])).toBe(false);
    expect(pointerInRegions(frame, regions, [1060, 520])).toBe(false);
  });

  it('treats the far edges as outside, so neighbouring regions never overlap', () => {
    expect(pointerInRegions(frame, regions, [1040, 520])).toBe(false);
    expect(pointerInRegions(frame, regions, [1010, 560])).toBe(false);
  });

  it('works with windows on monitors left of or above the primary one', () => {
    expect(pointerInRegions({ x: -1920, y: -200 }, regions, [-1900, -170])).toBe(true);
  });

  it('is outside when there is no region yet', () => {
    expect(pointerInRegions(frame, [], [1010, 520])).toBe(false);
  });
});

describe('receivesPointer', () => {
  it('takes the mouse only over the Kobi', () => {
    expect(receivesPointer(true, false, false)).toBe(true);
    expect(receivesPointer(false, false, true)).toBe(false);
  });

  it('keeps the mouse during a drag that started on the Kobi, even when the pointer slips out', () => {
    expect(receivesPointer(false, true, true)).toBe(true);
  });

  it('does not grab a drag from another window that passes over the Kobi', () => {
    expect(receivesPointer(true, true, false)).toBe(false);
  });
});
