import { describe, expect, it, vi } from 'vitest';

import { DragGesture } from '../src/renderer/drag-gesture.js';

const at = (x: number) => ({ x, y: 0 });

const setup = () => {
  const calls = { start: vi.fn(), move: vi.fn(), end: vi.fn() };
  return { calls, drag: new DragGesture(calls) };
};

describe('DragGesture', () => {
  it('follows the mouse between press and release, with the screen position of each event', () => {
    const { drag, calls } = setup();

    drag.press(at(1));
    drag.move(1, at(2));
    drag.move(1, at(3));
    drag.release(at(4));

    expect(calls.start).toHaveBeenCalledWith(at(1));
    expect(calls.move.mock.calls).toEqual([[at(2)], [at(3)]]);
    expect(calls.end).toHaveBeenCalledExactlyOnceWith(at(4));
  });

  it('ignores moves and releases that are not part of a drag', () => {
    const { drag, calls } = setup();

    drag.move(0, at(1));
    drag.release(at(1));

    expect(calls.move).not.toHaveBeenCalled();
    expect(calls.end).not.toHaveBeenCalled();
  });

  it('ends the drag when the mouse moves with no button pressed (the release got lost)', () => {
    const { drag, calls } = setup();
    drag.press(at(1));

    drag.move(0, at(5));
    drag.move(0, at(6));

    expect(calls.move).not.toHaveBeenCalled();
    expect(calls.end).toHaveBeenCalledExactlyOnceWith(at(5));
    expect(drag.active).toBe(false);
  });

  it('ends where the pointer was last seen when the window loses it, so the Kobi never sticks to the mouse', () => {
    const { drag, calls } = setup();
    drag.press(at(1));
    drag.move(1, at(7));

    drag.lost();
    drag.release(at(9));

    expect(calls.end).toHaveBeenCalledExactlyOnceWith(at(7));
  });
});
