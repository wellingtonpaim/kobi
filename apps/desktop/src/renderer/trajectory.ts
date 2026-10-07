import type { Point } from '@kobi/domain';

import type { SampledPath } from '../shared/api.js';

/** Qualquer movimento que a janela do Kobi segue quadro a quadro: voo, deslizamento... */
export interface Trajectory {
  readonly duration: number;
  positionAt(seconds: number): Point;
}

/** Trajeto planejado no processo principal, lido com interpolação entre as amostras. */
export const sampledTrajectory = ({ step, points }: SampledPath): Trajectory => ({
  duration: Math.max(0, (points.length - 1) * step),
  positionAt(seconds) {
    const last = points.length - 1;
    const at = Math.min(Math.max(seconds / step, 0), last);
    const i = Math.min(Math.floor(at), Math.max(last - 1, 0));
    const a = points[i];
    const b = points[i + 1] ?? a;
    if (!a || !b) return { x: 0, y: 0 };
    const f = at - i;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  },
});
