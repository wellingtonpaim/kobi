import type { DisplaySource } from '@kobi/application';
import type { DisplayLayout } from '@kobi/domain';
import type { Screen } from 'electron';

import { toDisplayLayout } from './display-mapping.js';

/** Monitores lidos da API `screen` do Electron (Windows, macOS e Linux). */
export class ElectronDisplaySource implements DisplaySource {
  constructor(private readonly screen: Screen) {}

  current(): DisplayLayout {
    const result = toDisplayLayout(
      this.screen.getAllDisplays(),
      this.screen.getPrimaryDisplay().id,
    );
    if (!result.ok) throw new Error(`Unreadable monitor layout: ${JSON.stringify(result.error)}`);
    return result.value;
  }

  onChange(listener: () => void): () => void {
    const notify = (): void => {
      listener();
    };
    this.screen.on('display-added', notify);
    this.screen.on('display-removed', notify);
    this.screen.on('display-metrics-changed', notify);
    return () => {
      this.screen.off('display-added', notify);
      this.screen.off('display-removed', notify);
      this.screen.off('display-metrics-changed', notify);
    };
  }
}
