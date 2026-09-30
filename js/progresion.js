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

// historial: entrenamientos del más nuevo al más viejo.
// mismo(ex): true si ese ejercicio guardado es el de la rutina.
// Devuelve null si no hay nada que sugerir.
function sugerir(item, historial, mismo, opciones) {
  const op = opciones || {};
  if (op.tipo === "cardio" || op.tipo === "isometrico") return null;
  const veces = [];
  for (const w of historial || []) {
    const ex = (w.exercises || []).find(mismo);
    if (!ex) continue;
    if ((ex.sets || []).some(s => num(s.asistencia) > 0)) return null; // asistida: no se sugiere
    const series = seriesTrabajo(ex);
    if (series.length) veces.push({ fecha: w.date, series });
    if (veces.length === 2) break;
  }
  if (!veces.length) return { tipo: "nuevo", texto: "Primera vez con este ejercicio en tu historial: empieza con el objetivo." };

  const { repsMin, repsMax } = item;
  const nSeries = Math.max(1, num(item.series) || 1);
  const ultima = veces[0];
  const pesoDe = v => Math.max(...v.series.map(s => num(s.kg)));
  const kg = pesoDe(ultima);
  const inferior = op.inferior != null ? op.inferior : esTrenInferior(op.ficha);
  const subida = num(item.incremento) > 0 ? num(item.incremento) : (inferior ? 5 : 2.5);
  const repsUlt = ultima.series.map(s => num(s.reps));
  const base = { fecha: ultima.fecha, kgAnterior: kg, repsAnteriores: repsUlt };

  // Bajar: las 2 últimas veces alguna serie quedó bajo el mínimo.
  const fallo = v => v.series.some(s => num(s.reps) < repsMin);
  if (veces.length === 2 && fallo(veces[0]) && fallo(veces[1]) && kg > 0) {
    let nuevo = redondear(kg * 0.9, num(item.incremento) > 0 ? Math.min(num(item.incremento), 2.5) : 0.5);
    if (nuevo >= kg) nuevo = Math.max(0, kg - (num(item.incremento) || 0.5));
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
    const nuevo = Math.round((kg + subida) * 100) / 100;
    return Object.assign(base, {
      tipo: "subir", kg: nuevo, reps: Array(nSeries).fill(repsMin),
      texto: `Sube a ${kgTxt(nuevo)}`,
      motivo: `La última vez hiciste ${trabajoConPeso.length} × ${repsMax} con ${kgTxt(kg)}: todas en el tope del rango.`
    });
  }

  // Repetir peso y sumar 1 rep por serie (sin pasar el tope).
  const reps = Array.from({ length: nSeries }, (_, i) => {
    const antes = repsUlt[i];
    return antes ? Math.min(repsMax, antes + 1) : repsMin;
  });
  return Object.assign(base, {
    tipo: "repetir", kg, reps,
    texto: kg > 0 ? `Mismo peso: ${kgTxt(kg)}, +1 rep` : "+1 rep por serie",
    motivo: `La última vez: ${repsUlt.join(" · ")} reps${kg > 0 ? ` con ${kgTxt(kg)}` : ""}. Todavía no llegaste a ${repsMax} en todas.`
  });
}

return { sugerir, esTrenInferior, seriesTrabajo, redondear };
});
