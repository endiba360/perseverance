<div align="center">

# 🔴 Perseverance · Jezero

**Conduce a Perseverance por las dunas de Marte, en tiempo real y en tu navegador.**

Simulación 3D del rover Perseverance de la NASA en el cráter Jezero, construida con Three.js y el modelo 3D oficial de la NASA.

![Three.js](https://img.shields.io/badge/Three.js-r186-000000?logo=three.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node-26-5FA04E?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/licencia-MIT-c1440e)
[![Modelo 3D](https://img.shields.io/badge/modelo%203D-NASA%2FJPL--Caltech-0b3d91)](https://github.com/nasa/NASA-3D-Resources)

![Perseverance subiendo una duna al atardecer, dejando huellas en la arena](docs/rover.png)

</div>

## 🚙 El rover

| | |
|---|---|
| 🛰️ **Modelo oficial** | El GLB de [NASA-3D-Resources](https://github.com/nasa/NASA-3D-Resources) a tamaño real: 2.70 m de ancho, 3.11 m de largo y 2.23 m de alto, con el mástil desplegado y el brazo guardado, como cuando conduce. |
| 🎮 **Conducción** | Avanza, retrocede y gira sobre su eje. Se apoya en sus 6 ruedas y se inclina siguiendo las dunas. |
| 🛞 **Ruedas** | Las 6 ruedas ruedan según la velocidad y las 4 de las esquinas se orientan como en el rover real: en curva al avanzar y en diamante al girar en el sitio. |
| 🪨 **Rocas** | Las piedras de más de 40 cm (lo que evita el rover real) lo detienen, y si llega en diagonal se desliza por el borde. Las más bajas las trepa: la rueda que pisa una sube, el rover se ladea y la cámara tiembla con la sacudida (se apaga con el switch de arriba a la derecha). |
| 👣 **Huellas** | Dos bandas sobre la arena con el relieve en chevrón de los grousers, marcado por la luz rasante del sol. |
| 🎥 **Cámara de seguimiento** | Se coloca detrás del rover al conducir y puedes girarla alrededor con el mouse. |
| 📷 **Cámaras a bordo** | Al cargar, la consola lista las 8 cámaras del modelo: Mastcam-Z, SuperCam, Navcams, Hazcams, WATSON y las de descenso. |

## 📡 Control de misión

![La simulación con el control de misión abierto al pie de la pantalla](docs/interface.png)

Una barra al pie de la pantalla (se muestra u oculta con la tecla `T`) con **datos reales** del Perseverance de verdad. Cada tarjeta trae el valor actual, una gráfica de toda la misión por soles (días marcianos) y una frase que explica qué significa.

![Detalle del panel: distancia recorrida, altura del terreno, inclinación y tiempo de luz Tierra-Marte, cada uno con su gráfica de la misión](docs/mission-control.png)

| Dato | Fuente |
|---|---|
| 🛣️ **Distancia recorrida** (km) | Paradas de la misión que publica la NASA ([M20_waypoints.json](https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json)), leídas en vivo |
| ⛰️ **Altura del terreno** (m sobre el nivel de referencia de Marte) | Mismo archivo de la NASA |
| 📐 **Inclinación** del rover al terminar cada manejo (°) | Mismo archivo de la NASA |
| 📶 **Tiempo de luz Tierra-Marte** (min) | Calculado en vivo con las órbitas de la Tierra y Marte (elementos keplerianos de JPL) |

Está organizado con el patrón de telemetría de [Open MCT](https://github.com/nasa/openmct), el software de control de misión de la NASA. Cada dato declara su nombre, su unidad y quién lo provee. El panel pide el historial con `request()` y recibe los valores en vivo con `subscribe()`, siempre a través de la API y sin tocar las fuentes directamente. Para agregar un dato nuevo basta con escribir un proveedor.

## ✨ El paisaje

![Atardecer en el cráter Jezero: dunas, rocas, sol bajo y las lunas Fobos y Deimos](docs/preview.png)

| | |
|---|---|
| 🏜️ **Dunas** | Terreno procedural con crestas esculpidas por el viento: ladera suave a barlovento, caída abrupta a sotavento y rizos finos en la arena. |
| 🪨 **Rocas** | Cientos de piedras generadas con ruido, repartidas con una distribución realista de tamaños y asentadas sobre el relieve. |
| 🌅 **Cielo marciano** | Shader propio con degradado caramelo, velos de polvo en el horizonte y el **halo azulado** que rodea al sol en los atardeceres reales de Marte. |
| ☀️ **Sol de tarde** | Luz cálida y rasante con sombras suaves que siguen a la cámara. |
| 🌑 **Fobos y Deimos** | Las dos lunas de Marte, irregulares y con cráteres, flotando en el cielo polvoriento. |
| 🌫️ **Atmósfera** | Partículas de polvo arrastradas por el viento, niebla de distancia y posprocesado cinematográfico (bloom, viñeta y grano de película). |

El paisaje es **procedural**: no usa texturas ni modelos descargados, solo código. Lo único externo es el modelo del rover y los datos de telemetría de la NASA.

## 🚀 Empezar

Requiere [Node.js](https://nodejs.org/) 20 o superior.

```bash
git clone https://github.com/endiba360/perseverance.git
cd perseverance
npm install
npm run dev
```

Abre http://localhost:5173, haz clic en la escena y conduce:

| Tecla | Acción |
|---|---|
| `W` / `↑` | Avanzar |
| `S` / `↓` | Retroceder |
| `A` / `←` | Girar a la izquierda |
| `D` / `→` | Girar a la derecha |
| `T` | Mostrar u ocultar el control de misión |
| Switch "Temblor de cámara" | Activar o desactivar el temblor al pasar sobre piedras |
| Arrastrar con el mouse | Girar la cámara alrededor del rover |
| Rueda del mouse | Acercar / alejar |

> El rover real avanza a unos 4 cm/s; aquí va a 2.5 m/s para que sea jugable.

## 🧪 Verificación visual

```bash
npm run check
```

Abre la escena en tu Chrome instalado en modo invisible (con [Playwright](https://playwright.dev/) y sin descargar navegadores), simula un recorrido del rover, prueba que una roca grande lo detenga y que trepe una pequeña, que el switch del temblor de cámara lo apague y lo encienda, comprueba que el control de misión cargue sus 4 datos y que la tecla `T` lo oculte, guarda una captura en `screenshots/check.png` y lista los mensajes y errores de consola. Termina con código 1 si encuentra algún error.

## 🗂️ Estructura

```
src/
├── main.js            punto de entrada: conecta motor, mundo y rover
├── engine.js          renderer, cámara, controles y bucle de animación
├── debug.js           ganchos para la consola y npm run check
├── rover/
│   ├── rover.js       carga del modelo, pose de conducción y lista de cámaras
│   ├── controller.js  conducción e inclinación sobre el terreno
│   ├── wheels.js      ruedas separadas: rodadura y dirección
│   ├── collisions.js  choque con las rocas grandes
│   ├── tracks.js      huellas de las ruedas
│   ├── followCamera.js cámara que sigue al rover
│   └── cameraShake.js temblor de cámara sobre las piedras
├── telemetry/
│   ├── telemetry.js   mini API de telemetría al estilo Open MCT
│   ├── waypointsProvider.js  distancia, altura e inclinación (datos de la NASA)
│   ├── lightTimeProvider.js  tiempo de luz Tierra-Marte en vivo
│   └── orbits.js      posiciones de la Tierra y Marte
├── hud/
│   ├── hud.css            colores compartidos del HUD
│   ├── missionControl.js  panel de control de misión (tecla T)
│   └── shakeToggle.js     switch del temblor de cámara
├── world/
│   ├── world.js       arma el paisaje completo
│   ├── terrain.js     dunas y relieve (altura exacta para apoyar objetos)
│   ├── sky.js         shader del cielo y disco solar
│   ├── lighting.js    sol con sombras + luz del cielo
│   ├── rocks.js       rocas procedurales instanciadas
│   ├── rockField.js   posición y altura de cada roca (para chocar o trepar)
│   ├── moons.js       Fobos y Deimos
│   └── dust.js        polvo en suspensión
├── post/composer.js   bloom, viñeta y grano
└── utils/noise.js     ruido simplex con semilla
public/
├── models/perseverance.glb  modelo oficial de la NASA (comprimido con Draco)
└── draco/                   decodificador Draco (lo copia npm install)
scripts/
├── check.mjs          verificación headless
└── copy-draco.mjs     copia el decodificador Draco desde three
```

## 🛰️ Próximos pasos

- [x] Paisaje marciano cinematográfico
- [x] Modelo oficial del rover a tamaño real
- [x] Conducción con teclado, huellas y cámara de seguimiento
- [x] Ruedas que giran y dirección de las 4 esquinas
- [x] Control de misión con telemetría real de Perseverance
- [x] Colisiones con las rocas y trepado de piedras pequeñas
- [ ] Vistas desde las cámaras del rover (Mastcam-Z, Navcams, Hazcams…)

## 📄 Licencia

Código bajo licencia [MIT](LICENSE) · Proyecto de aprendizaje de [Platzi](https://platzi.com). No está afiliado a la NASA.

Modelo 3D de Perseverance: [NASA-3D-Resources](https://github.com/nasa/NASA-3D-Resources), cortesía de NASA/JPL-Caltech. Datos de las paradas del rover: mapa de la misión Mars 2020 (MMGIS) de NASA/JPL-Caltech.
