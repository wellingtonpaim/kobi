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
    const spot = (await this.window.bounds()).placedAtBottomRightOf(workArea, RESTING_MARGIN);
    await this.window.moveTo(spot.topLeft);
  }
}
