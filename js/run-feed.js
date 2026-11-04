// ---------- Running › Actividades: el feed de tarjetas (fase 3, D-061) ----------
// Una tarjeta por carrera (título, fecha, hora y lugar, Distancia · Ritmo ·
// Tiempo, trazo de la ruta, medallas y etiquetas), con filtros, separadores
// por mes y carga de a 20 (cientos de carreras sin trabarse). También: la
// tarjeta de Running en Inicio, el "+" de la barra (Importar · Anotar a mano
// · Rutina guiada) y la sugerencia de estirar después de correr.
// Los datos llegan de js/run-datos.js (sin lecturas extra).
(function () {
"use strict";
const V = window.RunVista, M = window.RunMetricas, A = window.RunAnalisis;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PAGINA = 20;
const FILTROS = [["todas", "Todas"], ["mapa", "Con mapa"], ["rutinas", "Rutinas"], ["mano", "A mano"], ["competencia", "Competencias"]];
const TIPO = { competencia: "Competencia", fondo: "Fondo largo", series: "Series", trail: "Trail", cinta: "Cinta", pista: "Pista", virtual: "Virtual" };
const CLAVE_ESTIRAR = "manolo.run.estirar";
const esManual = d => !d.fuente && !(d.inicio > 0);
const PASA = {
  todas: () => true,
  mapa: d => !!(d.conRuta && (d.mini || d.fuente === "gps")),
  rutinas: d => !!d.rutina,
  mano: esManual,
  competencia: d => d.subtipo === "competencia"
};
let filtro = "todas", mostrar = PAGINA, listaVista = [];

const feed = () => document.getElementById("rf-feed");
function titulo(d) {
  return d.titulo || (d.rutina && d.rutina.nombre) || M.tituloAuto("running", d.inicio > 0 ? d.inicio : Date.parse(`${d.date}T12:00:00`));
}
function tarjeta(d, logros) {
  const b = V.basicos(d);
  const mini = d.mini ? V.svgRuta([M.leerMini(d.mini)], { ancho: 320, alto: 150, maxPuntos: 250, clase: "run-ruta rf-ruta" }) : "";
  const meta = [V.fechaActividad(d), d.lugar].filter(Boolean).map(esc).join(" · ");
  const etiquetas = [];
  if (d.rutina) etiquetas.push(`<span class="act-tag">Rutina</span>`);
  if (TIPO[d.subtipo]) etiquetas.push(`<span class="act-tag rf-tag-tipo">${TIPO[d.subtipo]}</span>`);
  if (esManual(d)) etiquetas.push(`<span class="act-tag rf-tag-mano">A mano</span>`);
  const meds = (logros || []).slice().sort((x, y) => x.puesto - y.puesto);
  const medallas = meds.length
    ? `<span class="rf-medallas">${meds.slice(0, 3).map(l => `<span title="${esc(A.textoPuesto(l.puesto))}">${A.MEDALLA[l.puesto]} ${esc(l.nombre)}</span>`).join("")}${meds.length > 3 ? `<span>+${meds.length - 3}</span>` : ""}</span>` : "";
  return `<article class="rf-card">
    <a class="rf-link" href="#run-actividad/running/${encodeURIComponent(d.id)}">
      <header class="rf-cab">
        <span class="rf-avatar" aria-hidden="true"><span class="icon" data-icon="running"></span></span>
        <span class="rf-cab-txt"><b class="rf-titulo">${esc(titulo(d))}</b><small>${meta}</small></span>
      </header>
      <div class="rf-cifras">
        ${b.distM > 0 ? `<div><span>Distancia</span><b>${V.km(b.distM)}</b></div><div><span>Ritmo</span><b>${V.ritmo(b.ritmoS)}</b></div>` : ""}
        <div><span>Tiempo</span><b>${V.tiempo(b.movS)}</b></div>
      </div>
      ${mini ? `<div class="rf-mapa">${mini}</div>` : ""}
      ${medallas || etiquetas.length ? `<footer class="rf-pie">${medallas}${etiquetas.join("")}</footer>` : ""}
    </a>
  </article>`;
}
function vacio() {
  return `<div class="run-vacio">
    <span class="icon" data-icon="running"></span>
    <p><b>Todavía no hay carreras.</b></p>
    <p>Importa tu historial (con mapas, parciales y marcas) o anota una carrera a mano.</p>
    <div class="run-vacio-btns"><button type="button" class="run-importar-btn" data-ri-abrir>Importar</button>
    <button type="button" class="lib-btn-sec rd-btn" data-run-op="manual">Anotar a mano</button></div>
  </div>`;
}

function pintar() {
  const cont = feed();
  if (!cont) return;
  const todos = RunDatos.lista("running");
  pintarFiltros(todos);
  if (!RunDatos.cargada("running")) { cont.innerHTML = `<p class="rd-nota">Cargando…</p>`; return; }
  if (!todos.length) { cont.innerHTML = vacio(); renderIcons(cont); return; }
  listaVista = todos.filter(PASA[filtro] || PASA.todas).sort((a, b) => A.momento(b) - A.momento(a));
  if (!listaVista.length) { cont.innerHTML = `<p class="rd-nota rf-nada">Nada con este filtro.</p>`; return; }
  const logros = A.logrosPorId(todos);
  const meses = {};
  listaVista.forEach(d => {
    const k = String(d.date || "").slice(0, 7);
    const m = meses[k] || (meses[k] = { km: 0, n: 0 });
    m.km += V.basicos(d).distM / 1000;
    m.n++;
  });
  let html = "", mes = "";
  listaVista.slice(0, mostrar).forEach(d => {
    const k = String(d.date || "").slice(0, 7);
    if (k && k !== mes) {
      mes = k;
      const nombre = V.MESES_LARGOS[Number(k.slice(5, 7)) - 1] || "";
      html += `<h2 class="rf-mes"><span>${nombre.charAt(0).toUpperCase() + nombre.slice(1)} de ${k.slice(0, 4)}</span><small>${V.numero(meses[k].km, 1)} km · ${meses[k].n} ${meses[k].n === 1 ? "carrera" : "carreras"}</small></h2>`;
    }
    html += tarjeta(d, logros[d.id]);
  });
  if (listaVista.length > mostrar) html += `<button type="button" class="lib-btn-sec rd-btn rf-mas" data-rf-mas>Ver más (${listaVista.length - mostrar})</button>`;
  cont.innerHTML = html;
  renderIcons(cont);
  observarMas();
}
function pintarFiltros(todos) {
  const cont = document.getElementById("rf-filtros");
  if (!cont) return;
  cont.hidden = !todos.length;
  cont.innerHTML = FILTROS.filter(([k]) => k === "todas" || todos.some(PASA[k])).map(([k, t]) =>
    `<button type="button" class="rf-filtro${filtro === k ? " is-sel" : ""}" aria-pressed="${filtro === k}" data-rf-filtro="${k}">${t}</button>`).join("");
}
// "Ver más" se toca solo al llegar al final de la lista.
let observador = null;
function observarMas() {
  if (!("IntersectionObserver" in window)) return;
  if (observador) observador.disconnect();
  const b = feed().querySelector("[data-rf-mas]");
  if (!b) return;
  observador = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { observador.disconnect(); masTarjetas(); } }, { rootMargin: "400px" });
  observador.observe(b);
}
function masTarjetas() {
  mostrar += PAGINA;
  const y = window.scrollY;
  pintar();
  window.scrollTo(0, y);
}

