import type { Point, RectProps } from '@kobi/domain';
import type { BrowserWindow } from 'electron';
import { describe, expect, it } from 'vitest';

import { GnomeShellOverlayWindow } from '../src/main/gnome-shell-overlay-window.js';
import type { OverlayExtension } from '../src/main/overlay-extension.js';

/** Extensão falsa: cada movimento fica pendente até o teste responder, como no D-Bus. */
const fakeExtension = () => {
  const moves: { at: Point; reply: (moved: boolean) => void }[] = [];
  const regions: (readonly RectProps[])[] = [];
  let frame: RectProps | undefined;
  let pointerInside: (inside: boolean) => void = () => undefined;
  const extension: OverlayExtension = {
    version: () => Promise.resolve(2),
    monitors: () => Promise.resolve([]),
    onMonitorsChanged: () => undefined,
    moveTo: (at) =>
      new Promise((resolve) => {
        moves.push({ at, reply: resolve });
      }),
    frame: () => Promise.resolve(frame),
    pointer: () => Promise.resolve({ x: 0, y: 0 }),
    setInteractiveRegion: (r) => {
      regions.push(r);
      return Promise.resolve(true);
    },
    onPointerInside: (listener) => {
      pointerInside = listener;
    },
  };
  return {
    extension,
    moves,
    regions,
    setFrame: (f: RectProps | undefined) => {
      frame = f;
    },
    pointer: (inside: boolean) => {
      pointerInside(inside);
    },
  };
};

const fakeWindow = () => {
  const ignoring: boolean[] = [];
  let shown = false;
  const window = {
    getBounds: () => ({ x: 0, y: 0, width: 300, height: 400 }),
    setIgnoreMouseEvents: (ignore: boolean) => ignoring.push(ignore),
    showInactive: () => {
      shown = true;
    },
  } as unknown as BrowserWindow;
  return { window, ignoring, isShown: () => shown };
};

/** Janela já visível para o compositor: o caso comum depois da abertura. */
const setup = async () => {
  const ext = fakeExtension();
  const win = fakeWindow();
  const overlay = new GnomeShellOverlayWindow(win.window, ext.extension, { pollMs: 1 });
  ext.setFrame({ x: 0, y: 0, width: 300, height: 400 });
  await overlay.show();
  ext.setFrame(undefined);
  return { ...ext, ...win, overlay };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('GnomeShellOverlayWindow', () => {
  it('asks the extension to move the window to whole pixels', async () => {
    const { overlay, moves } = await setup();

    const moving = overlay.moveTo({ x: 10.6, y: -0.3 });
    moves[0]?.reply(true);
    await moving;

    expect(moves.map((m) => m.at)).toEqual([{ x: 11, y: 0 }]);
  });

  it('never queues moves: while one is in flight, only the latest position is sent next', async () => {
    const { overlay, moves } = await setup();

    const first = overlay.moveTo({ x: 1, y: 1 });
    const second = overlay.moveTo({ x: 2, y: 2 });
    const third = overlay.moveTo({ x: 3, y: 3 });
    moves[0]?.reply(true);
    await flush();
    moves[1]?.reply(true);
    await Promise.all([first, second, third]);

    expect(moves.map((m) => m.at)).toEqual([
      { x: 1, y: 1 },
      { x: 3, y: 3 },
    ]);
  });

  it('refuses a position that is not a number', async () => {
    const { overlay, moves } = await setup();

    await expect(overlay.moveTo({ x: Number.NaN, y: 0 })).rejects.toThrow('invalid position');
    expect(moves).toEqual([]);
  });

  it('fails when the window is not known to the compositor', async () => {
    const { overlay, moves } = await setup();

    const moving = overlay.moveTo({ x: 5, y: 5 });
    moves[0]?.reply(false);

    await expect(moving).rejects.toThrow('not found');
  });

  it('knows where the window is from the compositor', async () => {
    const { overlay, setFrame } = await setup();
    setFrame({ x: -1920, y: 120, width: 300, height: 400 });

    expect((await overlay.bounds()).x).toBe(-1920);
  });

  it('falls back to the last position it asked for when the compositor has no answer', async () => {
    const { overlay, moves } = await setup();
    const moving = overlay.moveTo({ x: 40, y: 50 });
    moves[0]?.reply(true);
    await moving;

    const bounds = await overlay.bounds();

    expect([bounds.x, bounds.y, bounds.width, bounds.height]).toEqual([40, 50, 300, 400]);
  });

  it('places the silhouette inside the window', async () => {
    const { overlay, setFrame } = await setup();
    setFrame({ x: 100, y: 200, width: 300, height: 400 });
    overlay.reportSilhouette({ x: 80, y: 60, width: 140, height: 220 });

    const silhouette = await overlay.silhouette();

    expect([silhouette.x, silhouette.y, silhouette.width, silhouette.height]).toEqual([
      180, 260, 140, 220,
    ]);
  });

  it('hands the interactive region to the extension', async () => {
    const { overlay, regions } = await setup();

    await overlay.setInteractiveRegion([{ x: 1, y: 2, width: 3, height: 4 }]);

    expect(regions).toEqual([[{ x: 1, y: 2, width: 3, height: 4 }]]);
  });

  it('lets clicks through only while the pointer is outside the Kobi', async () => {
    const { pointer, ignoring } = await setup();

    pointer(false);
    pointer(true);

    expect(ignoring).toEqual([true, false]);
  });

  it('keeps the mouse while the Kobi is held, even if the pointer slips out of him', async () => {
    const { overlay, pointer, ignoring } = await setup();
    pointer(true);

    overlay.holdPointer(true);
    pointer(false);
    expect(ignoring).toEqual([]);

    overlay.holdPointer(false);
    expect(ignoring).toEqual([true]);
  });

  describe('before the compositor knows the window', () => {
    const unseen = () => {
      const ext = fakeExtension();
      const win = fakeWindow();
      const overlay = new GnomeShellOverlayWindow(win.window, ext.extension, {
        pollMs: 1,
        timeoutMs: 20,
      });
      return { ...ext, ...win, overlay };
    };

    it('keeps the startup position and applies it once the window appears', async () => {
      const { overlay, moves, setFrame, isShown } = unseen();

      await overlay.moveTo({ x: 70, y: 80 });
      expect(moves).toEqual([]);

      const showing = overlay.show();
      expect(isShown()).toBe(true);
      setFrame({ x: 0, y: 0, width: 300, height: 400 });
      await flush();
      await flush();
      moves[0]?.reply(true);
      await showing;

      expect(moves.map((m) => m.at)).toEqual([{ x: 70, y: 80 }]);
    });

    it('gives up when the window never shows up for the compositor', async () => {
      const { overlay } = unseen();

      await expect(overlay.show()).rejects.toThrow('never appeared');
    });
  });
});
