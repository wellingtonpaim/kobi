import type { OverlayWindow } from '@kobi/application';
import { type Point, Rect } from '@kobi/domain';
import type { BrowserWindow } from 'electron';

/**
 * Estratégia A do spike (spec 0002): Electron via XWayland (`--ozone-platform=x11`).
 * No X11 a janela sabe a própria posição e pode se mover sozinha.
 */
export class X11OverlayWindow implements OverlayWindow {
  constructor(private readonly window: BrowserWindow) {}

  bounds(): Promise<Rect> {
    const result = Rect.create(this.window.getBounds());
    return result.ok
      ? Promise.resolve(result.value)
      : Promise.reject(new Error('Overlay window has no area'));
  }

  moveTo({ x, y }: Point): Promise<void> {
    this.window.setPosition(Math.round(x), Math.round(y));
    return Promise.resolve();
  }
}
