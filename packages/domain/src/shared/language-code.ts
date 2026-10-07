import { err, ok, type Result } from './result.js';

const SUPPORTED = ['pt', 'en', 'es', 'fr'] as const;

export type SupportedLanguage = (typeof SUPPORTED)[number];

export interface UnsupportedLanguage {
  readonly kind: 'unsupported-language';
  readonly input: string;
}

const isSupported = (candidate: string): candidate is SupportedLanguage =>
  (SUPPORTED as readonly string[]).includes(candidate);

/**
 * Idioma em que o Kobi conversa. Aceita tags regionais e de locale do sistema
 * ("pt-BR", "fr_CA.UTF-8") e guarda apenas o idioma base.
 */
export class LanguageCode {
  static readonly supported: readonly SupportedLanguage[] = SUPPORTED;

  private constructor(readonly value: SupportedLanguage) {}

  static create(raw: string): Result<LanguageCode, UnsupportedLanguage> {
    const base = raw
      .trim()
      .toLowerCase()
      .replace(/[-_.].*$/s, '');
    return isSupported(base)
      ? ok(new LanguageCode(base))
      : err({ kind: 'unsupported-language', input: raw });
  }

  equals(other: LanguageCode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
