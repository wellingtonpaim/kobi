export interface Velocity {
  readonly x: number;
  readonly y: number;
}

/** Velocidade (px/s) a partir da qual o Kobi já está totalmente virado para onde vai. */
const FULL_TURN_SPEED = 120;
const PROFILE = Math.PI / 2;

/**
 * Para onde o Kobi vira enquanto se desloca: de perfil indo para os lados, de
 * frente na vertical, um meio-termo na diagonal. `weight` diz quanto o giro do
 * movimento domina a pose de repouso (0 parado, 1 em velocidade de cruzeiro).
 */
export const travelHeading = ({ x, y }: Velocity): { yaw: number; weight: number } => {
  const speed = Math.hypot(x, y);
  if (speed === 0) return { yaw: 0, weight: 0 };
  return { yaw: PROFILE * (x / speed), weight: Math.min(1, speed / FULL_TURN_SPEED) };
};

/** Mistura a pose de repouso com a direção do movimento, sempre pelo caminho mais curto. */
export const blendTurn = (rest: number, heading: number, weight: number): number => {
  const shortest =
    ((((heading - rest + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return rest + weight * shortest;
};

const STEP = 1 / 240;
const STIFFNESS = (2 * Math.PI * 1.1) ** 2;
const DAMPING = 2 * 0.3 * 2 * Math.PI * 1.1;
const LEAN_PER_SPEED = 1.1e-4;
const LEAN_PER_ACCELERATION = 2.8e-4;
const MAX_LEAN = 0.3;

const clamp = (value: number, limit: number): number => Math.max(-limit, Math.min(limit, value));

/**
 * Inclinação em pêndulo com a base fixa: a cabeça vai à frente ao acelerar, para
 * trás ao frear, e oscila amortecida até ficar reta. Integra uma mola em passos
 * fixos, então o resultado não depende da taxa de quadros.
 */
export class Pendulum {
  static readonly maxLean = MAX_LEAN;

  private angle = 0;
  private rate = 0;
  private lastSpeed = 0;
  private pending = 0;

  constructor(private readonly reducedMotion = false) {}

  /** `forwardSpeed` em px/s na direção para onde o Kobi está virado; devolve o ângulo em radianos. */
  update(forwardSpeed: number, elapsedSeconds: number): number {
    if (this.reducedMotion || elapsedSeconds <= 0) return this.reducedMotion ? 0 : this.angle;

    const acceleration = (forwardSpeed - this.lastSpeed) / elapsedSeconds;
    this.lastSpeed = forwardSpeed;
    const target = clamp(
      LEAN_PER_SPEED * forwardSpeed + LEAN_PER_ACCELERATION * acceleration,
      MAX_LEAN,
    );

    for (this.pending += elapsedSeconds; this.pending >= STEP; this.pending -= STEP) {
      this.rate += (-STIFFNESS * (this.angle - target) - DAMPING * this.rate) * STEP;
      this.angle = clamp(this.angle + this.rate * STEP, MAX_LEAN);
    }
    return this.angle;
  }
}
