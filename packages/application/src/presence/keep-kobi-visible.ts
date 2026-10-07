import type { DisplaySource } from './display-source.js';
import type { OverlayWindow } from './overlay-window.js';

/** Traz o Kobi de volta à área visível quando os monitores mudam ou ele é solto fora deles. */
export class KeepKobiVisible {
  constructor(
    private readonly window: OverlayWindow,
    private readonly displays: DisplaySource,
  ) {}

  async execute(): Promise<void> {
    const bounds = await this.window.bounds();
    const visible = this.displays.current().ensureVisible(bounds);
    if (visible.x !== bounds.x || visible.y !== bounds.y) await this.window.moveTo(visible.topLeft);
  }
}
