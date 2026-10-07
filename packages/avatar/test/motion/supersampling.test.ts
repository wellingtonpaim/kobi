import { describe, expect, it } from 'vitest';

import { supersampleFactor } from '../../src/motion/supersampling.js';

describe('supersampleFactor', () => {
  it.each([
    ['a Kobi window at 100% scale', 300, 400, 3],
    ['a Kobi window at 200% scale', 600, 800, 3],
    ['a large canvas', 1600, 1000, 2],
    ['a canvas beyond the texture budget', 5000, 3000, 2],
  ])('renders %s at %i×%i with factor %i', (_, width, height, factor) => {
    expect(supersampleFactor(width, height)).toBe(factor);
  });
});
