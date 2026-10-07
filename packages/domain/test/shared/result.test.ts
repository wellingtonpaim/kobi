import { describe, expect, it } from 'vitest';

import { err, ok, type Result } from '../../src/shared/result.js';

const parsePositive = (n: number): Result<number, string> => (n > 0 ? ok(n) : err('not positive'));

describe('Result', () => {
  it('carries the value of a success', () => {
    const result = parsePositive(3);

    expect(result).toEqual({ ok: true, value: 3 });
  });

  it('carries the error of a failure', () => {
    const result = parsePositive(-1);

    expect(result).toEqual({ ok: false, error: 'not positive' });
  });
});
