import './hud.css';
import './photoViewer.css';
import { PHOTO_CAMERAS } from '../photos/picks.js';
import { loadPhotos, daysAgo } from '../photos/rawImages.js';

const REVEAL_MS = 2200; // la foto aparece de arriba abajo, como si bajara de Marte
const DWELL_MS = 7000; // tiempo que la tarjeta se queda quieta tras revelarse
// Teclas que el visor ampliado no deja pasar al rover ni al control de misión
const GAME_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyT', 'KeyV', 'Space'];

// Espera a que la imagen termine de bajar. No usa img.decode(): en las pruebas con
// Chrome a veces se quedaba sin resolver aunque la imagen ya estuviera cargada.
function loaded(img) {
  if (img.complete && img.naturalWidth) return Promise.resolve();
  return new Promise((resolve, reject) => {
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', () => reject(new Error(`no cargó ${img.src}`)), { once: true });
  });
}

// Visor de fotos reales: obturador y flash al disparar, tarjeta grande que se
// revela poco a poco y vista ampliada con flechas para recorrer la cámara.
export class PhotoViewer {
  constructor() {
    this.dwell = DWELL_MS; // npm run check lo alarga: en headless todo va a <1 FPS
    this.next = {}; // cámara → índice de la próxima foto (cada clic avanza una)
    this.card = null; // { key, photos, index } de la tarjeta a la vista
    this.zoom = null; // { key, photos, index } de la vista ampliada
    this._shot = 0; // descarta resultados de un disparo anterior
    this._hideTimer = 0;

    this.shutter = document.createElement('div');
    this.shutter.className = 'shutter';
    this.shutter.setAttribute('aria-hidden', 'true');
    this.shutter.innerHTML = '<i class="shutter__blade"></i><i class="shutter__blade"></i>';

    this.cardEl = document.createElement('figure');
    this.cardEl.className = 'photo-card';
    this.cardEl.hidden = true;
    this.cardEl.tabIndex = 0;
    this.cardEl.setAttribute('role', 'button');
    this.cardEl.innerHTML = `
      <figcaption class="photo-meta">
        <strong data-camera></strong><span data-when></span>
      </figcaption>
      <div class="photo-card__frame">
        <img alt="" decoding="async">
        <i class="photo-card__scan" aria-hidden="true"></i>
        <p class="photo-card__status" data-status></p>
      </div>
      <div class="photo-card__foot"><span>Clic para ampliar</span><span data-count></span></div>`;
    this.cardEl.addEventListener('click', () => this.#openZoom());
    this.cardEl.addEventListener('keydown', (e) => {
      if (e.code === 'Enter') this.#openZoom();
    });
    // Mientras el mouse está encima, la tarjeta no se va
    this.cardEl.addEventListener('pointerenter', () => clearTimeout(this._hideTimer));
    this.cardEl.addEventListener('pointerleave', () => {
      if (this.cardEl.dataset.state === 'shown') this.#scheduleHide(2500);
    });

    this.zoomEl = document.createElement('div');
    this.zoomEl.className = 'photo-zoom';
    this.zoomEl.hidden = true;
    this.zoomEl.setAttribute('role', 'dialog');
    this.zoomEl.setAttribute('aria-modal', 'true');
    this.zoomEl.setAttribute('aria-label', 'Foto de Perseverance');
    this.zoomEl.innerHTML = `
      <button type="button" class="photo-zoom__nav" data-step="-1" aria-label="Foto anterior">‹</button>
      <figure class="photo-zoom__figure">
        <img alt="">
        <figcaption class="photo-meta">
          <strong data-camera></strong><span data-when></span>
          <span class="photo-zoom__count" data-count></span>
          <small data-credit></small>
          <a data-link target="_blank" rel="noopener">Ver en NASA ↗</a>
        </figcaption>
      </figure>
      <button type="button" class="photo-zoom__nav" data-step="1" aria-label="Foto siguiente">›</button>
      <button type="button" class="photo-zoom__close" aria-label="Volver al juego">✕</button>
      <p class="photo-zoom__hint"><kbd>←</kbd><kbd>→</kbd> más fotos de esta cámara · <kbd>Esc</kbd> volver al juego</p>`;
    this.zoomEl.addEventListener('click', (e) => {
      const step = e.target.closest('[data-step]')?.dataset.step;
      if (step) this.#step(Number(step));
      else if (e.target === this.zoomEl || e.target.closest('.photo-zoom__close')) this.closeZoom();
    });

    // Fase de captura: el visor ampliado se queda con las teclas antes que el rover
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.zoom) return;
        if (e.code === 'Escape') this.closeZoom();
        else if (e.code === 'ArrowLeft') this.#step(-1);
        else if (e.code === 'ArrowRight') this.#step(1);
        else if (!GAME_KEYS.includes(e.code)) return;
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );

