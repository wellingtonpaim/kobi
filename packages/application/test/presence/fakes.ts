import { type DisplayLayout, type Point, Rect, type RectProps } from '@kobi/domain';

import type { DisplaySource } from '../../src/presence/display-source.js';
import type { OverlayWindow } from '../../src/presence/overlay-window.js';

export class FakeOverlayWindow implements OverlayWindow {
  readonly moves: Point[] = [];

  constructor(
    private current: Rect,
    /** Silhueta do Kobi relativa ao canto da janela de 300×400. */
    private readonly body = { x: 80, y: 40, width: 140, height: 300 },
  ) {}

  bounds(): Promise<Rect> {
    return Promise.resolve(this.current);
  }

  silhouette(): Promise<Rect> {
    const { x, y, width, height } = this.body;
    const result = Rect.create({ x: this.current.x + x, y: this.current.y + y, width, height });
    if (!result.ok) throw new Error('invalid silhouette');
    return Promise.resolve(result.value);
  }

  setInteractiveRegion(regions: readonly RectProps[]): Promise<void> {
    this.region = regions;
    return Promise.resolve();
  }

  region: readonly RectProps[] = [];

  moveTo(topLeft: Point): Promise<void> {
    this.moves.push(topLeft);
    this.current = this.current.movedTo(topLeft);
    return Promise.resolve();
  }
}

export class FakeDisplaySource implements DisplaySource {
  private readonly listeners = new Set<() => void>();

  constructor(private layout: DisplayLayout) {}

  current(): DisplayLayout {
    return this.layout;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  change(layout: DisplayLayout): void {
    this.layout = layout;
    this.listeners.forEach((listener) => {
      listener();
    });
  }
}
