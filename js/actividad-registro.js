// ---------- Lista y registro a mano de Running y Bicicleta ----------
// Común a las dos: totales (distancia, salidas/rodadas, ritmo o velocidad
// promedio), "Tu progreso" (barras por semana, tendencia y mejores marcas
// GPS, cálculos en js/actividad-analisis.js), lista por meses (las de GPS se
// abren con su resumen y su mapa) y el formulario para anotar a mano.
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
const coma = (n, d) => n.toFixed(d).replace(".", ",");
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
  let metrica = "km";   // km · min · n (barras de "Tu progreso")

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

  // ---- Tu progreso: 12 semanas, tendencia y mejores marcas ----
  const AA = ActividadAnalisis;
  const V = ActividadVista;
  const METRICAS = {
    km: { titulo: "Distancia", valor: s => s.km, texto: v => `${coma(v, 1)} km`, eje: v => `${coma(v, v < 10 && v % 1 ? 1 : 0)} km`, escala: "volumen" },
    min: { titulo: "Tiempo", valor: s => s.min, texto: v => V.tiempo(v * 60), eje: (v, tope) => (tope >= 120 ? `${coma(v / 60, v % 60 ? 1 : 0)} h` : `${Math.round(v)} min`), escala: "duracion" },
    n: { titulo: esRitmo ? "Salidas" : "Rodadas", valor: s => s.n, texto: v => String(v), eje: v => String(Math.round(v)), escala: "reps" }
  };
  function valorMarca(m) {
    if (m.clave === "larga") return { valor: V.distancia(m.valor), detalle: "" };
    if (m.clave === "media") return { valor: V.velocidad(m.valor), detalle: "media" };
    const km = { "1k": 1, "5k": 5, "10k": 10 }[m.clave] || 1;
    return { valor: V.tiempo(m.valor), detalle: esRitmo ? V.ritmo(m.valor / km) : V.velocidad(km * 1000 / m.valor) };
  }
  function renderProgreso() {
    const cont = $("progreso");
    if (!cont) return;
    if (!cache.length) { cont.innerHTML = ""; return; }
    const hoy = ActividadMotor.fechaLocal(Date.now());
    const semanas = AA.porSemana(cache, hoy, 12);
    const t = AA.tendencia(semanas);
    const ult = semanas.slice(-4);
    const km4 = ult.reduce((s, x) => s + x.km, 0), seg4 = ult.reduce((s, x) => s + x.segMov, 0);
    const promedio = km4 > 0 && seg4 > 0 ? (esRitmo ? `ritmo medio ${V.ritmo(seg4 / km4)}` : `velocidad media ${V.velocidad(km4 * 1000 / seg4)}`) : "";
    const cambio = t.cambio == null ? ""
      : t.cambio > 2 ? " · ▲ más del triple de distancia que las 4 anteriores"
      : ` · ${t.cambio >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(t.cambio * 100))} % de distancia frente a las 4 anteriores`;
    const M = METRICAS[metrica];
    const barras = semanas.map(s => ({ etiqueta: ES_SEMANA(s.desde), valor: M.valor(s), texto: M.texto(M.valor(s)) }));
    const marcas = AA.mejores(cache, o.deporte);
    cont.innerHTML = `
      <h2 class="act-lista-t">Tu progreso</h2>
      <p class="act-tend"><strong>Últimas 4 semanas: ${coma(km4, 1)} km</strong>${promedio ? ` · ${promedio}` : ""}${cambio}</p>
      ${AA.htmlBarras(barras, { metrica: M.escala, etiquetaEje: M.eje })}
      <div class="ejd-metricas" role="group" aria-label="Qué mostrar por semana">
        ${Object.keys(METRICAS).map(k => `<button type="button" class="ejd-pill${k === metrica ? " sel" : ""}" data-act-metrica="${k}" aria-pressed="${k === metrica}">${METRICAS[k].titulo}</button>`).join("")}
      </div>
      <h3 class="act-sub">Mejores marcas</h3>
      ${marcas.length ? `<div class="act-marcas">${marcas.map(m => {
        const v = valorMarca(m);
        return `<button type="button" class="act-marca" data-act-marca="${escapeHtml(m.id)}"><span>${escapeHtml(m.titulo)}</span><strong>${v.valor}</strong><small>${v.detalle ? `${v.detalle} · ` : ""}${escapeHtml(m.fecha)}</small></button>`;
      }).join("")}</div>` : `<p class="act-rutinas-vacio">Tus mejores marcas aparecen cuando registras con GPS (las anotadas a mano no cuentan).</p>`}`;
  }
  const ES_SEMANA = iso => EjSesiones.etiquetaSemana(iso);
  if ($("progreso")) $("progreso").addEventListener("click", e => {
    const m = e.target.closest("[data-act-metrica]");
    if (m) { metrica = m.dataset.actMetrica; renderProgreso(); return; }
    const marca = e.target.closest("[data-act-marca]");
    if (marca) {
      const entry = cache.find(a => a.id === marca.dataset.actMarca);
      if (entry) { o.actividad.abrirGuardada(entry); window.scrollTo(0, 0); }
    }
  });

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
    renderProgreso();
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
