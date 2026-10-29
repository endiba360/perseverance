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
const logs = [];
let exitCode = 0;

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('console', (msg) => {
    const text = `[console.${msg.type()}] ${msg.text()}`;
    if (msg.type() === 'error') errors.push(text);
    else if (msg.type() === 'warning') warnings.push(text);
    else if (msg.type() === 'log' || msg.type() === 'info') logs.push(text);
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
  // Conduce un poco (W y luego W+A) para que se vean huellas y la cámara siguiendo
  const roverState = () =>
    page.evaluate(() => {
      const r = window.__rover;
      return r ? `x=${r.position.x.toFixed(2)} z=${r.position.z.toFixed(2)} rumbo=${r.heading.toFixed(2)}` : 'sin rover';
    });
  const fps = await page.evaluate(
    () => new Promise((resolve) => {
      let n = 0;
      const t0 = performance.now();
      const tick = () => (++n < 10 ? requestAnimationFrame(tick) : resolve((n * 1000) / (performance.now() - t0)));
      requestAnimationFrame(tick);
    }),
  );
  logs.push(`[check] ${fps.toFixed(1)} FPS en headless`);
  logs.push(`[check] rover antes de conducir: ${await roverState()}`);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(4000);
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyA');
  await page.keyboard.up('KeyW');
  logs.push(`[check] rover tras teclas reales: ${await roverState()}`);
  // Con tan pocos FPS el teclado apenas lo mueve: simula un recorrido a paso fijo
  const wheelReport = await page.evaluate(() => {
    const rig = window.__rover.wheelRig;
    const byKey = Object.fromEntries(rig.wheels.map((w) => [w.key, w]));
    const deg = (rad) => `${((rad * 180) / Math.PI).toFixed(0)}°`;
    const steering = () => ['LF', 'LM', 'LB', 'RF'].map((k) => `${k}=${deg(byKey[k].steer.rotation.y)}`).join(' ');
    const lines = [];

    window.__drive(6, ['KeyW']);
    // Giro de la rueda en 0.1 s a velocidad máxima: debería ser ≈ v·t / radio
    const before = byKey.LM.spin.rotation.x;
    window.__drive(0.1, ['KeyW']);
    const rolled = (byKey.LM.spin.rotation.x - before + Math.PI * 2) % (Math.PI * 2);
    const expected = (window.__rover.speed * 0.1) / rig.radius;
    lines.push(`ruedas en recta: giro ${rolled.toFixed(2)} rad en 0.1 s (esperado ≈ ${expected.toFixed(2)}), dirección ${steering()}`);

    window.__drive(3, ['KeyW', 'KeyA']);
    lines.push(`ruedas girando con W+A: dirección ${steering()}`);
    window.__drive(3, ['KeyW']);
    window.__drive(2, []); // frena
    window.__drive(4, ['KeyS']); // reversa: también debe dejar huella
    window.__drive(1.5, []);

    // Huellas: ningún triángulo con área debe quedar boca abajo (no se dibujaría)
    const tracks = window.__rover.rover.parent.getObjectByName('tracks');
    const trackStats = () => {
      let faces = 0;
      let upsideDown = 0;
      for (const strip of tracks.children) {
        const p = strip.geometry.attributes.position.array;
        const idx = strip.geometry.index.array;
        for (let t = 0; t < strip.geometry.drawRange.count; t += 3) {
          const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
          const ux = p[b] - p[a], uz = p[b + 2] - p[a + 2];
          const vx = p[c] - p[a], vz = p[c + 2] - p[a + 2];
          const ny = uz * vx - ux * vz; // componente Y de u × v
          if (Math.abs(ny) < 1e-6) continue; // tramo de unión sin área
          faces++;
          if (ny < 0) upsideDown++;
        }
      }
      return { faces, upsideDown };
    };
    const afterReverse = trackStats();
    lines.push(`huellas tras reversa: ${afterReverse.faces} triángulos, ${afterReverse.upsideDown} boca abajo`);

    window.__drive(1.5, ['KeyA']);
    lines.push(`ruedas girando en el sitio: dirección ${steering()}`);
    window.__drive(3, ['KeyA']); // completa más giro sobre su eje
    const afterSpin = trackStats();
    lines.push(
      `huellas al girar en el sitio: +${afterSpin.faces - afterReverse.faces} triángulos, ${afterSpin.upsideDown} boca abajo`,
    );
    window.__drive(1.5, ['KeyW', 'KeyA']);
    return lines;
  });
  wheelReport.forEach((line) => logs.push(`[check] ${line}`));
  logs.push(`[check] rover tras recorrido simulado: ${await roverState()}`);
  // Mantiene W+A durante la captura para que se vean las ruedas orientadas
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(2500);

  await mkdir(fileURLToPath(new URL('../screenshots', import.meta.url)), { recursive: true });
  await page.screenshot({ path: screenshotPath });
  await page.keyboard.up('KeyA');
  await page.keyboard.up('KeyW');
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
if (logs.length) {
  console.log(`\nMensajes (${logs.length}):`);
  logs.forEach((l) => console.log(`  ${l}`));
}
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
