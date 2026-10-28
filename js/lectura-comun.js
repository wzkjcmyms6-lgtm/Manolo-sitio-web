// ---------- Libros y Biblia: piezas de pantalla compartidas ----------
// Escapar texto, fecha de hoy, hoja que sube desde abajo (mismas clases que
// Finanzas, así funciona deslizar para cerrar) y exportar un archivo.
// Lo usan js/biblia.js y js/libros.js.
(function (root) {
"use strict";

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Hoja: hoja(clase) → { el, abrir(titulo, html), cerrar(), abierta() }.
// Tocar el fondo, la ✕ o deslizar hacia abajo la cierra.
function hoja(clase) {
  const el = document.createElement("div");
  el.className = `js-sheet budget-sheet ${clase}`;
  el.hidden = true;
  document.body.appendChild(el);
  const api = {
    el,
    abierta: () => !el.hidden && !el.classList.contains("is-closing"),
    abrir(titulo, html) {
      el.innerHTML = `<div class="budget-sheet-overlay" data-cerrar-hoja></div>
        <div class="budget-sheet-panel lib-hoja-panel" role="dialog" aria-modal="true" aria-labelledby="${clase}-t">
          <div class="budget-sheet-header">
            <button type="button" class="budget-sheet-close" data-cerrar-hoja aria-label="Cerrar"><span data-icon="close"></span></button>
            <h3 id="${clase}-t">${esc(titulo)}</h3>
          </div>
          <div class="lib-hoja-cuerpo">${html}</div>
        </div>`;
      el.hidden = false;
      el.classList.remove("is-closing");
      document.body.classList.add("sheet-open");
      if (typeof renderIcons === "function") renderIcons(el);
    },
    cerrar() {
      if (el.hidden) return;
      el.classList.add("is-closing");
      setTimeout(() => {
        el.hidden = true;
        el.classList.remove("is-closing");
        document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden])"));
      }, 200);
    }
  };
  el.addEventListener("click", e => { if (e.target.closest("[data-cerrar-hoja]")) api.cerrar(); });
  return api;
}

// En el iPhone, el menú de compartir (Guardar en Archivos, AirDrop…); en la
// compu, una descarga normal.
function descargar(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const archivo = typeof File === "function" ? new File([blob], nombre, { type: tipo }) : null;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios && archivo && navigator.canShare && navigator.canShare({ files: [archivo] })) {
    navigator.share({ files: [archivo], title: nombre }).catch(() => { /* cancelado */ });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Marca los campos con error y muestra los textos en `.lib-error`.
function errores(form, lista, buscar) {
  form.querySelectorAll(".is-error").forEach(el => { el.classList.remove("is-error"); el.removeAttribute("aria-invalid"); });
  lista.forEach(e => {
    const el = buscar ? buscar(e) : form.querySelector(`[name="${e.campo}"]`);
    if (el) { el.classList.add("is-error"); el.setAttribute("aria-invalid", "true"); }
  });
  const p = form.querySelector(".lib-error");
  if (p) {
    p.innerHTML = lista.map(e => esc(e.texto)).join("<br>");
    p.hidden = !lista.length;
    if (lista.length && p.scrollIntoView) p.scrollIntoView({ block: "nearest" });
  }
}

root.Lectura = { esc, hoyLocal, hoja, descargar, errores };
})(typeof self !== "undefined" ? self : this);
