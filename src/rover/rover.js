import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createWheelRig } from './wheels.js';

// Modelo oficial de la NASA (NASA-3D-Resources). Ya viene en metros con el frente hacia +Z.
const MODEL_URL = '/models/perseverance.glb';
const TIRE_WIDTH = 0.34; // ancho medido del neumático en el modelo

// Piezas del modelo que son cámaras (los nombres los normaliza GLTFLoader)
const CAMERA_INFO = {
  Mastcam_Z_cams: 'Mastcam-Z: par estéreo con zoom en el mástil',
  NavCams: 'Navcams: cámaras de navegación en el mástil',
  lens: 'SuperCam: telescopio/cámara del láser en la cabeza del mástil',
  hazcams_front: 'Hazcams delanteras: evitan obstáculos',
  hazcams_rear: 'Hazcams traseras',
  WATSON: 'WATSON: cámara de primer plano en la torreta del brazo',
  Up_Look_Camera: 'Cámara de ascenso (mira hacia arriba, usada en el aterrizaje)',
  Down_Look_Camera: 'Cámara de descenso (mira hacia abajo, usada en el aterrizaje)',
};
const CAMERA_PATTERN = /cam|watson|lens/i;
const NOT_A_CAMERA = /cover|wiring|bracket/i;

// El GLB trae una secuencia que despliega y vuelve a plegar el rover. Se congela
// el instante en que el mástil está levantado (~2.2 m de alto, como el real) y el
// brazo sigue guardado, que es la postura con la que Perseverance conduce.
const MAST_DEPLOYED_TIME = 10;
const ARM_CLIP = /^arm|turret|hinge/i;

function applyDrivingPose(model, clips) {
  const mixer = new THREE.AnimationMixer(model);
  for (const clip of clips) {
    const action = mixer.clipAction(clip);
    action.play();
    action.paused = true;
    action.time = ARM_CLIP.test(clip.name) ? 0 : Math.min(MAST_DEPLOYED_TIME, clip.duration);
  }
  mixer.update(0);
  model.updateMatrixWorld(true);
}

export async function loadRover() {
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const gltf = await loader.loadAsync(MODEL_URL);
  draco.dispose();

  const model = gltf.scene;
  applyDrivingPose(model, gltf.animations);

  // Apoya las ruedas en y = 0 y pone el origen en el centro del tren de ruedas,
  // que es el eje sobre el que gira el rover
  const wheelBox = new THREE.Box3().setFromObject(model.getObjectByName('Wheels_objs'));
  const wheelCenter = wheelBox.getCenter(new THREE.Vector3());
  model.position.set(-wheelCenter.x, -wheelBox.min.y, -wheelCenter.z);

  const rover = new THREE.Group();
  rover.name = 'perseverance';
  rover.add(model);

  // Separa las 6 ruedas para que rueden y se orienten
  const wheelRig = createWheelRig(rover);

  model.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  // Medidas del tren de ruedas para apoyarlo en el terreno y dibujar las huellas
  const wheels = {
    halfTrack: wheelRig.halfTrack,
    halfBase: wheelRig.halfBase,
    width: TIRE_WIDTH,
    radius: wheelRig.radius,
  };

  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  console.info(
    `Perseverance cargado: ${size.x.toFixed(2)} m de ancho × ${size.z.toFixed(2)} m de largo × ${size.y.toFixed(2)} m de alto`,
  );

  // Piezas que son cámaras: se listan en la consola (las vistas y las fotos las buscan por nombre)
  const cameras = [];
  model.traverse((obj) => {
    if (CAMERA_PATTERN.test(obj.name) && !NOT_A_CAMERA.test(obj.name)) cameras.push(obj);
  });
  console.log(`Cámaras del rover (${cameras.length}): ${cameras.map((obj) => obj.name).join(', ')}`);
  console.table(
    cameras.map((obj) => ({ nombre: obj.name, descripcion: CAMERA_INFO[obj.name] ?? '' })),
  );

  return { rover, cameras, size, wheels, wheelRig };
}
