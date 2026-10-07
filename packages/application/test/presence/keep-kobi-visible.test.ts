import { describe, expect, it } from 'vitest';

import { KeepKobiVisible } from '../../src/presence/keep-kobi-visible.js';
import { display, layout, rect, scenarios } from '@kobi/domain/testing';
import { FakeDisplaySource, FakeOverlayWindow } from './fakes.js';

describe('KeepKobiVisible', () => {
  it('does not move a Kobi that is already visible', async () => {
    const window = new FakeOverlayWindow(rect(5000, 500, 300, 400));

    await new KeepKobiVisible(window, new FakeDisplaySource(scenarios.reference())).execute();

    expect(window.moves).toEqual([]);
  });

  it('brings the Kobi back when the monitor it was on is disconnected', async () => {
    const window = new FakeOverlayWindow(rect(5000, 500, 300, 400));
    const displays = new FakeDisplaySource(scenarios.reference());
    const keepVisible = new KeepKobiVisible(window, displays);
    displays.onChange(() => void keepVisible.execute());

    displays.change(
      layout(
        display({ id: 'DVI-I-2', bounds: { x: 0, y: 120, width: 1920, height: 1080 } }),
        display({
          id: 'eDP-1',
          bounds: { x: 1920, y: 0, width: 1920, height: 1200 },
          primary: true,
        }),
      ),
    );
    await Promise.resolve();
    await Promise.resolve();

    // A silhueta encosta na borda direita do notebook (3840).
    expect(window.moves).toEqual([{ x: 3620, y: 500 }]);
  });

  it('rescues a Kobi dropped in the gap between monitors', async () => {
    const window = new FakeOverlayWindow(rect(2050, 100, 300, 400));

    await new KeepKobiVisible(window, new FakeDisplaySource(scenarios.gap())).execute();

    // A silhueta encosta no começo do monitor da direita (2420).
    expect(window.moves).toEqual([{ x: 2340, y: 100 }]);
  });
});
