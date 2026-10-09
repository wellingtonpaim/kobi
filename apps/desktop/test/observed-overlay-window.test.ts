import { Rect } from '@kobi/domain';
import { describe, expect, it, vi } from 'vitest';

import { ObservedOverlayWindow } from '../src/main/observed-overlay-window.js';
import type { PlatformOverlay } from '../src/main/platform-overlay.js';

const rect = (x: number, y: number) => {
  const result = Rect.create({ x, y, width: 300, height: 400 });
  if (!result.ok) throw new Error('bad rect');
  return result.value;
};

const fakeOverlay = (move: () => Promise<void> = () => Promise.resolve()) => {
  const spies = {
    setInteractiveRegion: vi.fn(() => Promise.resolve()),
    reportSilhouette: vi.fn(),
    holdPointer: vi.fn(),
    revealArea: vi.fn(),
    show: vi.fn(() => Promise.resolve()),
  };
  const overlay: PlatformOverlay = {
    bounds: () => Promise.resolve(rect(1, 2)),
    silhouette: () => Promise.resolve(rect(3, 4)),
    moveTo: move,
    ...spies,
  };
  return { overlay, spies };
};

describe('ObservedOverlayWindow', () => {
  it('tells where the window went after every move', async () => {
    const moved = vi.fn();
    const overlay = new ObservedOverlayWindow(fakeOverlay().overlay, moved);

    await overlay.moveTo({ x: 10, y: 20 });

    expect(moved).toHaveBeenCalledWith({ x: 10, y: 20 });
  });

  it('stays quiet when the move failed', async () => {
    const moved = vi.fn();
    const overlay = new ObservedOverlayWindow(
      fakeOverlay(() => Promise.reject(new Error('gone'))).overlay,
      moved,
    );

    await expect(overlay.moveTo({ x: 10, y: 20 })).rejects.toThrow('gone');
    expect(moved).not.toHaveBeenCalled();
  });

  it('passes everything else to the real window', async () => {
    const { overlay: inner, spies } = fakeOverlay();
    const overlay = new ObservedOverlayWindow(inner, vi.fn());

    overlay.reportSilhouette({ x: 0, y: 0, width: 1, height: 1 });
    overlay.holdPointer(true);
    overlay.revealArea({ x: 6, y: 7, width: 8, height: 9 });
    await overlay.setInteractiveRegion([]);
    await overlay.show();

    expect((await overlay.bounds()).x).toBe(1);
    expect((await overlay.silhouette()).x).toBe(3);
    expect(spies.reportSilhouette).toHaveBeenCalled();
    expect(spies.holdPointer).toHaveBeenCalledWith(true);
    expect(spies.revealArea).toHaveBeenCalledWith({ x: 6, y: 7, width: 8, height: 9 });
    expect(spies.setInteractiveRegion).toHaveBeenCalledWith([]);
    expect(spies.show).toHaveBeenCalled();
  });
});
