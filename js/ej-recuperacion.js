// Recuperación por músculo, "¿Qué entreno hoy?" y carga total de la semana
// (gimnasio + Running + bici) — sin pantalla ni Firebase (D-096).
//
// - Fatiga por zona: cada serie de trabajo suma 1 a sus músculos
//   principales y 0,5 a los que ayudan (× 1,15 si fue muy dura: RIR ≤ 1 o
//   esfuerzo de la sesión ≥ 9; × 0,85 si fue suave), y se va bajando con el
//   tiempo (mitad cada ~21 h en músculos grandes, ~15 h en chicos). Correr
//   y pedalear cargan las piernas según la carga de la actividad.
//   Listo < 1,5 ≤ recuperándose < 4 ≤ cansado.
// - "¿Qué entreno hoy?": la rutina del plan si sus músculos están listos y
//   no corriste largo o duro ayer u hoy (ni sueles hacerlo mañana); si no,
//   otra rutina tuya con músculos listos que complete lo que te falta en la
//   semana; si ninguna sirve, Movilidad o descanso.
// - Carga de la sesión de gimnasio = RPE × minutos × 100 / 480 (Foster,
//   2001), la misma escala que Running (D-065).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EjRecuperacion = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const HORA = 3600000;
const PIERNA = ["cuadriceps", "isquiotibiales", "gluteos", "pantorrillas", "aductores", "abductores"];
const GRANDES = new Set(["cuadriceps", "isquiotibiales", "gluteos", "dorsales", "espalda_media", "lumbares", "pecho_superior", "pecho_medio", "pecho_inferior"]);
// Constante de tiempo (h): fatiga × e^(−horas / τ). τ 30 h → mitad en ~21 h;
// τ 22 h → mitad en ~15 h. Un músculo grande con 9 series duras queda
// "cansado" el día siguiente, "recuperándose" a las 48 h y listo a las ~72 h
// (ACSM, 2009: 48–72 h entre sesiones del mismo grupo).
const tau = zona => (GRANDES.has(zona) ? 30 : 22);
const UMBRAL = { cansado: 4, recuperando: 1.5 };
// Series equivalentes por cada 100 de carga (1 h a RPE 8).
const POR_CARRERA = { cuadriceps: 5, pantorrillas: 5, isquiotibiales: 3.5, gluteos: 3.5 };
const POR_BICI = { cuadriceps: 4, gluteos: 2.5, pantorrillas: 1.5, isquiotibiales: 1.5 };
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function fechaLocal(iso, hora) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d, hora == null ? 12 : hora).getTime();
}
function addDias(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + n));
  return f.toISOString().slice(0, 10);
}
const diaSemana = iso => new Date(fechaLocal(iso)).getDay();
const kmTxt = km => String(Math.round(km * 10) / 10).replace(".", ",");

// Cuándo terminó: inicio + duración, o el mediodía de ese día.
function finDe(x, minutos) {
  if (num(x.startedAt) > 0) return num(x.startedAt) + num(minutos) * 60000;
  return fechaLocal(x.date, 12);
}
// Carga de una carrera o salida en bici (escala de Running): la guardada o
// RPE × minutos × 100 / 480. Para la fatiga, sin RPE se supone 5.
function cargaActividad(d, rpeSiFalta) {
  if (d.carga && num(d.carga.v) > 0) return num(d.carga.v);
  const rpe = num(d.rpe) || num(rpeSiFalta);
  const min = num(d.duration) || num(d.durationMin);
  return rpe > 0 && min > 0 ? Math.round((Math.min(10, rpe) * min * 100) / 480) : 0;
}
// Esfuerzo de un ejercicio: RIR medio de sus series (si lo anotaste) o el
// esfuerzo de la sesión.
function intensidad(ex, w) {
  const rirs = (ex.sets || []).filter(s => !s.calentamiento && s.rir != null && s.rir !== "").map(s => num(s.rir));
  if (rirs.length) {
    const m = rirs.reduce((a, b) => a + b, 0) / rirs.length;
    return m <= 1 ? 1.15 : m >= 3 ? 0.85 : 1;
  }
  const r = num(w.rpeSesion);
  return r >= 9 ? 1.15 : r > 0 && r <= 5 ? 0.85 : 1;
}

