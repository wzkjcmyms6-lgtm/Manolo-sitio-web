(function () {
const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

// ---------- Economía tipo Habitica ----------
const MAX_HP = 50;
const HABITO_POS_XP = 10, HABITO_POS_GOLD = 3;
const HABITO_NEG_HP = 5;
const DIARIA_XP = 15, DIARIA_GOLD = 5;
const PENDIENTE_XP = 20, PENDIENTE_GOLD = 8;
const DAMAGE_PER_MISS = 10;

function xpToNext(level) {
  return 50 + (level - 1) * 25;
}

let player = { level: 1, xp: 0, hp: MAX_HP, gold: 0, lastProcessed: null };
let habitosCache = [];
let diariasCache = [];
let pendientesCache = [];
let recompensasCache = [];

function habitosCollection() {
  return db.collection("users").doc(currentUser.uid).collection("habitos");
}
function recompensasCollection() {
  return db.collection("users").doc(currentUser.uid).collection("recompensas");
}
function playerDocRef() {
  return db.collection("users").doc(currentUser.uid).collection("meta").doc("jugador");
}

function isoDate(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayISO() { return isoDate(new Date()); }

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
    dates.push(isoDate(d));
  }
  return dates;
}
function weekdayIndex(dateStr) {
  // 0 = lunes ... 6 = domingo, para leer el array "days" de cada diaria.
  const d = new Date(dateStr + "T00:00:00");
  return (d.getDay() + 6) % 7;
}
function diariaActiveOn(diaria, dateStr) {
  const days = diaria.days || [true, true, true, true, true, true, true];
  return !!days[weekdayIndex(dateStr)];
}

// ---------- Jugador: HUD, XP, HP, oro ----------
function savePlayer(patch) {
  return playerDocRef().set(Object.assign({}, player, patch), { merge: true });
}

function renderHud() {
  document.getElementById("hud-level").textContent = player.level;
  const need = xpToNext(player.level);
  document.getElementById("hud-hp-fill").style.width = `${Math.max(0, Math.min(100, (player.hp / MAX_HP) * 100))}%`;
  document.getElementById("hud-hp-num").textContent = `${Math.max(0, player.hp)}/${MAX_HP}`;
  document.getElementById("hud-xp-fill").style.width = `${Math.max(0, Math.min(100, (player.xp / need) * 100))}%`;
  document.getElementById("hud-xp-num").textContent = `${player.xp}/${need}`;
  document.getElementById("hud-gold-num").textContent = player.gold;
}

// Efecto flotante "+10 XP" / "-5 HP" junto al botón que se tocó.
function floatFx(el, text, cls) {
  const r = el.getBoundingClientRect();
  const fx = document.createElement("span");
  fx.className = "hud-fx " + cls;
  fx.textContent = text;
  fx.style.left = `${r.left + r.width / 2}px`;
  fx.style.top = `${r.top}px`;
  document.body.appendChild(fx);
  setTimeout(() => fx.remove(), 1000);
}

let levelUpTimer = null;
function showLevelUp(level) {
  let el = document.getElementById("levelup-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "levelup-toast";
    el.className = "levelup-toast";
    document.body.appendChild(el);
  }
  el.textContent = `¡Subiste a nivel ${level}!`;
  clearTimeout(levelUpTimer);
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  levelUpTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

// Aplica una recompensa/castigo al jugador y sube de nivel si corresponde.
// delta: { xp, gold, hp }. Los signos negativos también funcionan (para deshacer).
function applyReward(delta) {
  const next = { level: player.level, xp: player.xp, gold: Math.max(0, player.gold + (delta.gold || 0)), hp: player.hp };
  if (delta.hp) next.hp = Math.max(0, Math.min(MAX_HP, next.hp + delta.hp));
  let leveledTo = null;
  if (delta.xp) {
    next.xp += delta.xp;
    while (next.xp < 0 && next.level > 1) { // deshacer un logro puede bajar de nivel
      next.level--;
      next.xp += xpToNext(next.level);
    }
    next.xp = Math.max(0, next.xp);
    while (next.xp >= xpToNext(next.level)) {
      next.xp -= xpToNext(next.level);
      next.level++;
      leveledTo = next.level;
    }
  }
  player = Object.assign({}, player, next);
  renderHud();
  savePlayer(next);
  if (leveledTo) showLevelUp(leveledTo);
}

// Procesa los días pasados desde la última visita: cada diaria programada que
// no se marcó ese día resta vida, una sola vez por día (nunca se repite).
function processMisses() {
  const today = todayISO();
  if (!player.lastProcessed) { savePlayer({ lastProcessed: today }); player.lastProcessed = today; return; }
  if (player.lastProcessed >= today) return;
  let misses = 0;
  let cursor = new Date(player.lastProcessed + "T00:00:00");
  const end = new Date(today + "T00:00:00");
  cursor.setDate(cursor.getDate() + 1);
  while (cursor < end) {
    const dateStr = isoDate(cursor);
    diariasCache.forEach(d => {
      if (diariaActiveOn(d, dateStr) && !(d.done || []).includes(dateStr)) misses++;
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  if (misses > 0) applyReward({ hp: -misses * DAMAGE_PER_MISS });
  savePlayer({ lastProcessed: today });
  player.lastProcessed = today;
}

// ---------- Pestañas ----------
function showHabitTab(tab) {
  document.querySelectorAll("#habit-tabs .fin-tab").forEach(b => b.classList.toggle("active", b.dataset.habitTab === tab));
  ["habitos", "diarias", "pendientes", "recompensas"].forEach(t => {
    document.getElementById(`habit-tab-${t}`).hidden = t !== tab;
  });
}
document.getElementById("habit-tabs").addEventListener("click", e => {
  const btn = e.target.closest("[data-habit-tab]");
  if (btn) showHabitTab(btn.dataset.habitTab);
});

// ---------- Hábitos (+ / −) ----------
function renderHabitos() {
  const list = document.getElementById("habito-list");
  const empty = document.getElementById("habito-empty");
  list.innerHTML = "";
  empty.hidden = habitosCache.length > 0;

  habitosCache.forEach(h => {
    const row = document.createElement("div");
    row.className = "habito-row";
    const counts = `${h.posCount || 0} bien · ${h.negCount || 0} mal`;
    row.innerHTML = `
      ${h.negative ? `<button type="button" class="habito-sign-btn neg" aria-label="Mal hábito">−</button>` : ""}
      <div class="habito-name">
        <div>${escapeHtml(h.name)}</div>
        <div class="habito-counts">${h.positive && h.negative ? counts : ""}</div>
      </div>
      ${h.positive ? `<button type="button" class="habito-sign-btn pos" aria-label="Buen hábito">+</button>` : ""}
    `;
    const posBtn = row.querySelector(".habito-sign-btn.pos");
    if (posBtn) posBtn.addEventListener("click", () => {
      floatFx(posBtn, `+${HABITO_POS_XP} XP`, "xp");
      habitosCollection().doc(h.id).update({ posCount: (h.posCount || 0) + 1 });
      applyReward({ xp: HABITO_POS_XP, gold: HABITO_POS_GOLD });
    });
    const negBtn = row.querySelector(".habito-sign-btn.neg");
    if (negBtn) negBtn.addEventListener("click", () => {
      floatFx(negBtn, `-${HABITO_NEG_HP} HP`, "hp");
      habitosCollection().doc(h.id).update({ negCount: (h.negCount || 0) + 1 });
      applyReward({ hp: -HABITO_NEG_HP });
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

document.getElementById("habito-positive").addEventListener("change", e => {
  e.target.closest("label").classList.toggle("checked", e.target.checked);
});
document.getElementById("habito-negative").addEventListener("change", e => {
  e.target.closest("label").classList.toggle("checked", e.target.checked);
});

document.getElementById("habito-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("habito-name");
  const name = input.value.trim();
  if (!name) return;
  const positive = document.getElementById("habito-positive").checked;
  const negative = document.getElementById("habito-negative").checked;
  if (!positive && !negative) return;
  habitosCollection().add({ type: "habito", name, positive, negative, posCount: 0, negCount: 0, createdAt: Date.now() });
  input.value = "";
});

// ---------- Diarias (semana, con daño si se fallan) ----------
function renderHabitsHeader() {
  const header = document.getElementById("habit-days-header");
  header.innerHTML = "<span></span>" + DAY_LABELS.map(l => `<span>${l}</span>`).join("") + "<span></span>";
}

function renderDiariaDaysPick() {
  const wrap = document.getElementById("diaria-days-pick");
  wrap.innerHTML = DAY_LABELS.map((l, i) => `<button type="button" data-day="${i}" class="on">${l}</button>`).join("");
}
document.getElementById("diaria-days-pick").addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (btn) btn.classList.toggle("on");
});

function renderDiarias() {
  const list = document.getElementById("diaria-list");
  const empty = document.getElementById("diaria-empty");
  const dates = currentWeekDates();
  const today = todayISO();

  list.innerHTML = "";
  empty.hidden = diariasCache.length > 0;

  diariasCache.forEach(diaria => {
    const done = diaria.done || [];
    const row = document.createElement("div");
    row.className = "habit-row";

    const name = document.createElement("span");
    name.textContent = diaria.name;
    row.appendChild(name);

    dates.forEach(date => {
      const btn = document.createElement("button");
      btn.type = "button";
      const active = diariaActiveOn(diaria, date);
      const isDone = done.includes(date);
      btn.className = "day-toggle" + (isDone ? " done" : "") + (active ? "" : " off");
      btn.disabled = !active;
      btn.innerHTML = isDone ? ICONS.check : "";
      btn.addEventListener("click", () => toggleDiariaDay(diaria, date, today));
      row.appendChild(btn);
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete";
    del.setAttribute("aria-label", "Eliminar diaria");
    del.innerHTML = ICONS.trash;
    del.addEventListener("click", () => habitosCollection().doc(diaria.id).delete());
    row.appendChild(del);

    list.appendChild(row);
  });
  renderIcons(list);
}

function toggleDiariaDay(diaria, date, today) {
  const done = diaria.done || [];
  const willBeDone = !done.includes(date);
  const next = willBeDone ? [...done, date] : done.filter(d => d !== date);
  habitosCollection().doc(diaria.id).update({ done: next });
  // Solo el día de hoy da (o quita) recompensa; marcar otros días es solo registro.
  if (date === today) {
    applyReward({ xp: willBeDone ? DIARIA_XP : -DIARIA_XP, gold: willBeDone ? DIARIA_GOLD : -DIARIA_GOLD });
  }
}

document.getElementById("diaria-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("diaria-name");
  const name = input.value.trim();
  if (!name) return;
  const days = Array.from(document.querySelectorAll("#diaria-days-pick button")).map(b => b.classList.contains("on"));
  habitosCollection().add({ type: "diaria", name, days, done: [], createdAt: Date.now() });
  input.value = "";
  renderDiariaDaysPick();
});

// ---------- Pendientes (to-do de una sola vez) ----------
function renderPendientes() {
  const list = document.getElementById("pendiente-list");
  const empty = document.getElementById("pendiente-empty");
  list.innerHTML = "";
  const sorted = pendientesCache.slice().sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
  empty.hidden = sorted.length > 0;

  sorted.forEach(p => {
    const row = document.createElement("div");
    row.className = "pendiente-row" + (p.done ? " done" : "");
    row.innerHTML = `
      <button type="button" class="pendiente-check${p.done ? " done" : ""}" aria-label="Marcar pendiente">${p.done ? ICONS.check : ""}</button>
      <span class="pendiente-name">${escapeHtml(p.name)}</span>
    `;
    row.querySelector(".pendiente-check").addEventListener("click", e => {
      const willBeDone = !p.done;
      habitosCollection().doc(p.id).update({ done: willBeDone });
      if (willBeDone) floatFx(e.currentTarget, `+${PENDIENTE_XP} XP`, "xp");
      applyReward({ xp: willBeDone ? PENDIENTE_XP : -PENDIENTE_XP, gold: willBeDone ? PENDIENTE_GOLD : -PENDIENTE_GOLD });
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete";
    del.setAttribute("aria-label", "Eliminar pendiente");
    del.innerHTML = ICONS.trash;
    del.addEventListener("click", () => habitosCollection().doc(p.id).delete());
    row.appendChild(del);
    list.appendChild(row);
  });
  renderIcons(list);
}

document.getElementById("pendiente-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("pendiente-name");
  const name = input.value.trim();
  if (!name) return;
  habitosCollection().add({ type: "pendiente", name, done: false, createdAt: Date.now() });
  input.value = "";
});

// ---------- Recompensas (canjeables por oro) ----------
function renderRecompensas() {
  const list = document.getElementById("recompensa-list");
  const empty = document.getElementById("recompensa-empty");
  list.innerHTML = "";
  empty.hidden = recompensasCache.length > 0;

  recompensasCache.forEach(r => {
    const canAfford = player.gold >= r.cost;
    const row = document.createElement("div");
    row.className = "recompensa-row";
    row.innerHTML = `
      <span class="recompensa-name">${escapeHtml(r.title)}</span>
      <span class="recompensa-cost"><span data-icon="coin"></span>${r.cost}</span>
      <button type="button" class="recompensa-buy"${canAfford ? "" : " disabled"}>Canjear</button>
    `;
    row.querySelector(".recompensa-buy").addEventListener("click", e => {
      if (player.gold < r.cost) return;
      floatFx(e.currentTarget, `-${r.cost}`, "gold");
      applyReward({ gold: -r.cost });
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete";
    del.setAttribute("aria-label", "Eliminar recompensa");
    del.innerHTML = ICONS.trash;
    del.addEventListener("click", () => recompensasCollection().doc(r.id).delete());
    row.appendChild(del);
    list.appendChild(row);
  });
  renderIcons(list);
}

document.getElementById("recompensa-form").addEventListener("submit", e => {
  e.preventDefault();
  const title = document.getElementById("recompensa-name").value.trim();
  const cost = parseInt(document.getElementById("recompensa-cost").value, 10);
  if (!title || !cost || cost < 1) return;
  recompensasCollection().add({ title, cost, createdAt: Date.now() });
  e.target.reset();
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

renderHabitsHeader();
renderDiariaDaysPick();
renderHud();

onAuthReady(() => {
  playerDocRef().onSnapshot(snap => {
    if (snap.exists) player = Object.assign({ level: 1, xp: 0, hp: MAX_HP, gold: 0, lastProcessed: null }, snap.data());
    renderHud();
    renderRecompensas();
  });
  habitosCollection().orderBy("createdAt").onSnapshot(snap => {
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    habitosCache = all.filter(h => (h.type || "habito") === "habito");
    diariasCache = all.filter(h => h.type === "diaria");
    pendientesCache = all.filter(h => h.type === "pendiente");
    renderHabitos();
    renderDiarias();
    renderPendientes();
    processMisses();
  });
  recompensasCollection().orderBy("createdAt").onSnapshot(snap => {
    recompensasCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRecompensas();
  });
});
})();
