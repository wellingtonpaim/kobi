import type { Point, Rect, RectProps } from '@kobi/domain';

import type { PlatformOverlay } from './platform-overlay.js';

/**
 * Decorador: avisa a posição da janela depois de cada movimento, venha de onde vier
 * (arraste, passeio, resgate após hotplug). No Wayland a interface não tem como saber.
 */
export class ObservedOverlayWindow implements PlatformOverlay {
  constructor(
    private readonly inner: PlatformOverlay,
    private readonly moved: (topLeft: Point) => void,
  ) {}

  async moveTo(topLeft: Point): Promise<void> {
    await this.inner.moveTo(topLeft);
    this.moved(topLeft);
  }

  bounds(): Promise<Rect> {
    return this.inner.bounds();
  }

  silhouette(): Promise<Rect> {
    return this.inner.silhouette();
  }

  setInteractiveRegion(regions: readonly RectProps[]): Promise<void> {
    return this.inner.setInteractiveRegion(regions);
  }

  reportSilhouette(offset: RectProps): void {
    this.inner.reportSilhouette(offset);
  }

  show(): Promise<void> {
    return this.inner.show();
  }

  holdPointer(held: boolean): void {
    this.inner.holdPointer(held);
  }

  revealArea(area: RectProps | undefined): void {
    this.inner.revealArea(area);
  }
}
