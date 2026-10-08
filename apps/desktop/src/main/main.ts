import { KeepKobiVisible, PlaceKobiOnStartup, PlanGlide } from '@kobi/application';
import { type Point, Rect } from '@kobi/domain';
import { app, BrowserWindow, ipcMain, Menu, screen } from 'electron';
import path from 'node:path';

import {
  CHANNELS,
  type CurrentDisplay,
  type Region,
  type SampledPath,
  type ScreenPoint,
  type TourPlan,
} from '../shared/api.js';
import { attachBenchMode, BENCH_SWITCH } from './bench-mode.js';
import { ElectronDisplaySource } from './electron-display-source.js';
import { ObservedOverlayWindow } from './observed-overlay-window.js';
import { choosePlatform } from './platform.js';
import { ReleaseTracker } from './release-tracker.js';

/** Tamanho da janela do Kobi em pixels lógicos: só o avatar, com folga para animação e poeira. */
const WINDOW_SIZE = { width: 300, height: 400 } as const;

const createWindow = (): BrowserWindow =>
  new BrowserWindow({
    ...WINDOW_SIZE,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    // Estratégia A (X11): como "dock", o GNOME não força a janela a ficar inteira na
    // tela, e o Kobi chega até a borda real de cada monitor (medido no spike). No
    // Wayland o tipo é ignorado e a extensão GNOME cuida disso.
    type: 'dock',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      // Hipótese 5 da spec 0002: a animação não pode desacelerar sem foco.
      backgroundThrottling: false,
    },
  });

/** Falhas ao mover a janela não podem derrubar o app: ficam registradas e o Kobi segue. */
const logFailure = (error: unknown): void => {
  console.error('[kobi]', error);
};

