let exerciseCache = [];

function exerciseCollection() {
  return db.collection("users").doc(currentUser.uid).collection("ejercicio");
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
  const weekStart = startOfWeek();
  const weekMinutes = exerciseCache
    .filter(e => new Date(e.date) >= weekStart)
    .reduce((sum, e) => sum + Number(e.duration), 0);
  const totalSessions = exerciseCache.length;

  document.getElementById("exercise-stats").innerHTML = `
    <div class="stat-box"><div class="value">${weekMinutes}</div><div class="label">Minutos esta semana</div></div>
    <div class="stat-box"><div class="value">${totalSessions}</div><div class="label">Entrenamientos totales</div></div>
  `;
}

function renderExercises() {
  const list = exerciseCache.slice().sort((a, b) => b.date.localeCompare(a.date));
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
  exerciseCollection().doc(id).delete();
}

document.getElementById("exercise-form").addEventListener("submit", e => {
  e.preventDefault();
  const date = document.getElementById("exercise-date").value;
  const type = document.getElementById("exercise-type").value.trim();
  const duration = document.getElementById("exercise-duration").value;
  const notes = document.getElementById("exercise-notes").value.trim();
  if (!date || !type || !duration) return;

  exerciseCollection().add({ date, type, duration, notes });
  e.target.reset();
  document.getElementById("exercise-date").valueAsDate = new Date();
});

document.getElementById("exercise-date").valueAsDate = new Date();

onAuthReady(() => {
  exerciseCollection().onSnapshot(snap => {
    exerciseCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderExercises();
  });
});
