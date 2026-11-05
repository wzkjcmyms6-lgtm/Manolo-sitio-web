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
  // Una descarga ya agendada (la del bloque) en los próximos 14 días: no se sugiere otra.
  const agendada = Object.keys(o.descargas || {}).some(desde => desde > hoy && dias(hoy, desde) <= 14);
  return { sugerir: senales.length >= 2 && !reciente && !agendada && !descargaActiva(o.descargas, hoy), senales, semanas };
}

// ======================= Fase 5 =======================

// ---- Volumen semanal por músculo contra tu objetivo ----
// Series efectivas (principal 1, ayuda 0,5) de los últimos 7 días. Un
// músculo con varias zonas (pecho, espalda) cuenta cada ejercicio una sola
// vez (una serie de press no suma 3 veces al pecho).
const MUSCULOS_OBJ = [
  { id: "pecho", nombre: "Pecho", regiones: ["pecho_superior", "pecho_medio", "pecho_inferior"] },
  { id: "espalda", nombre: "Espalda", regiones: ["dorsales", "espalda_media"] },
  { id: "deltoide_lateral", nombre: "Hombro lateral", regiones: ["deltoide_lateral"], chico: true },
  { id: "deltoide_posterior", nombre: "Hombro posterior", regiones: ["deltoide_posterior"], chico: true },
  { id: "biceps", nombre: "Bíceps", regiones: ["biceps"], chico: true },
  { id: "triceps", nombre: "Tríceps", regiones: ["triceps"], chico: true },
  { id: "cuadriceps", nombre: "Cuádriceps", regiones: ["cuadriceps"] },
  { id: "isquiotibiales", nombre: "Isquios", regiones: ["isquiotibiales"] },
  { id: "gluteos", nombre: "Glúteos", regiones: ["gluteos"] },
  { id: "pantorrillas", nombre: "Pantorrillas", regiones: ["pantorrillas"], chico: true },
  { id: "abdominales", nombre: "Abdominales", regiones: ["abdominales", "oblicuos"], chico: true }
];
// Series por semana según tu meta (Schoenfeld et al., 2017: ≥ 10 para
// músculo; ACSM, 2009) y tu nivel. Los músculos chicos, que ya trabajan en
// los ejercicios grandes, tienen un mínimo menor.
const RANGOS_META = { hipertrofia: [10, 20], fuerza: [6, 15], general: [6, 12] };
function volumenObjetivo(meta, nivel, chico) {
  let [min, max] = RANGOS_META[meta] || RANGOS_META.hipertrofia;
  if (nivel === "principiante") { min = Math.ceil(min * 0.7); max = Math.round(max * 0.75); }
  else if (nivel === "avanzado") max = Math.round(max * 1.1);
  if (chico) min = Math.max(3, Math.round(min * 0.6));
  return { min, max };
}
// Series efectivas por músculo objetivo: cada ejercicio suma una sola vez a
// cada músculo, con el mayor peso entre sus zonas (principal 1, ayuda 0,5),
// como el radar por grupos. entradas: las de MuscleEngine (con ejercicio y
// series); sin calentamientos.
function seriesPorMusculo(entradas) {
  const out = {};
  MUSCULOS_OBJ.forEach(m => { out[m.id] = 0; });
  (entradas || []).forEach(e => {
    const f = e.ejercicio || {};
    if (f.tipo === "cardio") return;
    const n = (e.series || []).filter(x => !x.calentamiento && (num(x.reps) > 0 || num(x.seg) > 0)).length;
    if (!n) return;
    MUSCULOS_OBJ.forEach(m => {
      const peso = m.regiones.some(r => (f.primarios || []).includes(r)) ? 1 : m.regiones.some(r => (f.secundarios || []).includes(r)) ? 0.5 : 0;
      out[m.id] += n * peso;
    });
  });
  return out;
}
const r1 = x => Math.round(x * 10) / 10;
// Volumen de una semana: lo hecho (series) + lo que queda de tu plan (plan);
// el estado se juzga con el total. Sin plan, total = series.
function volumenConPlan(hechas, planeadas, meta, nivel) {
  const a = seriesPorMusculo(hechas), b = seriesPorMusculo(planeadas);
  return MUSCULOS_OBJ.map(m => {
    const total = a[m.id] + b[m.id];
    const obj = volumenObjetivo(meta, nivel, m.chico);
    const estado = total < obj.min ? "bajo" : total > obj.max ? "alto" : "ok";
    return { id: m.id, nombre: m.nombre, series: r1(a[m.id]), plan: r1(b[m.id]), total: r1(total), min: obj.min, max: obj.max, estado };
  });
}
function volumenSemanal(entradas, meta, nivel) {
  return volumenConPlan(entradas, [], meta, nivel);
}
function textoVolumen(v) {
  const t = v.total != null ? v.total : v.series;
  const s = String(t).replace(".", ",");
  if (v.estado === "bajo") return `${v.nombre}: ${s} series, te faltan ${String(r1(v.min - t)).replace(".", ",")} para ${v.min}.`;
  if (v.estado === "alto") return `${v.nombre}: ${s} series, más de ${v.max}: quizá sea demasiado.`;
  return `${v.nombre}: ${s} series, dentro de tu objetivo.`;
}

