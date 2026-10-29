import * as THREE from 'three';
import { getHeight } from '../world/terrain.js';

// Cámara de seguimiento: OrbitControls sigue al rover (puedes girar con el mouse)
// y, mientras conduces, la cámara se va colocando detrás de él.
export class FollowCamera {
  constructor(camera, controls, controller, { height = 1.4, swing = 1.6 } = {}) {
    this.camera = camera;
    this.controls = controls;
    this.controller = controller;
    this.height = height;
    this.swing = swing; // rapidez con la que vuelve detrás del rover (rad/s)
    this.dragging = false;
    this._target = new THREE.Vector3();
    this._move = new THREE.Vector3();
    this._offset = new THREE.Vector3();
    controls.addEventListener('start', () => (this.dragging = true));
    controls.addEventListener('end', () => (this.dragging = false));
    controls.target.copy(this._focus());
  }

  _focus() {
    return this._target.copy(this.controller.position).add(new THREE.Vector3(0, this.height, 0));
  }

  update(delta) {
    const { camera, controls, controller } = this;

    // Mueve cámara y objetivo junto con el rover
    const focus = this._focus();
    this._move.subVectors(focus, controls.target);
    camera.position.add(this._move);
    controls.target.copy(focus);

    // Al conducir, rota suavemente la cámara hacia atrás del rover
    const speedFactor = Math.min(Math.abs(controller.speed) / 1.5, 1);
    if (!this.dragging && speedFactor > 0.02) {
      this._offset.subVectors(camera.position, focus);
      const radius = Math.hypot(this._offset.x, this._offset.z);
      const current = Math.atan2(this._offset.x, this._offset.z);
      const desired = controller.heading + Math.PI;
      const diff = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
      const angle = current + diff * Math.min(this.swing * speedFactor * delta, 1);
      camera.position.x = focus.x + Math.sin(angle) * radius;
      camera.position.z = focus.z + Math.cos(angle) * radius;
    }

    // Nunca bajo el suelo
    const ground = getHeight(camera.position.x, camera.position.z) + 0.6;
    if (camera.position.y < ground) camera.position.y = ground;
  }
}
