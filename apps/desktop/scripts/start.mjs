// Abre o Kobi. KOBI_OVERLAY escolhe a estratégia do spike (spec 0002): x11 (padrão) ou wayland.
import { spawn } from 'node:child_process';

import electron from 'electron';

const strategy = process.env.KOBI_OVERLAY === 'wayland' ? 'wayland' : 'x11';
// Terminais do VS Code herdam ELECTRON_RUN_AS_NODE=1, que faria o Electron rodar como Node puro.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electron, ['.', `--ozone-platform=${strategy}`, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});
child.on('exit', (code) => process.exit(code ?? 0));
