import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, createRandom } from '../utils/noise.js';
import { getHeight } from './terrain.js';

// Geometría de roca: icosaedro deformado con ruido, base aplanada
function createRockGeometry(seed) {
  const noise = createNoise2D(seed);
  const random = createRandom(seed);
  const geometry = mergeVertices(new THREE.IcosahedronGeometry(1, 4));
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  const stretch = new THREE.Vector3(0.8 + random() * 0.7, 0.5 + random() * 0.4, 0.8 + random() * 0.6);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      noise(v.x * 1.3 + v.y, v.z * 1.3 - v.y) * 0.22 +
      noise(v.x * 3.5 - v.z, v.y * 3.5 + v.x) * 0.08 +
      noise(v.y * 8 + v.z, v.x * 8) * 0.025;
    v.multiplyScalar(1 + n).multiply(stretch);
    // Facetas: corta el volumen con algunos planos para parecer piedra fracturada
    if (v.y < -0.15) v.y = -0.15 + (v.y + 0.15) * 0.2;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function createRocks({ count = 900, seed = 3 } = {}) {
  const group = new THREE.Group();
  group.name = 'rocks';
  const random = createRandom(seed);
  const material = new THREE.MeshStandardMaterial({ color: 0x6a3a26, roughness: 0.88, metalness: 0.02 });
  const variants = 6;
  const perVariant = Math.ceil(count / variants);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const tint = new THREE.Color();

  for (let k = 0; k < variants; k++) {
    const mesh = new THREE.InstancedMesh(createRockGeometry(seed * 31 + k), material, perVariant);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    for (let i = 0; i < perVariant; i++) {
      // Más densidad cerca de la cámara; distribución de tamaños tipo ley de potencia
      const r = 4 + Math.pow(random(), 1.8) * 160;
      const a = random() * Math.PI * 2;
      p.set(Math.cos(a) * r, 0, Math.sin(a) * r + 10);
      // Junto a la cámara solo piedras pequeñas para no tapar el paisaje
      const near = Math.min(Math.hypot(p.x, p.z - 18) / 25, 1);
      const size = (0.06 + Math.pow(random(), 6) * 1.1 + (random() < 0.015 ? 0.9 : 0)) * (0.35 + 0.65 * near);
      s.set(size, size, size);
      p.y = getHeight(p.x, p.z) - size * 0.12;
      e.set((random() - 0.5) * 0.4, random() * Math.PI * 2, (random() - 0.5) * 0.4);
      q.setFromEuler(e);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      tint.setHSL(0.04 + random() * 0.03, 0.35 + random() * 0.2, 0.18 + random() * 0.12);
      mesh.setColorAt(i, tint);
    }
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}
