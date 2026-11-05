// Sugerencia de progresión para cada ejercicio de una rutina (doble
// progresión). Sin pantalla ni Firebase.
//
// Mira la última vez que hiciste el ejercicio (en cualquier rutina):
// - Hiciste todas las series en el tope del rango de reps → subir peso
//   (+2,5 kg tren superior, +5 kg tren inferior, o la "subida de peso"
//   que elegiste en la rutina).
// - No llegaste al tope → mismo peso y +1 rep en cada serie (sin pasar el tope).
// - Las 2 últimas veces quedaste por debajo del mínimo de reps → bajar el
//   peso ~10 %.
// Tú decides si la usas: la app solo la muestra.
//
// v2 (2026-11, D-094), sin romper lo anterior (todo es opcional):
// - opciones.redondear(kg, hacia) y opciones.micro: el peso se ajusta a tu
//   equipo (discos, mancuernas, máquinas) y la subida es al menos la
//   microcarga posible (js/ej-equipo.js).
// - RIR: si en la última vez te sobraban reps (RIR medio ≥ 3 al tope del
//   rango) la subida es doble; si no llegaste al tope pero te sobraban
//   (RIR ≥ 2), +2 reps en vez de +1.
// - tendencia: el 1RM estimado de las últimas 6 sesiones y cuánto cambia
//   por semana.
// - opciones.descarga: semana de descarga → ~40 % menos series y ~10 %
//   menos peso.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EjProgresion = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const INFERIOR = new Set(["cuadriceps", "isquiotibiales", "gluteos", "pantorrillas", "aductores", "abductores"]);