/** Composition root: o único lugar que instancia adaptadores e os liga aos casos de uso. */
const start = async (): Promise<void> => {
  const window = createWindow();
  window.setAlwaysOnTop(true, 'screen-saver');
  window.setVisibleOnAllWorkspaces(true);

  const platform = await choosePlatform(window);
  if (!platform) return;
  const displays = new ElectronDisplaySource(screen);

  /** Layout em cache: o monitor do Kobi é conferido a cada movimento, sem reler o sistema. */
  let layout = displays.current();
  let reported: CurrentDisplay | undefined;
  /** Informa à interface em que monitor o Kobi está (escala e taxa de atualização em uso). */
  const reportDisplay = (topLeft: Point): void => {
    const bounds = Rect.create({ ...topLeft, ...WINDOW_SIZE });
    if (!bounds.ok) return;
    const current = layout.displayFor(bounds.value);
    const info: CurrentDisplay = {
      id: current.id,
      scaleFactor: current.scaleFactor,
      refreshRateHz: current.refreshRateHz,
    };
    if (
      reported?.id === info.id &&
      reported.scaleFactor === info.scaleFactor &&
      reported.refreshRateHz === info.refreshRateHz
    )
      return;
    reported = info;
    window.webContents.send(CHANNELS.displayChanged, info);
  };
  // Cada movimento, venha de onde vier, chega à interface: no Wayland ela não sabe onde
  // a janela está, e o `moved` do Electron não dispara quando o próprio app a move (X11).
  const overlay = new ObservedOverlayWindow(platform.overlay, (topLeft) => {
    window.webContents.send(CHANNELS.windowMoved, topLeft);
    reportDisplay(topLeft);
  });
  const keepVisible = new KeepKobiVisible(overlay, displays);
  const planGlide = new PlanGlide(overlay, displays);
  const moveTo = (point: ScreenPoint): void => {
    overlay.moveTo(point).catch(logFailure);
  };
  const topLeft = async (): Promise<Point> => {
    const { x, y } = await overlay.bounds();
    return { x, y };
  };

  displays.onChange(() => {
    layout = displays.current();
    keepVisible.execute().catch(logFailure);
  });

  ipcMain.on(CHANNELS.setSilhouette, (_, silhouette: Region) => {
    overlay.reportSilhouette(silhouette);
  });
  ipcMain.on(CHANNELS.setInteractiveRegion, (_, regions: Region[]) => {
    overlay.setInteractiveRegion(regions).catch(logFailure);
  });
  ipcMain.on(CHANNELS.moveTo, (_, { x, y }: ScreenPoint) => {
    moveTo({ x, y });
  });

  // Arrastar: o ponteiro é lido na tela inteira pelo processo principal, porque no
  // Wayland a interface só conhece o ponteiro relativo à janela. Soltar com o mouse em
  // movimento arremessa o Kobi (spec 0005).
  let drag: { grab: Point; window: Point; release: ReleaseTracker } | undefined;
  ipcMain.on(CHANNELS.dragStart, () => {
    overlay.holdPointer(true);
    Promise.all([platform.pointer(), topLeft()])
      .then(([grab, position]) => {
        const release = new ReleaseTracker();
        release.add(grab, performance.now());
        drag = { grab, window: position, release };
      })
      .catch(logFailure);
  });
  ipcMain.on(CHANNELS.dragMove, () => {
    platform
      .pointer()
      .then((cursor) => {
        if (!drag) return;
        drag.release.add(cursor, performance.now());
        moveTo({
          x: drag.window.x + cursor.x - drag.grab.x,
          y: drag.window.y + cursor.y - drag.grab.y,
        });
      })
      .catch(logFailure);
  });
  ipcMain.handle(CHANNELS.dragEnd, async (): Promise<SampledPath | undefined> => {
    const ended = drag;
    drag = undefined;
    overlay.holdPointer(false);
    // O último movimento do mouse pode chegar junto com o soltar: alcança o ponteiro.
    if (ended) {
      const cursor = await platform.pointer();
      await overlay.moveTo({
        x: ended.window.x + cursor.x - ended.grab.x,
        y: ended.window.y + cursor.y - ended.grab.y,
      });
    }
    const velocity = ended?.release.velocityAt(performance.now()) ?? { x: 0, y: 0 };
    if (velocity.x === 0 && velocity.y === 0) {
      await keepVisible.execute();
      return undefined;
    }
    const glide = await planGlide.execute(velocity);
    const step = 1 / 120;
    const points: ScreenPoint[] = [];
    for (let t = 0; t < glide.duration; t += step) points.push(glide.positionAt(t));
    points.push(glide.positionAt(glide.duration));
    return { step, points };
  });
  ipcMain.handle(CHANNELS.planTour, async (): Promise<TourPlan> => ({
    stops: layout.tour(),
    windowSize: WINDOW_SIZE,
    start: await topLeft(),
  }));
  ipcMain.on(CHANNELS.showMenu, () => {
    Menu.buildFromTemplate([
      {
        label: 'Passeio de teste',
        click: () => {
          window.webContents.send(CHANNELS.startTour);
        },
      },
      {
        label: 'Diagnóstico',
        click: () => {
          window.webContents.send(CHANNELS.toggleDiagnostics);
        },
      },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          app.quit();
        },
      },
    ]).popup({ window });
  });
  const bench = process.argv.includes(BENCH_SWITCH);
  if (bench)
    attachBenchMode(window, {
      visit: (index) => {
        const stops = layout.tour();
        const stop = stops[index % stops.length] ?? { x: 0, y: 0 };
        moveTo({ x: stop.x - WINDOW_SIZE.width / 2, y: stop.y - WINDOW_SIZE.height / 2 });
        return { display: layout.displayAt(stop)?.id ?? '?', of: stops.length };
      },
    });

  await window.loadFile(
    path.join(__dirname, 'renderer', 'index.html'),
    bench ? { query: { bench: '1' } } : undefined,
  );
  await new PlaceKobiOnStartup(overlay, displays).execute();
  await overlay.show();
  console.log(`[kobi] overlay: ${platform.name}`);
};

app.on('window-all-closed', () => {
  app.quit();
});
void app.whenReady().then(start);
