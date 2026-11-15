// ---------- iPhone: lo fijo de la pantalla vuelve a su lugar (D-120) ----------
// A veces, después de escribir (al cerrar el teclado o el selector de hora),
// el iPhone deja la parte visible de la página "corrida" respecto de la que
// usa para lo fijo: la barra de abajo y el ＋ quedan flotando a media
// pantalla, la barra de arriba se esconde y el texto pasa por debajo de la
// hora y la batería (capturas del dueño, 2026-11-15). El navegador lo
// informa en window.visualViewport: aquí se calcula cuánto mover lo fijo y
// css/viewport.css lo aplica con --vv-arriba y --vv-abajo. Casi siempre
// valen 0 y no cambia nada. Mientras escribes no se toca (es lo normal del
// teclado). Pruebas: tests/viewport-ajuste.test.js y scripts/e2e/pantalla.js.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.ViewportAjuste = api; api.iniciar(); }
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

// v: { offsetTop, height, scale, innerHeight, escribiendo } → { arriba, abajo } en px.
// arriba: cuánto bajar lo fijado arriba; abajo: cuánto bajar lo fijado abajo.
function calcular(v) {
  const cero = { arriba: 0, abajo: 0 };
  if (!v || v.escribiendo) return cero;
  const escala = Number(v.scale) || 1;
  if (Math.abs(escala - 1) > 0.01) return cero;           // con zoom de dos dedos, lo normal
  const alto = Number(v.innerHeight) || 0;
  if (alto <= 0) return cero;
  const top = Number(v.offsetTop) || 0, h = Number(v.height) || 0;
  const limpio = x => { const n = Math.round(x); return n < 2 ? 0 : Math.min(n, alto); };
  return { arriba: limpio(top), abajo: limpio(top + h - alto) };
}
const igual = (a, b) => Math.abs(a.arriba - b.arriba) <= 2 && Math.abs(a.abajo - b.abajo) <= 2;

// ¿Hay un campo de texto (o selector) abierto? Entonces el teclado manda.
function escribiendo(doc) {
  const a = doc && doc.activeElement;
  if (!a) return false;
  if (a.isContentEditable || a.tagName === "TEXTAREA" || a.tagName === "SELECT") return true;
  return a.tagName === "INPUT" && !/^(checkbox|radio|range|button|submit|reset|file|color|hidden|image)$/i.test(a.type || "");
}

function iniciar() {
  if (typeof window === "undefined" || !window.visualViewport || typeof document === "undefined") return;
  const vv = window.visualViewport, raiz = document.documentElement;
  let actual = { arriba: 0, abajo: 0 }, pendiente = false, reloj = null;
  const leer = () => calcular({ offsetTop: vv.offsetTop, height: vv.height, scale: vv.scale, innerHeight: window.innerHeight, escribiendo: escribiendo(document) });
  function aplicar(r) {
    actual = r;
    raiz.style.setProperty("--vv-arriba", `${r.arriba}px`);
    raiz.style.setProperty("--vv-abajo", `${r.abajo}px`);
    raiz.classList.toggle("vv-corrida", !!(r.arriba || r.abajo));
  }
  function medir() {
    pendiente = false;
    const r = leer();
    if (igual(r, actual)) return;
    clearTimeout(reloj);
    if (!r.arriba && !r.abajo) { aplicar(r); return; }
    // Se confirma un momento después: mientras el iPhone acomoda la pantalla
    // (teclado que se cierra, barras que se esconden) los números bailan.
    reloj = setTimeout(() => { const r2 = leer(); if (igual(r2, r)) aplicar(r2); }, 150);
  }
  const pedir = () => { if (!pendiente) { pendiente = true; requestAnimationFrame(medir); } };
  vv.addEventListener("resize", pedir);
  vv.addEventListener("scroll", pedir);
  window.addEventListener("scroll", pedir, { passive: true });
  window.addEventListener("resize", pedir);
  window.addEventListener("pageshow", pedir);
  document.addEventListener("visibilitychange", pedir);
  document.addEventListener("focusin", pedir);
  // Al cerrar el teclado el iPhone tarda en acomodarse.
  document.addEventListener("focusout", () => { pedir(); setTimeout(pedir, 400); setTimeout(pedir, 900); });
  pedir();
}

return { calcular, escribiendo, iniciar };
});
