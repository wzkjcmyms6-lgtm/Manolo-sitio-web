const EXERCISE_KEY = "manolo_ejercicio";

function loadExercises() {
  return JSON.parse(localStorage.getItem(EXERCISE_KEY) || "[]");
}
function saveExercises(list) {
  localStorage.setItem(EXERCISE_KEY, JSON.stringify(list));
}

function startOfWeek() {
  const today = new Date();
  const day = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function renderStats() {
  const list = loadExercises();
  const weekStart = startOfWeek();
  const weekMinutes = list
    .filter(e => new Date(e.date) >= weekStart)
    .reduce((sum, e) => sum + Number(e.duration), 0);
  const totalSessions = list.length;

  document.getElementById("exercise-stats").innerHTML = `
    <div class="stat-box"><div class="value">${weekMinutes}</div><div class="label">Minutos esta semana</div></div>
    <div class="stat-box"><div class="value">${totalSessions}</div><div class="label">Entrenamientos totales</div></div>
  `;
}

function renderExercises() {
  const list = loadExercises().slice().sort((a, b) => b.date.localeCompare(a.date));
  const container = document.getElementById("exercise-list");
  const empty = document.getElementById("exercise-empty");

  container.innerHTML = "";
  empty.style.display = list.length ? "none" : "block";

  list.forEach(entry => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div>
        <strong>${entry.type}</strong> — ${entry.duration} min
        <div class="meta">${entry.date}${entry.notes ? " · " + entry.notes : ""}</div>
      </div>
    `;
    const del = document.createElement("button");
    del.className = "delete";
    del.setAttribute("aria-label", "Eliminar entrenamiento");
    del.innerHTML = ICONS.trash;
    del.addEventListener("click", () => deleteExercise(entry.id));
    item.appendChild(del);
    container.appendChild(item);
  });

  renderStats();
}

function deleteExercise(id) {
  const list = loadExercises().filter(e => e.id !== id);
  saveExercises(list);
  renderExercises();
}

document.getElementById("exercise-form").addEventListener("submit", e => {
  e.preventDefault();
  const date = document.getElementById("exercise-date").value;
  const type = document.getElementById("exercise-type").value.trim();
  const duration = document.getElementById("exercise-duration").value;
  const notes = document.getElementById("exercise-notes").value.trim();
  if (!date || !type || !duration) return;

  const list = loadExercises();
  list.push({ id: Date.now(), date, type, duration, notes });
  saveExercises(list);
  e.target.reset();
  renderExercises();
});

document.getElementById("exercise-date").valueAsDate = new Date();
renderExercises();
