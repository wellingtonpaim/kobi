import { KobiAvatar } from '@kobi/avatar';
import { Flight, type Point } from '@kobi/domain';

import type { CurrentDisplay, KobiBridge } from '../shared/api.js';
import { DragGesture } from './drag-gesture.js';
import { FrameStats } from './frame-stats.js';
import { boundingBox, type Region } from './hit-region.js';
import { HitSampler } from './hit-sampler.js';
import { sampledTrajectory, type Trajectory } from './trajectory.js';

declare global {
  interface Window {
    readonly kobi: KobiBridge;
  }
}

const canvas = document.querySelector('canvas');
const diagnostics = document.querySelector<HTMLDivElement>('#diagnostics');
if (!canvas || !diagnostics) throw new Error('renderer markup missing');

const avatar = new KobiAvatar({
  canvas,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
});

/** Tamanho e escala do monitor atual; refeito quando o Kobi muda para um monitor de outra escala. */
const fit = (): void => {
  avatar.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  window
    .matchMedia(`(resolution: ${String(window.devicePixelRatio)}dppx)`)
    .addEventListener('change', fit, { once: true });
};
fit();
window.addEventListener('resize', fit);

/** O que deve caber na tela: o Kobi e, aberto, o painel de diagnóstico (para ser lido). */
let solidArea: Region | undefined;
let diagnosticsRegion: Region | undefined;
const reportSilhouette = (): void => {
  if (!solidArea) return;
  window.kobi.setSilhouette(
    diagnosticsRegion ? boundingBox(solidArea, diagnosticsRegion) : solidArea,
  );
};

// Clique atravessa fora do Kobi (só a área visível dele recebe o mouse), e o processo
// principal sabe onde o Kobi é sólido, para ele chegar até a borda real das telas.
const hitSampler = new HitSampler(
  (width, height) => avatar.sampleCoverage(width, height),
  {
    region: (regions) => {
      window.kobi.setInteractiveRegion(regions);
    },
    silhouette: (silhouette) => {
      solidArea = silhouette;
      reportSilhouette();
    },
  },
  (error) => {
    console.error('[kobi] hit sampling failed', error);
  },
);

/** Movimento que a janela está seguindo agora (voo do passeio ou deslizamento). */
let motion: { readonly path: Trajectory; readonly startedAt: number } | undefined;
let tour: Point[] = [];

/** Canto superior esquerdo da janela, informado pelo processo principal a cada movimento. */
let windowPosition: Point = { x: window.screenX, y: window.screenY };
window.kobi.onWindowMoved((topLeft) => {
  windowPosition = topLeft;
});

// Arrastar com o botão esquerdo; girar com a rodinha; menu com o botão direito.
// Soltar com o mouse em movimento arremessa o Kobi (spec 0005); clicar durante o voo o pega.
const drag = new DragGesture({
  start: (cursor) => {
    canvas.style.cursor = 'grabbing';
    tour = [];
    motion = undefined;
    window.kobi.dragStart(cursor);
  },
  move: (cursor) => {
    window.kobi.dragMove(cursor);
  },
  end: (cursor) => {
    canvas.style.cursor = 'grab';
    void window.kobi.dragEnd(cursor).then((path) => {
      if (path) motion = { path: sampledTrajectory(path), startedAt: performance.now() / 1000 };
    });
  },
});
canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  canvas.setPointerCapture(event.pointerId);
  drag.press({ x: event.screenX, y: event.screenY });
});
canvas.addEventListener('pointermove', (event) => {
  drag.move(event.buttons, { x: event.screenX, y: event.screenY });
});
const release = (event: PointerEvent): void => {
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  drag.release({ x: event.screenX, y: event.screenY });
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('lostpointercapture', () => {
  drag.lost();
});
canvas.addEventListener('wheel', (event) => {
  avatar.turnBy(event.deltaY * 0.5);
});
canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.kobi.showMenu();
});

