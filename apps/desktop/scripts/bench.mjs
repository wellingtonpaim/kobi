// Medições da spec 0002 (tabela "Medições"): fluidez, CPU, GPU e memória do Kobi.
// Uso: pnpm --filter @kobi/desktop bench   (KOBI_OVERLAY=wayland para a estratégia B)
// Fases: linha de base sem o Kobi, Kobi parado em cada monitor e passeio de teste contínuo.
// Lê /proc e /sys, então só roda no Linux. Feche outras instâncias do Kobi antes.
import { spawn, execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { setTimeout as sleep } from 'node:timers/promises';

import electron from 'electron';

if (process.platform !== 'linux') {
  console.error('bench: só Linux (lê /proc e /sys).');
  process.exit(1);
}

const seconds = (name, fallback) => Number(process.env[name] ?? fallback);
const PHASES = {
  baseline: seconds('KOBI_BENCH_BASELINE', 15),
  warmup: seconds('KOBI_BENCH_WARMUP', 8),
  /** Por monitor. */
  idle: seconds('KOBI_BENCH_IDLE', 15),
  settle: 3,
  tour: seconds('KOBI_BENCH_TOUR', 60),
};
const strategy = process.env.KOBI_OVERLAY === 'wayland' ? 'wayland' : 'x11';
const TICKS_PER_SECOND = Number(execFileSync('getconf', ['CLK_TCK']).toString().trim());
const CPUS = Number(execFileSync('nproc').toString().trim());

const read = (file) => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
};

/** utime + stime e pai de cada processo, a partir de /proc/<pid>/stat. */
const processStat = (pid) => {
  const stat = read(`/proc/${pid}/stat`);
  if (!stat) return undefined;
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
  return { ppid: Number(fields[1]), ticks: Number(fields[11]) + Number(fields[12]) };
};

const allPids = () =>
  readdirSync('/proc')
    .filter((name) => /^\d+$/.test(name))
    .map(Number);

const descendantsOf = (root) => {
  const children = new Map();
  for (const pid of allPids()) {
    const stat = processStat(pid);
    if (!stat) continue;
    children.set(stat.ppid, [...(children.get(stat.ppid) ?? []), pid]);
  }
  const tree = [root];
  for (let i = 0; i < tree.length; i += 1) tree.push(...(children.get(tree[i]) ?? []));
  return tree;
};

const pidsNamed = (name) => allPids().filter((pid) => read(`/proc/${pid}/comm`)?.trim() === name);

const gpuBusyFile = readdirSync('/sys/class/drm')
  .map((card) => `/sys/class/drm/${card}/device/gpu_busy_percent`)
  .find((file) => read(file) !== undefined);

/** Memória proporcional (PSS) somada: não conta duas vezes o que os processos dividem. */
const pssMiB = (pids) =>
  pids.reduce((total, pid) => {
    const match = read(`/proc/${pid}/smaps_rollup`)?.match(/^Pss:\s+(\d+) kB/m);
    return total + (match ? Number(match[1]) / 1024 : 0);
  }, 0);

/** Amostra, a cada segundo, a CPU (% de um núcleo) de grupos de processos e a GPU (%). */
const sampler = (groups) => {
  const last = new Map();
  const ticksOf = (pids) =>
    pids.reduce((sum, pid) => {
      const now = processStat(pid)?.ticks;
      if (now === undefined) return sum;
      const before = last.get(pid) ?? now;
      last.set(pid, now);
      return sum + (now - before);
    }, 0);
  let previous = performance.now();
  for (const pids of Object.values(groups)) ticksOf(pids());
  return () => {
    const now = performance.now();
    const elapsed = (now - previous) / 1000;
    previous = now;
    const sample = { gpu: gpuBusyFile ? Number(read(gpuBusyFile)) : NaN };
    for (const [name, pids] of Object.entries(groups))
      sample[name] = (100 * ticksOf(pids())) / TICKS_PER_SECOND / elapsed;
    return sample;
  };
};

const collect = async (sample, duration, onTick = () => {}) => {
  const samples = [];
  for (let i = 0; i < duration; i += 1) {
    await sleep(1000);
    samples.push(sample());
    onTick();
  }
  return samples;
};

const avg = (values) => values.reduce((a, b) => a + b, 0) / (values.length || 1);
const quantile = (values, q) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(q * (sorted.length - 1))] ?? 0;
};
const f1 = (value) => (Number.isFinite(value) ? value.toFixed(1) : '—');

const system = {
  'gnome-shell': () => pidsNamed('gnome-shell'),
  Xwayland: () => pidsNamed('Xwayland'),
};

console.log(
  `bench: estratégia ${strategy}, ${String(CPUS)} CPUs, GPU ${gpuBusyFile ?? 'sem leitura'}`,
);
console.log(`bench: linha de base sem o Kobi (${String(PHASES.baseline)} s)…`);
const baseline = await collect(sampler(system), PHASES.baseline);

