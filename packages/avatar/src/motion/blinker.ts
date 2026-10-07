const FIRST_BLINK_AT = 2.5;
const CLOSING_SECONDS = 0.14;
const BLINK_SECONDS = 0.3;
const SPEED = 7;
const CLOSED = 0.12;

/** Piscar com ritmo natural do v6: abertura dos olhos (0 a 1) em função do tempo. */
export class Blinker {
  private nextBlinkAt = FIRST_BLINK_AT;

  constructor(
    private readonly random: () => number = Math.random,
    private readonly reducedMotion = false,
  ) {}

  openness(elapsedSeconds: number): number {
    if (this.reducedMotion || elapsedSeconds <= this.nextBlinkAt) return 1;

    const k = elapsedSeconds - this.nextBlinkAt;
    if (k > BLINK_SECONDS) this.nextBlinkAt = elapsedSeconds + 2.5 + this.random() * 3;

    return k < CLOSING_SECONDS
      ? Math.max(CLOSED, 1 - k * SPEED)
      : Math.min(1, CLOSED + (k - CLOSING_SECONDS) * SPEED);
  }
}
