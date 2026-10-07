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
    const bounds = await this.window.bounds();
    return Glide.launch(bounds.topLeft, releaseVelocity, bounds, this.displays.current());
  }
}
