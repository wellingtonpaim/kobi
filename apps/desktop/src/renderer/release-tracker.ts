import type { ScreenPoint } from '../shared/api.js';

/** Janela de tempo, antes de soltar, usada para medir a velocidade de saída. */
const WINDOW_MS = 80;
/** Se o mouse ficou parado este tempo antes de soltar, não há arremesso. */
const STILL_MS = 50;

/** Velocidade do mouse nos últimos instantes do arraste, para o arremesso (spec 0005). */
export class ReleaseTracker {
  private samples: { readonly point: ScreenPoint; readonly at: number }[] = [];

  add(point: ScreenPoint, atMs: number): void {
    this.samples.push({ point, at: atMs });
    this.samples = this.samples.filter((s) => atMs - s.at <= WINDOW_MS);
  }

  reset(): void {
    this.samples = [];
  }

  /** Velocidade em px/s ao soltar; zero se o mouse parou antes ou se foi só um clique. */
  velocityAt(releaseMs: number): ScreenPoint {
    const recent = this.samples.filter((s) => releaseMs - s.at <= WINDOW_MS);
    const first = recent[0];
    const last = recent.at(-1);
    if (!first || !last || last === first || releaseMs - last.at > STILL_MS) return { x: 0, y: 0 };
    const seconds = (last.at - first.at) / 1000;
    return {
      x: (last.point.x - first.point.x) / seconds,
      y: (last.point.y - first.point.y) / seconds,
    };
  }
}
