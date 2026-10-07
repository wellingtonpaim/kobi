import type { DisplayLayout } from '@kobi/domain';

/** Monitores conectados, lidos do sistema, e aviso quando mudam (hotplug, escala, disposição). */
export interface DisplaySource {
  current(): DisplayLayout;
  /** Devolve a função que cancela a inscrição. */
  onChange(listener: () => void): () => void;
}
