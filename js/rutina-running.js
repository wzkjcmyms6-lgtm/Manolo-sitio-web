// ---------- Rutinas de Running por intervalos (lectura y validación) ----------
// Convierte las filas de un CSV (o de la primera hoja de un Excel) en una
// rutina { nombre, intervalos: [{ tipo, seg, texto }] } (o en un plan de
// varios días, con la columna opcional «dia») o explica, fila por fila, qué
// está mal. También ordena la lista de rutinas (la siguiente arriba; la que
// completas pasa al final). Sin DOM ni Firebase: tests/rutina-running.test.js.
// Formato documentado en docs/CSV_ROUTINES.md:
//
//   dia,orden,tipo,duracion,descripcion
//   1,1,caminar,3:00,Calentamiento
//   1,2,correr,120,Correr suave
//   2,1,caminar,5:00,Calentamiento
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RutinaRunning = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const LIMITES = { bytes: 200 * 1024, intervalos: 200, filas: 2000, dias: 60, segMin: 5, segMax: 7200, totalMax: 4 * 3600, texto: 80, nombre: 60 };
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
  texto: ["descripcion", "nota", "notas", "texto", "detalle", "comentario"],
  dia: ["dia", "day", "sesion", "jornada", "dia n", "n dia", "numero de dia"]
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
    return { ok: false, rutina: null, dias: [], nombre, errores };
  }
  let cols = columnas(lineas[0].f);
  let datos = lineas.slice(1);
  if (!cols) {
    cols = adivinar(lineas[0].f);
    datos = lineas;
    if (!cols) {
      err(lineas[0].n, "No encontré las columnas «tipo» y «duracion». La primera fila debe tener los títulos: dia (opcional), orden, tipo, duracion, descripcion.");
      return { ok: false, rutina: null, dias: [], nombre, errores };
    }
  }
  if (!datos.length) err(null, "La rutina no tiene intervalos (solo la fila de títulos).");
  const conDias = cols.dia != null;
  const tope = conDias ? LIMITES.filas : LIMITES.intervalos;
  if (datos.length > tope) {
    err(null, `Son ${datos.length} ${conDias ? "filas" : "intervalos"}; el máximo es ${tope}.`);
    return { ok: false, rutina: null, dias: [], nombre, errores };
  }
  const intervalos = [];
  let diaAnterior = null;
  datos.forEach(({ f, n }) => {
    const celda = k => (cols[k] == null ? "" : f[cols[k]]);
    // Día: "1", "Día 2", "D3"… Vacío = el mismo de la fila anterior.
    let dia = null;
    if (conDias) {
      const txt = celda("dia");
      if (vacio(txt)) dia = diaAnterior;
      else {
        const m = norm(txt).match(/(\d+)/);
        dia = m ? Number(m[1]) : NaN;
        if (!(dia >= 1)) { err(n, `el día «${String(txt).trim()}» no es válido. Usa 1, 2, 3… (o «Día 1»).`); return; }
      }
      if (dia == null) { err(n, "falta el día (1, 2, 3…)."); return; }
      diaAnterior = dia;
    }
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
    intervalos.push({ dia, orden, n, tipo, seg: d.seg, texto: String(celda("texto") == null ? "" : celda("texto")).trim().slice(0, LIMITES.texto) });
  });
  // Un grupo por día (o uno solo sin columna «dia»), del día 1 en adelante.
  const grupos = new Map();
  intervalos.forEach(x => { if (!grupos.has(x.dia)) grupos.set(x.dia, []); grupos.get(x.dia).push(x); });
  if (grupos.size > LIMITES.dias) err(null, `Son ${grupos.size} días; el máximo es ${LIMITES.dias}.`);
  const dias = [...grupos.keys()].sort((a, b) => a - b).map(dia => {
    const lista = grupos.get(dia).sort((a, b) => a.orden - b.orden || a.n - b.n);
    const totalSeg = lista.reduce((s, x) => s + x.seg, 0);
    const deDia = dia != null ? `El día ${dia}` : "La rutina";
    if (lista.length > LIMITES.intervalos) err(null, `${deDia} tiene ${lista.length} intervalos; el máximo es ${LIMITES.intervalos}.`);
    if (totalSeg > LIMITES.totalMax) err(null, `${deDia} dura ${Math.round(totalSeg / 60)} minutos; el máximo es 4 horas.`);
    return { dia, intervalos: lista.map(x => ({ tipo: x.tipo, seg: x.seg, texto: x.texto })), totalSeg };
  });
  const ok = !errores.length && dias.length > 0;
  return {
    ok,
    nombre,
    // Un día: la rutina de siempre. Varios días: un plan (una rutina por día).
    rutina: ok && !conDias ? { v: 1, nombre, intervalos: dias[0].intervalos, totalSeg: dias[0].totalSeg } : null,
    dias: ok ? dias : [],
    errores
  };
}

