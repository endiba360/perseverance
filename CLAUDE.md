# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio.

## Proyecto

Simulación 3D del rover **Perseverance** de la NASA en la superficie de Marte (cráter Jezero). Proyecto de aprendizaje (Platzi).

Objetivos de la simulación:
- Modelo 3D del rover: cuerpo, mástil con cámaras (Mastcam-Z/SuperCam), brazo robótico, sistema de suspensión rocker-bogie y 6 ruedas.
- Terreno marciano con relieve, rocas, iluminación y cielo característicos de Marte.
- Conducción del rover (teclado) con ruedas que giran y suspensión que se adapta al terreno.
- Cámara orbital y cámaras desde el punto de vista del rover.

## Estado actual

Paisaje marciano cinematográfico (dunas, rocas, cielo caramelo con polvo, sol de tarde, Fobos y Deimos) con el modelo oficial de Perseverance de la NASA a tamaño real: se conduce con WASD/flechas, deja huellas y la cámara lo sigue. Un panel de control de misión (tecla T) muestra 4 datos reales de Percy con el patrón de telemetría de Open MCT. Las rocas de más de 40 cm lo detienen y las más bajas las trepa; al pasar sobre ellas la cámara tiembla, y un switch del HUD (activado por defecto) permite apagar el temblor. Pendiente: vistas desde las cámaras del rover.

## Stack

- **Three.js** (r186) para el render 3D, **Vite** como servidor de desarrollo y bundler, JavaScript con módulos ES.
- **playwright-core** solo para `npm run check`; usa el Chrome instalado (`channel: 'chrome'`), no descarga navegadores.
- Node 26 / npm 11 en la máquina de desarrollo; el mínimo para el proyecto es Node 20.19 (lo pide Vite 8).

## Comandos

- `npm install`: instala dependencias y, en `postinstall`, copia el decodificador Draco a `public/draco/` (no está en git).
- `npm run dev`: servidor de desarrollo en http://localhost:5173 (con HMR).
- `npm run build` / `npm run preview`: build de producción en `dist/` y su vista previa.
- `npm run check`: levanta Vite en otro puerto, abre la página en Chrome headless (WebGL por SwiftShader), guarda `screenshots/check.png` y lista errores/avisos de consola; termina con código 1 si hay errores. Córrelo tras cada cambio visual grande y revisa la captura.

## Estructura

```
index.html
src/
  main.js              punto de entrada: arma motor + mundo + rover y define qué se actualiza cada frame
  engine.js            renderer, escena, cámara, OrbitControls, posprocesado, resize y bucle de animación;
                       start(onFrame, beforeRender): beforeRender corre tras controls.update, antes de dibujar
  debug.js             ganchos en window para la consola y npm run check (no son parte de la simulación)
  world/world.js       arma el paisaje completo y lo actualiza cada frame; devuelve también el RockField
  world/terrain.js     dunas + relieve; getHeight(x, z) = función exacta, getSurfaceHeight(x, z) = altura
                       de la malla dibujada (mismos triángulos que PlaneGeometry); usa esta para apoyar cosas
  world/sky.js         shader del cielo (degradado, polvo, halo azulado, disco solar HDR)
  world/lighting.js    sol direccional con sombras (sigue al objetivo de la cámara) + hemisférica
  world/rocks.js       rocas procedurales con InstancedMesh; registra cada una en el RockField
  world/rockField.js   cuadrícula con posición, radio y altura de cada roca (near, heightAt)
  world/moons.js       Fobos y Deimos con sombreado propio
  world/dust.js        partículas de polvo con viento
  rover/rover.js       carga el GLB (Draco), fija la pose de conducción y lista las piezas que son cámaras
  rover/controller.js  conducción WASD/flechas; apoya el rover en sus 6 ruedas e inclina según el terreno
  rover/wheels.js      separa las 6 ruedas del modelo; rodadura y dirección de las esquinas
  rover/collisions.js  choque con las rocas grandes: rectángulo del rover contra círculo de cada roca
  rover/tracks.js      huellas: tiras con búfer circular y textura de grousers
  rover/followCamera.js OrbitControls que siguen al rover y se colocan detrás al conducir
  rover/cameraShake.js temblor de cámara al pasar sobre piedras (ver "Física con las rocas")
  telemetry/telemetry.js  mini TelemetryAPI al estilo Open MCT: cada dato con nombre, unidad y proveedor;
                       request() = historial de la misión, subscribe() = en vivo. Datos {sol, value}
  telemetry/waypointsProvider.js  distancia, altura e inclinación del JSON de paradas de la NASA (M20_waypoints)
  telemetry/lightTimeProvider.js  tiempo de luz Tierra-Marte en vivo
  telemetry/orbits.js  posiciones de la Tierra y Marte (elementos keplerianos aproximados de JPL)
  hud/hud.css          colores y tipografías compartidos por el HUD (variables --mc-* en :root)
  hud/missionControl.js  panel de control de misión (tecla T): valor, gráfica de la misión y frase por dato;
                       solo habla con la TelemetryAPI, nunca con las fuentes (estilos en missionControl.css)
  hud/shakeToggle.js   switch "Temblor de cámara" (arriba a la derecha, activado por defecto; estilos en
                       shakeToggle.css): cambia CameraShake.enabled y suelta el foco tras cada clic
  post/composer.js     bloom + OutputPass + viñeta/grano
  utils/noise.js       ruido simplex con semilla, fbm, PRNG
public/models/perseverance.glb  modelo oficial (NASA-3D-Resources), comprimido con Draco
public/draco/          decodificador Draco (generado por npm install, ignorado en git; sin CDN)
scripts/check.mjs      verificación headless
scripts/copy-draco.mjs copia el decodificador Draco de three a public/draco/
```

