// ---------- Running y Bicicleta: resumen semanal, historial y registro a mano ----------
// Común a las dos:
// - Arriba, el resumen semanal: la semana elegida (distancia y tiempo) y el
//   gráfico de las últimas 12 semanas; tocar un punto elige esa semana.
//   Cálculos en js/actividad-analisis.js.
// - El historial por meses: lo anotado a mano, las rutinas guiadas y las
//   carreras viejas que se grabaron con GPS (se ven igual, sin mapa).
// - El formulario para anotar a mano.
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
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function formatPace(secPerKm) {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "--";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}
const SEMANAS = 12;

// o = { deporte ("running" | "bicicleta"), coleccion, prefijo ("running" | "cycling"),
//       item ("carrera" | "rodada") }
function registro(o) {
  const AA = ActividadAnalisis;
  const esRitmo = o.deporte === "running";
  const $ = id => document.getElementById(`${o.prefijo}-${id}`);
  const usuario = () => db.collection("users").doc(currentUser.uid);
  const col = () => usuario().collection(o.coleccion);
  let cache = [];
  let metrica = "km";      // lo que muestra el gráfico: km · min
  let sel = SEMANAS - 1;   // semana elegida (la última es la de hoy)
  let semanas = [];
  let anchoGraf = 0;       // el gráfico se dibuja al ancho real de su caja (texto nítido y del mismo tamaño en teléfono y compu)

  // ---- Resumen semanal ----
  function renderDash() {
    const cont = $("dash");
    if (!cont) return;
    semanas = AA.porSemana(cache, fechaLocalHoy(), SEMANAS);
    sel = Math.max(0, Math.min(SEMANAS - 1, sel));
    const s = semanas[sel];
    const previo = cont.querySelector(".dash-graf");
    anchoGraf = Math.round((previo && previo.clientWidth) || Math.max(0, cont.clientWidth - 36)) || 340;
    const stat = (k, titulo, valor) => `
      <button type="button" class="dash-stat${metrica === k ? " is-sel" : ""}" data-dash-metrica="${k}" aria-pressed="${metrica === k}">
        <span>${titulo}</span><strong>${valor}</strong>
      </button>`;
    cont.innerHTML = `
      <h2 class="dash-semana">${AA.rangoSemana(s.desde)}</h2>
      <div class="dash-stats" role="group" aria-label="Qué mostrar en el gráfico">
        ${stat("km", "Distancia", AA.textoKm(s.km))}
        ${stat("min", "Tiempo", AA.textoTiempo(s.min))}
      </div>
      <p class="dash-sub">Últimas ${SEMANAS} semanas</p>
      <div class="dash-graf" tabindex="0" aria-label="Elige una semana con las flechas">${AA.svgSemanas(semanas, { metrica, sel, id: o.prefijo + "-dash", ancho: Math.max(260, anchoGraf), alto: 190 })}</div>`;
  }
  function elegir(i) {
    if (i === sel || i < 0 || i >= SEMANAS) return;
    sel = i;
    const enfocado = document.activeElement && document.activeElement.classList.contains("dash-graf");
    renderDash();
    if (enfocado) $("dash").querySelector(".dash-graf").focus();
  }
  const dash = $("dash");
  dash.addEventListener("click", e => {
    const m = e.target.closest("[data-dash-metrica]");
    if (m && m.dataset.dashMetrica !== metrica) { metrica = m.dataset.dashMetrica; renderDash(); return; }
    const t = e.target.closest("[data-dash-semana]");
    if (t) elegir(Number(t.dataset.dashSemana));
  });
  // Con mouse basta pasar por encima (como en la compu).
  dash.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    const t = e.target.closest("[data-dash-semana]");
    if (t) elegir(Number(t.dataset.dashSemana));
  });
  // Al mostrarse la sección o cambiar el tamaño de la ventana, se redibuja a la medida.
  if (window.ResizeObserver) new ResizeObserver(() => {
    const g = dash.querySelector(".dash-graf");
    if (g && g.clientWidth && Math.abs(g.clientWidth - anchoGraf) > 4) renderDash();
  }).observe(dash);
  dash.addEventListener("keydown", e => {
    if (!e.target.classList.contains("dash-graf")) return;
    if (e.key === "ArrowLeft") { elegir(sel - 1); e.preventDefault(); }
    if (e.key === "ArrowRight") { elegir(sel + 1); e.preventDefault(); }
  });

  // ---- Historial ----
  function eliminar(entry) {
    if (!confirm(`¿Eliminar esta ${o.item} del ${entry.date}? No se puede deshacer.`)) return;
    const lote = db.batch();
    lote.delete(col().doc(entry.id));
    // Las carreras viejas con GPS guardaban su recorrido aparte.
    if (entry.conRuta) lote.delete(usuario().collection("rutas").doc(entry.id));
    lote.commit().catch(err => console.error("Manolo: no se pudo eliminar", err));
  }
  function renderList() {
    const lista = cache.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.inicio || 0) - (a.inicio || 0));
    const cont = $("list");
    cont.innerHTML = "";
    $("empty").style.display = lista.length ? "none" : "block";
    let mes = "";
    lista.forEach(entry => {
      // Separador por mes ("Septiembre de 2026").
      const m = String(entry.date || "").slice(0, 7);
      if (m && m !== mes) {
        mes = m;
        const h = document.createElement("h3");
        h.className = "act-mes";
        const n = MESES[Number(m.slice(5, 7)) - 1] || "";
        h.textContent = `${n.charAt(0).toUpperCase() + n.slice(1)} de ${m.slice(0, 4)}`;
        cont.appendChild(h);
      }
      const km = Number(entry.distance) || 0;
      const min = Number(entry.duration) || 0;
      const valor = esRitmo
        ? formatPace(km > 0 ? (min * 60) / km : 0)
        : `${(min > 0 ? km / (min / 60) : 0).toFixed(1)} km/h`;
      const r = entry.rutina;
      const rutina = r ? ` <span class="act-tag">Rutina</span>` : "";
      const linea = km > 0
        ? `<strong>${km.toFixed(2)} km</strong> — ${AA.textoTiempo(min)} · ${valor}${rutina}`
        : `<strong>${AA.textoTiempo(min)}</strong>${rutina}`;
      const detalle = [escapeHtml(entry.date)];
      if (r) detalle.push(escapeHtml(r.nombre) + (r.total && r.completados < r.total ? ` (${r.completados} de ${r.total} intervalos)` : ""));
      if (entry.notes) detalle.push(escapeHtml(entry.notes));
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `<div>${linea}<div class="meta">${detalle.join(" · ")}</div></div>`;
      const del = document.createElement("button");
      del.className = "delete";
      del.setAttribute("aria-label", `Eliminar ${o.item}`);
      del.innerHTML = ICONS.trash;
      del.addEventListener("click", () => eliminar(entry));
      item.appendChild(del);
      cont.appendChild(item);
    });
    renderDash();
  }

  // ---- Registro a mano ----
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
