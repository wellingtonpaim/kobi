import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

/** Páginas de desenvolvimento do avatar; o protótipo v6 é servido em /kobi-v6.html para comparação. */
export default defineConfig({
  root: fileURLToPath(new URL('./dev', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../prototipos', import.meta.url)),
  server: { port: 5173, strictPort: true },
});
