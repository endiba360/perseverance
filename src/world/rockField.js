// Dónde está cada roca y qué tan alta es, para que el rover choque con ellas o
// se suba encima. Las rocas se guardan en una cuadrícula para consultar solo las
// cercanas en vez de recorrer las ~900 cada frame.

// Altura máxima que las ruedas pueden trepar (m). Percy real evita rocas más
// altas que ~40 cm, casi el diámetro de su rueda (52 cm); las más bajas pasan
// también bajo la caja, que va a ~60 cm del suelo.
export const CLIMB_LIMIT = 0.4;

const CELL = 4; // metros por celda

export class RockField {
  constructor() {
    this.cells = new Map(); // "i,j" → rocas
    this.rocks = [];
  }

  // radius: radio en planta; height: cima sobre la arena; base: altura de la arena
  add({ x, z, radius, height, base }) {
    const rock = { x, z, radius, height, base, climbable: height <= CLIMB_LIMIT };
    this.rocks.push(rock);
    // Se registra en todas las celdas que toca su círculo
    for (let i = Math.floor((x - radius) / CELL); i <= Math.floor((x + radius) / CELL); i++) {
      for (let j = Math.floor((z - radius) / CELL); j <= Math.floor((z + radius) / CELL); j++) {
        const key = `${i},${j}`;
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(rock);
      }
    }
  }

  // Rocas cuyas celdas tocan el círculo (x, z, range); sin repetidas
  near(x, z, range) {
    const found = new Set();
    for (let i = Math.floor((x - range) / CELL); i <= Math.floor((x + range) / CELL); i++) {
      for (let j = Math.floor((z - range) / CELL); j <= Math.floor((z + range) / CELL); j++) {
        this.cells.get(`${i},${j}`)?.forEach((rock) => found.add(rock));
      }
    }
    return found;
  }

  // Altura de la roca trepable más alta bajo el punto, con perfil de domo;
  // -Infinity si no hay ninguna
  heightAt(x, z) {
    let top = -Infinity;
    this.cells.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`)?.forEach((rock) => {
      if (!rock.climbable) return;
      const d2 = ((x - rock.x) ** 2 + (z - rock.z) ** 2) / rock.radius ** 2;
      if (d2 < 1) top = Math.max(top, rock.base + rock.height * Math.sqrt(1 - d2));
    });
    return top;
  }
}
