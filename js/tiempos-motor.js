// ---------- Medir tiempos (sección provisoria) ----------
// Cuánto tarda Juan cada día en su rutina de la mañana, ejercicio, correr,
// desayunar, bañarse y leer 30 páginas. Promedio por semana (lunes a
// domingo) y por mes; con 30 registros de una actividad, se cierra y ese es
// su promedio final. Pedido del dueño 2026-10-29: "no muy bien hecha, la
// borraremos más adelante" (ver docs/TIEMPOS.md, "Cómo borrarla").
// Sin DOM ni Firebase: tests/tiempos-motor.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TiemposMotor = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const ACTIVIDADES = [
  { id: "manana", nombre: "Rutina de la mañana", detalle: "Levantarse, lavarse los dientes, scalping, rezar, decretar y tender la cama" },
  { id: "ejercicio", nombre: "Ejercicio" },
  { id: "correr", nombre: "Correr" },
  { id: "desayunar", nombre: "Desayunar" },
  { id: "banarse", nombre: "Bañarse y alistarse" },
  { id: "leer", nombre: "Leer 30 páginas" }
];
const LIMITE = 30;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const fechaOk = f => /^\d{4}-\d{2}-\d{2}$/.test(f || "") && !isNaN(new Date(f + "T12:00:00Z").getTime());
const fechaUtc = f => new Date(f + "T12:00:00Z");
const iso = d => d.toISOString().slice(0, 10);
const segOk = s => typeof s === "number" && isFinite(s) && s > 0;

// Documentos de Firestore (id = fecha) → días ordenados: [{ fecha, seg: { id: segundos } }].
function dias(docs) {
  return Object.keys(docs || {}).map(id => {
    const d = docs[id] || {};
    const fecha = fechaOk(d.fecha) ? d.fecha : id;
    const seg = {};
    ACTIVIDADES.forEach(a => { if (d.seg && segOk(d.seg[a.id])) seg[a.id] = Math.round(d.seg[a.id]); });
    return { fecha, seg };
  }).filter(d => fechaOk(d.fecha) && Object.keys(d.seg).length).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}

// Registros que cuentan, por actividad: los primeros 30 por fecha.
function contados(ds) {
  const out = {};
  ACTIVIDADES.forEach(a => { out[a.id] = []; });
  (ds || []).forEach(d => ACTIVIDADES.forEach(a => {
    if (d.seg[a.id] && out[a.id].length < LIMITE) out[a.id].push({ fecha: d.fecha, seg: d.seg[a.id] });
  }));
  return out;
}

const promedio = lista => (lista.length ? Math.round(lista.reduce((s, r) => s + r.seg, 0) / lista.length) : null);

// Por actividad: cuántos registros lleva (de 30), su promedio y si ya se cerró.
function estado(ds) {
  const c = contados(ds), out = {};
  ACTIVIDADES.forEach(a => {
    const n = c[a.id].length;
    out[a.id] = { n, faltan: LIMITE - n, completa: n >= LIMITE, promedio: promedio(c[a.id]) };
  });
  return out;
}

// ¿Ya no se puede anotar esta actividad ese día? (cerrada y ese día no la tenía;
// un registro que ya cuenta se puede corregir).
function bloqueada(ds, id, fecha) {
  if (!estado(ds)[id].completa) return false;
  return !contados(ds)[id].some(r => r.fecha === fecha);
}

// Minutos y segundos escritos → { seg } (null si los dos están vacíos) o { error }.
function leer(min, seg) {
  const m = String(min == null ? "" : min).trim(), s = String(seg == null ? "" : seg).trim();
  if (!m && !s) return { seg: null };
  if ((m && !/^\d{1,3}$/.test(m)) || (s && !/^\d{1,2}$/.test(s))) return { error: "Usa solo números: minutos y segundos." };
  const mm = Number(m || 0), ss = Number(s || 0);
  if (ss > 59) return { error: "Los segundos van de 0 a 59." };
  if (mm > 600) return { error: "Revisa los minutos (máximo 600)." };
  if (mm === 0 && ss === 0) return { error: "El tiempo tiene que ser mayor que cero." };
  return { seg: mm * 60 + ss };
}

