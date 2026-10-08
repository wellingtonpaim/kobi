import { hitRegion, opaqueBounds, type Region } from './hit-region.js';

const CELL_SIZE = 4;
const ALPHA_THRESHOLD = 8;
/** Metade do alfa: a sombra e a poeira, translúcidas, não contam como corpo do Kobi. */
const SOLID_THRESHOLD = 128;
/** 3 células (12 px) de folga: cobre o que os braços e a flutuação andam entre duas amostras. */
const MARGIN = 3;
const INTERVAL_MS = 100;

/** Imagem RGBA reduzida do quadro atual (linhas de cima para baixo), lida sem bloquear; `undefined` se ocupada. */
export type CoverageSource = (
  width: number,
  height: number,
) => Promise<Uint8ClampedArray> | undefined;

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
  /** Estado mais recente: a leitura chega depois, e o Kobi pode ter começado a se mover. */
  private settledNow = true;
  private lastSampleAt = Number.NEGATIVE_INFINITY;
  private lastRegion = '';
  private lastSilhouette = '';

  constructor(
    private readonly source: CoverageSource,
    private readonly listeners: SampleListeners,
    private readonly onError: (error: unknown) => void,
  ) {}

  /**
   * Chamar a cada quadro, depois de desenhar o Kobi. No X11 a forma também recorta
   * o desenho: com `settled` falso (em movimento ou com poeira no ar), a janela
   * inteira fica ativa para nada aparecer cortado entre duas amostras.
   */
  update(nowMs: number, cssWidth: number, cssHeight: number, settled: boolean): void {
    this.settledNow = settled;
    if (!settled) this.publishRegion([{ x: 0, y: 0, width: cssWidth, height: cssHeight }]);
    if (nowMs - this.lastSampleAt < INTERVAL_MS) return;

    const width = Math.ceil(cssWidth / CELL_SIZE);
    const height = Math.ceil(cssHeight / CELL_SIZE);
    const reading = this.source(width, height);
    if (!reading) return;
    this.lastSampleAt = nowMs;
    reading
      .then((data) => {
        this.analyze(data, width, height);
      })
      .catch(this.onError);
  }

  private analyze(data: Uint8ClampedArray, width: number, height: number): void {
    const solid = opaqueBounds(data, width, height, {
      cellSize: CELL_SIZE,
      alphaThreshold: SOLID_THRESHOLD,
    });
    if (solid) this.publishSilhouette(solid);
    if (this.settledNow) {
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