// ---- Tarjeta de Running en Inicio ----
function pintarInicio() {
  const p = document.getElementById("run-inicio");
  if (!p) return;
  const todos = RunDatos.lista("running");
  if (!todos.length) { p.textContent = "Tus carreras, mapas, marcas y rutinas."; return; }
  const hoy = M.fechaLocal(Date.now());
  const semana = window.ActividadAnalisis ? ActividadAnalisis.porSemana(todos, hoy, 1)[0] : null;
  const ult = todos.slice().sort((a, b) => A.momento(b) - A.momento(a))[0];
  const bu = V.basicos(ult);
  p.textContent = `Esta semana: ${V.numero(semana ? semana.km : 0, 1)} km. Última: ${titulo(ult)}${bu.distM > 0 ? `, ${V.km(bu.distM)}` : ""}.`;
}

// ---- "+" y anotar a mano ----
function mostrarHoja(id) {
  const h = document.getElementById(id);
  if (!h) return;
  clearTimeout(h._t);
  h.classList.remove("is-closing");
  h.hidden = false;
  document.body.classList.add("sheet-open");
}
function ocultarHoja(id) {
  const h = document.getElementById(id);
  if (!h || h.hidden) return;
  h.classList.add("is-closing");
  h._t = setTimeout(() => { h.hidden = true; h.classList.remove("is-closing"); document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden])")); }, 200);
}
function abrirManual() {
  const f = document.getElementById("running-date");
  if (f && !f.value) f.value = M.fechaLocal(Date.now());
  mostrarHoja("run-manual-hoja");
  setTimeout(() => { const d = document.getElementById("running-distance"); if (d && window.matchMedia("(pointer: fine)").matches) d.focus(); }, 250);
}

