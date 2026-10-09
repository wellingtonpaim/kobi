import { Glide, type Point } from '@kobi/domain';

import type { DisplaySource } from './display-source.js';
import { KeepKobiVisible } from './keep-kobi-visible.js';
import type { OverlayWindow } from './overlay-window.js';

/**
 * Ao soltar o Kobi: em movimento, planeja o deslizamento até ele parar (spec 0005);
 * parado, ou fora da tela (o deslizamento não começa fora dela), traz de volta à
 * área visível. Devolve o deslizamento a animar, se houver.
 */
export class ReleaseKobi {
  private readonly keepVisible: KeepKobiVisible;

  constructor(
    private readonly window: OverlayWindow,
    private readonly displays: DisplaySource,
  ) {
    this.keepVisible = new KeepKobiVisible(window, displays);
  }

  async execute(releaseVelocity: Point): Promise<Glide | undefined> {
    const [bounds, body] = await Promise.all([this.window.bounds(), this.window.silhouette()]);
    const offset = {
      x: body.x - bounds.x,
      y: body.y - bounds.y,
      width: body.width,
      height: body.height,
    };
    const glide = Glide.launch(bounds.topLeft, releaseVelocity, offset, this.displays.current());
    if (glide.duration > 0) return glide;
    await this.keepVisible.execute();
    return undefined;
  }
}
