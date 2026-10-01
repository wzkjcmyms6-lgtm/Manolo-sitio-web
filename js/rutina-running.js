// ---------- Rutinas de Running por intervalos (lectura y validación) ----------
// Convierte las filas de un CSV (o de la primera hoja de un Excel) en una
// rutina { nombre, intervalos: [{ tipo, seg, texto }] } o explica, fila por
// fila, qué está mal. Sin DOM ni Firebase: tests/rutina-running.test.js.
// Formato documentado en docs/CSV_ROUTINES.md:
//
//   orden,tipo,duracion,descripcion
//   1,caminar,3:00,Calentamiento
//   2,correr,120,Correr suave
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RutinaRunning = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const LIMITES = { bytes: 200 * 1024, intervalos: 200, segMin: 5, segMax: 7200, totalMax: 4 * 3600, texto: 80, nombre: 60 };
const TIPOS = ["caminar", "trotar", "correr", "descanso"];
const SINONIMOS = {
  caminar: "caminar", caminata: "caminar", camina: "caminar", andar: "caminar", walk: "caminar", walking: "caminar",
  trotar: "trotar", trote: "trotar", trota: "trotar", jog: "trotar", jogging: "trotar",
  correr: "correr", corre: "correr", carrera: "correr", run: "correr", running: "correr",
  descanso: "descanso", descansar: "descanso", pausa: "descanso", reposo: "descanso", parar: "descanso", rest: "descanso"
};
const COLUMNAS = {
  orden: ["orden", "n", "no", "nro", "numero", "#", "paso"],
  tipo: ["tipo", "actividad", "accion", "intervalo", "que"],
  duracion: ["duracion", "tiempo", "duracion (s)", "duracion (seg)", "segundos", "seg", "minutos", "min", "duracion (min)"],
  texto: ["descripcion", "nota", "notas", "texto", "detalle", "comentario"]
};

function norm(v) {
  return String(v == null ? "" : v).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
const vacio = v => norm(v) === "";

function leerTipo(v) {
  const k = norm(v).replace(/\s+/g, " ");
  return SINONIMOS[k] || SINONIMOS[k.split(" ")[0]] || null;
}

// "180" → 180 s · "3:00" → 180 · "1:02:03" → 3723 · "3 min" · "90 s" ·
// "2m30s" · número de Excel con hora (fracción del día). Con unidad
// "min" (columna "minutos") un número suelto son minutos.
function leerDuracion(v, unidad) {
  if (typeof v === "number" && isFinite(v)) {
    if (v > 0 && v < 1) return { seg: Math.round(v * 86400) }; // hora de Excel
    return { seg: Math.round(unidad === "min" ? v * 60 : v) };
  }
  const s = norm(v).replace(",", ".").replace(/\s+/g, "");
  if (!s) return { vacio: true };
  let m = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) return { seg: m[3] != null ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[1]) * 60 + Number(m[2]) };
  m = s.match(/^(\d+(?:\.\d+)?)(min|mins|minutos?|m)?(?:(\d+)(s|seg|segundos?)?)?$/);
  if (m && m[2]) return { seg: Math.round(Number(m[1]) * 60 + (m[3] ? Number(m[3]) : 0)) };
  m = s.match(/^(\d+(?:\.\d+)?)(s|seg|segs|segundos?)?$/);
  if (m) return { seg: Math.round(Number(m[1]) * (m[2] ? 1 : unidad === "min" ? 60 : 1)) };
  return { error: true };
}

function columnas(fila) {
  const c = {};
  fila.forEach((h, i) => {
    const n = norm(h);
    Object.keys(COLUMNAS).forEach(k => { if (c[k] == null && COLUMNAS[k].includes(n)) c[k] = i; });
    if (c.unidad == null && /^(minutos|min|duracion \(min\))$/.test(n)) c.unidad = "min";
  });
  return c.tipo != null && c.duracion != null ? c : null;
}
// Sin títulos: "1,caminar,3:00,…" o "caminar,3:00,…".
function adivinar(fila) {
  if (leerTipo(fila[0]) && !leerDuracion(fila[1]).error && !leerDuracion(fila[1]).vacio) return { tipo: 0, duracion: 1, texto: 2 };
  if (/^\d+$/.test(norm(fila[0])) && leerTipo(fila[1])) return { orden: 0, tipo: 1, duracion: 2, texto: 3 };
  return null;
}

const minTexto = seg => (seg % 60 ? `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}` : `${seg / 60} min`);