## Modelo del rover

- Ya viene en metros (2.70 × 3.11 × 2.23 m con el mástil levantado) y con el frente hacia +Z: no se escala.
- Trae 23 animaciones que despliegan y vuelven a plegar el rover. `rover.js` congela t = 10 s (mástil arriba) y deja el brazo en t = 0 (guardado).
- Las 6 ruedas vienen fusionadas en `Wheels_objs` (3 mallas: llanta, neumático y tapa, cada una con las 6 ruedas). `rover/wheels.js` reparte los triángulos por posición y crea por rueda `wheel_XX` (dirección, eje Y) → spin (rodadura, eje X). Radio ≈ 0.26 m, ancho del neumático 0.34 m. La suspensión (`suspension`) sigue siendo una malla única y rígida.
- Cinemática de las ruedas: con avance v y giro ω, la rueda en (x, z) va a (ω·z, v − ω·x). Las 4 esquinas se orientan en esa dirección (Ackermann al girar avanzando, diamante a ~45° al girar en el sitio) y las centrales son fijas, como en el rover real.
- Cámaras (las imprime la consola al cargar): `lens` (SuperCam), `Mastcam_Z_cams`, `NavCams`, `hazcams_front`, `hazcams_rear`, `WATSON`, `Up_Look_Camera`, `Down_Look_Camera`.
- Velocidad jugable de 2.5 m/s (el real va a ~4.2 cm/s).

## Física con las rocas

- `rocks.js` registra cada roca en el `RockField` (`world/rockField.js`), una cuadrícula de celdas de 4 m con posición, radio en planta y altura. El radio es el 85 % de la caja de la variante, porque la roca gira y su contorno es irregular.
- `CLIMB_LIMIT` = 0.4 m es lo que evita Percy real, casi el diámetro de la rueda.
  - **Las más bajas se trepan.** Cuentan como suelo con perfil de domo (`RockField.heightAt`). Cada rueda muestrea su centro y ±radio, así que sube cuando el neumático toca la piedra. El plano de las 6 ruedas inclina el rover.
  - **Las más altas bloquean** (`rover/collisions.js`). El contorno del rover es un rectángulo y cada roca un círculo. Si se traslapan, se empuja el rover fuera por la normal y pierde solo la parte de la velocidad que iba contra la roca, así que en diagonal se desliza por el borde.
