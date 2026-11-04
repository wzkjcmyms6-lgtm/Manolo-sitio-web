// ---------- Running: análisis entre actividades (sin pantalla) ----------
// Logros de una actividad (mejores marcas que fueron las 3 mejores hasta ese
// día), y más adelante progreso, predicciones, forma y fatiga (fase 4).
// Pruebas: tests/run-analisis.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./run-metricas.js"));
  else root.RunAnalisis = factory(root.RunMetricas);
})(typeof self !== "undefined" ? self : this, function (RunMetricas) {
"use strict";

const NOMBRES = {};
RunMetricas.DISTANCIAS.forEach(([m, clave, nombre]) => { NOMBRES[clave] = { m, nombre }; });
const momento = d => (Number(d.inicio) > 0 ? Number(d.inicio) : Date.parse(`${d.date}T12:00:00`) || 0);

// Lista de esfuerzos de una distancia: [{ id, t, inicio, date }] del más rápido al más lento.
function esfuerzos(docs, clave, hasta) {
  return (docs || [])
    .filter(d => d.mejores && d.mejores[clave] > 0 && (hasta == null || momento(d) <= hasta))
    .map(d => ({ id: d.id, t: d.mejores[clave], inicio: momento(d), date: d.date, titulo: d.titulo }))
    .sort((a, b) => a.t - b.t || a.inicio - b.inicio);
}
// Logros de una actividad: { clave, nombre, t, puesto (1–3) } en el orden de las distancias.
// Puesto entre las actividades hasta ese momento (como era cuando se corrió).
function logros(doc, todos) {
  if (!doc || !doc.mejores) return [];
  const out = [];
  RunMetricas.DISTANCIAS.forEach(([, clave, nombre]) => {
    if (!(doc.mejores[clave] > 0)) return;
    const lista = esfuerzos(todos.concat(todos.some(d => d.id === doc.id) ? [] : [doc]), clave, momento(doc));
    const puesto = lista.findIndex(e => e.id === doc.id) + 1;
    if (puesto >= 1 && puesto <= 3) out.push({ clave, nombre, t: doc.mejores[clave], puesto });
  });
  return out;
}
const MEDALLA = { 1: "🥇", 2: "🥈", 3: "🥉" };
const textoPuesto = p => (p === 1 ? "Mejor marca" : p === 2 ? "2.ª mejor" : "3.ª mejor");

return { NOMBRES, esfuerzos, logros, MEDALLA, textoPuesto, momento };
});
