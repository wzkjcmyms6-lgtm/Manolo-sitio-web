// ---------- Programación (sin pantalla) ----------
// Estancamiento por ejercicio y semana de descarga (fase 4); volumen
// semanal por músculo, equilibrio y generador de rutinas (fase 5).
// Todo por reglas, con los entrenos que la app ya tiene.
// Pruebas: tests/ej-programa.test.js. Fuentes: DECISIONS (D-094, D-095).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./ej-historial.js"));
  else root.EjPrograma = Object.assign(root.EjPrograma || {}, factory(root.EjHistorial));
})(typeof self !== "undefined" ? self : this, function (H) {
"use strict";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function addDias(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function lunes(iso) {
  const d = new Date(iso + "T12:00:00Z");
  return addDias(iso, -((d.getUTCDay() + 6) % 7));
}
const dias = (a, b) => H.diasEntre(a, b);
const kgTxt = n => `${String(Math.round(num(n) * 10) / 10).replace(".", ",")} kg`;

// ---- Estancamiento de un ejercicio ----
// sesiones: EjHistorial.sesiones (de la más vieja a la más nueva).
// Estancado si tu mejor 1RM estimado no mejoró en las últimas 3 sesiones o
// en 4 semanas (con al menos 2 sesiones desde entonces). Hace falta un
// mínimo de 4 sesiones. → null o { sesiones, semanas, mejor, fecha }
const UMBRAL_MEJORA = 1.005; // mejorar menos de 0,5 % no cuenta
function estancamiento(sesiones, hoy) {
  const s = (sesiones || []).filter(x => num(x.e1rm) > 0);
  if (s.length < 4) return null;
  let iMejor = 0;
  s.forEach((x, i) => { if (x.e1rm > s[iMejor].e1rm * UMBRAL_MEJORA) iMejor = i; });
  const despues = s.length - 1 - iMejor;
  const mejor = s[iMejor];
  const d = hoy ? dias(mejor.fecha, hoy) : 0;
  if (despues >= 3 || (d >= 28 && despues >= 2)) return { sesiones: despues, semanas: Math.floor(d / 7), mejor: mejor.e1rm, fecha: mejor.fecha };
  return null;
}
// Qué hacer cuando un ejercicio se estanca (2–3 frases cortas).
function sugerenciasEstancamiento(item, alternativa) {
  const it = item || {};
  const out = [];
  if (it.repsMax) {
    const nuevo = num(it.repsMax) <= 8 ? "10–12" : num(it.repsMin) >= 10 ? "6–8" : "5–7";
    out.push(`Cambia el rango de reps a ${nuevo} unas semanas.`);
  } else out.push("Cambia el rango de reps unas semanas (más pesado o más liviano).");
  if (alternativa) out.push(`Prueba una variante: ${alternativa}.`);
  out.push("O haz una semana de descarga y vuelve con fuerza.");
  return out;
}
function textoEstancamiento(e) {
  if (!e) return "";
  const t = e.semanas >= 4 ? `${e.semanas} semanas` : `${e.sesiones} sesiones`;
  return `Sin mejorar en ${t} (tu mejor 1RM estimado: ${kgTxt(e.mejor)}).`;
}

// ---- Semana de descarga ----
// descargas: { "AAAA-MM-DD" (desde): "AAAA-MM-DD" (hasta) }
function descargaActiva(descargas, hoy) {
  const d = descargas || {};
  const k = Object.keys(d).filter(desde => desde <= hoy && d[desde] >= hoy).sort().pop();
  return k ? { desde: k, hasta: d[k] } : null;
}
function ultimaDescarga(descargas, hoy) {
  const d = descargas || {};
  return Object.keys(d).filter(desde => desde <= hoy).sort().map(desde => ({ desde, hasta: d[desde] })).pop() || null;
}
// La semana de descarga empieza hoy y dura 7 días.
function nuevaDescarga(hoy) {
  return { desde: hoy, hasta: addDias(hoy, 6) };
}

// Señales que piden una descarga (se sugiere con 2 o más a la vez):
//  1. Rendimiento que cae: en 2+ ejercicios la última sesión (últimas 5
//     semanas) quedó ≥ 3 % por debajo del promedio de las 2 anteriores.
//  2. Esfuerzo que sube: RPE medio de las últimas 2 semanas ≥ 1 punto más que
//     las 2 anteriores, o RIR medio ≤ 0,5 (vas siempre al fallo).
//  3. Semanas seguidas de entrenamiento duro: 6+ semanas seguidas con 2 o
//     más entrenos y sin descarga.
// entrenos: [{ date, exercises, rpeSesion }]; idDe(ex) → id del ejercicio.
// opciones: { hoy, descargas, nombreDe(id) }
function senalesDescarga(entrenos, idDe, opciones) {
  const o = opciones || {};
  const hoy = o.hoy;
  const ult = ultimaDescarga(o.descargas, hoy);
  const desdeDescarga = ult ? ult.hasta : null;
  const lista = (entrenos || []).filter(w => w.date && w.date <= hoy && (!desdeDescarga || w.date > desdeDescarga))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : num(a.startedAt) - num(b.startedAt)));
  const senales = [];

  // 1. Rendimiento por ejercicio.
  const porEj = {};
  lista.filter(w => dias(w.date, hoy) <= 35).forEach(w => (w.exercises || []).forEach(ex => {
    const id = idDe(ex);
    if (!id) return;
    const sets = (ex.sets || []).filter(s => !s.calentamiento && num(s.kg) > 0 && num(s.reps) > 0);
    if (!sets.length) return;
    const rm = Math.max(...sets.map(s => H.e1rm(s.kg, s.reps, s.rir)));
    (porEj[id] = porEj[id] || []).push(rm);
  }));
  const caen = Object.keys(porEj).filter(id => {
    const v = porEj[id];
    if (v.length < 3) return false;
    const prev = (v[v.length - 2] + v[v.length - 3]) / 2;
    return v[v.length - 1] < prev * 0.97;
  });
  if (caen.length >= 2) {
    const nombres = caen.slice(0, 3).map(id => (o.nombreDe ? o.nombreDe(id) : id));
    senales.push({ id: "rendimiento", texto: `Tu fuerza bajó en ${nombres.join(" y ")}.` });
  }

  // 2. Esfuerzo (RPE de ejercicio o de la sesión, y RIR).
  const rpes = (desde, hasta) => {
    const v = [];
    lista.filter(w => w.date > desde && w.date <= hasta).forEach(w => {
      if (num(w.rpeSesion) > 0) v.push(num(w.rpeSesion));
      (w.exercises || []).forEach(ex => { if (num(ex.rpe) > 0) v.push(num(ex.rpe)); });
    });
    return v;
  };
  const media = v => v.reduce((a, b) => a + b, 0) / v.length;
  const r1 = rpes(addDias(hoy, -14), hoy), r0 = rpes(addDias(hoy, -28), addDias(hoy, -14));
  const rirs = [];
  lista.filter(w => dias(w.date, hoy) <= 14).forEach(w => (w.exercises || []).forEach(ex => (ex.sets || []).forEach(s => {
    if (!s.calentamiento && s.rir !== "" && s.rir != null) rirs.push(num(s.rir));
  })));
  if (r1.length >= 3 && r0.length >= 3 && media(r1) >= media(r0) + 1) {
    senales.push({ id: "esfuerzo", texto: `Tu esfuerzo subió (RPE ${String(Math.round(media(r0) * 10) / 10).replace(".", ",")} → ${String(Math.round(media(r1) * 10) / 10).replace(".", ",")}).` });
  } else if (rirs.length >= 4 && media(rirs) <= 0.5) {
    senales.push({ id: "esfuerzo", texto: "Vas casi siempre al fallo (RIR 0)." });
  }

  // 3. Semanas seguidas de entrenamiento duro.
  let semanas = 0;
  for (let l = lunes(hoy); ; l = addDias(l, -7)) {
    const n = lista.filter(w => w.date >= l && w.date <= addDias(l, 6)).length;
    const actual = l === lunes(hoy);
    if (n >= 2) semanas++;
    else if (!actual) break; // la semana en curso puede estar a medias
    if (semanas > 52) break;
  }
  if (semanas >= 6) senales.push({ id: "semanas", texto: `Llevas ${semanas} semanas seguidas entrenando sin descarga.` });

  const reciente = ult && dias(ult.hasta, hoy) < 28;
  return { sugerir: senales.length >= 2 && !reciente && !descargaActiva(o.descargas, hoy), senales, semanas };
}

return { addDias, lunes, estancamiento, sugerenciasEstancamiento, textoEstancamiento, descargaActiva, ultimaDescarga, nuevaDescarga, senalesDescarga };
});