// Passeio de teste: percorre todos os monitores conectados, seja qual for a disposição.
const flyNext = (now: number): void => {
  const next = tour.shift();
  motion = next ? { path: Flight.between(windowPosition, next), startedAt: now } : undefined;
};
window.kobi.onStartTour(() => {
  void window.kobi.planTour().then(({ stops, windowSize, start }) => {
    const topLeft = ({ x, y }: Point): Point => ({
      x: x - windowSize.width / 2,
      y: y - windowSize.height / 2,
    });
    tour = [...stops.map(topLeft), start];
    flyNext(performance.now() / 1000);
  });
});

// Diagnóstico: fps, tempo de quadro e o monitor atual.
let display: CurrentDisplay | undefined;
/** Se o Kobi mudou de monitor no último segundo (a travessia é medida à parte). */
let crossed = false;
window.kobi.onDisplayChanged((current) => {
  crossed ||= display !== undefined;
  display = current;
});
/** Área do painel já informada; no X11 a forma da janela recorta o desenho e precisa incluí-lo. */
let diagnosticsArea = 'null';
const reportDiagnosticsArea = (): void => {
  const area =
    diagnostics.style.display === 'block'
      ? {
          x: diagnostics.offsetLeft,
          y: diagnostics.offsetTop,
          width: diagnostics.offsetWidth,
          height: diagnostics.offsetHeight,
        }
      : undefined;
  const key = JSON.stringify(area ?? null);
  if (key === diagnosticsArea) return;
  diagnosticsArea = key;
  diagnosticsRegion = area;
  window.kobi.setDiagnosticsArea(area);
  reportSilhouette();
};
window.kobi.onToggleDiagnostics(() => {
  diagnostics.style.display = diagnostics.style.display === 'block' ? 'none' : 'block';
  reportDiagnosticsArea();
});

/** Velocidade da janela na tela, suavizada: o Kobi vira e inclina em qualquer deslocamento. */
let lastPosition: Point = windowPosition;
let velocity: Point = { x: 0, y: 0 };
let lastFrame = performance.now();
const frameStats = new FrameStats();
let statsSince = performance.now();
/** Modo de medição (spec 0002): o resumo de cada segundo vai para o stdout do app. */
const bench = new URLSearchParams(location.search).has('bench');
if (new URLSearchParams(location.search).has('diagnostics')) {
  diagnostics.style.display = 'block';
  reportDiagnosticsArea();
}

const loop = (nowMs: number): void => {
  const now = nowMs / 1000;
  const dt = Math.max(1e-3, (nowMs - lastFrame) / 1000);
  lastFrame = nowMs;

  if (motion) {
    const t = now - motion.startedAt;
    window.kobi.moveTo(motion.path.positionAt(t));
    if (t >= motion.path.duration) flyNext(now);
  }

  const position = windowPosition;
  const blend = 1 - Math.exp(-dt / 0.06);
  velocity = {
    x: velocity.x + ((position.x - lastPosition.x) / dt - velocity.x) * blend,
    y: velocity.y + ((position.y - lastPosition.y) / dt - velocity.y) * blend,
  };
  lastPosition = position;
  avatar.setTravelVelocity(velocity);

  const renderStart = performance.now();
  avatar.render(now);
  frameStats.add(nowMs, performance.now() - renderStart);
  hitSampler.update(nowMs, window.innerWidth, window.innerHeight, avatar.settled);

  if (nowMs - statsSince >= 1000) {
    const stats = frameStats.take(display?.refreshRateHz ?? 60);
    const ms = (value: number): string => value.toFixed(1);
    const monitor = display
      ? `${display.id} · ${String(display.scaleFactor)}× · ${String(Math.round(display.refreshRateHz))} Hz`
      : '?';
    diagnostics.textContent =
      `${String(stats.frames)} fps · ${String(stats.dropped)} perdidos\n` +
      `intervalo p50 ${ms(stats.interval.p50)} p95 ${ms(stats.interval.p95)} máx ${ms(stats.interval.max)} ms\n` +
      `render p50 ${ms(stats.render.p50)} p95 ${ms(stats.render.p95)} p99 ${ms(stats.render.p99)} ms\n` +
      monitor;
    reportDiagnosticsArea();
    if (bench)
      console.log(
        `[kobi-bench] ${JSON.stringify({ ...stats, display, position: windowPosition, crossed, moving: !!motion })}`,
      );
    crossed = false;
    statsSince = nowMs;
  }
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
