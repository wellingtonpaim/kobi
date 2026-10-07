import { describe, expect, it } from 'vitest';

import { floatPose } from '../../src/motion/float-pose.js';

describe('floatPose', () => {
  it('reproduces the v6 floating motion at a given moment', () => {
    const t = 1.3;

    expect(floatPose(t, false)).toEqual({
      bob: Math.sin(t * 1.6) * 0.09,
      roll: Math.sin(t * 1.1) * 0.025,
      pitch: Math.sin(t * 0.8) * 0.03,
      sway: Math.sin(t * 0.45) * 0.12,
      wavingArm: -1.05 + Math.sin(t * 6) * 0.25,
      restingArm: -0.36 + Math.sin(t * 1.6 + 1) * 0.05,
      shadowScale: 1 - Math.sin(t * 1.6) * 0.09 * 0.9,
      shadowOpacity: 0.85 - Math.sin(t * 1.6) * 0.09 * 1.5,
    });
  });

  it('holds a still pose when the user prefers reduced motion', () => {
    expect(floatPose(1.3, true)).toEqual(floatPose(0, false));
  });

  it('depends only on elapsed time, never on the frame rate', () => {
    expect(floatPose(2.5, false)).toEqual(floatPose(2.5, false));
  });
});
