// npm run check: abre la escena en Chrome headless (el Chrome instalado, sin
// descargar navegadores), guarda una captura y lista los errores de consola.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('..', import.meta.url));
const screenshotPath = fileURLToPath(new URL('../screenshots/check.png', import.meta.url));

const server = await createServer({ root, logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
const url = server.resolvedUrls.local[0];

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  // WebGL por software para que funcione sin GPU en modo invisible
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const errors = [];
const warnings = [];
let exitCode = 0;

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('console', (msg) => {
    const text = `[console.${msg.type()}] ${msg.text()}`;
    if (msg.type() === 'error') errors.push(text);
    else if (msg.type() === 'warning') warnings.push(text);
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
  page.on('requestfailed', (req) => errors.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText}`));

  console.log(`Abriendo ${url}`);
  await page.goto(url, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__sceneReady === true, null, { timeout: 60000 });
  } catch {
    errors.push('[check] La escena no marcó window.__sceneReady en 60 s');
  }
  // Deja correr unos frames más (polvo, bloom) antes de capturar
  await page.waitForTimeout(2500);

  await mkdir(fileURLToPath(new URL('../screenshots', import.meta.url)), { recursive: true });
  await page.screenshot({ path: screenshotPath });
  console.log(`Captura: ${screenshotPath}`);
} catch (err) {
  errors.push(`[check] ${err.message}`);
} finally {
  await browser.close();
  await server.close();
}

// Avisos del renderizador por software que no son errores de la escena
const noise = /GPU stall|swiftshader|Automatic fallback to software WebGL/i;
const realWarnings = warnings.filter((w) => !noise.test(w));
if (realWarnings.length) {
  console.log(`\nAvisos (${realWarnings.length}):`);
  realWarnings.forEach((w) => console.log(`  ${w}`));
}
if (errors.length) {
  console.log(`\nErrores (${errors.length}):`);
  errors.forEach((e) => console.log(`  ${e}`));
  exitCode = 1;
} else {
  console.log('\nSin errores de consola.');
}
process.exit(exitCode);
