// ---------- Mapa muscular de Ejercicio ----------
// Frente y espalda (js/body-figures.js) con 22 regiones por lado. Cada
// región se pinta según las series efectivas de la semana que se ve (o del
// día elegido en la fila L–D): 1–3, 4–9, 10+; si el músculo solo trabajó
// como secundario se ve más suave. Los números salen de js/muscle-engine.js
// con los entrenamientos que junta js/ejercicio-datos.js. Tocar un músculo
// abre una hoja con su detalle.
(function () {

const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
const DIAS_LARGO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

let weekOffset = 0;
let diaElegido = null;          // "2026-09-29" o null = semana completa
let musculoAbierto = null;      // id del músculo en la hoja
let ultimo = { clave: null, niveles: {}, version: -1 };
let calculo = null;             // último cálculo (para la hoja)

// ---- Fechas (lunes a domingo, hora local) ----
function isoDate(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function mondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return d;
}
function currentWeek() {
  const start = mondayOf(new Date());
  start.setDate(start.getDate() + weekOffset * 7);
  const dias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dias.push(d);
  }
  return { start, end: dias[6], dias };
}
function weekLabel(week) {
  const fmt = d => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
  return `${fmt(week.start)} – ${fmt(week.end)}`;
}
function dayLabel(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${DIAS_LARGO[(d.getDay() + 6) % 7]} ${d.getDate()}`;
}

// ---- Formato ----
function fmtNum(n, dec) {
  const r = dec ? Math.round(n * 10) / 10 : Math.round(n);
  const [ent, fr] = String(r).split(".");
  return ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (fr ? "," + fr : "");
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---- Figuras ----
const banner = document.getElementById("body-banner");
BodyFigures.dibujar(document.getElementById("body-fig-frente"), BodyFigures.frente);
BodyFigures.dibujar(document.getElementById("body-fig-espalda"), BodyFigures.espalda);

// Un brillo que aparece y se va sobre los músculos que se acaban de encender.
function pulso(musculos) {
  musculos.forEach(m => {
    banner.querySelectorAll(`.mz[data-muscle="${m}"]`).forEach(g => {
      const base = g.querySelector(".mz-base");
      const brillo = base.cloneNode();
      brillo.setAttribute("class", "mz-brillo");
      brillo.setAttribute("filter", "url(#muscleGlow)");
      g.appendChild(brillo);
      setTimeout(() => brillo.remove(), 1600);
    });
  });
}

// ---- Render ----
function rango(week) {
  return diaElegido ? { desde: diaElegido, hasta: diaElegido } : { desde: isoDate(week.start), hasta: isoDate(week.end) };
}

function renderBodyMap() {
  if (!banner || banner.hidden) return;
  const week = currentWeek();
  document.getElementById("body-week-label").textContent = weekLabel(week);
  document.getElementById("body-week-next").disabled = weekOffset >= 0;

  const st = EjercicioDatos.estado;
  const datos = st.datos || { sesiones: [], entradas: [] };
  const { desde, hasta } = rango(week);
  const cfg = EjercicioDatos.config();
  const filtrado = MuscleEngine.filtrar(datos, desde, hasta);
  const musculos = MuscleEngine.calcularMusculos(filtrado.entradas, cfg);
  calculo = { musculos, desde, hasta, cfg };

  const niveles = {};
  banner.querySelectorAll(".mz").forEach(g => {
    const info = musculos[g.dataset.muscle];
    const n = info ? info.nivel : 0;
    niveles[g.dataset.muscle] = n;
    if (n) g.setAttribute("data-nivel", String(n));
    else g.removeAttribute("data-nivel");
    g.toggleAttribute("data-suave", !!(info && info.soloSecundario));
  });

  // Pulso solo cuando cambiaron los datos (no al cambiar de semana o de día).
  const clave = desde + "|" + hasta;
  if (st.datos && ultimo.clave === clave && ultimo.version !== st.version) {
    const encendidos = Object.keys(niveles).filter(m => niveles[m] > (ultimo.niveles[m] || 0));
    if (encendidos.length) pulso(encendidos);
  }
  if (st.datos) ultimo = { clave, niveles, version: st.version };

  renderDias(week, datos);
  renderResumen(musculos, filtrado);
  if (musculoAbierto) renderHoja();
}

function renderDias(week, datos) {
  const conEntreno = new Set(datos.sesiones.map(s => s.fecha));
  const hoy = isoDate(new Date());
  document.getElementById("body-days").innerHTML = week.dias.map((d, i) => {
    const iso = isoDate(d);
    const cls = ["body-day"];
    if (conEntreno.has(iso)) cls.push("has-data");
    if (iso === hoy) cls.push("is-today");
    if (iso === diaElegido) cls.push("selected");
    if (iso > hoy) cls.push("future");
    return `<button type="button" class="${cls.join(" ")}" data-dia="${iso}" aria-pressed="${iso === diaElegido}" aria-label="${dayLabel(iso)}">` +
      `<span class="d">${DIAS[i]}</span><span class="n">${d.getDate()}</span><span class="dot"></span></button>`;
  }).join("");
}

function renderResumen(musculos, filtrado) {
  const ids = Object.keys(musculos);
  const legend = document.getElementById("body-legend");
  const periodo = diaElegido ? "este día" : "esta semana";
  if (!EjercicioDatos.estado.datos) {
    legend.innerHTML = `<span class="body-legend-chip">Cargando tus entrenamientos…</span>`;
  } else if (!filtrado.entradas.length) {
    legend.innerHTML = `<span class="body-legend-chip">Todavía no registras entrenamientos ${periodo}</span>`;
  } else {
    const series = filtrado.entradas.reduce((s, e) => s + MuscleEngine.cargaEjercicio(e, calculo.cfg).series, 0);
    legend.innerHTML = `<span class="body-legend-chip">${ids.length} músculos · ${fmtNum(series, true)} series · toca uno para ver el detalle</span>`;
  }
}

// ---- Hoja de detalle del músculo ----
const hoja = document.getElementById("muscle-sheet");

function abrirHoja(m) {
  musculoAbierto = m;
  renderHoja();
  hoja.hidden = false;
  hoja.classList.remove("closing");
  document.body.classList.add("sheet-open");
  banner.querySelectorAll(".mz").forEach(g => g.classList.toggle("is-selected", g.dataset.muscle === m));
}

function cerrarHoja() {
  if (hoja.hidden) return;
  musculoAbierto = null;
  banner.querySelectorAll(".mz.is-selected").forEach(g => g.classList.remove("is-selected"));
  hoja.classList.add("closing");
  document.body.classList.remove("sheet-open");
  setTimeout(() => { hoja.hidden = true; hoja.classList.remove("closing"); hoja.querySelector(".muscle-sheet-panel").style.transform = ""; }, 220);
}

function renderHoja() {
  const def = MuscleEngine.MUSCULO_POR_ID[musculoAbierto];
  if (!def || !calculo) return;
  const info = calculo.musculos[musculoAbierto];
  const grupo = MuscleEngine.GRUPOS.find(g => g.id === def.grupo);
  const periodo = diaElegido ? dayLabel(diaElegido) : "Semana " + weekLabel(currentWeek());

  document.getElementById("muscle-sheet-title").textContent = def.nombre;
  document.getElementById("muscle-sheet-group").textContent = grupo ? grupo.nombre : "";
  document.getElementById("muscle-sheet-period").textContent = periodo;

  const nivel = info ? info.nivel : 0;
  const pill = document.getElementById("muscle-sheet-level");
  pill.dataset.nivel = String(nivel);
  pill.toggleAttribute("data-suave", !!(info && info.soloSecundario));
  pill.textContent = !info ? "Sin trabajar" : info.soloSecundario ? "Solo secundario" : ["", "1–3 series", "4–9 series", "10+ series"][nivel];

  const stat = (v, l) => `<div class="muscle-stat"><span class="v">${v}</span><span class="l">${l}</span></div>`;
  document.getElementById("muscle-sheet-stats").innerHTML = [
    stat(info ? fmtNum(info.series, true) : "0", "Series efectivas"),
    stat(info ? fmtNum(info.volumen) + " kg" : "0 kg", "Volumen"),
    stat(info ? String(info.dias.length) : "0", info && info.dias.length === 1 ? "Día" : "Días"),
    stat(info && info.rpe ? fmtNum(info.rpe, true) : "—", "RPE promedio")
  ].join("");

  document.getElementById("muscle-sheet-days").textContent = info && info.dias.length
    ? info.dias.map(dayLabel).join(" · ") : "";

  const lista = document.getElementById("muscle-sheet-list");
  lista.innerHTML = info && info.ejercicios.length
    ? info.ejercicios.map(e => `
        <li>
          <div class="muscle-ex-main">
            <span class="muscle-ex-name">${escapeHtml(e.nombre)}</span>
            <span class="muscle-ex-role ${e.rol}">${e.rol === "primario" ? "Primario" : "Secundario"}</span>
          </div>
          <span class="muscle-ex-meta">${fmtNum(e.series, true)} series ef. · ${fmtNum(e.volumen)} kg</span>
        </li>`).join("")
    : `<li class="muscle-ex-empty">Ningún ejercicio trabajó este músculo ${diaElegido ? "ese día" : "esta semana"}.</li>`;
}

hoja.addEventListener("click", e => { if (e.target.closest("[data-cerrar]")) cerrarHoja(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarHoja(); });

// Deslizar hacia abajo para cerrar.
(function () {
  const panel = hoja.querySelector(".muscle-sheet-panel");
  let y0 = null, dy = 0;
  panel.addEventListener("touchstart", e => {
    if (panel.scrollTop > 0) return;
    y0 = e.touches[0].clientY; dy = 0;
  }, { passive: true });
  panel.addEventListener("touchmove", e => {
    if (y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    panel.style.transform = dy ? `translateY(${dy}px)` : "";
  }, { passive: true });
  panel.addEventListener("touchend", () => {
    if (y0 === null) return;
    y0 = null;
    if (dy > 80) cerrarHoja();
    else panel.style.transform = "";
  });
})();

// ---- Eventos ----
banner.addEventListener("click", e => {
  const region = e.target.closest(".mz");
  if (region) { abrirHoja(region.dataset.muscle); return; }
  const dia = e.target.closest(".body-day");
  if (dia) {
    diaElegido = diaElegido === dia.dataset.dia ? null : dia.dataset.dia;
    renderBodyMap();
  }
});

// El radar (js/muscle-radar.js) sigue la semana que se ve en el mapa.
function cambiarSemana(delta) {
  weekOffset += delta;
  diaElegido = null;
  renderBodyMap();
  document.dispatchEvent(new CustomEvent("bodymap:semana", { detail: { offset: weekOffset } }));
}
document.getElementById("body-week-prev").addEventListener("click", () => cambiarSemana(-1));
document.getElementById("body-week-next").addEventListener("click", () => { if (weekOffset < 0) cambiarSemana(1); });

EjercicioDatos.onCambio(() => renderBodyMap());

// El router (modules.js) solo cambia [hidden]; cuando el banner se vuelve
// a mostrar hay que repintar, porque mientras estaba oculto no se hizo.
new MutationObserver(() => { if (banner.hidden) cerrarHoja(); renderBodyMap(); })
  .observe(banner, { attributes: true, attributeFilter: ["hidden"] });

renderBodyMap();

window.BodyMap = { render: renderBodyMap, semana: () => ({ offset: weekOffset, dia: diaElegido }) };
})();
