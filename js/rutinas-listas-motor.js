// ---------- Rutinas listas (predefinidas) de Ejercicio: lógica sin pantalla ----------
// Cada rutina es un archivo en data/rutinas/ con el mismo formato (ver
// docs/RUTINAS_LISTAS.md). Aquí: leer y validar una rutina, convertir sus
// ejercicios en fichas con sus propios músculos (para el mapa muscular),
// elegir el día de hoy (Lun = A, Mié = B, Vie = C según "dia_sugerido"),
// armar el entreno a guardar con las series marcadas y ver qué días ya se
// hicieron esta semana. Sin DOM ni Firebase: tests/rutinas-listas.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RutinasListasMotor = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

// Para sumar una rutina: un archivo nuevo en data/rutinas/ y su ruta aquí
// (con ?v=; así el teléfono la guarda para usarla sin internet).
const ARCHIVOS = [
  "data/rutinas/casa-gluteo-full-body.json?v=1"
];

const sinTildes = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Músculos como los escribe la rutina → zonas del mapa (js/muscle-engine.js).
const MUSCULOS = {
  "gluteos": ["gluteos"], "gluteo": ["gluteos"], "gluteo mayor": ["gluteos"],
  "gluteo medio": ["abductores"], "abductores": ["abductores"],
  "cuadriceps": ["cuadriceps"], "isquiotibiales": ["isquiotibiales"], "isquios": ["isquiotibiales"], "femorales": ["isquiotibiales"],
  "aductores": ["aductores"], "pantorrillas": ["pantorrillas"], "gemelos": ["pantorrillas"],
  "piernas": ["cuadriceps", "pantorrillas"],
  "abdomen": ["abdominales"], "abdominales": ["abdominales"], "core": ["abdominales"], "oblicuos": ["oblicuos"],
  "lumbares": ["lumbares"], "espalda baja": ["lumbares"],
  "pecho": ["pecho_medio"], "triceps": ["triceps"], "biceps": ["biceps"], "antebrazos": ["antebrazos"],
  "hombros": ["deltoide_anterior", "deltoide_lateral"], "hombro posterior": ["deltoide_posterior"], "deltoide posterior": ["deltoide_posterior"],
  "espalda": ["dorsales", "espalda_media"], "espalda alta": ["espalda_media", "trapecio"], "trapecio": ["trapecio"], "dorsales": ["dorsales"]
};
const ZONAS = new Set(["pecho_superior", "pecho_medio", "pecho_inferior", "dorsales", "espalda_media", "trapecio", "cuello", "lumbares",
  "deltoide_anterior", "deltoide_lateral", "deltoide_posterior", "biceps", "triceps", "antebrazos", "abdominales", "oblicuos",
  "cuadriceps", "isquiotibiales", "gluteos", "aductores", "abductores", "pantorrillas"]);
const esCardio = m => sinTildes(m) === "cardio";

// El primer músculo es el principal; los demás, secundarios. "Cardio" marca
// el ejercicio como cardio (cuenta por minutos). "mapa" lo reemplaza todo.
function musculosDe(ej) {
  if (ej.mapa && Array.isArray(ej.mapa.primarios)) {
    const pri = ej.mapa.primarios.filter(z => ZONAS.has(z));
    return { primarios: pri, secundarios: (ej.mapa.secundarios || []).filter(z => ZONAS.has(z) && !pri.includes(z)), desconocidos: [] };
  }
  const etiquetas = (ej.musculos || []).filter(m => !esCardio(m));
  const desconocidos = etiquetas.filter(m => !MUSCULOS[sinTildes(m)]);
  const conocidas = etiquetas.filter(m => MUSCULOS[sinTildes(m)]);
  const primarios = conocidas.length ? MUSCULOS[sinTildes(conocidas[0])].slice() : [];
  const secundarios = [];
  conocidas.slice(1).forEach(m => MUSCULOS[sinTildes(m)].forEach(z => { if (!primarios.includes(z) && !secundarios.includes(z)) secundarios.push(z); }));
  return { primarios, secundarios, desconocidos };
}

