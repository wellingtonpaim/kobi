import { type Point, Rect, type RectProps } from '@kobi/domain';
import type { BrowserWindow } from 'electron';

import type { PlatformOverlay } from './platform-overlay.js';
import { placeSilhouette, toPixel } from './window-geometry.js';

/**
 * Estratégia A do spike (spec 0002): Electron via XWayland (`--ozone-platform=x11`).
 * No X11 a janela sabe a própria posição e pode se mover sozinha.
 */
export class X11OverlayWindow implements PlatformOverlay {
  /** Silhueta do Kobi relativa à janela; até a interface informar, vale a janela inteira. */
  private silhouetteOffset: RectProps | undefined;
  /** Região interativa mais recente, reaplicada quando o usuário solta o Kobi. */
  private region: readonly RectProps[] | undefined;
  private held = false;
  /** Área que aparece além do Kobi: a forma X11 recorta o desenho, não só o mouse. */
  private revealed: RectProps | undefined;

  constructor(private readonly window: BrowserWindow) {}

  reportSilhouette(offset: RectProps): void {
    this.silhouetteOffset = offset;
  }

  silhouette(): Promise<Rect> {
    return placeSilhouette(this.window.getBounds(), this.silhouetteOffset);
  }

  bounds(): Promise<Rect> {
    const result = Rect.create(this.window.getBounds());
    return result.ok
      ? Promise.resolve(result.value)
      : Promise.reject(new Error('Overlay window has no area'));
  }

  moveTo({ x, y }: Point): Promise<void> {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return Promise.reject(new Error(`invalid position (${String(x)}, ${String(y)})`));
    }
    this.window.setPosition(toPixel(x), toPixel(y));
    return Promise.resolve();
  }

  show(): Promise<void> {
    this.window.showInactive();
    return Promise.resolve();
  }

  /** No X11 a forma da janela já decide quem recebe o mouse; segurar não muda nada. */
  /**
   * Enquanto o Kobi está seguro, a janela inteira recebe o mouse: num arremesso rápido o
   * ponteiro sai da silhueta antes de a janela alcançá-lo, e o soltar se perderia (o Kobi
   * ficaria preso ao mouse). Medido no teste de interação do spike.
   */
  holdPointer(held: boolean): void {
    this.held = held;
    const { width, height } = this.window.getBounds();
    this.applyShape(held ? [{ x: 0, y: 0, width, height }] : this.region);
  }

  /** Forma X11 da janela (extensão SHAPE): fora dela o clique vai para a janela de trás. */
  setInteractiveRegion(regions: readonly RectProps[]): Promise<void> {
    this.region = regions;
    if (!this.held) this.applyShape(regions);
    return Promise.resolve();
  }

  revealArea(area: RectProps | undefined): void {
    this.revealed = area;
    if (!this.held) this.applyShape(this.region);
  }

  private applyShape(regions: readonly RectProps[] | undefined): void {
    if (!regions) return;
    const shown = this.revealed ? [...regions, this.revealed] : regions;
    this.window.setShape(
      shown.map((r) => ({
        x: toPixel(r.x),
        y: toPixel(r.y),
        width: toPixel(r.width),
        height: toPixel(r.height),
      })),
    );
  }
}
