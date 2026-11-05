// ---------- Ficha del ejercicio (hoja) ----------
// Se abre tocando el nombre de un ejercicio (cualquier elemento con
// data-ficha="id" o data-ficha-nombre="nombre guardado"): en el entreno en
// vivo, en las rutinas, en el buscador, en Rangos y en el detalle de una
// sesión. Fase 1: demo, músculos en el mapa, equipo y créditos de la base.
// (La fase 2 suma cómo se hace, videos, historial, récords y alternativas.)
(function () {
"use strict";

const NS = "http://www.w3.org/2000/svg";
let hoja = null;

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const nombreMusculo = id => (MuscleEngine.MUSCULO_POR_ID[id] || {}).nombre || id;
const equipoTexto = f => (window.ExerciseSearch && ExerciseSearch.EQUIPOS[f.equipo] || {}).nombre || "";
const MECANICA = { c: "Compuesto", a: "Aislamiento" };
const TIPO = { carga: "Con peso", peso_corporal: "Peso corporal", cardio: "Cardio", isometrico: "Isométrico" };

// Frente y espalda con los músculos del ejercicio (primarios fuertes,
// secundarios suaves), con el mismo arte que el mapa.
function figuras(f) {
  const out = [];
  [["frente", "Frente"], ["espalda", "Espalda"]].forEach(([vista, txt]) => {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "figura ejf-fig");
    svg.setAttribute("viewBox", "0 0 140 300");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${txt}: músculos que trabaja`);
    BodyFigures.dibujar(svg, BodyFigures[vista]);
    svg.querySelectorAll(".mz").forEach(g => {
      const m = g.getAttribute("data-muscle");
      if ((f.primarios || []).includes(m)) g.setAttribute("data-nivel", "3");
      else if ((f.secundarios || []).includes(m)) { g.setAttribute("data-nivel", "2"); g.setAttribute("data-suave", ""); }
    });
    out.push(svg.outerHTML);
  });
  return `<div class="ejf-figs">${out.join("")}</div>`;
}

function contenido(f) {
  const pri = (f.primarios || []).map(nombreMusculo);
  const sec = (f.secundarios || []).map(nombreMusculo);
  const datos = [equipoTexto(f), MECANICA[f.mec], TIPO[f.tipo]].filter(Boolean);
  const demo = EjDemos.html(f);
  return `
    <div class="muscle-sheet-head">
      <div><span class="ejf-arriba">Ejercicio</span><h3 id="ejf-titulo">${esc(f.nombre)}</h3>
        <span class="muscle-sheet-period">${esc(datos.join(" · "))}</span></div>
      <button type="button" class="muscle-sheet-close" data-cerrar aria-label="Cerrar"><span data-icon="close"></span></button>
    </div>
    ${demo || `<p class="ejf-sin-demo">Este ejercicio no tiene demo con fotos. Abajo ves los músculos que trabaja.</p>`}
    <section class="ejf-musculos" aria-label="Músculos">
      ${figuras(f)}
      <div class="ejf-musc-txt">
        ${pri.length ? `<p><b>Principales</b>${esc(pri.join(" · "))}</p>` : ""}
        ${sec.length ? `<p><b>Ayudan</b>${esc(sec.join(" · "))}</p>` : ""}
      </div>
    </section>`;
}

function abrir(f) {
  if (!f) return;
  if (!hoja) {
    hoja = document.createElement("div");
    hoja.className = "muscle-sheet ejf-hoja";
    hoja.hidden = true;
    hoja.innerHTML = `<div class="muscle-sheet-overlay" data-cerrar></div>
      <div class="muscle-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="ejf-titulo"><div class="muscle-sheet-grip"></div><div class="ejf-cuerpo"></div></div>`;
    document.body.appendChild(hoja);
    hoja.addEventListener("click", e => { if (e.target.closest("[data-cerrar]")) cerrar(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && hoja && !hoja.hidden) cerrar(); });
  }
  hoja.querySelector(".ejf-cuerpo").innerHTML = contenido(f);
  if (typeof renderIcons === "function") renderIcons(hoja);
  hoja.hidden = false;
  hoja.classList.remove("closing");
  hoja.querySelector(".muscle-sheet-panel").scrollTop = 0;
  document.body.classList.add("sheet-open");
}
function cerrar() {
  if (!hoja || hoja.hidden) return;
  hoja.classList.add("closing");
  setTimeout(() => {
    hoja.hidden = true;
    hoja.classList.remove("closing");
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden]), .muscle-sheet:not([hidden])"));
  }, 220);
}

// La ficha de un ejercicio por id o por el nombre guardado.
function fichaDe(id, nombre) {
  return EjercicioDatos.resolver(nombre || "", id || null);
}
function abrirPor(id, nombre) {
  const f = fichaDe(id, nombre);
  if (f) abrir(f);
  return !!f;
}

document.addEventListener("click", e => {
  const el = e.target.closest && e.target.closest("[data-ficha], [data-ficha-nombre]");
  if (!el) return;
  if (abrirPor(el.dataset.ficha, el.dataset.fichaNombre)) { e.preventDefault(); e.stopPropagation(); }
}, true);

window.EjFicha = { abrir: abrirPor, cerrar };
})();