// Mesmo ambiente do scripts/start.mjs.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.', `--ozone-platform=${strategy}`, '--kobi-bench'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env,
});
const appPids = () => descendantsOf(child.pid);

/** Cada fase medida: amostras de CPU/GPU por segundo e resumos de fluidez da interface. */
const runs = [{ label: 'sem o Kobi', samples: baseline, frames: [] }];
let collecting;
let visitReply;
let touring = false;
let lastTourRequest = 0;
const requestTour = () => {
  lastTourRequest = performance.now();
  child.stdin.write('tour\n');
};
createInterface({ input: child.stdout }).on('line', (line) => {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return;
  }
  if (entry.visit) {
    visitReply?.(entry.visit);
    return;
  }
  collecting?.frames.push(entry);
  // Passeio contínuo: quando um termina, começa outro.
  if (touring && !entry.moving && performance.now() - lastTourRequest > 2000) requestTour();
});
const visit = (index) =>
  new Promise((resolve) => {
    visitReply = resolve;
    child.stdin.write(`visit ${String(index)}\n`);
  });

const measure = async (label, duration) => {
  collecting = { label, samples: [], frames: [] };
  collecting.samples = await collect(sample, duration);
  runs.push(collecting);
  collecting = undefined;
};

console.log(`bench: Kobi aberto, aquecendo (${String(PHASES.warmup)} s)…`);
await sleep(PHASES.warmup * 1000);
const sample = sampler({ app: appPids, ...system });

for (let index = 0, total = 1; index < total; index += 1) {
  const { display, of } = await visit(index);
  total = of;
  console.log(`bench: parado no monitor ${display} (${String(PHASES.idle)} s)…`);
  await sleep(PHASES.settle * 1000);
  sample();
  await measure(`parado · monitor ${display}`, PHASES.idle);
}
const idleMemory = pssMiB(appPids());

console.log(`bench: passeio de teste contínuo (${String(PHASES.tour)} s)…`);
touring = true;
requestTour();
await measure('passeio', PHASES.tour);
touring = false;
const tourMemory = pssMiB(appPids());

child.stdin.write('quit\n');
await new Promise((resolve) => child.once('exit', resolve));

const column = (samples, key) => {
  const values = samples.map((s) => s[key]);
  return `${f1(avg(values))} / ${f1(quantile(values, 0.95))}`;
};

console.log(`\n### CPU e GPU (estratégia ${strategy}; média / p95 por segundo)\n`);
console.log(
  '| Fase | Kobi, todos os processos (% de 1 núcleo) | Kobi (% da máquina) | gnome-shell (% de 1 núcleo) | Xwayland (% de 1 núcleo) | GPU ocupada (%) |',
);
console.log('|---|---|---|---|---|---|');
for (const { label, samples } of runs) {
  const own = label === 'sem o Kobi';
  console.log(
    `| ${label} | ${own ? '—' : column(samples, 'app')} | ${own ? '—' : f1(avg(samples.map((s) => s.app)) / CPUS)} | ${column(samples, 'gnome-shell')} | ${column(samples, 'Xwayland')} | ${column(samples, 'gpu')} |`,
  );
}

console.log(
  `\nMemória do Kobi (PSS, todos os processos): parado ${f1(idleMemory)} MiB · depois do passeio ${f1(tourMemory)} MiB`,
);

console.log('\n### Fluidez (resumos de 1 s)\n');
console.log(
  '| Fase · monitor | s | fps médio | fps mín | perdidos | intervalo p95 (pior s) | intervalo máx | render p95 (pior s) |',
);
console.log('|---|---|---|---|---|---|---|---|');
const monitorOf = (e) =>
  e.display
    ? `${e.display.id} (${String(Math.round(e.display.refreshRateHz))} Hz, ${String(e.display.scaleFactor)}×)`
    : '?';
const fluencyRow = (label, list) => {
  console.log(
    `| ${label} | ${String(list.length)} | ${f1(avg(list.map((e) => e.frames)))} | ${String(Math.min(...list.map((e) => e.frames)))} | ${String(list.reduce((n, e) => n + e.dropped, 0))} | ${f1(Math.max(...list.map((e) => e.interval.p95)))} | ${f1(Math.max(...list.map((e) => e.interval.max)))} | ${f1(Math.max(...list.map((e) => e.render.p95)))} |`,
  );
};
for (const { label, frames } of runs.slice(1)) {
  if (label !== 'passeio') {
    fluencyRow(`${label}: ${monitorOf(frames.at(-1) ?? {})}`, frames);
    continue;
  }
  // Segundos com travessia misturam monitores de taxas diferentes: ficam numa linha própria.
  for (const [monitor, list] of Map.groupBy(
    frames.filter((e) => !e.crossed),
    monitorOf,
  ))
    fluencyRow(`passeio · ${monitor}`, list);
  const crossings = frames.filter((e) => e.crossed);
  if (crossings.length > 0) fluencyRow('passeio · segundos com travessia', crossings);
}
