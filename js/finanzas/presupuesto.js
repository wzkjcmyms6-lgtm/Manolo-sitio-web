// Presupuesto por periodo (Fase 3). Sin pantalla ni Firebase: todo en
// centavos y fácil de probar.
//
// Cómo se guarda (documento meta/presupuestos_periodos):
//   { v: 1,
//     periodos: { "2026-09": { comida: 150000, ... } },  // por mes de inicio
//     arrastre: { comida: "2026-08" } }                    // desde qué periodo
//
// - Cada periodo usa el presupuesto propio más cercano hacia atrás. Si no
//   hay ninguno, usa el presupuesto de siempre (meta/presupuestos, en Bs),
//   que no se vuelve a escribir: así los meses pasados conservan el suyo.
// - Cambiar un mes pasado no cambia los siguientes: el mes siguiente queda
//   fijado con lo que tenía antes.
// - Arrastre: lo que sobra (o falta) de una categoría pasa al periodo
//   siguiente, desde el periodo en que lo activaste.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FinanzasPresupuesto = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const AVISO = 0.8;
const CLAVE_RE = /^\d{4}-\d{2}$/;

function aCent(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(Number(n.toFixed(6)) * 100) : 0;
}
function clave(inicioIso) {
  return String(inicioIso).slice(0, 7);
}
function claveMas(k, pasos) {
  const [y, m] = k.split("-").map(Number);
  const d = new Date(y, m - 1 + pasos, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function limpio(doc) {
  const d = doc && typeof doc === "object" ? doc : {};
  return {
    v: 1,
    periodos: d.periodos && typeof d.periodos === "object" ? d.periodos : {},
    arrastre: d.arrastre && typeof d.arrastre === "object" ? d.arrastre : {}
  };
}
function baseEnCent(base) {
  const out = {};
  Object.keys(base || {}).forEach(k => { out[k] = aCent(base[k]); });
  return out;
}

// Presupuesto de un periodo: { cats: {id: cent}, origen: "AAAA-MM" | null }.
function delPeriodo(doc, base, k) {
  const d = limpio(doc);
  const previas = Object.keys(d.periodos).filter(x => CLAVE_RE.test(x) && x <= k).sort();
  const origen = previas.length ? previas[previas.length - 1] : null;
  const cats = origen ? Object.assign({}, d.periodos[origen]) : baseEnCent(base);
  Object.keys(cats).forEach(id => { cats[id] = Number.isInteger(cats[id]) ? cats[id] : aCent(cats[id]); });
  return { cats, origen };
}

// Guarda el presupuesto de un periodo y devuelve el documento nuevo.
// `actual` es la clave del periodo de hoy.
function guardar(doc, base, k, cats, actual) {
  const d = limpio(doc);
  const periodos = Object.assign({}, d.periodos);
  const sig = claveMas(k, 1);
  if (k < actual && !periodos[sig]) periodos[sig] = delPeriodo(d, base, sig).cats;
  const limpios = {};
  Object.keys(cats || {}).forEach(id => { limpios[id] = Math.max(0, Number.isInteger(cats[id]) ? cats[id] : aCent(cats[id])); });
  periodos[k] = limpios;
  return { v: 1, periodos, arrastre: Object.assign({}, d.arrastre) };
}

// Arrastre de una categoría hasta el periodo k (sin incluirlo): la suma de
// lo presupuestado menos lo gastado en cada periodo desde que se activó.
// `gastadoEn(clave)` da lo gastado en centavos.
function arrastreHasta(doc, base, id, k, gastadoEn, maxPeriodos) {
  const d = limpio(doc);
  const desde = d.arrastre[id];
  if (!desde || !CLAVE_RE.test(desde) || desde >= k) return 0;
  let total = 0;
  let n = 0;
  for (let c = desde; c < k && n < (maxPeriodos || 36); c = claveMas(c, 1), n++) {
    total += (delPeriodo(d, base, c).cats[id] || 0) - (gastadoEn(c) || 0);
  }
  return total;
}

// Sugerencia: el promedio de los últimos periodos con gasto, redondeado
// hacia arriba a Bs 10.
function sugerencia(gastosCent) {
  const con = (gastosCent || []).filter(v => v > 0);
  if (!con.length) return 0;
  const prom = con.reduce((s, v) => s + v, 0) / con.length;
  return Math.ceil(prom / 1000) * 1000;
}

// Estado de una categoría de gasto.
// transcurrido: parte del periodo que ya pasó (0 a 1). diasRestantes cuenta hoy.
function estado(presupuesto, gastado, transcurrido, diasRestantes) {
  if (!(presupuesto > 0)) return { estado: gastado > 0 ? "sin" : "vacio", pct: 0, ritmo: 0, porDia: 0, queda: -gastado };
  const pct = gastado / presupuesto;
  const ritmo = Math.round(presupuesto * Math.min(Math.max(transcurrido, 0), 1));
  const queda = presupuesto - gastado;
  const porDia = diasRestantes > 0 && queda > 0 ? Math.floor(queda / diasRestantes) : 0;
  let e = "bien";
  if (gastado > presupuesto) e = "pasado";
  else if (pct >= AVISO) e = "alerta";
  else if (transcurrido < 1 && pct >= 0.3 && pct - transcurrido >= 0.2) e = "rapido";
  return { estado: e, pct, ritmo, porDia, queda };
}

// ¿Este gasto cruzó el 80 % o el 100 %? Devuelve 100, 80 o null.
function cruce(presupuesto, antes, despues) {
  if (!(presupuesto > 0) || despues <= antes) return null;
  if (antes <= presupuesto && despues > presupuesto) return 100;
  if (antes < presupuesto * AVISO && despues >= presupuesto * AVISO) return 80;
  return null;
}

return { AVISO, clave, claveMas, delPeriodo, guardar, arrastreHasta, sugerencia, estado, cruce };
});
