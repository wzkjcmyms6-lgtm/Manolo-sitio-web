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
  { hash: "ejercicio", label: "Ejercicio", icon: "exercise", entrada: "ej-feed" },
  { hash: "finanzas", label: "Finanzas", icon: "finance" },
  { hash: "inversiones", label: "Inversiones", icon: "investing" }
];

// Sub-paneles que cuelgan de un módulo pero no aparecen en el menú
// principal (se llega a ellos con tarjetas, ej: Ejercicio → Gimnasio, o
// Inicio → Running/Bicicleta/Libros/Biblia/Movilidad/Medir tiempos). Igual se
// muestran/ocultan según el hash, y la nav resalta el módulo padre mientras
// estás en uno de ellos.
const SUB_PANELS = [
  { hash: "hab-stats", parent: "habitos" },
  { hash: "hab-logros", parent: "habitos" },
  { hash: "hab-scalping", parent: "habitos" },
  { hash: "hab-categoria", parent: "habitos" },
  { hash: "gimnasio", parent: "ejercicio" },
  { hash: "ej-feed", parent: "ejercicio" },
  { hash: "ej-rangos", parent: "ejercicio" },
  { hash: "ej-perfil", parent: "ejercicio" },
  { hash: "running", parent: "inicio" },
  { hash: "run-actividad", parent: "running" },
  { hash: "run-progreso", parent: "running" },
  { hash: "run-segmentos", parent: "running" },
  { hash: "run-rutinas", parent: "running" },
  { hash: "run-ajustes", parent: "running" },
  { hash: "run-segmento", parent: "run-segmentos" },
  { hash: "run-calor", parent: "run-progreso" },
  { hash: "bicicleta", parent: "inicio" },
  { hash: "libros", parent: "inicio" },
  { hash: "biblia", parent: "inicio" },
  { hash: "movilidad", parent: "inicio" },
  { hash: "tiempos", parent: "inicio" },
  { hash: "fin-presupuesto", parent: "finanzas" },
  { hash: "fin-movimientos", parent: "finanzas" },
  { hash: "fin-analisis", parent: "finanzas" },
  { hash: "fin-ajustes", parent: "finanzas" },
  { hash: "fin-herramientas", parent: "fin-ajustes" },
  { hash: "fin-herramientas-carteras", parent: "fin-ajustes" },
  { hash: "fin-herramientas-carteras-detalle", parent: "fin-herramientas-carteras" },
  { hash: "fin-herramientas-categorias", parent: "fin-ajustes" },
  { hash: "fin-herramientas-periodo", parent: "fin-ajustes" },
  { hash: "fin-herramientas-reiva", parent: "fin-ajustes" },
  { hash: "fin-herramientas-exportar", parent: "fin-ajustes" },
  { hash: "fin-recurrentes", parent: "fin-ajustes" },
  { hash: "fin-tarjetas", parent: "finanzas" },
  { hash: "inv-posiciones", parent: "inversiones" },
  { hash: "inv-movimientos", parent: "inversiones" },
  { hash: "inv-graficos", parent: "inversiones" },
  { hash: "inv-ajustes", parent: "inversiones" }
];

