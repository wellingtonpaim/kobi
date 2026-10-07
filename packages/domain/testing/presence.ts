import { Display, type DisplayProps } from '../src/presence/display.js';
import { DisplayLayout } from '../src/presence/display-layout.js';
import { Rect, type RectProps } from '../src/presence/rect.js';

export const rect = (x: number, y: number, width: number, height: number): Rect => {
  const result = Rect.create({ x, y, width, height });
  if (!result.ok) throw new Error(`invalid rect in test: ${JSON.stringify(result.error)}`);
  return result.value;
};

interface DisplaySpec extends Omit<Partial<DisplayProps>, 'bounds' | 'workArea'> {
  readonly bounds: RectProps;
  readonly workArea?: RectProps;
}

export const display = ({ bounds, workArea, ...rest }: DisplaySpec): Display => {
  const result = Display.create({
    id: rest.id ?? `${String(bounds.x)},${String(bounds.y)}`,
    bounds: rect(bounds.x, bounds.y, bounds.width, bounds.height),
    workArea: workArea
      ? rect(workArea.x, workArea.y, workArea.width, workArea.height)
      : rect(bounds.x, bounds.y, bounds.width, bounds.height),
    scaleFactor: rest.scaleFactor ?? 1,
    refreshRateHz: rest.refreshRateHz ?? 60,
    primary: rest.primary ?? false,
  });
  if (!result.ok) throw new Error(`invalid display in test: ${JSON.stringify(result.error)}`);
  return result.value;
};

export const layout = (...displays: Display[]): DisplayLayout => {
  const result = DisplayLayout.create(displays);
  if (!result.ok) throw new Error(`invalid layout in test: ${JSON.stringify(result.error)}`);
  return result.value;
};

/** Cenários da matriz de testes da spec 0002. */
export const scenarios = {
  single: () =>
    layout(
      display({ id: 'laptop', bounds: { x: 0, y: 0, width: 1920, height: 1200 }, primary: true }),
    ),

  /** Ambiente de referência: três monitores desalinhados em 120 px, 100/60/100 Hz. */
  reference: () =>
    layout(
      display({
        id: 'DVI-I-2',
        bounds: { x: 0, y: 120, width: 1920, height: 1080 },
        refreshRateHz: 100,
      }),
      display({
        id: 'eDP-1',
        bounds: { x: 1920, y: 0, width: 1920, height: 1200 },
        workArea: { x: 1920, y: 32, width: 1920, height: 1168 },
        primary: true,
      }),
      display({
        id: 'HDMI-1',
        bounds: { x: 3840, y: 120, width: 1920, height: 1080 },
        refreshRateHz: 100,
      }),
    ),

  /** Monitor externo acima do notebook. */
  stacked: () =>
    layout(
      display({ id: 'top', bounds: { x: 0, y: 0, width: 2560, height: 1440 } }),
      display({
        id: 'bottom',
        bounds: { x: 320, y: 1440, width: 1920, height: 1080 },
        primary: true,
      }),
    ),

  /** Principal à direita: o monitor da esquerda tem coordenadas negativas. */
  negative: () =>
    layout(
      display({ id: 'left', bounds: { x: -1920, y: -200, width: 1920, height: 1080 } }),
      display({ id: 'main', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, primary: true }),
    ),

  /** Vão de 500 px entre dois monitores. */
  gap: () =>
    layout(
      display({ id: 'a', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, primary: true }),
      display({ id: 'b', bounds: { x: 2420, y: 0, width: 1920, height: 1080 } }),
    ),

  /** Notebook com escala 150% ao lado de monitor a 100% (coordenadas lógicas). */
  mixedScale: () =>
    layout(
      display({
        id: 'hidpi',
        bounds: { x: 0, y: 0, width: 1707, height: 1067 },
        scaleFactor: 1.5,
        primary: true,
      }),
      display({
        id: 'lodpi',
        bounds: { x: 1707, y: 0, width: 1920, height: 1080 },
        scaleFactor: 1,
      }),
    ),

  /** Quatro monitores 4K a 200%, em grade 2×2, 144 Hz. */
  fourByFourK: () =>
    layout(
      display({
        id: 'tl',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        scaleFactor: 2,
        refreshRateHz: 144,
        primary: true,
      }),
      display({
        id: 'tr',
        bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
        scaleFactor: 2,
        refreshRateHz: 144,
      }),
      display({
        id: 'bl',
        bounds: { x: 0, y: 1080, width: 1920, height: 1080 },
        scaleFactor: 2,
        refreshRateHz: 144,
      }),
      display({
        id: 'br',
        bounds: { x: 1920, y: 1080, width: 1920, height: 1080 },
        scaleFactor: 2,
        refreshRateHz: 144,
      }),
    ),
} satisfies Record<string, () => DisplayLayout>;