// Texto de un CSV (leerCsv: el de js/importar-rutinas.js, que entiende
// "," o ";", comillas y BOM).
function desdeTexto(texto, opciones, leerCsv) {
  if (String(texto || "").length > LIMITES.bytes) return { ok: false, rutina: null, dias: [], errores: [{ fila: null, texto: "El archivo es demasiado grande (máximo 200 KB)." }] };
  return interpretar(leerCsv(String(texto || "")), opciones);
}

function resumen(r) {
  const total = (r.intervalos || []).reduce((s, x) => s + x.seg, 0);
  const dur = total < 60 ? `${total} s` : `${Math.round(total / 60)} min`;
  return `${r.intervalos.length} ${r.intervalos.length === 1 ? "intervalo" : "intervalos"} · ${dur}`;
}

// ---- La lista de rutinas como una cola ----
// Cada rutina guardada tiene «orden»: la de número más chico va arriba (la
// siguiente). Al completarla pasa al final (orden más grande que todas). Las
// rutinas viejas sin «orden» cuentan como 0 y se ordenan por día y creación.
const ordenDe = r => (typeof r.orden === "number" && isFinite(r.orden) ? r.orden : 0);
function ordenarCola(rutinas) {
  return (rutinas || []).slice().sort((a, b) => ordenDe(a) - ordenDe(b) || (a.dia || 0) - (b.dia || 0) || (a.creado || 0) - (b.creado || 0));
}
function ordenAlFinal(rutinas) {
  return (rutinas || []).reduce((m, r) => Math.max(m, ordenDe(r)), 0) + 1;
}
// "Día 2" para un día de un plan; el nombre para una rutina suelta.
const titulo = r => (r.dia ? `Día ${r.dia}` : r.nombre || "Rutina");
// "Plan 5K · Día 2": lo que queda en el historial (aunque se borre la rutina).
const nombreCompleto = r => (r.dia ? `${r.nombre} · Día ${r.dia}` : r.nombre || "Rutina");

const PLANTILLA = "dia,orden,tipo,duracion,descripcion\n"
  + "1,1,caminar,5:00,Calentamiento\n1,2,correr,1:00,Correr suave\n1,3,caminar,1:30,Recuperación\n1,4,correr,1:00,Correr suave\n1,5,caminar,1:30,Recuperación\n1,6,correr,1:00,Correr suave\n1,7,caminar,5:00,Enfriamiento\n"
  + "2,1,caminar,5:00,Calentamiento\n2,2,correr,2:00,Correr suave\n2,3,caminar,2:00,Recuperación\n2,4,correr,2:00,Correr suave\n2,5,caminar,2:00,Recuperación\n2,6,correr,2:00,Correr suave\n2,7,caminar,5:00,Enfriamiento\n"
  + "3,1,caminar,5:00,Calentamiento\n3,2,correr,3:00,Correr suave\n3,3,caminar,1:30,Recuperación\n3,4,correr,3:00,Correr suave\n3,5,caminar,1:30,Recuperación\n3,6,correr,3:00,Correr\n3,7,caminar,5:00,Enfriamiento\n";

return { LIMITES, TIPOS, leerTipo, leerDuracion, interpretar, desdeTexto, resumen, ordenarCola, ordenAlFinal, titulo, nombreCompleto, PLANTILLA };
});
