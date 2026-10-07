import type { OverlayWindow } from '@kobi/application';
import { type Point, Rect, type RectProps } from '@kobi/domain';
import type { BrowserWindow } from 'electron';

/**
 * Pixel inteiro aceito pelo Electron. Somar 0 troca −0 por 0: o V8 não considera −0
 * um inteiro de 32 bits, e `Math.round(-0.3)` dá −0 perto da borda esquerda (x = 0).
 */
const toPixel = (value: number): number => Math.round(value) + 0;

/**
 * Estratégia A do spike (spec 0002): Electron via XWayland (`--ozone-platform=x11`).
 * No X11 a janela sabe a própria posição e pode se mover sozinha.
 */
export class X11OverlayWindow implements OverlayWindow {
  /** Silhueta do Kobi relativa à janela; até a interface informar, vale a janela inteira. */
  private silhouetteOffset: RectProps | undefined;

  constructor(private readonly window: BrowserWindow) {}

  reportSilhouette(offset: RectProps): void {
    this.silhouetteOffset = offset;
  }

  silhouette(): Promise<Rect> {
    const { x, y, width, height } = this.window.getBounds();
    const offset = this.silhouetteOffset ?? { x: 0, y: 0, width, height };
    const result = Rect.create({
      x: x + offset.x,
      y: y + offset.y,
      width: offset.width,
      height: offset.height,
    });
    return result.ok
      ? Promise.resolve(result.value)
      : Promise.reject(new Error('Kobi has no silhouette'));
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
