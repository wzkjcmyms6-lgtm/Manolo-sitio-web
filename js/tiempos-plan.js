// ---------- Medir tiempos: plan de la mañana (fase 7, D-114) ----------
// Pones a qué hora te levantas y a qué hora tienes que estar listo; con tus
// medianas (últimos 30 registros de cada paso) se arma la línea de tiempo
// de tu mañana para ese día de la semana (los pasos que sueles hacer ese
// día). Dice si te sobra o te falta tiempo, dónde se te va más y dónde
// podrías ahorrar (tu mediana contra tus mejores días).
// Sin DOM: tests/tiempos-plan.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TiemposPlan = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const N = 30;
const horaOk = h => typeof h === "string" && /^([01]?\d|2[0-3]):[0-5]\d$/.test(h);
const aSeg = h => { const [a, b] = h.split(":").map(Number); return a * 3600 + b * 60; };
function aHora(s) {
  const t = ((Math.round(s / 60) % 1440) + 1440) % 1440;
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
const diaSemana = f => new Date(f + "T12:00:00Z").getUTCDay();
function mediana(xs) {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// Tus medianas y tus mejores tiempos (de los últimos 30 registros) → { id: { mediana, mejor, n } }.
function tiempos(ds, ids) {
  const out = {};
  (ids || []).forEach(id => {
    const segs = (ds || []).filter(d => d.seg && d.seg[id] > 0).map(d => d.seg[id]).slice(-N);
    if (segs.length) out[id] = { mediana: mediana(segs), mejor: Math.min(...segs), n: segs.length };
  });
  return out;
}
// Qué pasos sueles hacer ese día de la semana: los que anotaste en al
// menos la mitad de esos días (contando los días con algo de la mañana).
// Sin historia de ese día, todos.
function pasosDelDia(ds, ids, dow) {
  const dias = (ds || []).filter(d => diaSemana(d.fecha) === dow && (ids || []).some(id => d.seg[id] > 0)).slice(-12);
  if (dias.length < 2) return (ids || []).slice();
  return (ids || []).filter(id => dias.filter(d => d.seg[id] > 0).length * 2 >= dias.length);
}

function validar(cfg) {
  const c = cfg || {};
  if (!horaOk(c.levantarse) || !horaOk(c.listo)) return { ok: false, error: "Pon las dos horas (por ejemplo 5:30 y 8:00)." };
  if (aSeg(c.listo) <= aSeg(c.levantarse)) return { ok: false, error: "La hora de estar listo tiene que ser después de levantarte." };
  return { ok: true, plan: { levantarse: c.levantarse, listo: c.listo } };
}

// La línea de tiempo. cfg: { levantarse, listo }; pasos: [{ id, nombre }]
// en orden; t: tiempos(ds, ids). Un paso sin datos todavía cuenta 0 (y se avisa).
function plan(cfg, pasos, t) {
  const v = validar(cfg);
  if (!v.ok) return v;
  let s = aSeg(cfg.levantarse);
  const linea = (pasos || []).map(p => {
    const x = t && t[p.id], seg = x ? x.mediana : 0;
    const paso = { id: p.id, nombre: p.nombre, desde: aHora(s), seg, sinDatos: !x };
    s += seg;
    paso.hasta = aHora(s);
    return paso;
  });
  const disponible = aSeg(cfg.listo) - aSeg(cfg.levantarse);
  const necesario = linea.reduce((a, p) => a + p.seg, 0);
  const conDatos = linea.filter(p => !p.sinDatos && p.seg > 0);
  const mayor = conDatos.slice().sort((a, b) => b.seg - a.seg)[0] || null;
  // Dónde podrías ahorrar: el paso con más distancia entre tu mediana y tus mejores días.
  const ahorros = conDatos.map(p => ({ id: p.id, nombre: p.nombre, seg: p.seg - t[p.id].mejor, mejor: t[p.id].mejor })).filter(a => a.seg >= 60).sort((a, b) => b.seg - a.seg);
  return {
    ok: true, linea, disponible, necesario, sobra: disponible - necesario,
    termina: aHora(aSeg(cfg.levantarse) + necesario), listo: cfg.listo,
    mayor: mayor ? { id: mayor.id, nombre: mayor.nombre, seg: mayor.seg, pct: necesario ? Math.round((mayor.seg / necesario) * 100) : 0 } : null,
    ahorro: ahorros[0] || null, faltanDatos: linea.filter(p => p.sinDatos).map(p => p.id)
  };
}
// Mi mañana contra tu plan. horaSeg: la hora real (segundos desde la
// medianoche, del teléfono) a la que cerraste el paso `id`.
// → segundos de atraso (+) o de adelanto (−) contra la hora que tenía en tu
// plan; null si ese paso no está en el plan de hoy.
function adelanto(pl, id, horaSeg) {
  const p = pl && pl.ok ? pl.linea.find(x => x.id === id) : null;
  return p ? horaSeg - aSeg(p.hasta) : null;
}
// En vivo: estás en el paso `id` y son las `horaSeg`. Según el plan ese
// paso va de "desde" a "hasta": antes de "desde" vas adelantado (−),
// después de "hasta" vas atrasado (+); en el medio, a tiempo (0).
function vsAhora(pl, id, horaSeg) {
  const p = pl && pl.ok ? pl.linea.find(x => x.id === id) : null;
  if (!p) return null;
  const desde = aSeg(p.desde), hasta = aSeg(p.hasta);
  return horaSeg < desde ? horaSeg - desde : horaSeg > hasta ? horaSeg - hasta : 0;
}
// Al final: ¿a qué hora terminaste contra tu hora de estar listo? (+ = tarde).
const contraListo = (cfg, horaSeg) => (cfg && horaOk(cfg.listo) ? horaSeg - aSeg(cfg.listo) : null);

return { horaOk, aSeg, aHora, mediana, tiempos, pasosDelDia, validar, plan, adelanto, vsAhora, contraListo };
});
