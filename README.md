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
| 👣 **Huellas** | Dos bandas sobre la arena con el relieve en chevrón de los grousers, marcado por la luz rasante del sol. |
| 🎥 **Cámara de seguimiento** | Se coloca detrás del rover al conducir y puedes girarla alrededor con el mouse. |
| 📷 **Cámaras a bordo** | Al cargar, la consola lista las 8 cámaras del modelo: Mastcam-Z, SuperCam, Navcams, Hazcams, WATSON y las de descenso. |

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

El paisaje es **procedural**: no usa texturas ni modelos descargados, solo código. El único recurso externo es el modelo del rover.

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
| Arrastrar con el mouse | Girar la cámara alrededor del rover |
| Rueda del mouse | Acercar / alejar |

> El rover real avanza a unos 4 cm/s; aquí va a 2.5 m/s para que sea jugable.

## 🧪 Verificación visual

```bash
npm run check
```

Abre la escena en tu Chrome instalado en modo invisible (con [Playwright](https://playwright.dev/) y sin descargar navegadores), simula un recorrido del rover, guarda una captura en `screenshots/check.png` y lista los mensajes y errores de consola. Termina con código 1 si encuentra algún error.

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
│   ├── tracks.js      huellas de las ruedas
│   └── followCamera.js cámara que sigue al rover
├── world/
│   ├── world.js       arma el paisaje completo
│   ├── terrain.js     dunas y relieve (altura exacta para apoyar objetos)
│   ├── sky.js         shader del cielo y disco solar
│   ├── lighting.js    sol con sombras + luz del cielo
│   ├── rocks.js       rocas procedurales instanciadas
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
- [ ] Colisiones con las rocas
- [ ] Vistas desde las cámaras del rover (Mastcam-Z, Navcams, Hazcams…)

## 📄 Licencia

Código bajo licencia [MIT](LICENSE) · Proyecto de aprendizaje de [Platzi](https://platzi.com). No está afiliado a la NASA.

Modelo 3D de Perseverance: [NASA-3D-Resources](https://github.com/nasa/NASA-3D-Resources), cortesía de NASA/JPL-Caltech.
