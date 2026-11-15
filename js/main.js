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

// Zoom con dos dedos permitido (accesibilidad). Pero el iPhone acerca la
// pantalla solo al tocar un campo con letra de menos de 16 px; para que eso
// no pase (ni cambie el diseño), mientras escribes se fija la escala y al
// salir del campo se vuelve a permitir el zoom.
(function () {
  const vp = document.querySelector('meta[name="viewport"]');
  if (!vp) return;
  const libre = vp.content;
  const fijo = libre + ", maximum-scale=1";
  const esCampo = t => t && t.closest && t.closest("input, select, textarea");
  // Solo con letra de menos de 16 px: con 16 px o más el iPhone no acerca,
  // así que el zoom con dos dedos queda libre también mientras escribes
  // (QA 2026-11, D-119).
  const chico = c => { try { return parseFloat(getComputedStyle(c).fontSize) < 16; } catch (e) { return true; } };
  const fijar = e => { const c = esCampo(e.target); if (c && chico(c)) vp.content = fijo; };
  document.addEventListener("touchstart", fijar, { capture: true, passive: true });
  document.addEventListener("focusin", fijar);
  document.addEventListener("focusout", () => {
    setTimeout(() => { if (!esCampo(document.activeElement)) vp.content = libre; }, 300);
  });
})();
