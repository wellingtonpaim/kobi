import { describe, expect, it } from 'vitest';

import { flipRows } from '../../src/image/flip-rows.js';

describe('flipRows', () => {
  it('turns an image read bottom-up (WebGL) into top-down rows', () => {
    // 2×3 RGBA: cada linha tem um valor próprio.
    const bottomUp = Uint8Array.from([
      ...[3, 3, 3, 3, 3, 3, 3, 3],
      ...[2, 2, 2, 2, 2, 2, 2, 2],
      ...[1, 1, 1, 1, 1, 1, 1, 1],
    ]);

    const topDown = flipRows(bottomUp, 2, 3);

    expect([...topDown]).toEqual([
      ...[1, 1, 1, 1, 1, 1, 1, 1],
      ...[2, 2, 2, 2, 2, 2, 2, 2],
      ...[3, 3, 3, 3, 3, 3, 3, 3],
    ]);
  });

  it('keeps the pixels of each row in order', () => {
    const bottomUp = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);

    expect([...flipRows(bottomUp, 2, 1)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
