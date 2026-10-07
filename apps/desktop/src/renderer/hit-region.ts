export interface Region {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface HitRegionOptions {
  /** Quantos pixels CSS cada célula da máscara representa. */
  readonly cellSize: number;
  /** Alfa mínimo (0–255) para um pixel contar como parte do Kobi. */
  readonly alphaThreshold: number;
  /** Folga, em células, em volta do que é visível. */
  readonly margin: number;
}

/** Nunca devolver vazio: no Electron, uma forma vazia deixa a janela inteira clicável de novo. */
const FALLBACK: readonly Region[] = [{ x: 0, y: 0, width: 1, height: 1 }];

/**
 * Converte a máscara de transparência do Kobi (RGBA reduzido) nos retângulos que
 * recebem o mouse; fora deles, o clique atravessa para a janela de trás.
 */
export const hitRegion = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  { cellSize, alphaThreshold, margin }: HitRegionOptions,
): Region[] => {
  const solid = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((rgba[(y * width + x) * 4 + 3] ?? 0) <= alphaThreshold) continue;
      for (let dy = -margin; dy <= margin; dy++) {
        for (let dx = -margin; dx <= margin; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) solid[ny * width + nx] = 1;
        }
      }
    }
  }

  const regions: Region[] = [];
  /** Retângulos ainda abertos, indexados pelo trecho horizontal "início:fim". */
  let open = new Map<string, Region>();
  for (let y = 0; y <= height; y++) {
    const next = new Map<string, Region>();
    for (let x = 0; y < height && x < width; x++) {
      if (!solid[y * width + x]) continue;
      const start = x;
      while (x < width && solid[y * width + x]) x++;
      const key = `${String(start)}:${String(x)}`;
      const above = open.get(key);
      next.set(
        key,
        above
          ? { ...above, height: above.height + 1 }
          : { x: start, y, width: x - start, height: 1 },
      );
      open.delete(key);
    }
    regions.push(...open.values());
    open = next;
  }

  if (regions.length === 0) return [...FALLBACK];
  return regions
    .map((r) => ({
      x: r.x * cellSize,
      y: r.y * cellSize,
      width: r.width * cellSize,
      height: r.height * cellSize,
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
};

/**
 * Onde o Kobi é sólido (cabeça, antena, braços e corpo), em pixels CSS. A sombra e
 * a poeira são translúcidas e ficam de fora. É o que deve caber na tela.
 */
export const opaqueBounds = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  { cellSize, alphaThreshold }: Omit<HitRegionOptions, 'margin'>,
): Region | undefined => {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((rgba[(y * width + x) * 4 + 3] ?? 0) <= alphaThreshold) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) return undefined;
  return {
    x: left * cellSize,
    y: top * cellSize,
    width: (right - left + 1) * cellSize,
    height: (bottom - top + 1) * cellSize,
  };
};
