// ---------- Entreno en vivo más inteligente (sin pantalla) ----------
// Objetivo de cada serie con su porqué, series de calentamiento, descanso
// sugerido, superseries y circuitos, récords en vivo, resumen al terminar y
// carga de la sesión. Pruebas: tests/ej-entreno.test.js.
// Fórmulas y fuentes: docs/EJERCICIO_INTELIGENTE.md y DECISIONS (D-093).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./ej-equipo.js"), require("./ej-historial.js"));
  else root.EjEntreno = factory(root.EjEquipo, root.EjHistorial);
})(typeof self !== "undefined" ? self : this, function (EQ, H) {
"use strict";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
const kgTxt = n => `${String(Math.round(num(n) * 100) / 100).replace(".", ",")} kg`;
// [8, 8, 8, 8] → "4 × 8"; [8, 8, 7] → "8 · 8 · 7"
function repsTxt(reps) {
  const r = (reps || []).map(num).filter(x => x > 0);
  if (!r.length) return "";
  return r.every(x => x === r[0]) ? `${r.length} × ${r[0]}` : r.join(" · ");
}

// ---- Objetivo de hoy y su porqué (una línea) ----
// g = sugerencia de js/progresion.js; item = ejercicio de la rutina.
function porque(g, item) {
  const it = item || {};
  const rango = it.repsMin === it.repsMax ? `${it.repsMin}` : `${it.repsMin}-${it.repsMax}`;
  if (!g || g.tipo === "nuevo") return it.series ? `Primera vez: empieza con el objetivo de la rutina (${it.series} × ${rango}${it.peso != null ? ` con ${kgTxt(it.peso)}` : ""}).` : "";
  const hoy = g.kg > 0 ? `Hoy ${repsTxt(g.reps)} con ${kgTxt(g.kg)}` : `Hoy ${repsTxt(g.reps)} reps`;
  const antes = `la última vez ${repsTxt(g.repsAnteriores)}${g.kgAnterior > 0 ? ` con ${kgTxt(g.kgAnterior)}` : ""}`;
  if (g.tipo === "subir") return `${hoy} · ${antes} → sube ${kgTxt(g.kg - g.kgAnterior)}`;
  if (g.tipo === "bajar") return `${hoy} · las 2 últimas veces quedaste bajo ${it.repsMin} reps → baja ${kgTxt(g.kgAnterior - g.kg)}`;
  return `${hoy} · ${antes} → +1 rep`;
}

// Series precargadas con el objetivo: [{ kg, meta }] (meta = reps objetivo).
function objetivoSeries(item, g) {
  const n = Math.max(1, num(item.series) || 1);
  const out = [];
  for (let i = 0; i < n; i++) {
    if (g && g.tipo !== "nuevo") out.push({ kg: g.kg > 0 ? g.kg : (item.peso != null ? item.peso : ""), meta: g.reps[Math.min(i, g.reps.length - 1)] });
    else out.push({ kg: item.peso != null ? item.peso : "", meta: num(item.repsMin) || "" });
  }
  return out;
}

// ---- Calentamiento sugerido (~40 %, 60 % y 80 % del peso de trabajo) ----
// Solo en ejercicios con peso y compuestos (o con barra). Redondeado a tu
// equipo; sin series repetidas ni iguales al peso de trabajo.
const PASOS_CAL = [[0.4, 8], [0.6, 5], [0.8, 3]];
function calentamiento(kgTrabajo, ficha, perfil) {
  const kg = num(kgTrabajo);
  const f = ficha || {};
  if (f.tipo !== "carga" || !(kg > 0)) return [];
  const m = EQ.modo(f, perfil);
  const conBarra = m.tipo === "barra";
  if (f.mec !== "c" && !conBarra) return [];
  if (conBarra ? kg <= m.barra + 10 : kg < 15) return [];
  const out = [];
  PASOS_CAL.forEach(([pct, reps]) => {
    let w = EQ.redondear(kg * pct, f, perfil, "cerca");
    if (conBarra && w < m.barra) w = m.barra;
    if (!(w > 0) || w >= kg) return;
    if (out.some(x => x.kg === w)) return;
    out.push({ kg: w, reps, pct: Math.round(pct * 100) });
  });
  // Con la barra sola primero si el 40 % ya pasa de la barra.
  if (conBarra && m.barra > 0 && out.length && out[0].kg > m.barra && kg >= m.barra * 3) out.unshift({ kg: m.barra, reps: 10, pct: Math.round((m.barra / kg) * 100) });
  return out;
}

// ---- Descanso sugerido según el ejercicio ----
// Compuesto pesado de músculos grandes: 3 min; otro compuesto: 2 min;
// aislamiento: 75 s; isométrico: 1 min; cardio: sin descanso.
const GRANDES = new Set(["cuadriceps", "isquiotibiales", "gluteos", "dorsales", "espalda_media", "lumbares", "pecho_superior", "pecho_medio", "pecho_inferior"]);
function descansoSugerido(ficha, repsObjetivo) {
  const f = ficha || {};
  if (f.tipo === "cardio") return 0;
  if (f.tipo === "isometrico") return 60;
  if (f.mec === "c") {
    const grande = (f.primarios || []).some(m => GRANDES.has(m));
    if (grande) return num(repsObjetivo) > 0 && num(repsObjetivo) <= 6 ? 180 : 150;
    return 120;
  }
  if (f.mec === "a") return 75;
  return 90;
}

// ---- Superseries y circuitos ----
// Ejercicios seguidos con el mismo `grupo` ("A", "B"…) forman una ronda.
// → por índice: { letra, pos (1…), total } o null.
function grupos(ejercicios) {
  const out = (ejercicios || []).map(() => null);
  let i = 0;
  while (i < out.length) {
    const g = ejercicios[i].grupo;
    let j = i;
    while (g && j + 1 < out.length && ejercicios[j + 1].grupo === g) j++;
    if (g && j > i) for (let k = i; k <= j; k++) out[k] = { letra: g, pos: k - i + 1, total: j - i + 1 };
    i = j + 1;
  }
  return out;
}
// Al marcar una serie: ¿se descansa ya o se pasa al siguiente de la ronda?
// → { descansar, seg, siguiente (índice o null) }
function trasMarcar(ejercicios, exIndex) {
  const gs = grupos(ejercicios);
  const g = gs[exIndex];
  const ex = ejercicios[exIndex] || {};
  if (!g) return { descansar: num(ex.descansoSeg) > 0, seg: num(ex.descansoSeg), siguiente: null };
  if (g.pos < g.total) return { descansar: false, seg: 0, siguiente: exIndex + 1 };
  const desde = exIndex - g.total + 1;
  const seg = Math.max(...ejercicios.slice(desde, exIndex + 1).map(e => num(e.descansoSeg)));
  return { descansar: seg > 0, seg, siguiente: desde };
}
// Siguiente letra libre para una superserie nueva.
function letraLibre(ejercicios) {
  const usadas = new Set((ejercicios || []).map(e => e.grupo).filter(Boolean));
  for (const l of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (!usadas.has(l)) return l;
  return "Z";
}

// ---- Récord en vivo ----
// serie = { kg, reps, rir }; prev = { mejorE1rm, mejorKg(reps) → kg con ≥ reps, sesiones }.
// Solo con peso y si ya hiciste el ejercicio antes (si no, todo sería récord).
// → { tipo: "1rm", valor, antes } | { tipo: "reps", reps, kg, antes } | null
function recordEnVivo(serie, prev) {
  const kg = num(serie && serie.kg), reps = num(serie && serie.reps);
  if (!prev || !(prev.sesiones > 0) || !(kg > 0) || !(reps > 0)) return null;
  const rm = H.e1rm(kg, reps, serie.rir);
  const antesRm = num(prev.mejorE1rm);
  if (rm > antesRm + 0.05) return { tipo: "1rm", valor: Math.round(rm * 10) / 10, antes: Math.round(antesRm * 10) / 10 };
  const antesKg = num(prev.mejorKg ? prev.mejorKg(reps) : 0);
  if (kg > antesKg && reps <= 12) return { tipo: "reps", reps, kg, antes: antesKg };
  return null;
}
function textoRecord(r) {
  if (!r) return "";
  if (r.tipo === "1rm") return `¡Récord! 1RM estimado ${kgTxt(r.valor)}${r.antes ? ` (antes ${kgTxt(r.antes)})` : ""}`;
  return `¡Récord de ${r.reps} reps: ${kgTxt(r.kg)}!${r.antes ? ` (antes ${kgTxt(r.antes)})` : ""}`;
}
// Lo previo de un ejercicio para recordEnVivo, desde sus sesiones (EjHistorial.sesiones).
function previoDe(sesiones) {
  const lista = sesiones || [];
  const mejorE1rm = lista.reduce((m, s) => Math.max(m, num(s.e1rm)), 0);
  const mejorKg = reps => lista.reduce((m, s) => Math.max(m, ...(s.sets || []).filter(x => num(x.reps) >= reps).map(x => num(x.kg)), 0), 0);
  return { sesiones: lista.length, mejorE1rm, mejorKg };
}

// ---- Resumen al terminar ----
// Totales de un entreno (sin calentamientos): volumen (kg × reps), series y reps.
function totales(entreno) {
  let volumen = 0, series = 0, reps = 0;
  (entreno && entreno.exercises || []).forEach(ex => (ex.sets || []).forEach(s => {
    if (s.calentamiento) return;
    if (num(s.reps) > 0 || num(s.seg) > 0) series++;
    reps += num(s.reps);
    volumen += num(s.kg) * num(s.reps);
  }));
  return { volumen: Math.round(volumen), series, reps };
}
// La última vez comparable: la misma rutina o, si no tiene, el mismo nombre.
function anteriorComparable(historial, entreno) {
  const clave = s => String(s || "").trim().toLowerCase();
  const antes = w => (w.date || "") < (entreno.date || "") || ((w.date || "") === (entreno.date || "") && num(w.startedAt) < num(entreno.startedAt));
  const igual = w => (entreno.rutinaId ? w.rutinaId === entreno.rutinaId : clave(w.name) === clave(entreno.name));
  return (historial || []).filter(w => w.id !== entreno.id && antes(w) && igual(w))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || num(b.startedAt) - num(a.startedAt))[0] || null;
}
function comparar(entreno, anterior) {
  const a = totales(entreno);
  if (!anterior) return Object.assign(a, { anterior: null });
  const b = totales(anterior);
  return Object.assign(a, {
    anterior: Object.assign(b, { fecha: anterior.date }),
    dVolumenPct: b.volumen > 0 ? Math.round(((a.volumen - b.volumen) / b.volumen) * 100) : null,
    dSeries: a.series - b.series,
    dReps: a.reps - b.reps
  });
}
// Carga de la sesión en la misma escala que Running (D-065): RPE × minutos
// × 100 / 480 (1 hora a RPE 8 = 100). Método de "session RPE" (Foster, 2001).
function cargaSesion(rpe, minutos) {
  const r = num(rpe), m = num(minutos);
  if (!(r > 0) || !(m > 0)) return 0;
  return Math.round((Math.min(10, r) * m * 100) / 480);
}

return { repsTxt, porque, objetivoSeries, calentamiento, descansoSugerido, grupos, trasMarcar, letraLibre, recordEnVivo, textoRecord, previoDe, totales, anteriorComparable, comparar, cargaSesion };
});