// "10-12 por pierna" → { reps: 10 }; "40 s" → { seg: 40 };
// "20 s trabajo / 10 s descanso" → { seg: 20, segSerie: 30 } (cardio por intervalos).
function leerReps(texto) {
  const t = sinTildes(texto);
  const segs = [];
  t.replace(/(\d+)\s*(s|seg|segundos?)\b/g, (m, n) => { segs.push(Number(n)); return m; });
  if (/^\s*\d+\s*(s|seg|segundos?)\b/.test(t)) return { seg: segs[0], segSerie: segs.reduce((a, b) => a + b, 0) };
  const m = /(\d+)/.exec(t);
  return m ? { reps: Number(m[1]) } : {};
}

const slug = s => sinTildes(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

// Valida y completa una rutina tal como viene del archivo. null si no sirve.
function normalizar(r) {
  if (!r || typeof r !== "object" || !r.nombre || !Array.isArray(r.dias) || !r.dias.length) return null;
  const id = String(r.id || slug(r.nombre));
  const dias = r.dias.map((d, i) => {
    const diaId = String(d.id || String.fromCharCode(65 + i));
    const dow = DIAS_SEMANA.indexOf(sinTildes(d.dia_sugerido));
    const ejercicios = (d.ejercicios || []).filter(e => e && e.nombre).map((e, k) => {
      const series = Math.max(1, Math.min(20, Math.round(Number(e.series) || 1)));
      const objetivo = leerReps(e.reps);
      const cardio = (e.musculos || []).some(esCardio);
      const tipo = cardio ? "cardio" : objetivo.seg ? "isometrico" : "peso_corporal";
      const m = musculosDe(e);
      return {
        id: String(e.id || `${id}-${diaId}-${k + 1}-${slug(e.nombre)}`),
        nombre: String(e.nombre), series, reps: String(e.reps || ""), musculos: (e.musculos || []).map(String), tip: String(e.tip || ""),
        tipo, objetivo, primarios: m.primarios, secundarios: m.secundarios, desconocidos: m.desconocidos,
        factor: tipo === "peso_corporal" ? (Number(e.factor) > 0 && Number(e.factor) <= 1 ? Number(e.factor) : 0.5) : 0
      };
    });
    return { id: diaId, diaSugerido: d.dia_sugerido ? String(d.dia_sugerido) : "", dow: dow >= 0 ? dow : null,
      titulo: String(d.titulo || `Día ${diaId}`), calentamiento: String(d.calentamiento || ""), ejercicios };
  });
  return {
    id, version: Number(r.version) || 1, nombre: String(r.nombre), nivel: r.nivel ? String(r.nivel) : "",
    diasPorSemana: Number(r.dias_por_semana) || dias.length, duracion: r.duracion_min ? String(r.duracion_min) : "",
    equipo: Array.isArray(r.equipo) ? r.equipo.map(String) : [], descanso: r.descanso_entre_series ? String(r.descanso_entre_series) : "",
    dias,
    progresion: (r.progresion || []).filter(p => p && p.que_hacer).map(p => ({ semanas: String(p.semanas || ""), queHacer: String(p.que_hacer) })),
    consejos: (r.consejos || []).filter(Boolean).map(String)
  };
}

// Fichas para EjercicioDatos (mapa muscular, historial, gráficos): una por
// ejercicio, con los músculos que dice la rutina. No entran en el buscador.
function fichas(rutina) {
  const out = [];
  (rutina ? rutina.dias : []).forEach(d => d.ejercicios.forEach(e => out.push({
    id: e.id, nombre: e.nombre, alias: [], tipo: e.tipo, equipo: "peso_corporal",
    primarios: e.primarios, secundarios: e.secundarios, factorPesoCorporal: e.factor,
    rutinaLista: rutina.id, tip: e.tip
  })));
  return out;
}

// Día de la semana de una fecha AAAA-MM-DD (0 = domingo).
const dowDe = f => new Date(f + "T12:00:00Z").getUTCDay();
function sumarDias(f, n) {
  const d = new Date(f + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// El día que toca: { dia, hoy: true } si hoy es su día sugerido; si no, el
// próximo (con cuántos días faltan). Sin días sugeridos: el primero.
function diaDeHoy(rutina, fecha) {
  const con = rutina.dias.filter(d => d.dow != null);
  if (!con.length) return { dia: rutina.dias[0], hoy: false, enDias: null };
  const dow = dowDe(fecha);
  const hoy = con.find(d => d.dow === dow);
  if (hoy) return { dia: hoy, hoy: true, enDias: 0 };
  let mejor = null;
  con.forEach(d => { const n = (d.dow - dow + 7) % 7; if (!mejor || n < mejor.enDias) mejor = { dia: d, hoy: false, enDias: n }; });
  return mejor;
}

// marcas: { idEjercicio: [true, false, …] } (una por serie).
const hechasDe = (marcas, e) => ((marcas && marcas[e.id]) || []).slice(0, e.series).filter(Boolean).length;
function progreso(dia, marcas) {
  let hechas = 0, total = 0;
  dia.ejercicios.forEach(e => { total += e.series; hechas += hechasDe(marcas, e); });
  return { hechas, total };
}

// El entreno a guardar en users/{uid}/entrenamientos (el mismo formato de
// siempre, más `plantilla` para saber de qué rutina y día salió). null si
// no se marcó ninguna serie. o: { fecha, inicio (ms), fin (ms) }.
function entreno(rutina, dia, marcas, o) {
  const exercises = [];
  dia.ejercicios.forEach(e => {
    const n = hechasDe(marcas, e);
    if (!n) return;
    const ex = { name: e.nombre, exerciseId: e.id };
    if (e.tipo === "cardio") {
      const seg = e.objetivo.segSerie || e.objetivo.seg || 60;
      ex.minutos = Math.round((n * seg / 60) * 10) / 10;
      ex.sets = [];
    } else if (e.tipo === "isometrico") {
      ex.sets = Array.from({ length: n }, () => ({ seg: e.objetivo.seg }));
    } else {
      ex.sets = Array.from({ length: n }, () => ({ kg: 0, reps: e.objetivo.reps || 0 }));
    }
    exercises.push(ex);
  });
  if (!exercises.length) return null;
  const inicio = Number(o.inicio) || Number(o.fin);
  const min = Math.round((Number(o.fin) - inicio) / 60000);
  // Si quedó abierta horas (se olvidó de terminar), la duración de la rutina.
  const estimado = Number(String(rutina.duracion).split("-").pop()) || 30;
  const durationMin = min >= 1 && min <= 150 ? min : (min < 1 ? 1 : estimado);
  const corto = rutina.nombre.split(" — ")[0];
  return {
    date: o.fecha, name: `${corto} · Día ${dia.id}: ${dia.titulo}`, startedAt: inicio, durationMin, exercises, prs: 0,
    plantilla: { id: rutina.id, dia: dia.id, v: rutina.version }
  };
}

// Lunes de la semana de una fecha.
const lunesDe = f => sumarDias(f, -((dowDe(f) + 6) % 7));
// Días de esta rutina ya hechos esta semana (lunes a domingo): { A: "AAAA-MM-DD", … }.
function hechosSemana(rutina, entrenos, fecha) {
  const desde = lunesDe(fecha), hasta = sumarDias(desde, 6);
  const out = {};
  (entrenos || []).forEach(w => {
    const p = w && w.plantilla;
    if (!p || p.id !== rutina.id || !w.date || w.date < desde || w.date > hasta) return;
    if (!out[p.dia] || w.date > out[p.dia]) out[p.dia] = w.date;
  });
  return out;
}
// Cuántas veces se hizo cada día, en total.
function vecesPorDia(rutina, entrenos) {
  const out = {};
  (entrenos || []).forEach(w => { const p = w && w.plantilla; if (p && p.id === rutina.id) out[p.dia] = (out[p.dia] || 0) + 1; });
  return out;
}

return { ARCHIVOS, MUSCULOS, musculosDe, leerReps, normalizar, fichas, diaDeHoy, progreso, entreno, hechosSemana, vecesPorDia, lunesDe, sumarDias };
});
