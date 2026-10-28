// ---------- Ejercicio: calendario anual de entrenamientos ----------
// Los 12 meses del año en cuadritos (semanas de lunes a domingo); cada día
// con cuántos entrenamientos de Gimnasio tuvo. Inspirado en el resumen
// anual de Hevy (pedido del dueño, 2026-10-29).
// Sin DOM ni Firebase: tests/ej-calendario.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EjCalendario = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const fechaOk = f => /^\d{4}-\d{2}-\d{2}$/.test(f || "") && !isNaN(new Date(f + "T12:00:00Z").getTime());
const iso = (a, m, d) => `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Entrenamientos por día: { "AAAA-MM-DD": [{ id, nombre }] }.
function porDia(registros) {
  const out = {};
  (registros || []).forEach(r => {
    if (!r || !fechaOk(r.date)) return;
    (out[r.date] = out[r.date] || []).push({ id: r.id, nombre: r.name ? String(r.name) : "Entrenamiento" });
  });
  return out;
}

// Un mes en semanas de lunes a domingo; los huecos antes del 1 y después
// del último día van en null (no se dibujan).
function mes(anio, m, dias, hoy) {
  const total = new Date(Date.UTC(anio, m + 1, 0)).getUTCDate();
  const inicio = (new Date(Date.UTC(anio, m, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const celdas = Array(inicio).fill(null);
  for (let d = 1; d <= total; d++) {
    const f = iso(anio, m, d);
    const n = (dias[f] || []).length;
    celdas.push({ fecha: f, dia: d, n, futuro: !!hoy && f > hoy, hoy: f === hoy });
  }
  while (celdas.length % 7) celdas.push(null);
  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return { mes: m, nombre: MESES[m], semanas, dias: celdas.filter(c => c && c.n > 0).length };
}

// El año completo: 12 meses, días entrenados y total de sesiones.
function anio(registros, a, hoy) {
  const dias = porDia(registros);
  const meses = MESES.map((_, m) => mes(a, m, dias, hoy));
  const prefijo = `${a}-`;
  const delAnio = Object.keys(dias).filter(f => f.startsWith(prefijo));
  return {
    anio: a, meses,
    diasEntrenados: delAnio.length,
    sesiones: delAnio.reduce((s, f) => s + dias[f].length, 0),
    mejorMes: meses.reduce((mejor, x) => (x.dias > (mejor ? mejor.dias : 0) ? x : mejor), null)
  };
}

// Años que se pueden ver: desde el primer entrenamiento hasta el actual.
function aniosDisponibles(registros, hoy) {
  const actual = Number(String(hoy).slice(0, 4));
  const fechas = (registros || []).map(r => r && r.date).filter(fechaOk).sort();
  const primero = fechas.length ? Math.min(Number(fechas[0].slice(0, 4)), actual) : actual;
  const out = [];
  for (let a = primero; a <= actual; a++) out.push(a);
  return out;
}

function fechaLarga(f) {
  if (!fechaOk(f)) return f || "";
  const d = new Date(f + "T12:00:00Z");
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES_LARGOS[d.getUTCMonth()]}`;
}

return { MESES, MESES_LARGOS, porDia, mes, anio, aniosDisponibles, fechaLarga };
});
