import * as THREE from 'three';
import { partCenter } from '../rover/parts.js';
import './hud.css';
import './cameraSpots.css';

// Mastcam-Z y las Navcams son pares estéreo en la misma cabeza del mástil: el
// centro de las dos piezas cae casi en el mismo punto. Cada punto se pone sobre
// una cámara de su par, uno en el lado +X y otro en el −X, para que no se encimen.
const PAIR_SIDE = { Mastcam_Z_cams: 1, NavCams: -1 };

// Puntos que brillan sobre las cámaras del modelo. Son botones HTML que se
// proyectan cada frame sobre la pieza 3D; al pasar el mouse dicen su nombre y
// al hacer clic llaman a onShoot(clave).
export class CameraSpots {
  // cameras: { nombreDeLaPieza: { label, role } }
  constructor(camera, rover, cameras, onShoot) {
    this.camera = camera;
    this.spots = [];
    this._v = new THREE.Vector3();
    this.root = document.createElement('div');
    this.root.className = 'cam-spots';

    for (const [key, info] of Object.entries(cameras)) {
      const part = rover.getObjectByName(key);
      if (!part) {
        console.warn(`Cámara sin pieza en el modelo: ${key}`);
        continue;
      }
      // Centro de la pieza en sus propias coordenadas: sigue al rover al moverse
      rover.updateWorldMatrix(true, true);
      const center = partCenter(rover, part, PAIR_SIDE[key]);
      const local = part.worldToLocal(rover.localToWorld(center));

      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'cam-spot';
      el.dataset.camera = key;
      el.setAttribute('aria-label', `${info.label}: tomar una foto`);
      el.innerHTML = `
        <span class="cam-spot__dot" aria-hidden="true"></span>
        <span class="cam-spot__tip" aria-hidden="true">
          <strong>${info.label}</strong><small>${info.role} · clic para tomar foto</small>
        </span>`;
      el.addEventListener('click', () => {
        el.classList.remove('cam-spot--shot');
        void el.offsetWidth; // reinicia la animación del destello
        el.classList.add('cam-spot--shot');
        el.blur(); // las flechas y la barra espaciadora vuelven a conducir
        onShoot(key);
      });
      this.root.append(el);
      this.spots.push({ key, part, local, el });
    }
    document.body.append(this.root);
  }

  // Coloca cada punto sobre su pieza; llamar después de mover la cámara
  update() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const shown = [];
    for (const spot of this.spots) {
      spot.part.updateWorldMatrix(true, false); // el rover ya se movió en este frame
      const v = spot.part.localToWorld(this._v.copy(spot.local)).project(this.camera);
      spot.el.hidden = !(v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1);
      if (spot.el.hidden) continue;
      spot.x = ((v.x + 1) / 2) * w;
      spot.y = ((1 - v.y) / 2) * h;
      shown.push(spot);
    }
    separate(shown);
    for (const { el, x, y } of shown) el.style.transform = `translate(${x}px, ${y}px)`;
  }
}

// Visto de lado o de lejos, dos cámaras del mástil caen casi en el mismo píxel:
// se separan en pantalla lo justo para poder hacer clic en cada una
const MIN_GAP = 26; // px, casi el tamaño del botón

function separate(spots) {
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        const a = spots[i];
        const b = spots[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= MIN_GAP) continue;
        if (dist < 0.01) [dx, dy, dist] = [1, 0, 1]; // encimados: uno a cada lado
        const push = (MIN_GAP - dist) / 2 / dist;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
      }
    }
  }
}
