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

  // NASA responde 403 a los navegadores que se identifican como HeadlessChrome;
  // el check baja el JSON real desde Node y se lo entrega a la página sin cambios
  const waypointsUrl = 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json';
  await page.route(waypointsUrl, async (route) => {
    const res = await fetch(waypointsUrl);
    await route.fulfill({
      status: res.status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: await res.text(),
    });
  });

  console.log(`Abriendo ${url}`);
  await page.goto(url, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__sceneReady === true, null, { timeout: 60000 });
  } catch {
    errors.push('[check] La escena no marcó window.__sceneReady en 60 s');
  }
  // Control de misión: los 4 datos reales deben llegar y la tecla T debe ocultarlo
  const missionKeys = ['distance', 'elevation', 'tilt', 'lightTime'];
  try {
    await page.waitForFunction(
      (keys) => {
        const r = window.__mission?.readings() ?? {};
        return keys.every((k) => Number.isFinite(r[k]?.value));
      },
      missionKeys,
      { timeout: 30000 },
    );
  } catch {
    const got = await page.evaluate(() => Object.keys(window.__mission?.readings() ?? {}));
    errors.push(`[check] Control de misión: faltan datos tras 30 s (llegaron: ${got.join(', ') || 'ninguno'})`);
  }
  const readings = await page.evaluate(() => window.__mission?.readings() ?? {});
  for (const key of missionKeys) {
    const r = readings[key];
    if (r) logs.push(`[check] control de misión · ${key} = ${r.value.toFixed(3)} (sol ${Math.floor(r.sol)}, ${r.points} puntos)`);
  }
  // A menos de 1 FPS la transición tarda varios segundos: espera a que termine
  const panelShown = async (visible) => {
    try {
      await page.waitForFunction(
        (v) => getComputedStyle(document.querySelector('.mission')).visibility === v,
        visible ? 'visible' : 'hidden',
        { timeout: 15000 },
      );
    } catch {
      // se reporta abajo con el estado que haya
    }
    return page.evaluate(() => ({
      flag: window.__mission?.visible,
      css: getComputedStyle(document.querySelector('.mission')).visibility,
    }));
  };
  await page.keyboard.press('KeyT');
  const hidden = await panelShown(false);
  await page.keyboard.press('KeyT');
  const shown = await panelShown(true);
  if (hidden.flag !== false || hidden.css !== 'hidden' || shown.flag !== true || shown.css !== 'visible') {
    errors.push(`[check] La tecla T no alterna el panel (tras 1 T: ${JSON.stringify(hidden)}, tras 2: ${JSON.stringify(shown)})`);
  } else {
    logs.push('[check] control de misión · T lo oculta y lo vuelve a mostrar');
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

  // Rocas: la grande debe frenar al rover sin traslaparse y la pequeña debe
  // levantarlo al pasar. Se conduce solo el controlador (sin huellas) y luego el
  // rover vuelve a donde estaba, para no alterar la captura.
  const rockReport = await page.evaluate(() => {
    const d = window.__rover;
    const field = window.__rocks;
    const saved = { x: d.position.x, z: d.position.z, heading: d.heading };
    const { halfTrack, halfBase, width, radius } = d.wheels;
    const step = (seconds, codes) => {
      codes.forEach((c) => d.keys.add(c));
      const samples = [];
      for (let t = 0; t < seconds; t += 1 / 30) {
        d.update(1 / 30);
        const q = d.rover.quaternion;
        samples.push({ x: d.position.x, z: d.position.z, y: d.position.y, upY: 1 - 2 * (q.x * q.x + q.z * q.z), bump: d.bump });
      }
      codes.forEach((c) => d.keys.delete(c));
      return samples;
    };
    // Coloca el rover a `back` metros de un punto, mirándolo y corrido `offset` de lado
    const aim = (target, back, offset = 0) => {
      const dx = target.x - saved.x;
      const dz = target.z - saved.z;
      d.heading = Math.atan2(dx, dz);
      const fx = Math.sin(d.heading), fz = Math.cos(d.heading);
      d.position.set(target.x - fx * back + fz * offset, 0, target.z - fz * back - fx * offset);
      d.speed = 0;
      d.turnSpeed = 0;
      d._placeOnGround(1);
    };
    const near = (list) =>
      list.sort((a, b) => Math.hypot(a.x - saved.x, a.z - saved.z) - Math.hypot(b.x - saved.x, b.z - saved.z))[0];
    const result = { errors: [], lines: [] };

    // Roca grande: de frente, 6 s con W
    const big = near(field.rocks.filter((r) => !r.climbable));
    aim(big, big.radius + halfBase + radius + 3);
    step(6, ['KeyW']);
    const fx = Math.sin(d.heading), fz = Math.cos(d.heading);
    const dx = big.x - d.position.x, dz = big.z - d.position.z;
    const along = Math.max(-halfBase - radius, Math.min(halfBase + radius, dx * fx + dz * fz));
    const side = Math.max(-halfTrack - width / 2, Math.min(halfTrack + width / 2, dx * fz - dz * fx));
    const gap = Math.hypot(dx - fx * along - fz * side, dz - fz * along + fx * side) - big.radius;
    result.lines.push(
      `roca grande (alto ${big.height.toFixed(2)} m, radio ${big.radius.toFixed(2)} m): se detuvo a ${gap.toFixed(3)} m del borde, velocidad ${d.speed.toFixed(2)} m/s`,
    );
    if (gap < -0.01 || Math.abs(d.speed) > 0.05) result.errors.push('[check] El rover atravesó o no se detuvo ante la roca grande');

    // Roca pequeña: la rueda izquierda pasa por encima; se compara con el mismo
    // recorrido sin rocas para medir cuánto subió y se ladeó
    const small = near(field.rocks.filter((r) => r.climbable && r.height > 0.15 && r.radius > 0.25));
    const run = (rocks) => {
      d.rocks = rocks;
      aim(small, 4, -halfTrack);
      return step(3.5, ['KeyW']);
    };
    const withRocks = run(field);
    const without = run(null);
    d.rocks = field;
    let lift = 0;
    let tilt = 0;
    withRocks.forEach((s, i) => {
      lift = Math.max(lift, s.y - without[i].y);
      tilt = Math.max(tilt, Math.abs(Math.acos(Math.min(1, s.upY)) - Math.acos(Math.min(1, without[i].upY))));
    });
    const last = withRocks.at(-1);
    const passed = (last.x - small.x) * Math.sin(d.heading) + (last.z - small.z) * Math.cos(d.heading) > 0;
    result.lines.push(
      `roca pequeña (alto ${small.height.toFixed(2)} m): el rover subió ${(lift * 100).toFixed(1)} cm, se ladeó ${((tilt * 180) / Math.PI).toFixed(1)}° y ${passed ? 'pasó al otro lado' : 'no la cruzó'}`,
    );
    if (lift < 0.03 || !passed) result.errors.push('[check] El rover no trepó la roca pequeña');

    // Sacudida que hace temblar la cámara: debe aparecer sobre la piedra y ser 0 en la arena
    const total = (samples) => samples.slice(1).reduce((sum, s) => sum + s.bump, 0);
    result.lines.push(
      `sacudida para la cámara: ${total(withRocks).toFixed(2)} m sobre la piedra, ${total(without).toFixed(2)} m en la arena`,
    );
    if (total(withRocks) < 0.1 || total(without) > 0) result.errors.push('[check] La sacudida de la cámara no responde a la piedra');

    d.position.set(saved.x, 0, saved.z);
    d.heading = saved.heading;
    d.speed = 0;
    d._placeOnGround(1);
    return result;
  });
  rockReport.lines.forEach((line) => logs.push(`[check] ${line}`));
  errors.push(...rockReport.errors);

  // Switch del temblor: activado por defecto; con un clic real se apaga (el
  // trauma queda en 0 y la cámara no se mueve) y con otro vuelve a funcionar
  const shakeState = () =>
    page.evaluate(() => {
      const shake = window.__shake;
      const cam = shake.camera;
      const before = cam.quaternion.clone();
      shake.update(1 / 30, 1.37, 0.15); // una sacudida de 15 cm, como al pisar una piedra
      const turned = cam.quaternion.angleTo(before);
      const trauma = shake.trauma;
      cam.quaternion.copy(before);
      shake.trauma = 0;
      return {
        checked: document.querySelector('.hud-switch input').checked,
        enabled: shake.enabled,
        trauma,
        turnedDeg: (turned * 180) / Math.PI,
      };
    });
  const describeShake = (s) =>
    `switch ${s.checked ? 'activado' : 'desactivado'}, enabled=${s.enabled}, trauma ${s.trauma.toFixed(2)}, cámara girada ${s.turnedDeg.toFixed(3)}°`;
  const shakeOn = await shakeState();
  await page.click('.hud-switch');
  const shakeOff = await shakeState();
  await page.click('.hud-switch');
  const shakeBack = await shakeState();
  logs.push(`[check] temblor por defecto: ${describeShake(shakeOn)}`);
  logs.push(`[check] temblor tras un clic: ${describeShake(shakeOff)}`);
  logs.push(`[check] temblor tras otro clic: ${describeShake(shakeBack)}`);
  const works = (s) => s.checked && s.enabled && s.trauma > 0 && s.turnedDeg > 0;
  if (!works(shakeOn)) errors.push('[check] El temblor de cámara no está activado o no funciona por defecto');
  // angleTo entre cuaterniones iguales puede dar ~1e-8° por redondeo
  if (shakeOff.checked || shakeOff.enabled || shakeOff.trauma !== 0 || shakeOff.turnedDeg > 1e-4) {
    errors.push('[check] El switch no apaga el temblor de cámara');
  }
  if (!works(shakeBack)) errors.push('[check] El switch no vuelve a encender el temblor de cámara');
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