// Mientras estás dentro de Hábitos, Finanzas, Ejercicio o Inversiones, la barra inferior (solo en
// móvil, que es donde hace falta el espacio) deja de mostrar los módulos
// generales y muestra las pestañas propias del módulo. Para volver a Inicio
// la barra de arriba muestra una casita.
const FIN_TABS = [
  { hash: "finanzas", label: "Resumen", icon: "finEye", color: "#ff6b7a" },
  { hash: "fin-movimientos", label: "Movimientos", icon: "finList", color: "#ffb84d" },
  { hash: "fin-presupuesto", label: "Presupuesto", icon: "finBudget", color: "#3d8bff" },
  { hash: "fin-analisis", label: "Análisis", icon: "chart", color: "#5cc98a" }
];
const EJ_TABS = [
  { hash: "ej-feed", label: "Feed", icon: "feed", color: "#4da3ff" },
  { hash: "ejercicio", label: "Entrenamiento", icon: "exercise", color: "#4da3ff" },
  { hash: "ej-rangos", label: "Rangos", icon: "trophy", color: "#4da3ff" },
  { hash: "ej-perfil", label: "Perfil", icon: "user", color: "#4da3ff" }
];
const HAB_TABS = [
  { hash: "habitos", label: "Hoy", icon: "habits", color: "#ffb84d" },
  { hash: "hab-stats", label: "Estadísticas", icon: "chart", color: "#ffb84d" },
  { hash: "hab-logros", label: "Logros", icon: "trophy", color: "#ffb84d" }
];
// Inversiones es una sección aparte, como Finanzas (pedido del dueño
// 2026-10-29): sus Ajustes van en el engranaje de arriba.
const INV_TABS = [
  { hash: "inversiones", label: "Resumen", icon: "investing", color: "#4cc38a" },
  { hash: "inv-posiciones", label: "Posiciones", icon: "wallet", color: "#4cc38a" },
  { hash: "inv-movimientos", label: "Movimientos", icon: "finList", color: "#4cc38a" },
  { hash: "inv-graficos", label: "Gráficos", icon: "chart", color: "#4cc38a" }
];
// Running tiene su propia barra (D-061), con un "+" al centro que no es una
// pestaña sino una acción (abre Importar · Anotar a mano · Rutina guiada).
const RUN_TABS = [
  { hash: "running", label: "Actividades", icon: "running", color: "#ff7a30" },
  { hash: "run-progreso", label: "Progreso", icon: "chart", color: "#ff7a30" },
  { accion: "run-mas", label: "Agregar", icon: "plus" },
  { hash: "run-segmentos", label: "Segmentos", icon: "segmento", color: "#ff7a30" },
  { hash: "run-rutinas", label: "Rutinas", icon: "timer", color: "#ff7a30" }
];
const TAB_BARS = { habitos: HAB_TABS, finanzas: FIN_TABS, ejercicio: EJ_TABS, inversiones: INV_TABS, running: RUN_TABS };

// Grupo de pestañas de un hash: el primer nivel (subiendo) que tiene barra
// propia. Para Finanzas, Hábitos, etc. es el módulo; para Running, "running".
function grupoTabs(hash) {
  let h = hash;
  while (h) { if (TAB_BARS[h]) return h; h = parentOf(h); }
  return null;
}

const ALL_HASHES = MODULES.map(m => m.hash).concat(SUB_PANELS.map(s => s.hash));

