import { describe, expect, it } from 'vitest';

import { hitRegion } from '../src/renderer/hit-region.js';

/** Monta uma máscara RGBA a partir de linhas de texto: '#' é pixel visível, '.' transparente. */
const mask = (...rows: string[]): { data: Uint8ClampedArray; width: number; height: number } => {
  const width = rows[0]?.length ?? 0;
  const data = new Uint8ClampedArray(width * rows.length * 4);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) data[(y * width + x) * 4 + 3] = row[x] === '#' ? 255 : 0;
  });
  return { data, width, height: rows.length };
};

const options = { cellSize: 4, alphaThreshold: 8, margin: 0 };

describe('hitRegion', () => {
  it('turns visible cells into rectangles in CSS pixels', () => {
    const { data, width, height } = mask('....', '.##.', '....');

    expect(hitRegion(data, width, height, options)).toEqual([{ x: 4, y: 4, width: 8, height: 4 }]);
  });

  it('merges identical rows into one taller rectangle', () => {
    const { data, width, height } = mask('.##.', '.##.', '.##.');

    expect(hitRegion(data, width, height, options)).toEqual([{ x: 4, y: 0, width: 8, height: 12 }]);
  });

  it('keeps separate shapes apart, so clicks pass between them', () => {
    const { data, width, height } = mask('#..#');

    expect(hitRegion(data, width, height, options)).toEqual([
      { x: 0, y: 0, width: 4, height: 4 },
      { x: 12, y: 0, width: 4, height: 4 },
    ]);
  });

  it('ignores nearly invisible pixels', () => {
    const { data, width, height } = mask('##');
    data[3] = 5;

    expect(hitRegion(data, width, height, options)).toEqual([{ x: 4, y: 0, width: 4, height: 4 }]);
  });

  it('grows the region by a margin, so moving arms are never clipped between updates', () => {
    const { data, width, height } = mask('.....', '.....', '..#..', '.....', '.....');

    expect(hitRegion(data, width, height, { ...options, margin: 1 })).toEqual([
      { x: 4, y: 4, width: 12, height: 12 },
    ]);
  });

  it('never returns an empty region, which would make the whole window clickable again', () => {
    const { data, width, height } = mask('...', '...');

    expect(hitRegion(data, width, height, options)).toEqual([{ x: 0, y: 0, width: 1, height: 1 }]);
  });
});
