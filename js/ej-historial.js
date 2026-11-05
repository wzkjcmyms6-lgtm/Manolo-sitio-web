// ---------- Historial de un ejercicio (ficha) — sin pantalla ----------
// Con los entrenos que la app ya tiene cargados (sin lecturas nuevas):
// sesiones del ejercicio, 1RM estimado, mejor serie, volumen por sesión,
// récords por repeticiones (1RM a 12RM), última vez y alternativas con los
// mismos músculos. También los enlaces de YouTube (búsqueda y "Mi video").
// Pruebas: tests/ej-historial.test.js. Fórmulas: docs/EJERCICIO_INTELIGENTE.md.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EjHistorial = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const TOPE_REPS = 12; // Epley se vuelve poco fiable con muchas reps (igual que Rangos)
const MAX_RM = 12;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
const r1 = n => Math.round(n * 10) / 10;

// 1RM estimado (Epley): kg × (1 + reps / 30); con 1 rep es el propio peso.
// Si anotaste RIR (reps en reserva), cuenta como si hubieras llegado a
// reps + RIR. Las reps se topan en 12.
function e1rm(kg, reps, rir) {
  const k = num(kg), r = num(reps) + Math.max(0, num(rir));
  if (!(k > 0) || !(num(reps) > 0)) return 0;
  const rr = Math.min(TOPE_REPS, r);
  return rr <= 1 ? k : k * (1 + rr / 30);
}
// Peso que se puede levantar para n reps según un 1RM (Epley al revés).
function pesoPara(rm, n) {
  if (!(rm > 0) || !(n > 0)) return 0;
  return n <= 1 ? rm : rm / (1 + Math.min(TOPE_REPS, n) / 30);
}

// Carga real de una serie según el tipo de ejercicio:
// carga → kg; peso corporal → peso × factor + lastre (o − asistencia).
function cargaSerie(s, tipo, opciones) {
  const o = opciones || {};
  if (tipo === "peso_corporal") {
    const pc = num(o.pesoCorporal) * (o.factor != null ? num(o.factor) : 1);
    return Math.max(0, pc + num(s.kg) - num(s.asistencia));
  }
  return num(s.kg);
}
const deTrabajo = s => !s.calentamiento && (num(s.reps) > 0 || num(s.seg) > 0);

// Sesiones del ejercicio, de la más vieja a la más nueva.
// entrenos: [{ id, date, startedAt, exercises: [...] }]
// mismo(ex) → true si ese ejercicio guardado es este.
// opciones: { tipo, factor, pesoEn(fecha) → kg del cuerpo ese día }
function sesiones(entrenos, mismo, opciones) {
  const o = opciones || {};
  const tipo = o.tipo || "carga";
  const out = [];
  (entrenos || []).forEach(w => {
    (w.exercises || []).filter(mismo).forEach(ex => {
      const series = (ex.sets || []).filter(deTrabajo);
      const min = num(ex.minutos);
      if (!series.length && !(min > 0)) return;
      const pc = o.pesoEn ? num(o.pesoEn(w.date)) : num(o.pesoCorporal);
      let mejor = null, volumen = 0, reps = 0, maxKg = 0, maxReps = 0, maxSeg = 0;
      series.forEach(s => {
        const carga = cargaSerie(s, tipo, { pesoCorporal: pc, factor: o.factor });
        const rm = e1rm(carga, s.reps, s.rir);
        volumen += carga * num(s.reps);
        reps += num(s.reps);
        maxKg = Math.max(maxKg, num(s.kg));
        maxReps = Math.max(maxReps, num(s.reps));
        maxSeg = Math.max(maxSeg, num(s.seg));
        if (!mejor || rm > mejor.e1rm || (rm === mejor.e1rm && num(s.kg) > num(mejor.kg)))
          mejor = { kg: num(s.kg), reps: num(s.reps), carga, e1rm: rm };
      });
      out.push({
        id: w.id, fecha: w.date, startedAt: num(w.startedAt), series: series.length, reps,
        volumen: Math.round(volumen), e1rm: mejor ? r1(mejor.e1rm) : 0, mejor, maxKg, maxReps, maxSeg, minutos: min,
        sets: series
      });
    });
  });
  return out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.startedAt - b.startedAt));
}

// Récords por repeticiones: para n = 1…12, el mayor peso con el que hiciste
// al menos n reps (real) y lo que tu mejor 1RM estimado dice que podrías
// (estimado). Con { kg, fecha } o null.
function recordsPorReps(lista) {
  const out = [];
  let mejorRm = 0;
  (lista || []).forEach(s => { if (s.e1rm > mejorRm) mejorRm = s.e1rm; });
  for (let n = 1; n <= MAX_RM; n++) {
    let real = null;
    (lista || []).forEach(ses => (ses.sets || []).forEach(x => {
      if (num(x.reps) >= n && num(x.kg) > 0 && (!real || num(x.kg) > real.kg)) real = { kg: num(x.kg), fecha: ses.fecha };
    }));
    out.push({ reps: n, real, estimado: mejorRm ? r1(pesoPara(mejorRm, n)) : 0 });
  }
  return out;
}

