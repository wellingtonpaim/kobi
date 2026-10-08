import { type Point, Rect, type RectProps } from '@kobi/domain';
import type { BrowserWindow } from 'electron';

import type { OverlayExtension } from './overlay-extension.js';
import type { PlatformOverlay } from './platform-overlay.js';
import { placeSilhouette, toPixel } from './window-geometry.js';

export interface GnomeShellOverlayOptions {
  /** Intervalo entre as consultas enquanto a janela não aparece para o compositor. */
  readonly pollMs?: number;
  readonly timeoutMs?: number;
  /**
   * A extensão entrega o mouse à janela de trás fora do Kobi (versão 3). Sem isso, o app
   * alterna `setIgnoreMouseEvents`, que o Electron só aplica quando o ponteiro sai da
   * janela inteira (medido no spike).
   */
  readonly compositorRoutesPointer?: boolean;
}

interface Waiter {
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
}

/**
 * Estratégia B do spike (spec 0002): Electron nativo no Wayland. Só o compositor sabe
 * onde a janela está e pode movê-la, então tudo passa pela extensão GNOME do Kobi.
 *
 * O clique atravessa fora do Kobi: no Wayland o Electron não aplica `setShape` como
 * região de entrada (medido no spike). A extensão (versão 3) decide no compositor quem
 * recebe o mouse; com versões anteriores, o app alterna `setIgnoreMouseEvents`.
 */
export class GnomeShellOverlayWindow implements PlatformOverlay {
  private silhouetteOffset: RectProps | undefined;
  /** Última posição confirmada pela extensão (ou pedida antes de a janela aparecer). */
  private position: Point | undefined;
  private sending = false;
  private pending: { target: Point; waiters: Waiter[] } | undefined;
  private pointerInside = true;
  private held = false;
  private ignoringMouse = false;
  /** Até a janela aparecer, o compositor não a conhece: posições ficam guardadas. */
  private shown = false;

  constructor(
    private readonly window: BrowserWindow,
    private readonly extension: OverlayExtension,
    private readonly options: GnomeShellOverlayOptions = {},
  ) {
    if (options.compositorRoutesPointer) return;
    extension.onPointerInside((inside) => {
      this.pointerInside = inside;
      this.applyMouse();
    });
  }

  reportSilhouette(offset: RectProps): void {
    this.silhouetteOffset = offset;
  }

  async silhouette(): Promise<Rect> {
    return placeSilhouette(await this.frame(), this.silhouetteOffset);
  }

  async bounds(): Promise<Rect> {
    const result = Rect.create(await this.frame());
    if (!result.ok) throw new Error('Overlay window has no area');
    return result.value;
  }

  /**
   * Nunca enfileira: enquanto um movimento está a caminho, os seguintes se fundem no
   * mais recente. Assim o Kobi segue o mouse sem atraso acumulado, a qualquer taxa.
   */
  moveTo({ x, y }: Point): Promise<void> {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return Promise.reject(new Error(`invalid position (${String(x)}, ${String(y)})`));
    }
    const target = { x: toPixel(x), y: toPixel(y) };
    if (!this.shown) {
      this.position = target;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const waiters = [...(this.pending?.waiters ?? []), { resolve, reject }];
      this.pending = { target, waiters };
      if (!this.sending) void this.send();
    });
  }

  /** Mostra a janela, espera o compositor conhecê-la e aplica a posição guardada. */
  async show(): Promise<void> {
    this.window.showInactive();
    const { pollMs = 16, timeoutMs = 3000 } = this.options;
    for (let waited = 0; !(await this.extension.frame()); waited += pollMs) {
      if (waited >= timeoutMs) throw new Error('Kobi window never appeared to the compositor');
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    this.shown = true;
    if (this.position) await this.moveTo(this.position);
  }

  setInteractiveRegion(regions: readonly RectProps[]): Promise<void> {
    return this.extension.setInteractiveRegion(regions).then(() => undefined);
  }

  holdPointer(held: boolean): void {
    this.held = held;
    this.applyMouse();
  }

  private async send(): Promise<void> {
    this.sending = true;
    while (this.pending) {
      const { target, waiters } = this.pending;
      this.pending = undefined;
      try {
        if (!(await this.extension.moveTo(target)))
          throw new Error('Kobi window not found by the compositor');
        this.position = target;
        for (const waiter of waiters) waiter.resolve();
      } catch (error) {
        for (const waiter of waiters) waiter.reject(error);
      }
    }
    this.sending = false;
  }

  private async frame(): Promise<RectProps> {
    const { width, height } = this.window.getBounds();
    return (
      (await this.extension.frame()) ?? { ...(this.position ?? { x: 0, y: 0 }), width, height }
    );
  }

  private applyMouse(): void {
    const ignore = !this.pointerInside && !this.held;
    if (ignore === this.ignoringMouse) return;
    this.ignoringMouse = ignore;
    this.window.setIgnoreMouseEvents(ignore);
  }
}
