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
  holdPointer(): void {
    // Nada a fazer.
  }

  /** Forma X11 da janela (extensão SHAPE): fora dela o clique vai para a janela de trás. */
  setInteractiveRegion(regions: readonly RectProps[]): Promise<void> {
    this.window.setShape(
      regions.map((r) => ({
        x: toPixel(r.x),
        y: toPixel(r.y),
        width: toPixel(r.width),
        height: toPixel(r.height),
      })),
    );
    return Promise.resolve();
  }
}
