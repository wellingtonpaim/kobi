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

const CAPACITY = 96;
const MAX_OPACITY = 0.6;
/**
 * Só arrancadas e freadas fortes levantam poeira (px/s²): voos calmos ficam limpos.
 * A velocidade mínima evita poeira no instante em que o Kobi ainda está parado.
 */
const ACCELERATION_FLOOR = 250;
const ACCELERATION_RANGE = 700;
const SPEED_FULL = 150;
const PUFFS_PER_SECOND = 70;
const DRAG = 2.2;
/** Faixa (unidades da cena) em que uma nuvenzinha se desfaz antes de tocar a borda da janela. */
const EDGE_FADE = 0.6;

/** Limites da janela do Kobi em unidades da cena, a partir do ponto do chão sob ele. */
export interface DustBounds {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly top: number;
}

/**
 * 1 longe das bordas e 0 antes que qualquer parte da nuvenzinha (não só o centro)
 * chegue à borda da janela: a poeira nunca aparece cortada.
 */
const edgeFade = (puff: Puff, bounds: DustBounds): number => {
  const radius = puff.size / 2;
  const room = Math.min(
    puff.x - bounds.left,
    bounds.right - puff.x,
    puff.y - bounds.bottom,
    bounds.top - puff.y,
  );
  return Math.max(0, Math.min(1, (room - radius) / EDGE_FADE));
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
   * @param bounds limites da janela do Kobi, em unidades da cena
   */
  update(
    velocity: Velocity,
    elapsedSeconds: number,
    worldPerPixel: number,
    bounds: DustBounds,
  ): void {
    if (this.reducedMotion || elapsedSeconds <= 0) return;

    const speed = Math.hypot(velocity.x, velocity.y);
    const acceleration = (speed - this.lastSpeed) / elapsedSeconds;
    this.lastSpeed = speed;

    this.age(velocity, elapsedSeconds, worldPerPixel, bounds);

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
      x: direction * (0.1 + r() * 0.5),
      y: r() * 0.12,
      vx: direction * (0.5 + r() * 0.7) * (0.6 + intensity * 0.4),
      vy: 0.12 + r() * 0.18,
      age: 0,
      life: 0.9 + r() * 0.6,
      size: 0.45 + r() * 0.35,
      opacity: 0,
    });
    this.active.push(puff);
  }

  private age(velocity: Velocity, dt: number, worldPerPixel: number, bounds: DustBounds): void {
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
      puff.size += 0.9 * dt;
      const k = puff.age / puff.life;
      const appear = Math.min(1, k / 0.12);
      puff.opacity = MAX_OPACITY * appear * (1 - k) ** 2 * edgeFade(puff, bounds);
      alive.push(puff);
    }
    this.active = alive;
  }
}
