import { err, ok, type Result } from '../shared/result.js';
import type { Display } from './display.js';
import type { Point, Rect } from './rect.js';

export type InvalidLayout =
  | { readonly kind: 'no-displays' }
  | { readonly kind: 'duplicate-display-id'; readonly id: string }
  | { readonly kind: 'primary-display-count'; readonly count: number };

type NonEmpty<T> = readonly [T, ...T[]];

const minBy = <T>(items: NonEmpty<T>, score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) < score(best) ? item : best));

/**
 * Os monitores conectados, em qualquer quantidade e disposição. A área útil é a
 * união dos monitores (pode ter vãos e cantos vazios), nunca um retângulo único.
 */
export class DisplayLayout {
  private constructor(
    readonly displays: NonEmpty<Display>,
    readonly primary: Display,
  ) {}

  static create(displays: readonly Display[]): Result<DisplayLayout, InvalidLayout> {
    const [first, ...rest] = displays;
    if (!first) return err({ kind: 'no-displays' });

    const ids = new Set<string>();
    for (const { id } of displays) {
      if (ids.has(id)) return err({ kind: 'duplicate-display-id', id });
      ids.add(id);
    }

    const primaries = displays.filter((d) => d.primary);
    const [primary] = primaries;
    if (!primary || primaries.length > 1) {
      return err({ kind: 'primary-display-count', count: primaries.length });
    }

    return ok(new DisplayLayout([first, ...rest], primary));
  }

  displayAt(point: Point): Display | undefined {
    return this.displays.find((d) => d.bounds.contains(point));
  }

  nearestTo(point: Point): Display {
    return minBy(this.displays, (d) => d.bounds.distanceTo(point));
  }

  /** Monitor que contém a maior parte da janela; define escala e taxa de atualização em uso. */
  displayFor(window: Rect): Display {
    const overlaps = minBy(this.displays, (d) => -d.bounds.intersectionArea(window));
    return overlaps.bounds.intersectionArea(window) > 0 ? overlaps : this.nearestTo(window.center);
  }

  /** O ponto está na área útil de algum monitor (fora de painéis, docks e vãos)? */
  inWorkArea(point: Point): boolean {
    return this.displays.some((d) => d.workArea.contains(point));
  }

  /**
   * Mantém a janela onde está enquanto o centro dela estiver na área útil de algum
   * monitor; senão, traz para o monitor mais próximo (por exemplo, após desconectá-lo).
   */
  ensureVisible(window: Rect): Rect {
    const { center } = window;
    if (this.inWorkArea(center)) return window;
    return window.clampedInside(this.nearestTo(center).workArea);
  }

  /** Centros das áreas úteis de todos os monitores, da esquerda para a direita e de cima para baixo. */
  tour(): Point[] {
    return [...this.displays]
      .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
      .map((d) => d.workArea.center);
  }
}
