// Compila o processo principal e o preload (esbuild) e a interface (Vite).
import { build as esbuild } from 'esbuild';
import { build as vite } from 'vite';

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  sourcemap: true,
  logLevel: 'warning',
};

await vite({
  configFile: new URL('../vite.config.ts', import.meta.url).pathname,
  logLevel: 'warn',
});
await esbuild({ ...common, entryPoints: ['src/main/main.ts'], outfile: 'dist/main.cjs' });
await esbuild({ ...common, entryPoints: ['src/preload/preload.ts'], outfile: 'dist/preload.cjs' });