// ---- Equilibrio (últimas 4 semanas) ----
// empuje/tirón del tren superior (series de trabajo), cuádriceps/isquios y
// deltoide anterior/posterior (series efectivas).
const PIERNA = new Set(["cuadriceps", "isquiotibiales", "gluteos", "pantorrillas", "aductores", "abductores"]);
function equilibrio(entradas, porRegion) {
  let empuje = 0, tiron = 0;
  (entradas || []).forEach(e => {
    const f = e.ejercicio || {};
    // Solo tren superior: un peso muerto o un hip thrust no son "tirón" ni "empuje".
    if (!f.fz || (f.primarios || []).some(m => PIERNA.has(m))) return;
    const n = (e.series || []).filter(x => !x.calentamiento && (num(x.reps) > 0 || num(x.seg) > 0)).length;
    if (f.fz === "e") empuje += n;
    else if (f.fz === "t") tiron += n;
  });
  const sr = id => num(porRegion[id] && porRegion[id].series);
  const out = [];
  const par = (id, a, b, nA, nB, max, textoMal) => {
    if (a + b < 6) return;
    const r = b > 0 ? a / b : Infinity;
    const ok = r <= max && r >= 1 / max;
    out.push({ id, a: Math.round(a * 10) / 10, b: Math.round(b * 10) / 10, ratio: Number.isFinite(r) ? Math.round(r * 100) / 100 : null, ok,
      texto: ok ? `${nA} y ${nB}: bien equilibrados.` : textoMal(r) });
  };
  par("empuje_tiron", empuje, tiron, "Empuje", "tirón", 1.5, r => r > 1
    ? `Haces ${String(Math.round(r * 10) / 10).replace(".", ",")} series de empuje por cada una de tirón: suma remos o dominadas.`
    : `Haces más tirón que empuje (${String(Math.round(10 / r) / 10).replace(".", ",")} a 1): suma algo de press.`);
  par("cuad_isquios", sr("cuadriceps"), sr("isquiotibiales"), "Cuádriceps", "isquios", 2, r => r > 1
    ? "Trabajas mucho más cuádriceps que isquios: suma curl femoral o peso muerto rumano."
    : "Trabajas mucho más isquios que cuádriceps: suma sentadilla o prensa.");
  par("deltoides", sr("deltoide_anterior"), sr("deltoide_posterior"), "Deltoide anterior", "posterior", 3, r => r > 1
    ? "El hombro de adelante trabaja mucho más que el de atrás: suma face pull o pájaros."
    : "El hombro de atrás trabaja mucho más que el de adelante.");
  return out;
}

