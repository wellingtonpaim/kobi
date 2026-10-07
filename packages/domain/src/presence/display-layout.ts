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

  /**
   * A área (por exemplo, a silhueta do Kobi) está inteira sobre alguma tela? Vale
   * ficar entre dois monitores; não vale invadir vãos ou o vazio de monitores
   * desalinhados. Usa a área física de cada monitor, até a borda.
   */
  onScreen(area: Rect): boolean {
    const cuts = (start: number, end: number, edges: number[]): number[] =>
      [...new Set([start, end, ...edges.filter((e) => e > start && e < end)])].sort(
        (a, b) => a - b,
      );
    const xs = cuts(
      area.x,
      area.right,
      this.displays.flatMap((d) => [d.bounds.x, d.bounds.right]),
    );
    const ys = cuts(
      area.y,
      area.bottom,
      this.displays.flatMap((d) => [d.bounds.y, d.bounds.bottom]),
    );

    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < ys.length - 1; j++) {
        const piece = {
          x: ((xs[i] ?? 0) + (xs[i + 1] ?? 0)) / 2,
          y: ((ys[j] ?? 0) + (ys[j + 1] ?? 0)) / 2,
        };
        if (!this.displays.some((d) => d.bounds.contains(piece))) return false;
      }
    }
    return true;
  }

  /**
   * Deixa o Kobi onde está enquanto estiver na tela; senão (num vão, após
   * desconectar um monitor...), traz para a área útil do monitor mais próximo.
   */
  keepOnScreen(silhouette: Rect): Rect {
    if (this.onScreen(silhouette)) return silhouette;
    return silhouette.clampedInside(this.nearestTo(silhouette.center).workArea);
  }

  /** Centros das áreas úteis de todos os monitores, da esquerda para a direita e de cima para baixo. */
  tour(): Point[] {
    return [...this.displays]
      .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
      .map((d) => d.workArea.center);
  }
}
