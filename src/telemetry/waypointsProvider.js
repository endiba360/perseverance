// Proveedor de historial: los puntos de parada de Perseverance que publica la
// NASA (mapa MMGIS de la misión M20). Cada parada trae el sol, la distancia
// total recorrida, la altura del terreno y la inclinación del rover.
// El servidor permite CORS, así que se lee en vivo sin copiarlo al repo.

const URL = 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json';

// Campo del JSON y conversión a la unidad que muestra el panel
const FIELDS = {
  distance: (p) => p.dist_total_m / 1000,
  elevation: (p) => p.elev_geoid,
  tilt: (p) => p.tilt,
};

export function createWaypointsProvider() {
  let stops = null;

  // Una sola descarga para los tres datos. Solo se usan las localizaciones
  // finales (final = 'y'): las intermedias traen a veces la distancia en 0.
  const load = () => {
    stops ??= fetch(URL)
      .then((res) => {
        if (!res.ok) throw new Error(`NASA respondió ${res.status} al pedir los waypoints`);
        return res.json();
      })
      .then((json) =>
        json.features
          .map((f) => f.properties)
          .filter((p) => p.final === 'y')
          .sort((a, b) => a.sol - b.sol),
      )
      .catch((err) => {
        stops = null; // permite reintentar
        throw err;
      });
    return stops;
  };

  return {
    name: 'NASA · historial de manejos',
    source: 'M20_waypoints.json',
    points: [
      { key: 'distance', name: 'Distancia recorrida', unit: 'km', decimals: 2 },
      { key: 'elevation', name: 'Altura del terreno', unit: 'm', decimals: 0 },
      { key: 'tilt', name: 'Inclinación', unit: '°', decimals: 1 },
    ],
    async request(key) {
      const read = FIELDS[key];
      return (await load()).map((p) => ({ sol: p.sol, value: read(p) }));
    },
  };
}
