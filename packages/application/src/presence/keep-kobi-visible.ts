import type { DisplaySource } from './display-source.js';
import type { OverlayWindow } from './overlay-window.js';

/** Traz o Kobi de volta à área visível quando os monitores mudam ou ele é solto fora deles. */
export class KeepKobiVisible {
  constructor(
    private readonly window: OverlayWindow,
    private readonly displays: DisplaySource,
  ) {}

  async execute(): Promise<void> {
    const [bounds, body] = await Promise.all([this.window.bounds(), this.window.silhouette()]);
    const target = this.displays.current().keepOnScreen(body);
    const dx = target.x - body.x;
    const dy = target.y - body.y;
    if (dx !== 0 || dy !== 0) await this.window.moveTo({ x: bounds.x + dx, y: bounds.y + dy });
  }
}
