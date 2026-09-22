// Navegación compartida: menú lateral en escritorio, menú hamburguesa + barra inferior en móvil.
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");

  if (toggle && sidebar && overlay) {
    const closeMenu = () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("visible");
      toggle.setAttribute("aria-expanded", "false");
      toggle.innerHTML = ICONS.menu;
    };
    const openMenu = () => {
      sidebar.classList.add("open");
      overlay.classList.add("visible");
      toggle.setAttribute("aria-expanded", "true");
      toggle.innerHTML = ICONS.close;
    };
    toggle.addEventListener("click", () => {
      sidebar.classList.contains("open") ? closeMenu() : openMenu();
    });
    overlay.addEventListener("click", closeMenu);
    // Delegado en el contenedor: cubre los enlaces que arma renderNav(),
    // incluidos los de módulos agregados más adelante.
    sidebar.addEventListener("click", e => {
      if (e.target.closest("a")) closeMenu();
    });
  }

  renderVerse("verse-banner");
});
