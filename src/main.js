import { createEngine } from './engine.js';
import { createWorld } from './world/world.js';
import { getSurfaceHeight } from './world/terrain.js';
import { loadRover } from './rover/rover.js';
import { RoverController } from './rover/controller.js';
import { Tracks } from './rover/tracks.js';
import { FollowCamera } from './rover/followCamera.js';
import { installDebugHooks, markFrameRendered } from './debug.js';

// El rover arranca en el claro sin rocas, mirando hacia el sol
const ROVER_START = { x: 0, z: 10, heading: Math.PI };

const { scene, camera, controls, start } = createEngine();
const world = createWorld(scene);
const tracks = new Tracks();
scene.add(tracks.group);

// Cámara inicial: detrás y a un lado del punto de partida
const startGround = getSurfaceHeight(ROVER_START.x, ROVER_START.z);
camera.position.set(ROVER_START.x + 4.5, startGround + 3.2, ROVER_START.z + 8.5);
controls.target.set(ROVER_START.x, startGround + 1.4, ROVER_START.z);
controls.update();

// El rover se carga en segundo plano; el paisaje se ve mientras tanto
let driver = null;
let follow = null;
loadRover()
  .then(({ rover, wheels, wheelRig }) => {
    scene.add(rover);
    driver = new RoverController(rover, wheels, { ...ROVER_START, wheelRig });
    tracks.configure(wheels);
    follow = new FollowCamera(camera, controls, driver);
    installDebugHooks({ driver, tracks, follow });
  })
  .catch((err) => console.error('No se pudo cargar el modelo del rover:', err));

start((delta, time) => {
  if (driver) {
    driver.update(delta);
    tracks.update(driver);
    follow.update(delta);
    markFrameRendered();
  }
  world.update(delta, time, camera, controls.target);
});
