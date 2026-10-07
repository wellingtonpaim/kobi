import { Flight, type Point } from '@kobi/domain';

import { BODY_TONES, type BodyTone, KobiAvatar } from '../src/index.js';

const SIZE = { width: 300, height: 400 } as const;

const frame = document.querySelector<HTMLDivElement>('#kobi');
const canvas = frame?.querySelector('canvas');
const target = document.querySelector<HTMLDivElement>('#target');
const stats = document.querySelector<HTMLDivElement>('#stats');
if (!frame || !canvas || !target || !stats) throw new Error('playground markup missing');

const avatar = new KobiAvatar({
  canvas,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
});
avatar.resize(SIZE.width, SIZE.height, window.devicePixelRatio || 1);
(window as unknown as { kobiAvatar: KobiAvatar }).kobiAvatar = avatar;

const bodies = document.querySelector('#bodies');
for (const tone of Object.keys(BODY_TONES) as BodyTone[]) {
  const button = document.createElement('button');
  button.textContent = tone;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    avatar.setBodyTone(tone);
  });
  bodies?.append(button);
}

const SPEEDS: readonly (readonly [string, number])[] = [
  ['calmo', 400],
  ['normal', 700],
  ['rápido', 1300],
];
let maxSpeed = 1300;
const speeds = document.querySelector('#speeds');
for (const [label, value] of SPEEDS) {
  const button = document.createElement('button');
  button.textContent = label;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    maxSpeed = value;
  });
  speeds?.append(button);
}

/** Posição do canto superior esquerdo da "janela" do Kobi, como no app. */
let position: Point = { x: innerWidth / 2 - SIZE.width / 2, y: innerHeight / 2 - SIZE.height / 2 };
let flight: Flight | undefined;
let flightStart = 0;
let queue: Point[] = [];

const flyTo = (center: Point, now: number): void => {
  const destination = { x: center.x - SIZE.width / 2, y: center.y - SIZE.height / 2 };
  flight = Flight.between(position, destination, { maxSpeed });
  flightStart = now;
  target.style.display = 'block';
  target.style.left = `${String(center.x)}px`;
  target.style.top = `${String(center.y)}px`;
};

document.addEventListener('click', (event) => {
  if ((event.target as HTMLElement).closest('.panel')) return;
  queue = [];
  flyTo({ x: event.clientX, y: event.clientY }, performance.now() / 1000);
});

document.querySelector('#tour')?.addEventListener('click', (event) => {
  event.stopPropagation();
  const m = 220;
  queue = [
    { x: m, y: m },
    { x: innerWidth - m, y: innerHeight - m },
    { x: innerWidth - m, y: m },
    { x: m, y: innerHeight - m },
    { x: innerWidth / 2, y: innerHeight / 2 },
  ];
  const next = queue.shift();
  if (next) flyTo(next, performance.now() / 1000);
});

const frameTimes: number[] = [];
let last = performance.now();

const loop = (nowMs: number): void => {
  const now = nowMs / 1000;
  if (flight) {
    const t = now - flightStart;
    position = flight.positionAt(t);
    avatar.setTravelVelocity(flight.velocityAt(t));
    if (t >= flight.duration) {
      flight = undefined;
      target.style.display = 'none';
      const next = queue.shift();
      if (next) flyTo(next, now);
    }
  } else {
    avatar.setTravelVelocity({ x: 0, y: 0 });
  }
  frame.style.transform = `translate(${String(position.x)}px, ${String(position.y)}px)`;

  const started = performance.now();
  avatar.render(now);
  frameTimes.push(performance.now() - started);
  if (frameTimes.length >= 60) {
    const sorted = [...frameTimes].sort((a, b) => a - b);
    const fps = (frameTimes.length * 1000) / (nowMs - last);
    stats.textContent = `${fps.toFixed(0)} fps · render p50 ${(sorted[30] ?? 0).toFixed(1)} ms · p95 ${(sorted[56] ?? 0).toFixed(1)} ms`;
    frameTimes.length = 0;
    last = nowMs;
  }
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
