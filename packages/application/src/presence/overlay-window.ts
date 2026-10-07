import type { Point, Rect } from '@kobi/domain';

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
}
