(function () {
let runningCache = [];

function runningCollection() {
  return db.collection("users").doc(currentUser.uid).collection("running");
}

function formatPace(secPerKm) {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "--";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

function renderStats() {
  const totalKm = runningCache.reduce((sum, r) => sum + r.distance, 0);
  const totalMin = runningCache.reduce((sum, r) => sum + r.duration, 0);
  const paceSecPerKm = totalKm > 0 ? (totalMin * 60) / totalKm : 0;

  document.getElementById("running-stats").innerHTML = `
    <div class="stat-box"><div class="value">${totalKm.toFixed(1)} km</div><div class="label">Distancia total</div></div>
    <div class="stat-box"><div class="value">${runningCache.length}</div><div class="label">Salidas</div></div>
    <div class="stat-box"><div class="value">${formatPace(paceSecPerKm)}</div><div class="label">Ritmo promedio</div></div>
  `;
}

function renderList() {
  const list = runningCache.slice().sort((a, b) => b.date.localeCompare(a.date));
  const container = document.getElementById("running-list");
  const empty = document.getElementById("running-empty");

  container.innerHTML = "";
  empty.style.display = list.length ? "none" : "block";

  list.forEach(entry => {
    const pace = entry.distance > 0 ? (entry.duration * 60) / entry.distance : 0;
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div>
        <strong>${entry.distance.toFixed(2)} km</strong> — ${entry.duration} min · ${formatPace(pace)}
        <div class="meta">${entry.date}${entry.notes ? " · " + entry.notes : ""}</div>
      </div>
    `;
    const del = document.createElement("button");
    del.className = "delete";
    del.setAttribute("aria-label", "Eliminar salida");
    del.innerHTML = ICONS.trash;
    del.addEventListener("click", () => runningCollection().doc(entry.id).delete());
    item.appendChild(del);
    container.appendChild(item);
  });

  renderStats();
}

document.getElementById("running-form").addEventListener("submit", e => {
  e.preventDefault();
  const date = document.getElementById("running-date").value;
  const distance = parseFloat(document.getElementById("running-distance").value);
  const duration = parseFloat(document.getElementById("running-duration").value);
  const notes = document.getElementById("running-notes").value.trim();
  if (!date || !distance || !duration) return;

  runningCollection().add({ date, distance, duration, notes });
  e.target.reset();
  document.getElementById("running-date").valueAsDate = new Date();
});

document.getElementById("running-date").valueAsDate = new Date();

onAuthReady(() => {
  runningCollection().onSnapshot(snap => {
    runningCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderList();
  });
});
})();
