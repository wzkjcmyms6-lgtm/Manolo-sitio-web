// ---------- Medir tiempos: se llena solo (fase 6, D-113) ----------
// Lo que haces en Manolo llena tus tiempos: Running (la duración de tus
// carreras del día), Ejercicio (tus entrenos), Libros (los minutos de
// "Leer ahora") y Movilidad (tus rutinas). Mismas reglas que "se marca
// solo" de Hábitos (D-085):
// - Lo automático se guarda con auto: { id: { f: fuente, s: segundos } } en
//   el día. Si el tiempo no tiene auto, lo anotaste tú y manda.
// - Si lo quitas, queda noAuto: { id: true } y ese día no vuelve solo.
// - Si la actividad de origen desaparece, el tiempo automático se quita
//   (solo con datos del servidor, no de la copia del teléfono).
// - Solo desde el día en que la actividad empezó a llenarse sola (desde):
//   tus días de antes no cambian.
// Sin DOM: tests/tiempos-auto.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TiemposAuto = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const fechaOk = f => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const MAX_DIA = 12 * 3600;    // un día no suma más de 12 horas de una actividad

// Datos de cada sección → { fecha: segundos }.
function porDia(fuente, datos) {
  const out = {};
  const sumar = (f, seg) => { if (fechaOk(f) && seg > 0) out[f] = Math.min(MAX_DIA, Math.round((out[f] || 0) + seg)); };
  if (fuente === "running") (datos || []).forEach(a => sumar(a && a.date, num(a && a.duration) * 60));          // minutos
  else if (fuente === "gimnasio") (datos || []).forEach(w => sumar(w && w.fecha, num(w && w.min) * 60));
  else if (fuente === "movilidad") (datos || []).forEach(s => sumar(s && s.fecha, num(s && s.duracionSeg)));
  else if (fuente === "libros") {
    Object.keys(datos || {}).forEach(f => { const d = datos[f]; sumar(f, d && typeof d === "object" ? num(d.min) * 60 : 0); });
  }
  return out;
}

const esAuto = (doc, id) => !!(doc && doc.auto && doc.auto[id] && typeof doc.auto[id] === "object");
const tiene = (doc, id) => !!(doc && doc.seg && num(doc.seg[id]) > 0);

// Qué escribir para una actividad. act: { id, fuente, desde }; agg: porDia
// de su fuente; docs: días tal como están en Firestore ({ fecha: { seg, auto, noAuto } });
// o: { hoy, servidor }. → { poner: { fecha: seg }, quitar: [fechas] }.
function plan(act, agg, docs, o) {
  const op = Object.assign({ servidor: true }, o);
  const poner = {}, quitar = [];
  if (!act || !act.fuente || !fechaOk(act.desde)) return { poner, quitar };
  const id = act.id, ds = docs || {};
  const fechas = new Set(Object.keys(agg || {}));
  Object.keys(ds).forEach(f => { if (esAuto(ds[f], id)) fechas.add(f); });
  Array.from(fechas).filter(f => fechaOk(f) && f >= act.desde && f <= op.hoy).sort().forEach(f => {
    const d = ds[f] || null;
    if (tiene(d, id) && !esAuto(d, id)) return;               // lo tuyo manda
    if (d && d.noAuto && d.noAuto[id]) return;                // lo quitaste: no vuelve
    const v = (agg && agg[f]) || 0;
    if (v > 0) {
      if (esAuto(d, id) && num(d.seg && d.seg[id]) === v && d.auto[id].f === act.fuente) return;
      poner[f] = v;
    } else if (esAuto(d, id) && op.servidor) quitar.push(f);
  });
  return { poner, quitar };
}

// Lo que ves junto al tiempo: "⚡ de Running".
const NOMBRE = { running: "Running", gimnasio: "Ejercicio", libros: "Libros", movilidad: "Movilidad" };
const deDonde = (doc, id) => (esAuto(doc, id) ? NOMBRE[doc.auto[id].f] || "otra sección" : null);

return { porDia, plan, esAuto, deDonde, NOMBRE };
});
