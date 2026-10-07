import { hitRegion, opaqueBounds, type Region } from './hit-region.js';

const CELL_SIZE = 4;
const ALPHA_THRESHOLD = 8;
/** Metade do alfa: a sombra e a poeira, translúcidas, não contam como corpo do Kobi. */
const SOLID_THRESHOLD = 128;
/** 3 células (12 px) de folga: cobre o que os braços e a flutuação andam entre duas amostras. */
const MARGIN = 3;
const INTERVAL_MS = 100;

export interface SampleListeners {
  /** Áreas da janela que recebem o mouse. */
  readonly region: (regions: readonly Region[]) => void;
  /** Onde o Kobi é sólido dentro da janela; é o que deve caber na tela. */
  readonly silhouette: (silhouette: Region) => void;
}

/**
 * Lê, algumas vezes por segundo, uma versão reduzida da imagem do Kobi e informa
 * onde ele está visível e onde é sólido. Só envia o que mudou.
 */
export class HitSampler {
  private readonly sample = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private lastSampleAt = Number.NEGATIVE_INFINITY;
  private lastRegion = '';
  private lastSilhouette = '';

  constructor(
    private readonly source: HTMLCanvasElement,
    private readonly listeners: SampleListeners,
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
    if (!settled) this.publishRegion([{ x: 0, y: 0, width: cssWidth, height: cssHeight }]);
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

    const solid = opaqueBounds(data, width, height, {
      cellSize: CELL_SIZE,
      alphaThreshold: SOLID_THRESHOLD,
    });
    if (solid) this.publishSilhouette(solid);
    if (settled) {
      this.publishRegion(
        hitRegion(data, width, height, {
          cellSize: CELL_SIZE,
          alphaThreshold: ALPHA_THRESHOLD,
          margin: MARGIN,
        }),
      );
    }
  }

  private publishRegion(regions: readonly Region[]): void {
    const key = JSON.stringify(regions);
    if (key === this.lastRegion) return;
    this.lastRegion = key;
    this.listeners.region(regions);
  }

  private publishSilhouette(silhouette: Region): void {
    const key = JSON.stringify(silhouette);
    if (key === this.lastSilhouette) return;
    this.lastSilhouette = key;
    this.listeners.silhouette(silhouette);
  }
}