// ---- Fatiga por zona ----
// opciones: { ahora (ms), entrenos, carreras, bicis, fichaDe(ex) → ficha }
// → { zonas: { zona: { valor, estado, listoEnH } } }
function fatiga(opciones) {
  const o = opciones || {};
  const ahora = num(o.ahora);
  const acc = {};
  const sumar = (zona, valor, cuando) => {
    const h = (ahora - cuando) / HORA;
    if (h < 0 || h > 24 * 7) return;
    acc[zona] = (acc[zona] || 0) + valor * Math.exp(-h / tau(zona));
  };
  (o.entrenos || []).forEach(w => {
    if (!w || !w.date) return;
    const cuando = finDe(w, w.durationMin);
    (w.exercises || []).forEach(ex => {
      const f = o.fichaDe(ex);
      if (!f || f.tipo === "cardio" || f.movilidad) return;
      const n = (ex.sets || []).filter(s => !s.calentamiento && (num(s.reps) > 0 || num(s.seg) > 0)).length;
      if (!n) return;
      const k = n * intensidad(ex, w);
      (f.primarios || []).forEach(z => sumar(z, k, cuando));
      (f.secundarios || []).forEach(z => { if (!(f.primarios || []).includes(z)) sumar(z, k * 0.5, cuando); });
    });
  });
  [[o.carreras, POR_CARRERA], [o.bicis, POR_BICI]].forEach(([lista, tabla]) => (lista || []).forEach(d => {
    if (!d || !d.date) return;
    const c = cargaActividad(d, 5);
    if (!c) return;
    const cuando = finDe(d, d.duration);
    Object.keys(tabla).forEach(z => sumar(z, (c / 100) * tabla[z], cuando));
  }));
  const zonas = {};
  Object.keys(acc).forEach(z => {
    const v = acc[z];
    const estado = v >= UMBRAL.cansado ? "cansado" : v >= UMBRAL.recuperando ? "recuperando" : "listo";
    zonas[z] = { valor: Math.round(v * 100) / 100, estado, listoEnH: estado === "listo" ? 0 : Math.ceil(tau(z) * Math.log(v / UMBRAL.recuperando)) };
  });
  return { zonas };
}
const estadoDe = (fat, zona) => (fat.zonas[zona] ? fat.zonas[zona].estado : "listo");
const valorDe = (fat, zona) => (fat.zonas[zona] ? fat.zonas[zona].valor : 0);

// Series por zona de una rutina (principal 1, ayuda 0,5).
function zonasDeRutina(items, fichaDe) {
  const out = {};
  (items || []).forEach(it => {
    const f = fichaDe(it);
    if (!f || f.tipo === "cardio") return;
    const n = num(it.series) || 3;
    (f.primarios || []).forEach(z => { out[z] = (out[z] || 0) + n; });
    (f.secundarios || []).forEach(z => { if (!(f.primarios || []).includes(z)) out[z] = (out[z] || 0) + n * 0.5; });
  });
  return out;
}

