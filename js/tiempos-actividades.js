// ---------- Medir tiempos: tus actividades (fase 6, D-113) ----------
// Las 6 de siempre conservan su id (manana, ejercicio, correr, desayunar,
// banarse, leer); puedes crear otras, renombrarlas, darles un emoji,
// ordenarlas (ese orden es el de "Mi mañana") y archivarlas (sus tiempos
// quedan; solo dejan de aparecer para anotar). Se guardan en
// meta/tiempos_ajustes → actividades: { id: { nombre, emoji, orden,
// archivada, manana, fuente } }. Sin ese documento, valen las de siempre.
// fuente: de qué sección se llena sola (running, gimnasio, libros,
// movilidad) o "" para nunca; desde: el día en que empezó a llenarse sola
// (los días de antes no cambian).
// Sin DOM: tests/tiempos-actividades.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TiemposActividades = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const BASE = [
  { id: "manana", nombre: "Rutina de la mañana", emoji: "🌅", detalle: "Levantarse, lavarse los dientes, scalping, rezar, decretar y tender la cama", fuente: "" },
  { id: "ejercicio", nombre: "Ejercicio", emoji: "🏋️", fuente: "gimnasio" },
  { id: "correr", nombre: "Correr", emoji: "🏃", fuente: "running" },
  { id: "desayunar", nombre: "Desayunar", emoji: "🍳", fuente: "" },
  { id: "banarse", nombre: "Bañarse y alistarse", emoji: "🚿", fuente: "" },
  { id: "leer", nombre: "Leer 30 páginas", emoji: "📖", fuente: "libros" }
];
// De qué secciones se puede llenar solo un tiempo.
const FUENTES = [
  { id: "running", nombre: "Running", que: "la duración de tus carreras del día" },
  { id: "gimnasio", nombre: "Ejercicio", que: "la duración de tus entrenos del día" },
  { id: "libros", nombre: "Libros", que: "los minutos de «Leer ahora»" },
  { id: "movilidad", nombre: "Movilidad", que: "la duración de tus rutinas del día" }
];
const EMOJIS = ["🌅", "🏋️", "🏃", "🍳", "🚿", "📖", "🙏", "🧘", "🦷", "🛏️", "☕", "🥤", "🐕", "🚗", "💼", "📝", "🎧", "🧴", "👔", "💊", "🧹", "📿", "🚴", "⏰"];
const MAX = 30;            // actividades (contando archivadas)
const idOk = id => typeof id === "string" && /^[a-z0-9_-]{1,40}$/.test(id);
const fechaOk = f => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
const sinTildes = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fuenteOk = f => FUENTES.some(x => x.id === f);
// Un emoji (o nada): hasta 8 caracteres, sin letras ni números.
function emojiOk(e) {
  const t = String(e || "").trim();
  if (!t) return "";
  if (t.length > 12 || /[\p{L}\p{N}]/u.test(t)) return null;
  return t;
}

// Ajustes guardados → lista ordenada [{ id, nombre, emoji, orden, archivada, manana, fuente, detalle, base }].
function lista(ajustes) {
  const guardadas = (ajustes && ajustes.actividades && typeof ajustes.actividades === "object") ? ajustes.actividades : {};
  const out = BASE.map((b, i) => {
    const g = guardadas[b.id] || {};
    return {
      id: b.id, base: true, detalle: b.detalle || "",
      nombre: typeof g.nombre === "string" && g.nombre.trim() ? g.nombre.trim() : b.nombre,
      emoji: typeof g.emoji === "string" ? (emojiOk(g.emoji) == null ? b.emoji : emojiOk(g.emoji)) : b.emoji,
      orden: Number.isFinite(g.orden) ? g.orden : i,
      archivada: g.archivada === true,
      manana: g.manana !== false,
      fuente: typeof g.fuente === "string" ? (fuenteOk(g.fuente) ? g.fuente : "") : b.fuente,
      desde: fechaOk(g.desde) ? g.desde : null
    };
  });
  Object.keys(guardadas).forEach(id => {
    if (!idOk(id) || BASE.some(b => b.id === id)) return;
    const g = guardadas[id] || {};
    if (typeof g.nombre !== "string" || !g.nombre.trim()) return;
    out.push({ id, base: false, detalle: "", nombre: g.nombre.trim(), emoji: emojiOk(g.emoji) || "", orden: Number.isFinite(g.orden) ? g.orden : 100 + out.length,
      archivada: g.archivada === true, manana: g.manana !== false, fuente: fuenteOk(g.fuente) ? g.fuente : "", desde: fechaOk(g.desde) ? g.desde : null });
  });
  return out.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
}
const activas = ajustes => lista(ajustes).filter(a => !a.archivada);
const archivadas = ajustes => lista(ajustes).filter(a => a.archivada);
const pasosManana = ajustes => activas(ajustes).filter(a => a.manana);

