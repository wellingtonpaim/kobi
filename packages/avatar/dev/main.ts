import { type BodyTone, KobiAvatar } from '../src/index.js';

const wrap = document.querySelector<HTMLDivElement>('#wrap');
const canvas = document.querySelector<HTMLCanvasElement>('#view');
if (!wrap || !canvas) throw new Error('missing #wrap or #view');

const avatar = new KobiAvatar({
  canvas,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
});
/** Acesso para experimentos de calibração no console ou no Playwright. */
(window as unknown as { kobiAvatar: KobiAvatar }).kobiAvatar = avatar;

const fit = (): void => {
  avatar.resize(wrap.clientWidth || 680, wrap.clientHeight || 440, window.devicePixelRatio || 1);
};
fit();
new ResizeObserver(fit).observe(wrap);

document.querySelectorAll<HTMLButtonElement>('[data-led]').forEach((button) => {
  button.addEventListener('click', () => {
    avatar.setLedColor(button.dataset.led ?? '#1e90ff');
  });
});
const NEW_BODY_TONES: readonly (readonly [BodyTone, string])[] = [
  ['pink', 'Rosa'],
  ['blue', 'Azul'],
  ['green', 'Verde'],
  ['brown', 'Marrom'],
  ['amber', 'Âmbar'],
];
const controls = document.querySelector('.controls');
for (const [tone, label] of NEW_BODY_TONES) {
  const button = document.createElement('button');
  button.dataset.body = tone;
  button.textContent = label;
  controls?.append(button);
}

document.querySelectorAll<HTMLButtonElement>('[data-body]').forEach((button) => {
  button.addEventListener('click', () => {
    avatar.setBodyTone(button.dataset.body as BodyTone);
  });
});

let lastX = 0;
canvas.addEventListener('pointerdown', (e) => {
  avatar.setDragging(true);
  lastX = e.clientX;
  wrap.style.cursor = 'grabbing';
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!canvas.hasPointerCapture(e.pointerId)) return;
  avatar.turnBy(e.clientX - lastX);
  lastX = e.clientX;
});
const release = (): void => {
  avatar.setDragging(false);
  wrap.style.cursor = 'grab';
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

const start = performance.now();
const loop = (now: number): void => {
  avatar.render((now - start) / 1000);
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