// ---- Carreras: ayer/hoy larga o dura, y si mañana sueles correr ----
const esDura = (d, carga) => num(d.distance) >= 15 || carga >= 120 || num(d.rpe) >= 8;
function carreraReciente(carreras, hoy) {
  const ayer = addDias(hoy, -1);
  const c = (carreras || []).filter(d => d.date === hoy || d.date === ayer)
    .map(d => ({ d, carga: cargaActividad(d, 5) }))
    .filter(x => esDura(x.d, x.carga))
    .sort((a, b) => b.carga - a.carga)[0];
  if (!c) return null;
  const cuando = c.d.date === hoy ? "Hoy ya corriste" : "Ayer corriste";
  return { fecha: c.d.date, km: num(c.d.distance), carga: c.carga, texto: `${cuando} ${kmTxt(num(c.d.distance))} km` };
}
// Mañana "sueles correr" si en 3 o más de las últimas 6 semanas corriste
// ese día de la semana; es exigente si la mediana es ≥ 12 km o carga ≥ 100.
function habitoManana(carreras, hoy) {
  const manana = addDias(hoy, 1);
  const dia = diaSemana(manana);
  const desde = addDias(hoy, -42);
  const lista = (carreras || []).filter(d => d.date && d.date > desde && d.date < hoy && diaSemana(d.date) === dia);
  const semanas = new Set(lista.map(d => d.date));
  if (semanas.size < 3) return null;
  const med = xs => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const km = med(lista.map(d => num(d.distance)));
  const carga = med(lista.map(d => cargaActividad(d, 5)));
  return { dia: DIAS[dia], km, carga, dura: km >= 12 || carga >= 100 };
}

