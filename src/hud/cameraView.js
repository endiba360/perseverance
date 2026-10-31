import { solAt } from '../telemetry/telemetry.js';
import './hud.css';
import './cameraView.css';

const DEG = 180 / Math.PI;
const fmt = (deg) => `${deg < 0 ? '−' : ''}${Math.abs(deg).toFixed(0)}°`;

// Marco de cámara de ingeniería sobre las vistas del rover: esquinas de encuadre,
// retícula, instrumento, datos de apuntado y del rover. En la vista orbital solo
// queda un botón que recuerda la tecla V.
export class CameraView {
  // views: el RoverCameras; driver: el RoverController (rumbo e inclinación)
  constructor(views, driver) {
    this.views = views;
    this.driver = driver;
    this._text = '';

    this.root = document.createElement('div');
    this.root.className = 'cam-view';
    this.root.hidden = true;
    this.root.innerHTML = `
      <i class="cam-view__corner"></i><i class="cam-view__corner"></i>
      <i class="cam-view__corner"></i><i class="cam-view__corner"></i>
      <i class="cam-view__reticle" aria-hidden="true"></i>
      <header class="cam-view__head">
        <strong data-label></strong><span data-role></span>
      </header>
      <p class="cam-view__readout" data-readout></p>
      <p class="cam-view__hint" data-hint></p>`;

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'cam-view__switch';
    this.button.addEventListener('click', () => {
      views.next(1);
      this.button.blur(); // las teclas vuelven a conducir
    });

    views.onChange((view) => this.#show(view));
    this.#show(views.active);
    // El marco va al principio del body: los paneles del HUD quedan encima de sus esquinas
    document.body.prepend(this.root);
    document.body.append(this.button);
  }

  #show(view) {
    this.root.hidden = !view;
    this.button.innerHTML = view
      ? '<kbd>V</kbd> Siguiente cámara'
      : '<kbd>V</kbd> Cámaras del rover';
    this.button.setAttribute('aria-label', view ? `Vista ${view.label}: pasar a la siguiente cámara` : 'Ver desde las cámaras del rover');
    if (!view) return;
    this.root.dataset.camera = view.key;
    this.root.querySelector('[data-label]').textContent = view.label;
    this.root.querySelector('[data-role]').textContent = view.role;
    const hint = ['<kbd>V</kbd> cambiar cámara'];
    if (view.look) hint.push('arrastra para mirar');
    if (view.zoom) hint.push('rueda para zoom');
    this.root.querySelector('[data-hint]').innerHTML = hint.join(' · ');
    this._text = '';
    this.update();
  }

  // Datos de apuntado y del rover; llamar cada frame (solo escribe si cambian)
  update() {
    const view = this.views.active;
    if (!view) return;
    const { heading, rover } = this.driver;
    const q = rover.quaternion;
    const upY = 1 - 2 * (q.x * q.x + q.z * q.z); // componente vertical del "arriba" del rover
    const parts = [];
    const mm = this.views.focalLength(view);
    parts.push(mm ? `${mm.toFixed(0)} mm · ${view.fov.toFixed(1)}°` : `campo ${view.fov.toFixed(0)}°`);
    if (view.look) parts.push(`pan ${fmt(view.pan * DEG)} · tilt ${fmt(view.tilt * DEG)}`);
    parts.push(`rumbo ${(((heading * DEG) % 360) + 360) % 360 | 0}°`);
    parts.push(`incl. ${(Math.acos(Math.min(1, upY)) * DEG).toFixed(1)}°`);
    parts.push(`sol ${Math.floor(solAt(Date.now()))}`);
    const text = parts.join('  ·  ');
    if (text === this._text) return;
    this._text = text;
    this.root.querySelector('[data-readout]').textContent = text;
  }
}
