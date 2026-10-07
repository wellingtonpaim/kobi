import type { Velocity } from './travel.js';

/**
 * Uma nuvenzinha de poeira, em unidades da cena, relativa ao ponto do chão
 * logo abaixo do Kobi (x para a direita, y para cima).
 */
export interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  opacity: number;
}

const CAPACITY = 48;
const MAX_OPACITY = 0.42;
/**
 * Só arrancadas e freadas fortes levantam poeira (px/s²): voos calmos ficam limpos.
 * A velocidade mínima evita poeira no instante em que o Kobi ainda está parado.
 */
const ACCELERATION_FLOOR = 600;
const ACCELERATION_RANGE = 900;
const SPEED_FULL = 150;
const PUFFS_PER_SECOND = 36;
const DRAG = 2.2;
/** Fração da janela, a partir do centro, em que a poeira começa a sumir antes da borda. */
const EDGE_FADE_START = 0.7;

const fadeNearEdge = (offset: number, half: number): number => {
  const reach = Math.abs(offset) / half;
  return Math.max(0, Math.min(1, (1 - reach) / (1 - EDGE_FADE_START)));
};

/**
 * Poeira de derrapagem: na arrancada fica para trás, na freada é jogada para a
 * frente. Só aparece em voos mais rápidos e é sempre discreta. A poeira fica
 * parada na tela enquanto a janela do Kobi se move, e some antes da borda dela.
 */
export class Dust {
  static readonly capacity = CAPACITY;
  static readonly maxOpacity = MAX_OPACITY;

  private readonly pool: Puff[] = Array.from({ length: CAPACITY }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 0,
    life: 0,
    size: 0,
    opacity: 0,
  }));
  private active: Puff[] = [];
  private lastSpeed = 0;
  private owed = 0;

  constructor(
    private readonly random: () => number = Math.random,
    private readonly reducedMotion = false,
  ) {}

  get puffs(): readonly Puff[] {
    return this.active;
  }

  /**
   * @param velocity velocidade do Kobi na tela, em px/s (y para baixo)
   * @param worldPerPixel quanto um pixel CSS mede na cena
   * @param half meia largura e meia altura da janela do Kobi, em unidades da cena
   */
  update(
    velocity: Velocity,
    elapsedSeconds: number,
    worldPerPixel: number,
    half: { readonly width: number; readonly height: number },
  ): void {
    if (this.reducedMotion || elapsedSeconds <= 0) return;

    const speed = Math.hypot(velocity.x, velocity.y);
    const acceleration = (speed - this.lastSpeed) / elapsedSeconds;
    this.lastSpeed = speed;

    this.age(velocity, elapsedSeconds, worldPerPixel, half);

    const intensity =
      Math.max(0, Math.min(1, (Math.abs(acceleration) - ACCELERATION_FLOOR) / ACCELERATION_RANGE)) *
      Math.min(1, speed / SPEED_FULL);
    if (intensity === 0) {
      this.owed = 0;
      return;
    }

    // Arrancando, a poeira vai para trás; freando, vai para a frente.
    const direction = (velocity.x === 0 ? 1 : Math.sign(velocity.x)) * (acceleration > 0 ? -1 : 1);
    for (this.owed += intensity * PUFFS_PER_SECOND * elapsedSeconds; this.owed >= 1; this.owed--) {
      this.raise(direction, intensity);
    }
  }

  private raise(direction: number, intensity: number): void {
    const puff = this.pool.pop();
    if (!puff) return;
    const r = this.random;
    Object.assign(puff, {
      x: direction * (0.15 + r() * 0.25),
      y: r() * 0.08,
      vx: direction * (0.5 + r() * 0.7) * (0.6 + intensity * 0.4),
      vy: 0.12 + r() * 0.18,
      age: 0,
      life: 0.9 + r() * 0.6,
      size: 0.32 + r() * 0.24,
      opacity: 0,
    });
    this.active.push(puff);
  }

  private age(
    velocity: Velocity,
    dt: number,
    worldPerPixel: number,
    half: { readonly width: number; readonly height: number },
  ): void {
    const drag = Math.exp(-DRAG * dt);
    // A cena acompanha a janela; para a poeira ficar parada na tela, ela anda ao contrário.
    const shiftX = -velocity.x * dt * worldPerPixel;
    const shiftY = velocity.y * dt * worldPerPixel;
    const alive: Puff[] = [];
    for (const puff of this.active) {
      puff.age += dt;
      if (puff.age >= puff.life) {
        this.pool.push(puff);
        continue;
      }
      puff.x += puff.vx * dt + shiftX;
      puff.y += puff.vy * dt + shiftY;
      puff.vx *= drag;
      puff.vy *= drag;
      puff.size += 0.7 * dt;
      const k = puff.age / puff.life;
      const appear = Math.min(1, k / 0.12);
      puff.opacity =
        MAX_OPACITY *
        appear *
        (1 - k) ** 2 *
        fadeNearEdge(puff.x, half.width) *
        fadeNearEdge(puff.y, half.height);
      alive.push(puff);
    }
    this.active = alive;
  }
}
