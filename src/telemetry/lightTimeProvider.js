// Proveedor en vivo: cuánto tarda una señal de radio (a la velocidad de la luz)
// en ir de la Tierra a Marte, calculado con las órbitas de los dos planetas.
import { lightTimeSeconds } from './orbits.js';
import { solAt, timeAtSol } from './telemetry.js';

const now = () => ({ sol: solAt(Date.now()), value: lightTimeSeconds(Date.now()) / 60 });

export function createLightTimeProvider() {
  return {
    name: 'Cálculo orbital en vivo',
    source: 'órbitas JPL de la Tierra y Marte',
    points: [{ key: 'lightTime', name: 'Tiempo de luz Tierra-Marte', unit: 'min', decimals: 2 }],
    // Un valor por sol desde el aterrizaje hasta ahora
    async request() {
      const history = [];
      const last = solAt(Date.now());
      for (let sol = 0; sol < last; sol++) {
        history.push({ sol, value: lightTimeSeconds(timeAtSol(sol)) / 60 });
      }
      history.push(now());
      return history;
    },
    subscribe(key, callback) {
      callback(now());
      const id = setInterval(() => callback(now()), 1000);
      return () => clearInterval(id);
    },
  };
}
