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
// principal (se llega a ellos con tarjetas, ej: Ejercicio → Gimnasio, o
// Inicio → Running/Bicicleta). Igual se muestran/ocultan según el hash, y
// la nav resalta el módulo padre mientras estás en uno de ellos.
const SUB_PANELS = [
  { hash: "hab-stats", parent: "habitos" },
  { hash: "hab-logros", parent: "habitos" },
  { hash: "gimnasio", parent: "ejercicio" },
  { hash: "ej-rangos", parent: "ejercicio" },
  { hash: "ej-perfil", parent: "ejercicio" },
  { hash: "running", parent: "inicio" },
  { hash: "bicicleta", parent: "inicio" },
  { hash: "fin-presupuesto", parent: "finanzas" },
  { hash: "fin-herramientas", parent: "finanzas" },
  { hash: "fin-herramientas-carteras", parent: "fin-herramientas" },
  { hash: "fin-herramientas-carteras-detalle", parent: "fin-herramientas-carteras" },
  { hash: "fin-herramientas-categorias", parent: "fin-herramientas" },
  { hash: "fin-herramientas-periodo", parent: "fin-herramientas" },
  { hash: "fin-herramientas-reiva", parent: "fin-herramientas" },
  { hash: "fin-herramientas-exportar", parent: "fin-herramientas" }
];

// Mientras estás dentro de Hábitos, Finanzas o Ejercicio, la barra inferior (solo en
// móvil, que es donde hace falta el espacio) deja de mostrar los módulos
// generales y muestra las pestañas propias del módulo. Para volver a Inicio
// la barra de arriba muestra una casita.
const FIN_TABS = [
  { hash: "finanzas", label: "Vista general", icon: "finEye", color: "#ff6b7a" },
  { hash: "fin-presupuesto", label: "Presupuesto", icon: "finBudget", color: "#3d8bff" },
  { hash: "fin-herramientas", label: "Herramientas", icon: "finTools", color: "#ff6b7a" }
];
const EJ_TABS = [
  { hash: "ej-rangos", label: "Rangos", icon: "trophy", color: "#4da3ff" },
  { hash: "ejercicio", label: "Entrenamiento", icon: "exercise", color: "#4da3ff" },
  { hash: "ej-perfil", label: "Perfil", icon: "user", color: "#4da3ff" }
];
const HAB_TABS = [
  { hash: "habitos", label: "Hoy", icon: "habits", color: "#ffb84d" },
  { hash: "hab-stats", label: "Estadísticas", icon: "chart", color: "#ffb84d" },
  { hash: "hab-logros", label: "Logros", icon: "trophy", color: "#ffb84d" }
];
const TAB_BARS = { habitos: HAB_TABS, finanzas: FIN_TABS, ejercicio: EJ_TABS };

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
// una de las pestañas dadas, para resaltar la barra inferior aunque estés
// más adentro (ej: en Carteras sigue resaltando "Herramientas", en
// Gimnasio sigue resaltando "Entrenamiento").
function tabHash(hash, tabs) {
  let h = hash;
  while (h && !tabs.some(t => t.hash === h)) h = parentOf(h);
  return h || tabs[0].hash;
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

  // En Ejercicio no hay banner de versículos: en Entrenamiento (y Gimnasio)
  // va la silueta de cuerpo humano, y en Rangos/Perfil nada. En Finanzas se
  // oculta sin reemplazo, para que el resumen quede más arriba.
  const isExercise = activeModule === "ejercicio";
  // El mapa muscular solo va en la portada de Entrenamiento, no dentro del registro.
  const showBody = isExercise && hash === "ejercicio";
  document.body.classList.toggle("in-finanzas", activeModule === "finanzas");
  // Con barra inferior propia, la de arriba solo muestra una casita para volver al inicio.
  document.body.classList.toggle("has-home-btn", !!TAB_BARS[activeModule]);
  document.getElementById("verse-banner").hidden = isExercise || activeModule === "finanzas" || activeModule === "habitos";
  document.getElementById("body-banner").hidden = !showBody;

  // Pestañas propias de Finanzas (Vista general/Presupuesto/Herramientas),
  // visibles como pills dentro del panel en escritorio.
  const finTab = tabHash(hash, FIN_TABS);
  document.querySelectorAll("[data-hash-link]").forEach(a => {
    a.classList.toggle("active", a.dataset.hash === finTab);
  });
}