// ---- Sugerencia de estirar (Movilidad › Después de correr) ----
function leerEstirar() { try { return Number(sessionStorage.getItem(CLAVE_ESTIRAR)) || 0; } catch (e) { return 0; } }
function marcarEstirar(v) { try { sessionStorage.setItem(CLAVE_ESTIRAR, String(v)); } catch (e) { /* sin almacenamiento */ } }
function pintarEstirar() {
  const desde = leerEstirar();
  const ver = desde > 0 && Date.now() - desde < 2 * 3600000;
  document.querySelectorAll("[data-run-estirar]").forEach(el => {
    el.hidden = !ver;
    if (ver && !el.firstChild) el.innerHTML = `<a href="#movilidad"><span class="icon" data-icon="movilidad"></span><span><b>¿Estiramos?</b> Después de correr · 3 min</span></a><button type="button" aria-label="Ocultar" data-run-estirar-x>×</button>`;
    if (ver) renderIcons(el);
  });
}
let conocidos = null;
function vigilarNuevas() {
  const todos = RunDatos.lista("running");
  const hoy = M.fechaLocal(Date.now());
  if (conocidos) {
    const nuevas = todos.filter(d => !conocidos.has(d.id) && d.date === hoy && (esManual(d) || d.fuente === "rutina"));
    if (nuevas.length) { marcarEstirar(Date.now()); pintarEstirar(); }
  }
  // La primera lista que llega es la de siempre (no es nueva).
  if (todos.length || conocidos) conocidos = new Set(todos.map(d => d.id));
}

// ---- Eventos ----
document.addEventListener("click", e => {
  if (e.target.closest("[data-run-mas]")) { e.preventDefault(); mostrarHoja("run-mas-hoja"); return; }
  const op = e.target.closest("[data-run-op]");
  if (op) {
    ocultarHoja("run-mas-hoja");
    if (op.dataset.runOp === "importar") window.RunImportar && RunImportar.abrir();
    else if (op.dataset.runOp === "manual") { e.preventDefault(); abrirManual(); }
    return;
  }
  ["run-mas-hoja", "run-manual-hoja"].forEach(id => {
    const h = document.getElementById(id);
    if (h && h.contains(e.target) && (e.target.closest(".budget-sheet-close") || e.target.classList.contains("budget-sheet-overlay"))) ocultarHoja(id);
  });
  const f = e.target.closest("[data-rf-filtro]");
  if (f) { filtro = f.dataset.rfFiltro; mostrar = PAGINA; pintar(); return; }
  if (e.target.closest("[data-rf-mas]")) { masTarjetas(); return; }
  if (e.target.closest("[data-run-estirar-x]")) { marcarEstirar(-1); pintarEstirar(); }
});
// Anotar a mano: ActividadRegistro guarda (y vacía el formulario); aquí se
// cierra la hoja. Se escucha antes (captura) para ver si el formulario es válido.
document.addEventListener("submit", e => {
  if (e.target.id !== "running-form") return;
  if (e.target.checkValidity()) {
    marcarEstirar(Date.now());
    setTimeout(() => { ocultarHoja("run-manual-hoja"); pintarEstirar(); }, 0);
  }
}, true);
if (window.RunDatos) RunDatos.al(() => { vigilarNuevas(); pintar(); pintarInicio(); });
document.addEventListener("DOMContentLoaded", () => { pintar(); pintarEstirar(); });
window.addEventListener("hashchange", () => { pintarEstirar(); ocultarHoja("run-mas-hoja"); ocultarHoja("run-manual-hoja"); });
})();
