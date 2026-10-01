(function () {
// Gimnasio: rutinas, entrenamiento activo (o edición de uno guardado) e
// historial. Cada ejercicio queda ligado a su ficha de la base
// (exerciseId), así el mapa y el radar saben qué músculos trabajó. Las
// columnas cambian según el tipo: carga (KG × REPS), peso corporal
// (+KG de lastre × REPS), isométrico (SEG) o cardio (minutos).

let historyCache = [];
// { name, startedAt, date, editingId, durationMin, descanso: {fin, total},
//   exercises: [{ name, exerciseId, tipo, descansoSeg, rpe, notas, minutos,
//                 sets: [{kg, reps, seg, calentamiento, hecha}] }] }
// "hecha" (la ✓) vive solo mientras anotas: al guardar quedan las series
// hechas y en Firestore se guardan igual que siempre.
let activeWorkout = null;
let timerInterval = null;

function rutinasCollection() {
  return db.collection("users").doc(currentUser.uid).collection("rutinas");
}
function entrenamientosCollection() {
  return db.collection("users").doc(currentUser.uid).collection("entrenamientos");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// Fecha local (no UTC): un entreno a las 21:00 en La Paz sigue siendo de hoy.
function isoHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateEs(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function fmtKg(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function defaultSets(tipo) {
  if (tipo === "cardio") return [];
  const vacia = tipo === "isometrico" ? { seg: "" } : { kg: "", reps: "" };
  return [0, 1, 2].map(() => Object.assign({}, vacia));
}

function fichaDe(ex) {
  return EjercicioDatos.resolver(ex.name, ex.exerciseId);
}

function nuevoEjercicio(ficha, nombreLibre) {
  const tipo = ficha ? ficha.tipo : "carga";
  const ex = {
    name: ficha ? ficha.nombre : nombreLibre,
    exerciseId: ficha ? ficha.id : null,
    tipo,
    sets: defaultSets(tipo),
    rpe: "",
    notas: "",
    minutos: ""
  };
  // Descanso entre series: el último que elegiste para este ejercicio.
  ex.descansoSeg = descansoRecordado(ex) || 0;
  return ex;
}

// Volumen de un entreno con las mismas fórmulas que el mapa y el radar.
function volumenEntreno(w) {
  const cfg = EjercicioDatos.config();
  return (w.exercises || []).reduce((sum, ex) => {
    const f = fichaDe(ex);
    if (f) return sum + MuscleEngine.cargaEjercicio({ ejercicio: f, series: ex.sets || [], minutos: ex.minutos, rpe: ex.rpe }, cfg).volumen;
    return sum + (ex.sets || []).reduce((s, set) => s + (set.kg || 0) * (set.reps || 0), 0);
  }, 0);
}

function maxKgForExercise(name, excluirId) {
  const key = name.trim().toLowerCase();
  let max = 0;
  historyCache.forEach(w => {
    if (w.id === excluirId) return;
    (w.exercises || []).forEach(ex => {
      if (ex.name.trim().toLowerCase() === key) {
        (ex.sets || []).forEach(s => { if (s.reps > 0 && !s.calentamiento && !s.asistencia && s.kg > max) max = s.kg; });
      }
    });
  });
  return max;
}

function computePRs(exercises, excluirId) {
  let count = 0;
  exercises.forEach(ex => {
    const sets = (ex.sets || []).filter(s => s.reps > 0 && !s.calentamiento && !s.asistencia);
    if (!sets.length) return;
    const prevMax = maxKgForExercise(ex.name, excluirId);
    const sessionMax = Math.max(0, ...sets.map(s => s.kg || 0));
    if (sessionMax > 0 && sessionMax > prevMax) count++;
  });
  return count;
}

/* ---------- Rutinas ---------- */
// Las rutinas (crear, editar, duplicar, ordenar, plan semanal) están en
// js/rutinas-ui.js; aquí solo se empieza un entrenamiento a partir de una.

/* ---------- Historial ---------- */

function resumenEjercicio(ex) {
  if (ex.minutos && !(ex.sets || []).length) return `${ex.minutos} min ${ex.name}`;
  const n = (ex.sets || []).filter(x => !x.calentamiento).length;
  return `${n} ${n === 1 ? "serie" : "series"} ${ex.name}`;
}

// El historial ya no se dibuja aquí: lo muestran Perfil (tus sesiones) y
// Feed (ver js/ej-perfil.js y js/ej-feed.js). Se les avisa cada vez que cambia.
const oyentesHistorial = [];
function avisarHistorial() {
  oyentesHistorial.forEach(cb => { try { cb(historyCache); } catch (e) { console.error(e); } });
}
const oyentesBorrado = [];
function borrarEntrenamiento(w) {
  if (!confirm("¿Eliminar este entrenamiento? El mapa y el radar se recalculan al instante.")) return false;
  entrenamientosCollection().doc(w.id).delete();
  // El Feed quita también su publicación (js/ej-social.js).
  oyentesBorrado.forEach(cb => { try { cb(w); } catch (e) { console.error(e); } });
  return true;
}

/* ---------- Entrenamiento activo / edición ---------- */
// Pantalla al estilo de las apps de gimnasio: arriba Terminar y el resumen
// (duración, volumen y series marcadas); cada ejercicio con su tabla
// SERIE · ANTERIOR · KG · REPS · ✓. Al marcar ✓ la serie cuenta como hecha
// y empieza el descanso. La lógica sin pantalla está en js/entreno-series.js.

const S = window.EntrenoSeries;
const $ = id => document.getElementById(id);

// Descanso elegido por ejercicio (se recuerda en este teléfono).
const CLAVE_DESCANSOS = "manolo.descansos";
function claveEj(ex) {
  return ex.exerciseId || ExerciseSearch.clave(ex.name || "");
}
function leerDescansos() {
  try { return JSON.parse(localStorage.getItem(CLAVE_DESCANSOS) || "{}") || {}; } catch (e) { return {}; }
}
function descansoRecordado(ex) {
  const v = leerDescansos()[claveEj(ex)];
  return typeof v === "number" && v >= 0 ? v : null;
}
function recordarDescanso(ex) {
  const d = leerDescansos();
  d[claveEj(ex)] = ex.descansoSeg || 0;
  try { localStorage.setItem(CLAVE_DESCANSOS, JSON.stringify(d)); } catch (e) { /* sin almacenamiento */ }
}

// Con el entreno abierto la pantalla es solo del entreno: sin barra de
// arriba ni pestañas de abajo (ver body.gym-en-entreno en style.css).
function actualizarModo() {
  document.body.classList.toggle("gym-en-entreno", !!activeWorkout && location.hash === "#gimnasio");
  pintarDescanso();
}
window.addEventListener("hashchange", actualizarModo);

function abrirEditor() {
  $("gym-active-name").value = activeWorkout.name;
  $("gym-active-date").value = activeWorkout.date;
  const editando = !!activeWorkout.editingId;
  $("gym-active-timer").hidden = editando;
  $("gym-active-dur-txt").hidden = !editando;
  $("gym-active-duration-wrap").hidden = !editando;
  $("gym-active-duration").value = editando ? activeWorkout.durationMin || "" : "";
  $("gym-active-min").setAttribute("aria-label", editando ? "Salir sin guardar los cambios" : "Minimizar: el entreno sigue en curso");
  $("gym-active-finish").textContent = editando ? "Guardar" : "Terminar";
  $("gym-active-discard").textContent = editando ? "Cancelar cambios" : "Descartar entreno";
  $("gym-home").hidden = true;
  $("gym-active").hidden = false;
  pintarDuracionEditada();
  renderActiveExercises();
  if (editando) stopTimer(); else startTimer();
  guardarBorrador();
  pintarEnCurso();
  actualizarModo();
}

function startWorkout(name, exerciseNames) {
  activeWorkout = {
    name: name || "Entrenamiento",
    startedAt: Date.now(),
    date: isoHoy(),
    editingId: null,
    exercises: (exerciseNames || []).map(n => nuevoEjercicio(EjercicioDatos.resolver(n), n))
  };
  abrirEditor();
  window.scrollTo(0, 0);
}

// Sugerencia de hoy según la última vez que hiciste ese ejercicio
// (js/progresion.js). Solo se muestra: tú decides si la usas.
function sugerenciaPara(it, ficha, tipo) {
  const clave = ExerciseSearch.clave(it.nombre);
  const id = it.exerciseId || (ficha && ficha.id);
  const mismo = e => (id && e.exerciseId === id) || ExerciseSearch.clave(e.name || "") === clave;
  const historial = historyCache.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.startedAt || 0) - (a.startedAt || 0));
  try {
    return EjProgresion.sugerir(it, historial, mismo, { ficha, tipo });
  } catch (e) {
    console.error("Manolo: no se pudo calcular la sugerencia", e);
    return null;
  }
}

// Empieza una rutina: cada ejercicio con sus series listas y su objetivo
// (reps, peso, descanso y notas de la rutina) a la vista.
function empezarRutina(r) {
  activeWorkout = {
    name: r.name || "Entrenamiento",
    rutinaId: r.id || null,
    startedAt: Date.now(),
    date: isoHoy(),
    editingId: null,
    exercises: (r.items || []).map(it => {
      const ficha = EjercicioDatos.resolver(it.nombre, it.exerciseId);
      const ex = nuevoEjercicio(ficha, it.nombre);
      if (ex.tipo !== "cardio") {
        // "pre": serie precargada con el peso objetivo; si no la tocas, no se guarda.
        const vacia = ex.tipo === "isometrico" ? { seg: "" } : { kg: it.peso != null ? it.peso : "", reps: "", pre: true };
        ex.sets = Array.from({ length: it.series }, () => Object.assign({}, vacia));
      }
      if (it.descansoSeg > 0) ex.descansoSeg = it.descansoSeg;
      ex.objetivo = { series: it.series, repsMin: it.repsMin, repsMax: it.repsMax, peso: it.peso, descansoSeg: it.descansoSeg, notas: it.notas, incremento: it.incremento };
      ex.sugerencia = sugerenciaPara(it, ficha, ex.tipo);
      return ex;
    })
  };
  abrirEditor();
  if (location.hash !== "#gimnasio") location.hash = "#gimnasio";
  window.scrollTo(0, 0);
}

function editWorkout(w) {
  activeWorkout = {
    name: w.name || "Entrenamiento",
    startedAt: w.startedAt || Date.now(),
    date: w.date || isoHoy(),
    editingId: w.id,
    durationMin: w.durationMin || "",
    exercises: (w.exercises || []).map(ex => {
      const f = fichaDe(ex);
      return {
        name: ex.name,
        exerciseId: ex.exerciseId || (f ? f.id : null),
        tipo: f ? f.tipo : "carga",
        // Lo guardado ya se hizo: entra marcado.
        sets: (ex.sets || []).map(s => ({
          kg: s.asistencia != null ? s.asistencia : s.kg != null ? s.kg : "",
          reps: s.reps != null ? s.reps : "", seg: s.seg != null ? s.seg : "",
          calentamiento: !!s.calentamiento,
          hecha: true
        })),
        asistencia: (ex.sets || []).some(s => s.asistencia > 0),
        rpe: ex.rpe || "",
        notas: ex.notas || "",
        minutos: ex.minutos || "",
        descansoSeg: 0
      };
    })
  };
  abrirEditor();
  window.scrollTo(0, 0);
}

// ---- Borrador: el entrenamiento en curso se guarda en el teléfono ----
// Si cierras la app (o se recarga) a mitad de un entreno, al volver sigue
// donde estaba, con el cronómetro corriendo desde que empezaste.
const BORRADOR_MAX_MS = 36 * 3600000;
let borradorTimer = null;
function claveBorrador() {
  return "manolo.entreno.borrador." + (currentUser ? currentUser.uid : "");
}
function guardarBorrador() {
  if (!activeWorkout || !currentUser) return;
  clearTimeout(borradorTimer);
  borradorTimer = setTimeout(() => {
    if (!activeWorkout) return;
    try { localStorage.setItem(claveBorrador(), JSON.stringify({ guardado: Date.now(), entreno: activeWorkout })); } catch (e) { /* sin espacio */ }
  }, 300);
}
function borrarBorrador() {
  clearTimeout(borradorTimer);
  try { localStorage.removeItem(claveBorrador()); } catch (e) { /* sin almacenamiento */ }
}
function recuperarBorrador() {
  let b = null;
  try { b = JSON.parse(localStorage.getItem(claveBorrador()) || "null"); } catch (e) { b = null; }
  if (!b || !b.entreno || Date.now() - (b.guardado || 0) > BORRADOR_MAX_MS) { borrarBorrador(); return; }
  if (activeWorkout) return;
  activeWorkout = b.entreno;
  // Un descanso que terminó mientras la app estaba cerrada ya no se muestra.
  if (activeWorkout.descanso && Date.now() - activeWorkout.descanso.fin > 5000) activeWorkout.descanso = null;
  abrirEditor();
}
function pintarEnCurso() {
  document.querySelectorAll("[data-gym-en-curso]").forEach(el => {
    el.hidden = !activeWorkout || !!activeWorkout.editingId;
    if (activeWorkout) el.querySelector("[data-gym-en-curso-nombre]").textContent = activeWorkout.name || "Entrenamiento";
  });
}

function endWorkout() {
  stopTimer();
  borrarBorrador();
  activeWorkout = null;
  pintarEnCurso();
  $("gym-active").hidden = true;
  $("gym-home").hidden = false;
  actualizarModo();
}

function startTimer() {
  clearInterval(timerInterval);
  updateTimerDisplay();
  timerInterval = setInterval(updateTimerDisplay, 1000);
}
function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}
function updateTimerDisplay() {
  if (!activeWorkout) return;
  const elapsed = Math.floor((Date.now() - activeWorkout.startedAt) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const text = h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
  $("gym-active-timer").textContent = text;
  pintarDescanso();
}
function pintarDuracionEditada() {
  const d = parseInt(activeWorkout && activeWorkout.durationMin, 10);
  $("gym-active-dur-txt").textContent = d > 0 ? `${d} min` : "—";
}

const COLUMNAS = {
  carga: { titulos: ["KG", "REPS"], campos: [["kg", "decimal", "0.5"], ["reps", "numeric", "1"]] },
  peso_corporal: { titulos: ["+KG", "REPS"], campos: [["kg", "decimal", "0.5"], ["reps", "numeric", "1"]] },
  isometrico: { titulos: ["SEG"], campos: [["seg", "numeric", "1"]] }
};

// En peso corporal, la columna de kg es lastre (+KG) o asistencia (−KG).
// En mancuernas se anota el peso de cada mancuerna (KG C/U).
function titulosColumnas(ex) {
  const col = COLUMNAS[ex.tipo] || COLUMNAS.carga;
  if (ex.tipo === "peso_corporal") return [ex.asistencia ? "−KG" : "+KG", "REPS"];
  const f = fichaDe(ex);
  if (ex.tipo === "carga" && f && f.equipo === "mancuerna") return ["KG C/U", "REPS"];
  return col.titulos;
}

// ---- Columna "Anterior": la última vez que hiciste el ejercicio ----
let cacheAnteriores = new WeakMap();
function anterioresDe(ex) {
  if (cacheAnteriores.has(ex)) return cacheAnteriores.get(ex);
  const clave = ExerciseSearch.clave(ex.name || "");
  const id = ex.exerciseId;
  const mismo = e => (id && e.exerciseId === id) || ExerciseSearch.clave(e.name || "") === clave;
  const w = activeWorkout;
  const antesDe = w && w.editingId ? { id: w.editingId, date: w.date, startedAt: w.startedAt } : null;
  const series = S.seriesAnteriores(historyCache, mismo, antesDe);
  cacheAnteriores.set(ex, series);
  return series;
}
function anteriorDeSerie(ex, i) {
  return S.emparejar(ex.sets, anterioresDe(ex))[i] || null;
}

// Lo que se ve gris en la casilla vacía: el objetivo de la rutina o, si no
// hay, lo de la vez anterior. Al marcar ✓ con la casilla vacía se usa eso.
function pista(ex, campo, set, ant) {
  const o = ex.objetivo;
  const v = S.valoresAnterior(ant, ex.tipo, ex.asistencia);
  if (campo === "reps") {
    if (set && set.meta) return String(set.meta);
    if (o) return o.repsMin === o.repsMax ? String(o.repsMin) : `${o.repsMin}-${o.repsMax}`;
    return v ? String(v.reps) : "0";
  }
  if (campo === "kg") {
    if (o && o.peso != null) return String(o.peso);
    return v ? String(v.kg).replace(".", ",") : "0";
  }
  if (campo === "seg") return v ? String(v.seg) : "0";
  return "0";
}
function objetivoHTML(ex) {
  const o = ex.objetivo;
  if (!o) return "";
  return `<p class="ex-objetivo"><span>Objetivo:</span> ${escapeHtml(EjRutinas.resumenItem(o))}</p>
    ${o.notas ? `<p class="ex-objetivo-nota">${escapeHtml(o.notas)}</p>` : ""}`;
}
const SUG_ICONO = { subir: "chevronUp", bajar: "chevronDown", repetir: "check" };
function sugerenciaHTML(ex) {
  const g = ex.sugerencia;
  if (!g) return "";
  if (g.tipo === "nuevo") return `<p class="ex-sug-nuevo">${escapeHtml(g.texto)}</p>`;
  const reps = g.reps.join(" · ");
  return `
    <div class="ex-sugerencia is-${g.tipo}">
      <span class="ex-sug-ic" aria-hidden="true"><span data-icon="${SUG_ICONO[g.tipo]}"></span></span>
      <div class="ex-sug-txt">
        <strong>Hoy: ${escapeHtml(g.texto)}</strong>
        <span>${g.kg > 0 ? `${escapeHtml(String(g.kg).replace(".", ","))} kg × ` : ""}${escapeHtml(reps)} reps</span>
        <small>${escapeHtml(g.motivo)}</small>
      </div>
      ${g.aplicada
        ? `<span class="ex-sug-ok">Aplicada</span>`
        : `<button type="button" class="ex-sug-usar">Usar</button>`}
    </div>`;
}
// Pone el peso sugerido en las series (sin tocar las de calentamiento) y el
// objetivo de reps de cada una como guía gris. Las reps las anotas tú.
function usarSugerencia(ex) {
  const g = ex.sugerencia;
  if (!g || g.tipo === "nuevo") return;
  let i = 0;
  ex.sets.forEach(set => {
    if (set.calentamiento) return;
    if (g.kg > 0 || ex.tipo === "carga") set.kg = g.kg;
    set.meta = g.reps[Math.min(i, g.reps.length - 1)];
    i++;
  });
  while (i < g.reps.length) {
    ex.sets.push({ kg: g.kg, reps: "", meta: g.reps[i], pre: true });
    i++;
  }
  g.aplicada = true;
}

// ---- Miniatura del ejercicio: la figura con sus músculos pintados ----
// Recortada alrededor de los músculos principales (arte propio de Manolo).
const NS_SVG = "http://www.w3.org/2000/svg";
const miniaturas = new Map();
let medidor = null;
function miniatura(f) {
  if (!f) return `<span class="gx-thumb is-vacia" aria-hidden="true"><span data-icon="exercise"></span></span>`;
  if (miniaturas.has(f.id)) return miniaturas.get(f.id);
  const pri = f.primarios || [], sec = f.secundarios || [];
  const foco = pri.length ? pri : sec;
  const cuantos = piezas => foco.filter(m => piezas.some(p => p.m === m)).length;
  const piezas = cuantos(BodyFigures.espalda) > cuantos(BodyFigures.frente) ? BodyFigures.espalda : BodyFigures.frente;
  const svg = document.createElementNS(NS_SVG, "svg");
  svg.setAttribute("class", "figura gx-thumb-fig");
  svg.setAttribute("viewBox", "0 0 140 300");
  BodyFigures.dibujar(svg, piezas);
  svg.querySelectorAll(".mz").forEach(g => {
    const m = g.getAttribute("data-muscle");
    if (pri.includes(m)) g.setAttribute("data-nivel", "3");
    else if (sec.includes(m)) { g.setAttribute("data-nivel", "2"); g.setAttribute("data-suave", ""); }
  });
  if (!medidor) {
    medidor = document.createElement("div");
    medidor.className = "gx-medidor";
    document.body.appendChild(medidor);
  }
  medidor.appendChild(svg);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  try {
    svg.querySelectorAll('.mz[data-lado="izq"]').forEach(g => {
      if (!foco.includes(g.getAttribute("data-muscle"))) return;
      const b = g.getBBox();
      // El lado derecho es el reflejo del izquierdo (x → 140 − x).
      x0 = Math.min(x0, b.x, 140 - b.x - b.width);
      x1 = Math.max(x1, b.x + b.width, 140 - b.x);
      y0 = Math.min(y0, b.y);
      y1 = Math.max(y1, b.y + b.height);
    });
  } catch (e) { /* sin medidas: queda la figura entera */ }
  medidor.removeChild(svg);
  if (isFinite(x0)) {
    const lado = Math.min(300, Math.max(72, x1 - x0, y1 - y0) + 22);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    svg.setAttribute("viewBox", [cx - lado / 2, cy - lado / 2, lado, lado].map(n => n.toFixed(1)).join(" "));
  }
  const html = `<span class="gx-thumb" aria-hidden="true">${svg.outerHTML}</span>`;
  miniaturas.set(f.id, html);
  return html;
}

function filaSerie(ex, set, i, numero, ant) {
  const col = COLUMNAS[ex.tipo] || COLUMNAS.carga;
  const una = col.campos.length === 1 ? " cols-1" : "";
  const textoAnt = S.textoAnterior(ant, ex.tipo);
  const valor = v => v != null ? v : "";
  return `
    <div class="set-row gx-fila${una}${set.calentamiento ? " is-warm" : ""}${set.hecha ? " is-hecha" : ""}" data-set-index="${i}">
      <div class="gx-fila-in">
        <button type="button" class="set-num${set.calentamiento ? " warm" : ""}" aria-label="Serie ${i + 1}${set.calentamiento ? ", calentamiento" : ""}. Tocar para marcar o quitar calentamiento">${numero}</button>
        <button type="button" class="gx-ant"${ant ? "" : " disabled"} aria-label="Anterior: ${escapeHtml(textoAnt)}${ant ? ". Tocar para copiarla" : ""}">${escapeHtml(textoAnt)}</button>
        ${col.campos.map(([campo, modo, paso]) => `<input type="number" class="set-${campo}" inputmode="${modo}" min="0" step="${paso}" placeholder="${escapeHtml(pista(ex, campo, set, ant))}" value="${escapeHtml(valor(set[campo]))}" aria-label="${campo} serie ${i + 1}">`).join("")}
        <button type="button" class="gx-check" aria-pressed="${!!set.hecha}" aria-label="Serie ${i + 1} hecha"><span data-icon="check"></span></button>
      </div>
      <button type="button" class="delete-set gx-borrar" tabindex="-1" aria-label="Eliminar serie ${i + 1}">Eliminar</button>
    </div>`;
}

function tablaSeries(ex, exIndex) {
  const col = COLUMNAS[ex.tipo] || COLUMNAS.carga;
  const una = col.campos.length === 1 ? " cols-1" : "";
  const anteriores = S.emparejar(ex.sets, anterioresDe(ex));
  let n = 0;
  const modo = ex.tipo === "peso_corporal" ? `
    <div class="ex-modo" role="group" aria-label="La columna de kg es">
      <button type="button" data-modo="lastre" aria-pressed="${!ex.asistencia}"${ex.asistencia ? "" : ' class="active"'}>Lastre</button>
      <button type="button" data-modo="asistencia" aria-pressed="${!!ex.asistencia}"${ex.asistencia ? ' class="active"' : ""}>Asistencia</button>
    </div>` : "";
  const filas = ex.sets.map((set, i) => filaSerie(ex, set, i, set.calentamiento ? "C" : ++n, anteriores[i])).join("");
  return `${modo}
    <div class="set-table gx-tabla">
      <div class="set-row set-row-header gx-cab${una}"><span>Serie</span><span>Anterior</span>${titulosColumnas(ex).map(t => `<span>${t}</span>`).join("")}<span class="gx-cab-check" aria-label="Hecha"><span data-icon="check"></span></span></div>
      ${filas}
    </div>
    <button type="button" class="add-set-btn gx-agregar-serie"><span class="icon-sm" data-icon="plus"></span> Agregar serie</button>
    ${exIndex === 0 ? `<p class="set-hint gx-pista">Toca el número para marcar calentamiento (C) · desliza una serie a la izquierda para borrarla</p>` : ""}`;
}

function bloqueEjercicio(ex, exIndex) {
  const f = fichaDe(ex);
  const musculos = f
    ? `<p class="exercise-muscles">${ExercisePicker.resumenMusculos(f)}</p>`
    : `<p class="exercise-muscles sin">Sin músculos asignados · <button type="button" class="link-btn ex-definir">Definir</button></p>`;
  const cuerpo = ex.tipo === "cardio"
    ? `<label class="ex-inline-field gx-minutos">Minutos <input type="number" class="ex-min" inputmode="decimal" min="0" step="1" placeholder="0" value="${escapeHtml(ex.minutos)}"></label>`
    : tablaSeries(ex, exIndex);
  const conDescanso = !activeWorkout.editingId && ex.tipo !== "cardio";
  return `
    <section class="exercise-card gx-ej" data-ex-index="${exIndex}">
      <div class="gx-ej-head">
        ${miniatura(f)}
        <div class="gx-ej-titulo">
          <h3>${escapeHtml(ex.name)}</h3>
          ${musculos}
        </div>
        <button type="button" class="gx-mas" aria-label="Opciones de ${escapeHtml(ex.name)}"><span data-icon="moreV"></span></button>
      </div>
      ${objetivoHTML(ex)}
      ${sugerenciaHTML(ex)}
      <input type="text" class="ex-notas gx-notas" placeholder="Agregar notas aquí…" maxlength="200" value="${escapeHtml(ex.notas)}" aria-label="Notas de ${escapeHtml(ex.name)}">
      <div class="gx-ej-linea">
        ${conDescanso
          ? `<button type="button" class="gx-descanso-btn"><span class="icon-sm" data-icon="timer"></span>Descanso: ${S.textoDescanso(ex.descansoSeg)}</button>`
          : "<span></span>"}
        <label class="gx-rpe">RPE
          <select class="ex-rpe" aria-label="Esfuerzo percibido de 1 a 10">
            <option value="">—</option>
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option value="${n}"${String(ex.rpe) === String(n) ? " selected" : ""}>${n}</option>`).join("")}
          </select>
        </label>
      </div>
      ${cuerpo}
    </section>`;
}

function renderActiveExercises() {
  const container = $("gym-active-exercises");
  container.innerHTML = activeWorkout.exercises.map(bloqueEjercicio).join("");
  if (typeof renderIcons === "function") renderIcons(container);
  actualizarResumen();
  guardarBorrador();
}

// ---- Resumen de arriba: volumen, series marcadas y músculos trabajados ----
BodyFigures.dibujar($("gym-fig-frente"), BodyFigures.frente);
BodyFigures.dibujar($("gym-fig-espalda"), BodyFigures.espalda);
function actualizarResumen() {
  if (!activeWorkout) return;
  const hechos = activeWorkout.exercises.map(ex => S.limpiar(ex, { soloHechas: true })).filter(Boolean);
  $("gym-active-series").textContent = String(S.cuenta(activeWorkout.exercises).hechas);
  $("gym-active-vol").textContent = `${fmtKg(volumenEntreno({ exercises: hechos }))} kg`;
  const roles = {};
  hechos.forEach(ex => {
    const f = fichaDe(ex);
    if (!f) return;
    (f.secundarios || []).forEach(m => { roles[m] = roles[m] || "sec"; });
    (f.primarios || []).forEach(m => { roles[m] = "pri"; });
  });
  document.querySelectorAll(".gx-fig .mz").forEach(g => {
    const r = roles[g.getAttribute("data-muscle")];
    if (r) g.setAttribute("data-nivel", r === "pri" ? "3" : "2"); else g.removeAttribute("data-nivel");
    if (r === "sec") g.setAttribute("data-suave", ""); else g.removeAttribute("data-suave");
  });
}

// ---- Marcar una serie con ✓ ----
function pintarFila(fila, set) {
  fila.classList.toggle("is-hecha", !!set.hecha);
  fila.querySelector(".gx-check").setAttribute("aria-pressed", String(!!set.hecha));
  ["kg", "reps", "seg"].forEach(c => {
    const inp = fila.querySelector(".set-" + c);
    if (inp && document.activeElement !== inp) inp.value = set[c] != null ? set[c] : "";
  });
}
function sacudir(fila) {
  fila.classList.remove("is-error");
  void fila.offsetWidth;
  fila.classList.add("is-error");
  setTimeout(() => fila.classList.remove("is-error"), 500);
}
function marcar(ex, i, fila) {
  const set = ex.sets[i];
  if (set.hecha) {
    set.hecha = false;
  } else {
    const lleno = S.completar(set, ex.tipo, { anterior: anteriorDeSerie(ex, i), objetivo: ex.objetivo, asistencia: ex.asistencia });
    if (!lleno) {
      // Faltan las reps (o los segundos): hay que escribirlas.
      sacudir(fila);
      const inp = fila.querySelector(".set-reps, .set-seg");
      if (inp) inp.focus();
      return;
    }
    Object.assign(set, lleno, { hecha: true });
    delete set.pre;
    iniciarDescanso(ex);
  }
  pintarFila(fila, set);
  actualizarResumen();
  guardarBorrador();
}
function copiarAnterior(ex, i, fila) {
  const v = S.valoresAnterior(anteriorDeSerie(ex, i), ex.tipo, ex.asistencia);
  if (!v) return;
  const set = ex.sets[i];
  Object.assign(set, v);
  delete set.pre;
  pintarFila(fila, set);
  actualizarResumen();
  guardarBorrador();
}

// ---- Descanso entre series ----
function iniciarDescanso(ex) {
  if (!(ex.descansoSeg > 0) || activeWorkout.editingId) return;
  activeWorkout.descanso = { fin: Date.now() + ex.descansoSeg * 1000, total: ex.descansoSeg };
  pintarDescanso();
}
function pintarDescanso() {
  const barra = $("gx-barra");
  const d = activeWorkout && activeWorkout.descanso;
  if (!d) { barra.hidden = true; return; }
  barra.hidden = false;
  const resta = (d.fin - Date.now()) / 1000;
  if (resta > 0) {
    d.listoEn = null;
    barra.classList.remove("is-listo");
    $("gx-barra-lbl").textContent = "Descanso";
    $("gx-barra-reloj").textContent = S.reloj(resta);
    $("gx-barra-fill").style.transform = `scaleX(${Math.min(1, resta / d.total).toFixed(3)})`;
    return;
  }
  // Terminó: avisa unos segundos y se va sola.
  if (!d.listoEn) {
    d.listoEn = Date.now();
    if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
  }
  barra.classList.add("is-listo");
  $("gx-barra-lbl").textContent = "¡Listo!";
  $("gx-barra-reloj").textContent = "Siguiente serie";
  $("gx-barra-fill").style.transform = "scaleX(0)";
  if (Date.now() - d.listoEn > 3500) {
    activeWorkout.descanso = null;
    barra.hidden = true;
    guardarBorrador();
  }
}
$("gx-barra").addEventListener("click", e => {
  const b = e.target.closest("[data-gx-desc]");
  if (!b || !activeWorkout || !activeWorkout.descanso) return;
  const d = activeWorkout.descanso;
  if (b.dataset.gxDesc === "saltar") activeWorkout.descanso = null;
  else {
    d.fin += Number(b.dataset.gxDesc) * 1000;
    d.total = Math.max(d.total, Math.ceil((d.fin - Date.now()) / 1000));
    if (d.fin <= Date.now()) activeWorkout.descanso = null;
  }
  pintarDescanso();
  guardarBorrador();
});

// ---- Hojas (menú del ejercicio, descanso, terminar) ----
function abrirHoja(el) {
  el.hidden = false;
  el.classList.remove("is-closing");
  document.body.classList.add("sheet-open");
  if (typeof renderIcons === "function") renderIcons(el);
}
function cerrarHoja(el) {
  if (el.hidden) return;
  el.classList.add("is-closing");
  setTimeout(() => {
    el.hidden = true;
    el.classList.remove("is-closing");
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden])"));
  }, 200);
}
const HOJAS = ["gx-menu", "gx-descanso", "gx-fin"];
HOJAS.forEach(id => $(id).addEventListener("click", e => {
  if (e.target.closest("[data-gx-cerrar]")) cerrarHoja($(id));
}));
document.addEventListener("keydown", e => {
  if (e.key === "Escape") HOJAS.forEach(id => cerrarHoja($(id)));
});

let hojaIndex = -1;
function abrirMenuEjercicio(i) {
  hojaIndex = i;
  const ex = activeWorkout.exercises[i];
  const hoja = $("gx-menu");
  $("gx-menu-t").textContent = ex.name;
  hoja.querySelector('[data-gx-accion="subir"]').disabled = i === 0;
  hoja.querySelector('[data-gx-accion="bajar"]').disabled = i === activeWorkout.exercises.length - 1;
  hoja.querySelector('[data-gx-accion="definir"]').hidden = !!fichaDe(ex);
  abrirHoja(hoja);
}
function definirMusculos(ex) {
  ExerciseCreator.abrir({
    nombre: ex.name,
    alGuardar: f => {
      Object.assign(ex, { name: f.nombre, exerciseId: f.id, tipo: f.tipo });
      cacheAnteriores.delete(ex);
      if (!ex.sets.length && f.tipo !== "cardio") ex.sets = defaultSets(f.tipo);
      renderActiveExercises();
    }
  });
}
$("gx-menu").addEventListener("click", e => {
  const b = e.target.closest("[data-gx-accion]");
  if (!b || !activeWorkout) return;
  const lista = activeWorkout.exercises, i = hojaIndex, ex = lista[i];
  cerrarHoja($("gx-menu"));
  if (!ex) return;
  const accion = b.dataset.gxAccion;
  if (accion === "subir" || accion === "bajar") {
    const j = i + (accion === "subir" ? -1 : 1);
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    renderActiveExercises();
  } else if (accion === "eliminar") {
    if ((ex.sets || []).some(s => s.hecha) && !confirm(`¿Quitar «${ex.name}» del entreno? Se pierden sus series.`)) return;
    lista.splice(i, 1);
    renderActiveExercises();
  } else if (accion === "definir") {
    definirMusculos(ex);
  }
});

function abrirDescanso(i) {
  hojaIndex = i;
  const ex = activeWorkout.exercises[i];
  const actual = ex.descansoSeg || 0;
  const opciones = S.OPCIONES_DESCANSO.includes(actual) ? S.OPCIONES_DESCANSO : S.OPCIONES_DESCANSO.concat(actual).sort((a, b) => a - b);
  $("gx-descanso-t").textContent = `Descanso · ${ex.name}`;
  $("gx-descanso-lista").innerHTML = opciones.map(s =>
    `<button type="button" data-seg="${s}" aria-pressed="${s === actual}"${s === actual ? ' class="active"' : ""}>${S.textoDescanso(s)}</button>`).join("");
  abrirHoja($("gx-descanso"));
}
$("gx-descanso-lista").addEventListener("click", e => {
  const b = e.target.closest("[data-seg]");
  if (!b || !activeWorkout) return;
  const ex = activeWorkout.exercises[hojaIndex];
  cerrarHoja($("gx-descanso"));
  if (!ex) return;
  ex.descansoSeg = Number(b.dataset.seg);
  recordarDescanso(ex);
  renderActiveExercises();
});

// ---- Deslizar una serie a la izquierda para borrarla ----
const ANCHO_BORRAR = 88;
let arrastre = null;
function cerrarDeslizadas(excepto) {
  document.querySelectorAll("#gym-active-exercises .gx-fila.is-abierta").forEach(f => { if (f !== excepto) f.classList.remove("is-abierta"); });
}
const contenedor = $("gym-active-exercises");
contenedor.addEventListener("pointerdown", e => {
  const fila = e.target.closest(".gx-fila");
  cerrarDeslizadas(fila);
  if (!fila || (e.pointerType === "mouse" && e.button !== 0) || e.target.closest(".gx-borrar")) return;
  arrastre = { fila, id: e.pointerId, x0: e.clientX, y0: e.clientY, base: fila.classList.contains("is-abierta") ? -ANCHO_BORRAR : 0, x: 0, activo: false };
});
contenedor.addEventListener("pointermove", e => {
  const a = arrastre;
  if (!a || e.pointerId !== a.id) return;
  const dx = e.clientX - a.x0, dy = e.clientY - a.y0;
  if (!a.activo) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    if (Math.abs(dy) >= Math.abs(dx)) { arrastre = null; return; }
    a.activo = true;
    a.fila.classList.add("is-arrastrando");
    try { a.fila.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
  }
  a.x = Math.min(0, Math.max(-ANCHO_BORRAR * 1.5, a.base + dx));
  a.fila.querySelector(".gx-fila-in").style.transform = `translateX(${a.x}px)`;
});
function soltarArrastre(e) {
  const a = arrastre;
  if (!a || e.pointerId !== a.id) return;
  arrastre = null;
  if (!a.activo) return;
  a.fila.classList.remove("is-arrastrando");
  a.fila.querySelector(".gx-fila-in").style.transform = "";
  a.fila.classList.toggle("is-abierta", a.x < -ANCHO_BORRAR / 2);
  // El "click" que llega al soltar no debe marcar ni copiar nada.
  a.fila.dataset.arrastrada = "1";
  setTimeout(() => { delete a.fila.dataset.arrastrada; }, 80);
}
contenedor.addEventListener("pointerup", soltarArrastre);
contenedor.addEventListener("pointercancel", soltarArrastre);
document.addEventListener("pointerdown", e => {
  if (!e.target.closest("#gym-active-exercises")) cerrarDeslizadas(null);
});

contenedor.addEventListener("click", e => {
  const exCard = e.target.closest(".gx-ej");
  if (!exCard) return;
  const exIndex = Number(exCard.dataset.exIndex);
  const ex = activeWorkout.exercises[exIndex];
  const fila = e.target.closest(".gx-fila");
  if (fila && fila.dataset.arrastrada) return;
  const i = fila ? Number(fila.dataset.setIndex) : -1;

  if (e.target.closest(".gx-borrar")) {
    ex.sets.splice(i, 1);
    renderActiveExercises();
    return;
  }
  if (fila && fila.classList.contains("is-abierta")) {
    fila.classList.remove("is-abierta");
    return;
  }
  if (e.target.closest(".gx-check")) { marcar(ex, i, fila); return; }
  if (e.target.closest(".gx-ant")) { copiarAnterior(ex, i, fila); return; }
  if (e.target.closest(".gx-mas")) { abrirMenuEjercicio(exIndex); return; }
  if (e.target.closest(".gx-descanso-btn")) { abrirDescanso(exIndex); return; }
  if (e.target.closest(".ex-sug-usar")) {
    usarSugerencia(ex);
    renderActiveExercises();
    return;
  }
  if (e.target.closest(".add-set-btn")) {
    // La serie nueva copia la anterior (como en las apps de gimnasio), sin marcar.
    const ultima = ex.sets[ex.sets.length - 1];
    ex.sets.push(ultima ? Object.assign({}, ultima, { calentamiento: false, hecha: false }) : defaultSets(ex.tipo)[0]);
    renderActiveExercises();
    return;
  }
  if (e.target.closest(".set-num")) {
    const set = ex.sets[i];
    set.calentamiento = !set.calentamiento;
    renderActiveExercises();
    return;
  }
  const modo = e.target.closest(".ex-modo [data-modo]");
  if (modo) {
    ex.asistencia = modo.dataset.modo === "asistencia";
    renderActiveExercises();
    return;
  }
  if (e.target.closest(".ex-definir")) definirMusculos(ex);
});

function onCampo(e) {
  const exCard = e.target.closest(".gx-ej");
  if (!exCard) return;
  const ex = activeWorkout.exercises[Number(exCard.dataset.exIndex)];
  const t = e.target;
  if (t.classList.contains("ex-rpe")) { ex.rpe = t.value ? Number(t.value) : ""; actualizarResumen(); guardarBorrador(); return; }
  if (t.classList.contains("ex-notas")) { ex.notas = t.value; guardarBorrador(); return; }
  if (t.classList.contains("ex-min")) { ex.minutos = parseFloat(t.value) || ""; actualizarResumen(); guardarBorrador(); return; }
  const fila = t.closest(".gx-fila");
  if (!fila) return;
  const set = ex.sets[Number(fila.dataset.setIndex)];
  delete set.pre;
  if (t.classList.contains("set-kg")) set.kg = t.value === "" ? "" : parseFloat(t.value) || 0;
  if (t.classList.contains("set-reps")) set.reps = t.value === "" ? "" : parseInt(t.value, 10) || 0;
  if (t.classList.contains("set-seg")) set.seg = t.value === "" ? "" : parseInt(t.value, 10) || 0;
  // Si borras las reps de una serie marcada, deja de contar como hecha.
  if (set.hecha && !S.serieConDatos(set, ex.tipo)) {
    set.hecha = false;
    pintarFila(fila, set);
  }
  actualizarResumen();
  guardarBorrador();
}
contenedor.addEventListener("input", onCampo);
contenedor.addEventListener("change", onCampo);

function agregarEjercicio(ficha) {
  activeWorkout.exercises.push(nuevoEjercicio(ficha));
  $("gym-active-exercise-name").value = "";
  renderActiveExercises();
}

const picker = ExercisePicker.adjuntar($("gym-active-exercise-name"), {
  alElegir: agregarEjercicio,
  alCrear: nombre => ExerciseCreator.abrir({ nombre, alGuardar: agregarEjercicio })
});

$("gym-active-add-exercise-form").addEventListener("submit", e => {
  e.preventDefault();
  picker.confirmar();
});

$("gym-active-name").addEventListener("input", e => {
  if (activeWorkout) activeWorkout.name = e.target.value;
  pintarEnCurso();
  guardarBorrador();
});
$("gym-active-date").addEventListener("change", e => {
  if (activeWorkout && e.target.value) activeWorkout.date = e.target.value;
  guardarBorrador();
});
$("gym-active-duration").addEventListener("input", e => {
  if (activeWorkout) activeWorkout.durationMin = parseInt(e.target.value, 10) || "";
  pintarDuracionEditada();
  guardarBorrador();
});
// Minimizar: vuelves a Entrenamiento y el entreno sigue (con el aviso
// "Entrenamiento en curso" para volver). Editando uno guardado, es salir
// sin guardar y volver a Perfil.
$("gym-active-min").addEventListener("click", () => {
  if (activeWorkout && activeWorkout.editingId) {
    if (!confirm("¿Salir sin guardar los cambios?")) return;
    endWorkout();
    location.hash = "#ej-perfil";
    return;
  }
  location.hash = "#ejercicio";
});

$("gym-start-empty").addEventListener("click", () => startWorkout("Entrenamiento", []));

// Avisa que se guardó un entreno: js/rangos.js muestra "Nuevos rangos" y
// js/habitos.js marca solos los hábitos vinculados a Gimnasio en esa fecha.
function avisarGuardado(fecha) {
  document.dispatchEvent(new CustomEvent("entreno:guardado", { detail: { fecha } }));
}

// Terminar: si quedaron series con datos sin ✓, pregunta qué hacer con ellas.
$("gym-active-finish").addEventListener("click", () => {
  if (!activeWorkout) return;
  const { hechas, sinMarcar } = S.cuenta(activeWorkout.exercises);
  if (sinMarcar > 0) {
    $("gx-fin-txt").textContent = sinMarcar === 1
      ? "Tienes 1 serie con datos que no marcaste con ✓."
      : `Tienes ${sinMarcar} series con datos que no marcaste con ✓.`;
    $("gx-fin").querySelector('[data-gx-fin="marcadas"]').hidden = !hechas;
    abrirHoja($("gx-fin"));
    return;
  }
  terminar(false);
});
$("gx-fin").addEventListener("click", e => {
  const b = e.target.closest("[data-gx-fin]");
  if (!b) return;
  cerrarHoja($("gx-fin"));
  terminar(b.dataset.gxFin === "marcadas");
});

function terminar(soloHechas) {
  if (!activeWorkout) return;
  const exercises = activeWorkout.exercises.map(ex => S.limpiar(ex, { soloHechas })).filter(Boolean);
  const name = (activeWorkout.name || "Entrenamiento").trim() || "Entrenamiento";
  const date = activeWorkout.date || isoHoy();

  if (activeWorkout.editingId) {
    if (!exercises.length) {
      if (confirm("El entrenamiento quedó vacío. ¿Eliminarlo?")) {
        const id = activeWorkout.editingId;
        entrenamientosCollection().doc(id).delete();
        oyentesBorrado.forEach(cb => { try { cb({ id }); } catch (e) { console.error(e); } });
      }
      else return;
    } else {
      entrenamientosCollection().doc(activeWorkout.editingId).update({
        name, date, exercises,
        durationMin: Math.max(1, parseInt(activeWorkout.durationMin, 10) || 1),
        prs: computePRs(exercises, activeWorkout.editingId)
      });
      avisarGuardado(date);
    }
    endWorkout();
    return;
  }

  if (!exercises.length) {
    if (activeWorkout.exercises.length && !confirm("No anotaste ninguna serie. ¿Salir sin guardar?")) return;
    endWorkout();
    return;
  }

  entrenamientosCollection().add(Object.assign({
    date,
    name,
    startedAt: activeWorkout.startedAt,
    durationMin: Math.max(1, Math.round((Date.now() - activeWorkout.startedAt) / 60000)),
    exercises,
    prs: computePRs(exercises)
  }, activeWorkout.rutinaId ? { rutinaId: activeWorkout.rutinaId } : {}));
  avisarGuardado(date);

  endWorkout();
}

$("gym-active-discard").addEventListener("click", () => {
  if (!activeWorkout) return;
  if (!activeWorkout.editingId && activeWorkout.exercises.length && !confirm("¿Descartar este entrenamiento? Se pierde lo anotado.")) return;
  endWorkout();
});

/* ---------- Init ---------- */

onAuthReady(() => {
  recuperarBorrador();
  entrenamientosCollection().onSnapshot(snap => {
    historyCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cacheAnteriores = new WeakMap();
    avisarHistorial();
    redibujarSiSePuede();
  });
});

// Cuando carga la base de ejercicios (o cambian los propios/asignaciones)
// se recalculan los volúmenes del historial y los músculos del editor.
EjercicioDatos.onCambio(() => {
  avisarHistorial();
  if (activeWorkout) {
    activeWorkout.exercises.forEach(ex => {
      if (ex.exerciseId) return;
      const f = EjercicioDatos.resolver(ex.name);
      if (f) Object.assign(ex, { exerciseId: f.id, tipo: f.tipo });
    });
    miniaturas.clear();
    redibujarSiSePuede();
  }
});

// Redibuja el entreno abierto salvo que estés escribiendo en él.
function redibujarSiSePuede() {
  if (!activeWorkout) return;
  const enfocado = document.activeElement && document.activeElement.closest("#gym-active-exercises");
  if (!enfocado) renderActiveExercises();
}

// Lo que Perfil y Feed necesitan de aquí.
window.Gimnasio = {
  alCambiarHistorial(cb) { oyentesHistorial.push(cb); cb(historyCache); },
  volumen: volumenEntreno,
  resumenEjercicio,
  editar(w) {
    if (location.hash !== "#gimnasio") location.hash = "#gimnasio";
    editWorkout(w);
  },
  borrar: borrarEntrenamiento,
  empezarRutina,
  historial: () => historyCache,
  alBorrar(cb) { oyentesBorrado.push(cb); }
};
})();
