const TEXTURE_BUDGET = 4096;

/**
 * Quantas vezes renderizar acima da resolução da tela antes de reduzir (v6: 2× a 3×).
 * Recebe o tamanho em pixels físicos, então já considera a escala do monitor atual.
 */
export const supersampleFactor = (width: number, height: number): number =>
  Math.max(2, Math.min(3, Math.floor(TEXTURE_BUDGET / Math.max(width, height))));
