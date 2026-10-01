// ---------- Series del entreno (lógica sin pantalla) ----------
// Lo que necesita el registro estilo apps de gimnasio: la columna
// "Anterior" (lo que hiciste la última vez), completar una serie al
// marcarla con ✓, contar lo hecho y decidir qué se guarda al terminar.
// No toca el DOM: se prueba en tests/entreno-series.test.js.
(function (root) {

function num(v) {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}
function decimal(n) {
  return String(Math.round(num(n) * 100) / 100).replace(".", ",");
}

// Series de la última vez que hiciste este ejercicio, antes del entreno que
// estás anotando. mismo(ex) dice si un ejercicio guardado es el mismo.
// antesDe = { id, date, startedAt } cuando editas uno ya guardado: solo
// cuentan los anteriores a ese.
function despues(a, b) {
  const fa = a.date || "", fb = b.date || "";
  return fa > fb || (fa === fb && num(a.startedAt) > num(b.startedAt));
}
function seriesAnteriores(historial, mismo, antesDe) {
  let mejor = null;
  (historial || []).forEach(w => {
    if (antesDe && (w.id === antesDe.id || !despues(antesDe, w))) return;
    const ex = (w.exercises || []).find(mismo);
    if (!ex || !(ex.sets || []).length) return;
    if (!mejor || despues(w, mejor.w)) mejor = { w, ex };
  });
  return mejor ? mejor.ex.sets : [];
}

// A cada serie de hoy le toca la de la vez anterior en el mismo orden:
// calentamientos con calentamientos y efectivas con efectivas.
function emparejar(series, anteriores) {
  const cal = (anteriores || []).filter(s => s.calentamiento);
  const efe = (anteriores || []).filter(s => !s.calentamiento);
  let ic = 0, ie = 0;
  return (series || []).map(s => (s.calentamiento ? cal[ic++] : efe[ie++]) || null);
}

// "40kg × 8", "+5kg × 10", "−20kg × 6", "12 reps", "45 s" o "—".
function textoAnterior(s, tipo) {
  if (!s) return "—";
  if (tipo === "isometrico") return num(s.seg) > 0 ? `${num(s.seg)} s` : "—";
  const reps = num(s.reps);
  if (!reps) return "—";
  if (num(s.asistencia) > 0) return `−${decimal(s.asistencia)}kg × ${reps}`;
  const kg = num(s.kg);
  if (tipo === "peso_corporal") return kg > 0 ? `+${decimal(kg)}kg × ${reps}` : `${reps} reps`;
  return `${decimal(kg)}kg × ${reps}`;
}

// Los números de la serie anterior para copiarlos en la de hoy. En peso
// corporal la columna de kg es lastre o asistencia, según el modo de hoy.
function valoresAnterior(s, tipo, asistencia) {
  if (!s) return null;
  if (tipo === "isometrico") return num(s.seg) > 0 ? { seg: num(s.seg) } : null;
  if (!(num(s.reps) > 0)) return null;
  const kg = asistencia ? num(s.asistencia) : (num(s.asistencia) > 0 ? 0 : num(s.kg));
  return { kg, reps: num(s.reps) };
}

function vacio(v) {
  return v === "" || v == null;
}

// Al marcar ✓ con casillas vacías se rellenan como lo harías a mano: kg de
// la vez anterior; reps de la sugerencia de hoy, de la vez anterior o el
// mínimo de la rutina. Devuelve la serie completa o null si siguen faltando
// las reps (o los segundos): entonces hay que escribirlas.
function completar(set, tipo, ctx) {
  ctx = ctx || {};
  const out = Object.assign({}, set);
  const ant = valoresAnterior(ctx.anterior, tipo, ctx.asistencia);
  if (tipo === "isometrico") {
    if (!(num(out.seg) > 0) && ant) out.seg = ant.seg;
    return num(out.seg) > 0 ? out : null;
  }
  if (vacio(out.kg)) out.kg = ant ? ant.kg : 0;
  if (!(num(out.reps) > 0)) {
    const o = ctx.objetivo;
    out.reps = num(out.meta) || (ant && ant.reps) || (o && num(o.repsMin)) || 0;
  }
  return num(out.reps) > 0 ? out : null;
}

// Una serie "con datos" es lo que se guardaría: con reps (o segundos), o
// con kg escritos a mano. Las precargadas por la rutina sin tocar no cuentan.
function serieConDatos(s, tipo) {
  if (tipo === "isometrico") return num(s.seg) > 0;
  return num(s.reps) > 0 || (!s.pre && num(s.kg) > 0);
}

// Cuántas series marcaste y cuántas tienen datos pero sin ✓.
function cuenta(ejercicios) {
  let hechas = 0, sinMarcar = 0;
  (ejercicios || []).forEach(ex => {
    if (ex.tipo === "cardio") return;
    (ex.sets || []).forEach(s => {
      if (!serieConDatos(s, ex.tipo)) return;
      if (s.hecha) hechas++; else sinMarcar++;
    });
  });
  return { hechas, sinMarcar };
}

// Lo que se guarda de un ejercicio, sin campos vacíos (Firestore no acepta
// undefined). Con soloHechas quedan solo las series marcadas con ✓.
// Devuelve null si no queda nada que guardar.
function limpiar(ex, opciones) {
  const soloHechas = !!(opciones && opciones.soloHechas);
  const out = { name: ex.name, sets: [] };
  if (ex.exerciseId) out.exerciseId = ex.exerciseId;
  const sirve = s => serieConDatos(s, ex.tipo) && (!soloHechas || s.hecha);
  if (ex.tipo === "cardio") {
    if (!(num(ex.minutos) > 0)) return null;
    out.minutos = num(ex.minutos);
  } else if (ex.tipo === "isometrico") {
    out.sets = (ex.sets || []).filter(sirve)
      .map(s => Object.assign({ seg: num(s.seg) }, s.calentamiento ? { calentamiento: true } : {}));
    if (!out.sets.length) return null;
  } else {
    const asistida = ex.tipo === "peso_corporal" && ex.asistencia;
    out.sets = (ex.sets || []).filter(sirve).map(s => {
      const kg = num(s.kg), reps = num(s.reps);
      const serie = asistida ? { asistencia: kg, reps } : { kg, reps };
      if (s.calentamiento) serie.calentamiento = true;
      return serie;
    });
    if (!out.sets.length) return null;
  }
  if (ex.rpe) out.rpe = num(ex.rpe);
  if (ex.notas && String(ex.notas).trim()) out.notas = String(ex.notas).trim();
  return out;
}

// Descanso entre series.
const OPCIONES_DESCANSO = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];
function textoDescanso(seg) {
  seg = Math.round(num(seg));
  if (seg <= 0) return "Apagado";
  const m = Math.floor(seg / 60), s = seg % 60;
  if (!m) return `${s}s`;
  return s ? `${m}min ${s}s` : `${m}min`;
}
function reloj(seg) {
  seg = Math.max(0, Math.ceil(num(seg)));
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
}

root.EntrenoSeries = {
  seriesAnteriores, emparejar, textoAnterior, valoresAnterior, completar,
  serieConDatos, cuenta, limpiar, OPCIONES_DESCANSO, textoDescanso, reloj
};
if (typeof module !== "undefined" && module.exports) module.exports = root.EntrenoSeries;
})(typeof self !== "undefined" ? self : this);
