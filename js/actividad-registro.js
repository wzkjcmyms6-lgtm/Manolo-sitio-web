// ---------- Lista y registro a mano de Running y Bicicleta ----------
// Común a las dos: totales (distancia, salidas/rodadas, ritmo o velocidad
// promedio), lista de actividades (las de GPS se abren con su resumen y su
// mapa) y el formulario para anotar a mano (cinta, rodillo o sin GPS).
// Todo vive en users/{uid}/{coleccion}, como siempre.
(function () {

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
// Fecha local de hoy (valueAsDate usa UTC y de noche marcaba el día siguiente).
function fechaLocalHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatPace(secPerKm) {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "--";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

// o = { deporte, coleccion, prefijo ("running" | "cycling"), total ("Salidas"
//       | "Rodadas"), item ("salida" | "rodada"), actividad (ActividadUI) }
function registro(o) {
  const esRitmo = ActividadMotor.PERFILES[o.deporte].principal === "ritmo";
  const $ = id => document.getElementById(`${o.prefijo}-${id}`);
  const col = () => db.collection("users").doc(currentUser.uid).collection(o.coleccion);
  let cache = [];

  function renderStats() {
    const totalKm = cache.reduce((sum, r) => sum + r.distance, 0);
    const totalMin = cache.reduce((sum, r) => sum + r.duration, 0);
    const promedio = esRitmo
      ? formatPace(totalKm > 0 ? (totalMin * 60) / totalKm : 0)
      : `${(totalMin > 0 ? totalKm / (totalMin / 60) : 0).toFixed(1)} km/h`;
    $("stats").innerHTML = `
      <div class="stat-box"><div class="value">${totalKm.toFixed(1)} km</div><div class="label">Distancia total</div></div>
      <div class="stat-box"><div class="value">${cache.length}</div><div class="label">${o.total}</div></div>
      <div class="stat-box"><div class="value">${promedio}</div><div class="label">${esRitmo ? "Ritmo promedio" : "Velocidad promedio"}</div></div>`;
  }

  function renderList() {
    const lista = cache.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.inicio || 0) - (a.inicio || 0));
    const cont = $("list");
    cont.innerHTML = "";
    $("empty").style.display = lista.length ? "none" : "block";
    lista.forEach(entry => {
      // Con GPS, ritmo y velocidad sobre el tiempo en movimiento; a mano, sobre los minutos.
      const gps = entry.fuente === "gps";
      const seg = gps && entry.tiempoMovS > 0 ? entry.tiempoMovS : entry.duration * 60;
      const valor = esRitmo
        ? formatPace(entry.distance > 0 ? seg / entry.distance : 0)
        : `${(seg > 0 ? entry.distance / (seg / 3600) : 0).toFixed(1)} km/h`;
      const tiempo = gps ? ActividadVista.tiempo(entry.tiempoActivoS) : `${entry.duration} min`;
      const cuerpo = `
        <strong>${entry.distance.toFixed(2)} km</strong> — ${tiempo} · ${valor}${gps ? ` <span class="act-tag">GPS</span>` : ""}
        <div class="meta">${escapeHtml(entry.date)}${entry.notes ? " · " + escapeHtml(entry.notes) : ""}</div>`;
      const item = document.createElement("div");
      item.className = "list-item" + (gps ? " act-item" : "");
      item.innerHTML = gps
        ? `<button type="button" class="act-item-abrir" aria-label="Ver la ${o.item} del ${escapeHtml(entry.date)}">${cuerpo}</button>`
        : `<div>${cuerpo}</div>`;
      if (gps) item.querySelector(".act-item-abrir").addEventListener("click", () => o.actividad.abrirGuardada(entry));
      else {
        const del = document.createElement("button");
        del.className = "delete";
        del.setAttribute("aria-label", `Eliminar ${o.item}`);
        del.innerHTML = ICONS.trash;
        del.addEventListener("click", () => col().doc(entry.id).delete());
        item.appendChild(del);
      }
      cont.appendChild(item);
    });
    renderStats();
  }

  $("form").addEventListener("submit", e => {
    e.preventDefault();
    const date = $("date").value;
    const distance = parseFloat($("distance").value);
    const duration = parseFloat($("duration").value);
    const notes = $("notes").value.trim();
    const rpe = parseInt($("rpe").value, 10);
    if (!date || !distance || !duration) return;
    // El RPE (opcional) lo usa el mapa muscular: minutos × RPE × constante.
    col().add(Object.assign({ date, distance, duration, notes }, rpe ? { rpe } : {}));
    e.target.reset();
    $("date").value = fechaLocalHoy();
  });
  $("date").value = fechaLocalHoy();

  onAuthReady(() => {
    col().onSnapshot(snap => {
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderList();
    });
  });
}

window.ActividadRegistro = { registro };
})();
