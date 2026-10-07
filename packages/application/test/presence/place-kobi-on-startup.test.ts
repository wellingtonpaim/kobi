import { describe, expect, it } from 'vitest';

import { PlaceKobiOnStartup } from '../../src/presence/place-kobi-on-startup.js';
import { layout, rect, display } from '@kobi/domain/testing';
import { FakeDisplaySource, FakeOverlayWindow } from './fakes.js';

describe('PlaceKobiOnStartup', () => {
  it('rests the visible Kobi at the bottom-right of the primary work area, wherever it is', async () => {
    const window = new FakeOverlayWindow(rect(0, 0, 300, 400));
    const displays = new FakeDisplaySource(
      layout(
        display({ id: 'left', bounds: { x: -1920, y: 0, width: 1920, height: 1080 } }),
        display({
          id: 'main',
          bounds: { x: 0, y: 0, width: 1920, height: 1200 },
          workArea: { x: 0, y: 32, width: 1920, height: 1168 },
          primary: true,
        }),
      ),
    );

    await new PlaceKobiOnStartup(window, displays).execute();

    // A silhueta (80, 40, 140×300 dentro da janela) fica a 24 px do canto da área útil.
    expect(window.moves).toEqual([{ x: 1676, y: 836 }]);
  });
});