// Segundos → campos para editar: { min: "25", seg: "30" }.
function campos(s) {
  if (!segOk(s)) return { min: "", seg: "" };
  return { min: String(Math.floor(s / 60)), seg: s % 60 ? String(s % 60) : "" };
}

// 45 → "45 s"; 1530 → "25 min 30 s"; 3900 → "1 h 05 min".
function texto(s) {
  if (!segOk(s)) return "—";
  s = Math.round(s);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`;
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return m === 60 ? `${h + 1} h` : `${h} h${m ? ` ${String(m).padStart(2, "0")} min` : ""}`;
}

function lunes(f) {
  const d = fechaUtc(f);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return iso(d);
}
function sumarDias(f, n) {
  const d = fechaUtc(f);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

// Semana (lunes a domingo) o mes que contiene `ref`.
function rango(tipo, ref) {
  if (tipo === "mes") {
    const a = Number(ref.slice(0, 4)), m = Number(ref.slice(5, 7));
    const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
    return { desde: `${ref.slice(0, 7)}-01`, hasta: `${ref.slice(0, 7)}-${String(ultimo).padStart(2, "0")}` };
  }
  const desde = lunes(ref);
  return { desde, hasta: sumarDias(desde, 6) };
}

// La semana o el mes anterior (delta -1) o siguiente (+1).
function mover(tipo, ref, delta) {
  if (tipo === "mes") {
    const a = Number(ref.slice(0, 4)), m = Number(ref.slice(5, 7)) - 1 + delta;
    const d = new Date(Date.UTC(a, m, 1));
    return iso(d);
  }
  return sumarDias(lunes(ref), 7 * delta);
}

function tituloRango(tipo, r, hoy) {
  if (tipo === "mes") {
    const t = `${MESES[Number(r.desde.slice(5, 7)) - 1]} ${r.desde.slice(0, 4)}`;
    return t[0].toUpperCase() + t.slice(1);
  }
  const d = fechaUtc(r.desde), h = fechaUtc(r.hasta);
  const corto = x => `${x.getUTCDate()} ${MESES_CORTOS[x.getUTCMonth()]}`;
  return `${corto(d)} – ${corto(h)}${h.getUTCFullYear() !== fechaUtc(hoy).getUTCFullYear() ? ` ${h.getUTCFullYear()}` : ""}`;
}

// Total de un día: la suma de todo lo que anotaste ese día (2026-10-30:
// "que se registren los días y se haga un promedio de los días").
const totalDia = d => ACTIVIDADES.reduce((s, a) => s + (d && d.seg && d.seg[a.id] > 0 ? d.seg[a.id] : 0), 0);
// Días anotados (con algo) entre desde y hasta (sin límites = todos) y el promedio de sus totales.
function promedioDias(ds, desde, hasta) {
  const dias = (ds || []).filter(d => (!desde || d.fecha >= desde) && (!hasta || d.fecha <= hasta) && totalDia(d) > 0);
  return { dias: dias.length, promedio: dias.length ? Math.round(dias.reduce((s, d) => s + totalDia(d), 0) / dias.length) : null };
}

// Promedio de cada actividad en la semana o el mes de `ref` (solo registros que cuentan).
function periodo(ds, tipo, ref, hoy) {
  const r = rango(tipo, ref), c = contados(ds), act = {};
  ACTIVIDADES.forEach(a => {
    const dentro = c[a.id].filter(x => x.fecha >= r.desde && x.fecha <= r.hasta);
    act[a.id] = { n: dentro.length, promedio: promedio(dentro) };
  });
  return {
    tipo, desde: r.desde, hasta: r.hasta, act,
    dias: promedioDias(ds, r.desde, r.hasta),
    titulo: tituloRango(tipo, r, hoy || r.hasta),
    enCurso: !!hoy && hoy >= r.desde && hoy <= r.hasta,
    futuro: !!hoy && r.desde > hoy,
    hayDatos: ACTIVIDADES.some(a => act[a.id].n > 0)
  };
}

function fechaLarga(f) {
  if (!fechaOk(f)) return f || "";
  const d = fechaUtc(f);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

return { ACTIVIDADES, LIMITE, dias, contados, totalDia, promedioDias, estado, bloqueada, leer, campos, texto, lunes, rango, mover, periodo, fechaLarga };
});
