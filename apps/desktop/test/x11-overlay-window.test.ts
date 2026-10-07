import type { BrowserWindow } from 'electron';
import { describe, expect, it } from 'vitest';

import { X11OverlayWindow } from '../src/main/x11-overlay-window.js';

/** Imita a conversão do Electron: só aceita inteiros de 32 bits (−0 não é um deles no V8). */
const fakeWindow = (): { window: BrowserWindow; positions: [number, number][] } => {
  const positions: [number, number][] = [];
  const isInt32 = (n: number): boolean => Number.isInteger(n) && !Object.is(n, -0) && n === (n | 0);
  const window = {
    setPosition: (x: number, y: number) => {
      if (!isInt32(x) || !isInt32(y)) throw new TypeError('conversion failure');
      positions.push([x, y]);
    },
    getBounds: () => ({ x: 0, y: 0, width: 300, height: 400 }),
  } as unknown as BrowserWindow;
  return { window, positions };
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
});
