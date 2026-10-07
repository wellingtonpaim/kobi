import { hitRegion, type Region } from './hit-region.js';

const CELL_SIZE = 4;
const ALPHA_THRESHOLD = 8;
/** 3 células (12 px) de folga: cobre o que os braços e a flutuação andam entre duas amostras. */
const MARGIN = 3;
const INTERVAL_MS = 100;

/**
 * Lê, algumas vezes por segundo, uma versão reduzida da imagem do Kobi e informa
 * onde ele está visível. Só envia quando a região muda.
 */
export class HitSampler {
  private readonly sample = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private lastSampleAt = Number.NEGATIVE_INFINITY;
  private lastRegion = '';

  constructor(
    private readonly source: HTMLCanvasElement,
    private readonly publish: (regions: readonly Region[]) => void,
  ) {
    const context = this.sample.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('2D canvas unavailable');
    this.context = context;
  }

  /**
   * Chamar a cada quadro, depois de desenhar o Kobi. No X11 a forma também recorta
   * o desenho: com `settled` falso (em movimento ou com poeira no ar), a janela
   * inteira fica ativa para nada aparecer cortado entre duas amostras.
   */
  update(nowMs: number, cssWidth: number, cssHeight: number, settled: boolean): void {
    if (!settled) {
      this.publishIfChanged([{ x: 0, y: 0, width: cssWidth, height: cssHeight }]);
      this.lastSampleAt = Number.NEGATIVE_INFINITY;
      return;
    }
    if (nowMs - this.lastSampleAt < INTERVAL_MS) return;
    this.lastSampleAt = nowMs;

    const width = Math.ceil(cssWidth / CELL_SIZE);
    const height = Math.ceil(cssHeight / CELL_SIZE);
    if (this.sample.width !== width || this.sample.height !== height) {
      this.sample.width = width;
      this.sample.height = height;
    }
    this.context.clearRect(0, 0, width, height);
    this.context.drawImage(this.source, 0, 0, width, height);
    const { data } = this.context.getImageData(0, 0, width, height);
    const regions = hitRegion(data, width, height, {
      cellSize: CELL_SIZE,
      alphaThreshold: ALPHA_THRESHOLD,
      margin: MARGIN,
    });

    this.publishIfChanged(regions);
  }

  private publishIfChanged(regions: readonly Region[]): void {
    const key = JSON.stringify(regions);
    if (key === this.lastRegion) return;
    this.lastRegion = key;
    this.publish(regions);
  }
}
