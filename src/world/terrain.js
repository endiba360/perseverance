import * as THREE from 'three';
import { createNoise2D, fbm } from '../utils/noise.js';

const noise = createNoise2D(2021);
const detail = createNoise2D(7);

// Dirección del viento dominante: las crestas de las dunas quedan perpendiculares
const WIND = new THREE.Vector2(Math.cos(0.5), Math.sin(0.5));
const DUNE_WAVELENGTH = 38; // metros entre crestas

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// Perfil asimétrico de duna: ladera de barlovento suave y sotavento abrupto
function duneProfile(phase) {
  const f = phase - Math.floor(phase);
  return f < 0.78 ? smoothstep(0, 0.78, f) : 1 - smoothstep(0.78, 1, f);
}

// Altura del terreno en metros; la usan también las rocas para asentarse
export function getHeight(x, z) {
  const along = (x * WIND.x + z * WIND.y) / DUNE_WAVELENGTH;
  const warp = fbm(noise, x * 0.006, z * 0.006, 3) * 2.2;
  const strength = smoothstep(-0.35, 0.45, fbm(noise, x * 0.004 + 40, z * 0.004 - 17, 3));
  const dunes = duneProfile(along + warp) * 6 * strength;

  // Relieve de gran escala (llanura del cráter con lomas)
  const hills = fbm(noise, x * 0.0025, z * 0.0025, 4) * 14;
  // Ondulación fina
  const bumps = fbm(detail, x * 0.05, z * 0.05, 3) * 0.35;

  // Zona de la cámara algo más llana para que se vea el suelo con rocas
  const near = smoothstep(10, 60, Math.hypot(x, z - 10));
  return hills * (0.35 + 0.65 * near) + dunes * (0.25 + 0.75 * near) + bumps;
}

// Textura procedural de rizos de arena para dar grano de cerca (bump map)
function createRippleTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const n = createNoise2D(99);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Coordenadas periódicas para que la textura sea repetible sin costuras
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const warp = n(Math.cos(u) * 1.5, Math.sin(v) * 1.5) * 0.9;
      const ripple = Math.pow(Math.sin(v * 24 + warp * 3 + Math.sin(u * 2) * 1.2) * 0.5 + 0.5, 1.6);
      const fade = n(Math.cos(u) * 2 + 9, Math.sin(v) * 2) * 0.5 + 0.5; // rizos que aparecen y desaparecen
      const grain = n(x * 0.35, y * 0.35) * 0.5 + 0.5;
      const value = Math.floor((ripple * fade * 0.55 + grain * 0.45) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = value;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(160, 160);
  texture.anisotropy = 8;
  return texture;
}

export function createTerrain({ size = 900, segments = 450 } = {}) {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(0xc27a48);
  const rust = new THREE.Color(0x8e4426);
  const pale = new THREE.Color(0xdba070);
  const dark = new THREE.Color(0x5e2c18);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = getHeight(x, z);
    pos.setY(i, h);

    // Color: crestas claras, valles oscuros y manchas de óxido
    const patch = fbm(detail, x * 0.01 + 5, z * 0.01, 3) * 0.5 + 0.5;
    c.copy(sand).lerp(rust, smoothstep(0.35, 0.8, patch) * 0.7);
    c.lerp(pale, smoothstep(2, 9, h) * 0.45);
    c.lerp(dark, smoothstep(-2, -10, h) * 0.5);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    bumpMap: createRippleTexture(),
    bumpScale: 0.35,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
