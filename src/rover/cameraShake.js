import * as THREE from 'three';
import { createNoise2D } from '../utils/noise.js';

// Temblor de cámara al pasar sobre piedras. Usa un "trauma" (0 a 1) que sube con
// los metros que suben o bajan las ruedas y se apaga solo; el temblor crece con
// trauma² para que las piedritas casi no se noten y las grandes sí.
// Solo gira la cámara un poco: OrbitControls la vuelve a orientar con lookAt en
// cada frame, así que el temblor no se acumula ni pelea con el mouse.
const FULL_BUMP = 0.3; // metros de sacudida (sumando ruedas) que dan el temblor máximo
const DECAY = 1.6; // trauma que se pierde por segundo
const FREQUENCY = 14; // qué tan rápido vibra
const MAX_ANGLE = {
  pitch: THREE.MathUtils.degToRad(0.9),
  yaw: THREE.MathUtils.degToRad(0.5),
  roll: THREE.MathUtils.degToRad(1.1),
};

export class CameraShake {
  constructor(camera) {
    this.camera = camera;
    this.trauma = 0;
    this.noise = createNoise2D(7);
  }

  // Llamar después de controls.update(), justo antes de dibujar.
  // bump: metros que subieron o bajaron las ruedas sobre piedras en este frame (controller.bump)
  update(delta, time, bump) {
    this.trauma = THREE.MathUtils.clamp(this.trauma - DECAY * delta + bump / FULL_BUMP, 0, 1);
    if (this.trauma === 0) return;
    const shake = this.trauma * this.trauma;
    const t = time * FREQUENCY;
    this.camera.rotateX(MAX_ANGLE.pitch * shake * this.noise(t, 0));
    this.camera.rotateY(MAX_ANGLE.yaw * shake * this.noise(t, 10));
    this.camera.rotateZ(MAX_ANGLE.roll * shake * this.noise(t, 20));
  }
}