// Tren inferior si la mayoría de sus músculos principales son de piernas.
function esTrenInferior(ficha) {
  const p = (ficha && ficha.primarios) || [];
  if (!p.length) return false;
  return p.filter(m => INFERIOR.has(m)).length * 2 >= p.length;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
// Series de trabajo: sin calentamiento, con reps y sin asistencia.
function seriesTrabajo(ex) {
  return (ex.sets || []).filter(s => !s.calentamiento && num(s.reps) > 0);
}
function redondear(kg, paso) {
  const p = paso > 0 ? paso : 0.5;
  return Math.round(kg / p) * p;
}
function kgTxt(kg) {
  return `${String(Math.round(kg * 100) / 100).replace(".", ",")} kg`;
}
// 1RM estimado (Epley, reps + RIR, tope 12), como js/ej-historial.js.
function e1rm(kg, reps, rir) {
  const r = Math.min(12, num(reps) + Math.max(0, num(rir)));
  if (!(num(kg) > 0) || !(num(reps) > 0)) return 0;
  return r <= 1 ? num(kg) : num(kg) * (1 + r / 30);
}
// RIR medio de la vez (solo si anotaste RIR en al menos la mitad de las series).
function rirMedio(series) {
  const con = series.filter(s => s.rir !== "" && s.rir != null && Number.isFinite(Number(s.rir)));
  if (!con.length || con.length * 2 < series.length) return null;
  return con.reduce((a, s) => a + num(s.rir), 0) / con.length;
}
// Tendencia del 1RM estimado: pendiente (kg por semana) de una recta por
// mínimos cuadrados sobre las sesiones (de la más vieja a la más nueva).
function tendencia(veces) {
  const pts = veces.slice().reverse().map(v => ({
    t: Date.parse(v.fecha + "T12:00:00Z") / 86400000,
    y: Math.max(...v.series.map(s => e1rm(s.kg, s.reps, s.rir)))
  })).filter(p => Number.isFinite(p.t) && p.y > 0);
  if (pts.length < 3) return null;
  const n = pts.length, mt = pts.reduce((a, p) => a + p.t, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
  const sxx = pts.reduce((a, p) => a + (p.t - mt) ** 2, 0);
  if (!sxx) return null;
  const pend = pts.reduce((a, p) => a + (p.t - mt) * (p.y - my), 0) / sxx;
  return { e1rm: pts.map(p => Math.round(p.y * 10) / 10), porSemana: Math.round(pend * 7 * 10) / 10 };
}

// historial: entrenamientos del más nuevo al más viejo.
// mismo(ex): true si ese ejercicio guardado es el de la rutina.
// Devuelve null si no hay nada que sugerir.
function sugerir(item, historial, mismo, opciones) {
  const op = opciones || {};
  if (op.tipo === "cardio" || op.tipo === "isometrico") return null;
  const todas = [];
  for (const w of historial || []) {
    const ex = (w.exercises || []).find(mismo);
    if (!ex) continue;
    if ((ex.sets || []).some(s => num(s.asistencia) > 0)) return null; // asistida: no se sugiere
    const series = seriesTrabajo(ex);
    if (series.length) todas.push({ fecha: w.date, series });
    if (todas.length === 6) break;
  }
  const veces = todas.slice(0, 2);
  if (!veces.length) return { tipo: "nuevo", texto: "Primera vez con este ejercicio en tu historial: empieza con el objetivo." };
  const red = typeof op.redondear === "function" ? op.redondear : null;
  const micro = num(op.micro) > 0 ? num(op.micro) : 0;
  const tend = tendencia(todas);

  const { repsMin, repsMax } = item;
  const nSeries = Math.max(1, num(item.series) || 1);
  const ultima = veces[0];
  const pesoDe = v => Math.max(...v.series.map(s => num(s.kg)));
  const kg = pesoDe(ultima);
  const inferior = op.inferior != null ? op.inferior : esTrenInferior(op.ficha);
  const subida = num(item.incremento) > 0 ? num(item.incremento) : (inferior ? 5 : 2.5);
  const repsUlt = ultima.series.map(s => num(s.reps));
  const rir = rirMedio(ultima.series);
  const base = { fecha: ultima.fecha, kgAnterior: kg, repsAnteriores: repsUlt, rirAnterior: rir, tendencia: tend };

  // Semana de descarga: menos series (~40 %) y algo menos de peso (~10 %).
  if (op.descarga) {
    const nDesc = Math.max(1, Math.round(nSeries * 0.6));
    let nuevo = kg > 0 ? (red ? red(kg * 0.9, "abajo") : redondear(kg * 0.9, 0.5)) : 0;
    if (nuevo >= kg && kg > 0) nuevo = Math.max(0, kg - (micro || 0.5));
    return Object.assign(base, {
      tipo: "descarga", kg: nuevo, reps: Array(nDesc).fill(repsMin),
      texto: kg > 0 ? `Descarga: ${kgTxt(nuevo)}` : "Descarga: menos series",
      motivo: "Semana de descarga: menos series y algo menos de peso para recuperarte."
    });
  }

  // Bajar: las 2 últimas veces alguna serie quedó bajo el mínimo.
  const fallo = v => v.series.some(s => num(s.reps) < repsMin);
  if (veces.length === 2 && fallo(veces[0]) && fallo(veces[1]) && kg > 0) {
    let nuevo = red && !(num(item.incremento) > 0) ? red(kg * 0.9, "cerca") : redondear(kg * 0.9, num(item.incremento) > 0 ? Math.min(num(item.incremento), 2.5) : 0.5);
    if (nuevo >= kg) nuevo = Math.max(0, kg - (num(item.incremento) || micro || 0.5));
    return Object.assign(base, {
      tipo: "bajar", kg: nuevo, reps: Array(nSeries).fill(repsMin),
      texto: `Baja a ${kgTxt(nuevo)}`,
      motivo: `Las 2 últimas veces quedaste por debajo de ${repsMin} reps en alguna serie.`
    });
  }

  // Subir: todas las series (al menos las de la rutina) en el tope.
  const trabajoConPeso = ultima.series.filter(s => num(s.kg) === kg);
  const todasAlTope = trabajoConPeso.length >= nSeries && trabajoConPeso.every(s => num(s.reps) >= repsMax);
  if (todasAlTope) {
    // Te sobraban reps (RIR ≥ 3): sube el doble.
    const sobraban = rir != null && rir >= 3 && !(num(item.incremento) > 0);
    const paso = sobraban ? subida * 2 : subida;
    let nuevo = Math.round((kg + paso) * 100) / 100;
    if (red && !(num(item.incremento) > 0)) {
      nuevo = red(kg + paso, "cerca");
      if (nuevo <= kg) nuevo = red(kg + (micro || paso), "arriba");
    }
    return Object.assign(base, {
      tipo: "subir", kg: nuevo, reps: Array(nSeries).fill(repsMin),
      texto: `Sube a ${kgTxt(nuevo)}`,
      motivo: `La última vez hiciste ${trabajoConPeso.length} × ${repsMax} con ${kgTxt(kg)}: todas en el tope del rango.${sobraban ? " Y te sobraban reps." : ""}`,
      nota: sobraban ? "te sobraban reps" : ""
    });
  }

  // Repetir peso y sumar 1 rep por serie (2 si te sobraban), sin pasar el tope.
  const mas = rir != null && rir >= 2 ? 2 : 1;
  const reps = Array.from({ length: nSeries }, (_, i) => {
    const antes = repsUlt[i];
    return antes ? Math.min(repsMax, antes + mas) : repsMin;
  });
  return Object.assign(base, {
    tipo: "repetir", kg, reps, masReps: mas, nota: mas === 2 ? "te sobraban reps" : "",
    texto: kg > 0 ? `Mismo peso: ${kgTxt(kg)}, +${mas} rep` : `+${mas} rep por serie`,
    motivo: `La última vez: ${repsUlt.join(" · ")} reps${kg > 0 ? ` con ${kgTxt(kg)}` : ""}. Todavía no llegaste a ${repsMax} en todas.`
  });
}

return { sugerir, esTrenInferior, seriesTrabajo, redondear, e1rm, rirMedio, tendencia };
});