function renderNav() {
  const hash = currentHash();
  const current = activeModuleHash(hash);

  const linkHTML = (m, iconClass, activeHash) => {
    const isActive = m.hash === activeHash;
    return `<a href="#${m.hash}" data-nav-link data-hash="${m.hash}"${isActive ? ' class="active"' : ""}>` +
      `<span class="${iconClass}" data-icon="${m.icon}"></span>${m.label}</a>`;
  };

  const sidebarNav = document.getElementById("nav-links");
  if (sidebarNav) {
    sidebarNav.innerHTML =
      MODULES.map(m => linkHTML(m, "nav-icon", current)).join("") +
      `<button type="button" id="logout-btn" class="logout-btn">Cerrar sesión</button>`;
  }

  const bottomNav = document.getElementById("bottom-nav-links");
  if (bottomNav) {
    const tabs = TAB_BARS[current];
    if (tabs) {
      renderTabBar(bottomNav, current, tabs, tabHash(hash, tabs));
    } else {
      glassIndex = null;
      bottomNav.classList.remove("tab-mode");
      delete bottomNav.dataset.mode;
      bottomNav.innerHTML = MODULES.map(m => linkHTML(m, "icon", current)).join("");
    }
  }

  renderIcons();
}

// La barra con pestañas propias no se reconstruye al cambiar de pestaña: se
// reutiliza para que el indicador de vidrio pueda deslizarse desde la anterior.
let glassIndex = null;

function renderTabBar(nav, mode, tabs, activeHash) {
  if (nav.dataset.mode !== mode) {
    glassIndex = null;
    nav.dataset.mode = mode;
    nav.classList.add("tab-mode");
    nav.style.setProperty("--tabs", tabs.length);
    nav.innerHTML = `<span class="tab-glass" aria-hidden="true"></span>` + tabs.map(m =>
      `<a href="#${m.hash}" data-nav-link data-hash="${m.hash}" style="--tab-color:${m.color}">` +
      `<span class="icon" data-icon="${m.icon}"></span>${m.label}</a>`).join("");
  }
  nav.querySelectorAll("a[data-hash]").forEach(a => a.classList.toggle("active", a.dataset.hash === activeHash));
  moveGlass(nav, tabs.findIndex(t => t.hash === activeHash));
}

// Al cambiar de pestaña el indicador se "levanta" como una lupa de vidrio
// (crece y se vuelve transparente), viaja hasta la nueva pestaña y se asienta.
function moveGlass(nav, to) {
  const glass = nav.querySelector(".tab-glass");
  const from = glassIndex;
  glassIndex = to;
  glass.style.transform = `translateX(${to * 100}%)`;
  if (from === null || from === to || !glass.animate) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const at = (i, s) => `translateX(${i * 100}%) scale(${s})`;
  const d = to - from;
  glass.classList.add("lens");
  const anim = glass.animate([
    { transform: at(from, "1, 1") },
    { transform: at(from + d * 0.12, "1.16, 1.38"), offset: 0.25 },
    { transform: at(to + d * 0.04, "1.16, 1.38"), offset: 0.72 },
    { transform: at(to, "1, 1") }
  ], { duration: 620, easing: "cubic-bezier(.4, .1, .2, 1)" });
  anim.onfinish = anim.oncancel = () => glass.classList.remove("lens");
  nav.animate([
    { transform: "scale(1, 1)" },
    { transform: "scale(1.035, 0.97)", offset: 0.3 },
    { transform: "scale(0.995, 1.01)", offset: 0.75 },
    { transform: "scale(1, 1)" }
  ], { duration: 620, easing: "ease-out" });
}

function router() {
  showPanel(currentHash());
  renderNav();
  window.scrollTo(0, 0);
}

// Tocar la pestaña en la que ya estás (ej: "Vista general" abajo) también
// vuelve arriba del todo; si es otra, el cambio de página ya lo hace.
document.addEventListener("click", e => {
  const link = e.target.closest("a[href^='#']");
  if (link && link.getAttribute("href") === window.location.hash) window.scrollTo({ top: 0, behavior: "smooth" });
});

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
