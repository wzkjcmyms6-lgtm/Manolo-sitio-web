// Lista central de módulos del panel. Para agregar un módulo nuevo:
// 1. Agregar su <section id="panel-XXX" hidden> en index.html.
// 2. Agregar una línea acá abajo.
// El menú de escritorio y el de móvil se arman solos a partir de esta lista.
// Todo vive en una sola página (index.html): cambiar de sección solo mueve
// el "hash" de la URL (#habitos, #ejercicio...) y muestra/oculta el bloque
// correspondiente, sin recargar el navegador — así el login de Firebase no
// se pierde nunca al pasar de una sección a otra.
const MODULES = [
  { hash: "inicio", label: "Inicio", icon: "home" },
  { hash: "habitos", label: "Hábitos", icon: "habits" },
  { hash: "ejercicio", label: "Ejercicio", icon: "exercise" },
  { hash: "finanzas", label: "Finanzas", icon: "finance" },
  { hash: "inversiones", label: "Inversiones", icon: "investing" }
];

function currentHash() {
  const h = window.location.hash.replace("#", "");
  return MODULES.some(m => m.hash === h) ? h : "inicio";
}

function showPanel(hash) {
  MODULES.forEach(m => {
    const panel = document.getElementById("panel-" + m.hash);
    if (panel) panel.hidden = m.hash !== hash;
  });
  document.querySelectorAll("[data-nav-link]").forEach(a => {
    a.classList.toggle("active", a.dataset.hash === hash);
  });
}

function renderNav() {
  const current = currentHash();

  const linkHTML = (m, iconClass) =>
    `<a href="#${m.hash}" data-nav-link data-hash="${m.hash}"${m.hash === current ? ' class="active"' : ""}>` +
    `<span class="${iconClass}" data-icon="${m.icon}"></span>${m.label}</a>`;

  const sidebarNav = document.getElementById("nav-links");
  if (sidebarNav) {
    sidebarNav.innerHTML =
      MODULES.map(m => linkHTML(m, "nav-icon")).join("") +
      `<button type="button" id="logout-btn" class="logout-btn">Cerrar sesión</button>`;
  }

  const bottomNav = document.getElementById("bottom-nav-links");
  if (bottomNav) {
    bottomNav.innerHTML = MODULES.map(m => linkHTML(m, "icon")).join("");
  }

  renderIcons();
}

function router() {
  showPanel(currentHash());
  renderNav();
}

window.addEventListener("hashchange", router);
document.addEventListener("DOMContentLoaded", router);
