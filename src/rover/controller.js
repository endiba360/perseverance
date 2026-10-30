import * as THREE from 'three';
import { getSurfaceHeight } from '../world/terrain.js';
import { resolveRockCollisions } from './collisions.js';

// Conducción con WASD (o flechas). El rover real va a ~4.2 cm/s; aquí se acelera
// para que sea jugable, manteniendo su tamaño real.
const MAX_SPEED = 2.5; // m/s
const ACCELERATION = 2.0; // m/s²
const BRAKING = 4.0; // m/s²
const TURN_RATE = 0.7; // rad/s (puede girar sobre su eje)

export class RoverController {
  // wheels: { halfTrack, halfBase, width, radius } medidos del modelo (metros, frente hacia +Z)
  // wheelRig: opcional, anima el giro y la dirección de las ruedas (wheels.js)
  // rocks: opcional, RockField para chocar con las rocas grandes y trepar las pequeñas
  constructor(rover, wheels, { x = 0, z = 0, heading = 0, wheelRig = null, rocks = null } = {}) {
    this.rover = rover;
    this.wheels = wheels;
    this.wheelRig = wheelRig;
    this.rocks = rocks;
    this.position = new THREE.Vector3(x, 0, z);
    this.heading = heading; // rotación en Y; 0 = mira hacia +Z
    this.speed = 0;
    this.turnSpeed = 0;
    this.bump = 0; // metros que subieron o bajaron las ruedas sobre piedras en el último paso
    this.keys = new Set();
    this._tilt = new THREE.Quaternion();
    this._yaw = new THREE.Quaternion();
    this._up = new THREE.Vector3(0, 1, 0);
    this._normal = new THREE.Vector3();

    const codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    window.addEventListener('keydown', (e) => {
      if (!codes.includes(e.code)) return;
      this.keys.add(e.code);
      e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    this._placeOnGround(1);
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  update(delta) {
    const k = this.keys;
    const throttle = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const steer = (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) - (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0);

    // Velocidad con aceleración y frenado suaves
    const target = throttle * MAX_SPEED * (throttle < 0 ? 0.5 : 1);
    const rate = Math.sign(target - this.speed) === Math.sign(this.speed) || this.speed === 0 ? ACCELERATION : BRAKING;
    this.speed += THREE.MathUtils.clamp(target - this.speed, -rate * delta, rate * delta);

    // Giro: en reversa se invierte para que se sienta como un vehículo
    const steerDir = this.speed < -0.05 ? -steer : steer;
    this.turnSpeed = THREE.MathUtils.damp(this.turnSpeed, steerDir * TURN_RATE, 6, delta);
    this.heading += this.turnSpeed * delta;

    this.position.addScaledVector(this.forward, this.speed * delta);
    resolveRockCollisions(this, this.rocks);
    this._placeOnGround(Math.min(delta * 8, 1));
    this.wheelRig?.update(delta, this.speed, this.turnSpeed);
  }

  // Altura e inclinación según el terreno bajo las 6 ruedas. El modelo es rígido,
  // así que se ajusta el plano que mejor reparte el apoyo (como haría el rocker-bogie).
  // Las piedras pequeñas cuentan como suelo: la rueda que pisa una sube y el rover se ladea.
  _placeOnGround(smoothing) {
    const { halfTrack, halfBase, radius } = this.wheels;
    const f = this.forward;
    const r = new THREE.Vector3(f.z, 0, -f.x); // eje X local del rover
    const p = this.position;
    // Cada rueda mira su centro y sus bordes delantero y trasero: empieza a subir
    // cuando el neumático toca la piedra, no cuando ya está encima
    let onRocks = 0; // cuánto van subidas las ruedas sobre piedras, sumando las 6
    const sample = (sf, sr) => {
      const x = p.x + f.x * sf * halfBase + r.x * sr * halfTrack;
      const z = p.z + f.z * sf * halfBase + r.z * sr * halfTrack;
      let sand = -Infinity;
      let rock = -Infinity;
      for (const d of [0, radius, -radius]) {
        sand = Math.max(sand, getSurfaceHeight(x + f.x * d, z + f.z * d));
        if (this.rocks) rock = Math.max(rock, this.rocks.heightAt(x + f.x * d, z + f.z * d));
      }
      onRocks += Math.max(rock - sand, 0);
      return Math.max(sand, rock);
    };
    // [delantera, media, trasera] de cada lado
    const left = [sample(1, 1), sample(0, 1), sample(-1, 1)];
    const right = [sample(1, -1), sample(0, -1), sample(-1, -1)];
    const all = [...left, ...right];

    // Sacudida: cuántos metros subieron o bajaron las ruedas sobre piedras desde
    // el paso anterior. En la arena es 0; la cámara la usa para temblar (cameraShake.js).
    this.bump = this._onRocks === undefined ? 0 : Math.abs(onRocks - this._onRocks);
    this._onRocks = onRocks;

    // Plano por mínimos cuadrados y luego se sube lo justo para que ninguna rueda se hunda
    const mean = all.reduce((a, b) => a + b, 0) / 6;
    const slopeF = (left[0] + right[0] - left[2] - right[2]) / (4 * halfBase); // m por m hacia delante
    const slopeX = (left[0] + left[1] + left[2] - right[0] - right[1] - right[2]) / (6 * halfTrack); // hacia +X
    const plane = (sf, sr) => mean + slopeF * sf * halfBase + slopeX * sr * halfTrack;
    let lift = 0;
    [1, 0, -1].forEach((sf, i) => {
      lift = Math.max(lift, left[i] - plane(sf, 1), right[i] - plane(sf, -1));
    });

    const height = mean + lift * 0.7; // deja que las ruedas se hundan un poco en la arena
    p.y = smoothing >= 1 ? height : THREE.MathUtils.lerp(p.y, height, smoothing);

    const pitch = Math.atan(slopeF);
    const roll = Math.atan(slopeX);
    this._yaw.setFromAxisAngle(this._up, this.heading);
    this._tilt.setFromEuler(new THREE.Euler(-pitch, 0, roll, 'XYZ'));
    const targetQuat = this._yaw.clone().multiply(this._tilt);

    this.rover.position.copy(p);
    if (smoothing >= 1) this.rover.quaternion.copy(targetQuat);
    else this.rover.quaternion.slerp(targetQuat, smoothing);
  }
}
