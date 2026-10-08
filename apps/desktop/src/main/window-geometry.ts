import { Rect, type RectProps } from '@kobi/domain';

/**
 * Pixel inteiro aceito pelo Electron e pelo D-Bus. Somar 0 troca −0 por 0: o V8 não
 * considera −0 um inteiro de 32 bits, e `Math.round(-0.3)` dá −0 perto da borda (x = 0).
 */
export const toPixel = (value: number): number => Math.round(value) + 0;

/** Silhueta do Kobi na tela: a janela mais o deslocamento informado pela interface. */
export const placeSilhouette = (
  window: RectProps,
  offset: RectProps | undefined,
): Promise<Rect> => {
  const inside = offset ?? { x: 0, y: 0, width: window.width, height: window.height };
  const result = Rect.create({
    x: window.x + inside.x,
    y: window.y + inside.y,
    width: inside.width,
    height: inside.height,
  });
  return result.ok
    ? Promise.resolve(result.value)
    : Promise.reject(new Error('Kobi has no silhouette'));
};
