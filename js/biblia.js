// ---------- Biblia (sub-panel de Inicio) ----------
// El versículo que Juan lee al despertar: fecha, cita, texto y nota.
// Datos en users/{uid}/biblia. Ver docs/LIBROS_BIBLIA.md.
(function () {
// Ícono de la tarjeta de Inicio (mismo trazo que js/icons.js). Se registra
// aquí para no tocar el archivo compartido; renderIcons() corre después.
if (typeof ICONS === "object") {
  ICONS.biblia = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M7 3.5h11a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H7a2.5 2.5 0 0 1-2.5-2.5v-11A2.5 2.5 0 0 1 7 4"/><path d="M4.5 17.5A2.5 2.5 0 0 1 7 15h12"/><path d="M12 6.5v6M9.6 8.8h4.8"/></svg>`;
}

const app = document.getElementById("bib-app");
app.innerHTML = `<p class="empty-state">Aquí vas a anotar el versículo de cada mañana.</p>`;
})();
