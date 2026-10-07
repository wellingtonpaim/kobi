import { err, ok, type Result } from '../shared/result.js';
import type { Rect } from './rect.js';

export interface DisplayProps {
  readonly id: string;
  /** Área do monitor na área de trabalho global, em pixels lógicos. */
  readonly bounds: Rect;
  /** Parte dos `bounds` livre de painéis e docks do sistema. */
  readonly workArea: Rect;
  readonly scaleFactor: number;
  readonly refreshRateHz: number;
  readonly primary: boolean;
}

export type InvalidDisplay =
  | { readonly kind: 'invalid-display-id' }
  | { readonly kind: 'invalid-scale-factor'; readonly value: number }
  | { readonly kind: 'invalid-refresh-rate'; readonly value: number }
  | { readonly kind: 'work-area-outside-bounds' };

const isPositive = (value: number): boolean => Number.isFinite(value) && value > 0;

const fitsInside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.right <= outer.right &&
  inner.bottom <= outer.bottom;

/** Um monitor como o sistema o informa; nenhuma propriedade é suposta. */
export class Display implements DisplayProps {
  private constructor(
    readonly id: string,
    readonly bounds: Rect,
    readonly workArea: Rect,
    readonly scaleFactor: number,
    readonly refreshRateHz: number,
    readonly primary: boolean,
  ) {}

  static create(props: DisplayProps): Result<Display, InvalidDisplay> {
    const { id, bounds, workArea, scaleFactor, refreshRateHz, primary } = props;

    if (id.trim() === '') return err({ kind: 'invalid-display-id' });
    if (!isPositive(scaleFactor)) return err({ kind: 'invalid-scale-factor', value: scaleFactor });
    if (!isPositive(refreshRateHz))
      return err({ kind: 'invalid-refresh-rate', value: refreshRateHz });
    if (!fitsInside(workArea, bounds)) return err({ kind: 'work-area-outside-bounds' });

    return ok(new Display(id, bounds, workArea, scaleFactor, refreshRateHz, primary));
  }
}