// ---- ¿Qué entreno hoy? ----
// opciones: { hoy, fat (de fatiga), plan: { dias }, rutinas: [{ id, name,
//   zonas: { zona: series }, musculos: { musculoObj: series } }],
//   faltan: { musculoObj: series que faltan }, nombres: { musculoObj: nombre },
//   carreras, hechoHoy (entrenaste hoy), descarga (bool) }
// → null (sin rutinas) o { tipo: "plan" | "cambio" | "extra" | "movilidad" |
//   "descanso" | "hecho", rutina, plan, titulo, razones: [], manana }
function recomendar(opciones) {
  const o = opciones || {};
  const rutinas = o.rutinas || [];
  if (!rutinas.length) return null;
  const hoy = o.hoy;
  const k = String(diaSemana(hoy));
  const delPlan = rutinas.find(r => r.id === ((o.plan && o.plan.dias) || {})[k]) || null;
  const corrida = carreraReciente(o.carreras, hoy);
  const habito = habitoManana(o.carreras, hoy);
  const mananaDura = habito && habito.dura;
  const manana = mananaDura ? `Mañana (${habito.dia}) sueles correr ${kmTxt(habito.km)} km: hoy mejor sin pierna pesada.` : null;
  const fat = o.fat || { zonas: {} };
  const faltan = o.faltan || {};

  const evaluar = r => {
    const zs = Object.keys(r.zonas);
    const total = zs.reduce((s, z) => s + r.zonas[z], 0) || 1;
    const pierna = zs.filter(z => PIERNA.includes(z)).reduce((s, z) => s + r.zonas[z], 0) / total;
    const cansado = zs.filter(z => estadoDe(fat, z) === "cansado").reduce((s, z) => s + r.zonas[z], 0) / total;
    const recup = zs.filter(z => estadoDe(fat, z) === "recuperando").reduce((s, z) => s + r.zonas[z], 0) / total;
    const fatMedia = zs.reduce((s, z) => s + r.zonas[z] * valorDe(fat, z), 0) / total;
    const cubre = Object.keys(faltan).reduce((s, m) => s + Math.min(faltan[m], num((r.musculos || {})[m])), 0);
    const piernasNo = pierna >= 0.35 && (corrida || mananaDura);
    const ok = cansado < 0.25 && recup < 0.6 && !piernasNo;
    return { r, pierna, cansado, recup, fatMedia, cubre, piernasNo, ok, puntaje: cubre - 2 * fatMedia - (recup > 0.3 ? 3 : 0) };
  };
  const ev = rutinas.map(evaluar);
  const mejor = excluir => ev.filter(e => e.ok && e.r !== excluir).sort((a, b) => b.puntaje - a.puntaje)[0] || null;

  // Qué grupos de la rutina están listos o cansados (para explicar).
  const NOMBRE_ZONA = { cuadriceps: "cuádriceps", isquiotibiales: "isquios", gluteos: "glúteos", pantorrillas: "pantorrillas", pecho_medio: "pecho", pecho_superior: "pecho", pecho_inferior: "pecho", dorsales: "espalda", espalda_media: "espalda", deltoide_anterior: "hombros", deltoide_lateral: "hombros", deltoide_posterior: "hombros", biceps: "bíceps", triceps: "tríceps" };
  // Los 3 grupos con más series (los grandes primero: "pecho, hombros y tríceps").
  const GRANDES_TXT = ["pecho", "espalda", "cuádriceps", "isquios", "glúteos"];
  const principales = r => {
    const suma = {};
    Object.keys(r.zonas).forEach(z => { const n = NOMBRE_ZONA[z]; if (n) suma[n] = (suma[n] || 0) + r.zonas[z]; });
    return Object.keys(suma).sort((a, b) => (suma[b] + (GRANDES_TXT.includes(b) ? 5 : 0)) - (suma[a] + (GRANDES_TXT.includes(a) ? 5 : 0))).slice(0, 3);
  };
  const lista = xs => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
  const listos = r => lista(principales(r));
  const porQueNo = e => {
    if (e.piernasNo && corrida) return `${corrida.texto}: tus piernas necesitan recuperarse.`;
    if (e.piernasNo && mananaDura) return manana;
    const cans = principales(e.r).filter(n => Object.keys(e.r.zonas).some(z => NOMBRE_ZONA[z] === n && estadoDe(fat, z) !== "listo"));
    return `${lista(cans.length ? cans : principales(e.r)).replace(/^./, c => c.toUpperCase())} todavía se ${cans.length === 1 ? "recupera" : "recuperan"} del último entreno.`;
  };
  const queCompleta = e => {
    const ms = Object.keys(faltan).filter(m => num((e.r.musculos || {})[m]) >= 1).sort((a, b) => faltan[b] - faltan[a]).slice(0, 2);
    return ms.length ? `Te completa lo que falta de ${lista(ms.map(m => `${(o.nombres || {})[m] || m}`.toLowerCase()))} esta semana.` : null;
  };

  if (o.hechoHoy) return { tipo: "hecho", rutina: null, plan: delPlan, titulo: "Ya entrenaste hoy", razones: ["Ahora toca recuperarse: comer bien y dormir."], manana };
  if (delPlan) {
    const e = ev.find(x => x.r === delPlan);
    if (e.ok) {
      const razones = [`Músculos listos: ${listos(delPlan)}.`];
      if (o.descarga) razones.push("Semana de descarga: menos series y algo menos de peso.");
      return { tipo: "plan", rutina: delPlan, plan: delPlan, titulo: delPlan.name, razones, manana };
    }
    const alt = mejor(delPlan);
    if (alt) {
      return { tipo: "cambio", rutina: alt.r, plan: delPlan, titulo: alt.r.name,
        razones: [porQueNo(e), `Músculos listos: ${listos(alt.r)}.`, queCompleta(alt)].filter(Boolean), manana };
    }
    return { tipo: "movilidad", rutina: null, plan: delPlan, titulo: "Movilidad o descanso", razones: [porQueNo(e), "Ninguna de tus rutinas tiene los músculos listos hoy."], manana };
  }
  // Sin rutina en el plan hoy: si algo va atrasado y hay una rutina lista, se ofrece.
  const alt = mejor(null);
  if (alt && alt.cubre >= 3 && Object.keys(o.plan && o.plan.dias || {}).some(d => (o.plan.dias || {})[d])) {
    return { tipo: "extra", rutina: alt.r, plan: null, titulo: alt.r.name, razones: ["Hoy no tienes rutina en tu plan.", queCompleta(alt)].filter(Boolean), manana };
  }
  if (!Object.keys((o.plan && o.plan.dias) || {}).some(d => o.plan.dias[d])) {
    // Sin plan: la mejor rutina lista, si hay.
    const b = mejor(null);
    if (b) return { tipo: "extra", rutina: b.r, plan: null, titulo: b.r.name, razones: [`Músculos listos: ${listos(b.r)}.`, queCompleta(b)].filter(Boolean), manana };
  }
  return { tipo: "descanso", rutina: null, plan: null, titulo: "Día de descanso",
    razones: [corrida ? `${corrida.texto}: una sesión de Movilidad ayuda a soltar las piernas.` : "Descansar también es entrenar. Si quieres moverte, una sesión de Movilidad."], manana };
}

