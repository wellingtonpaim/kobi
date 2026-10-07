import type { DisplayLayout, Point, Rect } from '@kobi/domain';

import type { DisplaySource } from '../../src/presence/display-source.js';
import type { OverlayWindow } from '../../src/presence/overlay-window.js';

export class FakeOverlayWindow implements OverlayWindow {
  readonly moves: Point[] = [];

  constructor(private current: Rect) {}

  bounds(): Promise<Rect> {
    return Promise.resolve(this.current);
  }

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
