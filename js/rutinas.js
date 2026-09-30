// Rutinas de Ejercicio: forma de los datos (sin pantalla ni Firebase).
//
// Una rutina se guarda en users/{uid}/rutinas/{id}:
//   { name, orden, v: 2,
//     items: [{ nombre, exerciseId, series, repsMin, repsMax, peso,
//               descansoSeg, notas, incremento }],
//     exercises: ["Press de banca", ...] }   ← lista vieja de nombres, se
//                                             mantiene para no perder nada
// Las rutinas viejas solo tenían { name, exercises: [nombres] }: se leen
// con valores por defecto (3 series de 8-12, 90 s de descanso).
//
// Plan semanal en users/{uid}/meta/plan_semanal: { dias: { "1": idRutina, ... } }
// con 1 = lunes … 6 = sábado y 0 = domingo (como Date.getDay()).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EjRutinas = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const POR_DEFECTO = { series: 3, repsMin: 8, repsMax: 12, peso: null, descansoSeg: 90, notas: "", incremento: null };
const DIAS = [
  { k: "1", nombre: "Lunes", corto: "Lun" }, { k: "2", nombre: "Martes", corto: "Mar" },
  { k: "3", nombre: "Miércoles", corto: "Mié" }, { k: "4", nombre: "Jueves", corto: "Jue" },
  { k: "5", nombre: "Viernes", corto: "Vie" }, { k: "6", nombre: "Sábado", corto: "Sáb" },
  { k: "0", nombre: "Domingo", corto: "Dom" }
];

function entero(v, min, max, def) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || v === "" || v == null) return def;
  return Math.min(max, Math.max(min, n));
}
function decimal(v, min, max) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < min) return null;
  return Math.min(max, Math.round(n * 100) / 100);
}

// Un ejercicio de rutina, completo y con valores válidos.
function item(x) {
  const o = x || {};
  let repsMin = entero(o.repsMin, 1, 100, POR_DEFECTO.repsMin);
  let repsMax = entero(o.repsMax, 1, 100, Math.max(repsMin, POR_DEFECTO.repsMax));
  if (repsMax < repsMin) [repsMin, repsMax] = [repsMax, repsMin];
  const out = {
    nombre: String(o.nombre || "").trim().slice(0, 80),
    exerciseId: o.exerciseId || null,
    series: entero(o.series, 1, 20, POR_DEFECTO.series),
    repsMin, repsMax,
    peso: decimal(o.peso, 0, 1000),
    descansoSeg: entero(o.descansoSeg, 0, 900, POR_DEFECTO.descansoSeg),
    notas: String(o.notas || "").trim().slice(0, 200),
    incremento: decimal(o.incremento, 0.25, 50)
  };
  return out;
}

// Rutina tal como la usa la app, venga del formato viejo o del nuevo.
function normalizar(doc) {
  const d = doc || {};
  const items = Array.isArray(d.items)
    ? d.items.map(item)
    : (Array.isArray(d.exercises) ? d.exercises : []).filter(Boolean).map(n => item({ nombre: n }));
  return {
    id: d.id,
    name: String(d.name || "Rutina").trim() || "Rutina",
    orden: Number.isFinite(Number(d.orden)) ? Number(d.orden) : null,
    items: items.filter(it => it.nombre),
    vieja: !Array.isArray(d.items)
  };
}

// Lo que se guarda en Firestore (sin id). Incluye la lista vieja de nombres.
function aGuardar(r) {
  const items = (r.items || []).map(item).filter(it => it.nombre);
  return {
    name: String(r.name || "Rutina").trim().slice(0, 80) || "Rutina",
    orden: Number(r.orden) || 0,
    v: 2,
    items,
    exercises: items.map(it => it.nombre)
  };
}

function ordenar(rutinas) {
  return rutinas.slice().sort((a, b) => {
    const oa = a.orden == null ? Infinity : a.orden, ob = b.orden == null ? Infinity : b.orden;
    return oa - ob || a.name.localeCompare(b.name);
  });
}

function repsTxt(it) {
  return it.repsMin === it.repsMax ? `${it.repsMin}` : `${it.repsMin}-${it.repsMax}`;
}
function descansoTxt(seg) {
  const s = Number(seg) || 0;
  if (!s) return "sin descanso";
  const m = Math.floor(s / 60), r = s % 60;
  return m ? `${m}:${String(r).padStart(2, "0")} min` : `${r} s`;
}
function pesoTxt(kg) {
  return kg == null ? "" : `${String(kg).replace(".", ",")} kg`;
}
// "3 × 8-12 · 60 kg · 1:30 min"
function resumenItem(it) {
  return [`${it.series} × ${repsTxt(it)}`, pesoTxt(it.peso), `descanso ${descansoTxt(it.descansoSeg)}`].filter(Boolean).join(" · ");
}
function totalSeries(r) {
  return (r.items || []).reduce((s, it) => s + it.series, 0);
}

// Copia con otro nombre: "Push" → "Push (copia)", "Push (copia 2)"…
function nombreCopia(nombre, existentes) {
  const base = String(nombre).replace(/\s*\(copia(?: \d+)?\)$/, "");
  const usados = new Set(existentes);
  let n = 1, cand = `${base} (copia)`;
  while (usados.has(cand)) cand = `${base} (copia ${++n})`;
  return cand;
}

// Rutina del día según el plan (fecha "AAAA-MM-DD").
function rutinaDelDia(plan, rutinas, iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const k = String(new Date(y, m - 1, d).getDay());
  const id = plan && plan.dias && plan.dias[k];
  return id ? rutinas.find(r => r.id === id) || null : null;
}

return { POR_DEFECTO, DIAS, item, normalizar, aGuardar, ordenar, repsTxt, descansoTxt, pesoTxt, resumenItem, totalSeries, nombreCopia, rutinaDelDia };
});
