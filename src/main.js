import { createEngine } from './engine.js';
import { createWorld } from './world/world.js';
import { getSurfaceHeight } from './world/terrain.js';
import { loadRover } from './rover/rover.js';
import { RoverController } from './rover/controller.js';
import { Tracks } from './rover/tracks.js';
import { FollowCamera } from './rover/followCamera.js';
import { RoverCameras } from './rover/roverCameras.js';
import { CameraShake } from './rover/cameraShake.js';
import { TelemetryAPI } from './telemetry/telemetry.js';
import { createWaypointsProvider } from './telemetry/waypointsProvider.js';
import { createLightTimeProvider } from './telemetry/lightTimeProvider.js';
import { MissionControl } from './hud/missionControl.js';
import { ShakeToggle } from './hud/shakeToggle.js';
import { CameraSpots } from './hud/cameraSpots.js';
import { PhotoViewer } from './hud/photoViewer.js';
import { CameraView } from './hud/cameraView.js';
import { PHOTO_CAMERAS } from './photos/picks.js';
import { installDebugHooks, installMissionHooks, installShakeHooks, installPhotoHooks, installViewHooks, markFrameRendered } from './debug.js';

// El rover arranca en el claro sin rocas, mirando hacia el sol
const ROVER_START = { x: 0, z: 10, heading: Math.PI };

const { renderer, scene, camera, controls, start, setView } = createEngine();
const world = createWorld(scene);
const tracks = new Tracks();
scene.add(tracks.group);
const shake = new CameraShake(camera);
new ShakeToggle(shake);
installShakeHooks(shake);

// Control de misión: datos reales de Percy, cada uno servido por su proveedor
const telemetry = new TelemetryAPI();
telemetry.addProvider(createWaypointsProvider());
telemetry.addProvider(createLightTimeProvider());
installMissionHooks(new MissionControl(telemetry));

// Fotos reales: cada cámara del modelo es un punto que, al hacer clic, trae una foto suya
const photos = new PhotoViewer();
let spots = null;

// Cámara inicial: detrás y a un lado del punto de partida
const startGround = getSurfaceHeight(ROVER_START.x, ROVER_START.z);
camera.position.set(ROVER_START.x + 4.5, startGround + 3.2, ROVER_START.z + 8.5);
controls.target.set(ROVER_START.x, startGround + 1.4, ROVER_START.z);
controls.update();

// El rover se carga en segundo plano; el paisaje se ve mientras tanto
let driver = null;
let follow = null;
let views = null; // vistas desde las cámaras del rover (tecla V)
let frame = null;
loadRover()
  .then(({ rover, wheels, wheelRig }) => {
    scene.add(rover);
    driver = new RoverController(rover, wheels, { ...ROVER_START, wheelRig, rocks: world.rocks });
    tracks.configure(wheels);
    follow = new FollowCamera(camera, controls, driver);
    spots = new CameraSpots(camera, rover, PHOTO_CAMERAS, (key) => photos.shoot(key));
    installPhotoHooks(photos);
    views = new RoverCameras(rover, renderer.domElement);
    frame = new CameraView(views, driver);
    views.onChange((view) => {
      setView(view && views.camera, { fisheye: view?.fisheye ?? 0 });
      spots.root.hidden = !!view; // las fotos se toman desde la vista orbital
    });
    installViewHooks(views);
    installDebugHooks({ driver, tracks, follow });
  })
  .catch((err) => console.error('No se pudo cargar el modelo del rover:', err));

start(
  (delta, time) => {
    if (driver) {
      driver.update(delta);
      tracks.update(driver);
      follow.update(delta);
      views.update();
      markFrameRendered();
    }
    // El cielo, las lunas y el polvo se centran en la cámara con la que se dibuja
    world.update(delta, time, views?.active ? views.camera : camera, controls.target);
  },
  // En la orbital la cámara tiembla cuando las ruedas pasan sobre piedras y los
  // puntos de las cámaras se colocan después, ya con la cámara final. En las del
  // rover el temblor ya lo da la inclinación del propio rover.
  (delta, time) => {
    if (views?.active) {
      frame.update();
      return;
    }
    shake.update(delta, time, driver ? driver.bump : 0);
    spots?.update();
  },
);
