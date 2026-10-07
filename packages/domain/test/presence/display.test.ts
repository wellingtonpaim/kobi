import { describe, expect, it } from 'vitest';

import { Display, type DisplayProps } from '../../src/presence/display.js';
import { rect } from './fixtures.js';

const props = (overrides: Partial<DisplayProps> = {}): DisplayProps => ({
  id: 'HDMI-1',
  bounds: rect(0, 0, 1920, 1080),
  workArea: rect(0, 32, 1920, 1048),
  scaleFactor: 1.25,
  refreshRateHz: 100,
  primary: false,
  ...overrides,
});

describe('Display', () => {
  it('keeps the properties read from the system', () => {
    const result = Display.create(props());

    expect(result.ok && result.value).toMatchObject({
      id: 'HDMI-1',
      scaleFactor: 1.25,
      refreshRateHz: 100,
      primary: false,
    });
  });

  it.each([
    ['an empty id', { id: '  ' }, 'invalid-display-id'],
    ['a zero scale factor', { scaleFactor: 0 }, 'invalid-scale-factor'],
    ['a non-finite scale factor', { scaleFactor: Number.NaN }, 'invalid-scale-factor'],
    ['a negative refresh rate', { refreshRateHz: -60 }, 'invalid-refresh-rate'],
    [
      'a work area outside the bounds',
      { workArea: rect(0, 0, 1920, 1200) },
      'work-area-outside-bounds',
    ],
  ] as const)('rejects %s', (_, overrides, kind) => {
    const result = Display.create(props(overrides));

    expect(result).toMatchObject({ ok: false, error: { kind } });
  });
});
