// ---------- Medir tiempos ----------
// Cuánto tarda Juan cada día en sus actividades (las 6 de siempre y las que
// cree: js/tiempos-actividades.js). Promedio por semana (lunes a domingo),
// por mes y por día de la semana; los primeros 30 registros de cada
// actividad son su línea base (antes "promedio final"; se sigue midiendo:
// fase 6, D-113; nombre nuevo en la fase 7, D-114).
// Empezó provisoria (2026-10-29); desde la fase 6 es definitiva.
// Las funciones reciben la lista de actividades (acts); sin ella, las 6.
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
const idOk = id => /^[a-z0-9_-]{1,40}$/.test(id);
const listaDe = acts => (Array.isArray(acts) && acts.length ? acts : ACTIVIDADES);

// Documentos de Firestore (id = fecha) → días ordenados:
// [{ fecha, seg: { id: segundos }, auto?, noAuto? }] (auto: lo que llegó solo, fase 6).
function dias(docs) {
  return Object.keys(docs || {}).map(id => {
    const d = docs[id] || {};
    const fecha = fechaOk(d.fecha) ? d.fecha : id;
    const seg = {};
    Object.keys(d.seg && typeof d.seg === "object" ? d.seg : {}).forEach(k => { if (idOk(k) && segOk(d.seg[k])) seg[k] = Math.round(d.seg[k]); });
    const out = { fecha, seg };
    if (d.auto && typeof d.auto === "object" && Object.keys(d.auto).length) out.auto = d.auto;
    if (d.noAuto && typeof d.noAuto === "object" && Object.keys(d.noAuto).length) out.noAuto = d.noAuto;
    return out;
  }).filter(d => fechaOk(d.fecha) && Object.keys(d.seg).length).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}

// Registros que cuentan para la línea base, por actividad: los primeros 30 por fecha.
function contados(ds, acts) {
  const out = {}, lista = listaDe(acts);
  lista.forEach(a => { out[a.id] = []; });
  (ds || []).forEach(d => lista.forEach(a => {
    if (d.seg[a.id] && out[a.id].length < LIMITE) out[a.id].push({ fecha: d.fecha, seg: d.seg[a.id] });
  }));
  return out;
}

const promedio = lista => (lista.length ? Math.round(lista.reduce((s, r) => s + r.seg, 0) / lista.length) : null);

// Por actividad: cuántos registros lleva (de 30), su línea base y si ya
// llegó a 30; total: todos sus registros (se sigue midiendo después de los 30).
function estado(ds, acts) {
  const lista = listaDe(acts), c = contados(ds, lista), out = {};
  lista.forEach(a => {
    const n = c[a.id].length;
    out[a.id] = { n, faltan: LIMITE - n, completa: n >= LIMITE, promedio: promedio(c[a.id]), total: (ds || []).filter(d => d.seg[a.id]).length };
  });
  return out;
}

// (Hasta la fase 5) ¿Ya no se podía anotar esta actividad ese día? Desde
// la fase 6 se sigue midiendo después de los 30: la pantalla ya no la usa.
function bloqueada(ds, id, fecha) {
  const act = [{ id }];
  if (!estado(ds, act)[id].completa) return false;
  return !contados(ds, act)[id].some(r => r.fecha === fecha);
}

