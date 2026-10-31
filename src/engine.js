import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createComposer } from './post/composer.js';

// Motor de render: renderer, escena, cámara, controles de órbita, posprocesado,
// ajuste al tamaño de la ventana y bucle de animación.
export function createEngine() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 6000);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * 0.495; // no bajar del horizonte
  controls.minDistance = 4;
  controls.maxDistance = 60;

  const composer = createComposer(renderer, scene, camera);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  // onFrame(delta, time) se llama cada frame antes de dibujar; beforeRender(delta,
  // time), opcional, después de los controles (para efectos de cámara como el temblor)
  const start = (onFrame, beforeRender) => {
    const timer = new THREE.Timer();
    timer.connect(document);
    renderer.setAnimationLoop((timestamp) => {
      timer.update(timestamp);
      const delta = Math.min(timer.getDelta(), 0.1);
      const time = timer.getElapsed();
      onFrame(delta, time);
      controls.update();
      beforeRender?.(delta, time);
      composer.userData.update(time);
      composer.render();
    });
  };

  // Cambia la cámara con la que se dibuja: null vuelve a la orbital. Los controles
  // de órbita solo responden al mouse en la orbital, pero siguen actualizándose
  // (su objetivo guía al sol y a las sombras).
  const setView = (viewCamera, { fisheye = 0 } = {}) => {
    composer.userData.setCamera(viewCamera ?? camera);
    composer.userData.setFisheye(fisheye);
    controls.enabled = !viewCamera;
  };

  return { renderer, scene, camera, controls, start, setView };
}
