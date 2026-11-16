// ---------- Bici › Actividades: el feed de rodadas (D-141) ----------
// Una tarjeta por rodada (título, fecha, hora y lugar, Distancia · Velocidad
// · Tiempo y el desnivel si lo hay, trazo de la ruta, medallas con los
// récords de bici), con filtros (Todas · Con mapa · A mano · Largas),
// separadores por mes y carga de a 20, como Running (js/run-feed.js).
// También: la tarjeta de Bici en Inicio y el "+" de la barra (Importar ·
// Anotar a mano). Los datos llegan de js/run-datos.js (sin lecturas extra);
// los cálculos, de js/bici-analisis.js.
(function () {
"use strict";
const V = window.RunVista, M = window.RunMetricas, A = window.RunAnalisis, B = window.BiciAnalisis;
if (!V || !M || !A || !B || !window.RunDatos) return;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PAGINA = 20;
let filtro = "todas", mostrar = PAGINA, listaVista = [];

const feed = () => document.getElementById("bf-feed");
const iconos = el => { if (typeof renderIcons === "function") renderIcons(el); };
function titulo(d) {
  return d.titulo || M.tituloAuto("bicicleta", d.inicio > 0 ? d.inicio : Date.parse(`${d.date}T12:00:00`));
}
function tarjeta(d, logros) {
  const b = V.basicos(d);
  const mini = d.mini ? V.svgRuta([M.leerMini(d.mini)], { ancho: 320, alto: 150, maxPuntos: 250, clase: "run-ruta rf-ruta" }) : "";
  const meta = [V.fechaActividad(d), d.lugar].filter(Boolean).map(esc).join(" · ");
  const etiquetas = [];
  if (B.esManual(d)) etiquetas.push(`<span class="act-tag rf-tag-mano">A mano</span>`);
  if (B.distM(d) >= B.LARGA_KM * 1000) etiquetas.push(`<span class="act-tag rf-tag-tipo">Larga</span>`);
  const meds = (logros || []).slice().sort((x, y) => x.puesto - y.puesto);
  const medallas = meds.length
    ? `<span class="rf-medallas">${meds.slice(0, 3).map(l => `<span title="${esc(A.textoPuesto(l.puesto))}">${A.MEDALLA[l.puesto]} ${esc(l.nombre)}</span>`).join("")}${meds.length > 3 ? `<span>+${meds.length - 3}</span>` : ""}</span>` : "";
  const dz = B.desn(d);
  return `<article class="rf-card bf-card">
    <a class="rf-link" href="#run-actividad/bicicleta/${encodeURIComponent(d.id)}">
      <header class="rf-cab">
        <span class="rf-avatar bf-avatar" aria-hidden="true"><span class="icon" data-icon="cycling"></span></span>
        <span class="rf-cab-txt"><b class="rf-titulo">${esc(titulo(d))}</b><small>${meta}</small></span>
      </header>
      <div class="rf-cifras bf-cifras is-${[b.distM > 0, b.distM > 0 && b.movS > 0, true, dz >= 1].filter(Boolean).length}">
        ${b.distM > 0 ? `<div><span>Distancia</span><b>${V.km(b.distM)}</b></div>` : ""}
        ${b.distM > 0 && b.movS > 0 ? `<div><span>Velocidad</span><b>${V.velocidad(b.movS, b.distM)}</b></div>` : ""}
        <div><span>Tiempo</span><b>${V.tiempo(b.movS)}</b></div>
        ${dz >= 1 ? `<div><span>Desnivel</span><b>${V.metros(dz)}</b></div>` : ""}
      </div>
      ${mini ? `<div class="rf-mapa">${mini}</div>` : ""}
      ${medallas || etiquetas.length ? `<footer class="rf-pie">${medallas}${etiquetas.join("")}</footer>` : ""}
    </a>
  </article>`;
}
function vacio() {
  return `<div class="run-vacio">
    <span class="icon" data-icon="cycling"></span>
    <p><b>Todavía no hay rodadas.</b></p>
    <p>Importa tu historial (con mapas, velocidad, desnivel y récords) o anota una rodada a mano.</p>
    <div class="run-vacio-btns"><button type="button" class="run-importar-btn" data-ri-abrir>Importar</button>
    <button type="button" class="lib-btn-sec rd-btn" data-bici-op="manual">Anotar a mano</button></div>
  </div>`;
}

function pintar() {
  const cont = feed();
  if (!cont) return;
  const todos = RunDatos.lista("bicicleta");
  pintarFiltros(todos);
  if (!RunDatos.cargada("bicicleta")) { cont.innerHTML = `<p class="rd-nota">Cargando…</p>`; return; }
  if (!todos.length) { cont.innerHTML = vacio(); iconos(cont); return; }
  listaVista = todos.filter(B.PASA[filtro] || B.PASA.todas).sort((a, b) => A.momento(b) - A.momento(a));
  if (!listaVista.length) { cont.innerHTML = `<p class="rd-nota rf-nada">Nada con este filtro.</p>`; return; }
  const logros = B.logrosPorId(todos);
  const meses = {};
  listaVista.forEach(d => {
    const k = String(d.date || "").slice(0, 7);
    const m = meses[k] || (meses[k] = { km: 0, n: 0 });
    m.km += B.distM(d) / 1000;
    m.n++;
  });
  let html = "", mes = "";
  listaVista.slice(0, mostrar).forEach(d => {
    const k = String(d.date || "").slice(0, 7);
    if (k && k !== mes) {
      mes = k;
      const nombre = V.MESES_LARGOS[Number(k.slice(5, 7)) - 1] || "";
      html += `<h2 class="rf-mes"><span>${nombre.charAt(0).toUpperCase() + nombre.slice(1)} de ${k.slice(0, 4)}</span><small>${V.numero(meses[k].km, 1)} km · ${meses[k].n} ${meses[k].n === 1 ? "rodada" : "rodadas"}</small></h2>`;
    }
    html += tarjeta(d, logros[d.id]);
  });
  if (listaVista.length > mostrar) html += `<button type="button" class="lib-btn-sec rd-btn rf-mas" data-bf-mas>Ver más (${listaVista.length - mostrar})</button>`;
  cont.innerHTML = html;
  iconos(cont);
  observarMas();
}
function pintarFiltros(todos) {
  const cont = document.getElementById("bf-filtros");
  if (!cont) return;
  cont.hidden = !todos.length;
  cont.innerHTML = B.FILTROS.filter(([k]) => k === "todas" || todos.some(B.PASA[k])).map(([k, t]) =>
    `<button type="button" class="rf-filtro${filtro === k ? " is-sel" : ""}" aria-pressed="${filtro === k}" data-bf-filtro="${k}">${k === "largas" ? `${t} <small>(50 km o más)</small>` : t}</button>`).join("");
}
// "Ver más" se toca solo al llegar al final de la lista.
let observador = null;
function observarMas() {
  if (!("IntersectionObserver" in window)) return;
  if (observador) observador.disconnect();
  const b = feed().querySelector("[data-bf-mas]");
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

// ---- Tarjeta de Bici en Inicio ----
function pintarInicio() {
  const p = document.getElementById("bici-inicio");
  if (!p) return;
  const r = B.inicio(RunDatos.lista("bicicleta"), M.fechaLocal(Date.now()));
  if (!r) { p.textContent = "Tus rodadas, mapas, velocidad y récords."; return; }
  p.textContent = `Esta semana: ${V.numero(r.kmSemana, 1)} km. Última: ${titulo(r.ultima)}${r.kmUltima > 0 ? `, ${V.km(r.kmUltima * 1000)}` : ""}.`;
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
  const f = document.getElementById("cycling-date");
  if (f && !f.value) f.value = M.fechaLocal(Date.now());
  mostrarHoja("bici-manual-hoja");
  setTimeout(() => { const d = document.getElementById("cycling-distance"); if (d && window.matchMedia("(pointer: fine)").matches) d.focus(); }, 250);
}

// ---- Eventos ----
document.addEventListener("click", e => {
  if (e.target.closest("[data-bici-mas]")) { e.preventDefault(); mostrarHoja("bici-mas-hoja"); return; }
  const op = e.target.closest("[data-bici-op]");
  if (op) {
    ocultarHoja("bici-mas-hoja");
    if (op.dataset.biciOp === "importar") window.RunImportar && RunImportar.abrir();
    else if (op.dataset.biciOp === "manual") { e.preventDefault(); abrirManual(); }
    return;
  }
  ["bici-mas-hoja", "bici-manual-hoja"].forEach(id => {
    const h = document.getElementById(id);
    if (h && h.contains(e.target) && (e.target.closest(".budget-sheet-close") || e.target.classList.contains("budget-sheet-overlay"))) ocultarHoja(id);
  });
  const f = e.target.closest("[data-bf-filtro]");
  if (f) { filtro = f.dataset.bfFiltro; mostrar = PAGINA; pintar(); return; }
  if (e.target.closest("[data-bf-mas]")) masTarjetas();
});
// Anotar a mano: ActividadRegistro guarda (y vacía el formulario); aquí se
// cierra la hoja. Se escucha antes (captura) para ver si el formulario es válido.
document.addEventListener("submit", e => {
  if (e.target.id !== "cycling-form") return;
  if (e.target.checkValidity()) setTimeout(() => ocultarHoja("bici-manual-hoja"), 0);
}, true);
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  ["bici-manual-hoja", "bici-mas-hoja"].forEach(ocultarHoja);
});
RunDatos.al(() => { pintar(); pintarInicio(); });
document.addEventListener("DOMContentLoaded", pintar);
window.addEventListener("hashchange", () => { ocultarHoja("bici-mas-hoja"); ocultarHoja("bici-manual-hoja"); });

window.BiciFeed = { pintar, pintarInicio };
})();
