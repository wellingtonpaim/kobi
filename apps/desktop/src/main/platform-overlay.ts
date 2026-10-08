import type { OverlayWindow } from '@kobi/application';
import type { RectProps } from '@kobi/domain';

/** A porta `OverlayWindow` mais o que só o processo principal do Electron usa. */
export interface PlatformOverlay extends OverlayWindow {
  /** Onde o Kobi aparece dentro da janela, medido pela interface. */
  reportSilhouette(offset: RectProps): void;
  /** Mostra a janela sem roubar o foco; posições pedidas antes valem a partir daqui. */
  show(): Promise<void>;
  /** Enquanto o usuário segura o Kobi, a janela não solta o mouse. */
  holdPointer(held: boolean): void;
}
