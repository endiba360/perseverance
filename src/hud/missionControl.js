// Panel de control de misión: una tarjeta por dato de telemetría con su valor,
// la gráfica de toda la misión y una frase de qué significa. Solo habla con la
// TelemetryAPI (como las vistas de Open MCT). La tecla T lo muestra u oculta.
import './missionControl.css';

// Frase simple para cada dato, a partir del historial y del último valor
const MARATHON_KM = 42.195;
const EXPLAIN = {
  distance: (h, v) =>
    `Todo lo que Percy ha manejado desde que aterrizó: ${(v / MARATHON_KM).toFixed(1)} maratones, a paso de caracol.`,
  elevation: (h, v) => {
    const climb = Math.round(v - h[0].value);
    const verb = climb >= 0 ? 'subido' : 'bajado';
    return `Marte no tiene mar: se mide contra un nivel de referencia. Desde el fondo del cráter ha ${verb} ${Math.abs(climb)} m.`;
  },
  tilt: (h) => {
    const max = Math.max(...h.map((d) => d.value));
    return `Cuánto quedó ladeado al terminar su último manejo. Lo más que se ha inclinado: ${max.toFixed(1)}°.`;
  },
  lightTime: () =>
    'Lo que tarda en llegar una orden enviada ahora desde la Tierra. Aquí lo manejas al instante; en Marte, Percy maneja solo.',
};

const formatValue = (meta, value) =>
  meta.key === 'lightTime'
    ? `${Math.floor(value)}<small>min</small> ${((value % 1) * 60).toFixed(1).padStart(4, '0')}<small>s</small>`
    : `${value.toLocaleString('es', { minimumFractionDigits: meta.decimals, maximumFractionDigits: meta.decimals })}<small>${meta.unit}</small>`;

export class MissionControl {
  constructor(telemetry) {
    this.telemetry = telemetry;
    this.readings = new Map(); // key → { sol, value, points } (lo lee npm run check)
    this.cards = new Map();

    this.root = document.createElement('aside');
    this.root.className = 'mission';
    this.root.setAttribute('aria-label', 'Control de misión');
    this.root.innerHTML = `
      <header class="mission__head">
        <span class="mission__title">Control de misión</span>
        <span class="mission__sol" data-sol>Sol —</span>
        <kbd title="Mostrar u ocultar">T</kbd>
      </header>
      <div class="mission__cards"></div>`;
    this.hint = document.createElement('div');
    this.hint.className = 'mission-hint';
    this.hint.innerHTML = '<kbd>T</kbd> control de misión';
    document.body.append(this.root, this.hint);

    const list = this.root.querySelector('.mission__cards');
    for (const meta of telemetry.points()) {
      const card = this.#createCard(meta);
      list.append(card.el);
      this.cards.set(meta.key, card);
      this.#load(meta, card);
    }

    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyT' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      this.toggle();
    });
    window.addEventListener('resize', () => this.cards.forEach((card) => this.#draw(card)));
    this.toggle(true);
  }

  get visible() {
    return !this.root.hasAttribute('data-hidden');
  }

  toggle(show = !this.visible) {
    this.root.toggleAttribute('data-hidden', !show);
    this.root.setAttribute('aria-hidden', String(!show));
    this.hint.toggleAttribute('data-shown', !show);
  }

  #createCard(meta) {
    const el = document.createElement('section');
    el.className = 'mission__card';
    el.dataset.state = 'loading';
    el.innerHTML = `
      <div class="mission__row">
        <h3>${meta.name}</h3>
        <span class="mission__when" data-when></span>
      </div>
      <div class="mission__value" data-value>···</div>
      <canvas class="mission__chart" aria-hidden="true"></canvas>
      <p class="mission__explain" data-explain>Esperando señal…</p>
      <p class="mission__source">${meta.provider} · ${meta.source}</p>`;
    const q = (s) => el.querySelector(s);
    return { meta, el, value: q('[data-value]'), when: q('[data-when]'), explain: q('[data-explain]'), canvas: q('canvas'), history: [] };
  }

  async #load(meta, card) {
    try {
      card.history = await this.telemetry.request(meta.key);
      if (!card.history.length) throw new Error('el proveedor no devolvió datos');
      this.#show(card, card.history.at(-1));
      // Los datos en vivo reemplazan el último punto si es del mismo sol
      this.telemetry.subscribe(meta.key, (datum) => {
        const last = card.history.at(-1);
        if (Math.floor(last.sol) === Math.floor(datum.sol)) card.history[card.history.length - 1] = datum;
        else card.history.push(datum);
        this.#show(card, datum);
      });
    } catch (err) {
      card.el.dataset.state = 'error';
      card.value.textContent = 'Sin señal';
      card.explain.textContent = `No llegaron los datos: ${err.message}`;
      console.error(`Control de misión: no se pudo cargar «${meta.name}»`, err);
    }
  }

  #show(card, datum) {
    const { meta } = card;
    card.el.dataset.state = 'ok';
    card.value.innerHTML = formatValue(meta, datum.value);
    card.when.textContent = meta.key === 'lightTime' ? 'en vivo' : `sol ${Math.floor(datum.sol)}`;
    card.explain.textContent = EXPLAIN[meta.key](card.history, datum.value);
    this.readings.set(meta.key, { sol: datum.sol, value: datum.value, points: card.history.length });
    if (meta.key === 'lightTime') this.root.querySelector('[data-sol]').textContent = `Sol ${Math.floor(datum.sol)}`;
    this.#draw(card);
  }

  // Gráfica de toda la misión: eje X en soles, eje Y con el mínimo y el máximo
  #draw(card) {
    const { canvas, history } = card;
    if (!history.length || !canvas.clientWidth) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const css = getComputedStyle(this.root);
    const accent = css.getPropertyValue('--mc-accent').trim();
    const grid = css.getPropertyValue('--mc-grid').trim();
    const muted = css.getPropertyValue('--mc-muted').trim();

    const values = history.map((d) => d.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max - min < 1e-9) max = min + 1;
    const lastSol = history.at(-1).sol;
    const pad = { top: 14, bottom: 14, left: 0, right: 6 };
    const x = (sol) => pad.left + (sol / lastSol) * (w - pad.left - pad.right);
    const y = (v) => pad.top + (1 - (v - min) / (max - min)) * (h - pad.top - pad.bottom);

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const v of [min, max]) {
      ctx.moveTo(0, Math.round(y(v)) + 0.5);
      ctx.lineTo(w, Math.round(y(v)) + 0.5);
    }
    ctx.stroke();

    ctx.beginPath();
    history.forEach((d, i) => (i ? ctx.lineTo(x(d.sol), y(d.value)) : ctx.moveTo(x(d.sol), y(d.value))));
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.lineTo(x(lastSol), h - pad.bottom);
    ctx.lineTo(x(history[0].sol), h - pad.bottom);
    ctx.closePath();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.globalAlpha = 1;

    const last = history.at(-1);
    ctx.beginPath();
    ctx.arc(x(last.sol), y(last.value), 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = muted;
    ctx.font = '10px "Cascadia Mono", Consolas, monospace';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.fillText('sol 0', 0, h);
    ctx.textAlign = 'right';
    ctx.fillText(`sol ${Math.floor(lastSol)}`, w, h);
    ctx.textBaseline = 'top';
    const decimals = Math.min(card.meta.decimals, 1);
    ctx.fillText(`máx. ${max.toLocaleString('es', { maximumFractionDigits: decimals })} ${card.meta.unit}`, w, 0);
  }
}
