<div align="center">

# 🔴 Perseverance · Jezero

**Un atardecer en Marte, renderizado en tiempo real en tu navegador.**

Simulación 3D del rover Perseverance de la NASA en el cráter Jezero, construida con Three.js.

![Three.js](https://img.shields.io/badge/Three.js-r186-000000?logo=three.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node-26-5FA04E?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/licencia-MIT-c1440e)

![Atardecer en el cráter Jezero: dunas, rocas, sol bajo y las lunas Fobos y Deimos](docs/preview.png)

</div>

## ✨ Qué hay en la escena

| | |
|---|---|
| 🏜️ **Dunas** | Terreno procedural con crestas esculpidas por el viento: ladera suave a barlovento, caída abrupta a sotavento y rizos finos en la arena. |
| 🪨 **Rocas** | Cientos de piedras generadas con ruido, repartidas con una distribución realista de tamaños y asentadas sobre el relieve. |
| 🌅 **Cielo marciano** | Shader propio con degradado caramelo, velos de polvo en el horizonte y el **halo azulado** que rodea al sol en los atardeceres reales de Marte. |
| ☀️ **Sol de tarde** | Luz cálida y rasante con sombras suaves que siguen a la cámara. |
| 🌑 **Fobos y Deimos** | Las dos lunas de Marte, irregulares y con cráteres, flotando en el cielo polvoriento. |
| 🌫️ **Atmósfera** | Partículas de polvo arrastradas por el viento, niebla de distancia y posprocesado cinematográfico (bloom, viñeta y grano de película). |

Todo es **procedural**: no se descargan texturas ni modelos, solo código.

## 🚀 Empezar

Requiere [Node.js](https://nodejs.org/) 20 o superior.

```bash
git clone https://github.com/endiba360/perseverance.git
cd perseverance
npm install
npm run dev
```

Abre http://localhost:5173 y explora con el mouse:

- **Arrastrar**: girar la cámara
- **Rueda**: acercar / alejar
- **Clic derecho + arrastrar**: desplazar

## 🧪 Verificación visual

```bash
npm run check
```

Abre la escena en tu Chrome instalado en modo invisible (con [Playwright](https://playwright.dev/) y sin descargar navegadores), guarda una captura en `screenshots/check.png` y lista los errores de consola. Termina con código 1 si encuentra alguno.

## 🗂️ Estructura

```
src/
├── main.js            renderer, cámara, controles y bucle de animación
├── world/
│   ├── terrain.js     dunas y relieve (getHeight para asentar objetos)
│   ├── sky.js         shader del cielo y disco solar
│   ├── lighting.js    sol con sombras + luz del cielo
│   ├── rocks.js       rocas procedurales instanciadas
│   ├── moons.js       Fobos y Deimos
│   └── dust.js        polvo en suspensión
├── post/composer.js   bloom, viñeta y grano
└── utils/noise.js     ruido simplex con semilla
scripts/check.mjs      verificación headless
```

## 🛰️ Próximos pasos

- [x] Paisaje marciano cinematográfico
- [ ] Modelo del rover: cuerpo, mástil con Mastcam-Z/SuperCam y brazo robótico
- [ ] Suspensión rocker-bogie y 6 ruedas que se adaptan al terreno
- [ ] Conducción con teclado y gravedad de Marte (3.721 m/s²)
- [ ] Cámaras desde el punto de vista del rover

## 📄 Licencia

[MIT](LICENSE) · Proyecto de aprendizaje de [Platzi](https://platzi.com). No está afiliado a la NASA.
