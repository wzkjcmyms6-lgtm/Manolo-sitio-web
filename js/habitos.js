(function () {
const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const HEAT_WEEKS = 10;
const EMOJIS = ["💧", "🏃", "🧘", "📖", "💪", "🛌", "🥗", "🚭", "🧹", "🙏", "💊", "🎯", "✍️", "🎨", "🚴", "🧠"];

const PERIOD_LABELS = { manana: "Mañana", noche: "Noche" };

let habitosCache = [];
let emojiChoice = EMOJIS[0];
let freqChoice = "diario";
let periodChoice = "cualquiera";

function habitosCollection() {
  return db.collection("users").doc(currentUser.uid).collection("habitos");
}

function isoDate(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayISO() { return isoDate(new Date()); }
function weekdayIndex(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return (d.getDay() + 6) % 7; // 0 = lunes
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
function formatDateEs(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function isDue(habit, dateStr) {
  if (habit.freqType === "dias") return !!(habit.days || [])[weekdayIndex(dateStr)];
  return true; // "diario" y "semana": cualquier día cuenta.
}

// ---------- Escena de la hora del día (mañana/noche), con transición animada ----------
function periodNow() {
  const h = new Date().getHours();
  return h >= 6 && h < 19 ? "manana" : "noche";
}
let selectedPeriod = periodNow();

function treeSVG(x, scale, fill, hi) {
  return `<g transform="translate(${x},0) scale(${scale})">
    <rect x="-2" y="58" width="4" height="16" fill="#241f19"/>
    <ellipse cx="0" cy="50" rx="17" ry="19" fill="${fill}"/>
    <ellipse cx="6" cy="43" rx="6" ry="7" fill="${hi}" opacity="0.75"/>
  </g>`;
}
function hillsSVG(fill) {
  return `<path d="M0,112 C60,88 130,88 190,108 C250,128 310,82 400,98 L400,150 L0,150 Z" fill="${fill}"/>`;
}
function starsSVG(seedCount) {
  const pts = [[36, 30], [96, 18], [150, 42], [210, 22], [270, 34], [320, 16], [360, 46], [60, 55]];
  return pts.slice(0, seedCount).map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 1.6 : 1}" fill="#e9e4d8" opacity="${0.35 + (i % 4) * 0.15}"/>`).join("");
}

// Ambas escenas comparten exactamente las mismas colinas/árboles (misma posición),
// así que al alternar su opacidad con una transición CSS el fondo "se disuelve"
// de una a otra en vez de saltar de golpe: eso es lo que da la sensación de
// animación día/noche.
function heroSceneSVG(period) {
  const trees = treeSVG(40, 0.9, "#3f7d6f", "#5aa08f") + treeSVG(345, 1.05, "#376c60", "#4f9585") + treeSVG(280, 0.55, "#3f7d6f", "#5aa08f");
  if (period === "noche") {
    return `<svg viewBox="0 0 400 150" class="habit-hero-svg" preserveAspectRatio="xMidYMax slice">
      <rect width="400" height="150" fill="#0c0b10"/>
      ${starsSVG(8)}
      <circle cx="150" cy="46" r="20" fill="#f4d9a3"/>
      <circle cx="158" cy="40" r="18" fill="#0c0b10"/>
      ${hillsSVG("#1a1712")}
      ${trees}
    </svg>`;
  }
  return `<svg viewBox="0 0 400 150" class="habit-hero-svg" preserveAspectRatio="xMidYMax slice">
    <defs><linearGradient id="skyManana" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1c140f"/><stop offset="100%" stop-color="#3a2312"/>
    </linearGradient></defs>
    <rect width="400" height="150" fill="url(#skyManana)"/>
    <circle cx="180" cy="108" r="60" fill="var(--accent-1)" opacity="0.18"/>
    <circle cx="180" cy="108" r="38" fill="var(--accent-2)" opacity="0.35"/>
    <circle cx="180" cy="108" r="20" fill="#ffd9a0"/>
    ${hillsSVG("#1f1a13")}
    ${trees}
  </svg>`;
}

function ensureHeroScenes() {
  const hero = document.getElementById("habit-hero");
  if (hero.dataset.built) return;
  hero.innerHTML =
    `<div class="hero-scene hero-scene-manana">${heroSceneSVG("manana")}</div>` +
    `<div class="hero-scene hero-scene-noche">${heroSceneSVG("noche")}</div>`;
  hero.dataset.built = "1";
}

function renderHero() {
  ensureHeroScenes();
  document.querySelector(".hero-scene-manana").classList.toggle("hero-scene--active", selectedPeriod === "manana");
  document.querySelector(".hero-scene-noche").classList.toggle("hero-scene--active", selectedPeriod === "noche");
  document.querySelectorAll("#habit-period-tabs .fin-tab").forEach(b => b.classList.toggle("active", b.dataset.period === selectedPeriod));
  document.getElementById("habit-period-label").textContent = PERIOD_LABELS[selectedPeriod];
}
document.getElementById("habit-period-tabs").addEventListener("click", e => {
  const btn = e.target.closest("[data-period]");
  if (!btn || btn.dataset.period === selectedPeriod) return;
  selectedPeriod = btn.dataset.period;
  renderHero();
  renderHabitos();
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function freqLabel(habit) {
  if (habit.freqType === "semana") { const n = habit.timesPerWeek || 1; return `${n} ${n === 1 ? "vez" : "veces"} por semana`; }
  if (habit.freqType === "dias") {
    const names = (habit.days || []).map((on, i) => on ? DAY_NAMES[i] : null).filter(Boolean);
    return names.length ? names.join(", ") : "Sin días elegidos";
  }
  return "Todos los días";
}

// Racha actual: días consecutivos cumplidos, contando hacia atrás desde hoy
// (o desde ayer si hoy todavía no se marcó). Los días en que el hábito no
// tocaba (freqType "dias") se saltan sin cortar la racha.
function currentStreak(habit, fromDate) {
  const done = new Set(habit.done || []);
  let date = fromDate || todayISO();
  if (!done.has(date)) date = addDays(date, -1);
  let streak = 0;
  for (let guard = 0; guard < 2000; guard++) {
    if (!isDue(habit, date)) { date = addDays(date, -1); continue; }
    if (!done.has(date)) break;
    streak++;
    date = addDays(date, -1);
  }
  return streak;
}

// Mejor racha histórica: recorre desde que se creó el hábito hasta hoy.
function bestStreak(habit) {
  const created = habit.createdAt ? isoDate(new Date(habit.createdAt)) : todayISO();
  let best = 0, streak = 0;
  let date = created;
  const done = new Set(habit.done || []);
  for (let guard = 0; guard < 2000 && date <= todayISO(); guard++) {
    if (isDue(habit, date)) {
      if (done.has(date)) { streak++; best = Math.max(best, streak); }
      else streak = 0;
    }
    date = addDays(date, 1);
  }
  return best;
}

// ---------- Pestañas ----------
function showHabitSection(section) {
  document.querySelectorAll("#habit-section-tabs .fin-tab").forEach(b => {
    b.classList.toggle("active", b.dataset.habitSection === section);
  });
  ["habitos", "estadisticas", "anadir"].forEach(s => {
    document.getElementById(`habit-section-${s}`).hidden = s !== section;
  });
  if (section === "estadisticas") renderEstadisticas();
}
document.getElementById("habit-section-tabs").addEventListener("click", e => {
  const btn = e.target.closest("[data-habit-section]");
  if (btn) showHabitSection(btn.dataset.habitSection);
});

// ---------- Pestaña Hábitos: lista + marcar hoy ----------
function renderHabitos() {
  const list = document.getElementById("habito-list");
  const empty = document.getElementById("habito-empty");
  list.innerHTML = "";

  const shown = habitosCache.filter(h => {
    const t = h.timeOfDay || "cualquiera";
    return t === selectedPeriod || t !== "manana" && t !== "noche";
  });
  empty.hidden = shown.length > 0;
  empty.textContent = habitosCache.length
    ? `Nada para ${PERIOD_LABELS[selectedPeriod].toLowerCase()}. Prueba con otro momento del día.`
    : "Aún no tienes hábitos. Crea el primero en \"Añadir hábito\".";

  const today = todayISO();
  shown.forEach(h => {
    const done = (h.done || []).includes(today);
    const due = isDue(h, today);
    const row = document.createElement("div");
    row.className = "habito-row";
    row.innerHTML = `
      <span class="habito-emoji">${h.emoji || "📌"}</span>
      <div class="habito-name">
        <div>${escapeHtml(h.name)}</div>
        <div class="habito-freq">${escapeHtml(freqLabel(h))}</div>
      </div>
      ${due
        ? `<button type="button" class="habito-check${done ? " done" : ""}" aria-label="Marcar hoy">${done ? ICONS.check : ""}</button>`
        : `<span class="habito-not-due">No toca hoy</span>`}
    `;
    const check = row.querySelector(".habito-check");
    if (check) check.addEventListener("click", () => {
      const willBeDone = !done;
      const next = willBeDone ? [...(h.done || []), today] : (h.done || []).filter(d => d !== today);
      habitosCollection().doc(h.id).update({ done: next });
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete";
    del.setAttribute("aria-label", "Eliminar hábito");
    del.innerHTML = ICONS.trash;
    del.addEventListener("click", () => habitosCollection().doc(h.id).delete());
    row.appendChild(del);
    list.appendChild(row);
  });
  renderIcons(list);
}

// ---------- Pestaña Estadísticas ----------
function habitSparkline(habit) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(todayISO(), i - 13));
  const done = new Set(habit.done || []);
  let cum = 0;
  const values = days.map(d => { if (done.has(d)) cum++; return cum; });
  const W = 280, H = 60, top = 6, bottom = 54;
  const max = Math.max(values[values.length - 1], 1);
  const x = i => (i / (days.length - 1)) * W;
  const y = v => bottom - (v / max) * (bottom - top);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${W},${bottom} L0,${bottom} Z`;
  return `<svg viewBox="0 0 ${W} ${H}" class="habito-spark" preserveAspectRatio="none">
    <path d="${area}" class="habito-spark-area"/>
    <path d="${line}" class="habito-spark-line" fill="none"/>
  </svg>`;
}

function renderStatCards() {
  const today = todayISO();
  const dueToday = habitosCache.filter(h => isDue(h, today));
  const doneToday = dueToday.filter(h => (h.done || []).includes(today));
  const monthPrefix = today.slice(0, 7);
  const daysWithSomething = new Set();
  habitosCache.forEach(h => (h.done || []).forEach(d => { if (d.startsWith(monthPrefix)) daysWithSomething.add(d); }));
  const mejorRacha = habitosCache.reduce((m, h) => Math.max(m, bestStreak(h)), 0);

  const cards = [
    { icon: "habits", label: "hábitos totales", value: habitosCache.length },
    { icon: "trophy", label: "mejor racha", value: `${mejorRacha} día${mejorRacha === 1 ? "" : "s"}` },
    { icon: "check", label: "hoy", value: `${doneToday.length}/${dueToday.length}` },
    { icon: "calendar", label: "este mes", value: `${daysWithSomething.size} día${daysWithSomething.size === 1 ? "" : "s"}` }
  ];
  document.getElementById("habit-stats-row").innerHTML = cards.map(c => `
    <div class="stat-box habit-stat-box">
      <div class="habit-stat-icon" data-icon="${c.icon}"></div>
      <div class="label">${c.label}</div>
      <div class="value">${c.value}</div>
    </div>
  `).join("");
}

function renderHeatCal() {
  const el = document.getElementById("heat-cal");
  const todayStr = todayISO();
  const monday = addDays(todayStr, -weekdayIndex(todayStr));
  const startMonday = addDays(monday, -(HEAT_WEEKS - 1) * 7);

  let html = DAY_LETTERS.map((l, i) => `<span class="heat-wd" style="grid-column:1;grid-row:${i + 2}">${l}</span>`).join("");
  let lastMonth = null;
  for (let w = 0; w < HEAT_WEEKS; w++) {
    const weekMonday = addDays(startMonday, w * 7);
    const m = Number(weekMonday.slice(5, 7)) - 1;
    if (m !== lastMonth) {
      html += `<span class="heat-month" style="grid-column:${w + 2};grid-row:1">${MONTH_NAMES[m]}</span>`;
      lastMonth = m;
    }
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekMonday, d);
      if (date > todayStr) continue;
      const due = habitosCache.filter(h => isDue(h, date) && h.createdAt && date >= isoDate(new Date(h.createdAt)));
      const done = due.filter(h => (h.done || []).includes(date));
      const ratio = due.length ? done.length / due.length : 0;
      let level = 0;
      if (ratio >= 1 && due.length) level = 4;
      else if (ratio > 0.67) level = 3;
      else if (ratio > 0.34) level = 2;
      else if (ratio > 0) level = 1;
      html += `<span class="heat-day l${level}" style="grid-column:${w + 2};grid-row:${d + 2}" title="${date}: ${done.length}/${due.length}">${Number(date.slice(8))}</span>`;
    }
  }
  el.style.gridTemplateColumns = `18px repeat(${HEAT_WEEKS}, 24px)`;
  el.innerHTML = html;
  el.scrollLeft = el.scrollWidth;
}

function renderBreakdown() {
  const wrap = document.getElementById("habito-breakdown");
  const empty = document.getElementById("habito-breakdown-empty");
  empty.hidden = habitosCache.length > 0;
  wrap.innerHTML = habitosCache.map(h => {
    const total = (h.done || []).length;
    const best = bestStreak(h);
    const created = h.createdAt ? formatDateEs(isoDate(new Date(h.createdAt))) : "—";
    return `
      <div class="habito-breakdown-card">
        <div class="habito-breakdown-head">
          <span class="habito-emoji-badge">${h.emoji || "📌"}</span>
          <div class="habito-name">
            <div>${escapeHtml(h.name)}</div>
            <div class="habito-freq">${escapeHtml(freqLabel(h))}</div>
          </div>
        </div>
        <div class="habito-breakdown-stats">
          <div><span>mejor racha</span><strong>${best} día${best === 1 ? "" : "s"}</strong></div>
          <div><span>total</span><strong>${total}</strong></div>
          <div><span>desde el</span><strong>${created}</strong></div>
        </div>
        ${habitSparkline(h)}
      </div>
    `;
  }).join("");
}

function renderEstadisticas() {
  renderHeatCal();
  renderStatCards();
  renderBreakdown();
  renderIcons(document.getElementById("habit-section-estadisticas"));
}

// ---------- Pestaña Añadir hábito ----------
function renderEmojiPick() {
  const el = document.getElementById("habito-emoji-pick");
  el.innerHTML = EMOJIS.map(e => `<button type="button" class="habito-emoji-btn${e === emojiChoice ? " selected" : ""}" data-emoji="${e}">${e}</button>`).join("");
}
document.getElementById("habito-emoji-pick").addEventListener("click", e => {
  const btn = e.target.closest("[data-emoji]");
  if (!btn) return;
  emojiChoice = btn.dataset.emoji;
  renderEmojiPick();
});

function renderAddDaysPick() {
  const el = document.getElementById("add-habito-days");
  el.innerHTML = DAY_LETTERS.map((l, i) => `<button type="button" data-day="${i}" class="diaria-days-pick-btn on">${l}</button>`).join("");
}
document.getElementById("add-habito-days").addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (btn) btn.classList.toggle("on");
});

document.getElementById("habito-freq-pick").addEventListener("click", e => {
  const btn = e.target.closest("[data-freq]");
  if (!btn) return;
  freqChoice = btn.dataset.freq;
  document.querySelectorAll("#habito-freq-pick .freq-opt").forEach(b => b.classList.toggle("active", b === btn));
  document.getElementById("add-habito-days").hidden = freqChoice !== "dias";
  document.getElementById("add-habito-times").hidden = freqChoice !== "semana";
});

document.getElementById("habito-period-pick").addEventListener("click", e => {
  const btn = e.target.closest("[data-period]");
  if (!btn) return;
  periodChoice = btn.dataset.period;
  document.querySelectorAll("#habito-period-pick .freq-opt").forEach(b => b.classList.toggle("active", b === btn));
});

document.getElementById("add-habito-form").addEventListener("submit", e => {
  e.preventDefault();
  const nameInput = document.getElementById("add-habito-name");
  const name = nameInput.value.trim();
  if (!name) return;

  const data = { name, emoji: emojiChoice, freqType: freqChoice, timeOfDay: periodChoice, done: [], createdAt: Date.now() };
  if (freqChoice === "dias") {
    data.days = Array.from(document.querySelectorAll("#add-habito-days button")).map(b => b.classList.contains("on"));
    if (!data.days.some(Boolean)) return;
  }
  if (freqChoice === "semana") {
    data.timesPerWeek = Math.max(1, Math.min(7, parseInt(document.getElementById("add-habito-times-input").value, 10) || 1));
  }
  habitosCollection().add(data);

  nameInput.value = "";
  emojiChoice = EMOJIS[0];
  freqChoice = "diario";
  periodChoice = "cualquiera";
  renderEmojiPick();
  renderAddDaysPick();
  document.querySelectorAll("#habito-freq-pick .freq-opt").forEach(b => b.classList.toggle("active", b.dataset.freq === "diario"));
  document.querySelectorAll("#habito-period-pick .freq-opt").forEach(b => b.classList.toggle("active", b.dataset.period === "cualquiera"));
  document.getElementById("add-habito-days").hidden = true;
  document.getElementById("add-habito-times").hidden = true;
  showHabitSection("habitos");
});

renderEmojiPick();
renderAddDaysPick();
renderHero();

onAuthReady(() => {
  habitosCollection().orderBy("createdAt").onSnapshot(snap => {
    habitosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderHabitos();
    if (!document.getElementById("habit-section-estadisticas").hidden) renderEstadisticas();
  });
});
})();
