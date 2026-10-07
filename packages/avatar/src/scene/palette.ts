export type BodyTone = 'light' | 'dark';

export interface BodyColors {
  readonly shell: string;
  readonly trim: string;
  readonly seam: string;
  readonly headset: string;
}

/** Cores aprovadas em docs/design-visual.md. */
export const BODY_TONES: Readonly<Record<BodyTone, BodyColors>> = {
  light: { shell: '#aeb3ba', trim: '#6a717b', seam: '#22252a', headset: '#23272e' },
  dark: { shell: '#3b3e43', trim: '#1f2226', seam: '#0e0f11', headset: '#16181c' },
};

export const DEFAULT_LED_COLOR = '#1e90ff';
export const VISOR_COLOR = '#15171a';