// ---- Generador de rutinas por reglas ----
// Huecos de movimiento: tipo de movimiento (de la técnica) + músculo
// principal. Las sesiones combinan huecos para cubrir y equilibrar.
const HUECOS = {
  SQ: { pt: "sentadilla", m: "cuadriceps", comp: true },
  HINGE: { pt: "bisagra", m: ["isquiotibiales", "gluteos"], comp: true },
  LUNGE: { pt: "zancada", m: "cuadriceps", comp: true },
  LEGQ: { pt: "pierna_maquina", m: "cuadriceps" },
  LEGCURL: { pt: "pierna_maquina", m: "isquiotibiales" },
  GLUTE: { pt: "gluteo", m: "gluteos", comp: true },
  CALF: { pt: "gemelos", m: "pantorrillas" },
  HPUSH: { pt: "empuje_horizontal", m: "pecho_medio", comp: true },
  HPUSH2: { pt: "empuje_horizontal", m: "pecho_superior", comp: true },
  VPUSH: { pt: "empuje_vertical", m: "deltoide_anterior", comp: true },
  HPULL: { pt: "traccion_horizontal", m: ["espalda_media", "dorsales"], comp: true },
  VPULL: { pt: "traccion_vertical", m: "dorsales", comp: true },
  LATERAL: { pt: "elevacion_hombro", m: "deltoide_lateral" },
  REAR: { pt: "elevacion_hombro", m: "deltoide_posterior" },
  CURL: { pt: "curl_biceps", m: "biceps" },
  TRI: { pt: "extension_triceps", m: "triceps" },
  FLY: { pt: "aperturas", m: ["pecho_medio", "pecho_superior"] },
  CORE: { pt: ["core_flexion", "core_isometrico"], m: ["abdominales", "oblicuos"] }
};
// extra: huecos que se pueden sumar a esa sesión para completar un músculo
// o equilibrar (sin poner curl en un día de empuje, por ejemplo).
const EXTRA = {
  full: ["LATERAL", "REAR", "CURL", "TRI", "FLY", "HPULL", "LEGQ", "LEGCURL", "GLUTE", "CALF", "CORE"],
  torso: ["LATERAL", "REAR", "CURL", "TRI", "FLY", "HPULL", "CORE"],
  pierna: ["LEGQ", "LEGCURL", "GLUTE", "CALF", "CORE"],
  empuje: ["LATERAL", "TRI", "FLY", "CORE"],
  tiron: ["REAR", "CURL", "HPULL", "CORE"]
};
const SESIONES = {
  fullA: { nombre: "Cuerpo completo A", tipo: "full", huecos: ["SQ", "HPUSH", "HPULL", "HINGE", "VPUSH", "CURL", "CORE"] },
  fullB: { nombre: "Cuerpo completo B", tipo: "full", huecos: ["HINGE", "VPULL", "HPUSH2", "LUNGE", "LATERAL", "TRI", "CALF"] },
  fullC: { nombre: "Cuerpo completo C", tipo: "full", huecos: ["SQ", "HPUSH", "VPULL", "LEGCURL", "FLY", "REAR", "CORE"] },
  torsoA: { nombre: "Torso A", tipo: "torso", huecos: ["HPUSH", "HPULL", "VPUSH", "VPULL", "LATERAL", "TRI", "CURL"] },
  torsoB: { nombre: "Torso B", tipo: "torso", huecos: ["HPUSH2", "VPULL", "HPUSH", "HPULL", "FLY", "REAR", "CURL"] },
  piernaA: { nombre: "Pierna A", tipo: "pierna", huecos: ["SQ", "HINGE", "LEGQ", "LEGCURL", "CALF", "CORE"] },
  piernaB: { nombre: "Pierna B", tipo: "pierna", huecos: ["SQ", "HINGE", "LUNGE", "LEGCURL", "GLUTE", "CALF", "CORE"] },
  empuje: { nombre: "Empuje", tipo: "empuje", huecos: ["HPUSH", "VPUSH", "HPUSH2", "LATERAL", "TRI", "FLY"] },
  tiron: { nombre: "Tirón", tipo: "tiron", huecos: ["VPULL", "HPULL", "REAR", "CURL", "HPULL"] }
};
// Si no alcanza el tiempo, se quitan primero los de prioridad más alta
// (número mayor): accesorios antes que los ejercicios grandes.
const PRIORIDAD = { SQ: 0, HINGE: 0, HPUSH: 0, HPULL: 0, VPULL: 0, VPUSH: 1, HPUSH2: 1, LUNGE: 2, LEGCURL: 2, LEGQ: 3, GLUTE: 3, REAR: 3, LATERAL: 3, CURL: 4, TRI: 4, FLY: 5, CALF: 5, CORE: 5 };
// Músculo con pocas series → hueco que lo completa.
const ARREGLO = { deltoide_lateral: "LATERAL", deltoide_posterior: "REAR", biceps: "CURL", triceps: "TRI", pantorrillas: "CALF", abdominales: "CORE", gluteos: "GLUTE", pecho: "FLY", espalda: "HPULL", cuadriceps: "LEGQ", isquiotibiales: "LEGCURL" };
// Días por semana → split y días del plan (1 = lunes … 0 = domingo).
const SPLITS = {
  2: { nombre: "Cuerpo completo", sesiones: ["fullA", "fullB"], dias: ["1", "4"] },
  3: { nombre: "Cuerpo completo", sesiones: ["fullA", "fullB", "fullC"], dias: ["1", "3", "5"] },
  4: { nombre: "Torso / pierna", sesiones: ["torsoA", "piernaA", "torsoB", "piernaB"], dias: ["1", "2", "4", "5"] },
  5: { nombre: "Empuje / tirón / pierna + torso / pierna", sesiones: ["empuje", "tiron", "piernaA", "torsoA", "piernaB"], dias: ["1", "2", "3", "5", "6"] },
  6: { nombre: "Empuje / tirón / pierna", sesiones: ["empuje", "tiron", "piernaA", "empuje", "tiron", "piernaB"], dias: ["1", "2", "3", "4", "5", "6"] }
};
// Series, reps y descanso según meta, nivel y si es el primer compuesto.
function dosis(meta, nivel, comp, primero) {
  let d;
  if (meta === "fuerza") d = comp ? (primero ? [4, 3, 5, 180] : [3, 5, 8, 150]) : [3, 8, 12, 75];
  else if (meta === "general") d = comp ? [3, 8, 12, 90] : [2, 12, 15, 60];
  else d = comp ? [3, 6, 10, 120] : [3, 10, 15, 75];
  let [series, repsMin, repsMax, descansoSeg] = d;
  if (nivel === "principiante") series = Math.max(2, series - 1);
  if (nivel === "avanzado" && comp) series += 1;
  return { series, repsMin, repsMax, descansoSeg };
}
const NIVEL_NUM = { principiante: 1, intermedio: 2, avanzado: 3 };
// Preferencia de equipo cuando hay de todo (barra primero; fitball y bandas al final).
const EQUIPO_ORDEN = ["barra", "mancuerna", "maquina", "polea", "barra_ez", "barra_hex", "smith", "kettlebell", "peso_corporal", "banda", "fitball", "otro", "balon_medicinal"];
function puntaje(f, o, h) {
  const eq = EQUIPO_ORDEN.indexOf(f.equipo);
  // En los huecos de aislamiento, mejor un ejercicio de aislamiento (elevación
  // lateral antes que remo al mentón), y al revés en los compuestos.
  const mec = h.comp ? (f.mec === "a" ? 6 : 0) : (f.mec === "c" ? 6 : 0);
  return (o.destacados.has(f.id) ? 0 : 100) + (f.tipo === "carga" ? 0 : 20) + mec + (eq < 0 ? 15 : eq);
}
function candidatos(h, base, o) {
  const pts = [].concat(h.pt), ms = [].concat(h.m);
  const tope = NIVEL_NUM[o.nivel] || 2;
  return base.filter(f => {
    if (f.movilidad || (f.tipo !== "carga" && f.tipo !== "peso_corporal")) return false;
    if (!pts.includes(o.patronDe(f.id))) return false;
    if (!(f.primarios || []).some(m => ms.includes(m))) return false;
    if (o.equipos && !o.equipos.has(f.equipo)) return false;
    // Sin barra de dominadas ni paralelas: nada que se haga colgado o en paralelas.
    if (o.dominadas === false && f.tipo === "peso_corporal" && /dominad|en barra|colgad|negativa|muscle up|fondos|paralelas/i.test(f.nombre)) return false;
    if (f.niv && f.niv > tope) return false;
    return true;
  });
}
// Series por zona (principal 1, ayuda 0,5), como el mapa muscular, para
// el equilibrio de la propuesta.
function porZona(entradas) {
  const out = {};
  const sumar = (r, n) => { (out[r] = out[r] || { series: 0 }).series += n; };
  entradas.forEach(e => {
    const n = (e.series || []).length;
    (e.ejercicio.primarios || []).forEach(r => sumar(r, n));
    (e.ejercicio.secundarios || []).forEach(r => sumar(r, n * 0.5));
  });
  return out;
}

