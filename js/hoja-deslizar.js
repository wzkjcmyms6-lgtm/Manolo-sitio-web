// ---------- Deslizar hacia abajo para cerrar una hoja (como en las apps del iPhone) ----------
// Sirve para todas las hojas que suben desde abajo: Finanzas, Hábitos,
// Ejercicio, Running, Rangos y el selector de categorías.
// - La hoja sigue al dedo mientras se arrastra hacia abajo y el fondo se
//   aclara.
// - Al soltar: si bajó lo suficiente (un 30 % de su alto) o se lanzó rápido
//   hacia abajo, se cierra; si no, vuelve a su lugar.
// - Para cerrar usa lo mismo que tocar el fondo oscuro (o la ✕), así cada
//   hoja hace lo suyo al cerrarse. Si una hoja no se deja cerrar así, vuelve.
// - Si el contenido de la hoja está desplazado hacia abajo, primero sube el
//   contenido; recién arriba del todo se arrastra la hoja. Un gesto de lado
//   (por ejemplo las categorías que se deslizan) no mueve la hoja.
(function () {
const PANELES = ".budget-sheet-panel, .muscle-sheet-panel, .cat-sheet-panel";
const FONDOS = ":scope > .budget-sheet-overlay, :scope > .muscle-sheet-overlay";
const CERRAR = '[aria-label="Cerrar"], .budget-sheet-close, .muscle-sheet-close, [data-cerrar]';
const UMBRAL_MOVER = 8;      // px antes de decidir si el gesto es de la hoja
const FRACCION_CIERRE = 0.3; // del alto de la hoja
const VELOCIDAD_CIERRE = 0.6; // px/ms hacia abajo al soltar
const MS_ANIMACION = 220;

let g = null; // gesto en curso

// El elemento con scroll vertical más cercano al dedo, dentro de la hoja.
function conScroll(desde, panel) {
  for (let el = desde; el && el !== panel.parentElement; el = el.parentElement) {
    if (el.nodeType !== 1) continue;
    const oy = getComputedStyle(el).overflowY;
    if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) return el;
  }
  return null;
}
const cerrandose = raiz => raiz.hidden || raiz.classList.contains("is-closing") || raiz.classList.contains("closing");

function limpiar(panel, fondo, raiz) {
  panel.style.transition = "";
  panel.style.transform = "";
  if (fondo) { fondo.style.transition = ""; fondo.style.opacity = ""; }
  raiz.classList.remove("hoja-arrastrando", "hoja-deslizada");
}

document.addEventListener("touchstart", e => {
  g = null;
  if (e.touches.length !== 1) return;
  const panel = e.target.closest && e.target.closest(PANELES);
  if (!panel) return;
  const raiz = panel.parentElement;
  if (!raiz || cerrandose(raiz) || raiz.classList.contains("hoja-deslizada")) return;
  if (e.target.closest('input[type="range"]')) return;
  const t = e.touches[0];
  g = {
    panel, raiz, fondo: raiz.querySelector(FONDOS),
    scroller: conScroll(e.target, panel),
    x0: t.clientX, y0: t.clientY, d: 0, estado: "espera",
    muestras: [{ y: t.clientY, t: e.timeStamp }]
  };
}, { passive: true, capture: true });

document.addEventListener("touchmove", e => {
  if (!g || e.touches.length !== 1) return;
  const t = e.touches[0];
  const dx = t.clientX - g.x0, dy = t.clientY - g.y0;
  if (g.estado === "espera") {
    if (Math.abs(dx) < UMBRAL_MOVER && Math.abs(dy) < UMBRAL_MOVER) return;
    const haciaAbajo = dy > 0 && Math.abs(dy) > Math.abs(dx);
    if (!haciaAbajo || (g.scroller && g.scroller.scrollTop > 0)) { g = null; return; }
    g.estado = "arrastre";
    g.y0 = t.clientY;   // desde aquí, sin salto
    g.alto = g.panel.getBoundingClientRect().height || window.innerHeight;
    g.raiz.classList.add("hoja-arrastrando");
  }
  e.preventDefault();   // la hoja se mueve: la página no se desplaza
  g.d = Math.max(0, t.clientY - g.y0);
  g.panel.style.transform = g.d ? `translateY(${g.d}px)` : "";
  if (g.fondo) g.fondo.style.opacity = String(1 - Math.min(1, g.d / g.alto) * 0.85);
  g.muestras.push({ y: t.clientY, t: e.timeStamp });
  if (g.muestras.length > 6) g.muestras.shift();
}, { passive: false, capture: true });

function soltar(e) {
  const a = g;
  g = null;
  if (!a || a.estado !== "arrastre") return;
  // Velocidad de los últimos ~100 ms.
  const fin = a.muestras[a.muestras.length - 1];
  const ini = a.muestras.find(m => fin.t - m.t <= 100) || fin;
  const v = fin.t > ini.t ? (fin.y - ini.y) / (fin.t - ini.t) : 0;
  const cerrar = e.type !== "touchcancel" && (a.d > a.alto * FRACCION_CIERRE || (v > VELOCIDAD_CIERRE && a.d > 30));
  a.raiz.classList.remove("hoja-arrastrando");
  if (cerrar) {
    // Cierre: la hoja sigue bajando desde donde quedó (sin el salto de su
    // propia animación) y la hoja misma se cierra como al tocar el fondo.
    a.raiz.classList.add("hoja-deslizada");
    a.panel.style.transition = `transform ${MS_ANIMACION}ms ease-in`;
    a.panel.style.transform = `translateY(${a.alto + 24}px)`;
    if (a.fondo) { a.fondo.style.transition = `opacity ${MS_ANIMACION}ms ease-in`; a.fondo.style.opacity = "0"; }
    const boton = a.fondo || a.raiz.querySelector(CERRAR);
    if (boton) boton.click();
    if (cerrandose(a.raiz)) { setTimeout(() => limpiar(a.panel, a.fondo, a.raiz), MS_ANIMACION + 120); return; }
    a.raiz.classList.remove("hoja-deslizada");
  }
  // Vuelve a su lugar.
  a.panel.style.transition = `transform ${MS_ANIMACION}ms cubic-bezier(0.22, 1, 0.36, 1)`;
  a.panel.style.transform = "translateY(0)";
  if (a.fondo) { a.fondo.style.transition = `opacity ${MS_ANIMACION}ms`; a.fondo.style.opacity = ""; }
  setTimeout(() => limpiar(a.panel, a.fondo, a.raiz), MS_ANIMACION + 40);
}
document.addEventListener("touchend", soltar, { capture: true });
document.addEventListener("touchcancel", soltar, { capture: true });
})();
