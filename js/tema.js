// ---------- Modo claro u oscuro (D-126) ----------
// Va al final de <head>, justo después de css/tema-claro.css y sin "defer"
// (es muy chico): así la página se pinta de una vez con el modo correcto.
// Elección (solo en este teléfono, como en el iPhone): localStorage
// "manolo.tema" = "auto" (como el iPhone) | "claro" | "oscuro".
// - html[data-modo="claro"|"oscuro"] y html[data-tema] con la elección.
// - css/tema-claro.css se desactiva en el modo oscuro: no cuesta nada.
// - La barra del navegador (theme-color) toma el color del fondo.
// La hoja para elegir está en js/tema-ui.js.
(function () {
  var CLAVE = "manolo.tema";
  var COLOR = { claro: "#f4f2ec", oscuro: "#0a0a0a" };
  var pref = "auto";
  try { pref = localStorage.getItem(CLAVE) || "auto"; } catch (e) { /* sin almacenamiento */ }
  if (pref !== "claro" && pref !== "oscuro") pref = "auto";
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  var raiz = document.documentElement;

  function modo() {
    return pref === "claro" || (pref === "auto" && mq && mq.matches) ? "claro" : "oscuro";
  }
  function aplicar() {
    var m = modo();
    var antes = raiz.getAttribute("data-modo");
    raiz.setAttribute("data-modo", m);
    raiz.setAttribute("data-tema", pref);
    var hoja = document.getElementById("tema-claro-css");
    if (hoja) hoja.disabled = m !== "claro";
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute("content", COLOR[m]);
    if (antes && antes !== m) {
      try { window.dispatchEvent(new CustomEvent("tema:cambio", { detail: { modo: m, pref: pref } })); } catch (e) { /* navegador viejo */ }
    }
  }
  aplicar();
  if (mq) {
    if (mq.addEventListener) mq.addEventListener("change", aplicar);
    else if (mq.addListener) mq.addListener(aplicar);
  }

  window.Tema = {
    pref: function () { return pref; },
    modo: modo,
    cambiar: function (p) {
      pref = p === "claro" || p === "oscuro" ? p : "auto";
      try { localStorage.setItem(CLAVE, pref); } catch (e) { /* sin almacenamiento */ }
      aplicar();
    }
  };
})();
