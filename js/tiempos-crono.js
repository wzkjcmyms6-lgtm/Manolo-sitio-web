// ---------- Medir tiempos: cronómetro y "Mi mañana" (fase 6, D-113) ----------
// Todo por marcas de tiempo (no por un contador que corre): si el iPhone
// se bloquea o cierras la app, al volver el tiempo sigue bien. El estado
// se guarda en el teléfono (localStorage) y los segundos, en tiempos/{fecha}
// al terminar cada paso.
//  - Medir ahora: un cronómetro para una actividad (pausar y seguir).
//  - Mi mañana: tus pasos en tu orden; "Siguiente" cierra uno y abre el
//    otro; puedes pausar o saltar; al final, el resumen contra tu promedio.
// Sin DOM: tests/tiempos-crono.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TiemposCrono = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const MAX_MS = 12 * 3600 * 1000;      // un cronómetro olvidado no pasa de 12 horas
const num = v => typeof v === "number" && isFinite(v);
const fechaOk = f => /^\d{4}-\d{2}-\d{2}$/.test(f || "");

// ---- Un cronómetro: { id, fecha, inicio, pausa (o null), pausado (ms) } ----
const iniciar = (id, fecha, ahora) => ({ v: 1, id, fecha, inicio: ahora, pausa: null, pausado: 0 });
function transcurrido(c, ahora) {
  if (!c) return 0;
  const hasta = c.pausa != null ? c.pausa : ahora;
  return Math.min(MAX_MS, Math.max(0, hasta - c.inicio - (c.pausado || 0)));
}
const segundos = (c, ahora) => Math.round(transcurrido(c, ahora) / 1000);
const enPausa = c => !!c && c.pausa != null;
const pausar = (c, ahora) => (c && c.pausa == null ? Object.assign({}, c, { pausa: ahora }) : c);
const seguir = (c, ahora) => (c && c.pausa != null ? Object.assign({}, c, { pausado: (c.pausado || 0) + Math.max(0, ahora - c.pausa), pausa: null }) : c);
// 65000 → "1:05"; 3725000 → "1:02:05".
function reloj(ms) {
  const s = Math.floor(Math.max(0, ms) / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
}
// ¿Lo guardado en el teléfono sirve todavía? (de hoy, o de ayer si empezó hace menos de 12 h).
function cronoValido(c, hoy, ahora) {
  if (!c || c.v !== 1 || typeof c.id !== "string" || !fechaOk(c.fecha) || !num(c.inicio)) return false;
  if (c.pausa != null && !num(c.pausa)) return false;
  return c.fecha === hoy || ahora - c.inicio < MAX_MS;
}

// ---- Mi mañana ----
// { v, fecha, pasos: [ids], i, paso: cronómetro del paso actual, hechos: { id: seg }, saltados: [ids], inicio, fin }
function empezar(pasos, fecha, ahora) {
  const ps = (pasos || []).filter(p => typeof p === "string");
  if (!ps.length) return null;
  return { v: 1, fecha, pasos: ps, i: 0, paso: iniciar(ps[0], fecha, ahora), hechos: {}, saltados: [], inicio: ahora, fin: null };
}
const actual = m => (m && m.fin == null && m.pasos[m.i]) || null;
const terminada = m => !!m && m.fin != null;
function avanzar(m, ahora, guardar) {
  if (!m || m.fin != null) return { m, cerrado: null };
  const id = m.pasos[m.i];
  const seg = segundos(m.paso, ahora);
  const hechos = Object.assign({}, m.hechos), saltados = m.saltados.slice();
  let cerrado = null;
  if (guardar && seg >= 1) { hechos[id] = seg; cerrado = { id, seg }; }
  else saltados.push(id);
  const i = m.i + 1;
  const fin = i >= m.pasos.length ? ahora : null;
  return { m: Object.assign({}, m, { i, hechos, saltados, fin, paso: fin == null ? iniciar(m.pasos[i], m.fecha, ahora) : null }), cerrado };
}
// "Siguiente": cierra el paso (sus segundos, para guardar) y abre el otro.
const siguiente = (m, ahora) => avanzar(m, ahora, true);
// "Saltar": hoy no lo hiciste; no se guarda nada.
const saltar = (m, ahora) => avanzar(m, ahora, false);
const pausarManana = (m, ahora) => (m && m.paso ? Object.assign({}, m, { paso: pausar(m.paso, ahora) }) : m);
const seguirManana = (m, ahora) => (m && m.paso ? Object.assign({}, m, { paso: seguir(m.paso, ahora) }) : m);
// "Terminar" antes del último paso: guarda el que va y salta el resto.
function terminar(m, ahora) {
  let x = siguiente(m, ahora);
  const cerrado = x.cerrado;
  while (x.m && x.m.fin == null) x = saltar(x.m, ahora);
  return { m: x.m, cerrado };
}
function mananaValida(m, hoy, ahora) {
  if (!m || m.v !== 1 || !fechaOk(m.fecha) || !Array.isArray(m.pasos) || !m.pasos.length || !Number.isInteger(m.i) || !num(m.inicio)) return false;
  if (m.fin == null && !cronoValido(m.paso, hoy, ahora)) return false;
  return m.fecha === hoy || ahora - m.inicio < MAX_MS;
}
// ¿El paso actual ya pasó tu promedio? → { pasado, falta (ms; negativo = pasado) } o null si no hay promedio.
function contraPromedio(m, promedios, ahora) {
  const id = actual(m), p = id && promedios ? promedios[id] : null;
  if (!p) return null;
  const ms = transcurrido(m.paso, ahora), falta = p * 1000 - ms;
  return { pasado: falta < 0, falta, promedio: p };
}
// Al final: cada paso contra tu promedio (segundos; + = tardaste más) y el total.
function resumen(m, promedios) {
  const pr = promedios || {};
  const pasos = (m ? m.pasos : []).map(id => {
    const seg = m.hechos[id] || null, prom = pr[id] || null;
    return { id, seg, saltado: !seg, promedio: prom, diferencia: seg && prom ? seg - prom : null };
  });
  const hechos = pasos.filter(p => p.seg);
  const total = hechos.reduce((s, p) => s + p.seg, 0);
  const conProm = hechos.filter(p => p.promedio);
  const totalPromedio = conProm.length ? conProm.reduce((s, p) => s + p.promedio, 0) : null;
  const totalConProm = conProm.reduce((s, p) => s + p.seg, 0);
  return { pasos, total, hechos: hechos.length, saltados: pasos.length - hechos.length, totalPromedio, diferencia: totalPromedio != null ? totalConProm - totalPromedio : null };
}

return { MAX_MS, iniciar, transcurrido, segundos, enPausa, pausar, seguir, reloj, cronoValido,
  empezar, actual, terminada, siguiente, saltar, pausarManana, seguirManana, terminar, mananaValida, contraPromedio, resumen };
});
