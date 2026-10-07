import { describe, expect, it } from 'vitest';

import { DisplayLayout } from '../../src/presence/display-layout.js';
import { display, layout, rect, scenarios } from '../../testing/index.js';

const kobiWindow = (x: number, y: number) => rect(x, y, 300, 400);

describe('DisplayLayout', () => {
  describe('creation', () => {
    it('rejects an empty layout', () => {
      expect(DisplayLayout.create([])).toEqual({ ok: false, error: { kind: 'no-displays' } });
    });

    it('rejects repeated display ids', () => {
      const result = DisplayLayout.create([
        display({ id: 'a', bounds: { x: 0, y: 0, width: 100, height: 100 }, primary: true }),
        display({ id: 'a', bounds: { x: 100, y: 0, width: 100, height: 100 } }),
      ]);

      expect(result).toEqual({ ok: false, error: { kind: 'duplicate-display-id', id: 'a' } });
    });

    it.each([
      ['no primary display', [false, false], 0],
      ['two primary displays', [true, true], 2],
    ])('rejects %s', (_, primaries, count) => {
      const result = DisplayLayout.create(
        primaries.map((primary, i) =>
          display({
            id: `d${String(i)}`,
            bounds: { x: i * 100, y: 0, width: 100, height: 100 },
            primary,
          }),
        ),
      );

      expect(result).toEqual({ ok: false, error: { kind: 'primary-display-count', count } });
    });

    it.each(Object.entries(scenarios))('accepts the "%s" scenario', (_, scenario) => {
      expect(scenario().displays.length).toBeGreaterThan(0);
    });
  });

  it('knows its primary display, wherever it is', () => {
    expect(scenarios.reference().primary.id).toBe('eDP-1');
    expect(scenarios.stacked().primary.id).toBe('bottom');
    expect(scenarios.negative().primary.id).toBe('main');
  });

  describe('display at a point', () => {
    it.each([
      ['reference', scenarios.reference, { x: 100, y: 500 }, 'DVI-I-2'],
      ['reference', scenarios.reference, { x: 1920, y: 10 }, 'eDP-1'],
      ['reference', scenarios.reference, { x: 5000, y: 1199 }, 'HDMI-1'],
      ['negative', scenarios.negative, { x: -1000, y: -100 }, 'left'],
      ['stacked', scenarios.stacked, { x: 500, y: 2000 }, 'bottom'],
      ['fourByFourK', scenarios.fourByFourK, { x: 3000, y: 1500 }, 'br'],
    ] as const)('finds the display under a point (%s)', (_, scenario, point, id) => {
      expect(scenario().displayAt(point)?.id).toBe(id);
    });

    it.each([
      ['the void above the misaligned side monitors', scenarios.reference, { x: 100, y: 50 }],
      ['the gap between monitors', scenarios.gap, { x: 2100, y: 500 }],
      ['the corner left uncovered by a stacked layout', scenarios.stacked, { x: 2400, y: 2000 }],
    ] as const)('finds nothing in %s', (_, scenario, point) => {
      expect(scenario().displayAt(point)).toBeUndefined();
    });
  });

  describe('nearest display', () => {
    it.each([
      ['inside a display', scenarios.single, { x: 10, y: 10 }, 'laptop'],
      ['in a gap, closer to the right monitor', scenarios.gap, { x: 2300, y: 500 }, 'b'],
      ['far outside every monitor', scenarios.reference, { x: 99999, y: 0 }, 'HDMI-1'],
      ['far into negative coordinates', scenarios.negative, { x: -99999, y: -99999 }, 'left'],
    ] as const)('picks the closest display to a point %s', (_, scenario, point, id) => {
      expect(scenario().nearestTo(point).id).toBe(id);
    });
  });

  describe('display a window is on', () => {
    it('is the display holding the largest part of the window', () => {
      const straddling = rect(1800, 500, 300, 400);

      expect(scenarios.reference().displayFor(straddling).id).toBe('eDP-1');
    });

    it('drives scale and refresh rate as the window crosses monitors', () => {
      const mixed = scenarios.mixedScale();

      expect(mixed.displayFor(kobiWindow(100, 100)).scaleFactor).toBe(1.5);
      expect(mixed.displayFor(kobiWindow(1800, 100)).scaleFactor).toBe(1);
    });

    it('falls back to the nearest display when the window is off every monitor', () => {
      expect(scenarios.gap().displayFor(rect(1950, 100, 100, 100)).id).toBe('a');
    });
  });

  describe('keeping the Kobi on screen', () => {
    /** Silhueta visível do Kobi (sem margens transparentes nem sombra). */
    const body = (x: number, y: number) => rect(x, y, 140, 300);

    it.each([
      ['touching the left edge of the leftmost monitor', body(0, 500)],
      ['touching the right edge of the rightmost monitor', body(5760 - 140, 500)],
      ['touching the top of a side monitor, which starts lower', body(300, 120)],
      ['touching the bottom of the laptop', body(2500, 900)],
      ['over the laptop top bar, since the Kobi floats above everything', body(2500, 0)],
      ['half on one monitor, half on the next', body(1850, 500)],
    ])('accepts the Kobi %s', (_, silhouette) => {
      expect(scenarios.reference().onScreen(silhouette)).toBe(true);
    });

    it.each([
      ['past the left edge', body(-1, 500)],
      ['in the void above a lower side monitor', body(300, 60)],
      ['past the bottom', body(2500, 901)],
      ['partly in the gap between monitors', body(1850, 500), scenarios.gap()],
    ])('rejects the Kobi %s', (_, silhouette, l = scenarios.reference()) => {
      expect(l.onScreen(silhouette)).toBe(false);
    });

    it('leaves the Kobi where it is while it is on screen', () => {
      expect(scenarios.reference().keepOnScreen(body(0, 900))).toEqual(body(0, 900));
    });

    it('brings a Kobi lost in a gap into the nearest monitor', () => {
      expect(scenarios.gap().keepOnScreen(body(2200, 100))).toEqual(body(2420, 100));
    });

    it('rests clear of panels when it has to be brought back', () => {
      expect(scenarios.reference().keepOnScreen(body(2500, -200))).toEqual(body(2500, 32));
    });

    it('rescues the Kobi when the monitor it was on is disconnected', () => {
      const afterUnplug = layout(
        display({ id: 'DVI-I-2', bounds: { x: 0, y: 120, width: 1920, height: 1080 } }),
        display({
          id: 'eDP-1',
          bounds: { x: 1920, y: 0, width: 1920, height: 1200 },
          primary: true,
        }),
      );

      expect(afterUnplug.keepOnScreen(body(5000, 500))).toEqual(body(3840 - 140, 500));
    });

    it('centers the Kobi on a monitor smaller than it', () => {
      const tiny = layout(
        display({ id: 'tiny', bounds: { x: 0, y: 0, width: 100, height: 200 }, primary: true }),
      );

      expect(tiny.keepOnScreen(body(900, 900))).toEqual(body(-20, -50));
    });
  });

  describe('tour through every monitor', () => {
    it.each([
      ['single', scenarios.single, ['laptop']],
      ['reference', scenarios.reference, ['DVI-I-2', 'eDP-1', 'HDMI-1']],
      ['negative', scenarios.negative, ['left', 'main']],
      ['stacked', scenarios.stacked, ['top', 'bottom']],
      ['fourByFourK', scenarios.fourByFourK, ['tl', 'bl', 'tr', 'br']],
    ] as const)('visits the center of each work area, left to right (%s)', (_, scenario, ids) => {
      const l = scenario();
      const expected = ids.map((id) => l.displays.find((d) => d.id === id)?.workArea.center);

      expect(l.tour()).toEqual(expected);
    });
  });
});
