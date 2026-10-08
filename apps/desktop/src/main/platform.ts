import type { Point } from '@kobi/domain';
import { app, type BrowserWindow } from 'electron';

import { GnomeShellOverlayWindow } from './gnome-shell-overlay-window.js';
import { DbusOverlayExtension } from './overlay-extension.js';
import type { PlatformOverlay } from './platform-overlay.js';
import { X11OverlayWindow } from './x11-overlay-window.js';

/** O que muda por plataforma: a janela overlay e onde está o ponteiro na tela. */
export interface Platform {
  readonly name: 'x11' | 'gnome-wayland';
  readonly overlay: PlatformOverlay;
  /**
   * Posição global do ponteiro, em pixels lógicos, num evento de arraste. `reported` são
   * as coordenadas de tela que a interface viu no evento: exatas no X11 (inclusive as do
   * soltar), sem sentido no Wayland.
   */
  readonly pointer: (reported: Point) => Promise<Point>;
}

const X11_SWITCH = '--ozone-platform=x11';

/**
 * Estratégia de overlay do spike (spec 0002). No Wayland, sem a extensão GNOME o app
 * não consegue se posicionar nem ficar acima: reabre via XWayland (degradação graciosa).
 * Devolve `undefined` quando o app vai reabrir.
 */
export const choosePlatform = async (window: BrowserWindow): Promise<Platform | undefined> => {
  if (app.commandLine.getSwitchValue('ozone-platform') !== 'wayland') {
    return {
      name: 'x11',
      overlay: new X11OverlayWindow(window),
      // Não `screen.getCursorScreenPoint()`: no X11 ela repete o último evento recebido,
      // e o último movimento antes de soltar pode nunca chegar (medido no spike).
      pointer: (reported) => Promise.resolve(reported),
    };
  }
  const extension = new DbusOverlayExtension();
  if (!(await extension.available())) {
    console.warn('[kobi] Extensão GNOME do Kobi ausente: reabrindo via XWayland.');
    const args = process.argv.slice(1).filter((arg) => !arg.startsWith('--ozone-platform'));
    app.relaunch({ args: [...args, X11_SWITCH] });
    app.exit(0);
    return undefined;
  }
  return {
    name: 'gnome-wayland',
    overlay: new GnomeShellOverlayWindow(window, extension),
    pointer: () => extension.pointer(),
  };
};
