(function () {
// Running: carrera con GPS, libre o con rutina de intervalos (pantallas en
// js/actividad-ui.js), lista de tus carreras y registro a mano (cinta o sin GPS). Todo en users/{uid}/running;
// las carreras con GPS guardan su recorrido aparte en users/{uid}/rutas.

// Fecha local de hoy (valueAsDate usa UTC y de noche marcaba el día siguiente).
function fechaLocalHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
let runningCache = [];

function runningCollection() {
  return db.collection("users").doc(currentUser.uid).collection("running");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function formatPace(secPerKm) {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "--";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

const actividad = ActividadUI.crear({
  deporte: "running",
  panel: "running",
  contenedor: document.getElementById("running-act"),
  inicio: document.getElementById("running-home"),
  coleccion: "running",
  nombre: "carrera",
  titulo: "Running",
  rutinas: true          // rutinas por intervalos desde CSV (js/rutinas-running-ui.js)
});

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
  const list = runningCache.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.inicio || 0) - (a.inicio || 0));
  const container = document.getElementById("running-list");
  const empty = document.getElementById("running-empty");

  container.innerHTML = "";
  empty.style.display = list.length ? "none" : "block";

  list.forEach(entry => {
    // Ritmo: con GPS, sobre el tiempo en movimiento; a mano, sobre los minutos.
    const gps = entry.fuente === "gps";
    const seg = gps && entry.tiempoMovS > 0 ? entry.tiempoMovS : entry.duration * 60;
    const pace = entry.distance > 0 ? seg / entry.distance : 0;
    const item = document.createElement("div");
    item.className = "list-item" + (gps ? " act-item" : "");
    const tiempo = gps ? ActividadVista.tiempo(entry.tiempoActivoS) : `${entry.duration} min`;
    const cuerpo = `
        <strong>${entry.distance.toFixed(2)} km</strong> — ${tiempo} · ${formatPace(pace)}${gps ? ` <span class="act-tag">GPS</span>` : ""}
        <div class="meta">${entry.date}${entry.notes ? " · " + escapeHtml(entry.notes) : ""}</div>`;
    item.innerHTML = gps
      ? `<button type="button" class="act-item-abrir" aria-label="Ver la carrera del ${entry.date}">${cuerpo}</button>`
      : `<div>${cuerpo}</div>`;
    if (gps) item.querySelector(".act-item-abrir").addEventListener("click", () => actividad.abrirGuardada(entry));
    else {
      const del = document.createElement("button");
      del.className = "delete";
      del.setAttribute("aria-label", "Eliminar salida");
      del.innerHTML = ICONS.trash;
      del.addEventListener("click", () => runningCollection().doc(entry.id).delete());
      item.appendChild(del);
    }
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
  const rpe = parseInt(document.getElementById("running-rpe").value, 10);
  if (!date || !distance || !duration) return;

  // El RPE (opcional) lo usa el mapa muscular: minutos × RPE × constante.
  runningCollection().add(Object.assign({ date, distance, duration, notes }, rpe ? { rpe } : {}));
  e.target.reset();
  document.getElementById("running-date").value = fechaLocalHoy();
});

document.getElementById("running-date").value = fechaLocalHoy();

onAuthReady(() => {
  runningCollection().onSnapshot(snap => {
    runningCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderList();
  });
});
})();