// opciones: { dias (2–6), minutos, meta, nivel, equipos (Set), dominadas
//   (false si no hay barra de dominadas), patronDe(id), destacados (Set),
//   base: [fichas] }
// → { split, rutinas: [{ nombre, dia, items: [...], minutos }] }
// 1. Cada sesión del split con sus huecos (el mejor ejercicio para cada uno).
// 2. Si no entra en los minutos: accesorios a 2 series, después se quitan
//    los menos importantes (mínimo 3 ejercicios).
// 3. Se revisa la semana: a un músculo con pocas series se le suma un
//    accesorio donde haya tiempo; uno con demasiadas baja una serie; y se
//    equilibra empuje/tirón, cuádriceps/isquios y hombro adelante/atrás.
function generar(opciones) {
  const o = Object.assign({ dias: 3, minutos: 60, meta: "hipertrofia", nivel: "intermedio" }, opciones);
  const sp = SPLITS[Math.min(6, Math.max(2, Math.round(num(o.dias) || 3)))];
  const tope = (num(o.minutos) || 60) * 60;
  const porId = new Map(o.base.map(f => [f.id, f]));
  const listas = {};
  const lista = hid => listas[hid] || (listas[hid] = alternativasHueco(hid, o));
  const esComp = it => !!HUECOS[it.hueco].comp && (porId.get(it.exerciseId) || {}).mec !== "a";
  const durItem = it => it.series * (it.descansoSeg + 45);
  const seg = items => items.reduce((s, it) => s + durItem(it), 0);
  const usados = {};
  // El mejor ejercicio para el hueco que no esté en la sesión; entre
  // sesiones se varía (otro ejercicio la segunda vez) si hay opciones.
  function elegir(hid, items, repetido) {
    const l = lista(hid);
    const ya = usados[hid] || [];
    let f = l.find(x => !ya.includes(x.id) && !items.some(it => it.exerciseId === x.id));
    if (!f) f = l.find(x => !items.some(it => it.exerciseId === x.id));
    if (f && (!repetido || !ya.includes(f.id))) (usados[hid] = ya).push(f.id);
    return f || null;
  }
  const nuevo = (f, hid, primero) => {
    const comp = !!HUECOS[hid].comp && f.mec !== "a";
    // hueco: para "Cambiar" en la propuesta; no se guarda (EjRutinas.item lo descarta).
    return Object.assign({ nombre: f.nombre, exerciseId: f.id, peso: null, notas: "", incremento: null }, dosis(o.meta, o.nivel, comp, primero && comp), { hueco: hid });
  };
  function recortar(items) {
    for (let i = items.length - 1; i >= 0 && seg(items) > tope; i--) if (!esComp(items[i]) && items[i].series > 2) items[i].series--;
    while (seg(items) > tope && items.length > 3) {
      let peor = 0;
      items.forEach((it, i) => { if (PRIORIDAD[it.hueco] >= PRIORIDAD[items[peor].hueco]) peor = i; });
      items.splice(peor, 1);
    }
    for (let i = items.length - 1; i >= 1 && seg(items) > tope; i--) if (items[i].series > 2) items[i].series--;
  }

  // 1 y 2.
  const veces = {};
  const rutinas = sp.sesiones.map((clave, k) => {
    const ses = SESIONES[clave];
    veces[clave] = (veces[clave] || 0) + 1;
    const items = [];
    ses.huecos.forEach((hid, j) => {
      const f = elegir(hid, items, veces[clave] > 1 || ses.huecos.indexOf(hid) !== j);
      if (f) items.push(nuevo(f, hid, !items.some(esComp)));
    });
    recortar(items);
    return { nombre: veces[clave] > 1 ? ses.nombre + " 2" : ses.nombre, dia: sp.dias[k], items, tipo: ses.tipo };
  });

  // 3. Revisar la semana.
  const entradas = () => [].concat(...rutinas.map(r => r.items.map(it => ({ ejercicio: porId.get(it.exerciseId), series: Array(it.series).fill({ reps: 1 }) }))));
  function agregar(hid) {
    const ops = rutinas.filter(r => EXTRA[r.tipo].includes(hid) && !r.items.some(it => it.hueco === hid))
      .sort((a, b) => seg(a.items) - seg(b.items));
    for (const r of ops) {
      if (!lista(hid).length) return false;
      const f = elegir(hid, r.items, true);
      if (!f) continue;
      const it = nuevo(f, hid, false);
      if (seg(r.items) + durItem(it) > tope) it.series = 2;
      if (seg(r.items) + durItem(it) > tope) continue;
      // Antes del abdomen o los gemelos del final, si los hay.
      let i = r.items.length;
      while (i > 0 && (r.items[i - 1].hueco === "CORE" || r.items[i - 1].hueco === "CALF")) i--;
      r.items.splice(i, 0, it);
      return true;
    }
    return false;
  }
  // Equilibrio: sumar del lado que falta; si no hay tiempo, una serie menos
  // del lado que sobra (mínimo 2 por ejercicio).
  const ARREGLA_EQ = { empuje_tiron: ["HPULL", "REAR", "FLY", "TRI"], cuad_isquios: ["LEGCURL", "LEGCURL", "LEGQ", "LEGQ"], deltoides: ["REAR", "REAR", "LATERAL", "LATERAL"] };
  const prim = (it, m) => (porId.get(it.exerciseId).primarios || []).includes(m);
  const ladoTorso = it => {
    const f = porId.get(it.exerciseId);
    return f.fz && !(f.primarios || []).some(m => PIERNA.has(m)) ? f.fz : null;
  };
  const DEL_LADO = {
    empuje_tiron: (it, a) => ladoTorso(it) === (a ? "e" : "t"),
    cuad_isquios: (it, a) => prim(it, a ? "cuadriceps" : "isquiotibiales"),
    deltoides: (it, a) => prim(it, a ? "deltoide_anterior" : "deltoide_posterior")
  };
  // Accesorios primero; entre iguales, el que va más al final de su sesión.
  function bajarSerie(pred) {
    const c = [].concat(...rutinas.map(r => r.items.map((it, i) => ({ it, i })))).filter(x => x.it.series > 2 && pred(x.it))
      .sort((a, b) => esComp(a.it) - esComp(b.it) || b.it.series - a.it.series || b.i - a.i);
    if (!c.length) return false;
    c[0].it.series--;
    return true;
  }
  // Último recurso: quitar un ejercicio (accesorios primero; nunca dejar
  // una sesión con menos de 3).
  function quitarDe(pred) {
    let q = null;
    rutinas.forEach(r => r.items.forEach((it, i) => {
      // Uno de los grandes solo si la sesión lo repite (dos remos, por ejemplo).
      if (r.items.length <= 3 || !pred(it) || (PRIORIDAD[it.hueco] === 0 && r.items.filter(x => x.hueco === it.hueco).length < 2)) return;
      const peso = (esComp(it) ? 0 : 10) + PRIORIDAD[it.hueco];
      if (!q || peso > q.peso) q = { r, i, peso };
    }));
    if (!q) return false;
    q.r.items.splice(q.i, 1);
    return true;
  }
  function equilibrar() {
    for (let vuelta = 0; vuelta < 10; vuelta++) {
      const e = entradas();
      const mal = equilibrio(e, porZona(e)).find(x => !x.ok && ARREGLA_EQ[x.id]);
      if (!mal) return;
      const [a1, a2, b1, b2] = ARREGLA_EQ[mal.id];
      const sobraA = mal.ratio == null || mal.ratio > 1;
      if (agregar(sobraA ? a1 : b1) || agregar(sobraA ? a2 : b2)) continue;
      const lado = it => DEL_LADO[mal.id](it, sobraA);
      if (!bajarSerie(lado) && !quitarDe(lado)) return;
    }
  }
  equilibrar();
  // Músculos con pocas series: un accesorio donde haya tiempo (2 intentos).
  const intentos = {};
  for (let vuelta = 0; vuelta < 16; vuelta++) {
    const bajos = volumenSemanal(entradas(), o.meta, o.nivel)
      .filter(v => v.estado === "bajo" && ARREGLO[v.id] && (intentos[v.id] || 0) < 2)
      .sort((a, b) => (b.min - b.series) / b.min - (a.min - a.series) / a.min);
    if (!bajos.length) break;
    intentos[bajos[0].id] = (intentos[bajos[0].id] || 0) + 1;
    if (!agregar(ARREGLO[bajos[0].id])) intentos[bajos[0].id] = 2;
  }
  // Demasiadas series: una menos en sus ejercicios (los accesorios primero).
  for (let vuelta = 0; vuelta < 120; vuelta++) {
    const alto = volumenSemanal(entradas(), o.meta, o.nivel).find(v => v.estado === "alto");
    if (!alto) break;
    const regiones = MUSCULOS_OBJ.find(m => m.id === alto.id).regiones;
    const trabaja = it => (porId.get(it.exerciseId).primarios || []).some(z => regiones.includes(z));
    if (!bajarSerie(trabaja) && !quitarDe(trabaja)) break;
  }
  equilibrar();

  rutinas.forEach(r => { r.minutos = Math.round(seg(r.items) / 60); delete r.tipo; });
  return { split: sp.nombre, rutinas };
}

