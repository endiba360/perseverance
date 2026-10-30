// Mini TelemetryAPI con el patrón de Open MCT: cada dato (punto de telemetría)
// declara su nombre, unidad y proveedor; los proveedores sirven el historial
// con request() y los valores en vivo con subscribe(). La interfaz solo habla
// con esta API, nunca con las fuentes directamente.
//
// Un dato es { sol, value }: sol es el eje X (domain en Open MCT) y value el
// eje Y (range).
//
// Forma de un proveedor:
//   { name, source, points: [metadatos...],
//     request(key) → Promise<dato[]>,          historial de toda la misión
//     subscribe?(key, callback) → unsubscribe } valores en vivo (opcional)

// Duración de un sol (día marciano) y sol 0 de la misión: aterrizaje en Jezero
export const SOL_MS = 88775244;
export const LANDING_MS = Date.UTC(2021, 1, 18, 20, 55);
export const solAt = (timeMs) => (timeMs - LANDING_MS) / SOL_MS;
export const timeAtSol = (sol) => LANDING_MS + sol * SOL_MS;

export class TelemetryAPI {
  constructor() {
    this.providers = [];
    this.metadata = new Map(); // key → { key, name, unit, decimals, provider, source }
  }

  addProvider(provider) {
    this.providers.push(provider);
    for (const point of provider.points) {
      this.metadata.set(point.key, { ...point, provider: provider.name, source: provider.source });
    }
  }

  // Metadatos de todos los datos, en el orden en que se registraron
  points() {
    return [...this.metadata.values()];
  }

  getMetadata(key) {
    return this.metadata.get(key);
  }

  #providerFor(key) {
    const provider = this.providers.find((p) => p.points.some((point) => point.key === key));
    if (!provider) throw new Error(`Ningún proveedor sirve el dato «${key}»`);
    return provider;
  }

  request(key) {
    return this.#providerFor(key).request(key);
  }

  // Devuelve la función para desuscribirse; si el proveedor no da datos en
  // vivo (solo historial), no hace nada
  subscribe(key, callback) {
    const provider = this.#providerFor(key);
    return provider.subscribe ? provider.subscribe(key, callback) : () => {};
  }
}
