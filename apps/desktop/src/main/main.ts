import { KeepKobiVisible, PlaceKobiOnStartup, PlanGlide } from '@kobi/application';
import { Rect } from '@kobi/domain';
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
import { X11OverlayWindow } from './x11-overlay-window.js';

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
    // tela, e o Kobi chega até a borda real de cada monitor (medido no spike).
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

  const overlay = new X11OverlayWindow(window);
  const displays = new ElectronDisplaySource(screen);
  const keepVisible = new KeepKobiVisible(overlay, displays);
  const planGlide = new PlanGlide(overlay, displays);

  /** Layout em cache: o monitor do Kobi é conferido a cada movimento, sem reler o sistema. */
  let layout = displays.current();
  let reported: CurrentDisplay | undefined;
  /** Informa à interface em que monitor o Kobi está (escala e taxa de atualização em uso). */
  const reportDisplay = (): void => {
    const bounds = Rect.create(window.getBounds());
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
  // `moved` não dispara quando o próprio app chama setPosition (X11): cada movimento confere.
  const moveTo = (point: ScreenPoint): void => {
    overlay.moveTo(point).then(reportDisplay).catch(logFailure);
  };

  displays.onChange(() => {
    layout = displays.current();
    keepVisible.execute().then(reportDisplay).catch(logFailure);
  });

  ipcMain.on(CHANNELS.setSilhouette, (_, silhouette: Region) => {
    overlay.reportSilhouette(silhouette);
  });
  ipcMain.on(CHANNELS.setInteractiveRegion, (_, regions: Region[]) => {
    overlay.setInteractiveRegion(regions).catch(logFailure);
  });

  let drag: { cursor: ScreenPoint; window: ScreenPoint } | undefined;
  ipcMain.on(CHANNELS.moveTo, (_, { x, y }: ScreenPoint) => {
    moveTo({ x, y });
  });
  ipcMain.on(CHANNELS.dragStart, (_, cursor: ScreenPoint) => {
    const [x = 0, y = 0] = window.getPosition();
    drag = { cursor, window: { x, y } };
  });
  ipcMain.on(CHANNELS.dragMove, (_, cursor: ScreenPoint) => {
    if (!drag) return;
    moveTo({
      x: drag.window.x + cursor.x - drag.cursor.x,
      y: drag.window.y + cursor.y - drag.cursor.y,
    });
  });
  ipcMain.on(CHANNELS.dragEnd, () => {
    drag = undefined;
    keepVisible.execute().then(reportDisplay).catch(logFailure);
  });
  ipcMain.handle(CHANNELS.planTour, (): TourPlan => {
    const [x = 0, y = 0] = window.getPosition();
    return { stops: layout.tour(), windowSize: WINDOW_SIZE, start: { x, y } };
  });
  ipcMain.handle(CHANNELS.planGlide, async (_, velocity: ScreenPoint): Promise<SampledPath> => {
    const glide = await planGlide.execute(velocity);
    const step = 1 / 120;
    const points: ScreenPoint[] = [];
    for (let t = 0; t < glide.duration; t += step) points.push(glide.positionAt(t));
    points.push(glide.positionAt(glide.duration));
    return { step, points };
  });
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
  window.on('moved', reportDisplay);

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
  window.showInactive();
  reportDisplay();
};

app.on('window-all-closed', () => {
  app.quit();
});
void app.whenReady().then(start);
