import type { BrowserWindow } from 'electron';
import { describe, expect, it } from 'vitest';

import { X11OverlayWindow } from '../src/main/x11-overlay-window.js';

/** Imita a conversão do Electron: só aceita inteiros de 32 bits (−0 não é um deles no V8). */
const fakeWindow = () => {
  const positions: [number, number][] = [];
  const shapes: { x: number; y: number; width: number; height: number }[][] = [];
  const isInt32 = (n: number): boolean => Number.isInteger(n) && !Object.is(n, -0) && n === (n | 0);
  const window = {
    setPosition: (x: number, y: number) => {
      if (!isInt32(x) || !isInt32(y)) throw new TypeError('conversion failure');
      positions.push([x, y]);
    },
    getBounds: () => ({ x: 0, y: 0, width: 300, height: 400 }),
    setShape: (rects: { x: number; y: number; width: number; height: number }[]) => {
      shapes.push(rects);
    },
  } as unknown as BrowserWindow;
  return { window, positions, shapes };
};

describe('X11OverlayWindow', () => {
  it('rounds positions to whole pixels', async () => {
    const { window, positions } = fakeWindow();

    await new X11OverlayWindow(window).moveTo({ x: 10.6, y: -3.2 });

    expect(positions).toEqual([[11, -3]]);
  });

  it('moves to the left edge of the leftmost monitor (x near zero rounds to −0)', async () => {
    const { window, positions } = fakeWindow();

    await new X11OverlayWindow(window).moveTo({ x: -0.3, y: -0.4 });

    expect(positions).toEqual([[0, 0]]);
  });

  it('refuses a position that is not a number instead of crashing the app', async () => {
    const { window, positions } = fakeWindow();

    await expect(new X11OverlayWindow(window).moveTo({ x: Number.NaN, y: 0 })).rejects.toThrow(
      'invalid position',
    );
    expect(positions).toEqual([]);
  });

  it('lets the mouse reach the window only over the Kobi', async () => {
    const { window, shapes } = fakeWindow();

    await new X11OverlayWindow(window).setInteractiveRegion([
      { x: 10.4, y: 20, width: 30, height: 40 },
    ]);

    expect(shapes).toEqual([[{ x: 10, y: 20, width: 30, height: 40 }]]);
  });

  it('opens the whole window while the Kobi is held, so a fast throw never loses the release', async () => {
    const { window, shapes } = fakeWindow();
    const overlay = new X11OverlayWindow(window);
    const kobi = { x: 10, y: 20, width: 30, height: 40 };
    await overlay.setInteractiveRegion([kobi]);

    overlay.holdPointer(true);
    await overlay.setInteractiveRegion([{ x: 0, y: 0, width: 1, height: 1 }]);
    expect(shapes.at(-1)).toEqual([{ x: 0, y: 0, width: 300, height: 400 }]);

    overlay.holdPointer(false);
    expect(shapes.at(-1)).toEqual([{ x: 0, y: 0, width: 1, height: 1 }]);
  });

  it('keeps the diagnostics panel visible, since the X11 shape also clips what is drawn', async () => {
    const { window, shapes } = fakeWindow();
    const overlay = new X11OverlayWindow(window);
    const kobi = { x: 10, y: 20, width: 30, height: 40 };
    const panel = { x: 6, y: 330, width: 250.5, height: 64 };
    await overlay.setInteractiveRegion([kobi]);

    overlay.revealArea(panel);
    expect(shapes.at(-1)).toEqual([kobi, { x: 6, y: 330, width: 251, height: 64 }]);

    await overlay.setInteractiveRegion([{ x: 0, y: 0, width: 1, height: 1 }]);
    expect(shapes.at(-1)).toEqual([
      { x: 0, y: 0, width: 1, height: 1 },
      { x: 6, y: 330, width: 251, height: 64 },
    ]);

    overlay.revealArea(undefined);
    expect(shapes.at(-1)).toEqual([{ x: 0, y: 0, width: 1, height: 1 }]);
  });
});
