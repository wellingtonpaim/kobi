import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      // Cena three.js: depende de WebGL; verificada por comparação visual com o
      // protótipo (packages/avatar/dev/capture.ts) e por testes ponta a ponta (ADR 0003).
      exclude: ['packages/avatar/src/scene/**'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