// ---- Carga total de la semana ----
// Gimnasio: RPE de la sesión (o el de sus series, 10 − RIR, o 7) × minutos.
function cargaEntreno(w) {
  let rpe = num(w.rpeSesion);
  let estimada = false;
  if (!rpe) {
    const sets = [].concat(...(w.exercises || []).map(ex => (ex.sets || []).filter(s => !s.calentamiento)));
    const rpes = sets.filter(s => num(s.rpe) > 0).map(s => num(s.rpe));
    const rirs = sets.filter(s => s.rir != null && s.rir !== "").map(s => 10 - num(s.rir));
    const l = rpes.length ? rpes : rirs;
    rpe = l.length ? l.reduce((a, b) => a + b, 0) / l.length : 7;
    estimada = true;
  }
  let min = num(w.durationMin);
  if (!min) {
    min = [].concat(...(w.exercises || []).map(ex => ex.sets || [])).length * 2.5;
    estimada = true;
  }
  return { carga: min > 0 ? Math.round((Math.min(10, rpe) * min * 100) / 480) : 0, estimada };
}
function lunesDe(iso) {
  return addDias(iso, -((diaSemana(iso) + 6) % 7));
}
// → { dias: [{ fecha, gym, run, bici }], total, gym, run, bici, promedio, cambio, estimada }
function cargaSemana(opciones) {
  const o = opciones || {};
  const hoy = o.hoy;
  const lun = lunesDe(hoy);
  const porDia = {};
  let estimada = false;
  const sumar = (fecha, clave, v) => {
    if (!v) return;
    const d = porDia[fecha] || (porDia[fecha] = { gym: 0, run: 0, bici: 0 });
    d[clave] += v;
  };
  (o.entrenos || []).forEach(w => {
    if (!w.date || w.date > hoy) return;
    const c = cargaEntreno(w);
    if (c.estimada && w.date >= lun) estimada = true;
    sumar(w.date, "gym", c.carga);
  });
  (o.carreras || []).forEach(d => { if (d.date && d.date <= hoy) sumar(d.date, "run", cargaActividad(d)); });
  (o.bicis || []).forEach(d => { if (d.date && d.date <= hoy) sumar(d.date, "bici", cargaActividad(d)); });
  const semana = l => {
    const dias = [];
    for (let i = 0; i < 7; i++) {
      const f = addDias(l, i);
      const d = porDia[f] || { gym: 0, run: 0, bici: 0 };
      dias.push({ fecha: f, gym: d.gym, run: d.run, bici: d.bici });
    }
    const t = k => dias.reduce((s, d) => s + d[k], 0);
    return { dias, gym: t("gym"), run: t("run"), bici: t("bici"), total: t("gym") + t("run") + t("bici") };
  };
  const actual = semana(lun);
  const previas = [1, 2, 3, 4].map(i => semana(addDias(lun, -7 * i)).total);
  const conDatos = previas.filter(x => x > 0);
  const promedio = conDatos.length ? Math.round(previas.reduce((a, b) => a + b, 0) / previas.length) : 0;
  // Proporción de la semana que ya pasó (lunes = 1/7 … domingo = 7/7).
  const fraccion = ((diaSemana(hoy) + 6) % 7 + 1) / 7;
  return Object.assign(actual, { promedio, ritmo: promedio ? Math.round((actual.total / (promedio * fraccion)) * 100) / 100 : null, estimada });
}

return { UMBRAL, PIERNA, tau, cargaActividad, fatiga, zonasDeRutina, carreraReciente, habitoManana, recomendar, cargaEntreno, cargaSemana, addDias, lunesDe };
});
