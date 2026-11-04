// ---------- Running: activities.csv del export de Strava (sin pantalla) ----------
// El CSV tiene columnas con el mismo nombre en unidades distintas (la primera
// "Distance" en km o millas según la cuenta, la segunda en metros; "Elapsed
// Time" dos veces) y fechas en UTC con el mes en texto. Se reconocen
// encabezados en inglés y en español; si no se reconoce nada, se usan las
// posiciones del formato conocido en inglés. Lo que importa de verdad (hora,
// distancia, ruta) sale del archivo de cada actividad; el CSV da título,
// tipo, descripción, equipo y los datos de las actividades sin archivo
// (anotadas a mano en la app). Pruebas: tests/run-csv.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./run-formatos.js"));
  else root.RunCsv = factory(root.RunFormatos);
})(typeof self !== "undefined" ? self : this, function (RunFormatos) {
"use strict";

// CSV con comillas, comas y saltos de línea dentro de los campos.
function filas(texto) {
  const s = String(texto || "").replace(/^﻿/, "");
  const out = [];
  let fila = [], campo = "", comillas = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (comillas) {
      if (c === '"') {
        if (s[i + 1] === '"') { campo += '"'; i++; } else comillas = false;
      } else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.length > 1 || fila[0] !== "") out.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); out.push(fila); }
  return out;
}

const norm = s => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

// Alias de cada dato (inglés y español). Todas las columnas que coinciden se
// guardan en orden, para elegir la que tiene la unidad buena.
const ALIAS = {
  id: ["activity id", "id de actividad", "id de la actividad", "id actividad"],
  fecha: ["activity date", "fecha de la actividad", "fecha de actividad", "fecha"],
  nombre: ["activity name", "nombre de la actividad", "nombre de actividad", "nombre"],
  tipo: ["activity type", "tipo de actividad", "tipo de la actividad"],
  descripcion: ["activity description", "descripcion de la actividad", "descripcion de actividad", "descripcion"],
  transcurrido: ["elapsed time", "tiempo transcurrido"],
  movimiento: ["moving time", "tiempo en movimiento"],
  distancia: ["distance", "distancia"],
  archivo: ["filename", "nombre del archivo", "nombre de archivo", "archivo"],
  equipo: ["activity gear", "equipo de la actividad", "equipo de actividad", "equipo"],
  ascenso: ["elevation gain", "desnivel positivo", "ganancia de elevacion", "ganancia de altura", "subida"],
  fcMax: ["max heart rate", "frecuencia cardiaca maxima", "fc maxima"],
  fcMedia: ["average heart rate", "frecuencia cardiaca media", "frecuencia cardiaca promedio", "fc media"],
  kcal: ["calories", "calorias"]
};
// Formato conocido (inglés): posiciones de respaldo.
const POSICIONES = { id: [0], fecha: [1], nombre: [2], tipo: [3], descripcion: [4], transcurrido: [5, 15], distancia: [6, 17], fcMax: [7], equipo: [11], archivo: [12], movimiento: [16], ascenso: [20] };

function columnas(cabecera) {
  const h = cabecera.map(norm);
  const col = {};
  Object.keys(ALIAS).forEach(k => {
    const idx = [];
    h.forEach((x, i) => { if (ALIAS[k].includes(x)) idx.push(i); });
    if (idx.length) col[k] = idx;
  });
  // "Type" a secas (más adelante en el CSV) no es el tipo de actividad.
  if (!col.id || !col.fecha) {
    if (cabecera.length >= 13) return { col: Object.assign({}, POSICIONES), porPosicion: true };
    return null;
  }
  return { col, porPosicion: false };
}

function numero(s) {
  let t = String(s == null ? "" : s).trim();
  if (!t) return null;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, "");
  else if (/^-?\d+,\d+$/.test(t)) t = t.replace(",", ".");
  const n = Number(t);
  return isFinite(n) ? n : null;
}

