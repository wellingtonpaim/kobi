import type { Point } from './rect.js';

export interface FlightOptions {
  /** Velocidade de pico, em pixels lógicos por segundo. */
  readonly maxSpeed: number;
  readonly minDuration: number;
  readonly maxDuration: number;
  /** Maior desvio lateral da ondulação, em pixels lógicos. */
  readonly maxWobble: number;
}

const DEFAULTS: FlightOptions = { maxSpeed: 700, minDuration: 0.8, maxDuration: 5, maxWobble: 28 };

/** Pico da derivada do perfil de jerk mínimo, atingido no meio do trajeto. */
const PEAK_RATE = 1.875;
/** Ondulação nunca passa desta fração da distância, para saltos curtos não parecerem tortos. */
const WOBBLE_PER_DISTANCE = 0.1;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Perfil de jerk mínimo: parte e chega com velocidade e aceleração zero. */
const progress = (u: number): number => u ** 3 * (10 - 15 * u + 6 * u ** 2);
const progressRate = (u: number): number => 30 * u ** 2 * (1 - u) ** 2;

/** Uma onda lateral completa, nula (e sem velocidade) nas pontas. */
const wobble = (u: number): number => Math.sin(Math.PI * u) * Math.sin(2 * Math.PI * u);
const wobbleRate = (u: number): number =>
  Math.PI * Math.cos(Math.PI * u) * Math.sin(2 * Math.PI * u) +
  2 * Math.PI * Math.sin(Math.PI * u) * Math.cos(2 * Math.PI * u);

/**
 * Voo flutuante do Kobi entre dois pontos, em qualquer direção: acelera e freia
 * suavemente e ondula de leve para os lados. Posição e velocidade dependem só do
 * tempo desde a partida, nunca da taxa de quadros.
 */
export class Flight {
  static readonly defaults = DEFAULTS;

  private constructor(
    private readonly from: Point,
    private readonly to: Point,
    readonly duration: number,
    private readonly amplitude: number,
  ) {}

  static between(from: Point, to: Point, options: Partial<FlightOptions> = {}): Flight {
    const { maxSpeed, minDuration, maxDuration, maxWobble } = { ...DEFAULTS, ...options };
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (distance === 0) return new Flight(from, to, 0, 0);

    const duration = clamp((PEAK_RATE * distance) / maxSpeed, minDuration, maxDuration);
    return new Flight(from, to, duration, Math.min(maxWobble, distance * WOBBLE_PER_DISTANCE));
  }

  positionAt(seconds: number): Point {
    if (this.duration === 0) return this.to;
    const u = clamp(seconds / this.duration, 0, 1);
    return this.combine(progress(u), this.amplitude * wobble(u), this.from);
  }

  /** Velocidade em pixels lógicos por segundo; zero antes da partida e depois da chegada. */
  velocityAt(seconds: number): Point {
    if (seconds < 0 || seconds >= this.duration) return { x: 0, y: 0 };
    const u = seconds / this.duration;
    const along = progressRate(u) / this.duration;
    const sideways = (this.amplitude * wobbleRate(u)) / this.duration;
    return this.combine(along, sideways, { x: 0, y: 0 });
  }

  /** origem + avanço ao longo do trajeto + desvio na perpendicular. */
  private combine(along: number, sideways: number, origin: Point): Point {
    const dx = this.to.x - this.from.x;
    const dy = this.to.y - this.from.y;
    const length = Math.hypot(dx, dy);
    return {
      x: origin.x + dx * along - (dy / length) * sideways,
      y: origin.y + dy * along + (dx / length) * sideways,
    };
  }
}
