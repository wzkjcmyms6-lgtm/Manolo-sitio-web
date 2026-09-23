const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
let habitsCache = [];

function habitsCollection() {
  return db.collection("users").doc(currentUser.uid).collection("habitos");
}

// Devuelve las fechas (YYYY-MM-DD) de la semana actual, de lunes a domingo.
function currentWeekDates() {
  const today = new Date();
  const day = (today.getDay() + 6) % 7; // 0 = lunes
  const monday = new Date(today);
  monday.setDate(today.getDate() - day);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function renderHabitsHeader() {
  const header = document.getElementById("habit-days-header");
  header.innerHTML = "<span></span>" + DAY_LABELS.map(l => `<span>${l}</span>`).join("") + "<span></span>";
}

function renderHabits() {
  const list = document.getElementById("habit-list");
  const empty = document.getElementById("habit-empty");
  const dates = currentWeekDates();

  list.innerHTML = "";
  empty.style.display = habitsCache.length ? "none" : "block";

  habitsCache.forEach(habit => {
    const done = habit.done || [];
    const row = document.createElement("div");
    row.className = "habit-row";

    const name = document.createElement("span");
    name.textContent = habit.name;
    row.appendChild(name);

    dates.forEach(date => {
      const btn = document.createElement("button");
      btn.type = "button";
      const isDone = done.includes(date);
      btn.className = "day-toggle" + (isDone ? " done" : "");
      btn.innerHTML = isDone ? ICONS.check : "";
      btn.addEventListener("click", () => toggleDay(habit.id, date));
      row.appendChild(btn);
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete";
    del.setAttribute("aria-label", "Eliminar hábito");
    del.innerHTML = ICONS.trash;
    del.addEventListener("click", () => deleteHabit(habit.id));
    row.appendChild(del);

    list.appendChild(row);
  });
}

function toggleDay(id, date) {
  const habit = habitsCache.find(h => h.id === id);
  if (!habit) return;
  const done = habit.done || [];
  const next = done.includes(date) ? done.filter(d => d !== date) : [...done, date];
  habitsCollection().doc(id).update({ done: next });
}

function deleteHabit(id) {
  habitsCollection().doc(id).delete();
}

document.getElementById("habit-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("habit-name");
  const name = input.value.trim();
  if (!name) return;
  habitsCollection().add({ name, done: [], createdAt: Date.now() });
  input.value = "";
});

renderHabitsHeader();

onAuthReady(() => {
  habitsCollection().orderBy("createdAt").onSnapshot(snap => {
    habitsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderHabits();
  });
});
