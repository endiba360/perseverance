import * as THREE from 'three';

// Caja de una pieza del modelo en coordenadas del rover; con side (1 o −1), solo
// la mitad de ese lado en X. Sirve para los pares estéreo, cuyas dos cámaras
// vienen fusionadas en una sola pieza.
export function partBox(rover, part, side) {
  const toRover = new THREE.Matrix4();
  const inverse = rover.matrixWorld.clone().invert();
  const points = [];
  part.traverse((mesh) => {
    if (!mesh.isMesh) return;
    toRover.multiplyMatrices(inverse, mesh.matrixWorld);
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(toRover));
  });
  const box = new THREE.Box3().setFromPoints(points);
  if (side) {
    const mid = box.getCenter(new THREE.Vector3()).x;
    box.setFromPoints(points.filter((p) => (p.x - mid) * side > 0));
  }
  return box;
}

// Centro de esa caja
export function partCenter(rover, part, side) {
  return partBox(rover, part, side).getCenter(new THREE.Vector3());
}