// Otros ejercicios para el mismo hueco, en el orden del generador (para
// "Cambiar" en la propuesta).
// En un hueco de aislamiento solo ejercicios de aislamiento si hay al menos
// 2 (para el hombro lateral, elevaciones y no remo al mentón).
function alternativasHueco(hid, opciones) {
  const o = Object.assign({ nivel: "intermedio" }, opciones);
  const h = HUECOS[hid];
  if (!h) return [];
  let l = candidatos(h, o.base, o);
  if (!h.comp) {
    const iso = l.filter(f => f.mec !== "c");
    if (iso.length >= 2) l = iso;
  }
  return l.sort((a, b) => puntaje(a, o, h) - puntaje(b, o, h));
}

// Nombre que no choca con tus rutinas: "Torso A" → "Torso A (nueva)",
// "Torso A (nueva 2)"… Tus rutinas nunca se reemplazan.
function nombreLibre(nombre, existentes) {
  const usados = new Set((existentes || []).map(x => String(x).trim().toLowerCase()));
  if (!usados.has(nombre.trim().toLowerCase())) return nombre;
  let n = 1, cand = `${nombre} (nueva)`;
  while (usados.has(cand.toLowerCase())) cand = `${nombre} (nueva ${++n})`;
  return cand;
}

// Días del plan sin rutina ("1" … "6", "0").
function diasLibres(plan) {
  const d = (plan && plan.dias) || {};
  return ["1", "2", "3", "4", "5", "6", "0"].filter(k => !d[k]);
}
// Reparte las rutinas en días libres: el día sugerido si está libre; si no,
// el libre más cercano después (o antes); si no queda ninguno, sin día.
function asignarDias(rutinas, plan) {
  const libres = new Set(diasLibres(plan));
  const orden = ["1", "2", "3", "4", "5", "6", "0"];
  return rutinas.map(r => {
    let dia = null;
    if (r.dia && libres.has(r.dia)) dia = r.dia;
    else if (r.dia) {
      const i = orden.indexOf(r.dia);
      for (let k = 1; k < 7 && !dia; k++) {
        if (libres.has(orden[(i + k) % 7])) dia = orden[(i + k) % 7];
      }
    }
    if (dia) libres.delete(dia);
    return dia;
  });
}

