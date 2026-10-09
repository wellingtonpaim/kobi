import { scenarios, rect } from '@kobi/domain/testing';
import { describe, expect, it } from 'vitest';

import { ReleaseKobi } from '../../src/presence/release-kobi.js';
import { FakeDisplaySource, FakeOverlayWindow } from './fakes.js';

describe('ReleaseKobi', () => {
  it('plans the glide from where the Kobi was released, inside the current monitors', async () => {
    const window = new FakeOverlayWindow(rect(100, 500, 300, 400));
    const displays = new FakeDisplaySource(scenarios.reference());

    const glide = await new ReleaseKobi(window, displays).execute({ x: 4500, y: 0 });

    expect(glide?.positionAt(0)).toEqual({ x: 100, y: 500 });
    const end = glide?.positionAt(glide.duration) ?? { x: 0, y: 0 };
    expect(scenarios.reference().displayAt({ x: end.x + 150, y: end.y + 200 })?.id).toBe('HDMI-1');
    expect(window.moves).toEqual([]);
  });

  it('leaves a visible Kobi released without speed where it is', async () => {
    const window = new FakeOverlayWindow(rect(100, 500, 300, 400));

    const glide = await new ReleaseKobi(
      window,
      new FakeDisplaySource(scenarios.reference()),
    ).execute({ x: 0, y: 0 });

    expect(glide).toBeUndefined();
    expect(window.moves).toEqual([]);
  });

  it('rescues a Kobi released partly off screen, even if the mouse was still moving', async () => {
    // Arrastado devagar para cima do notebook: a silhueta passa do topo (y = −210).
    const window = new FakeOverlayWindow(rect(2500, -250, 300, 400));

    const glide = await new ReleaseKobi(
      window,
      new FakeDisplaySource(scenarios.reference()),
    ).execute({ x: 0, y: -60 });

    expect(glide).toBeUndefined();
    // A silhueta encosta embaixo do painel superior (área útil a partir de y = 32).
    expect(window.moves).toEqual([{ x: 2500, y: -8 }]);
  });

  it('rescues a Kobi released off screen with a speed too low to glide', async () => {
    const window = new FakeOverlayWindow(rect(-200, 500, 300, 400));

    const glide = await new ReleaseKobi(
      window,
      new FakeDisplaySource(scenarios.reference()),
    ).execute({ x: 3, y: 0 });

    expect(glide).toBeUndefined();
    expect(window.moves).toEqual([{ x: -80, y: 500 }]);
  });
});
