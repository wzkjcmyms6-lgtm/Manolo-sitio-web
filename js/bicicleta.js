(function () {
let cyclingCache = [];

function cyclingCollection() {
  return db.collection("users").doc(currentUser.uid).collection("bicicleta");
}

function renderStats() {
  const totalKm = cyclingCache.reduce((sum, r) => sum + r.distance, 0);
  const totalMin = cyclingCache.reduce((sum, r) => sum + r.duration, 0);
  const avgSpeed = totalMin > 0 ? totalKm / (totalMin / 60) : 0;

  document.getElementById("cycling-stats").innerHTML = `
    <div class="stat-box"><div class="value">${totalKm.toFixed(1)} km</div><div class="label">Distancia total</div></div>
    <div class="stat-box"><div class="value">${cyclingCache.length}</div><div class="label">Rodadas</div></div>
    <div class="stat-box"><div class="value">${avgSpeed.toFixed(1)} km/h</div><div class="label">Velocidad promedio</div></div>
  `;
}

function renderList() {
  const list = cyclingCache.slice().sort((a, b) => b.date.localeCompare(a.date));
  const container = document.getElementById("cycling-list");
  const empty = document.getElementById("cycling-empty");

  container.innerHTML = "";
  empty.style.display = list.length ? "none" : "block";

  list.forEach(entry => {
    const speed = entry.duration > 0 ? entry.distance / (entry.duration / 60) : 0;
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div>
        <strong>${entry.distance.toFixed(2)} km</strong> — ${entry.duration} min · ${speed.toFixed(1)} km/h
        <div class="meta">${entry.date}${entry.notes ? " · " + entry.notes : ""}</div>
      </div>
    `;
    const del = document.createElement("button");
    del.className = "delete";
    del.setAttribute("aria-label", "Eliminar rodada");
    del.innerHTML = ICONS.trash;
    del.addEventListener("click", () => cyclingCollection().doc(entry.id).delete());
    item.appendChild(del);
    container.appendChild(item);
  });

  renderStats();
}

document.getElementById("cycling-form").addEventListener("submit", e => {
  e.preventDefault();
  const date = document.getElementById("cycling-date").value;
  const distance = parseFloat(document.getElementById("cycling-distance").value);
  const duration = parseFloat(document.getElementById("cycling-duration").value);
  const notes = document.getElementById("cycling-notes").value.trim();
  if (!date || !distance || !duration) return;

  cyclingCollection().add({ date, distance, duration, notes });
  e.target.reset();
  document.getElementById("cycling-date").valueAsDate = new Date();
});

document.getElementById("cycling-date").valueAsDate = new Date();

onAuthReady(() => {
  cyclingCollection().onSnapshot(snap => {
    cyclingCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderList();
  });
});
})();
