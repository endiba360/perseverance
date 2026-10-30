import * as THREE from 'three';

// Choque con las rocas que el rover no puede trepar. El contorno del rover es un
// rectángulo que gira con el rumbo y cada roca un círculo. Si se traslapan, se
// empuja el rover hacia afuera: así se desliza por el borde de la roca en vez de
// quedarse pegado, y pierde la parte de su velocidad que iba contra ella.
const MAX_ROCK_RADIUS = 3; // metros, holgura para buscar rocas cercanas
const ITERATIONS = 2; // por si toca dos rocas a la vez

const closest = new THREE.Vector3();
const away = new THREE.Vector3();

export function resolveRockCollisions(controller, field) {
  if (!field) return false;
  const { halfTrack, halfBase, width, radius } = controller.wheels;
  const halfWidth = halfTrack + width / 2;
  const halfLength = halfBase + radius;
  const p = controller.position;
  let hit = false;

  for (let n = 0; n < ITERATIONS; n++) {
    const f = controller.forward;
    const r = new THREE.Vector3(f.z, 0, -f.x);
    let moved = false;
    for (const rock of field.near(p.x, p.z, Math.hypot(halfWidth, halfLength) + MAX_ROCK_RADIUS)) {
      if (rock.climbable) continue;
      const dx = rock.x - p.x;
      const dz = rock.z - p.z;
      // Punto del rectángulo más cercano al centro de la roca
      const along = THREE.MathUtils.clamp(dx * f.x + dz * f.z, -halfLength, halfLength);
      const side = THREE.MathUtils.clamp(dx * r.x + dz * r.z, -halfWidth, halfWidth);
      closest.set(p.x + f.x * along + r.x * side, 0, p.z + f.z * along + r.z * side);
      away.set(closest.x - rock.x, 0, closest.z - rock.z);
      const dist = away.length();
      if (dist >= rock.radius) continue;
      // Centro de la roca dentro del rectángulo: sale por el lado de avance
      if (dist < 1e-6) away.copy(f).multiplyScalar(-Math.sign(dx * f.x + dz * f.z) || -1);
      else away.divideScalar(dist);
      p.addScaledVector(away, rock.radius - dist);

      // Quita la parte de la velocidad que va contra la roca: de frente se
      // detiene; en diagonal conserva la parte que la rodea
      const into = -(f.x * away.x + f.z * away.z) * Math.sign(controller.speed);
      if (into > 0) controller.speed *= Math.sqrt(Math.max(0, 1 - into * into));
      hit = moved = true;
    }
    if (!moved) break;
  }
  return hit;
}