// Nombre nuevo o cambiado → { ok, error, nombre, emoji }.
function validar(datos, todas, id) {
  const nombre = String(datos.nombre || "").replace(/\s+/g, " ").trim();
  if (!nombre) return { ok: false, error: "Escribe el nombre." };
  if (nombre.length > 40) return { ok: false, error: "Máximo 40 letras." };
  if ((todas || []).some(a => a.id !== id && sinTildes(a.nombre) === sinTildes(nombre))) return { ok: false, error: "Ya tienes una actividad con ese nombre." };
  const emoji = emojiOk(datos.emoji);
  if (emoji == null) return { ok: false, error: "El ícono tiene que ser un emoji." };
  return { ok: true, nombre, emoji };
}
// Un id para una actividad nueva: "a-" + el nombre sin tildes (y un número si se repite).
function nuevoId(nombre, todas) {
  const base = `a-${sinTildes(nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "actividad"}`;
  const usados = new Set((todas || []).map(a => a.id));
  let id = base, n = 2;
  while (usados.has(id)) id = `${base}-${n++}`;
  return id;
}
// La actividad nueva (va al final de la lista) → { id, doc }.
function nueva(datos, todas) {
  const v = validar(datos, todas, null);
  if (!v.ok) return v;
  if ((todas || []).length >= MAX) return { ok: false, error: `Puedes tener hasta ${MAX} actividades (archiva o quita alguna).` };
  const id = nuevoId(v.nombre, todas);
  const orden = (todas || []).reduce((m, a) => Math.max(m, a.orden), -1) + 1;
  return { ok: true, id, doc: { nombre: v.nombre, emoji: v.emoji, orden, archivada: false, manana: true, fuente: "" } };
}
// Subir (-1) o bajar (+1) una actividad entre las activas → { id: orden } para guardar (o null).
function mover(todas, id, delta) {
  const act = (todas || []).filter(a => !a.archivada);
  const i = act.findIndex(a => a.id === id), j = i + delta;
  if (i < 0 || j < 0 || j >= act.length) return null;
  const orden = act.map(a => a.id);
  [orden[i], orden[j]] = [orden[j], orden[i]];
  const out = {};
  orden.forEach((x, k) => { out[x] = k; });
  // Las archivadas quedan después.
  (todas || []).filter(a => a.archivada).forEach((a, k) => { out[a.id] = orden.length + k; });
  return out;
}
// Lo que se guarda de cada actividad (todas, para que el documento quede completo).
function paraGuardar(todas) {
  const out = {};
  (todas || []).forEach(a => {
    // desde: null si no se llena sola (al guardar con merge, borra el de antes).
    out[a.id] = { nombre: a.nombre, emoji: a.emoji, orden: a.orden, archivada: !!a.archivada, manana: a.manana !== false, fuente: a.fuente || "", desde: a.fuente && a.desde ? a.desde : null };
  });
  return out;
}
// El primer día con la versión nueva: guarda las actividades y, en las que
// se llenan solas, desde hoy (los días de antes no cambian).
function inicial(hoy) {
  return paraGuardar(lista(null).map(a => Object.assign({}, a, a.fuente ? { desde: hoy } : {})));
}
// Cambiar de dónde se llena sola: desde hoy (o nada).
const conFuente = (a, fuente, hoy) => Object.assign({}, a, { fuente: fuenteOk(fuente) ? fuente : "", desde: fuenteOk(fuente) ? (a.fuente === fuente && a.desde ? a.desde : hoy) : null });
const etiqueta = a => (a ? `${a.emoji ? `${a.emoji} ` : ""}${a.nombre}` : "");

return { BASE, FUENTES, EMOJIS, MAX, lista, activas, archivadas, pasosManana, validar, nuevoId, nueva, mover, paraGuardar, inicial, conFuente, etiqueta, emojiOk };
});
