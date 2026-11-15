// ---------- Libros: sesiones de lectura ("Leer ahora") y velocidad ----------
// Fase 4 (D-107). El cronómetro guarda marcas de tiempo (empezó, pausas) y
// no cuenta segundos: sigue bien con el teléfono bloqueado o la app
// cerrada (el estado vive en este teléfono). Al terminar, la sesión queda
// en el libro: sesiones: { id: { fecha, ini, fin, min, desde, hasta,
// unidad ("pag" | "pct"), lectura } }. Con eso: velocidad (páginas o % por
// hora), tiempo de lectura que falta, minutos por día y lo que Hábitos
// cuenta ("se marca solo").
// Sin DOM ni Firebase: tests/libros-sesiones.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./libros-progreso.js"));
  else root.LibrosSesiones = factory(root.LibrosProgreso);
})(typeof self !== "undefined" ? self : this, function (P) {
"use strict";

const MIN_MAX = 12 * 60;        // una sesión de hasta 12 horas
const fechaOk = f => /^\d{4}-\d{2}-\d{2}$/.test(f || "");
const r1 = n => Math.round(n * 10) / 10;

// ---- Cronómetro ----
// { v, libroId, uid, ini (ms), acumulado (ms en pausas anteriores), corre
// (desde cuándo corre, o null en pausa), desde (página o % al empezar), unidad }
function iniciar(libro, ahora, uid) {
  const m = P.medida(libro);
  return { v: 1, libroId: libro.id, uid: uid || null, ini: ahora, acumulado: 0, corre: ahora, desde: m.actual != null ? m.actual : 0, unidad: m.unidad };
}
const valido = st => !!st && st.v === 1 && typeof st.libroId === "string" && Number.isFinite(st.ini) && Number.isFinite(st.acumulado)
  && (st.corre == null || Number.isFinite(st.corre)) && (st.unidad === "pag" || st.unidad === "pct");
const enPausa = st => !!st && st.corre == null;
function transcurrido(st, ahora) {
  if (!st) return 0;
  return Math.max(0, (Number(st.acumulado) || 0) + (st.corre != null ? Math.max(0, ahora - st.corre) : 0));
}
const pausar = (st, ahora) => (!st || st.corre == null ? st : Object.assign({}, st, { acumulado: transcurrido(st, ahora), corre: null }));
const seguir = (st, ahora) => (!st || st.corre != null ? st : Object.assign({}, st, { corre: ahora }));
// 754000 → "12:34"; 3725000 → "1:02:05".
function reloj(ms) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const dos = n => String(n).padStart(2, "0");
  return h ? `${h}:${dos(m)}:${dos(x)}` : `${m}:${dos(x)}`;
}
// Los minutos que propone al terminar (al menos 1).
const minutosDe = ms => Math.max(1, Math.round(ms / 60000));

// ---- Terminar ----
// minutosTxt (lo que dejaste en "Minutos"), hasta (en la unidad del libro).
// → { ok, campo, error } o { ok, id, sesion }.
function cerrar(st, libro, minutosTxt, hasta, ahora, hoy) {
  const min = Number(String(minutosTxt == null ? "" : minutosTxt).trim().replace(",", "."));
  if (!(min >= 1 && min <= MIN_MAX)) return { ok: false, campo: "minutos", error: "Pon cuántos minutos leíste (de 1 a 720)." };
  const sesion = { fecha: hoy, ini: st.ini, fin: ahora, min: r1(min), desde: st.desde, hasta, unidad: st.unidad, lectura: P.lecturasDe(libro).length };
  return { ok: true, id: `s${Math.round(st.ini).toString(36)}`, sesion };
}

// ---- Sesiones guardadas ----
// → [{ id, fecha, ini, fin, min, desde, hasta, unidad, lectura, avance }] de la más vieja a la más nueva.
function sesionesDe(libro) {
  const s = libro && libro.sesiones;
  if (!s || typeof s !== "object") return [];
  return Object.keys(s).map(id => Object.assign({ id }, s[id]))
    .filter(x => fechaOk(x.fecha) && typeof x.min === "number" && x.min > 0 && x.min <= MIN_MAX)
    .map(x => Object.assign(x, { unidad: x.unidad === "pct" ? "pct" : "pag",
      avance: typeof x.desde === "number" && typeof x.hasta === "number" ? Math.max(0, r1(x.hasta - x.desde)) : 0 }))
    .sort((a, b) => (a.ini || 0) - (b.ini || 0) || a.id.localeCompare(b.id));
}
// Velocidad: páginas (o %) por hora con las sesiones en que avanzaste
// (hace falta haber leído al menos 5 minutos en total).
function velocidad(sesiones, unidad) {
  const xs = (sesiones || []).filter(x => x.unidad === unidad && x.avance > 0);
  const min = xs.reduce((s, x) => s + x.min, 0), avance = xs.reduce((s, x) => s + x.avance, 0);
  return { porHora: min >= 5 ? r1((avance / min) * 60) : null, min: r1(min), avance: r1(avance), n: xs.length };
}
// Un libro: sus sesiones, el tiempo leyendo, tu velocidad con él y cuánto
// tiempo de lectura le falta a esa velocidad.
function delLibro(libro, hoy) {
  const m = P.medida(libro);
  const ses = sesionesDe(libro);
  const v = velocidad(ses, m.unidad);
  const x = P.lectura(libro, hoy, 0);
  const faltaMin = v.porHora && x.faltan > 0 && libro.estado !== "terminado" ? Math.round((x.faltan / v.porHora) * 60) : null;
  return { sesiones: ses, n: ses.length, minutos: Math.round(ses.reduce((s, y) => s + y.min, 0)), velocidad: v.porHora, unidad: m.unidad, faltaMin };
}
// En general: páginas por hora con las sesiones de papel y digital de todos tus libros.
function general(libros) {
  const ses = [];
  (libros || []).forEach(l => sesionesDe(l).forEach(x => ses.push(x)));
  const v = velocidad(ses, "pag");
  return { porHora: v.porHora, sesiones: ses.length, minutos: Math.round(ses.reduce((s, x) => s + x.min, 0)) };
}
// Minutos leídos cada día (todas las sesiones): { fecha: min }.
function minutosPorDia(libros) {
  const out = {};
  (libros || []).forEach(l => sesionesDe(l).forEach(x => { out[x.fecha] = r1((out[x.fecha] || 0) + x.min); }));
  return out;
}
// Para Hábitos ("se marca solo"): { fecha: { paginas, min } }.
function porDiaHabitos(libros) {
  const pag = P.paginasPorDia(libros), min = minutosPorDia(libros);
  const out = {};
  Object.keys(pag).forEach(f => { out[f] = { paginas: pag[f], min: 0 }; });
  Object.keys(min).forEach(f => { out[f] = Object.assign(out[f] || { paginas: 0 }, { min: min[f] }); });
  return out;
}

// ---- Textos ----
// 45 → "45 min"; 65 → "1 h 05 min"; 180 → "3 h".
function duracion(min) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")} min` : `${h} h`;
}
// La velocidad para leer: "34 pág./hora" o "12 %/hora".
const textoVelocidad = (v, unidad) => (v ? `${String(v).replace(".", ",")} ${unidad === "pct" ? "%" : "pág."}/hora` : "");

return { MIN_MAX, iniciar, valido, enPausa, transcurrido, pausar, seguir, reloj, minutosDe, cerrar,
  sesionesDe, velocidad, delLibro, general, minutosPorDia, porDiaHabitos, duracion, textoVelocidad };
});
