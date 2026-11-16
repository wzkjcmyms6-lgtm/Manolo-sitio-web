// ---------- Biblia: buscar en toda la Biblia (pantalla, fase 2) ----------
// La lupa del lector abre una hoja: escribes una o varias palabras (sin
// tildes, también a medias) y aparecen los versículos con las palabras
// resaltadas; tocar uno lo abre en el lector. La búsqueda corre en un
// Worker (js/biblia-buscar-worker.js) para no trabar la pantalla. D-105.
(function () {
const B = window.BibliaMotor, T = window.BibliaTexto, L = window.BibliaLector;
if (!B || !T || !L || !window.Lectura) return;
const { esc } = window.Lectura;
const hoja = window.Lectura.hoja("bbl-hoja-buscar");
const MAX = 200;

let worker = null;
let pedido = 0;          // el último pedido (los anteriores se ignoran)
let alcance = "todo";    // "todo" | "AT" | "NT" | "libro"
let ultimaQ = "";
let timer = null;
let resultado = null;    // { q, total, items, palabras }

// El Worker carga estos dos sueltos (en la app van dentro del paquete,
// D-127); el service worker los guarda para buscar sin internet.
const scripts = () => ["biblia-motor.js", "biblia-texto.js"].map(n => new URL(`js/${n}`, location.href).href);
function urls() {
  const o = {};
  B.LIBROS.forEach(l => { o[l.id] = new URL(T.url(l.id), location.href).href; });
  return o;
}
function librosDelAlcance() {
  if (alcance === "AT" || alcance === "NT") return B.LIBROS.filter(l => l.testamento === alcance).map(l => l.id);
  const lugar = L.lugar();
  if (alcance === "libro" && lugar) return [lugar.libro];
  return null;
}
function trabajador() {
  if (worker) return worker;
  worker = new Worker("js/biblia-buscar-worker.js");
  worker.onmessage = e => recibir(e.data || {});
  worker.onerror = () => { estado("No se pudo buscar. Cierra y abre la búsqueda para intentar otra vez."); worker = null; };
  return worker;
}

const $ = sel => hoja.el.querySelector(sel);
function estado(t) { const p = $(".bbl-buscar-estado"); if (p) p.textContent = t; }

function abrir() {
  const lugar = L.lugar();
  const libro = lugar ? B.libro(lugar.libro) : null;
  if (alcance === "libro" && !libro) alcance = "todo";
  hoja.abrir("Buscar en la Biblia", `
    <form class="bbl-buscar-form" role="search">
      <input type="search" name="q" class="lib-input" placeholder="Palabras (ej: no temas)" autocomplete="off" enterkeyhint="search" aria-label="Palabras a buscar" value="${esc(ultimaQ)}">
    </form>
    <div class="bbl-filtros" role="group" aria-label="Dónde buscar">
      ${[["todo", "Toda la Biblia"], ["AT", "Antiguo T."], ["NT", "Nuevo T."]].concat(libro ? [["libro", libro.nombre]] : [])
        .map(([k, t]) => `<button type="button" class="bbl-chip${k === alcance ? " is-activo" : ""}" data-bbb-alcance="${k}" aria-pressed="${k === alcance}">${esc(t)}</button>`).join("")}
    </div>
    <p class="bbl-buscar-estado lib-nota" aria-live="polite">Busca sin tildes y con varias palabras: «tal manera amo».</p>
    <div class="bbl-resultados"></div>`);
  if (resultado && resultado.q === ultimaQ) pintar();
  setTimeout(() => { const i = $('input[name="q"]'); if (i) i.focus(); }, 250);
}

function buscar(q) {
  ultimaQ = q;
  const palabras = T.palabrasDe(q);
  if (!palabras.length) { resultado = null; pintar(); estado("Escribe al menos una palabra de 2 letras."); return; }
  if (typeof Worker === "undefined") { estado("Este navegador no permite buscar en toda la Biblia."); return; }
  const id = ++pedido;
  estado("Buscando…");
  trabajador().postMessage({ tipo: "buscar", id, q, max: MAX, libros: librosDelAlcance(), scripts: scripts(), urls: urls(), cache: T.CACHE });
}

function recibir(d) {
  if (d.tipo === "progreso") {
    if (d.n < d.total) estado(`Preparando la búsqueda (la primera vez baja la Biblia, ~4 MB): ${d.n} de ${d.total} libros…`);
    return;
  }
  if (d.id !== pedido) return; // llegó tarde: ya buscaste otra cosa
  if (d.tipo === "error") {
    estado(navigator.onLine === false ? "Sin internet: para buscar sin conexión, descarga la Biblia (Aa › Descargar)." : "No se pudo buscar. Revisa tu conexión e intenta otra vez.");
    return;
  }
  resultado = { q: ultimaQ, total: d.total, items: d.items, palabras: d.palabras };
  pintar();
}

function pintar() {
  const caja = $(".bbl-resultados");
  if (!caja) return;
  if (!resultado) { caja.innerHTML = ""; return; }
  const { total, items, palabras } = resultado;
  const actual = !!L.ajustes().actual;
  estado(!total ? "No hay versículos con todas esas palabras." :
    total > items.length ? `${total.toLocaleString("es")} versículos; se muestran los primeros ${items.length}. Agrega otra palabra para afinar.` :
    `${total} ${total === 1 ? "versículo" : "versículos"}.`);
  caja.innerHTML = items.map(x => {
    const t = T.mostrar(x.texto, { actual, numero: x.v });
    const partes = T.resaltar(t, palabras).map(p => (p.si ? `<mark>${esc(p.t)}</mark>` : esc(p.t))).join("");
    return `<button type="button" class="bbl-res" data-bbb-ir="${esc(x.libro)}|${x.cap}|${x.v}">
      <b>${esc(T.cita(x.libro, x.cap, String(x.v)))}</b><span>${partes}</span></button>`;
  }).join("");
}

hoja.el.addEventListener("submit", e => {
  e.preventDefault();
  clearTimeout(timer);
  const i = e.target.elements.q;
  buscar(i.value);
  i.blur(); // en el iPhone, se esconde el teclado para ver los resultados
});
hoja.el.addEventListener("input", e => {
  if (e.target.name !== "q") return;
  clearTimeout(timer);
  const q = e.target.value;
  timer = setTimeout(() => buscar(q), 350);
});
hoja.el.addEventListener("click", e => {
  const a = e.target.closest("[data-bbb-alcance]");
  if (a) {
    alcance = a.dataset.bbbAlcance;
    hoja.el.querySelectorAll("[data-bbb-alcance]").forEach(b => { const on = b === a; b.classList.toggle("is-activo", on); b.setAttribute("aria-pressed", String(on)); });
    if (ultimaQ) buscar(ultimaQ);
    return;
  }
  const r = e.target.closest("[data-bbb-ir]");
  if (r) {
    const [libro, cap, v] = r.dataset.bbbIr.split("|");
    hoja.cerrar();
    L.abrir(libro, Number(cap), { marcar: [Number(v)] });
  }
});

window.BibliaBuscar = { abrir, buscar };
})();
