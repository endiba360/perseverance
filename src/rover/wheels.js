import * as THREE from 'three';

// En el GLB de la NASA las 6 ruedas vienen fusionadas en `Wheels_objs`: 3 mallas
// (llanta, neumático y tapa) y cada una contiene las 6 ruedas. Aquí se separan por
// posición para que cada rueda ruede y las 4 de las esquinas puedan orientarse,
// como en el Perseverance real (las centrales son fijas).
const WHEEL_KEYS = ['LF', 'LM', 'LB', 'RF', 'RM', 'RB']; // L = lado +X, F/M/B = delantera/media/trasera
const STEER_RESPONSE = 10; // rapidez con la que las ruedas alcanzan su ángulo

function wheelKey(x, z) {
  return (x > 0 ? 'L' : 'R') + (z > 0.6 ? 'F' : z < -0.6 ? 'B' : 'M');
}

// rover: el grupo raíz ya armado (en el origen, sin rotar), para medir las ruedas en su marco
export function createWheelRig(rover) {
  const group = rover.getObjectByName('Wheels_objs');
  const parts = group.children.filter((obj) => obj.isMesh);

  // Reparte los triángulos de cada malla entre las 6 ruedas y mide cada rueda
  const boxes = {};
  const split = [];
  const v = new THREE.Vector3();
  for (const mesh of parts) {
    const pos = mesh.geometry.attributes.position;
    const index = mesh.geometry.index.array;
    const lists = {};
    for (let i = 0; i < index.length; i += 3) {
      v.fromBufferAttribute(pos, index[i]);
      (lists[wheelKey(v.x, v.z)] ??= []).push(index[i], index[i + 1], index[i + 2]);
    }
    for (const [key, list] of Object.entries(lists)) {
      const box = (boxes[key] ??= new THREE.Box3());
      for (const vi of list) box.expandByPoint(v.fromBufferAttribute(pos, vi).applyMatrix4(mesh.matrix));
    }
    split.push({ mesh, lists });
  }

  // Jerarquía por rueda: steer (gira en Y) → spin (rueda en X) → piezas centradas en el eje
  const wheels = WHEEL_KEYS.map((key) => {
    const center = boxes[key].getCenter(new THREE.Vector3());
    const steer = new THREE.Group();
    steer.name = `wheel_${key}`;
    steer.position.copy(center);
    const spin = new THREE.Group();
    steer.add(spin);
    group.add(steer);

    for (const { mesh, lists } of split) {
      if (!lists[key]) continue;
      // Comparte los atributos de la malla original; solo cambia el índice
      const geometry = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(mesh.geometry.attributes)) geometry.setAttribute(name, attribute);
      geometry.setIndex(lists[key]);
      const part = new THREE.Mesh(geometry, mesh.material);
      part.name = `${mesh.name}_${key}`;
      part.position.copy(mesh.position).sub(center);
      part.quaternion.copy(mesh.quaternion);
      part.scale.copy(mesh.scale);
      spin.add(part);
    }
    return { key, steer, spin, steerable: !key.endsWith('M'), x: 0, z: 0 };
  });
  parts.forEach((mesh) => group.remove(mesh));

  // Posición de cada rueda en el marco del rover (para la cinemática)
  rover.updateMatrixWorld(true);
  const toRover = rover.matrixWorld.clone().invert();
  for (const wheel of wheels) {
    const p = wheel.steer.getWorldPosition(new THREE.Vector3()).applyMatrix4(toRover);
    wheel.x = p.x;
    wheel.z = p.z;
  }

  const radius = boxes.LF.getSize(new THREE.Vector3()).y / 2;
  const corners = wheels.filter((w) => w.steerable);
  const halfTrack = wheels.reduce((sum, w) => sum + Math.abs(w.x), 0) / wheels.length;
  const halfBase = corners.reduce((sum, w) => sum + Math.abs(w.z), 0) / corners.length;

  // Cinemática de cuerpo rígido: con avance `speed` (m/s) y giro `yawRate` (rad/s),
  // la rueda en (x, z) se mueve a (yawRate·z, speed − yawRate·x). Las esquinas se
  // orientan en esa dirección (al girar en el sitio quedan en diamante) y todas
  // ruedan a la velocidad de su punto de apoyo.
  const update = (delta, speed, yawRate) => {
    for (const wheel of wheels) {
      const vx = yawRate * wheel.z;
      const vz = speed - yawRate * wheel.x;
      if (wheel.steerable && Math.hypot(vx, vz) > 0.01) {
        // Ángulo dentro de ±90°: si la rueda va hacia atrás, rueda en reversa
        const target = vz >= 0 ? Math.atan2(vx, vz) : Math.atan2(-vx, -vz);
        wheel.steer.rotation.y = THREE.MathUtils.damp(wheel.steer.rotation.y, target, STEER_RESPONSE, delta);
      }
      const angle = wheel.steer.rotation.y;
      const rolling = vx * Math.sin(angle) + vz * Math.cos(angle);
      wheel.spin.rotation.x = (wheel.spin.rotation.x + (rolling / radius) * delta) % (Math.PI * 2);
    }
  };

  return { wheels, radius, halfTrack, halfBase, update };
}
