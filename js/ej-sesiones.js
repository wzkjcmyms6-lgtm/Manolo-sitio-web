// Cálculos de sesiones de gimnasio para Feed y Perfil. Sin pantalla ni
// Firebase: recibe los entrenamientos tal como se guardan
// ({ date, name, durationMin, startedAt, exercises: [{ name, sets: [{kg, reps, seg, calentamiento}] }] })
// y devuelve números listos para dibujar. El volumen lo calcula quien llama
// (gimnasio.js usa las mismas fórmulas que el mapa y el radar).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EjSesiones = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const DIA_MS = 86400000;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

function desdeIso(f) {
  const [y, m, d] = String(f).split("-").map(Number);
  return new Date(y, m - 1, d);
}
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
// Series que cuentan: sin calentamiento y con algo hecho.
function seriesEfectivas(ex) {
  return (ex.sets || []).filter(s => !s.calentamiento && (num(s.reps) > 0 || num(s.seg) > 0));
}

// Resumen de una sesión: series, reps y la mejor serie de cada ejercicio.
function resumen(w, volumen) {
  let series = 0, reps = 0;
  const ejercicios = (w.exercises || []).map(ex => {
    const ef = seriesEfectivas(ex);
    series += ef.length;
    reps += ef.reduce((s, x) => s + num(x.reps), 0);
    // Mejor serie: más peso y, con el mismo peso, más reps.
    let mejor = null;
    ef.forEach(s => {
      const kg = num(s.kg), r = num(s.reps);
      if (!mejor || kg > mejor.kg || (kg === mejor.kg && r > mejor.reps)) mejor = { kg, reps: r, seg: num(s.seg) };
    });
    return { nombre: ex.name || "Ejercicio", series: ef.length, minutos: num(ex.minutos), mejor };
  });
  return {
    duracionMin: Math.max(0, Math.round(num(w.durationMin))),
    volumen: Math.max(0, num(volumen)),
    series, reps, ejercicios
  };
}

// "Hoy", "Ayer", "Hace 3 días" (hasta 6) y si no "12 sept" (o "12 sept 2025").
function fechaRelativa(iso, hoy) {
  if (!iso) return "";
  const dias = Math.round((desdeIso(hoy) - desdeIso(iso)) / DIA_MS);
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias > 1 && dias < 7) return `Hace ${dias} días`;
  const d = desdeIso(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== desdeIso(hoy).getFullYear() ? " " + d.getFullYear() : ""}`;
}

// Lunes de la semana de una fecha.
function lunesDe(iso) {
  const d = desdeIso(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoLocal(d);
}

// Totales por semana (lunes a domingo) de las últimas `semanas` semanas
// hasta hoy, del más viejo al más nuevo. Con semanas = null, desde la
// primera sesión. Cada item: { desde, duracion, volumen, reps, sesiones }.
// `resumenDe(w)` devuelve el resumen (con volumen) de una sesión.
function porSemana(sesiones, hoy, semanas, resumenDe) {
  const fin = lunesDe(hoy);
  let inicio;
  if (semanas) inicio = isoLocal(new Date(desdeIso(fin).getTime() - (semanas - 1) * 7 * DIA_MS + 12 * 3600000));
  else {
    const primera = sesiones.reduce((min, w) => (w.date && (!min || w.date < min) ? w.date : min), null);
    inicio = primera ? lunesDe(primera) : fin;
  }
  const out = [];
  const idx = {};
  for (let d = desdeIso(inicio); isoLocal(d) <= fin; d.setDate(d.getDate() + 7)) {
    const k = isoLocal(d);
    idx[k] = out.length;
    out.push({ desde: k, duracion: 0, volumen: 0, reps: 0, sesiones: 0 });
  }
  sesiones.forEach(w => {
    if (!w.date || w.date > hoy) return;
    const i = idx[lunesDe(w.date)];
    if (i == null) return;
    const r = resumenDe(w);
    out[i].duracion += r.duracionMin;
    out[i].volumen += r.volumen;
    out[i].reps += r.reps;
    out[i].sesiones++;
  });
  return out;
}

// Con muchas semanas, se agrupan por mes para que las barras se lean.
function porMes(semanas) {
  const out = [];
  semanas.forEach(s => {
    const k = s.desde.slice(0, 7);
    let m = out[out.length - 1];
    if (!m || m.mes !== k) { m = { mes: k, desde: s.desde, duracion: 0, volumen: 0, reps: 0, sesiones: 0 }; out.push(m); }
    m.duracion += s.duracion; m.volumen += s.volumen; m.reps += s.reps; m.sesiones += s.sesiones;
  });
  return out;
}

function etiquetaSemana(desde) {
  const d = desdeIso(desde);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}
function etiquetaMes(mes) {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} ${String(y).slice(2)}`;
}

return { resumen, fechaRelativa, lunesDe, porSemana, porMes, etiquetaSemana, etiquetaMes, seriesEfectivas };
});
