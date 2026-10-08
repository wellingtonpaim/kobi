/** Contrato entre a interface (renderer) e o processo principal, exposto pelo preload. */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface CurrentDisplay {
  readonly id: string;
  readonly scaleFactor: number;
  readonly refreshRateHz: number;
}

export interface TourPlan {
  /** Centros das áreas úteis de todos os monitores, na ordem do passeio. */
  readonly stops: readonly ScreenPoint[];
  readonly windowSize: { readonly width: number; readonly height: number };
  readonly start: ScreenPoint;
}

/** Trajeto amostrado em intervalos fixos (posições do canto superior esquerdo da janela). */
export interface SampledPath {
  readonly step: number;
  readonly points: readonly ScreenPoint[];
}

export interface Region {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface KobiBridge {
  moveTo(topLeft: ScreenPoint): void;
  setInteractiveRegion(regions: readonly Region[]): void;
  /** Onde o Kobi aparece dentro da janela; é o que deve caber na tela. */
  setSilhouette(silhouette: Region): void;
  /** O processo principal lê o ponteiro na tela inteira (no Wayland a interface não sabe). */
  dragStart(): void;
  dragMove(): void;
  /** Se o Kobi foi solto em movimento, o deslizamento até ele parar (spec 0005). */
  dragEnd(): Promise<SampledPath | undefined>;
  showMenu(): void;
  planTour(): Promise<TourPlan>;
  onStartTour(listener: () => void): void;
  onToggleDiagnostics(listener: () => void): void;
  onDisplayChanged(listener: (display: CurrentDisplay) => void): void;
  /** Canto superior esquerdo da janela após cada movimento. */
  onWindowMoved(listener: (topLeft: ScreenPoint) => void): void;
}

export const CHANNELS = {
  moveTo: 'kobi:move-to',
  setInteractiveRegion: 'kobi:set-interactive-region',
  setSilhouette: 'kobi:set-silhouette',
  dragStart: 'kobi:drag-start',
  dragMove: 'kobi:drag-move',
  dragEnd: 'kobi:drag-end',
  showMenu: 'kobi:show-menu',
  planTour: 'kobi:plan-tour',
  startTour: 'kobi:start-tour',
  toggleDiagnostics: 'kobi:toggle-diagnostics',
  displayChanged: 'kobi:display-changed',
  windowMoved: 'kobi:window-moved',
} as const;
