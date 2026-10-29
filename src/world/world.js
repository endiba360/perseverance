import * as THREE from 'three';
import { createTerrain } from './terrain.js';
import { createSky } from './sky.js';
import { createLighting } from './lighting.js';
import { createRocks } from './rocks.js';
import { createMoons } from './moons.js';
import { createDust } from './dust.js';

// Sol de tarde: bajo sobre el horizonte, hacia donde mira la cámara al inicio
const SUN_DIR = new THREE.Vector3(-0.6, 0.12, -1).normalize();
const FOG_COLOR = new THREE.Color(0xd09566);

// Paisaje completo: terreno, rocas, cielo, sol, lunas, polvo y niebla
export function createWorld(scene) {
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.005);

  const sky = createSky(SUN_DIR);
  const lighting = createLighting(SUN_DIR);
  const moons = createMoons();
  const dust = createDust();
  scene.add(sky, lighting, createTerrain(), createRocks(), moons, dust);

  // focus: punto que deben cubrir las sombras (lo que mira la cámara)
  const update = (delta, time, camera, focus) => {
    sky.userData.update(time, camera);
    moons.userData.update(time, camera);
    lighting.userData.update(focus);
    dust.userData.update(time, delta, camera);
  };
  return { update };
}
