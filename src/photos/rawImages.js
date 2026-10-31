import { PHOTO_CAMERAS } from './picks.js';

// Fotos crudas de Perseverance desde la API pública de la NASA (CORS abierto).
// Cada foto escogida se pide por su id; la respuesta trae sol, fecha y URLs.
const API = 'https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&id=';
const DAY_MS = 86400000;

const cache = new Map(); // cámara → Promise<foto[]>

async function fetchPhoto(id, camera) {
  const res = await fetch(API + encodeURIComponent(id));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const image = (await res.json()).image?.[0];
  if (!image) throw new Error(`sin datos para ${id}`);
  return {
    id: image.imageid,
    camera: camera.label,
    sol: image.sol,
    // La API da la hora UTC sin zona
    taken: new Date(`${image.date_taken_utc}Z`),
    medium: image.image_files.medium, // 800 px, para la tarjeta
    large: image.image_files.large, // 1200 px, para la vista ampliada
    link: image.link,
    credit: image.credit,
  };
}

// Fotos de una cámara en el orden escogido; las que fallen se omiten
export function loadPhotos(key) {
  if (!cache.has(key)) {
    const camera = PHOTO_CAMERAS[key];
    const promise = Promise.allSettled(camera.picks.map((id) => fetchPhoto(id, camera))).then((results) => {
      const photos = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      if (!photos.length) {
        cache.delete(key); // permite reintentar en el siguiente clic
        throw new Error(`No llegó ninguna foto de ${camera.label}`);
      }
      return photos;
    });
    cache.set(key, promise);
  }
  return cache.get(key);
}

// "hoy", "ayer" o "hace N días"
export function daysAgo(date, now = new Date()) {
  const days = Math.floor((now - date) / DAY_MS);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}
