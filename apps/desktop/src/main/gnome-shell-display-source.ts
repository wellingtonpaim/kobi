import type { DisplaySource } from '@kobi/application';
import type { DisplayLayout } from '@kobi/domain';

import { toDisplayLayout } from './display-mapping.js';
import type { ExtensionMonitor, OverlayExtension } from './overlay-extension.js';

const toLayout = (monitors: readonly ExtensionMonitor[]): DisplayLayout => {
  // O domínio exige um principal; num instante de hotplug o GNOME pode não indicar nenhum.
  const primary = monitors.find((m) => m.primary) ?? monitors[0];
  const result = toDisplayLayout(
    monitors.map((m) => ({
      id: m.connector,
      bounds: m.bounds,
      workArea: m.workArea,
      scaleFactor: m.scaleFactor,
      displayFrequency: m.refreshRateHz,
    })),
    primary?.connector ?? '',
  );
  if (!result.ok) throw new Error(`Unreadable monitor layout: ${JSON.stringify(result.error)}`);
  return result.value;
};

/**
 * Monitores lidos pela extensão GNOME (estratégia B). No Wayland, a API `screen` do
 * Electron não sabe o monitor principal, a área útil sem o painel nem a taxa de
 * atualização (medido no spike); o GNOME sabe.
 */
export class GnomeShellDisplaySource implements DisplaySource {
  private readonly listeners = new Set<() => void>();

  private constructor(
    private layout: DisplayLayout,
    extension: OverlayExtension,
    private readonly onError: (error: unknown) => void,
  ) {
    extension.onMonitorsChanged(() => {
      extension
        .monitors()
        .then((monitors) => {
          this.layout = toLayout(monitors);
          for (const listener of this.listeners) listener();
        })
        .catch(this.onError);
    });
  }

  /** A porta é síncrona: o layout é lido agora e relido a cada mudança avisada pelo GNOME. */
  static async create(
    extension: OverlayExtension,
    onError: (error: unknown) => void = (error) => {
      console.error('[kobi]', error);
    },
  ): Promise<GnomeShellDisplaySource> {
    return new GnomeShellDisplaySource(toLayout(await extension.monitors()), extension, onError);
  }

  current(): DisplayLayout {
    return this.layout;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
