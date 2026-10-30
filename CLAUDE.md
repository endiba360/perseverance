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

Paisaje marciano cinematográfico (dunas, rocas, cielo caramelo con polvo, sol de tarde, Fobos y Deimos) con el modelo oficial de Perseverance de la NASA a tamaño real: se conduce con WASD/flechas, deja huellas y la cámara lo sigue. Un panel de control de misión (tecla T) muestra 4 datos reales de Percy con el patrón de telemetría de Open MCT. Pendiente: colisiones con las rocas (hoy el rover las atraviesa) y vistas desde las cámaras del rover.

## Stack

- **Three.js** (r186) para el render 3D, **Vite** como servidor de desarrollo y bundler, JavaScript con módulos ES.
- **playwright-core** solo para `npm run check`; usa el Chrome instalado (`channel: 'chrome'`), no descarga navegadores.
- Node 26 / npm 11.

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
  engine.js            renderer, escena, cámara, OrbitControls, posprocesado, resize y bucle de animación
  debug.js             ganchos en window para la consola y npm run check (no son parte de la simulación)
  world/world.js       arma el paisaje completo y lo actualiza cada frame
  world/terrain.js     dunas + relieve; getHeight(x, z) = función exacta, getSurfaceHeight(x, z) = altura
                       de la malla dibujada (mismos triángulos que PlaneGeometry); usa esta para apoyar cosas
  rover/rover.js       carga el GLB (Draco), fija la pose de conducción y lista las piezas que son cámaras
  rover/controller.js  conducción WASD/flechas; apoya el rover en sus 6 ruedas e inclina según el terreno
  rover/wheels.js      separa las 6 ruedas del modelo; rodadura y dirección de las esquinas
  rover/tracks.js      huellas: tiras con búfer circular y textura de grousers
  rover/followCamera.js OrbitControls que siguen al rover y se colocan detrás al conducir
  telemetry/telemetry.js  mini TelemetryAPI al estilo Open MCT: cada dato con nombre, unidad y proveedor;
                       request() = historial de la misión, subscribe() = en vivo. Datos {sol, value}
  telemetry/waypointsProvider.js  distancia, altura e inclinación del JSON de paradas de la NASA (M20_waypoints)
  telemetry/lightTimeProvider.js  tiempo de luz Tierra-Marte en vivo
  telemetry/orbits.js  posiciones de la Tierra y Marte (elementos keplerianos aproximados de JPL)
  hud/missionControl.js  panel de control de misión (tecla T): valor, gráfica de la misión y frase por dato;
                       solo habla con la TelemetryAPI, nunca con las fuentes (estilos en missionControl.css)
  world/sky.js         shader del cielo (degradado, polvo, halo azulado, disco solar HDR)
  world/lighting.js    sol direccional con sombras (sigue al objetivo de la cámara) + hemisférica
  world/rocks.js       rocas procedurales con InstancedMesh
  world/moons.js       Fobos y Deimos con sombreado propio
  world/dust.js        partículas de polvo con viento
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

## Telemetría

- Fuente: https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json (CORS abierto, se lee en vivo). Usa `dist_total_m`, `elev_geoid` (m sobre el areoide) y `tilt` (°); filtra `final === 'y'`, las demás paradas traen a veces la distancia en 0.
- La NASA responde 403 a los navegadores con user agent `HeadlessChrome`: `npm run check` baja el JSON desde Node y lo entrega a la página con `page.route`. No disfraces el user agent.
- Sol 0 = aterrizaje (2021-02-18 20:55 UTC); un sol dura 88 775.244 s.

## Notas de Three.js r186

- `PCFSoftShadowMap` fue eliminado: usa `PCFShadowMap` con `light.shadow.radius` para sombras suaves.
- `THREE.Clock` está obsoleto: usa `THREE.Timer` (`timer.update(timestamp)` en el bucle).
- Ganchos de `src/debug.js`: `window.__sceneReady` se activa cuando el rover ya está en escena (el check lo espera); como en headless el WebGL por software va a <1 FPS, el check usa `window.__drive(segundos, teclas)` para conducir a paso fijo; `window.__rover` expone el controlador; `window.__mission` expone las lecturas del panel y si está visible. Todo gancho nuevo para pruebas va en ese archivo, no en `main.js`.
- `alphaMap` lee el canal verde, no el alfa: para transparencias dibujadas en canvas usa `map` con RGBA.

## Convenciones

- Idioma: la comunicación con el usuario es en español. Comentarios y documentación en español; nombres de variables, funciones y archivos en inglés.
- Unidades del mundo 3D en metros, para usar las dimensiones reales del rover (aprox. 3 m de largo, 2.7 m de ancho, 2.2 m de alto, ~1025 kg) y la gravedad de Marte (3.721 m/s²).
- Organiza el código por responsabilidad: `world/` (paisaje), `rover/` (rover), `telemetry/` (datos y sus proveedores), `hud/` (interfaz sobre la escena), `post/` (efectos), `engine.js` (render). Un dato de telemetría nuevo se agrega como proveedor, sin tocar el panel. `main.js` solo conecta piezas; la lógica nueva va en su propio módulo.
- El modelo de la NASA trae varias piezas fusionadas en mallas únicas. Si una parte necesita moverse por separado, sepárala en código dentro de `rover/` como un módulo propio (como `wheels.js`).
- Archivos binarios grandes: el GLB (~5 MB) va directo en git. Si se agregan más modelos o texturas pesadas, usa Git LFS.
- Commits: no agregues líneas de autoría ni coautoría (`Co-Authored-By`, "Generated with Claude Code", etc.) a los mensajes de commit ni a las descripciones de PR. Mensajes en español, con prefijo tipo `feat:`, `fix:`, `docs:`, `chore:`.
- Entorno de desarrollo: Windows 11; el repositorio vive dentro de OneDrive, así que evita depender de rutas absolutas y añade `node_modules/` y `dist/` al `.gitignore`.
