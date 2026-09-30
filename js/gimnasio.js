(function () {
// Gimnasio: rutinas, entrenamiento activo (o edición de uno guardado) e
// historial. Cada ejercicio queda ligado a su ficha de la base
// (exerciseId), así el mapa y el radar saben qué músculos trabajó. Las
// columnas cambian según el tipo: carga (KG × REPS), peso corporal
// (+KG de lastre × REPS), isométrico (SEG) o cardio (minutos).

let routinesCache = [];
let historyCache = [];
// { name, startedAt, date, editingId, durationMin,
//   exercises: [{ name, exerciseId, tipo, sets: [{kg, reps, seg}], rpe, notas, minutos }] }
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
  return {
    name: ficha ? ficha.nombre : nombreLibre,
    exerciseId: ficha ? ficha.id : null,
    tipo,
    sets: defaultSets(tipo),
    rpe: "",
    notas: "",
    minutos: ""
  };
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

function renderRoutines() {
  const container = document.getElementById("gym-routines");
  const empty = document.getElementById("gym-routines-empty");
  container.innerHTML = "";
  empty.hidden = routinesCache.length > 0;

  routinesCache.forEach(r => {
    const card = document.createElement("div");
    card.className = "routine-card";
    card.innerHTML = `
      <div class="routine-card-head">
        <h3>${escapeHtml(r.name)}</h3>
        <button type="button" class="delete" aria-label="Eliminar rutina">${ICONS.trash}</button>
      </div>
      <p class="routine-exercises-preview">${r.exercises.map(escapeHtml).join(", ")}</p>
      <button type="button" class="start-routine-btn">Empezar rutina</button>
    `;
    card.querySelector(".delete").addEventListener("click", () => rutinasCollection().doc(r.id).delete());
    card.querySelector(".start-routine-btn").addEventListener("click", () => startWorkout(r.name, r.exercises));
    container.appendChild(card);
  });
}

function addRoutineExerciseRow(value = "") {
  const rows = document.getElementById("gym-routine-exercise-rows");
  const row = document.createElement("div");
  row.className = "routine-exercise-row";
  row.innerHTML = `
    <input type="text" class="routine-exercise-input" placeholder="Ejercicio" value="${escapeHtml(value)}">
    <button type="button" class="delete-row" aria-label="Quitar">${ICONS.close}</button>
  `;
  row.querySelector(".delete-row").addEventListener("click", () => row.remove());
  const input = row.querySelector("input");
  ExercisePicker.adjuntar(input, {
    alElegir: f => { input.value = f.nombre; },
    alCrear: nombre => ExerciseCreator.abrir({ nombre, alGuardar: f => { input.value = f.nombre; } })
  });
  rows.appendChild(row);
}

function resetRoutineForm() {
  const form = document.getElementById("gym-routine-form");
  form.reset();
  document.getElementById("gym-routine-exercise-rows").innerHTML = "";
  form.hidden = true;
}

document.getElementById("gym-routine-new-toggle").addEventListener("click", () => {
  const form = document.getElementById("gym-routine-form");
  form.hidden = !form.hidden;
  if (!form.hidden && !document.getElementById("gym-routine-exercise-rows").children.length) {
    addRoutineExerciseRow();
    addRoutineExerciseRow();
  }
});

document.getElementById("gym-routine-add-row").addEventListener("click", () => addRoutineExerciseRow());
document.getElementById("gym-routine-cancel").addEventListener("click", () => resetRoutineForm());

document.getElementById("gym-routine-form").addEventListener("submit", e => {
  e.preventDefault();
  const name = document.getElementById("gym-routine-name").value.trim();
  const exercises = Array.from(document.querySelectorAll(".routine-exercise-input"))
    .map(i => i.value.trim())
    .filter(Boolean);
  if (!name || !exercises.length) return;

  rutinasCollection().add({ name, exercises });
  resetRoutineForm();
});

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

function abrirEditor() {
  document.getElementById("gym-active-name").value = activeWorkout.name;
  document.getElementById("gym-active-date").value = activeWorkout.date;
  const editando = !!activeWorkout.editingId;
  document.getElementById("gym-active-timer").hidden = editando;
  document.getElementById("gym-active-duration-wrap").hidden = !editando;
  document.getElementById("gym-active-duration").value = editando ? activeWorkout.durationMin || "" : "";
  document.getElementById("gym-active-finish").textContent = editando ? "Guardar cambios" : "Finalizar entrenamiento";
  document.getElementById("gym-active-discard").textContent = editando ? "Cancelar" : "Descartar";
  document.getElementById("gym-home").hidden = true;
  document.getElementById("gym-active").hidden = false;
  renderActiveExercises();
  if (editando) stopTimer(); else startTimer();
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
        sets: (ex.sets || []).map(s => ({
          kg: s.asistencia != null ? s.asistencia : s.kg != null ? s.kg : "",
          reps: s.reps != null ? s.reps : "", seg: s.seg != null ? s.seg : "",
          calentamiento: !!s.calentamiento
        })),
        asistencia: (ex.sets || []).some(s => s.asistencia > 0),
        rpe: ex.rpe || "",
        notas: ex.notas || "",
        minutos: ex.minutos || ""
      };
    })
  };
  abrirEditor();
  window.scrollTo({ top: document.getElementById("panel-gimnasio").offsetTop - 60, behavior: "smooth" });
}