// "Tu promedio" (para Mi mañana y Medir ahora): el de tus últimos 30
// registros de cada actividad (cómo vienes ahora). → { id: segundos }
function promedios(ds, acts, n) {
  const out = {}, cuantos = n || LIMITE;
  listaDe(acts).forEach(a => {
    const rs = (ds || []).filter(d => d.seg[a.id]).slice(-cuantos).map(d => ({ seg: d.seg[a.id] }));
    if (rs.length) out[a.id] = promedio(rs);
  });
  return out;
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
const totalDia = d => Object.keys((d && d.seg) || {}).reduce((s, k) => s + (d.seg[k] > 0 ? d.seg[k] : 0), 0);
// Días anotados (con algo) entre desde y hasta (sin límites = todos) y el promedio de sus totales.
function promedioDias(ds, desde, hasta) {
  const dias = (ds || []).filter(d => (!desde || d.fecha >= desde) && (!hasta || d.fecha <= hasta) && totalDia(d) > 0);
  return { dias: dias.length, promedio: dias.length ? Math.round(dias.reduce((s, d) => s + totalDia(d), 0) / dias.length) : null };
}

// Promedio de cada actividad en la semana o el mes de `ref` (todos sus
// registros, también después de los 30: fase 6).
function periodo(ds, tipo, ref, hoy, acts) {
  const r = rango(tipo, ref), act = {}, lista = listaDe(acts);
  const dentro = (ds || []).filter(d => d.fecha >= r.desde && d.fecha <= r.hasta);
  lista.forEach(a => {
    const rs = dentro.filter(d => d.seg[a.id]).map(d => ({ fecha: d.fecha, seg: d.seg[a.id] }));
    act[a.id] = { n: rs.length, promedio: promedio(rs) };
  });
  return {
    tipo, desde: r.desde, hasta: r.hasta, act,
    dias: promedioDias(ds, r.desde, r.hasta),
    titulo: tituloRango(tipo, r, hoy || r.hasta),
    enCurso: !!hoy && hoy >= r.desde && hoy <= r.hasta,
    futuro: !!hoy && r.desde > hoy,
    hayDatos: lista.some(a => act[a.id].n > 0)
  };
}

// Promedio por día de la semana (pedido del dueño, 2026-11-06: "que tome
// un promedio de lo registrado en lunes y así"): todos los lunes
// registrados, todos los martes… De lunes a domingo, con cada actividad y
// el día todo junto. → [{ dow, nombre, corto, act: { id: { n, promedio } }, total: { dias, promedio } }]
const NOMBRES_DIA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const CORTOS_DIA = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
const diaSemana = f => fechaUtc(f).getUTCDay();
function porDiaSemana(ds, acts) {
  return [1, 2, 3, 4, 5, 6, 0].map(dow => {
    const delDia = (ds || []).filter(d => diaSemana(d.fecha) === dow);
    const act = {};
    listaDe(acts).forEach(a => {
      const rs = delDia.filter(d => d.seg[a.id]).map(d => ({ fecha: d.fecha, seg: d.seg[a.id] }));
      act[a.id] = { n: rs.length, promedio: promedio(rs) };
    });
    const conAlgo = delDia.filter(d => totalDia(d) > 0);
    const total = { dias: conAlgo.length, promedio: conAlgo.length ? Math.round(conAlgo.reduce((s2, d) => s2 + totalDia(d), 0) / conAlgo.length) : null };
    return { dow, nombre: NOMBRES_DIA[dow], corto: CORTOS_DIA[dow], act, total };
  });
}
// El día más largo y el más corto (con al menos 2 registros cada uno).
function extremosSemana(pd) {
  const con = (pd || []).filter(d => d.total.dias >= 2);
  if (con.length < 2) return null;
  const orden = con.slice().sort((a, b) => b.total.promedio - a.total.promedio);
  const largo = orden[0], corto = orden[orden.length - 1];
  if (largo.total.promedio === corto.total.promedio) return null;
  return { largo, corto, diferencia: largo.total.promedio - corto.total.promedio };
}
// 7500 → "2h05"; 2700 → "45m" (para las barras, donde no entra más).
function corto(s) {
  if (!segOk(s)) return "—";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

function fechaLarga(f) {
  if (!fechaOk(f)) return f || "";
  const d = fechaUtc(f);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

return { ACTIVIDADES, LIMITE, dias, contados, totalDia, promedioDias, estado, bloqueada, promedios, leer, campos, texto, lunes, rango, mover, periodo, fechaLarga,
  NOMBRES_DIA, diaSemana, porDiaSemana, extremosSemana, corto };
});
