// ---------- Biblia: progreso de capítulos (pantalla, fase 3) ----------
// Página #biblia-progreso: capítulos leídos de los 1.189 (toda la Biblia,
// Antiguo y Nuevo Testamento, este año) y el mapa de los 66 libros; tocar
// un libro muestra sus capítulos (leídos marcados) y tocar uno lo abre en
// el lector. Lo leído viene de meta/biblia_leidos ("Marcar como leído").
// Lógica en js/biblia-planes.js (progresoBiblia). D-106.
(function () {
const B = window.BibliaMotor, P = window.BibliaPlanes, L = window.BibliaLector;
const app = document.getElementById("bpr-app");
if (!B || !P || !L || !app || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const hoja = window.Lectura.hoja("bpr-hoja");
const miles = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const coma = n => String(n).replace(".", ",");

function barra(x, etiqueta) {
  return `<div class="bpr-fila"><span>${esc(etiqueta)}</span><b>${miles(x.leidos)} de ${miles(x.total)}</b>
    <span class="bpl-barra" aria-hidden="true"><i style="width:${Math.min(100, x.pct)}%"></i></span></div>`;
}
function render() {
  const pr = P.progresoBiblia(L.leidos());
  const anio = hoyLocal().slice(0, 4);
  const tile = l => `<button type="button" class="bpr-libro${l.leidos === l.total ? " is-completo" : l.leidos ? " is-empezado" : ""}" data-bpr-libro="${l.id}" style="--p:${l.pct}%" aria-label="${esc(l.nombre)}: ${l.leidos} de ${l.total} capítulos">
      <span class="bpr-libro-n">${esc(l.nombre)}</span><small>${l.leidos === l.total ? "✓" : `${l.leidos}/${l.total}`}</small></button>`;
  app.innerHTML = `
    <div class="bpr-total">
      <p class="bpr-grande"><b>${coma(pr.total.pct)} %</b><span>de la Biblia leída</span></p>
      ${barra(pr.total, "Capítulos")}
      ${barra(pr.at, "Antiguo Testamento")}
      ${barra(pr.nt, "Nuevo Testamento")}
      <p class="lib-nota">${pr.completos} ${pr.completos === 1 ? "libro completo" : "libros completos"} · ${miles(P.enElAnio(L.leidos(), anio))} capítulos leídos en ${anio}.</p>
    </div>
    <h2 class="bpl-t">Antiguo Testamento</h2>
    <div class="bpr-mapa">${pr.libros.filter(l => l.testamento === "AT").map(tile).join("")}</div>
    <h2 class="bpl-t">Nuevo Testamento</h2>
    <div class="bpr-mapa">${pr.libros.filter(l => l.testamento === "NT").map(tile).join("")}</div>
    <p class="lib-nota">Toca un libro para marcar los capítulos que leíste (también en tu Biblia de papel). Cuenta lo de «Leí en mi Biblia» y lo de «Marcar como leído» del lector.</p>`;
}
function abrirLibro(id) {
  const l = B.libro(id);
  const leidos = P.leidosTodos(L.leidos());
  let html = `<div class="bbl-caps">`;
  for (let c = 1; c <= l.capitulos; c++) {
    const si = leidos.has(P.clave(id, c));
    html += `<button type="button" class="bbl-cap-b${si ? " is-leido" : ""}" data-bpr-ir="${id}.${c}" aria-label="${esc(l.nombre)} ${c}${si ? " (leído)" : ""}">${c}</button>`;
  }
  const n = Array.from({ length: l.capitulos }, (_, i) => i + 1).filter(c => leidos.has(P.clave(id, c))).length;
  hoja.abrir(`${l.nombre} · ${n} de ${l.capitulos}`, html + `</div><p class="lib-nota">✓ = leídos. Toca un capítulo para leerlo.</p>`);
}
app.addEventListener("click", e => {
  const b = e.target.closest("[data-bpr-libro]");
  if (!b) return;
  // D-122: los capítulos se marcan con un toque (y "Leer en la app" para el lector).
  if (window.BibliaMarcarUI) BibliaMarcarUI.abrirLibro(b.dataset.bprLibro, { leer: true });
  else abrirLibro(b.dataset.bprLibro);
});
hoja.el.addEventListener("click", e => {
  const b = e.target.closest("[data-bpr-ir]");
  if (!b) return;
  const [libro, cap] = b.dataset.bprIr.split(".");
  hoja.cerrar();
  L.abrir(libro, Number(cap), { y: 0 });
});
const panel = document.getElementById("panel-biblia-progreso");
window.addEventListener("biblia:lector", () => { if (!panel || !panel.hidden) render(); });
window.addEventListener("hashchange", () => { if (location.hash === "#biblia-progreso") render(); });
onAuthReady(() => render());
render();

window.BibliaProgresoUI = { render };
})();
