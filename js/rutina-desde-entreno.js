// ---------- Rutinas del gimnasio desde un entreno (lógica, sin pantalla) ----------
// Al terminar un entreno (D-125), en el resumen:
// - si era de una rutina y hoy la cambiaste (agregaste o quitaste
//   ejercicios, cambiaste las series o el orden), ofrece guardar esos
//   cambios en la rutina, eligiendo cuáles;
// - si fue libre, ofrece guardarlo como rutina nueva.
// Los pesos de la rutina no se tocan (los lleva la progresión, D-095); un
// ejercicio nuevo toma lo que hiciste hoy (series, reps y peso).
// Pantalla en js/rutina-desde-entreno-ui.js; forma de las rutinas en
// js/rutinas.js. Pruebas: tests/rutina-desde-entreno.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./rutinas.js"));
  else root.RutinaDesdeEntreno = factory(root.EjRutinas);
})(typeof self !== "undefined" ? self : this, function (R) {
"use strict";

const norm = s => String(s == null ? "" : s).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
// El mismo ejercicio: por su ficha si ambos la tienen; si no, por el nombre.
const mismo = (it, ex) => (it.exerciseId && ex.exerciseId ? it.exerciseId === ex.exerciseId : norm(it.nombre) === norm(ex.name));
const esCardio = ex => !Array.isArray(ex.sets) || (!ex.sets.length && ex.minutos != null);
const trabajo = ex => (Array.isArray(ex.sets) ? ex.sets.filter(s => !s.calentamiento) : []);
// Series de trabajo de hoy (las de calentamiento no cuentan; cardio = 1).
const seriesDe = ex => (esCardio(ex) ? 1 : Math.max(1, trabajo(ex).length));
const ejercicios = entreno => ((entreno && entreno.exercises) || []).filter(ex => ex && String(ex.name || "").trim());

// Un ejercicio de rutina con lo que hiciste hoy.
function itemDe(ex) {
  const t = trabajo(ex);
  const reps = t.map(s => Number(s.reps)).filter(n => n > 0);
  const kgs = t.map(s => Number(s.kg)).filter(n => n > 0);
  return R.item(Object.assign({
    nombre: ex.name,
    exerciseId: ex.exerciseId || null,
    series: seriesDe(ex),
    repsMin: reps.length ? Math.min(...reps) : undefined,
    repsMax: reps.length ? Math.max(...reps) : undefined,
    peso: kgs.length ? Math.max(...kgs) : null
  }, ex.grupo ? { grupo: ex.grupo } : {}));
}

// Qué ejercicio de hoy corresponde a cada uno de la rutina.
function emparejar(items, exs) {
  const usados = new Set();
  return exs.map(ex => {
    const k = items.findIndex((it, i) => !usados.has(i) && mismo(it, ex));
    if (k >= 0) usados.add(k);
    return k;
  });
}

// Los cambios de hoy respecto de la rutina, cada uno con su id para elegirlo:
// [{ id, tipo: "agregar"|"quitar"|"series"|"orden", nombre, antes, ahora, texto }]
function cambios(rutina, entreno) {
  const items = ((rutina && rutina.items) || []).map(R.item);
  const exs = ejercicios(entreno);
  const par = emparejar(items, exs);
  const out = [];
  exs.forEach((ex, w) => {
    if (par[w] < 0) out.push({ id: `agregar:${w}`, tipo: "agregar", nombre: ex.name, texto: `Agregar ${ex.name}` });
  });
  items.forEach((it, i) => {
    if (!par.includes(i)) out.push({ id: `quitar:${i}`, tipo: "quitar", nombre: it.nombre, texto: `Quitar ${it.nombre} (hoy no lo hiciste)` });
  });
  exs.forEach((ex, w) => {
    const k = par[w];
    if (k < 0 || esCardio(ex)) return;
    const ahora = seriesDe(ex), antes = items[k].series;
    if (ahora !== antes) out.push({ id: `series:${k}`, tipo: "series", nombre: items[k].nombre, antes, ahora, texto: `${items[k].nombre}: ${ahora} ${ahora === 1 ? "serie" : "series"} (antes ${antes})` });
  });
  const ks = par.filter(k => k >= 0);
  if (ks.some((k, j) => j > 0 && k < ks[j - 1])) out.push({ id: "orden", tipo: "orden", texto: "El orden de hoy" });
  return out;
}

// La rutina con los cambios elegidos (ids de cambios()). Sin tocar pesos,
// reps, descansos ni notas de lo que ya estaba.
function aplicar(rutina, entreno, elegidos) {
  const si = new Set(elegidos || []);
  const items = ((rutina && rutina.items) || []).map(R.item);
  const exs = ejercicios(entreno);
  const par = emparejar(items, exs);
  // Cada ejercicio de la rutina, con sus series nuevas si se eligió.
  let lista = items.map((it, i) => {
    const w = par.indexOf(i);
    const x = Object.assign({}, it);
    if (w >= 0 && si.has(`series:${i}`)) x.series = seriesDe(exs[w]);
    return { x, i, w };
  }).filter(e => !si.has(`quitar:${e.i}`));
  // Orden de hoy: los hechos según el entreno; los que no hiciste (y quedan)
  // siguen pegados al que tenían antes.
  if (si.has("orden")) {
    const hechos = lista.filter(e => e.w >= 0).sort((a, b) => a.w - b.w);
    const resto = lista.filter(e => e.w < 0);
    lista = hechos;
    resto.forEach(e => {
      let pos = -1;
      for (let j = e.i - 1; j >= 0 && pos < 0; j--) pos = lista.findIndex(o => o.i === j);
      lista.splice(pos + 1, 0, e);
    });
  }
  // Lo agregado va después del ejercicio que hiciste antes que él.
  exs.forEach((ex, w) => {
    if (par[w] >= 0 || !si.has(`agregar:${w}`)) return;
    let pos = -1;
    for (let j = w - 1; j >= 0 && pos < 0; j--) pos = lista.findIndex(o => o.w === j);
    lista.splice(pos + 1, 0, { x: itemDe(ex), i: -1, w });
  });
  return Object.assign({}, rutina, { items: lista.map(e => e.x) });
}

// Un entreno libre como rutina nueva: { name, items }.
function desdeEntreno(entreno, nombresUsados) {
  const exs = ejercicios(entreno);
  const base = String((entreno && entreno.name) || "").trim();
  const f = fechaCorta(entreno && entreno.date);
  let name = base && norm(base) !== "entrenamiento" ? base.slice(0, 80) : f ? `Entreno del ${f}` : "Entreno de hoy";
  const usados = (nombresUsados || []).map(String);
  if (usados.some(n => norm(n) === norm(name))) name = R.nombreCopia(name, usados);
  return { name, items: exs.map(itemDe) };
}
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fechaCorta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]}` : "";
}

return { norm, mismo, seriesDe, itemDe, cambios, aplicar, desdeEntreno, fechaCorta };
});
