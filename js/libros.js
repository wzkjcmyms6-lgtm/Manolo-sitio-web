// ---------- Libros (sub-panel de Inicio) ----------
// Libros leídos o por leer: datos, fechas, opinión, calificación, portada y
// frases. Datos en users/{uid}/libros. Ver docs/LIBROS_BIBLIA.md.
(function () {
// Ícono de la tarjeta de Inicio (mismo trazo que js/icons.js). Se registra
// aquí para no tocar el archivo compartido; renderIcons() corre después.
if (typeof ICONS === "object") {
  ICONS.libro = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M12 6.8C10.2 5.4 7.6 4.7 4 4.7v13.2c3.6 0 6.2.7 8 2.1 1.8-1.4 4.4-2.1 8-2.1V4.7c-3.6 0-6.2.7-8 2.1Z"/><path d="M12 6.8V20"/></svg>`;
}

const app = document.getElementById("lib-app");
app.innerHTML = `<p class="empty-state">Aquí vas a registrar tus libros, con su portada y tus frases favoritas.</p>`;
})();