// Algunos paneles llevan un dato después de la barra (#run-actividad/running/ID):
// el panel es lo de antes de la primera barra.
function currentHash() {
  const h = window.location.hash.replace("#", "").split("/")[0];
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
  while (h && !tabs.some(t => t.hash && t.hash === h)) h = parentOf(h);
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
  document.body.classList.toggle("in-inversiones", activeModule === "inversiones");
  // Con barra inferior propia, la de arriba solo muestra una casita para volver al inicio.
  const grupo = grupoTabs(hash);
  document.body.classList.toggle("has-home-btn", !!grupo);
  document.body.classList.toggle("in-running", grupo === "running");
  // Running y Bicicleta tampoco llevan versículo: la pantalla es para la actividad.
  // Inversiones tampoco (pedido del dueño 2026-10-28): es una sección aparte.
  // Libros y Biblia tampoco (pedido del dueño 2026-10-29), ni Medir tiempos ni Movilidad.
  document.getElementById("verse-banner").hidden = isExercise || activeModule === "finanzas" || activeModule === "habitos" || activeModule === "inversiones" || ["running", "bicicleta", "libros", "biblia", "movilidad", "tiempos"].includes(hash) || hash.startsWith("run-");
  document.getElementById("body-banner").hidden = !showBody;

  // Pestañas propias de cada módulo (Finanzas, Hábitos, Ejercicio, Inversiones), visibles
  // como pills dentro del panel en escritorio.
  document.querySelectorAll("[data-hash-link]").forEach(a => {
    const activa = a.dataset.hash === tabHash(hash, TAB_BARS[a.dataset.grupo || "finanzas"]);
    a.classList.toggle("active", activa);
    if (activa) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}

// En escritorio no hay barra inferior: cada módulo con pestañas propias las
// muestra como pills arriba de cada una de sus secciones. En móvil se ocultan
// (.fin-outer-tabs). Finanzas e Inversiones suman el engranaje de Ajustes.
const PILLS_ESCRITORIO = { habitos: "Secciones de Hábitos", ejercicio: "Secciones de Ejercicio", finanzas: "Secciones de Finanzas", inversiones: "Secciones de Inversiones", running: "Secciones de Running" };
const PILL_AJUSTES = { finanzas: ["fin-ajustes", "Ajustes de Finanzas"], inversiones: ["inv-ajustes", "Ajustes de Inversiones"], running: ["run-ajustes", "Ajustes de Running"] };
function crearPillsEscritorio() {
  Object.keys(PILLS_ESCRITORIO).forEach(grupo => {
    TAB_BARS[grupo].forEach(tab => {
      if (!tab.hash) return;
      const panel = document.getElementById("panel-" + tab.hash);
      if (!panel || panel.querySelector(":scope > .fin-outer-tabs")) return;
      const nav = document.createElement("nav");
      nav.className = "fin-tabs fin-outer-tabs";
      nav.setAttribute("aria-label", PILLS_ESCRITORIO[grupo]);
      nav.innerHTML = TAB_BARS[grupo].map(t => t.accion
        ? `<button type="button" class="fin-tab fin-tab-accion" data-${t.accion}>+ ${t.label}</button>`
        : `<a href="#${t.hash}" class="fin-tab" data-hash-link data-grupo="${grupo}" data-hash="${t.hash}">${t.label}</a>`).join("")
        + (PILL_AJUSTES[grupo] ? `<a href="#${PILL_AJUSTES[grupo][0]}" class="fin-tab fin-tab-ajustes" aria-label="${PILL_AJUSTES[grupo][1]}"><span data-icon="gear"></span></a>` : "");
      panel.prepend(nav);
      if (typeof renderIcons === "function") renderIcons(nav);
    });
  });
}

function renderNav() {
  const hash = currentHash();
  const current = activeModuleHash(hash);

  const linkHTML = (m, iconClass, activeHash) => {
    const isActive = m.hash === activeHash;
    // Algunos módulos abren en otra pestaña (Ejercicio abre en Feed).
    return `<a href="#${m.entrada || m.hash}" data-nav-link data-hash="${m.hash}"${isActive ? ' class="active"' : ""}>` +
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
    const grupo = grupoTabs(hash);
    const tabs = grupo && TAB_BARS[grupo];
    if (tabs) {
      renderTabBar(bottomNav, grupo, tabs, tabHash(hash, tabs));
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
    nav.innerHTML = `<span class="tab-glass" aria-hidden="true"></span>` + tabs.map(m => m.accion
      ? `<button type="button" class="tab-accion" data-${m.accion} aria-label="${m.label}"><span class="icon" data-icon="${m.icon}"></span></button>`
      : `<a href="#${m.hash}" data-nav-link data-hash="${m.hash}" style="--tab-color:${m.color}">` +
        `<span class="icon" data-icon="${m.icon}"></span>${m.label}</a>`).join("");
  }
  nav.querySelectorAll("a[data-hash]").forEach(a => a.classList.toggle("active", a.dataset.hash === activeHash));
  moveGlass(nav, tabs.findIndex(t => t.hash && t.hash === activeHash));
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
  crearPillsEscritorio();
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
// Se arma a mano (sin Intl): la primera fecha con Intl carga datos del idioma
// y frena la apertura de la app.
const RELOJ_DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const RELOJ_MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
function renderClock() {
  const now = new Date();
  const dos = n => String(n).padStart(2, "0");
  const text = `${RELOJ_DIAS[now.getDay()]} ${now.getDate()} ${RELOJ_MESES[now.getMonth()]} · ${dos(now.getHours())}:${dos(now.getMinutes())}`;
  document.querySelectorAll("[data-clock]").forEach(el => { el.textContent = text; });
}
renderClock();
setTimeout(() => { renderClock(); setInterval(renderClock, 60000); }, (60 - new Date().getSeconds()) * 1000);
