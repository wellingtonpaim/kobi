import { app, type BrowserWindow } from 'electron';
import { createInterface } from 'node:readline';

import { CHANNELS } from '../shared/api.js';

/** Modo de medição da spec 0002, ligado por `--kobi-bench`; só para desenvolvimento. */
export const BENCH_SWITCH = '--kobi-bench';
const PREFIX = '[kobi-bench] ';

export interface BenchControls {
  /** Põe o Kobi parado no monitor `index` da ordem do passeio; diz quantos monitores há. */
  readonly visit: (index: number) => { readonly display: string; readonly of: number };
}

/**
 * Leva ao stdout o resumo de fluidez que a interface publica a cada segundo e aceita
 * comandos pela entrada padrão (`tour`, `visit <n>`, `quit`), para o `scripts/bench.mjs`
 * conduzir as medições sem ninguém clicar no Kobi.
 */
export const attachBenchMode = (window: BrowserWindow, controls: BenchControls): void => {
  window.webContents.on('console-message', ({ message }) => {
    if (message.startsWith(PREFIX)) process.stdout.write(`${message.slice(PREFIX.length)}\n`);
  });
  createInterface({ input: process.stdin }).on('line', (line) => {
    const [command, argument] = line.trim().split(/\s+/);
    if (command === 'tour') window.webContents.send(CHANNELS.startTour);
    if (command === 'visit') {
      const index = Number(argument);
      process.stdout.write(`${JSON.stringify({ visit: { index, ...controls.visit(index) } })}\n`);
    }
    if (command === 'quit') app.quit();
  });
};
