import {
  Display,
  DisplayLayout,
  type InvalidDisplay,
  type InvalidLayout,
  ok,
  Rect,
  type Result,
} from '@kobi/domain';

/** O que o adaptador lê de cada monitor na API `screen` do Electron. */
export interface SystemDisplay {
  readonly id: number | string;
  readonly bounds: { x: number; y: number; width: number; height: number };
  readonly workArea: { x: number; y: number; width: number; height: number };
  readonly scaleFactor: number;
  /** O Electron informa 0 quando o sistema não sabe a taxa de atualização. */
  readonly displayFrequency: number;
}

/** Sem a taxa informada, supõe 60 Hz em vez de falhar (degradação graciosa). */
const UNKNOWN_REFRESH_FALLBACK = 60;

export type MappingError = InvalidDisplay | InvalidLayout | { readonly kind: 'invalid-rect' };

/** Camada anticorrupção: traduz os monitores do Electron para o domínio. */
export const toDisplayLayout = (
  displays: readonly SystemDisplay[],
  primaryId: number | string,
): Result<DisplayLayout, MappingError> => {
  const mapped: Display[] = [];
  for (const d of displays) {
    const bounds = Rect.create(d.bounds);
    const workArea = Rect.create(d.workArea);
    if (!bounds.ok || !workArea.ok) return { ok: false, error: { kind: 'invalid-rect' } };

    const display = Display.create({
      id: String(d.id),
      bounds: bounds.value,
      workArea: workArea.value,
      scaleFactor: d.scaleFactor,
      refreshRateHz: d.displayFrequency > 0 ? d.displayFrequency : UNKNOWN_REFRESH_FALLBACK,
      primary: d.id === primaryId,
    });
    if (!display.ok) return display;
    mapped.push(display.value);
  }
  const layout = DisplayLayout.create(mapped);
  return layout.ok ? ok(layout.value) : layout;
};
