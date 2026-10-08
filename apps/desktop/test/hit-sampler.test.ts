import { describe, expect, it, vi } from 'vitest';

import type { Region } from '../src/renderer/hit-region.js';
import { HitSampler } from '../src/renderer/hit-sampler.js';

/** Janela de 40×40 px CSS: a amostra tem 10×10 células de 4 px. */
const SIZE = 40;
const CELLS = SIZE / 4;

/** Amostra com um bloco opaco de 2×2 células no canto superior esquerdo. */
const kobiInCorner = (): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(CELLS * CELLS * 4);
  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const)
    data[(y * CELLS + x) * 4 + 3] = 255;
  return data;
};

/** Fonte de leitura controlada pelo teste: cada leitura só termina quando o teste manda. */
const fakeSource = () => {
  const reads: { width: number; height: number; finish: (data: Uint8ClampedArray) => void }[] = [];
  let busy = false;
  const source = (width: number, height: number) => {
    if (busy) return undefined;
    busy = true;
    return new Promise<Uint8ClampedArray>((resolve) => {
      reads.push({
        width,
        height,
        finish: (data) => {
          busy = false;
          resolve(data);
        },
      });
    });
  };
  return { source, reads };
};

const setup = () => {
  const { source, reads } = fakeSource();
  const regions: (readonly Region[])[] = [];
  const silhouettes: Region[] = [];
  const sampler = new HitSampler(
    source,
    {
      region: (r) => regions.push(r),
      silhouette: (s) => silhouettes.push(s),
    },
    (error: unknown) => {
      throw error;
    },
  );
  return { sampler, reads, regions, silhouettes };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const wholeWindow = [{ x: 0, y: 0, width: SIZE, height: SIZE }];

describe('HitSampler', () => {
  it('asks for one cell per 4 CSS pixels', () => {
    const { sampler, reads } = setup();

    sampler.update(0, SIZE, SIZE, true);

    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatchObject({ width: CELLS, height: CELLS });
  });

  it('publishes where the Kobi is visible and solid once the reading arrives', async () => {
    const { sampler, reads, regions, silhouettes } = setup();

    sampler.update(0, SIZE, SIZE, true);
    expect(regions).toEqual([]);
    reads[0]?.finish(kobiInCorner());
    await flush();

    expect(silhouettes).toEqual([{ x: 0, y: 0, width: 8, height: 8 }]);
    expect(regions.at(-1)?.[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('samples a few times per second, not every frame', () => {
    const { sampler, reads } = setup();

    sampler.update(0, SIZE, SIZE, true);
    reads[0]?.finish(kobiInCorner());
    sampler.update(16, SIZE, SIZE, true);
    sampler.update(50, SIZE, SIZE, true);
    sampler.update(100, SIZE, SIZE, true);

    expect(reads).toHaveLength(2);
  });

  it('tries again on the next frame when the previous reading is still running', () => {
    const { sampler, reads } = setup();

    sampler.update(0, SIZE, SIZE, true);
    sampler.update(100, SIZE, SIZE, true);
    reads[0]?.finish(kobiInCorner());
    sampler.update(116, SIZE, SIZE, true);

    expect(reads).toHaveLength(2);
  });

  it('opens the whole window while the Kobi moves, so nothing is cut off', () => {
    const { sampler, regions } = setup();

    sampler.update(0, SIZE, SIZE, false);

    expect(regions).toEqual([wholeWindow]);
  });

  it('does not shrink the window when the Kobi started moving before the reading arrived', async () => {
    const { sampler, reads, regions } = setup();

    sampler.update(0, SIZE, SIZE, true);
    sampler.update(16, SIZE, SIZE, false);
    reads[0]?.finish(kobiInCorner());
    await flush();

    expect(regions).toEqual([wholeWindow]);
  });

  it('only sends what changed', async () => {
    const { sampler, reads, regions, silhouettes } = setup();

    for (const at of [0, 100]) {
      sampler.update(at, SIZE, SIZE, true);
      reads.at(-1)?.finish(kobiInCorner());
      await flush();
    }

    expect(regions).toHaveLength(1);
    expect(silhouettes).toHaveLength(1);
  });

  it('reports a failed reading without throwing', async () => {
    const errors: unknown[] = [];
    const sampler = new HitSampler(
      () => Promise.reject(new Error('context lost')),
      { region: vi.fn(), silhouette: vi.fn() },
      (error) => errors.push(error),
    );

    sampler.update(0, SIZE, SIZE, true);
    await flush();

    expect(errors).toHaveLength(1);
  });
});