// Resumen para la cabecera del historial.
function resumen(lista, hoy) {
  if (!lista || !lista.length) return null;
  const ult = lista[lista.length - 1];
  const mejor = lista.reduce((a, s) => (s.e1rm > a.e1rm ? s : a), lista[0]);
  const masVol = lista.reduce((a, s) => (s.volumen > a.volumen ? s : a), lista[0]);
  return {
    sesiones: lista.length,
    ultima: ult.fecha,
    diasDesde: hoy ? diasEntre(ult.fecha, hoy) : null,
    mejorE1rm: mejor.e1rm, mejorFecha: mejor.fecha, mejorSerie: mejor.mejor,
    maxVolumen: masVol.volumen,
    maxReps: Math.max(...lista.map(s => s.maxReps)),
    maxSeg: Math.max(...lista.map(s => s.maxSeg))
  };
}
function diasEntre(a, b) {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
}

// Alternativas: comparten al menos un músculo principal; puntúa el parecido
// de principales (Jaccard × 2) y de los que ayudan, prefiere los destacados
// y el mismo tipo de movimiento (patronDe) y, si se pasa, solo el equipo
// disponible. base: [ficha]; destacados: Set de ids.
function alternativas(ficha, base, opciones) {
  const o = Object.assign({ limite: 5 }, opciones || {});
  if (!ficha) return [];
  const P = new Set(ficha.primarios || []), S = new Set(ficha.secundarios || []);
  if (!P.size) return [];
  const jac = (a, b) => {
    const inter = [...a].filter(x => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return union ? inter / union : 0;
  };
  const familia = t => (t === "cardio" ? "cardio" : t === "isometrico" ? "iso" : "fuerza");
  const out = [];
  (base || []).forEach(f => {
    if (f.id === ficha.id || f.movilidad || familia(f.tipo) !== familia(ficha.tipo)) return;
    const p = new Set(f.primarios || []);
    if (![...p].some(m => P.has(m))) return;
    if (o.equipos && !o.equipos.has(f.equipo)) return;
    let punt = 2 * jac(P, p) + 0.5 * jac(S, new Set(f.secundarios || []));
    if (o.destacados && o.destacados.has(f.id)) punt += 0.3;
    if (f.mec && f.mec === ficha.mec) punt += 0.1;
    // Mismo tipo de movimiento (de la técnica): sentadilla con sentadilla,
    // curl con curl. Los olímpicos solo si el original también lo es.
    if (o.patronDe) {
      const a = o.patronDe(ficha.id), b = o.patronDe(f.id);
      if (a && b && a === b) punt += 0.6;
      if (b === "olimpico" && a !== "olimpico") punt -= 1;
    }
    out.push({ ficha: f, puntaje: punt });
  });
  return out.sort((a, b) => b.puntaje - a.puntaje || a.ficha.nombre.localeCompare(b.ficha.nombre, "es")).slice(0, o.limite).map(x => x.ficha);
}

// ---- YouTube ----
// Búsqueda del ejercicio (sin peso): "cómo hacer sentadilla con barra".
const EQUIPO_CON = { barra: "con barra", mancuerna: "con mancuernas", polea: "en polea", maquina: "en máquina", smith: "en máquina smith",
  kettlebell: "con kettlebell", banda: "con banda", barra_ez: "con barra z", barra_hex: "con barra hexagonal", balon_medicinal: "con balón medicinal", fitball: "con fitball" };
function busquedaVideo(ficha) {
  const nombre = String(ficha.nombre || "").replace(/\s*\([^)]*\)\s*/g, " ").trim().toLowerCase();
  const eq = EQUIPO_CON[ficha.equipo] || "";
  const q = `cómo hacer ${nombre}${eq && !nombre.includes(eq) ? " " + eq : ""} técnica`;
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
}
// Id de un video a partir de un link de YouTube (o null si no es válido).
function idYoutube(texto) {
  const t = String(texto || "").trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  let u;
  try { u = new URL(/^https?:\/\//i.test(t) ? t : "https://" + t); } catch (e) { return null; }
  const host = u.hostname.replace(/^www\.|^m\.|^music\./, "");
  let id = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/);
      if (m) id = m[2];
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}
const miniaturaVideo = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const reproductor = id => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`;

return { e1rm, pesoPara, cargaSerie, sesiones, recordsPorReps, resumen, diasEntre, alternativas, busquedaVideo, idYoutube, miniaturaVideo, reproductor, TOPE_REPS };
});
