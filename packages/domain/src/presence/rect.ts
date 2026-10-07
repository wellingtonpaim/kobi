import { err, ok, type Result } from '../shared/result.js';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface RectProps {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface InvalidRect {
  readonly kind: 'invalid-rect';
  readonly props: RectProps;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Retângulo em pixels lógicos da área de trabalho global (pode ter coordenadas negativas). */
export class Rect implements RectProps {
  private constructor(
    readonly x: number,
    readonly y: number,
    readonly width: number,
    readonly height: number,
  ) {}

  static create(props: RectProps): Result<Rect, InvalidRect> {
    const { x, y, width, height } = props;
    const valid = [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0;
    return valid ? ok(new Rect(x, y, width, height)) : err({ kind: 'invalid-rect', props });
  }

  get right(): number {
    return this.x + this.width;
  }

  get bottom(): number {
    return this.y + this.height;
  }

  get topLeft(): Point {
    return { x: this.x, y: this.y };
  }

  get center(): Point {
    return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
  }

  contains(point: Point): boolean {
    return point.x >= this.x && point.x < this.right && point.y >= this.y && point.y < this.bottom;
  }

  intersectionArea(other: Rect): number {
    const width = Math.min(this.right, other.right) - Math.max(this.x, other.x);
    const height = Math.min(this.bottom, other.bottom) - Math.max(this.y, other.y);
    return width > 0 && height > 0 ? width * height : 0;
  }

  distanceTo(point: Point): number {
    const dx = Math.max(this.x - point.x, 0, point.x - this.right);
    const dy = Math.max(this.y - point.y, 0, point.y - this.bottom);
    return Math.hypot(dx, dy);
  }

  movedTo(topLeft: Point): Rect {
    return new Rect(topLeft.x, topLeft.y, this.width, this.height);
  }

  placedAtBottomRightOf(container: Rect, margin: number): Rect {
    return this.movedTo({
      x: container.right - this.width - margin,
      y: container.bottom - this.height - margin,
    }).clampedInside(container);
  }

  /** Menor deslocamento que coloca o retângulo dentro do contêiner; centraliza no eixo em que não cabe. */
  clampedInside(container: Rect): Rect {
    const axis = (start: number, size: number, min: number, room: number): number =>
      size > room ? min + (room - size) / 2 : clamp(start, min, min + room - size);

    return this.movedTo({
      x: axis(this.x, this.width, container.x, container.width),
      y: axis(this.y, this.height, container.y, container.height),
    });
  }
}
