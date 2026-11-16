// ---------- "Tu año en Manolo" (D-140, fase 4) ----------
// Diapositivas a pantalla completa con todo tu año (el contenido lo arma
// js/resumen-anio.js con lo que cada sección ya tiene en memoria). Se ve y
// se maneja como el "Manolo Wrapped" de Hábitos (mismos estilos): tocar a
// la derecha avanza, a la izquierda vuelve; flechas y Escape con teclado.
// Cada diapositiva tiene "Compartir" (imagen 1080 × 1920, sin montos de
// dinero) y la última, "Compartir tu año" (lo destacado, sin Finanzas).
// Se abre desde el menú ☰ y el pie de Inicio ("Tu año") y, del 1 de
// diciembre al 31 de enero, desde una tarjeta en Inicio ("Ahora no" la
// cierra para ese año).
(function () {
"use strict";
const R = window.ResumenMotor, Y = window.ResumenAnio, F = window.ResumenFuentes, I = window.ResumenImagen;
if (!R || !Y || !F) return;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CLAVE = "manolo.anio.visto";   // el año cuya tarjeta cerraste en Inicio
let vista = null;   // { el, slides, i, anterior (foco), y, anios }

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function leerVisto() { try { return localStorage.getItem(CLAVE) || ""; } catch (e) { return ""; } }
function guardarVisto(a) { try { localStorage.setItem(CLAVE, String(a)); } catch (e) { /* sin almacenamiento */ } }
// La tarjeta de Inicio: en diciembre, este año; en enero, el que terminó.
function anioTarjeta(h) {
  const m = Number(h.slice(5, 7)), a = Number(h.slice(0, 4));
  return m === 12 ? a : m === 1 ? a - 1 : null;
}
// El que abre el menú: el de la tarjeta (si tiene datos); si no, el más nuevo con datos.
function anioPorDefecto(h, anios) {
  const a = anioTarjeta(h) || Number(h.slice(0, 4));
  return anios.includes(a) ? a : (anios[0] || Number(h.slice(0, 4)));
}

// ---- Inicio ----
function renderTarjeta() {
  const el = document.getElementById("anio-inicio");
  if (!el) return;
  const h = hoyLocal(), a = anioTarjeta(h);
  if (!a || leerVisto() === String(a)) { el.hidden = true; el.innerHTML = ""; return; }
  // Solo se calcula con Inicio a la vista (al volver a Inicio se recalcula).
  const ini = document.getElementById("panel-inicio");
  if (ini && ini.hidden) return;
  if (!Y.aniosConDatos(F.datos()).includes(a)) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  el.innerHTML = `<p class="sem-ini-eyebrow"><span class="icon-sm" data-icon="sparkle"></span>Tu año</p>
    <p class="sem-ini-t" id="anio-ini-t">Tu ${a} en Manolo${a === Number(h.slice(0, 4)) ? ", hasta hoy" : ""}</p>
    <p class="anio-ini-sub">Tus entrenos, kilómetros, libros, hábitos y más, en un resumen para ver y compartir.</p>
    <div class="sem-ini-acciones"><button type="button" class="lib-btn lib-btn-chico" data-anio-abrir="${a}">Ver mi año</button>
      <button type="button" class="lib-btn-sec lib-btn-chico" data-anio-listo="${a}">Ahora no</button></div>`;
  if (typeof renderIcons === "function") renderIcons(el);
}

// ---- Una diapositiva ----
function slideHtml(s, y, anios) {
  const p = [];
  if (s.eyebrow) p.push(`<p class="hb-wr-eyebrow">${esc(s.eyebrow)}</p>`);
  if (s.grande) p.push(`<p class="hb-wr-grande">${esc(s.grande)}</p>`);
  if (s.titulo) p.push(`<h2 class="hb-wr-t">${esc(s.titulo)}</h2>`);
  if (s.numeros) p.push(`<div class="anio-numeros">${s.numeros.map(n => `<div><b>${esc(n.valor)}</b><span>${esc(n.etiqueta)}</span></div>`).join("")}</div>`);
  if (s.barras && s.barras.some(b => b.valor > 0)) {
    p.push(`<ol class="hb-wr-meses" aria-label="Por mes">${s.barras.map(b => `<li aria-label="${esc(b.texto)}">
      <span class="hb-wr-mes-col" aria-hidden="true"><span style="height:${b.valor > 0 ? Math.max(4, Math.round(b.valor * 100)) : 0}%"></span></span>
      <span class="hb-wr-mes-l" aria-hidden="true">${esc(b.etiqueta)}</span></li>`).join("")}</ol>`);
  }
  (s.lineas || []).forEach(l => p.push(`<p class="hb-wr-p">${esc(l)}</p>`));
  if (s.frase) p.push(`<blockquote class="anio-frase"><p>«${esc(s.frase.texto)}»</p>${s.frase.de ? `<cite>${esc(s.frase.de)}</cite>` : ""}</blockquote>`);
  if (s.lista) p.push(`<ul class="anio-lista">${s.lista.map(x => `<li class="${x.signo > 0 ? "is-bien" : "is-mal"}"><span aria-hidden="true">${x.signo > 0 ? "▲" : "▼"}</span> ${esc(x.texto)}</li>`).join("")}</ul>`);
  if (s.pista) p.push(`<p class="hb-wr-pista">Toca a la derecha para avanzar</p>`);
  if (s.privado) p.push(`<p class="anio-privado">Solo para ti: no entra en «Compartir tu año» y su imagen no lleva montos.</p>`);
  const acc = [];
  // El Wrapped de Hábitos solo si existe para ese año (lo arma js/habitos.js).
  const hab = y.secciones && y.secciones.habitos;
  if (s.habitos && hab && hab.conWrapped && window.HabitosApp && HabitosApp.abrirWrapped) acc.push(`<button type="button" class="hb-wr-btn is-sec" data-anio-hab="${y.anio}">Ver tu año en hábitos</button>`);
  if (s.cierre && y.hayDatos) acc.push(`<button type="button" class="hb-wr-btn" data-anio-compartir-todo>Compartir tu año</button>`, `<button type="button" class="hb-wr-btn is-sec" data-anio-ir="0">Verlo otra vez</button>`);
  else if (s.id !== "portada" && !s.cierre) acc.push(`<button type="button" class="hb-wr-btn is-sec anio-compartir" data-anio-compartir><span class="icon-sm" data-icon="send"></span>Compartir</button>`);
  if (acc.length) p.push(`<div class="hb-wr-acciones">${acc.join("")}</div>`);
  if (s.cierre && anios.length > 1) p.push(`<div class="anio-otros"><span>Otros años</span>${anios.filter(x => x !== y.anio).slice(0, 6).map(x => `<button type="button" class="hb-wr-btn is-sec" data-anio-otro="${x}">${x}</button>`).join("")}</div>`);
  return p.join("");
}

// ---- El visor ----
function abrir(anioN) {
  if (vista) cerrar(true);
  const h = hoyLocal();
  const anios = Y.aniosConDatos(F.datos());
  const a = Number(anioN) || anioPorDefecto(h, anios);
  const y = Y.anio(F.datos({ anio: a }), a);
  if (!y) return;
  const slides = Y.diapositivas(y);
  const el = document.createElement("div");
  el.className = "hb-wrapped anio-wrapped";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", `Tu ${a} en Manolo`);
  el.innerHTML = `<div class="hb-wr-progreso" aria-hidden="true">${slides.map(() => "<span><i></i></span>").join("")}</div>
    <button type="button" class="hb-wr-cerrar" data-anio-cerrar aria-label="Cerrar el resumen del año"><span data-icon="close"></span></button>
    <button type="button" class="hb-wr-zona is-prev" data-anio-paso="-1" aria-label="Anterior"></button>
    <button type="button" class="hb-wr-zona is-next" data-anio-paso="1" aria-label="Siguiente"></button>
    <div class="hb-wr-slide" aria-live="polite"></div>
    <p class="hb-wr-cuenta" aria-hidden="true"></p>`;
  document.body.appendChild(el);
  document.body.classList.add("sheet-open");
  if (typeof renderIcons === "function") renderIcons(el);
  vista = { el, slides, i: -1, anterior: document.activeElement, y, anios: anios.includes(a) ? anios : [a].concat(anios) };
  el.addEventListener("click", clic);
  document.addEventListener("keydown", tecla);
  ir(0);
  el.querySelector(".hb-wr-cerrar").focus();
}
function ir(i) {
  if (!vista) return;
  const { el, slides } = vista;
  const j = Math.max(0, Math.min(slides.length - 1, i));
  if (j === vista.i) return;
  vista.i = j;
  el.dataset.tema = slides[j].tema;
  el.dataset.diapo = slides[j].id;
  const slide = el.querySelector(".hb-wr-slide");
  slide.innerHTML = slideHtml(slides[j], vista.y, vista.anios);
  slide.scrollTop = 0;   // cada diapositiva empieza desde arriba
  Array.from(slide.children).forEach((c, k) => c.style.setProperty("--i", k));
  el.querySelectorAll(".hb-wr-progreso span").forEach((b, k) => { b.classList.toggle("is-visto", k < j); b.classList.toggle("is-on", k === j); });
  el.querySelector(".hb-wr-cuenta").textContent = `${j + 1} de ${slides.length}`;
  el.querySelector(".is-prev").disabled = j === 0;
  el.querySelector(".is-next").disabled = j === slides.length - 1;
  if (typeof renderIcons === "function") renderIcons(slide);
  // El número grande se achica hasta caber en pantallas angostas.
  const g = slide.querySelector(".hb-wr-grande");
  if (g) {
    let fs = parseFloat(getComputedStyle(g).fontSize);
    while (g.scrollWidth > g.clientWidth && fs > 36) { fs -= 4; g.style.fontSize = `${fs}px`; }
  }
  if (!el.contains(document.activeElement) || document.activeElement.disabled) el.querySelector(".hb-wr-cerrar").focus();
}
function cerrar(rapido) {
  if (!vista) return;
  const { el, anterior } = vista;
  vista = null;
  document.removeEventListener("keydown", tecla);
  const fin = () => {
    el.remove();
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden]), .hb-wrapped"));
    if (anterior && anterior.focus && document.contains(anterior)) anterior.focus();
  };
  if (rapido) fin();
  else { el.classList.add("closing"); setTimeout(fin, 200); }
}
function tecla(e) {
  if (!vista) return;
  if (e.key === "Escape") { e.preventDefault(); cerrar(); }
  else if (e.key === "ArrowRight") { e.preventDefault(); ir(vista.i + 1); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); ir(vista.i - 1); }
  else if (e.key === "Tab") {
    // El foco no sale del resumen mientras está abierto.
    const f = Array.from(vista.el.querySelectorAll("button:not([disabled])"));
    const k = f.indexOf(document.activeElement);
    e.preventDefault();
    f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  }
}
function clic(e) {
  if (!vista) return;
  if (e.target.closest("[data-anio-cerrar]")) { cerrar(); return; }
  const z = e.target.closest("[data-anio-paso]");
  if (z) { ir(vista.i + Number(z.dataset.anioPaso)); return; }
  const v = e.target.closest("[data-anio-ir]");
  if (v) { ir(Number(v.dataset.anioIr)); return; }
  const o = e.target.closest("[data-anio-otro]");
  if (o) { abrir(Number(o.dataset.anioOtro)); return; }
  const hb = e.target.closest("[data-anio-hab]");
  if (hb) {
    // El Wrapped completo de Hábitos (js/habitos.js), con sus diapositivas.
    const a = Number(hb.dataset.anioHab);
    cerrar(true);
    try { HabitosApp.abrirWrapped(a); } catch (err) { console.warn("Tu año:", err); }
    return;
  }
  if (e.target.closest("[data-anio-compartir]")) { compartir(I && I.planDiapositiva ? c => I.planDiapositiva(vista.slides[vista.i], c, vista.y.anio) : null, `mi-${vista.y.anio}-${vista.slides[vista.i].id}.png`); return; }
  if (e.target.closest("[data-anio-compartir-todo]")) { compartir(I && I.planAnio ? c => I.planAnio(vista.y, c) : null, `mi-${vista.y.anio}-en-manolo.png`); return; }
  // Tocar la diapositiva (fuera de un botón) también avanza o vuelve, como
  // las zonas de los costados: la diapositiva se puede deslizar si no entra.
  if (e.target.closest(".hb-wr-slide") && !e.target.closest("button, a")) ir(vista.i + (e.clientX < window.innerWidth * 0.3 ? -1 : 1));
}
async function compartir(armar, nombre) {
  if (!armar || !window.RunCompartir) return;
  const canvas = document.createElement("canvas");
  I.dibujar(canvas, armar(I.medidor(canvas)));
  try { await RunCompartir.compartir(await RunCompartir.aBlob(canvas), nombre); } catch (e) { alert("No se pudo armar la imagen."); }
}

// Desde el menú ☰: se cierra el menú y, al salir, el foco vuelve a su botón.
function cerrarMenu() {
  const sb = document.getElementById("sidebar");
  if (sb && sb.classList.contains("open")) { const ov = document.getElementById("sidebar-overlay"); if (ov) ov.click(); }
}
document.addEventListener("click", e => {
  const ab = e.target.closest("[data-anio-abrir]");
  if (ab) {
    e.preventDefault();
    const delMenu = !!ab.closest("#sidebar");
    if (delMenu) cerrarMenu();
    abrir(Number(ab.dataset.anioAbrir) || null);
    if (delMenu && vista) vista.anterior = document.getElementById("menu-toggle");
    return;
  }
  const l = e.target.closest("[data-anio-listo]");
  if (l) { guardarVisto(l.dataset.anioListo); renderTarjeta(); }
});
window.addEventListener("hashchange", () => setTimeout(renderTarjeta, 0));
F.alCambiar(renderTarjeta);
setTimeout(renderTarjeta, 0);

window.ResumenAnioUI = { abrir, cerrar, renderTarjeta, abierto: () => !!vista, diapositiva: () => (vista ? vista.slides[vista.i] : null) };
})();
