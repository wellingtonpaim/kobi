import type { DisplayLayout } from './display-layout.js';
import { type Point, Rect, type RectProps } from './rect.js';

export interface GlideOptions {
  /** Resistência do ar, por segundo: a velocidade cai pela metade a cada ln(2)/k segundos. */
  readonly airResistance: number;
  /** Fração da velocidade que sobra ao quicar numa borda. */
  readonly restitution: number;
  /** Abaixo desta velocidade (px/s) o Kobi para. */
  readonly restSpeed: number;
  readonly maxLaunchSpeed: number;
}

const DEFAULTS: GlideOptions = {
  airResistance: 1.2,
  restitution: 0.3,
  restSpeed: 5,
  maxLaunchSpeed: 6000,
};
const STEP = 1 / 240;
const MAX_DURATION = 15;

/**
 * Deslizamento depois de um arremesso: a resistência do ar é proporcional à
 * velocidade, então ela cai exponencialmente e a distância percorrida é
 * velocidade ÷ resistência. A silhueta do Kobi nunca sai das telas; ao bater
 * numa borda, ele encosta nela e quica, perdendo energia.
 *
 * O trajeto é calculado uma vez, em passos fixos, e depois só lido: o resultado
 * não depende da taxa de quadros.
 */
export class Glide {
  static readonly defaults = DEFAULTS;

  private constructor(
    private readonly positions: readonly Point[],
    private readonly velocities: readonly Point[],
  ) {}

  get duration(): number {
    return (this.positions.length - 1) * STEP;
  }

  /**
   * @param start canto superior esquerdo da janela do Kobi ao ser solto
   * @param velocity velocidade de saída, em px/s
   * @param body silhueta visível do Kobi, relativa ao canto da janela
   */
  static launch(
    start: Point,
    velocity: Point,
    body: RectProps,
    layout: DisplayLayout,
    options: Partial<GlideOptions> = {},
  ): Glide {
    const {
      airResistance: k,
      restitution,
      restSpeed,
      maxLaunchSpeed,
    } = { ...DEFAULTS, ...options };
    const launchSpeed = Math.hypot(velocity.x, velocity.y);
    if (launchSpeed < restSpeed) return new Glide([start], [{ x: 0, y: 0 }]);

    const silhouette = Rect.create(body);
    if (!silhouette.ok) return new Glide([start], [{ x: 0, y: 0 }]);
    const usable = (x: number, y: number): boolean =>
      layout.onScreen(silhouette.value.movedTo({ x: x + body.x, y: y + body.y }));
    if (!usable(start.x, start.y)) return new Glide([start], [{ x: 0, y: 0 }]);

    const cap = Math.min(1, maxLaunchSpeed / launchSpeed);
    /** Anda o máximo possível do passo sem sair da tela: encosta exatamente na borda. */
    const advance = (
      from: number,
      delta: number,
      fits: (to: number) => boolean,
    ): [number, boolean] => {
      if (fits(from + delta)) return [from + delta, false];
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        if (fits(from + delta * mid)) lo = mid;
        else hi = mid;
      }
      return [from + delta * lo, true];
    };

    const decay = Math.exp(-k * STEP);
    /** Deslocamento exato de um passo com velocidade decaindo exponencialmente. */
    const reach = (1 - decay) / k;
    let { x, y } = start;
    let vx = velocity.x * cap;
    let vy = velocity.y * cap;
    const positions: Point[] = [start];
    const velocities: Point[] = [{ x: vx, y: vy }];

    for (let t = 0; Math.hypot(vx, vy) >= restSpeed && t < MAX_DURATION; t += STEP) {
      const [nx, hitX] = advance(x, vx * reach, (to) => usable(to, y));
      x = nx;
      if (hitX) vx = -vx * restitution;
      const [ny, hitY] = advance(y, vy * reach, (to) => usable(x, to));
      y = ny;
      if (hitY) vy = -vy * restitution;
      vx *= decay;
      vy *= decay;
      positions.push({ x, y });
      velocities.push({ x: vx, y: vy });
    }
    velocities[velocities.length - 1] = { x: 0, y: 0 };
    return new Glide(positions, velocities);
  }

  positionAt(seconds: number): Point {
    return this.sample(this.positions, seconds);
  }

  velocityAt(seconds: number): Point {
    return seconds >= this.duration ? { x: 0, y: 0 } : this.sample(this.velocities, seconds);
  }

  private sample(points: readonly Point[], seconds: number): Point {
    const last = points.length - 1;
    const at = Math.min(Math.max(seconds / STEP, 0), last);
    const i = Math.min(Math.floor(at), Math.max(last - 1, 0));
    const a = points[i] ?? points[0];
    const b = points[i + 1] ?? a;
    if (!a || !b) throw new Error('empty glide');
    const f = at - i;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
}
