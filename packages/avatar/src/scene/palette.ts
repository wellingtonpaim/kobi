export type BodyTone = 'light' | 'dark' | 'pink' | 'blue' | 'green' | 'brown' | 'amber';

export interface BodyColors {
  readonly shell: string;
  readonly trim: string;
  readonly seam: string;
  readonly headset: string;
}

/**
 * Cores do corpo (docs/design-visual.md, spec 0004). Tons dessaturados de pintura
 * fosca: nunca com a vivacidade dos LEDs. Cada cor mantém o contraste entre casca,
 * frisos, juntas e fone das cores originais (cinza claro e chumbo).
 */
export const BODY_TONES: Readonly<Record<BodyTone, BodyColors>> = {
  light: { shell: '#aeb3ba', trim: '#6a717b', seam: '#22252a', headset: '#23272e' },
  dark: { shell: '#3b3e43', trim: '#1f2226', seam: '#0e0f11', headset: '#16181c' },
  pink: { shell: '#a8848d', trim: '#7a5a62', seam: '#2e2427', headset: '#2a2326' },
  blue: { shell: '#7b8fa8', trim: '#53667d', seam: '#20262e', headset: '#1e232b' },
  green: { shell: '#859982', trim: '#5a6d58', seam: '#212923', headset: '#1f2521' },
  brown: { shell: '#8a7262', trim: '#5d4a3f', seam: '#241c18', headset: '#201915' },
  amber: { shell: '#c4955a', trim: '#8f6a3c', seam: '#2c2217', headset: '#261d14' },
};

export const DEFAULT_LED_COLOR = '#1e90ff';
export const VISOR_COLOR = '#15171a';
