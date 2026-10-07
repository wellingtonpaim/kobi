/**
 * Captura o protótipo v6 e o avatar portado no mesmo instante da animação,
 * para comparar a fidelidade visual. Requer o servidor de desenvolvimento
 * (`pnpm --filter @kobi/avatar dev`) rodando.
 *
 * Uso: node dev/capture.ts <pasta-de-saída> [segundos] [led] [corpo]
 */
import { chromium } from '@playwright/test';

const [outDir = '.', seconds = '1.3', led = '', body = ''] = process.argv.slice(2);
const pages = {
  prototype: 'http://localhost:5173/kobi-v6.html',
  ported: 'http://localhost:5173/index.html',
};

// GPU real quando houver (bem mais rápido); a variável KOBI_CAPTURE_SOFTWARE=1 força o WebGL por software.
const gpu = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'];
const software = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: process.env.KOBI_CAPTURE_SOFTWARE ? software : gpu });
for (const [name, url] of Object.entries(pages)) {
  const page = await browser.newPage({
    viewport: { width: 960, height: 900 },
    colorScheme: 'light',
  });
  // Sem o cliente de recarga do Vite: uma recarga no meio da captura deixaria a página em branco.
  await page.route(/@vite\/client/, (r) =>
    r.fulfill({ body: '', contentType: 'application/javascript' }),
  );
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.goto(url, { waitUntil: 'networkidle' });
  if (led) await page.click(`[data-led="${led}"]`);
  if (body) await page.click(`[data-body="${body}"]`);
  await page.clock.runFor(Number(seconds) * 1000);
  await page.locator('#view').screenshot({ path: `${outDir}/${name}.png` });
  await page.close();
}
await browser.close();
