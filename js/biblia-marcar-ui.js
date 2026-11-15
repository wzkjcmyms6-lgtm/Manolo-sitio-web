// ---------- Biblia: "Leí en mi Biblia" (pantalla, D-122) ----------
// Para cuando lees en tu Biblia de papel: marcar capítulos sin abrir el lector.
// - Tarjeta arriba de Biblia: "✓ Leí Génesis 2" (el que sigue al último que
//   marcaste) o, con un plan, "✓ Ya leí lo de hoy: Mateo 2–3". Un toque.
// - "Elegir otros capítulos": libro (recientes arriba) → números de capítulo;
//   tocar uno lo marca como leído hoy; tocarlo otra vez lo quita (solo lo de hoy).
// - Progreso › un libro abre esta misma hoja (con "Leer en la app").
// Cada marca con aviso y "Deshacer". Lo leído es lo mismo que "Marcar como
// leído" del lector (meta/biblia_leidos): cuenta para racha, planes, Hábitos y
// "Mi día". Lógica en js/biblia-marcar.js.
(function () {
"use strict";
const B = window.BibliaMotor, K = window.BibliaMarcar, L = window.BibliaLector;
if (!B || !K || !L || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const hoja = window.Lectura.hoja("bmk-hoja");
hoja.el.classList.add("bmk-raiz");
let vista = null;      // null (libros) o { libro, leer }
let filtro = "";
let volverA = null;

// ---- Aviso con "Deshacer" (5 s) ----
let toastT = null, deshacerFn = null;
function aviso(texto, deshacer) {
  let el = document.getElementById("bmk-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "bmk-toast";
    el.className = "undo-toast bmk-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = `<span class="undo-toast-msg"></span><button type="button" class="undo-toast-btn">Deshacer</button><span class="undo-toast-bar"></span>`;
    el.querySelector("button").addEventListener("click", () => { const f = deshacerFn; ocultar(); if (f) f(); });
    document.body.appendChild(el);
  }
  deshacerFn = deshacer || null;
  el.querySelector(".undo-toast-msg").textContent = texto;
  el.querySelector("button").hidden = !deshacer;
  el.hidden = false;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(ocultar, deshacer ? 5000 : 2600);
}
function ocultar() {
  clearTimeout(toastT);
  deshacerFn = null;
  const el = document.getElementById("bmk-toast");
  if (el) { el.classList.remove("show"); el.hidden = true; }
}

// ---- Marcar ----
// Marca (o quita) lo de hoy; el aviso deshace exactamente eso.
function marcar(claves, si) {
  const hoy = hoyLocal();
  const ks = claves.filter(k => K.leer(k));
  const cambian = ks.filter(k => K.estado(L.leidos(), k, hoy).hoy !== si);
  if (!cambian.length) return;
  L.marcar(cambian, si);
  aviso(si ? `Marcaste ${K.texto(cambian)} como leído.` : `Quitaste ${K.texto(cambian)} de hoy.`, () => L.marcar(cambian, !si));
}

// El plan con lectura pendiente hoy (js/biblia-plan-ui.js).
function planHoy() {
  const PU = window.BibliaPlanesUI;
  if (!PU || !PU.estados) return null;
  const x = PU.estados().find(y => y.e && !y.e.terminado && y.e.lectura.length);
  return x ? x.e.lectura.slice() : null;
}

// ---- Tarjeta de arriba (la pone js/biblia.js) ----
function tarjeta() {
  const leidos = L.leidos(), hoy = hoyLocal();
  const s = K.sugerir(leidos, { plan: planHoy() || [], lector: L.ultimo() });
  const hechos = K.deHoy(leidos, hoy);
  const boton = s.tipo === "plan"
    ? `<button type="button" class="lib-btn lib-btn-ancho bmk-si" data-bmk-marcar="${esc(s.claves.join(","))}">✓ Ya leí lo de hoy: ${esc(K.texto(s.claves))}</button>`
    : `<button type="button" class="lib-btn lib-btn-ancho bmk-si" data-bmk-marcar="${esc(s.clave)}">✓ Leí ${esc(K.nombre(s.clave))}</button>`;
  return `<section class="bmk" aria-labelledby="bmk-t">
      <h2 class="bmk-t" id="bmk-t"><span aria-hidden="true">📖</span>Leí en mi Biblia</h2>
      <p class="bmk-ayuda">${hechos.length ? `Hoy marcaste: <b>${esc(K.texto(hechos))}</b>.` : "¿Leíste en tu Biblia de papel? Márcalo aquí, sin abrir el lector."}</p>
      ${boton}
      <button type="button" class="lib-btn-sec lib-btn-ancho" data-bmk="elegir">Elegir otros capítulos</button>
    </section>`;
}

// ---- Hoja: libros ----
function librosHTML() {
  const leidos = L.leidos();
  const q = B.normalizar(filtro);
  const btn = l => {
    const d = K.delLibro(leidos, l.id);
    return `<button type="button" class="bbl-libro-b${d.leidos === d.total ? " is-completo" : ""}" data-bmk-libro="${l.id}"><span>${esc(l.nombre)}</span><small>${d.leidos ? `${d.leidos}/${d.total}` : d.total}</small></button>`;
  };
  const grupo = (titulo, ls) => (ls.length ? `<h4 class="bbl-sel-t">${titulo}</h4><div class="bbl-libros">${ls.map(btn).join("")}</div>` : "");
  const rec = q ? [] : K.recientes(leidos, 4).map(id => B.libro(id)).filter(Boolean);
  const de = t => B.LIBROS.filter(l => l.testamento === t && (!q || B.normalizar(l.nombre).includes(q)));
  const lista = grupo("Hace poco", rec) + grupo("Antiguo Testamento", de("AT")) + grupo("Nuevo Testamento", de("NT"));
  return lista || `<p class="empty-state">Ningún libro se llama así.</p>`;
}
function abrirLibros() {
  vista = null;
  filtro = "";
  mostrar("Elegir capítulos", `
    <p class="lib-nota bmk-nota">Toca el libro y después los capítulos que leíste: quedan como leídos hoy.</p>
    <input type="search" class="lib-input bbl-sel-buscar bmk-buscar" placeholder="Buscar libro (ej: salmos)" autocomplete="off" aria-label="Buscar libro">
    <div class="bmk-lista">${librosHTML()}</div>`, ".bmk-buscar");
}

// ---- Hoja: capítulos de un libro ----
function capsHTML(id) {
  const l = B.libro(id), leidos = L.leidos(), hoy = hoyLocal();
  const d = K.delLibro(leidos, id);
  const fechaCorta = f => B.fechaLarga(f).replace(/^\S+ /, "").replace(new RegExp(` ${hoy.slice(0, 4)}$`), "");
  let html = "";
  for (let c = 1; c <= l.capitulos; c++) {
    const k = K.clave(id, c), s = K.estado(leidos, k, hoy);
    const cls = s.hoy ? " is-leido is-hoy" : s.leido ? " is-leido is-antes" : "";
    const etiqueta = `${l.nombre} ${c}${s.hoy ? ": leído hoy" : s.leido ? `: leído el ${fechaCorta(s.fecha)}` : ""}`;
    html += `<button type="button" class="bbl-cap-b${cls}" data-bmk-cap="${k}" aria-pressed="${s.hoy}" aria-label="${esc(etiqueta)}">${c}</button>`;
  }
  return `<p class="bmk-cuenta"><b>${d.leidos} de ${d.total}</b> leídos${K.deHoy(leidos, hoy).some(k => k.startsWith(`${id}.`)) ? ` · hoy: ${esc(K.texto(K.deHoy(leidos, hoy).filter(k => k.startsWith(`${id}.`))))}` : ""}</p>
    <div class="bbl-caps bmk-caps">${html}</div>
    <p class="lib-nota bmk-nota">Toca un capítulo para marcarlo como leído hoy; tócalo otra vez para quitarlo. ✓ = ya lo leíste.</p>`;
}
function abrirLibro(id, o) {
  const l = B.libro(id);
  if (!l) return;
  vista = { libro: id, leer: !!(o && o.leer) };
  mostrar(l.nombre, cuerpoLibro(), ".bmk-caps .bbl-cap-b:not(.is-leido)");
}
function cuerpoLibro() {
  const { libro, leer } = vista;
  return `${leer ? "" : `<button type="button" class="bbl-sel-volver" data-bmk="libros">‹ Libros</button>`}
    <div class="bmk-libro">${capsHTML(libro)}</div>
    <div class="bmk-pie">
      <button type="button" class="lib-btn lib-btn-ancho" data-bmk="listo">Listo</button>
      ${leer ? `<button type="button" class="lib-btn-sec lib-btn-ancho" data-bmk="leer">📖 Leer ${esc(B.libro(libro).nombre)} en la app</button>` : ""}
    </div>`;
}

// Hoja con el foco bien puesto (y de vuelta al cerrar).
function mostrar(titulo, html, enfocar) {
  if (!hoja.abierta()) volverA = document.activeElement;
  hoja.abrir(titulo, html);
  const destino = (enfocar && hoja.el.querySelector(enfocar)) || hoja.el.querySelector(".budget-sheet-close");
  if (destino) setTimeout(() => destino.focus({ preventScroll: true }), 60);
}
const cerrarBase = hoja.cerrar;
hoja.cerrar = () => {
  cerrarBase();
  const v = volverA;
  volverA = null;
  if (v && document.contains(v) && v.getClientRects().length) setTimeout(() => v.focus({ preventScroll: true }), 220);
};
// Lo marcado cambia la hoja abierta (sin moverla).
function refrescar() {
  if (!hoja.abierta()) return;
  if (vista) {
    const caja = hoja.el.querySelector(".bmk-libro");
    if (caja) caja.innerHTML = capsHTML(vista.libro);
  } else {
    const lista = hoja.el.querySelector(".bmk-lista");
    if (lista) lista.innerHTML = librosHTML();
  }
}
window.addEventListener("biblia:lector", refrescar);

// ---- Toques ----
hoja.el.addEventListener("input", e => {
  if (!e.target.classList.contains("bmk-buscar")) return;
  filtro = e.target.value;
  hoja.el.querySelector(".bmk-lista").innerHTML = librosHTML();
});
hoja.el.addEventListener("click", e => {
  const lb = e.target.closest("[data-bmk-libro]");
  if (lb) { abrirLibro(lb.dataset.bmkLibro); return; }
  const cap = e.target.closest("[data-bmk-cap]");
  if (cap) {
    const k = cap.dataset.bmkCap;
    marcar([k], !K.estado(L.leidos(), k, hoyLocal()).hoy);
    // El foco queda en el mismo número después de repintar.
    requestAnimationFrame(() => { const b = hoja.el.querySelector(`[data-bmk-cap="${k}"]`); if (b) b.focus({ preventScroll: true }); });
    return;
  }
  const a = e.target.closest("[data-bmk]");
  if (!a) return;
  if (a.dataset.bmk === "libros") abrirLibros();
  else if (a.dataset.bmk === "listo") hoja.cerrar();
  else if (a.dataset.bmk === "leer" && vista) {
    const id = vista.libro;
    hoja.cerrar();
    // El primer capítulo que no leíste de ese libro (o el 1).
    const set = K.todos(L.leidos());
    let c = 1;
    while (c < B.libro(id).capitulos && set.has(K.clave(id, c))) c++;
    setTimeout(() => L.abrir(id, c, { y: 0 }), 230);
  }
});
document.addEventListener("click", e => {
  const m = e.target.closest("[data-bmk-marcar]");
  if (m) { marcar(m.dataset.bmkMarcar.split(","), true); return; }
  if (e.target.closest('#bib-resumen [data-bmk="elegir"]')) abrirLibros();
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && hoja.abierta()) hoja.cerrar(); });

window.BibliaMarcarUI = { tarjeta, abrirLibros, abrirLibro };
})();
