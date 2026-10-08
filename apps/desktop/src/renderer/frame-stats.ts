export interface Percentiles {
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly max: number;
}

export interface FrameSummary {
  readonly frames: number;
  /** Intervalos mais longos que 1,5 atualização do monitor: quadros que o usuário viu repetidos. */
  readonly dropped: number;
  /** Tempo entre quadros (ms): é o que mostra engasgos. */
  readonly interval: Percentiles;
  /** Tempo gasto desenhando cada quadro (ms). */
  readonly render: Percentiles;
}

const percentiles = (values: readonly number[]): Percentiles => {
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (q: number): number => sorted[Math.floor(q * (sorted.length - 1))] ?? 0;
  return { p50: pick(0.5), p95: pick(0.95), p99: pick(0.99), max: sorted.at(-1) ?? 0 };
};

/** Fluidez da animação por período (painel de diagnóstico e medições da spec 0002). */
export class FrameStats {
  private intervals: number[] = [];
  private renders: number[] = [];
  private lastFrameAt: number | undefined;

  add(frameAtMs: number, renderMs: number): void {
    if (this.lastFrameAt !== undefined) this.intervals.push(frameAtMs - this.lastFrameAt);
    this.lastFrameAt = frameAtMs;
    this.renders.push(renderMs);
  }

  /** Resume o período e começa outro. */
  take(refreshRateHz: number): FrameSummary {
    const limit = 1.5 * (1000 / refreshRateHz);
    const summary: FrameSummary = {
      frames: this.renders.length,
      dropped: this.intervals.filter((ms) => ms > limit).length,
      interval: percentiles(this.intervals),
      render: percentiles(this.renders),
    };
    this.intervals = [];
    this.renders = [];
    return summary;
  }
}
