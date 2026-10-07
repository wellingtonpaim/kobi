import { KobiAvatar } from '@kobi/avatar';
import { Flight, type Point } from '@kobi/domain';

import type { CurrentDisplay, KobiBridge } from '../shared/api.js';

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

// Arrastar com o botão esquerdo; girar com a rodinha; menu com o botão direito.
canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  canvas.setPointerCapture(event.pointerId);
  canvas.style.cursor = 'grabbing';
  tour = [];
  flight = undefined;
  window.kobi.dragStart({ x: event.screenX, y: event.screenY });
});
canvas.addEventListener('pointermove', (event) => {
  if (canvas.hasPointerCapture(event.pointerId))
    window.kobi.dragMove({ x: event.screenX, y: event.screenY });
});
const endDrag = (event: PointerEvent): void => {
  if (!canvas.hasPointerCapture(event.pointerId)) return;
  canvas.releasePointerCapture(event.pointerId);
  canvas.style.cursor = 'grab';
  window.kobi.dragEnd();
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
let flight: { readonly path: Flight; readonly startedAt: number } | undefined;
let tour: Point[] = [];
const flyNext = (now: number): void => {
  const next = tour.shift();
  flight = next
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

  if (flight) {
    const t = now - flight.startedAt;
    window.kobi.moveTo(flight.path.positionAt(t));
    if (t >= flight.path.duration) flyNext(now);
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
