import * as THREE from 'three';
import { createRandom } from '../utils/noise.js';

// Partículas de polvo flotando, arrastradas por el viento alrededor de la cámara
function createDustSprite() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function createDust({ count = 5000, extent = 60, height = 14 } = {}) {
  const random = createRandom(42);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (random() - 0.5) * extent * 2;
    positions[i * 3 + 1] = random() * height;
    positions[i * 3 + 2] = (random() - 0.5) * extent * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffc08a,
    size: 0.16,
    map: createDustSprite(),
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'dust';
  points.frustumCulled = false;

  const wind = new THREE.Vector3(1.2, 0.05, 0.6);
  points.userData.update = (time, delta, camera) => {
    const pos = geometry.attributes.position;
    const base = camera.position;
    for (let i = 0; i < count; i++) {
      let x = pos.getX(i) + (wind.x + Math.sin(time * 0.7 + i) * 0.3) * delta;
      let y = pos.getY(i) + (wind.y + Math.sin(time * 0.5 + i * 1.7) * 0.08) * delta;
      let z = pos.getZ(i) + (wind.z + Math.cos(time * 0.6 + i) * 0.3) * delta;
      // Envuelve las partículas en una caja centrada en la cámara
      if (x - base.x > extent) x -= extent * 2;
      if (x - base.x < -extent) x += extent * 2;
      if (z - base.z > extent) z -= extent * 2;
      if (z - base.z < -extent) z += extent * 2;
      if (y > height) y = 0;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  };
  return points;
}
