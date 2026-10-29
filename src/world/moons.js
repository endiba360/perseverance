import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D } from '../utils/noise.js';

// Fobos y Deimos: lunas pequeñas e irregulares. Escala artística para que se
// distingan en el cielo (Fobos se ve ~1/3 de la Luna terrestre; Deimos casi un punto).
function createMoonGeometry(seed, elongation) {
  const noise = createNoise2D(seed);
  const geometry = mergeVertices(new THREE.IcosahedronGeometry(1, 5));
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  const stickney = new THREE.Vector3(0.7, 0.2, 0.68);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let d = noise(v.x * 1.2, v.y * 1.2 + v.z) * 0.12 + noise(v.z * 3 + v.x, v.y * 3) * 0.05;
    // Cráteres simples (Stickney en Fobos es enorme)
    const crater = Math.max(0, 1 - v.distanceTo(stickney) / 0.45);
    d -= crater * crater * 0.18;
    v.multiplyScalar(1 + d);
    v.x *= elongation;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Sombreado propio: luz lateral (fase gibosa) + bruma del cielo marciano.
// Así las lunas no quedan como siluetas aunque el sol esté detrás de ellas.
const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vLocal;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uLightDir;
  uniform vec3 uColor;
  uniform vec3 uHaze;
  uniform float uHazeAmount;
  varying vec3 vNormal;
  varying vec3 vLocal;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(17.1, 113.7, 51.3))) * 43758.5453); }
  void main() {
    float diffuse = max(dot(normalize(vNormal), uLightDir), 0.0);
    float speckle = 0.85 + 0.15 * hash(floor(vLocal * 18.0));
    vec3 col = uColor * speckle * (0.06 + diffuse * 1.1);
    col = mix(col, uHaze, uHazeAmount);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createMoons() {
  const group = new THREE.Group();
  group.name = 'moons';
  const lightDir = new THREE.Vector3(0.75, 0.35, 0.55).normalize();

  const make = (name, seed, elongation, radius, dir, color, haze) => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uLightDir: { value: lightDir },
        uColor: { value: new THREE.Color(color) },
        uHaze: { value: new THREE.Color(0xb8743c) },
        uHazeAmount: { value: haze },
      },
      vertexShader,
      fragmentShader,
      fog: false,
    });
    const moon = new THREE.Mesh(createMoonGeometry(seed, elongation), material);
    moon.name = name;
    moon.scale.setScalar(radius);
    moon.position.copy(dir.clone().normalize().multiplyScalar(1400));
    moon.rotation.set(0.4, seed, 0.2);
    return moon;
  };

  const phobos = make('phobos', 11, 1.35, 22, new THREE.Vector3(0.42, 0.27, -1), 0xd9b89a, 0.4);
  const deimos = make('deimos', 23, 1.15, 8, new THREE.Vector3(0.05, 0.36, -1), 0xe8c8aa, 0.35);
  group.add(phobos, deimos);

  group.userData.update = (time, camera) => {
    // Las lunas están "en el infinito": se mueven con la cámara
    group.position.copy(camera.position);
    phobos.rotation.y = 11 + time * 0.01;
  };
  return group;
}