- **Temblor de cámara** (`rover/cameraShake.js`):
  - Fuente: `controller.bump`, los metros que subieron o bajaron las ruedas sobre piedras en el último paso, sumando las 6. En la arena vale 0.
  - Cada sacudida suma `bump / FULL_BUMP` a un trauma (0–1) que se apaga con `DECAY`. El giro es `MAX_ANGLE · trauma² · ruido`.
  - Solo rota la cámara en `beforeRender`, que corre después de `controls.update`. OrbitControls la reorienta con `lookAt` en cada frame, así que el temblor no se acumula ni interfiere con el mouse.
  - Con `enabled = false` (switch del HUD) no gira y deja el trauma en 0.

## Telemetría

- Fuente: https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json (CORS abierto, se lee en vivo). Usa `dist_total_m`, `elev_geoid` (m sobre el areoide) y `tilt` (°); filtra `final === 'y'`, las demás paradas traen a veces la distancia en 0.
- La NASA responde 403 a los navegadores con user agent `HeadlessChrome`: `npm run check` baja el JSON desde Node y lo entrega a la página con `page.route`. No disfraces el user agent.
- Sol 0 = aterrizaje (2021-02-18 20:55 UTC); un sol dura 88 775.244 s.

## Notas de Three.js r186

- `PCFSoftShadowMap` fue eliminado: usa `PCFShadowMap` con `light.shadow.radius` para sombras suaves.
- `THREE.Clock` está obsoleto: usa `THREE.Timer` (`timer.update(timestamp)` en el bucle).
- `alphaMap` lee el canal verde, no el alfa: para transparencias dibujadas en canvas usa `map` con RGBA.

## Ganchos de prueba

Viven en `src/debug.js`; todo gancho nuevo para pruebas va ahí, no en `main.js`. En headless el WebGL por software va a <1 FPS, así que el check no depende de frames: conduce y prueba llamando a estos ganchos.

- `window.__sceneReady`: se activa tras unos frames con el rover en escena; el check lo espera.
- `window.__drive(segundos, teclas)`: conduce a paso fijo (1/30 s) y actualiza huellas y cámara.
- `window.__rover`: el controlador (posición, rumbo, velocidad, `bump`, `wheelRig`).
- `window.__rocks`: el RockField (`rocks`, `near`, `heightAt`).
- `window.__shake`: el temblor de cámara (`enabled`, `trauma`, `update`). El switch se prueba con clics reales sobre `.hud-switch`.
- `window.__mission`: lecturas del control de misión (`readings()`) y si está visible.

## Convenciones

- Idioma: la comunicación con el usuario es en español. Comentarios y documentación en español; nombres de variables, funciones y archivos en inglés.
- Unidades del mundo 3D en metros, para usar las dimensiones reales del rover (aprox. 3 m de largo, 2.7 m de ancho, 2.2 m de alto, ~1025 kg) y la gravedad de Marte (3.721 m/s²).
- Organiza el código por responsabilidad: `world/` (paisaje), `rover/` (rover), `telemetry/` (datos y sus proveedores), `hud/` (interfaz sobre la escena), `post/` (efectos), `engine.js` (render). Un dato de telemetría nuevo se agrega como proveedor, sin tocar el panel. `main.js` solo conecta piezas; la lógica nueva va en su propio módulo.
- El modelo de la NASA trae varias piezas fusionadas en mallas únicas. Si una parte necesita moverse por separado, sepárala en código dentro de `rover/` como un módulo propio (como `wheels.js`).
- Archivos binarios grandes: el GLB (~5 MB) va directo en git. Si se agregan más modelos o texturas pesadas, usa Git LFS.
- Commits: no agregues líneas de autoría ni coautoría (`Co-Authored-By`, "Generated with Claude Code", etc.) a los mensajes de commit ni a las descripciones de PR. Mensajes en español, con prefijo tipo `feat:`, `fix:`, `docs:`, `chore:`.
- Entorno de desarrollo: Windows 11; el repositorio vive dentro de OneDrive, así que evita depender de rutas absolutas y añade `node_modules/` y `dist/` al `.gitignore`.
