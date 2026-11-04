// ---------- Running › Mapa de calor (fase 6) ----------
// Todas tus rutas encima de otras, en naranja semitransparente: donde más
// corres se ve más intenso. Primero un dibujo propio (sirve sin internet) y,
// con "Ver con calles", Leaflet con las teselas de OpenStreetMap. Usa la mini
// ruta de cada carrera (no lee rutas completas). #run-calor y una tarjeta en
// Progreso.
(function () {
"use strict";
const V = window.RunVista, M = window.RunMetricas, A = window.RunAnalisis;
const FILTROS = [["todas", "Todas"], ["anio", "Este año"], ["90", "Últimos 90 días"]];
let filtro = "todas", mapa = null;

const visible = () => location.hash.replace(/^#/, "").split("/")[0] === "run-calor";
function rutas() {
  const ahora = Date.now(), anio = new Date().getFullYear();
  return RunDatos.lista("running").filter(d => d.mini).filter(d => {
    if (filtro === "anio") return String(d.date || "").startsWith(String(anio));
    if (filtro === "90") return ahora - A.momento(d) <= 90 * 86400000;
    return true;
  }).map(d => M.leerMini(d.mini)).filter(p => p.length > 1);
}
// SVG con todas las rutas (proyección común; las zonas muy lejanas achican
// todo, así que se centra en donde más corres: la mediana de los inicios).
function svg(lista, ancho, alto) {
  if (!lista.length) return "";
  const inicios = lista.map(r => r[0]);
  const med = k => inicios.map(p => p[k]).sort((a, b) => a - b)[Math.floor(inicios.length / 2)];
  const centro = { lat: med("lat"), lon: med("lon") };
  const cerca = lista.filter(r => M.haversine(r[0], centro) < 30000);
  const pr = V.proyectar(cerca.map(r => V.aligerar(r, 160)), ancho, alto, 10);
  return `<svg class="rc-svg" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Mapa de calor de tus rutas">${pr.map(t => `<polyline points="${t.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}"/>`).join("")}</svg>`;
}
function pintar() {
  if (!visible()) { if (mapa) { mapa.remove(); mapa = null; } return; }
  const app = document.getElementById("rc-app");
  if (!app) return;
  const lista = rutas();
  if (mapa) { mapa.remove(); mapa = null; }
  app.innerHTML = `
    <div class="fin-tabs rp-periodos" role="tablist">${FILTROS.map(([k, t]) => `<button type="button" role="tab" class="fin-tab${k === filtro ? " active" : ""}" aria-selected="${k === filtro}" data-rc-filtro="${k}">${t}</button>`).join("")}</div>
    ${lista.length ? `<div class="rc-caja" id="rc-caja">${svg(lista, 340, 340)}</div>
      <p class="rd-nota">${lista.length} ${lista.length === 1 ? "carrera con ruta" : "carreras con ruta"}. Donde más corres se ve más intenso.</p>
      <button type="button" class="lib-btn-sec rd-btn" data-rc-calles>Ver con calles</button>
      <p class="rd-atribucion">Mapas: © OpenStreetMap</p>`
    : `<div class="run-vacio"><p><b>Todavía no hay rutas aquí.</b></p><p>Importa carreras con GPS (archivos del reloj o de Strava) y aparecerán en este mapa.</p></div>`}`;
}
function conCalles() {
  const caja = document.getElementById("rc-caja");
  if (!caja || navigator.onLine === false) return alert("Hace falta internet para ver las calles.");
  const lista = rutas();
  RunMapa.cargarLeaflet().then(L => {
    if (!visible()) return;
    caja.innerHTML = `<div class="run-leaflet rc-leaflet"></div>`;
    caja.classList.add("rd-mapa");
    const div = caja.firstChild;
    mapa = L.map(div, { preferCanvas: true, scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(mapa);
    const renderer = L.canvas({ padding: 0.5 });
    const capas = lista.map(r => L.polyline(r.map(p => [p.lat, p.lon]), { renderer, color: "#ff7a30", weight: 3, opacity: 0.35, interactive: false }).addTo(mapa));
    mapa.fitBounds(L.featureGroup(capas).getBounds(), { padding: [16, 16], maxZoom: 15 });
    const b = document.querySelector("[data-rc-calles]");
    if (b) b.remove();
  }).catch(() => alert("No se pudo cargar el mapa."));
}
// Tarjeta en Progreso con una vista previa.
function tarjeta() {
  const lista = RunDatos.lista("running").filter(d => d.mini).map(d => M.leerMini(d.mini)).filter(p => p.length > 1);
  if (!lista.length) return "";
  return `<a class="rd-sec rc-tarjeta" href="#run-calor"><span class="rc-tarjeta-mapa">${svg(lista.slice(0, 300), 120, 90)}</span>
    <span><b>Mapa de calor</b><small>Todas tus rutas en un mapa (${lista.length})</small></span><span class="icon-sm" data-icon="chevronRight"></span></a>`;
}

document.addEventListener("click", e => {
  const f = e.target.closest("[data-rc-filtro]");
  if (f) { filtro = f.dataset.rcFiltro; pintar(); return; }
  if (e.target.closest("[data-rc-calles]")) conCalles();
});
if (window.RunDatos) RunDatos.al(() => { if (!mapa) pintar(); });
window.addEventListener("hashchange", pintar);
document.addEventListener("DOMContentLoaded", pintar);
window.RunCalor = { tarjeta };
})();
