import { Glide, type Point } from '@kobi/domain';

import type { DisplaySource } from './display-source.js';
import type { OverlayWindow } from './overlay-window.js';

/** Ao soltar o Kobi em movimento, planeja o deslizamento até ele parar (spec 0005). */
export class PlanGlide {
  constructor(
    private readonly window: OverlayWindow,
    private readonly displays: DisplaySource,
  ) {}

  async execute(releaseVelocity: Point): Promise<Glide> {
    const [bounds, body] = await Promise.all([this.window.bounds(), this.window.silhouette()]);
    const offset = {
      x: body.x - bounds.x,
      y: body.y - bounds.y,
      width: body.width,
      height: body.height,
    };
    return Glide.launch(bounds.topLeft, releaseVelocity, offset, this.displays.current());
  }
}
