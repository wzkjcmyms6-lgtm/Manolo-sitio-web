// ---------- Medir tiempos: estadísticas, línea base y experimentos (fase 7, D-114) ----------
// Por actividad: promedio, mediana, mejor y peor, tendencia (últimos 30
// días contra los 30 anteriores; menos tiempo = mejor), días de semana
// contra fin de semana, y el total de tu mañana por día.
// Línea base: tus primeros 30 registros de cada actividad (antes "promedio
// final"). Un experimento: desde el día que elijas, los 30 registros
// siguientes de cada actividad, comparados con la línea base (p. ej.
// después de cambiar algo en tu rutina).
// Sin DOM: tests/tiempos-stats.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TiemposStats = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const LIMITE = 30;
const fechaOk = f => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
const utc = f => new Date(f + "T12:00:00Z");
const sumarDias = (f, n) => { const d = utc(f); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diaSemana = f => utc(f).getUTCDay();
const media = xs => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
function mediana(xs) {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
// [{ fecha, seg }] de una actividad, por fecha.
const registros = (ds, id) => (ds || []).filter(d => d.seg && d.seg[id] > 0).map(d => ({ fecha: d.fecha, seg: d.seg[id] }));
const resumir = rs => { const segs = rs.map(r => r.seg); return { n: rs.length, promedio: media(segs), mediana: mediana(segs) }; };

// ---- Estadísticas de una actividad ----
function actividad(ds, id, hoy) {
  const rs = registros(ds, id);
  if (!rs.length) return null;
  const mejor = rs.reduce((m, r) => (r.seg < m.seg ? r : m), rs[0]);
  const peor = rs.reduce((m, r) => (r.seg > m.seg ? r : m), rs[0]);
  const ult = rs.filter(r => r.fecha > sumarDias(hoy, -30) && r.fecha <= hoy).map(r => r.seg);
  const ant = rs.filter(r => r.fecha > sumarDias(hoy, -60) && r.fecha <= sumarDias(hoy, -30)).map(r => r.seg);
  let tendencia = null;
  if (ult.length >= 3 && ant.length >= 3) {
    const antes = media(ant), ahora = media(ult), cambio = Math.round(((ahora - antes) / antes) * 100);
    tendencia = { antes, ahora, cambio, sentido: cambio <= -5 ? "mejor" : cambio >= 5 ? "peor" : "igual" };
  }
  const lab = rs.filter(r => { const x = diaSemana(r.fecha); return x >= 1 && x <= 5; }).map(r => r.seg);
  const finde = rs.filter(r => { const x = diaSemana(r.fecha); return x === 0 || x === 6; }).map(r => r.seg);
  return Object.assign({ id, mejor, peor, tendencia,
    semana: { laborables: { n: lab.length, promedio: media(lab) }, finde: { n: finde.length, promedio: media(finde) } } }, resumir(rs));
}
function estadisticas(ds, acts, hoy) {
  const out = {};
  (acts || []).forEach(a => { const x = actividad(ds, a.id, hoy); if (x) out[a.id] = x; });
  return out;
}

// El total de tu mañana por día (la suma de tus pasos de la mañana), los
// últimos `n` días que tienen alguno → [{ fecha, total }].
function mananaPorDia(ds, ids, n) {
  return (ds || []).map(d => ({ fecha: d.fecha, total: (ids || []).reduce((s, id) => s + (d.seg[id] || 0), 0) }))
    .filter(x => x.total > 0).slice(-(n || LIMITE));
}

// ---- Línea base y experimentos ----
function lineaBase(ds, id) {
  const rs = registros(ds, id).slice(0, LIMITE);
  return Object.assign({ completa: rs.length >= LIMITE, desde: rs.length ? rs[0].fecha : null, hasta: rs.length ? rs[rs.length - 1].fecha : null }, resumir(rs));
}
// exp: { nombre, desde, hasta? (si lo terminaste antes), actividades? (ids; sin ella, todas) }
function experimento(ds, exp, acts) {
  const ids = (exp.actividades && exp.actividades.length ? exp.actividades : (acts || []).map(a => a.id));
  const act = {};
  ids.forEach(id => {
    const rs = registros(ds, id).filter(r => r.fecha >= exp.desde && (!exp.hasta || r.fecha <= exp.hasta)).slice(0, LIMITE);
    const base = lineaBase(ds, id), x = resumir(rs);
    // La base que comparas no puede pisar el experimento: solo días de antes.
    const baseAntes = resumir(registros(ds, id).filter(r => r.fecha < exp.desde).slice(0, LIMITE));
    const ref = base.hasta && base.hasta < exp.desde ? base : baseAntes;
    const diferencia = x.mediana != null && ref.mediana != null ? x.mediana - ref.mediana : null;
    act[id] = Object.assign({ completa: rs.length >= LIMITE, base: { n: ref.n, promedio: ref.promedio, mediana: ref.mediana }, diferencia,
      pct: diferencia != null && ref.mediana ? Math.round((diferencia / ref.mediana) * 100) : null }, x);
  });
  const con = Object.keys(act).filter(id => act[id].n);
  return { nombre: exp.nombre, desde: exp.desde, hasta: exp.hasta || null, act, terminado: !!exp.hasta || (con.length > 0 && con.every(id => act[id].completa)) };
}
function validarExperimento(datos, hoy) {
  const nombre = String(datos.nombre || "").replace(/\s+/g, " ").trim();
  if (!nombre) return { ok: false, error: "Ponle un nombre (qué cambiaste)." };
  if (nombre.length > 60) return { ok: false, error: "Máximo 60 letras." };
  const desde = String(datos.desde || "").trim();
  if (!fechaOk(desde)) return { ok: false, error: "Elige desde qué día." };
  if (desde > hoy) return { ok: false, error: "No puede empezar en el futuro." };
  return { ok: true, doc: { nombre, desde, nota: String(datos.nota || "").trim().slice(0, 300), hasta: null } };
}

return { LIMITE, mediana, media, registros, actividad, estadisticas, mananaPorDia, lineaBase, experimento, validarExperimento };
});
