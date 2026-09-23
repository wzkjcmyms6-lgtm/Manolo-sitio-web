(function () {
const EXERCISE_SUGGESTIONS = [
  "Sentadilla (Barra)", "Peso Muerto Rumano (Barra)", "Press de Banca (Barra)",
  "Press de Banca (Mancuerna)", "Press de Banca Inclinado (Mancuerna)",
  "Press de Hombros (Mancuerna)", "Empuje de Caderas (Barra)", "Press de Piernas",
  "Extensión de Pierna", "Curl de Pierna", "Jalón al Pecho (Cable)",
  "Remo en Punta", "Remo Sentado con Agarre en V (Cable)",
  "Curl de Bíceps (Mancuerna)", "Curl de Bíceps Inclinado (Mancuerna)",
  "Elevación Lateral (Mancuerna)", "Press Militar (Barra)", "Dominadas",
  "Fondos", "Plancha", "Zancadas", "Caminar"
];

let routinesCache = [];
let historyCache = [];
let activeWorkout = null; // { name, startedAt, exercises: [{ name, sets: [{kg, reps}] }] }
let timerInterval = null;

function rutinasCollection() {
  return db.collection("users").doc(currentUser.uid).collection("rutinas");
}
function entrenamientosCollection() {
  return db.collection("users").doc(currentUser.uid).collection("entrenamientos");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDateEs(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function defaultSets() {
  return [{ kg: "", reps: "" }, { kg: "", reps: "" }, { kg: "", reps: "" }];
}

function computeVolume(exercises) {
  return exercises.reduce((sum, ex) =>
    sum + ex.sets.reduce((s, set) => s + (set.kg || 0) * (set.reps || 0), 0), 0);
}

function maxKgForExercise(name) {
  const key = name.trim().toLowerCase();
  let max = 0;
  historyCache.forEach(w => {
    (w.exercises || []).forEach(ex => {
      if (ex.name.trim().toLowerCase() === key) {
        (ex.sets || []).forEach(s => { if (s.reps > 0 && s.kg > max) max = s.kg; });
      }
    });
  });
  return max;
}

function computePRs(exercises) {
  let count = 0;
  exercises.forEach(ex => {
    const prevMax = maxKgForExercise(ex.name);
    const sessionMax = Math.max(0, ...ex.sets.filter(s => s.reps > 0).map(s => s.kg));
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
    <input type="text" class="routine-exercise-input" list="gym-exercise-suggestions" placeholder="Ejercicio" value="${escapeHtml(value)}">
    <button type="button" class="delete-row" aria-label="Quitar">${ICONS.close}</button>
  `;
  row.querySelector(".delete-row").addEventListener("click", () => row.remove());
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

function renderHistory() {
  const list = historyCache.slice().sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  const container = document.getElementById("gym-history");
  const empty = document.getElementById("gym-history-empty");
  container.innerHTML = "";
  empty.hidden = list.length > 0;

  list.forEach(w => {
    const volume = computeVolume(w.exercises || []);
    const exSummary = (w.exercises || [])
      .map(ex => `${ex.sets.length} series ${ex.name}`)
      .join(" · ");
    const card = document.createElement("div");
    card.className = "workout-history-card";
    card.innerHTML = `
      <div class="workout-history-head">
        <div>
          <h3>${escapeHtml(w.name)}</h3>
          <span class="meta">${formatDateEs(w.date)}</span>
        </div>
        <button type="button" class="delete" aria-label="Eliminar entrenamiento">${ICONS.trash}</button>
      </div>
      <div class="stat-row-mini">
        <div><span class="v">${w.durationMin}min</span><span class="l">Tiempo</span></div>
        <div><span class="v">${volume.toLocaleString("es-ES")} kg</span><span class="l">Volumen</span></div>
        <div><span class="v">${w.prs || 0} 🏅</span><span class="l">Récords</span></div>
      </div>
      <p class="workout-history-exercises">${exSummary}</p>
    `;
    card.querySelector(".delete").addEventListener("click", () => entrenamientosCollection().doc(w.id).delete());
    container.appendChild(card);
  });
}

/* ---------- Entrenamiento activo ---------- */

function startWorkout(name, exerciseNames) {
  activeWorkout = {
    name: name || "Entrenamiento",
    startedAt: Date.now(),
    exercises: (exerciseNames || []).map(n => ({ name: n, sets: defaultSets() }))
  };
  document.getElementById("gym-active-name").value = activeWorkout.name;
  document.getElementById("gym-home").hidden = true;
  document.getElementById("gym-active").hidden = false;
  renderActiveExercises();
  startTimer();
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

function renderActiveExercises() {
  const container = document.getElementById("gym-active-exercises");
  container.innerHTML = "";

  activeWorkout.exercises.forEach((ex, exIndex) => {
    const setsHtml = ex.sets.map((set, setIndex) => `
      <div class="set-row" data-set-index="${setIndex}">
        <span class="set-num">${setIndex + 1}</span>
        <input type="number" class="set-kg" inputmode="decimal" min="0" step="0.5" placeholder="0" value="${set.kg}">
        <input type="number" class="set-reps" inputmode="numeric" min="0" step="1" placeholder="0" value="${set.reps}">
        <button type="button" class="delete-set" aria-label="Eliminar serie">${ICONS.close}</button>
      </div>
    `).join("");

    const card = document.createElement("div");
    card.className = "exercise-card";
    card.dataset.exIndex = exIndex;
    card.innerHTML = `
      <div class="exercise-card-head">
        <h3>${escapeHtml(ex.name)}</h3>
        <button type="button" class="delete" aria-label="Eliminar ejercicio">${ICONS.trash}</button>
      </div>
      <div class="set-table">
        <div class="set-row set-row-header"><span>SERIE</span><span>KG</span><span>REPS</span><span></span></div>
        ${setsHtml}
      </div>
      <button type="button" class="link-btn add-set-btn">+ Serie</button>
    `;
    container.appendChild(card);
  });
}

document.getElementById("gym-active-exercises").addEventListener("click", e => {
  const exCard = e.target.closest(".exercise-card");
  if (!exCard) return;
  const exIndex = Number(exCard.dataset.exIndex);

  if (e.target.closest(".delete-set")) {
    const setRow = e.target.closest(".set-row");
    const setIndex = Number(setRow.dataset.setIndex);
    activeWorkout.exercises[exIndex].sets.splice(setIndex, 1);
    renderActiveExercises();
    return;
  }
  if (e.target.closest(".delete")) {
    activeWorkout.exercises.splice(exIndex, 1);
    renderActiveExercises();
    return;
  }
  if (e.target.closest(".add-set-btn")) {
    activeWorkout.exercises[exIndex].sets.push({ kg: "", reps: "" });
    renderActiveExercises();
  }
});

document.getElementById("gym-active-exercises").addEventListener("input", e => {
  const exCard = e.target.closest(".exercise-card");
  if (!exCard) return;
  const exIndex = Number(exCard.dataset.exIndex);
  const setRow = e.target.closest(".set-row");
  if (!setRow || setRow.classList.contains("set-row-header")) return;
  const setIndex = Number(setRow.dataset.setIndex);
  const set = activeWorkout.exercises[exIndex].sets[setIndex];
  if (e.target.classList.contains("set-kg")) set.kg = parseFloat(e.target.value) || 0;
  if (e.target.classList.contains("set-reps")) set.reps = parseInt(e.target.value, 10) || 0;
});

document.getElementById("gym-active-add-exercise-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("gym-active-exercise-name");
  const name = input.value.trim();
  if (!name) return;
  activeWorkout.exercises.push({ name, sets: defaultSets() });
  input.value = "";
  renderActiveExercises();
});

document.getElementById("gym-active-name").addEventListener("input", e => {
  if (activeWorkout) activeWorkout.name = e.target.value;
});

document.getElementById("gym-start-empty").addEventListener("click", () => startWorkout("Entrenamiento", []));

document.getElementById("gym-active-finish").addEventListener("click", () => {
  if (!activeWorkout) return;

  const exercises = activeWorkout.exercises
    .filter(ex => ex.sets.some(s => (s.reps || 0) > 0 || (s.kg || 0) > 0))
    .map(ex => ({
      name: ex.name,
      sets: ex.sets
        .filter(s => (s.reps || 0) > 0 || (s.kg || 0) > 0)
        .map(s => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 }))
    }));

  if (!exercises.length) {
    endWorkout();
    return;
  }

  const durationMin = Math.max(1, Math.round((Date.now() - activeWorkout.startedAt) / 60000));
  const prs = computePRs(exercises);
  const date = new Date().toISOString().slice(0, 10);

  entrenamientosCollection().add({
    date,
    name: (activeWorkout.name || "Entrenamiento").trim() || "Entrenamiento",
    startedAt: activeWorkout.startedAt,
    durationMin,
    exercises,
    prs
  });

  endWorkout();
});

document.getElementById("gym-active-discard").addEventListener("click", () => {
  if (activeWorkout.exercises.length && !confirm("¿Descartar este entrenamiento?")) return;
  endWorkout();
});

/* ---------- Init ---------- */

document.getElementById("gym-exercise-suggestions").innerHTML =
  EXERCISE_SUGGESTIONS.map(n => `<option value="${escapeHtml(n)}"></option>`).join("");

onAuthReady(() => {
  rutinasCollection().onSnapshot(snap => {
    routinesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRoutines();
  });
  entrenamientosCollection().onSnapshot(snap => {
    historyCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderHistory();
  });
});
})();
