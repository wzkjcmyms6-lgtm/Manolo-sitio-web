const HABITS_KEY = "manolo_habitos";
const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

function loadHabits() {
  return JSON.parse(localStorage.getItem(HABITS_KEY) || "[]");
}
function saveHabits(habits) {
  localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
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
  const dates = currentWeekDates();
  header.innerHTML = "<span></span>" + DAY_LABELS.map(l => `<span>${l}</span>`).join("") + "<span></span>";
}

function renderHabits() {
  const habits = loadHabits();
  const list = document.getElementById("habit-list");
  const empty = document.getElementById("habit-empty");
  const dates = currentWeekDates();

  list.innerHTML = "";
  empty.style.display = habits.length ? "none" : "block";

  habits.forEach((habit, idx) => {
    const row = document.createElement("div");
    row.className = "habit-row";

    const name = document.createElement("span");
    name.textContent = habit.name;
    row.appendChild(name);

    dates.forEach(date => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-toggle" + (habit.done.includes(date) ? " done" : "");
      btn.textContent = habit.done.includes(date) ? "✓" : "";
      btn.addEventListener("click", () => toggleDay(idx, date));
      row.appendChild(btn);
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete";
    del.textContent = "✕";
    del.addEventListener("click", () => deleteHabit(idx));
    row.appendChild(del);

    list.appendChild(row);
  });
}

function toggleDay(idx, date) {
  const habits = loadHabits();
  const habit = habits[idx];
  const pos = habit.done.indexOf(date);
  if (pos === -1) habit.done.push(date);
  else habit.done.splice(pos, 1);
  saveHabits(habits);
  renderHabits();
}

function deleteHabit(idx) {
  const habits = loadHabits();
  habits.splice(idx, 1);
  saveHabits(habits);
  renderHabits();
}

document.getElementById("habit-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("habit-name");
  const name = input.value.trim();
  if (!name) return;
  const habits = loadHabits();
  habits.push({ name, done: [] });
  saveHabits(habits);
  input.value = "";
  renderHabits();
});

renderHabitsHeader();
renderHabits();
