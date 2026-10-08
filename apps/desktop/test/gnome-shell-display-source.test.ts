import { describe, expect, it, vi } from 'vitest';

import { GnomeShellDisplaySource } from '../src/main/gnome-shell-display-source.js';
import type { ExtensionMonitor, OverlayExtension } from '../src/main/overlay-extension.js';

const edp: ExtensionMonitor = {
  connector: 'eDP-1',
  bounds: { x: 1920, y: 0, width: 1920, height: 1200 },
  workArea: { x: 1920, y: 32, width: 1920, height: 1168 },
  scaleFactor: 1,
  refreshRateHz: 60.003,
  primary: true,
};
const hdmi: ExtensionMonitor = {
  connector: 'HDMI-1',
  bounds: { x: 3840, y: 120, width: 1920, height: 1080 },
  workArea: { x: 3840, y: 120, width: 1920, height: 1080 },
  scaleFactor: 1.25,
  refreshRateHz: 100,
  primary: false,
};

const fakeExtension = (initial: ExtensionMonitor[]) => {
  let monitors: () => Promise<ExtensionMonitor[]> = () => Promise.resolve(initial);
  let changed: () => void = () => undefined;
  const extension = {
    monitors: () => monitors(),
    onMonitorsChanged: (listener: () => void) => {
      changed = listener;
    },
  } as unknown as OverlayExtension;
  return {
    extension,
    setMonitors: (next: () => Promise<ExtensionMonitor[]>) => {
      monitors = next;
    },
    change: () => {
      changed();
    },
  };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('GnomeShellDisplaySource', () => {
  it('describes the monitors as GNOME sees them: primary, work area without the panel and refresh rate', async () => {
    const { extension } = fakeExtension([hdmi, edp]);

    const layout = (await GnomeShellDisplaySource.create(extension)).current();

    expect(layout.primary.id).toBe('eDP-1');
    expect(layout.primary.workArea.y).toBe(32);
    expect(layout.primary.refreshRateHz).toBeCloseTo(60.003);
    expect(layout.displays.find((d) => d.id === 'HDMI-1')?.scaleFactor).toBe(1.25);
  });

  it('falls back to 60 Hz when GNOME does not know the refresh rate', async () => {
    const { extension } = fakeExtension([{ ...edp, refreshRateHz: 0 }]);

    expect((await GnomeShellDisplaySource.create(extension)).current().primary.refreshRateHz).toBe(
      60,
    );
  });

  it('takes the first monitor as primary when GNOME reports none (for a moment during hotplug)', async () => {
    const { extension } = fakeExtension([{ ...hdmi }, { ...edp, primary: false }]);

    expect((await GnomeShellDisplaySource.create(extension)).current().primary.id).toBe('HDMI-1');
  });

  it('refuses to start without any monitor', async () => {
    const { extension } = fakeExtension([]);

    await expect(GnomeShellDisplaySource.create(extension)).rejects.toThrow('monitor layout');
  });

  it('rereads the monitors before telling anyone they changed', async () => {
    const { extension, setMonitors, change } = fakeExtension([edp]);
    const source = await GnomeShellDisplaySource.create(extension);
    const seen: string[][] = [];
    source.onChange(() => seen.push(source.current().displays.map((d) => d.id)));

    setMonitors(() => Promise.resolve([edp, hdmi]));
    change();
    await flush();

    expect(seen).toEqual([['eDP-1', 'HDMI-1']]);
  });

  it('keeps the last good layout when rereading fails', async () => {
    const { extension, setMonitors, change } = fakeExtension([edp]);
    const errors: unknown[] = [];
    const source = await GnomeShellDisplaySource.create(extension, (e) => errors.push(e));
    const listener = vi.fn();
    source.onChange(listener);

    setMonitors(() => Promise.reject(new Error('shell restarting')));
    change();
    await flush();

    expect(source.current().primary.id).toBe('eDP-1');
    expect(listener).not.toHaveBeenCalled();
    expect(errors).toHaveLength(1);
  });

  it('stops telling a listener after it unsubscribes', async () => {
    const { extension, change } = fakeExtension([edp]);
    const source = await GnomeShellDisplaySource.create(extension);
    const listener = vi.fn();

    source.onChange(listener)();
    change();
    await flush();

    expect(listener).not.toHaveBeenCalled();
  });
});