// ---- Bloque de entrenamiento (opcional, 4–6 semanas) ----
// Semanas subiendo con la doble progresión y la última de descarga. Empieza
// el lunes de esta semana (o el próximo si hoy es jueves o más tarde).
function nuevoBloque(hoy, semanas) {
  const n = Math.min(6, Math.max(4, Math.round(num(semanas) || 5)));
  const l = lunes(hoy);
  const desde = dias(l, hoy) >= 3 ? addDias(l, 7) : l;
  const dd = addDias(desde, (n - 1) * 7);
  return { desde, semanas: n, descarga: { desde: dd, hasta: addDias(dd, 6) } };
}
// Semana del bloque en la que estás (1…n), o null si no hay o ya terminó.
function semanaDeBloque(bloque, hoy) {
  if (!bloque || !bloque.desde || hoy < bloque.desde) return null;
  const s = Math.floor(dias(bloque.desde, hoy) / 7) + 1;
  return s <= num(bloque.semanas) ? s : null;
}

return { addDias, lunes, estancamiento, sugerenciasEstancamiento, textoEstancamiento, descargaActiva, ultimaDescarga, nuevaDescarga, senalesDescarga,
  MUSCULOS_OBJ, volumenObjetivo, seriesPorMusculo, volumenConPlan, volumenSemanal, textoVolumen, equilibrio, HUECOS, SESIONES, SPLITS, dosis, generar,
  alternativasHueco, nombreLibre, diasLibres, asignarDias, nuevoBloque, semanaDeBloque };
});
