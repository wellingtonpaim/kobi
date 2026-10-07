import type { Point, Rect, RectProps } from '@kobi/domain';

/**
 * A janela transparente onde o Kobi é desenhado. Cada plataforma tem a sua
 * implementação (XWayland, Wayland + extensão GNOME, Windows, macOS...).
 *
 * É assíncrona porque, em alguns sistemas, posição e movimento dependem de
 * outro processo: no Wayland, só o compositor sabe onde a janela está.
 */
export interface OverlayWindow {
  bounds(): Promise<Rect>;
  moveTo(topLeft: Point): Promise<void>;
  /**
   * Áreas da janela (relativas a ela, em pixels lógicos) que recebem o mouse; no
   * resto, o clique atravessa para o que está atrás do Kobi.
   */
  setInteractiveRegion(regions: readonly RectProps[]): Promise<void>;
}
