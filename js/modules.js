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
  { hash: "bicicleta", parent: "ejercicio" },
  { hash: "fin-presupuesto", parent: "finanzas" },
  { hash: "fin-herramientas", parent: "finanzas" },
  { hash: "fin-herramientas-carteras", parent: "fin-herramientas" },
  { hash: "fin-herramientas-carteras-detalle", parent: "fin-herramientas-carteras" },
  { hash: "fin-herramientas-categorias", parent: "fin-herramientas" },
  { hash: "fin-herramientas-periodo", parent: "fin-herramientas" },
  { hash: "fin-herramientas-exportar", parent: "fin-herramientas" }
];

// Mientras estás dentro de Finanzas, la barra inferior (solo en móvil, que
// es donde hace falta el espacio) deja de mostrar los módulos generales y
// muestra estas 3 pestañas en su lugar. Para volver a Inicio/Hábitos/etc
// queda el menú de la barra superior (el ☰).
const FIN_TABS = [
  { hash: "finanzas", label: "Vista general", icon: "eye", iconFilled: "eyeFilled" },
  { hash: "fin-presupuesto", label: "Presupuesto", icon: "finance", iconFilled: "budgetFilled" },
  { hash: "fin-herramientas", label: "Herramientas", icon: "tools", iconFilled: "toolsFilled" }
];

const ALL_HASHES = MODULES.map(m => m.hash).concat(SUB_PANELS.map(s => s.hash));

function currentHash() {
  const h = window.location.hash.replace("#", "");
  return ALL_HASHES.includes(h) ? h : "inicio";
}

function parentOf(hash) {
  const found = SUB_PANELS.find(s => s.hash === hash);
  return found ? found.parent : null;
}

// Para resaltar la nav: un sub-panel resuelve al hash de su módulo padre,
// subiendo tantos niveles como haga falta (ej: fin-herramientas-carteras
// → fin-herramientas → finanzas).
function activeModuleHash(hash) {
  let h = hash;
  while (parentOf(h)) h = parentOf(h);
  return h;
}

// Igual que activeModuleHash, pero se detiene en el primer nivel que sea
// una pestaña de Finanzas (Vista general/Presupuesto/Herramientas), para
// resaltar la barra inferior aunque estés más adentro (ej: en Carteras
// sigue resaltando "Herramientas").
function finTabHash(hash) {
  let h = hash;
  while (h && !FIN_TABS.some(t => t.hash === h)) h = parentOf(h);
  return h || "finanzas";
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
  // por la silueta de cuerpo humano. En Finanzas se oculta sin reemplazo,
  // para que el resumen quede más arriba.
  const isExercise = activeModule === "ejercicio";
  // En Finanzas la barra de arriba solo muestra una casita para volver al inicio.
  document.body.classList.toggle("in-finanzas", activeModule === "finanzas");
  document.getElementById("verse-banner").hidden = isExercise || activeModule === "finanzas";
  document.getElementById("body-banner").hidden = !isExercise;

  // Pestañas propias de Finanzas (Vista general/Presupuesto/Herramientas),
  // visibles como pills dentro del panel en escritorio.
  const finTab = finTabHash(hash);
  document.querySelectorAll("[data-hash-link]").forEach(a => {
    a.classList.toggle("active", a.dataset.hash === finTab);
  });
}

function renderNav() {
  const hash = currentHash();
  const current = activeModuleHash(hash);
  const inFinanzas = current === "finanzas";

  const linkHTML = (m, iconClass, activeHash) => {
    const isActive = m.hash === activeHash;
    const icon = isActive && m.iconFilled ? m.iconFilled : m.icon;
    return `<a href="#${m.hash}" data-nav-link data-hash="${m.hash}"${isActive ? ' class="active"' : ""}>` +
      `<span class="${iconClass}" data-icon="${icon}"></span>${m.label}</a>`;
  };

  const sidebarNav = document.getElementById("nav-links");
  if (sidebarNav) {
    sidebarNav.innerHTML =
      MODULES.map(m => linkHTML(m, "nav-icon", current)).join("") +
      `<button type="button" id="logout-btn" class="logout-btn">Cerrar sesión</button>`;
  }

  const bottomNav = document.getElementById("bottom-nav-links");
  if (bottomNav) {
    bottomNav.classList.toggle("fin-mode", inFinanzas);
    bottomNav.innerHTML = inFinanzas
      ? FIN_TABS.map(m => linkHTML(m, "icon", finTabHash(hash))).join("")
      : MODULES.map(m => linkHTML(m, "icon", current)).join("");
  }

  renderIcons();
}

function router() {
  showPanel(currentHash());
  renderNav();
}

window.addEventListener("hashchange", router);
document.addEventListener("DOMContentLoaded", router);

// Fecha y hora arriba (ej: "Mié 24 sept · 13:20"), se actualiza cada minuto.
function renderClock() {
  const now = new Date();
  const day = now.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").replace(",", "");
  const time = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const text = `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
  document.querySelectorAll("[data-clock]").forEach(el => { el.textContent = text; });
}
renderClock();
setTimeout(() => { renderClock(); setInterval(renderClock, 60000); }, (60 - new Date().getSeconds()) * 1000);