const MESES = { jan: 0, ene: 0, feb: 1, mar: 2, apr: 3, abr: 3, may: 4, jun: 5, jul: 6, aug: 7, ago: 7, sep: 8, sept: 8, set: 8, oct: 9, nov: 10, dec: 11, dic: 11 };
// Fecha UTC del CSV → ms. "Mar 5, 2024, 7:12:33 AM", "5 mar 2024, 19:12:33",
// "5 de mar. de 2024 7:12:33 p. m." o ISO.
function fechaUtc(s) {
  const t = norm(s).replace(/\./g, "").replace(/\bde\b/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  let m = /^([a-z]+) (\d{1,2}),? (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))? ?(am|pm|a m|p m)?$/.exec(t);
  let dia, mes, anio, h, mi, se, ap;
  if (m) { mes = m[1]; dia = m[2]; anio = m[3]; h = m[4]; mi = m[5]; se = m[6]; ap = m[7]; }
  else {
    m = /^(\d{1,2}) ([a-z]+),? (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))? ?(am|pm|a m|p m)?$/.exec(t);
    if (m) { dia = m[1]; mes = m[2]; anio = m[3]; h = m[4]; mi = m[5]; se = m[6]; ap = m[7]; }
  }
  if (m) {
    const k = MESES[mes.slice(0, 4)] != null ? MESES[mes.slice(0, 4)] : MESES[mes.slice(0, 3)];
    if (k == null) return null;
    let hh = Number(h);
    if (ap) {
      const pm = ap[0] === "p";
      if (hh === 12) hh = pm ? 12 : 0; else if (pm) hh += 12;
    }
    return Date.UTC(Number(anio), k, Number(dia), hh, Number(mi), Number(se || 0));
  }
  const iso = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) {
    const v = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso.replace(" ", "T") + "Z");
    return isFinite(v) ? v : null;
  }
  return null;
}

// Lee el CSV → { actividades: [...], errores: [...] }.
// Cada actividad: { idExterno, inicio (ms UTC), titulo, tipo, deporte,
// subtipo, descripcion, distM, tiempoTotalS, tiempoMovS, ascensoM, fcMedia,
// fcMax, kcal, archivo (ruta dentro del ZIP o null), equipo }.
function leer(texto) {
  const f = filas(texto);
  if (!f.length) return { actividades: [], errores: ["El CSV está vacío."] };
  const c = columnas(f[0]);
  if (!c) return { actividades: [], errores: ["El CSV no tiene las columnas esperadas (id y fecha de cada actividad)."] };
  const { col } = c;
  const errores = [];
  const actividades = [];
  const val = (fila, k, cual) => {
    const idx = col[k];
    if (!idx) return null;
    const i = cual === "ultima" ? idx[idx.length - 1] : idx[0];
    return i < fila.length ? fila[i] : null;
  };
  f.slice(1).forEach((fila, n) => {
    if (fila.every(x => !String(x).trim())) return;
    const inicio = fechaUtc(val(fila, "fecha"));
    if (inicio == null) { errores.push(`Fila ${n + 2}: no se entiende la fecha "${val(fila, "fecha") || ""}".`); return; }
    const tipo = (val(fila, "tipo") || "").trim();
    const dep = RunFormatos.deporteDeTexto(tipo);
    // Distancia: la última columna "Distance" está en metros. Si hay una sola,
    // se decide por el ritmo que daría (km o metros).
    let distM = null;
    const idxD = col.distancia || [];
    const tMov = numero(val(fila, "movimiento", "ultima"));
    const tTot = numero(val(fila, "transcurrido", "ultima"));
    if (idxD.length > 1) distM = numero(fila[idxD[idxD.length - 1]]);
    else if (idxD.length === 1) {
      const d = numero(fila[idxD[0]]);
      const t = tMov || tTot;
      distM = d == null ? null : (t && d > 0 && t / d > 30) || d < 300 ? d * 1000 : d;
    }
    const archivo = (val(fila, "archivo") || "").trim();
    const desc = (val(fila, "descripcion") || "").trim();
    actividades.push({
      idExterno: String(val(fila, "id") || "").trim() || null,
      inicio,
      titulo: (val(fila, "nombre") || "").trim() || null,
      tipo: tipo || null,
      deporte: dep.deporte,
      subtipo: dep.subtipo,
      descripcion: desc || null,
      distM: distM != null && distM >= 0 ? distM : null,
      tiempoTotalS: tTot,
      tiempoMovS: tMov,
      ascensoM: numero(val(fila, "ascenso", "ultima")),
      fcMedia: numero(val(fila, "fcMedia", "ultima")),
      fcMax: numero(val(fila, "fcMax", "ultima")),
      kcal: numero(val(fila, "kcal", "ultima")),
      archivo: archivo || null,
      equipo: (val(fila, "equipo") || "").trim() || null
    });
  });
  return { actividades, errores, porPosicion: c.porPosicion };
}

return { leer, filas, columnas, fechaUtc, numero };
});
