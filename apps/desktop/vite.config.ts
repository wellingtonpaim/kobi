import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

/** Interface do Kobi (renderer); o processo principal e o preload são compilados pelo esbuild. */
export default defineConfig({
  root: fileURLToPath(new URL('./src/renderer', import.meta.url)),
  base: './',
  build: {
    outDir: fileURLToPath(new URL('./dist/renderer', import.meta.url)),
    emptyOutDir: true,
    // App local: o tamanho do pacote do three.js não afeta o carregamento.
    chunkSizeWarningLimit: 2000,
  },
});
