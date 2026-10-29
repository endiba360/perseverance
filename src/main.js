import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTerrain, getSurfaceHeight } from './world/terrain.js';
import { createSky } from './world/sky.js';
import { createLighting } from './world/lighting.js';
import { createRocks } from './world/rocks.js';
import { createMoons } from './world/moons.js';
import { createDust } from './world/dust.js';
import { createComposer } from './post/composer.js';
import { loadRover } from './rover/rover.js';
import { RoverController } from './rover/controller.js';
import { Tracks } from './rover/tracks.js';
import { FollowCamera } from './rover/followCamera.js';

// Sol de tarde: bajo sobre el horizonte, hacia donde mira la cámara
const SUN_DIR = new THREE.Vector3(-0.6, 0.12, -1).normalize();
const FOG_COLOR = new THREE.Color(0xd09566);

// El rover arranca en el claro sin rocas, mirando hacia el sol
const ROVER_START = { x: 0, z: 10, heading: Math.PI };

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG_COLOR, 0.005);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 6000);
const startGround = getSurfaceHeight(ROVER_START.x, ROVER_START.z);
camera.position.set(ROVER_START.x + 4.5, startGround + 3.2, ROVER_START.z + 8.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(ROVER_START.x, startGround + 1.4, ROVER_START.z);
controls.enableDamping = true;
controls.enablePan = false;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 4;
controls.maxDistance = 60;
controls.update();

const sky = createSky(SUN_DIR);
const lighting = createLighting(SUN_DIR);
const moons = createMoons();
const dust = createDust();
const tracks = new Tracks();
scene.add(sky, lighting, createTerrain(), createRocks(), moons, dust, tracks.group);

const composer = createComposer(renderer, scene, camera);

// El rover se carga en segundo plano; el paisaje se ve mientras tanto
let driver = null;
let follow = null;
loadRover()
  .then(({ rover, wheels }) => {
    scene.add(rover);
    driver = new RoverController(rover, wheels, ROVER_START);
    tracks.configure(wheels);
    follow = new FollowCamera(camera, controls, driver);
    window.__rover = driver; // para depurar desde la consola
    // Conducción simulada a paso fijo para npm run check (el headless va a <1 FPS)
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
  })
  .catch((err) => console.error('No se pudo cargar el modelo del rover:', err));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

const timer = new THREE.Timer();
timer.connect(document);
let framesWithRover = 0;
renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  const delta = Math.min(timer.getDelta(), 0.1);
  const time = timer.getElapsed();
  if (driver) {
    driver.update(delta);
    tracks.update(driver);
    follow.update(delta);
  }
  controls.update();
  sky.userData.update(time, camera);
  moons.userData.update(time, camera);
  lighting.userData.update(controls.target);
  dust.userData.update(time, delta, camera);
  composer.userData.update(time);
  composer.render();
  // Señal para npm run check: el rover ya está en escena y pintó algunos frames
  if (driver && ++framesWithRover === 3) window.__sceneReady = true;
});
