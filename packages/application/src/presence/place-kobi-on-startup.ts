import type { DisplaySource } from './display-source.js';
import type { OverlayWindow } from './overlay-window.js';

const RESTING_MARGIN = 24;

export class PlaceKobiOnStartup {
  constructor(
    private readonly window: OverlayWindow,
    private readonly displays: DisplaySource,
  ) {}

  async execute(): Promise<void> {
    const { workArea } = this.displays.current().primary;
    const [bounds, body] = await Promise.all([this.window.bounds(), this.window.silhouette()]);
    const spot = body.placedAtBottomRightOf(workArea, RESTING_MARGIN);
    await this.window.moveTo({ x: bounds.x + spot.x - body.x, y: bounds.y + spot.y - body.y });
  }
}
