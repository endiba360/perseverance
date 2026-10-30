// Ganchos para depurar desde la consola del navegador y para npm run check.
// No forman parte de la simulación: solo exponen estado y atajos en window.

// window.__rover: el controlador del rover (posición, rumbo, velocidad).
// window.__drive(segundos, teclas): conduce a paso fijo sin esperar frames;
// el check lo necesita porque Chrome headless renderiza a menos de 1 FPS.
export function installDebugHooks({ driver, tracks, follow }) {
  window.__rover = driver;
  window.__drive = (seconds, codes) => {
    const dt = 1 / 30;
    codes.forEach((c) => driver.keys.add(c));
    for (let t = 0; t < seconds; t += dt) {
      driver.update(dt);
      tracks.update(driver);
      follow.update(dt);
    }
    codes.forEach((c) => driver.keys.delete(c));
  };
}

// window.__mission: el panel de control de misión. readings() devuelve el
// último valor de cada dato que ya llegó; visible dice si T lo dejó a la vista.
export function installMissionHooks(missionControl) {
  window.__mission = {
    readings: () => Object.fromEntries(missionControl.readings),
    get visible() {
      return missionControl.visible;
    },
  };
}

// window.__sceneReady: se activa tras unos frames con el rover en escena.
// npm run check lo espera antes de conducir y capturar.
let framesRendered = 0;
export function markFrameRendered() {
  if (++framesRendered === 3) window.__sceneReady = true;
}
