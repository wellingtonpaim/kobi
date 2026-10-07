const REFERENCE_HZ = 60;

/**
 * Suavização exponencial independente da taxa de quadros. `fractionPer60HzFrame`
 * é quanto o valor andava por quadro no protótipo v6, que rodava a 60 fps:
 * o resultado depois de um segundo é o mesmo a 60, 100 ou 144 Hz.
 */
export const approach = (
  current: number,
  target: number,
  elapsedSeconds: number,
  fractionPer60HzFrame: number,
): number => {
  const remaining = (1 - fractionPer60HzFrame) ** (elapsedSeconds * REFERENCE_HZ);
  return target + (current - target) * remaining;
};
