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

Paisaje marciano cinematográfico funcionando (dunas, rocas, cielo caramelo con polvo, sol de tarde con sombras suaves, Fobos y Deimos). El rover aún no está modelado.

## Stack

- **Three.js** (r186) para el render 3D, **Vite** como servidor de desarrollo y bundler, JavaScript con módulos ES.
- **playwright-core** solo para `npm run check`; usa el Chrome instalado (`channel: 'chrome'`), no descarga navegadores.
- Node 26 / npm 11.

## Comandos

- `npm install`: instala dependencias.
- `npm run dev`: servidor de desarrollo en http://localhost:5173 (con HMR).
- `npm run build` / `npm run preview`: build de producción en `dist/` y su vista previa.
- `npm run check`: levanta Vite en otro puerto, abre la página en Chrome headless (WebGL por SwiftShader), guarda `screenshots/check.png` y lista errores/avisos de consola; termina con código 1 si hay errores. Córrelo tras cada cambio visual grande y revisa la captura.

## Estructura

```
index.html
src/
  main.js              renderer, cámara, OrbitControls, bucle de animación
  world/terrain.js     dunas + relieve; exporta getHeight(x, z) para asentar objetos
  world/sky.js         shader del cielo (degradado, polvo, halo azulado, disco solar HDR)
  world/lighting.js    sol direccional con sombras (sigue al objetivo de la cámara) + hemisférica
  world/rocks.js       rocas procedurales con InstancedMesh
  world/moons.js       Fobos y Deimos con sombreado propio
  world/dust.js        partículas de polvo con viento
  post/composer.js     bloom + OutputPass + viñeta/grano
  utils/noise.js       ruido simplex con semilla, fbm, PRNG
scripts/check.mjs      verificación headless
```

## Notas de Three.js r186

- `PCFSoftShadowMap` fue eliminado: usa `PCFShadowMap` con `light.shadow.radius` para sombras suaves.
- `THREE.Clock` está obsoleto: usa `THREE.Timer` (`timer.update(timestamp)` en el bucle).
- La escena pone `window.__sceneReady = true` tras los primeros frames; `npm run check` lo espera.

## Convenciones

- Idioma: la comunicación con el usuario es en español. Comentarios y documentación en español; nombres de variables, funciones y archivos en inglés.
- Unidades del mundo 3D en metros, para usar las dimensiones reales del rover (aprox. 3 m de largo, 2.7 m de ancho, 2.2 m de alto, ~1025 kg) y la gravedad de Marte (3.721 m/s²).
- Mantén cada parte del rover (ruedas, suspensión, mástil, brazo) como un componente separado y reutilizable.
- Entorno de desarrollo: Windows 11; el repositorio vive dentro de OneDrive, así que evita depender de rutas absolutas y añade `node_modules/` y `dist/` al `.gitignore`.
