import * as THREE from 'three';

// Cielo marciano de tarde: degradado caramelo, bruma de polvo en el horizonte,
// resplandor cálido del sol y el halo azulado real de los atardeceres en Marte.
const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // siempre en el plano lejano
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunGlow;
  uniform vec3 uBlueHalo;
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    float mu = max(dot(dir, uSunDir), 0.0);

    // Degradado vertical
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.18, h));
    col = mix(col, uZenith, smoothstep(0.15, 0.85, h));
    col = mix(col, uGround, smoothstep(0.0, -0.08, h));

    // Velos de polvo en suspensión, más densos cerca del horizonte
    vec2 uv = dir.xz / (h + 0.25);
    float dust = fbm(uv * 1.6 + vec2(uTime * 0.004, 0.0));
    float band = exp(-max(h, 0.0) * 6.0);
    col = mix(col, uHorizon * 1.12, smoothstep(0.3, 0.75, dust) * band * 0.8);

    // Halo azulado alrededor del sol (dispersión del polvo fino marciano)
    col = mix(col, uBlueHalo, pow(mu, 40.0) * 0.5);
    // Resplandor cálido amplio y corona
    col += uSunGlow * (pow(mu, 12.0) * 0.18 + pow(mu, 90.0) * 0.6);
    // Disco solar (más pequeño que en la Tierra) en HDR para el bloom
    float disk = smoothstep(0.99985, 0.99993, mu);
    col += vec3(1.0, 0.93, 0.82) * disk * 22.0;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSky(sunDir) {
  const uniforms = {
    uSunDir: { value: sunDir.clone().normalize() },
    uZenith: { value: new THREE.Color(0x6e3c1c) },
    uMid: { value: new THREE.Color(0xb8743c) },
    uHorizon: { value: new THREE.Color(0xd99a5e) },
    uGround: { value: new THREE.Color(0x8a4f2c) },
    uSunGlow: { value: new THREE.Color(0xffb36b) },
    uBlueHalo: { value: new THREE.Color(0xb9c4cf) },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), material);
  sky.scale.setScalar(2500);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  sky.name = 'sky';
  sky.userData.update = (time, camera) => {
    uniforms.uTime.value = time;
    sky.position.copy(camera.position);
  };
  return sky;
}
