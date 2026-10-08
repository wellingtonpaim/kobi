import { describe, expect, it } from 'vitest';

import { currentRefreshRates } from '../monitors.js';

/** Monta um monitor como o GetCurrentState do Mutter devolve (já desempacotado). */
const monitor = (connector, modes) => [
  [connector, 'Vendor', 'Product', 'serial'],
  modes.map(([refresh, current]) => [
    `1920x1080@${refresh}`,
    1920,
    1080,
    refresh,
    1,
    [1],
    current ? { 'is-current': true } : {},
  ]),
  {},
];

describe('currentRefreshRates', () => {
  it('reads the refresh rate of the mode in use on each connector', () => {
    const state = [
      1,
      [
        monitor('eDP-1', [
          [60.003, true],
          [48, false],
        ]),
        monitor('HDMI-1', [
          [60, false],
          [100, true],
        ]),
      ],
      [],
      {},
    ];

    expect(currentRefreshRates(state)).toEqual(
      new Map([
        ['eDP-1', 60.003],
        ['HDMI-1', 100],
      ]),
    );
  });

  it('leaves out connectors with no mode in use (monitor turned off)', () => {
    const state = [1, [monitor('DP-2', [[60, false]])], [], {}];

    expect(currentRefreshRates(state).size).toBe(0);
  });

  it('accepts is-current wrapped as a variant', () => {
    const state = [
      1,
      [
        [
          ['DP-1', 'V', 'P', 's'],
          [['m', 1, 1, 144, 1, [1], { 'is-current': { unpack: () => true } }]],
          {},
        ],
      ],
      [],
      {},
    ];

    expect(currentRefreshRates(state).get('DP-1')).toBe(144);
  });
});
