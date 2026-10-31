import './hud.css';
import './shakeToggle.css';

// Switch del HUD para activar o desactivar el temblor de cámara. Viene activado;
// así quien se marea o prefiere una cámara quieta puede apagarlo.
export class ShakeToggle {
  // shake: el CameraShake que controla (usa su propiedad enabled)
  constructor(shake) {
    this.shake = shake;
    this.root = document.createElement('label');
    this.root.className = 'hud-switch';
    this.root.innerHTML = `
      <input type="checkbox" role="switch" checked>
      <span class="hud-switch__track" aria-hidden="true"></span>
      <span class="hud-switch__label">Temblor de cámara</span>`;
    this.input = this.root.querySelector('input');
    this.input.checked = shake.enabled;
    this.input.addEventListener('change', () => {
      this.shake.enabled = this.input.checked;
      // Quita el foco para que la barra espaciadora o las flechas no lo cambien al conducir
      this.input.blur();
    });
    document.body.append(this.root);
  }
}
