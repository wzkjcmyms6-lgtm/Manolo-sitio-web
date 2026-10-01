// ---------- Running y Bici: resumen semanal (sin pantalla) ----------
// El panel de arriba de Running y Bicicleta: distancia y tiempo por semana
// (lunes a domingo) de las últimas 12 semanas, con un gráfico de línea donde
// se elige la semana. Suma todo lo registrado: a mano, rutinas guiadas y las
// carreras viejas con GPS. Devuelve números y SVG como texto:
// tests/actividad-analisis.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./ej-sesiones.js"));
  else root.ActividadAnalisis = factory(root.EjSesiones);
})(typeof self !== "undefined" ? self : this, function (ES) {
"use strict";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const MESES_EJE = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const dia = iso => new Date(iso + "T12:00:00");
const isoDe = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const masDias = (iso, n) => { const d = dia(iso); d.setDate(d.getDate() + n); return isoDe(d); };
const coma = (n, d) => n.toFixed(d).replace(".", ",");

// ---- Semanas ----
// actividades: docs de running/ o bicicleta/ ({ date, distance km, duration min }).
// → [{ desde, km, min, n }] del más viejo al más nuevo (n semanas; la última es la de hoy).
function porSemana(actividades, hoy, n) {
  const fin = ES.lunesDe(hoy);
  const semanas = [];
  for (let i = n - 1; i >= 0; i--) semanas.push({ desde: masDias(fin, -7 * i), km: 0, min: 0, n: 0 });
  const idx = new Map(semanas.map((s, i) => [s.desde, i]));
  (actividades || []).forEach(a => {
    if (!a || !a.date || a.date > hoy) return;
    const i = idx.get(ES.lunesDe(a.date));
    if (i == null) return;
    const s = semanas[i];
    s.km += Number(a.distance) || 0;
    s.min += Number(a.duration) || 0;
    s.n++;
  });
  return semanas;
}

// ---- Textos ----
// "14 sept - 20 sept 2026" (con el año en los dos lados si cambia).
function rangoSemana(desde) {
  const a = dia(desde), b = dia(masDias(desde, 6));
  const ab = d => `${d.getDate()} ${MESES[d.getMonth()]}`;
  return a.getFullYear() === b.getFullYear()
    ? `${ab(a)} - ${ab(b)} ${b.getFullYear()}`
    : `${ab(a)} ${a.getFullYear()} - ${ab(b)} ${b.getFullYear()}`;
}
// Minutos → "5h 3min", "45min", "2h".
function textoTiempo(min) {
  const m = Math.round(Number(min) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return `${r}min`;
  return r ? `${h}h ${r}min` : `${h}h`;
}
// Kilómetros → "13,58 km" ("0 km" si no hubo).
const textoKm = km => (km > 0 ? `${coma(km, 2)} km` : "0 km");

// ---- Escala del gráfico: 0, paso y tope (dos tramos, números redondos,
// con un poco de aire sobre la semana más alta) ----
const PASOS_KM = [0.5, 1, 2, 4, 5, 8, 10, 15, 20, 25, 40, 50, 75, 100, 150, 200, 250, 400, 500];
const PASOS_MIN = [15, 30, 60, 90, 120, 180, 240, 300, 360, 480, 600, 900, 1200, 1800, 2400];
function escala(max, metrica) {
  const pasos = metrica === "min" ? PASOS_MIN : PASOS_KM;
  const minimo = metrica === "min" ? 30 : 1;
  const mitad = Math.max((max * 1.05) / 2, minimo);
  const paso = pasos.find(p => p >= mitad - 1e-9) || Math.ceil(mitad);
  return { paso, tope: paso * 2 };
}
const etiquetaEje = (v, metrica) => (metrica === "min" ? textoTiempo(v) : `${Math.round(v * 10) / 10} km`.replace(".", ","));

// Meses del eje de abajo: en la semana que contiene el día 1 de cada mes.
function mesesEje(semanas) {
  const out = [];
  semanas.forEach((s, i) => {
    for (let k = 0; k < 7; k++) {
      const d = dia(masDias(s.desde, k));
      if (d.getDate() === 1) { out.push({ i, texto: MESES_EJE[d.getMonth()] }); break; }
    }
  });
  return out;
}

// ---- Gráfico de línea por semana (SVG como texto) ----
// opciones: { metrica: "km" | "min", sel (índice elegido), id (único para el degradado), ancho, alto }
function svgSemanas(semanas, opciones) {
  const o = Object.assign({ metrica: "km", sel: semanas.length - 1, id: "dash", ancho: 340, alto: 180 }, opciones || {});
  const valor = s => (o.metrica === "min" ? s.min : s.km);
  const { paso, tope } = escala(Math.max(0, ...semanas.map(valor)), o.metrica);
  const ml = 10, mr = 52, mt = 14, mb = 28;
  const n = semanas.length;
  const ancho = o.ancho - ml - mr, alto = o.alto - mt - mb;
  const px = i => ml + (n > 1 ? (i / (n - 1)) * ancho : ancho / 2);
  const py = v => mt + (1 - Math.min(v, tope) / tope) * alto;
  const pts = semanas.map((s, i) => [px(i), py(valor(s))]);
  const f = x => x.toFixed(1);
  const linea = pts.map((p, i) => `${i ? "L" : "M"}${f(p[0])},${f(p[1])}`).join("");
  const area = `${linea}L${f(pts[n - 1][0])},${f(py(0))}L${f(pts[0][0])},${f(py(0))}Z`;
  const grilla = [0, paso, tope].map(v => `
    <line class="dash-grilla" x1="${ml}" y1="${f(py(v))}" x2="${ml + ancho}" y2="${f(py(v))}"/>
    <text class="dash-eje" x="${o.ancho - 4}" y="${f(py(v) + 4)}" text-anchor="end">${etiquetaEje(v, o.metrica)}</text>`).join("");
  const meses = mesesEje(semanas).map(m => `<text class="dash-eje" x="${f(px(m.i))}" y="${o.alto - 6}" text-anchor="middle">${m.texto}</text>`).join("");
  const sel = Math.max(0, Math.min(n - 1, o.sel));
  const [sx, sy] = pts[sel];
  const puntos = pts.map((p, i) => (i === sel ? "" : `<circle class="dash-punto" cx="${f(p[0])}" cy="${f(p[1])}" r="4.5"/>`)).join("");
  const paso2 = n > 1 ? ancho / (n - 1) : ancho;
  const toques = semanas.map((s, i) => `<rect class="dash-toque" data-dash-semana="${i}" x="${f(px(i) - paso2 / 2)}" y="0" width="${f(paso2)}" height="${o.alto}"><title>${rangoSemana(s.desde)}: ${textoKm(s.km)}, ${textoTiempo(s.min)}</title></rect>`).join("");
  return `<svg class="dash-svg" viewBox="0 0 ${o.ancho} ${o.alto}" role="img" aria-label="Últimas ${n} semanas">
    <defs><linearGradient id="${o.id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="dash-g0"/><stop offset="1" class="dash-g1"/></linearGradient></defs>
    ${grilla}
    <path class="dash-area" d="${area}" fill="url(#${o.id}-g)"/>
    <line class="dash-sel-linea" x1="${f(sx)}" y1="${mt - 6}" x2="${f(sx)}" y2="${f(py(0))}"/>
    <path class="dash-linea" d="${linea}"/>
    ${puntos}
    <circle class="dash-halo" cx="${f(sx)}" cy="${f(sy)}" r="11"/>
    <circle class="dash-sel" cx="${f(sx)}" cy="${f(sy)}" r="5.5"/>
    ${meses}
    ${toques}
  </svg>`;
}

return { porSemana, rangoSemana, textoTiempo, textoKm, escala, etiquetaEje, mesesEje, svgSemanas };
});
