// Lista central de módulos del panel. Para agregar un módulo nuevo:
// 1. Crear su página HTML (copiando la estructura de una existente).
// 2. Agregar una línea acá abajo.
// El menú de escritorio y el de móvil se arman solos a partir de esta lista.
const MODULES = [
  { href: "index.html", label: "Inicio", icon: "home" },
  { href: "habitos.html", label: "Hábitos", icon: "habits" },
  { href: "ejercicio.html", label: "Ejercicio", icon: "exercise" },
  { href: "finanzas.html", label: "Finanzas", icon: "finance" },
  { href: "inversiones.html", label: "Inversiones", icon: "investing" }
];

function renderNav() {
  const path = window.location.pathname.split("/").pop() || "index.html";

  const linkHTML = (m, iconClass) =>
    `<a href="${m.href}" data-nav-link${m.href === path ? ' class="active"' : ""}>` +
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

document.addEventListener("DOMContentLoaded", renderNav);
