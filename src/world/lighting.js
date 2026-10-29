import * as THREE from 'three';

// Sol bajo de tarde con sombras suaves + luz de relleno del cielo polvoriento
export function createLighting(sunDir) {
  const group = new THREE.Group();

  const sun = new THREE.DirectionalLight(0xffb878, 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const s = sun.shadow.camera;
  s.left = -90;
  s.right = 90;
  s.top = 90;
  s.bottom = -90;
  s.near = 1;
  s.far = 600;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.08;
  sun.shadow.radius = 6; // penumbra suave (PCF)
  group.add(sun, sun.target);

  const sky = new THREE.HemisphereLight(0xd89a64, 0x5c2814, 0.85);
  group.add(sky);

  // La luz sigue a la cámara para que las sombras siempre cubran lo visible
  const offset = sunDir.clone().normalize().multiplyScalar(300);
  group.userData.update = (focus) => {
    sun.target.position.copy(focus);
    sun.position.copy(focus).add(offset);
  };
  return group;
}
