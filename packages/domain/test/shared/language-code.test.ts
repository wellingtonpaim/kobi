import { describe, expect, it } from 'vitest';

import { LanguageCode } from '../../src/shared/language-code.js';

const valid = (raw: string): LanguageCode => {
  const result = LanguageCode.create(raw);
  if (!result.ok) throw new Error(`expected "${raw}" to be valid`);
  return result.value;
};

describe('LanguageCode', () => {
  it.each(['pt', 'en', 'es', 'fr'])('accepts the supported language "%s"', (raw) => {
    expect(valid(raw).value).toBe(raw);
  });

  it.each([
    ['pt-BR', 'pt'],
    ['en_US', 'en'],
    ['es-419', 'es'],
    ['fr_CA.UTF-8', 'fr'],
  ])('reduces the regional tag "%s" to "%s"', (raw, expected) => {
    expect(valid(raw).value).toBe(expected);
  });

  it('ignores case and surrounding spaces', () => {
    expect(valid('  PT-br ').value).toBe('pt');
  });

  it.each(['de', 'ja-JP', '', '   ', 'portuguese', 'p'])('rejects "%s"', (raw) => {
    expect(LanguageCode.create(raw)).toEqual({
      ok: false,
      error: { kind: 'unsupported-language', input: raw },
    });
  });

  it('is equal to another code of the same language', () => {
    expect(valid('pt-BR').equals(valid('pt'))).toBe(true);
    expect(valid('pt').equals(valid('en'))).toBe(false);
  });

  it('is written as its base language', () => {
    expect(String(valid('es-419'))).toBe('es');
  });

  it('lists the supported languages', () => {
    expect(LanguageCode.supported).toEqual(['pt', 'en', 'es', 'fr']);
  });
});
