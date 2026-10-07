import { KobiAvatar } from '@kobi/avatar';
import { Flight, type Point } from '@kobi/domain';

import type { CurrentDisplay, KobiBridge } from '../shared/api.js';
import { HitSampler } from './hit-sampler.js';
import { ReleaseTracker } from './release-tracker.js';
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

// Clique atravessa fora do Kobi (só a área visível dele recebe o mouse), e o processo
// principal sabe onde o Kobi é sólido, para ele chegar até a borda real das telas.
const hitSampler = new HitSampler(canvas, {
  region: (regions) => {
    window.kobi.setInteractiveRegion(regions);
  },
  silhouette: (silhouette) => {
    window.kobi.setSilhouette(silhouette);
  },
});

/** Movimento que a janela está seguindo agora (voo do passeio ou deslizamento). */
let motion: { readonly path: Trajectory; readonly startedAt: number } | undefined;
let tour: Point[] = [];

// Arrastar com o botão esquerdo; girar com a rodinha; menu com o botão direito.
// Soltar com o mouse em movimento arremessa o Kobi (spec 0005); clicar durante o voo o pega.
const release = new ReleaseTracker();
canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  canvas.setPointerCapture(event.pointerId);
  canvas.style.cursor = 'grabbing';
  tour = [];
  motion = undefined;
  release.reset();
  release.add({ x: event.screenX, y: event.screenY }, event.timeStamp);
  window.kobi.dragStart({ x: event.screenX, y: event.screenY });
});
canvas.addEventListener('pointermove', (event) => {
  if (!canvas.hasPointerCapture(event.pointerId)) return;
  for (const e of event.getCoalescedEvents())
    release.add({ x: e.screenX, y: e.screenY }, e.timeStamp);
  window.kobi.dragMove({ x: event.screenX, y: event.screenY });
});
const endDrag = (event: PointerEvent): void => {
  if (!canvas.hasPointerCapture(event.pointerId)) return;
  canvas.releasePointerCapture(event.pointerId);
  canvas.style.cursor = 'grab';
  window.kobi.dragEnd();
  const throwVelocity = release.velocityAt(event.timeStamp);
  if (throwVelocity.x === 0 && throwVelocity.y === 0) return;
  void window.kobi.planGlide(throwVelocity).then((path) => {
    motion = { path: sampledTrajectory(path), startedAt: performance.now() / 1000 };
  });
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
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
  motion = next
    ? { path: Flight.between({ x: window.screenX, y: window.screenY }, next), startedAt: now }
    : undefined;
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
window.kobi.onDisplayChanged((current) => {
  display = current;
});
window.kobi.onToggleDiagnostics(() => {
  diagnostics.style.display = diagnostics.style.display === 'block' ? 'none' : 'block';
});

/** Velocidade da janela na tela, suavizada: o Kobi vira e inclina em qualquer deslocamento. */
let lastPosition: Point = { x: window.screenX, y: window.screenY };
let velocity: Point = { x: 0, y: 0 };
let lastFrame = performance.now();
const frameTimes: number[] = [];
let statsSince = performance.now();

const loop = (nowMs: number): void => {
  const now = nowMs / 1000;
  const dt = Math.max(1e-3, (nowMs - lastFrame) / 1000);
  lastFrame = nowMs;

  if (motion) {
    const t = now - motion.startedAt;
    window.kobi.moveTo(motion.path.positionAt(t));
    if (t >= motion.path.duration) flyNext(now);
  }

  const position = { x: window.screenX, y: window.screenY };
  const blend = 1 - Math.exp(-dt / 0.06);
  velocity = {
    x: velocity.x + ((position.x - lastPosition.x) / dt - velocity.x) * blend,
    y: velocity.y + ((position.y - lastPosition.y) / dt - velocity.y) * blend,
  };
  lastPosition = position;
  avatar.setTravelVelocity(velocity);

  const renderStart = performance.now();
  avatar.render(now);
  frameTimes.push(performance.now() - renderStart);
  hitSampler.update(nowMs, window.innerWidth, window.innerHeight, avatar.settled);

  if (nowMs - statsSince >= 1000) {
    const sorted = [...frameTimes].sort((a, b) => a - b);
    const pick = (q: number): string =>
      (sorted[Math.floor(q * (sorted.length - 1))] ?? 0).toFixed(1);
    const monitor = display
      ? `${display.id} · ${String(display.scaleFactor)}× · ${String(Math.round(display.refreshRateHz))} Hz`
      : '?';
    diagnostics.textContent = `${String(frameTimes.length)} fps · render p50 ${pick(0.5)} p95 ${pick(0.95)} p99 ${pick(0.99)} ms\n${monitor}`;
    frameTimes.length = 0;
    statsSince = nowMs;
  }
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