// filas: [[...celdas]] · opciones: { nombre }
function interpretar(filas, opciones) {
  const errores = [];
  const err = (fila, texto) => errores.push({ fila, texto });
  const lineas = (filas || []).map((f, i) => ({ f: Array.isArray(f) ? f : [], n: i + 1 })).filter(x => x.f.some(c => !vacio(c)));
  const nombre = String((opciones && opciones.nombre) || "Rutina").replace(/\.(csv|txt|xlsx)$/i, "").replace(/[_-]+/g, " ").trim().slice(0, LIMITES.nombre) || "Rutina";
  if (!lineas.length) {
    err(null, "El archivo está vacío.");
    return { ok: false, rutina: null, errores };
  }
  let cols = columnas(lineas[0].f);
  let datos = lineas.slice(1);
  if (!cols) {
    cols = adivinar(lineas[0].f);
    datos = lineas;
    if (!cols) {
      err(lineas[0].n, "No encontré las columnas «tipo» y «duracion». La primera fila debe tener los títulos: orden, tipo, duracion, descripcion.");
      return { ok: false, rutina: null, errores };
    }
  }
  if (!datos.length) err(null, "La rutina no tiene intervalos (solo la fila de títulos).");
  if (datos.length > LIMITES.intervalos) {
    err(null, `Son ${datos.length} intervalos; el máximo es ${LIMITES.intervalos}.`);
    return { ok: false, rutina: null, errores };
  }
  const intervalos = [];
  datos.forEach(({ f, n }) => {
    const celda = k => (cols[k] == null ? "" : f[cols[k]]);
    const tipoTxt = celda("tipo"), durTxt = celda("duracion");
    if (vacio(tipoTxt) || (typeof durTxt !== "number" && vacio(durTxt))) {
      err(n, vacio(tipoTxt) ? "falta el tipo (caminar, trotar, correr o descanso)." : "falta la duración.");
      return;
    }
    const tipo = leerTipo(tipoTxt);
    if (!tipo) { err(n, `el tipo «${String(tipoTxt).trim()}» no se reconoce. Usa caminar, trotar, correr o descanso.`); return; }
    const d = leerDuracion(durTxt, cols.unidad);
    if (d.error) { err(n, `la duración «${String(durTxt).trim()}» no es válida. Usa segundos (180), minutos y segundos (3:00) o «3 min».`); return; }
    if (d.seg < LIMITES.segMin) {
      err(n, `${d.seg} segundos es muy corto (mínimo ${LIMITES.segMin}). Si eran minutos, escribe ${String(durTxt).trim()}:00 o «${String(durTxt).trim()} min».`);
      return;
    }
    if (d.seg > LIMITES.segMax) { err(n, `${minTexto(d.seg)} es demasiado para un intervalo (máximo 2 horas).`); return; }
    let orden = n;
    if (cols.orden != null && !vacio(celda("orden"))) {
      orden = Number(String(celda("orden")).replace(",", "."));
      if (!isFinite(orden)) { err(n, `el orden «${String(celda("orden")).trim()}» no es un número.`); return; }
    }
    intervalos.push({ orden, n, tipo, seg: d.seg, texto: String(celda("texto") == null ? "" : celda("texto")).trim().slice(0, LIMITES.texto) });
  });
  intervalos.sort((a, b) => a.orden - b.orden || a.n - b.n);
  const totalSeg = intervalos.reduce((s, x) => s + x.seg, 0);
  if (totalSeg > LIMITES.totalMax) err(null, `La rutina dura ${Math.round(totalSeg / 60)} minutos; el máximo es 4 horas.`);
  const ok = !errores.length && intervalos.length > 0;
  return {
    ok,
    rutina: ok ? { v: 1, nombre, intervalos: intervalos.map(x => ({ tipo: x.tipo, seg: x.seg, texto: x.texto })), totalSeg } : null,
    errores
  };
}

// Texto de un CSV (leerCsv: el de js/importar-rutinas.js, que entiende
// "," o ";", comillas y BOM).
function desdeTexto(texto, opciones, leerCsv) {
  if (String(texto || "").length > LIMITES.bytes) return { ok: false, rutina: null, errores: [{ fila: null, texto: "El archivo es demasiado grande (máximo 200 KB)." }] };
  return interpretar(leerCsv(String(texto || "")), opciones);
}

function resumen(r) {
  const total = (r.intervalos || []).reduce((s, x) => s + x.seg, 0);
  const min = Math.round(total / 60);
  return `${r.intervalos.length} ${r.intervalos.length === 1 ? "intervalo" : "intervalos"} · ${min} min`;
}

const PLANTILLA = "orden,tipo,duracion,descripcion\n1,caminar,3:00,Calentamiento\n2,correr,2:00,Correr suave\n3,caminar,3:00,Recuperación\n4,correr,2:00,Correr\n5,caminar,5:00,Enfriamiento\n";

return { LIMITES, TIPOS, leerTipo, leerDuracion, interpretar, desdeTexto, resumen, PLANTILLA };
});
