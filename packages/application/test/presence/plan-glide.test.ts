import { scenarios, rect } from '@kobi/domain/testing';
import { describe, expect, it } from 'vitest';

import { PlanGlide } from '../../src/presence/plan-glide.js';
import { FakeDisplaySource, FakeOverlayWindow } from './fakes.js';

describe('PlanGlide', () => {
  it('plans the glide from where the Kobi was released, inside the current monitors', async () => {
    const window = new FakeOverlayWindow(rect(100, 500, 300, 400));
    const displays = new FakeDisplaySource(scenarios.reference());

    const glide = await new PlanGlide(window, displays).execute({ x: 4500, y: 0 });

    expect(glide.positionAt(0)).toEqual({ x: 100, y: 500 });
    const end = glide.positionAt(glide.duration);
    expect(scenarios.reference().displayAt({ x: end.x + 150, y: end.y + 200 })?.id).toBe('HDMI-1');
  });
});
