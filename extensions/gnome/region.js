// SPDX-License-Identifier: GPL-2.0-or-later
// Regras puras da extensão (sem GNOME), testadas fora do gnome-shell.

/**
 * Se o ponteiro está numa das áreas interativas do Kobi.
 * `frame`: janela na tela; `regions`: [x, y, largura, altura] relativos à janela.
 */
export const pointerInRegions = (frame, regions, [x, y]) =>
  regions.some(
    ([rx, ry, width, height]) =>
      x >= frame.x + rx &&
      x < frame.x + rx + width &&
      y >= frame.y + ry &&
      y < frame.y + ry + height,
  );