function endWorkout() {
  stopTimer();
  activeWorkout = null;
  document.getElementById("gym-active").hidden = true;
  document.getElementById("gym-home").hidden = false;
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
  document.getElementById("gym-active-timer").textContent = text;
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

function tablaSeries(ex) {
  const col = COLUMNAS[ex.tipo] || COLUMNAS.carga;
  const una = col.campos.length === 1 ? " cols-1" : "";
  let n = 0;
  const modo = ex.tipo === "peso_corporal" ? `
    <div class="ex-modo" role="group" aria-label="La columna de kg es">
      <button type="button" data-modo="lastre" aria-pressed="${!ex.asistencia}"${ex.asistencia ? "" : ' class="active"'}>Lastre</button>
      <button type="button" data-modo="asistencia" aria-pressed="${!!ex.asistencia}"${ex.asistencia ? ' class="active"' : ""}>Asistencia</button>
    </div>` : "";
  const filas = ex.sets.map((set, setIndex) => `
    <div class="set-row${una}${set.calentamiento ? " is-warm" : ""}" data-set-index="${setIndex}">
      <button type="button" class="set-num${set.calentamiento ? " warm" : ""}" aria-label="Serie ${setIndex + 1}${set.calentamiento ? ", calentamiento" : ""}. Tocar para marcar o quitar calentamiento">${set.calentamiento ? "C" : ++n}</button>
      ${col.campos.map(([campo, modo, paso]) => `<input type="number" class="set-${campo}" inputmode="${modo}" min="0" step="${paso}" placeholder="0" value="${escapeHtml(set[campo] != null ? set[campo] : "")}" aria-label="${campo} serie ${setIndex + 1}">`).join("")}
      <button type="button" class="delete-set" aria-label="Eliminar serie">${ICONS.close}</button>
    </div>`).join("");
  return `${modo}
    <div class="set-table">
      <div class="set-row set-row-header${una}"><span>SERIE</span>${titulosColumnas(ex).map(t => `<span>${t}</span>`).join("")}<span></span></div>
      ${filas}
    </div>
    <div class="set-foot">
      <button type="button" class="link-btn add-set-btn">+ Serie</button>
      <span class="set-hint">Toca el número para marcar calentamiento (C)</span>
    </div>`;
}

function renderActiveExercises() {
  const container = document.getElementById("gym-active-exercises");
  container.innerHTML = "";

  activeWorkout.exercises.forEach((ex, exIndex) => {
    const f = fichaDe(ex);
    const musculos = f
      ? `<p class="exercise-muscles">${ExercisePicker.resumenMusculos(f)}</p>`
      : `<p class="exercise-muscles sin">Sin músculos asignados · <button type="button" class="link-btn ex-definir">Definir</button></p>`;
    const cuerpo = ex.tipo === "cardio"
      ? `<label class="ex-inline-field">Minutos <input type="number" class="ex-min" inputmode="decimal" min="0" step="1" placeholder="0" value="${escapeHtml(ex.minutos)}"></label>`
      : tablaSeries(ex);

    const card = document.createElement("div");
    card.className = "exercise-card";
    card.dataset.exIndex = exIndex;
    card.innerHTML = `
      <div class="exercise-card-head">
        <div class="exercise-card-title">
          <h3>${escapeHtml(ex.name)}</h3>
          ${musculos}
        </div>
        <button type="button" class="delete" aria-label="Eliminar ejercicio">${ICONS.trash}</button>
      </div>
      ${cuerpo}
      <div class="exercise-extra">
        <label class="ex-inline-field">RPE
          <select class="ex-rpe" aria-label="Esfuerzo percibido de 1 a 10">
            <option value="">—</option>
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option value="${n}"${String(ex.rpe) === String(n) ? " selected" : ""}>${n}</option>`).join("")}
          </select>
        </label>
        <input type="text" class="ex-notas" placeholder="Notas (opcional)" maxlength="200" value="${escapeHtml(ex.notas)}">
      </div>
    `;
    container.appendChild(card);
  });
}

document.getElementById("gym-active-exercises").addEventListener("click", e => {
  const exCard = e.target.closest(".exercise-card");
  if (!exCard) return;
  const exIndex = Number(exCard.dataset.exIndex);
  const ex = activeWorkout.exercises[exIndex];

  if (e.target.closest(".delete-set")) {
    const setIndex = Number(e.target.closest(".set-row").dataset.setIndex);
    ex.sets.splice(setIndex, 1);
    renderActiveExercises();
    return;
  }
  if (e.target.closest(".delete")) {
    activeWorkout.exercises.splice(exIndex, 1);
    renderActiveExercises();
    return;
  }
  if (e.target.closest(".add-set-btn")) {
    // La serie nueva copia la anterior (como en las apps de gimnasio).
    const ultima = ex.sets[ex.sets.length - 1];
    ex.sets.push(ultima ? Object.assign({}, ultima, { calentamiento: false }) : defaultSets(ex.tipo)[0]);
    renderActiveExercises();
    return;
  }
  if (e.target.closest(".set-num")) {
    const set = ex.sets[Number(e.target.closest(".set-row").dataset.setIndex)];
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
  if (e.target.closest(".ex-definir")) {
    ExerciseCreator.abrir({
      nombre: ex.name,
      alGuardar: f => { Object.assign(ex, { name: f.nombre, exerciseId: f.id, tipo: f.tipo }); if (!ex.sets.length && f.tipo !== "cardio") ex.sets = defaultSets(f.tipo); renderActiveExercises(); }
    });
  }
});

function onCampo(e) {
  const exCard = e.target.closest(".exercise-card");
  if (!exCard) return;
  const ex = activeWorkout.exercises[Number(exCard.dataset.exIndex)];
  const t = e.target;
  if (t.classList.contains("ex-rpe")) { ex.rpe = t.value ? Number(t.value) : ""; return; }
  if (t.classList.contains("ex-notas")) { ex.notas = t.value; return; }
  if (t.classList.contains("ex-min")) { ex.minutos = parseFloat(t.value) || ""; return; }
  const setRow = t.closest(".set-row");
  if (!setRow || setRow.classList.contains("set-row-header")) return;
  const set = ex.sets[Number(setRow.dataset.setIndex)];
  if (t.classList.contains("set-kg")) set.kg = parseFloat(t.value) || 0;
  if (t.classList.contains("set-reps")) set.reps = parseInt(t.value, 10) || 0;
  if (t.classList.contains("set-seg")) set.seg = parseInt(t.value, 10) || 0;
}
document.getElementById("gym-active-exercises").addEventListener("input", onCampo);
document.getElementById("gym-active-exercises").addEventListener("change", onCampo);

function agregarEjercicio(ficha) {
  activeWorkout.exercises.push(nuevoEjercicio(ficha));
  document.getElementById("gym-active-exercise-name").value = "";
  renderActiveExercises();
}

const picker = ExercisePicker.adjuntar(document.getElementById("gym-active-exercise-name"), {
  alElegir: agregarEjercicio,
  alCrear: nombre => ExerciseCreator.abrir({ nombre, alGuardar: agregarEjercicio })
});

document.getElementById("gym-active-add-exercise-form").addEventListener("submit", e => {
  e.preventDefault();
  picker.confirmar();
});

document.getElementById("gym-active-name").addEventListener("input", e => {
  if (activeWorkout) activeWorkout.name = e.target.value;
});
document.getElementById("gym-active-date").addEventListener("change", e => {
  if (activeWorkout && e.target.value) activeWorkout.date = e.target.value;
});
document.getElementById("gym-active-duration").addEventListener("input", e => {
  if (activeWorkout) activeWorkout.durationMin = parseInt(e.target.value, 10) || "";
});

document.getElementById("gym-start-empty").addEventListener("click", () => startWorkout("Entrenamiento", []));

// Avisa que se guardó un entreno: js/rangos.js muestra "Nuevos rangos" y
// js/habitos.js marca solos los hábitos vinculados a Gimnasio en esa fecha.
function avisarGuardado(fecha) {
  document.dispatchEvent(new CustomEvent("entreno:guardado", { detail: { fecha } }));
}

// Deja solo lo que se completó y sin campos vacíos (Firestore no acepta undefined).
function limpiarEjercicio(ex) {
  const out = { name: ex.name, sets: [] };
  if (ex.exerciseId) out.exerciseId = ex.exerciseId;
  if (ex.tipo === "cardio") {
    if (!(ex.minutos > 0)) return null;
    out.minutos = Number(ex.minutos);
  } else if (ex.tipo === "isometrico") {
    out.sets = ex.sets.filter(s => (Number(s.seg) || 0) > 0)
      .map(s => Object.assign({ seg: Number(s.seg) }, s.calentamiento ? { calentamiento: true } : {}));
    if (!out.sets.length) return null;
  } else {
    const asistida = ex.tipo === "peso_corporal" && ex.asistencia;
    out.sets = ex.sets
      .filter(s => (Number(s.reps) || 0) > 0 || (Number(s.kg) || 0) > 0)
      .map(s => {
        const kg = Number(s.kg) || 0, reps = Number(s.reps) || 0;
        const serie = asistida ? { asistencia: kg, reps } : { kg, reps };
        if (s.calentamiento) serie.calentamiento = true;
        return serie;
      });
    if (!out.sets.length) return null;
  }
  if (ex.rpe) out.rpe = Number(ex.rpe);
  if (ex.notas && ex.notas.trim()) out.notas = ex.notas.trim();
  return out;
}

document.getElementById("gym-active-finish").addEventListener("click", () => {
  if (!activeWorkout) return;
  const exercises = activeWorkout.exercises.map(limpiarEjercicio).filter(Boolean);
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
    endWorkout();
    return;
  }

  entrenamientosCollection().add({
    date,
    name,
    startedAt: activeWorkout.startedAt,
    durationMin: Math.max(1, Math.round((Date.now() - activeWorkout.startedAt) / 60000)),
    exercises,
    prs: computePRs(exercises)
  });
  avisarGuardado(date);

  endWorkout();
});

document.getElementById("gym-active-discard").addEventListener("click", () => {
  if (!activeWorkout.editingId && activeWorkout.exercises.length && !confirm("¿Descartar este entrenamiento?")) return;
  endWorkout();
});

/* ---------- Init ---------- */

onAuthReady(() => {
  rutinasCollection().onSnapshot(snap => {
    routinesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRoutines();
  });
  entrenamientosCollection().onSnapshot(snap => {
    historyCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    avisarHistorial();
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
    const enfocado = document.activeElement && document.activeElement.closest("#gym-active-exercises");
    if (!enfocado) renderActiveExercises();
  }
});

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
  alBorrar(cb) { oyentesBorrado.push(cb); }
};
})();
