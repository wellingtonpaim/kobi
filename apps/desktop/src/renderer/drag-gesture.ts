import type { ScreenPoint } from '../shared/api.js';

export interface DragCallbacks {
  /** `cursor`: coordenadas de tela do evento (exatas no X11; no Wayland o processo principal as ignora). */
  readonly start: (cursor: ScreenPoint) => void;
  readonly move: (cursor: ScreenPoint) => void;
  readonly end: (cursor: ScreenPoint) => void;
}

/**
 * Estado do arraste do Kobi com o mouse. Termina uma única vez, mesmo que o soltar se
 * perca: um movimento sem botão pressionado ou a perda do ponteiro também encerram,
 * para o Kobi nunca ficar preso ao mouse.
 */
export class DragGesture {
  private dragging = false;
  private last: ScreenPoint = { x: 0, y: 0 };

  constructor(private readonly callbacks: DragCallbacks) {}

  get active(): boolean {
    return this.dragging;
  }

  press(cursor: ScreenPoint): void {
    this.dragging = true;
    this.last = cursor;
    this.callbacks.start(cursor);
  }

  /** `buttons`: botões pressionados durante o movimento (`PointerEvent.buttons`). */
  move(buttons: number, cursor: ScreenPoint): void {
    if (!this.dragging) return;
    if (buttons === 0) {
      this.release(cursor);
      return;
    }
    this.last = cursor;
    this.callbacks.move(cursor);
  }

  release(cursor: ScreenPoint = this.last): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.callbacks.end(cursor);
  }

  /** A janela perdeu o ponteiro: encerra onde ele foi visto pela última vez. */
  lost(): void {
    this.release();
  }
}
