import * as THREE from 'three';
import { getSurfaceHeight } from '../world/terrain.js';

// Huellas de las ruedas: una tira por lado que se va alargando sobre la arena.
// Usa un búfer circular para no crecer sin límite.
const SEGMENT_LENGTH = 0.25; // metros entre muestras
const MAX_SEGMENTS = 4000; // ~1 km de huella por lado
const LIFT = 0.05; // separación del suelo para evitar parpadeo

// Textura de la banda de rodadura. En Marte la huella apenas cambia de color: lo
// que se ve es el relieve de los surcos de los grousers con la luz rasante. Por eso
// el color es un tinte suave y el dibujo de chevrones va sobre todo en el bump map.
function createTreadCanvas({ edge, base, groove }) {
  const w = 64;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  // Bordes: arena levantada por la rueda
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, 5, h);
  ctx.fillRect(w - 5, 0, 5, h);
  // Base: arena compactada
  ctx.fillStyle = base;
  ctx.fillRect(5, 0, w - 10, h);
  // Surcos en chevrón
  ctx.strokeStyle = groove;
  ctx.lineWidth = 6;
  for (let y = -16; y < h + 16; y += 21) {
    ctx.beginPath();
    ctx.moveTo(7, y + 10);
    ctx.lineTo(w / 2, y);
    ctx.lineTo(w - 7, y + 10);
    ctx.stroke();
  }
  return canvas;
}

function toTexture(canvas, colorSpace) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function createTreadTextures() {
  const color = createTreadCanvas({
    edge: 'rgba(235,170,120,0.25)',
    base: 'rgba(150,80,45,0.22)',
    groove: 'rgba(95,45,22,0.38)',
  });
  // Relieve (gris opaco): bordes altos, base media, surcos hundidos
  const bump = createTreadCanvas({ edge: '#d0d0d0', base: '#8a8a8a', groove: '#303030' });
  return { map: toTexture(color, THREE.SRGBColorSpace), bumpMap: toTexture(bump, THREE.NoColorSpace) };
}

class TrackStrip {
  constructor(material) {
    this.width = 0.4;
    // Cada segmento son 2 vértices (borde izquierdo y derecho de la huella)
    this.positions = new Float32Array(MAX_SEGMENTS * 2 * 3);
    this.uvs = new Float32Array(MAX_SEGMENTS * 2 * 2);
    const indices = new Uint32Array((MAX_SEGMENTS - 1) * 6);
    for (let i = 0; i < MAX_SEGMENTS - 1; i++) {
      const a = i * 2;
      // Orden antihorario visto desde arriba para que la cara mire hacia el cielo
      indices.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], i * 6);
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    this.geometry.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 1;
    this.count = 0;
    this.distance = 0;
    this.last = null;
  }

  add(center, side) {
    if (this.last) this.distance += this.last.distanceTo(center);
    if (this.count >= MAX_SEGMENTS) {
      // Búfer lleno: descarta la mitad más antigua
      const half = MAX_SEGMENTS / 2;
      this.positions.copyWithin(0, half * 6);
      this.uvs.copyWithin(0, half * 4);
      this.count -= half;
    }
    const i = this.count;
    for (const [k, s] of [[0, -1], [1, 1]]) {
      const x = center.x + side.x * s * this.width * 0.5;
      const z = center.z + side.z * s * this.width * 0.5;
      this.positions.set([x, getSurfaceHeight(x, z) + LIFT, z], (i * 2 + k) * 3);
      this.uvs.set([k, this.distance / 0.6], (i * 2 + k) * 2);
    }
    this.count++;
    this.last = center.clone();
    this.geometry.setDrawRange(0, Math.max(this.count - 1, 0) * 6);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
  }
}

export class Tracks {
  constructor() {
    const { map, bumpMap } = createTreadTextures();
    const material = new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 4,
      transparent: true,
      depthWrite: false,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.strips = [new TrackStrip(material), new TrackStrip(material)];
    this.group = new THREE.Group();
    this.group.name = 'tracks';
    this.strips.forEach((s) => this.group.add(s.mesh));
    this.lastSample = null;
    this.halfTrack = 1.15;
  }

  // Ajusta separación y ancho a las ruedas medidas en el modelo
  configure({ halfTrack, width }) {
    this.halfTrack = halfTrack;
    this.strips.forEach((s) => (s.width = width));
  }

  update(controller) {
    const pos = controller.position;
    if (this.lastSample && this.lastSample.distanceToSquared(pos) < SEGMENT_LENGTH * SEGMENT_LENGTH) return;
    const f = controller.forward;
    const side = new THREE.Vector3(f.z, 0, -f.x);
    this.strips.forEach((strip, i) => {
      const s = i === 0 ? -1 : 1;
      strip.add(pos.clone().addScaledVector(side, s * this.halfTrack), side);
    });
    this.lastSample = pos.clone();
  }
}