    document.body.append(this.shutter, this.cardEl, this.zoomEl);
  }

  // Dispara la cámara: obturador + flash y luego la siguiente foto de esa cámara
  async shoot(key) {
    const shot = ++this._shot;
    const camera = PHOTO_CAMERAS[key];
    clearTimeout(this._hideTimer);
    this.#restart(this.shutter, 'shutter--fire');

    this.card = null;
    this.#fill(this.cardEl, { camera: camera.label, when: 'Sol … ', count: '' });
    this.cardEl.querySelector('img').removeAttribute('src');
    this.cardEl.querySelector('.photo-card__frame').style.aspectRatio = '';
    this.cardEl.querySelector('[data-status]').textContent = 'Recibiendo desde Marte';
    this.cardEl.dataset.state = 'loading';
    this.cardEl.hidden = false;

    try {
      const photos = await loadPhotos(key);
      const index = (this.next[key] ?? 0) % photos.length;
      const photo = photos[index];
      const img = this.cardEl.querySelector('img');
      img.src = photo.medium;
      await loaded(img);
      if (shot !== this._shot) return;
      this.next[key] = index + 1;
      this.card = { key, photos, index };
      img.alt = `Foto cruda de ${photo.camera}, sol ${photo.sol}`;
      // El marco toma la forma de la foto (las hay 4:3, panorámicas y cuadradas)
      this.cardEl.querySelector('.photo-card__frame').style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
      this.#fill(this.cardEl, this.#meta(photos, index));
      this.#restart(this.cardEl, 'photo-card--reveal');
      this.cardEl.dataset.state = 'shown';
      this.#scheduleHide(REVEAL_MS + this.dwell);
    } catch (err) {
      if (shot !== this._shot) return;
      console.error(`No se pudo traer la foto de ${camera.label}:`, err);
      this.cardEl.querySelector('[data-status]').textContent = 'Sin señal de Marte. Intenta de nuevo.';
      this.cardEl.dataset.state = 'error';
      this.#scheduleHide(4000);
    }
  }

  closeZoom() {
    if (!this.zoom) return;
    this.zoom = null;
    this.zoomEl.hidden = true;
    document.activeElement?.blur(); // devuelve las teclas al rover
  }

  #openZoom() {
    if (!this.card) return;
    clearTimeout(this._hideTimer);
    this.zoom = { ...this.card };
    this.cardEl.hidden = true;
    this.zoomEl.hidden = false;
    this.#showZoom();
    this.zoomEl.querySelector('.photo-zoom__close').focus();
  }

  #step(delta) {
    const { photos } = this.zoom;
    this.zoom.index = (this.zoom.index + delta + photos.length) % photos.length;
    this.next[this.zoom.key] = this.zoom.index + 1;
    this.#showZoom();
  }

  #showZoom() {
    const { photos, index } = this.zoom;
    const photo = photos[index];
    const img = this.zoomEl.querySelector('img');
    // Primero la versión mediana (ya en caché) y luego la grande cuando llegue
    img.src = photo.medium;
    img.alt = `Foto cruda de ${photo.camera}, sol ${photo.sol}`;
    const large = new Image();
    large.onload = () => {
      if (this.zoom && photos[this.zoom.index] === photo) img.src = photo.large;
    };
    large.src = photo.large;
    this.#fill(this.zoomEl, this.#meta(photos, index));
    this.zoomEl.querySelector('[data-credit]').textContent = photo.credit;
    this.zoomEl.querySelector('[data-link]').href = photo.link;
    this.#restart(this.zoomEl.querySelector('.photo-zoom__figure'), 'photo-zoom__figure--in');
  }

  #meta(photos, index) {
    const photo = photos[index];
    return {
      camera: photo.camera,
      when: `Sol ${photo.sol} · ${daysAgo(photo.taken)}`,
      count: `${index + 1} / ${photos.length}`,
    };
  }

  #fill(root, { camera, when, count }) {
    root.querySelector('[data-camera]').textContent = camera;
    root.querySelector('[data-when]').textContent = when;
    root.querySelector('[data-count]').textContent = count;
  }

  #scheduleHide(ms) {
    clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => {
      // Se desvanece y luego deja de existir para los clics
      this.cardEl.dataset.state = 'leaving';
      this._hideTimer = setTimeout(() => {
        this.cardEl.hidden = true;
        this.card = null;
      }, 450);
    }, ms);
  }

  // Reinicia una animación CSS aunque la clase ya estuviera puesta
  #restart(el, className) {
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
  }
}
