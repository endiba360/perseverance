// Posiciones de la Tierra y Marte alrededor del Sol con los elementos
// keplerianos aproximados de JPL (Standish, válidos 1800-2050; error de
// minutos de arco, de sobra para el tiempo de luz).
// https://ssd.jpl.nasa.gov/planets/approx_pos.html

const AU_KM = 149597870.7;
const LIGHT_KM_S = 299792.458;
const DEG = Math.PI / 180;

// [valor J2000, cambio por siglo] de a (UA), e, I, L, ϖ, Ω (grados)
const ELEMENTS = {
  earth: {
    a: [1.00000261, 0.00000562],
    e: [0.01671123, -0.00004392],
    I: [-0.00001531, -0.01294668],
    L: [100.46457166, 35999.37244981],
    peri: [102.93768193, 0.32327364],
    node: [0, 0],
  },
  mars: {
    a: [1.52371034, 0.00001847],
    e: [0.0933941, 0.00007882],
    I: [1.84969142, -0.00813131],
    L: [-4.55343205, 19140.30268499],
    peri: [-23.94362959, 0.44441088],
    node: [49.55953891, -0.29257343],
  },
};

// Posición heliocéntrica eclíptica (UA) de un planeta en una fecha (ms UTC)
function heliocentric(planet, timeMs) {
  const T = (timeMs / 86400000 + 2440587.5 - 2451545) / 36525; // siglos desde J2000
  const el = Object.fromEntries(Object.entries(ELEMENTS[planet]).map(([k, [v, rate]]) => [k, v + rate * T]));
  const omega = (el.peri - el.node) * DEG;
  const node = el.node * DEG;
  const inc = el.I * DEG;
  const M = ((((el.L - el.peri) % 360) + 540) % 360 - 180) * DEG;

  // Ecuación de Kepler por Newton: E − e·sin E = M
  let E = M + el.e * Math.sin(M);
  for (let i = 0; i < 6; i++) E -= (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E));

  const xp = el.a * (Math.cos(E) - el.e);
  const yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  const [cw, sw, cn, sn, ci, si] = [Math.cos(omega), Math.sin(omega), Math.cos(node), Math.sin(node), Math.cos(inc), Math.sin(inc)];
  return {
    x: (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp,
    y: (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp,
    z: sw * si * xp + cw * si * yp,
  };
}

// Distancia Tierra-Marte en UA
export function earthMarsDistanceAU(timeMs) {
  const a = heliocentric('earth', timeMs);
  const b = heliocentric('mars', timeMs);
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

// Segundos que tarda la luz (o una orden de radio) de la Tierra a Marte
export function lightTimeSeconds(timeMs) {
  return (earthMarsDistanceAU(timeMs) * AU_KM) / LIGHT_KM_S;
}
