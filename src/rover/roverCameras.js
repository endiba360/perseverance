import * as THREE from 'three';
import { partBox } from './parts.js';

const DEG = Math.PI / 180;

// Vistas desde las cámaras del modelo, en el orden en que las recorre la tecla V.
// fov es el campo vertical (°) de la cámara real con formato 4:3; pitch y yaw, hacia
// dónde mira al elegirla (yaw 0 = al frente). look: se gira con el mouse como la
// cabeza del mástil. zoom: [mín, máx] de fov con la rueda. fisheye: distorsión de
// barril en el posprocesado (las Hazcams son ojo de pez).
export const VIEWS = [
  {
    key: 'NavCams',
    label: 'Navcam',
    role: 'Navegación · mástil',
    fov: 73, // 96° × 73°
    pitch: -12,
    look: true,
  },
  {
    key: 'Mastcam_Z_cams',
    label: 'Mastcam-Z',
    role: 'Par estéreo con zoom · mástil',
    fov: 19.2, // 25.6° × 19.2° a 26 mm; 6.2° × 4.6° a 110 mm
    pitch: -6,
    look: true,
    zoom: [4.6, 19.2],
    focal: 26, // mm con el campo máximo
  },
  {
    key: 'hazcams_front',
    label: 'Hazcam delantera',
    role: 'Ojo de pez para esquivar obstáculos',
    fov: 90, // la real abarca 136° × 102°; el ojo de pez de la posproducción comprime los bordes
    pitch: -22,
    fisheye: 0.45,
  },
  {
    key: 'hazcams_rear',
    label: 'Hazcam trasera',
    role: 'Ojo de pez hacia atrás',
    fov: 90,
    pitch: -22,
    yaw: 180,
    fisheye: 0.45,
  },
];

const TILT_LIMITS = [-60 * DEG, 30 * DEG]; // de la cabeza del mástil
const CLEARANCE = 0.04; // m por delante de la pieza, para no ver su interior

// Cámaras del rover a pantalla completa. Cada vista tiene un pivote hijo del rover,
// en el centro de su pieza: sigue su posición, rumbo e inclinación sin cálculos
// extra. La cámara cuelga del pivote un poco por delante de la pieza, así que al
// girar la cabeza del mástil la cámara da la vuelta alrededor de ella, como la real.
// Se dibuja con una sola PerspectiveCamera fuera de la escena que copia, cada
// frame, la pose del pivote activo (el cielo y el polvo leen su posición de mundo).
export class RoverCameras {
  constructor(rover, domElement) {
    this.domElement = domElement;
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 6000);
    this.camera.rotation.order = 'YXZ';
    this.views = [];
    this.index = -1; // −1 = vista orbital
    this._listeners = [];

    rover.updateWorldMatrix(true, true);
    for (const def of VIEWS) {
      const part = rover.getObjectByName(def.key);
      if (!part) {
        console.warn(`Vista sin pieza en el modelo: ${def.key}`);
        continue;
      }
      const box = partBox(rover, part);
      const size = box.getSize(new THREE.Vector3());
      const pivot = new THREE.Object3D();
      pivot.name = `view_${def.key}`;
      pivot.position.copy(box.getCenter(new THREE.Vector3()));
      pivot.rotation.order = 'YXZ';
      rover.add(pivot);
      // Las del mástil giran: la cámara queda fuera de la cabeza mire a donde mire.
      // Las fijas solo necesitan salir de la pieza hacia donde miran.
      const reach = (def.look ? Math.max(size.x, size.z) : size.z) / 2 + CLEARANCE;
      const eye = new THREE.Object3D();
      eye.position.set(0, 0, -reach); // la cámara mira hacia −Z local
      pivot.add(eye);
      this.views.push({
        ...def,
        pivot,
        eye,
        pan: 0,
        tilt: (def.pitch ?? 0) * DEG,
        fov: def.fov,
      });
    }

    this.#bindKeys();
    this.#bindPointer();
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  // Vista activa ({ key, label, fov, … }) o null en la orbital
  get active() {
    return this.views[this.index] ?? null;
  }

  // Avanza (dir = 1) o retrocede (dir = −1) por orbital → vistas del rover → orbital
  next(dir = 1) {
    const n = this.views.length + 1;
    this.#setIndex(((this.index + 1 + dir + n) % n) - 1);
  }

  // key de VIEWS, o null para volver a la orbital
  select(key) {
    this.#setIndex(key ? this.views.findIndex((v) => v.key === key) : -1);
  }

  // Gira la cabeza del mástil (radianes) en la vista activa, si se puede girar
  look(pan, tilt) {
    const view = this.active;
    if (!view?.look) return;
    view.pan = Math.atan2(Math.sin(pan), Math.cos(pan));
    view.tilt = THREE.MathUtils.clamp(tilt, ...TILT_LIMITS);
  }

  // Campo vertical (°) de la vista activa, dentro de su zoom
  zoomTo(fov) {
    const view = this.active;
    if (!view?.zoom) return;
    view.fov = THREE.MathUtils.clamp(fov, ...view.zoom);
  }

  // Distancia focal equivalente (mm) de la vista activa, si tiene zoom
  focalLength(view = this.active) {
    if (!view?.focal) return null;
    return (view.focal * Math.tan((view.zoom[1] * DEG) / 2)) / Math.tan((view.fov * DEG) / 2);
  }

  // cb(view | null) cada vez que cambia la vista
  onChange(cb) {
    this._listeners.push(cb);
  }

  // Coloca la cámara en el pivote activo; llamar después de mover el rover
  update() {
    const view = this.active;
    if (!view) return;
    const yaw = Math.PI + ((view.yaw ?? 0) * DEG) + view.pan;
    view.pivot.rotation.set(view.tilt, yaw, 0);
    view.eye.updateWorldMatrix(true, false);
    view.eye.matrixWorld.decompose(this.camera.position, this.camera.quaternion, this.camera.scale);
    if (this.camera.fov !== view.fov) {
      this.camera.fov = view.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  #setIndex(index) {
    if (index === this.index) return;
    this.index = index;
    this.update();
    for (const cb of this._listeners) cb(this.active);
  }

  #bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyV' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      this.next(e.shiftKey ? -1 : 1);
    });
  }

  // Arrastrar gira la cabeza del mástil; la rueda hace zoom. Un píxel equivale al
  // ángulo que cubre en pantalla, así que con zoom el giro se vuelve fino.
  #bindPointer() {
    const el = this.domElement;
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      if (!this.active?.look || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      const view = this.active;
      if (!drag || !view?.look) return;
      const perPixel = (view.fov * DEG) / window.innerHeight;
      this.look(view.pan + (e.clientX - drag.x) * perPixel, view.tilt + (e.clientY - drag.y) * perPixel);
      drag = { x: e.clientX, y: e.clientY };
    });
    const release = (e) => {
      if (!drag) return;
      drag = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener(
      'wheel',
      (e) => {
        const view = this.active;
        if (!view?.zoom) return;
        e.preventDefault();
        this.zoomTo(view.fov * Math.exp(e.deltaY * 0.0015));
      },
      { passive: false },
    );
  }
}
