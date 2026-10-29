import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTerrain, getHeight } from './world/terrain.js';
import { createSky } from './world/sky.js';
import { createLighting } from './world/lighting.js';
import { createRocks } from './world/rocks.js';
import { createMoons } from './world/moons.js';
import { createDust } from './world/dust.js';
import { createComposer } from './post/composer.js';

// Sol de tarde: bajo sobre el horizonte, hacia donde mira la cámara
const SUN_DIR = new THREE.Vector3(-0.6, 0.12, -1).normalize();
const FOG_COLOR = new THREE.Color(0xd09566);

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
const groundAtCamera = getHeight(0, 18);
camera.position.set(0, groundAtCamera + 2.2, 18);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-3, getHeight(-3, 2) + 1.6, 2);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 3;
controls.maxDistance = 120;
controls.update();

const sky = createSky(SUN_DIR);
const lighting = createLighting(SUN_DIR);
const moons = createMoons();
const dust = createDust();
scene.add(sky, lighting, createTerrain(), createRocks(), moons, dust);

const composer = createComposer(renderer, scene, camera);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

const timer = new THREE.Timer();
timer.connect(document);
let frames = 0;
renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  const delta = Math.min(timer.getDelta(), 0.1);
  const time = timer.getElapsed();
  controls.update();
  sky.userData.update(time, camera);
  moons.userData.update(time, camera);
  lighting.userData.update(controls.target);
  dust.userData.update(time, delta, camera);
  composer.userData.update(time);
  composer.render();
  // Señal para npm run check: la escena ya pintó algunos frames
  if (++frames === 3) window.__sceneReady = true;
});
