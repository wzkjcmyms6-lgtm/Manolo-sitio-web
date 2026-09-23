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

// Sub-paneles que cuelgan de un módulo pero no aparecen en el menú
// principal (se llega a ellos con tarjetas dentro del módulo padre, ej:
// Ejercicio → Gimnasio/Running/Bicicleta). Igual se muestran/ocultan según
// el hash, y la nav resalta el módulo padre mientras estás en uno de ellos.
const SUB_PANELS = [
  { hash: "gimnasio", parent: "ejercicio" },
  { hash: "running", parent: "ejercicio" },
  { hash: "bicicleta", parent: "ejercicio" }
];

const ALL_HASHES = MODULES.map(m => m.hash).concat(SUB_PANELS.map(s => s.hash));

function currentHash() {
  const h = window.location.hash.replace("#", "");
  return ALL_HASHES.includes(h) ? h : "inicio";
}

// Para resaltar la nav: un sub-panel resuelve al hash de su módulo padre.
function activeModuleHash(hash) {
  return (SUB_PANELS.find(s => s.hash === hash) || {}).parent || hash;
}

function showPanel(hash) {
  ALL_HASHES.forEach(h => {
    const panel = document.getElementById("panel-" + h);
    if (panel) panel.hidden = h !== hash;
  });
  const activeModule = activeModuleHash(hash);
  document.querySelectorAll("[data-nav-link]").forEach(a => {
    a.classList.toggle("active", a.dataset.hash === activeModule);
  });

  // En Ejercicio (y sus sub-paneles) el banner de versículos se reemplaza
  // por la silueta de cuerpo humano.
  const isExercise = activeModule === "ejercicio";
  document.getElementById("verse-banner").hidden = isExercise;
  document.getElementById("body-banner").hidden = !isExercise;
}

function renderNav() {
  const current = activeModuleHash(currentHash());

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
