// ---------- Libros (sub-panel de Inicio) ----------
// Libros leídos o por leer: título, autor, páginas, estado, calificación,
// opinión y fechas (registro, inicio, fin), con sus frases. Lista con
// portadas, buscador, filtro por estado y género y orden; "Todas mis frases"
// con buscador; editar, borrar y exportar.
// Desde 2026-10-29 ("más desarrollada y más inteligente"): buscar el libro
// en Open Library completa título, autor, páginas, portada y género; "Sigue
// leyendo" con la página en la que vas, tu ritmo y cuándo lo terminas; meta
// de páginas por día con racha, reto de libros del año y Estadísticas
// (js/libros-progreso.js). Metas en users/{uid}/meta/libros_ajustes.
// Datos: users/{uid}/libros, users/{uid}/libros_frases y, para las fotos
// de portada, users/{uid}/libros_portadas/{id del libro}; la lógica en
// js/libros-motor.js. Ver docs/LIBROS_BIBLIA.md.
(function () {
// Ícono de la tarjeta de Inicio (mismo trazo que js/icons.js). Se registra
// aquí para no tocar el archivo compartido; renderIcons() corre después.
if (typeof ICONS === "object") {
  ICONS.libro = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M12 6.8C10.2 5.4 7.6 4.7 4 4.7v13.2c3.6 0 6.2.7 8 2.1 1.8-1.4 4.4-2.1 8-2.1V4.7c-3.6 0-6.2.7-8 2.1Z"/><path d="M12 6.8V20"/></svg>`;
}

const L = window.LibrosMotor;
const P = window.LibrosProgreso;
const { esc, hoyLocal } = window.Lectura;
const app = document.getElementById("lib-app");
const hoja = window.Lectura.hoja("lib-hoja");

let librosDocs = {}, frasesDocs = {}, portadasDocs = {};
let libros = [], frases = [];
let cargados = 0;               // 2 = libros y frases ya llegaron
let vista = "libros";           // "libros" | "frases"
const filtro = { texto: "", estado: "", genero: "", orden: "registro" };
let ajustesLib = {};            // meta/libros_ajustes: { metaPaginasDia, retos: { "2026": 12 } }
let encontrados = [];           // resultados de "Buscar el libro"
let busquedaEnCurso = null;     // para cancelar la búsqueda anterior
let relojBusqueda = 0;
let textoFrases = "";
let actual = null;              // qué muestra la hoja: { modo: "ver"|"libro"|"frase", id, libroId, volver }
let portadaSel;                 // en el formulario: undefined = sin cambios, null = quitar, { tipo: "url"|"foto", … }

const ref = n => db.collection("users").doc(currentUser.uid).collection(n);
const refAjustes = () => db.collection("users").doc(currentUser.uid).collection("meta").doc("libros_ajustes");
// Tu rutina dice «Leer 30 páginas»: la meta diaria empieza en 30.
const metaDia = () => (Number.isInteger(ajustesLib.metaPaginasDia) && ajustesLib.metaPaginasDia > 0 ? ajustesLib.metaPaginasDia : 30);
const metaAnio = () => { const v = ajustesLib.retos && ajustesLib.retos[hoyLocal().slice(0, 4)]; return Number.isInteger(v) && v > 0 ? v : 0; };
const nf = n => Number(n).toLocaleString("es-ES");
const fallo = (que) => err => alert(`No se pudo ${que}: ${err && err.message ? err.message : err}`);

// ---------- Estructura fija (el buscador no se repinta al escribir) ----------
app.innerHTML = `
  <div class="lib-resumen" id="lib-resumen"></div>
  <div id="lib-leyendo"></div>
  <button type="button" class="lib-btn lib-btn-ancho" data-lib="nuevo">＋ Agregar libro</button>
  <div class="fin-tabs lib-tabs" role="tablist" aria-label="Libros">
    <button type="button" class="fin-tab active" role="tab" data-lib-vista="libros" aria-selected="true">Mis libros</button>
    <button type="button" class="fin-tab" role="tab" data-lib-vista="frases" aria-selected="false">Frases</button>
    <button type="button" class="fin-tab" role="tab" data-lib-vista="stats" aria-selected="false">Estadísticas</button>
  </div>
  <div id="lib-vista-libros">
    <div class="lib-filtros">
      <input type="search" id="lib-buscar" class="lib-input" placeholder="Buscar por título o autor" autocomplete="off" aria-label="Buscar libros">
      <select id="lib-orden" class="lib-input" aria-label="Ordenar">${L.ORDENES.map(o => `<option value="${o.id}">${esc(o.nombre)}</option>`).join("")}</select>
      <select id="lib-genero" class="lib-input" aria-label="Filtrar por género" hidden></select>
    </div>
    <div class="lib-chips" id="lib-estados" role="group" aria-label="Filtrar por estado"></div>
    <div id="lib-lista"></div>
  </div>
  <div id="lib-vista-frases" hidden>
    <input type="search" id="lib-buscar-frases" class="lib-input" placeholder="Buscar en tus frases" autocomplete="off" aria-label="Buscar frases">
    <button type="button" class="lib-btn-sec lib-btn-ancho lib-mt" data-lib="nueva-frase">＋ Agregar frase</button>
    <div id="lib-frases"></div>
  </div>
  <div id="lib-vista-stats" hidden></div>
  <button type="button" class="lib-btn-sec lib-exportar" data-lib="exportar">Exportar (JSON)</button>`;
const $ = id => document.getElementById(id);

// Portada: la tapa genérica (título y autor) siempre debajo y, encima, la
// imagen si hay (de Open Library o foto). Si la imagen no carga (por
// ejemplo sin internet), se quita y queda la tapa genérica.
function tapa(l, grande, sel) {
  const [a, b] = L.colorTapa(l.titulo, l.autor);
  const p = sel !== undefined ? sel : l.portada;
  let img = "";
  if (p && p.tipo === "url" && L.portadaUrlOk(p.url)) img = p.url;
  else if (p && p.tipo === "foto") img = (p.datos && L.fotoOk(p.datos)) ? p.datos : (portadasDocs[l.id] && L.fotoOk(portadasDocs[l.id].datos) ? portadasDocs[l.id].datos : "");
  return `<span class="lib-tapa${grande ? " is-grande" : ""}" style="--tapa-a:${a};--tapa-b:${b}" aria-hidden="true"><b>${esc(l.titulo)}</b>${l.autor ? `<small>${esc(l.autor)}</small>` : ""}</span>` +
    (img ? `<img class="lib-portada-img" src="${esc(img)}" alt="" loading="lazy" decoding="async">` : "");
}
const quitarRota = e => { if (e.target && e.target.classList && e.target.classList.contains("lib-portada-img")) e.target.remove(); };
app.addEventListener("error", quitarRota, true);
hoja.el.addEventListener("error", quitarRota, true);
const chipEstado = id => `<span class="lib-chip is-${id}">${L.ESTADO[id].emoji} ${L.ESTADO[id].nombre}</span>`;

function render() {
  renderResumen();
  renderLeyendo();
  if (vista === "libros") { renderEstados(); renderGeneros(); renderLista(); } else if (vista === "frases") renderFrases(); else renderStats();
  if (hoja.abierta() && actual && actual.modo === "ver") ver(actual.id);
}

// ---------- Arriba: meta de hoy, reto del año y cifras ----------
function textoReto(r) {
  if (r.estado === "cumplido") return "🎉 ¡Reto cumplido!";
  if (r.estado === "adelantado") return `Vas ${r.diferencia} ${r.diferencia === 1 ? "libro" : "libros"} adelantado`;
  if (r.estado === "atrasado") return `Te ${r.diferencia === -1 ? "falta 1 libro" : `faltan ${-r.diferencia} libros`} para ir al día`;
  return "Vas al día";
}
function renderResumen() {
  const el = $("lib-resumen");
  if (cargados < 2) { el.innerHTML = `<p class="empty-state">Cargando…</p>`; return; }
  const hoy = hoyLocal(), anio = hoy.slice(0, 4);
  const r = L.resumen(libros, hoy);
  const porDia = P.paginasPorDia(libros);
  const hoyPags = porDia[hoy] || 0, meta = metaDia();
  const ra = P.racha(porDia, hoy);
  const reto = P.reto(libros, metaAnio(), hoy);
  const est = P.estadisticas(libros, hoy);
  el.innerHTML = `
    <div class="lib-metas">
      <button type="button" class="lib-meta${hoyPags >= meta ? " is-cumplida" : ""}" data-lib="metas" data-lib-meta="hoy">
        <span class="lib-meta-t">Hoy</span>
        <b>${nf(hoyPags)} <small>de ${meta} páginas</small></b>
        <span class="lib-barra" aria-hidden="true"><i style="width:${Math.min(100, Math.round((hoyPags / meta) * 100))}%"></i></span>
        <span class="lib-meta-sub">${hoyPags >= meta ? "✓ Meta cumplida" : ra.actual ? `🔥 ${ra.actual} ${ra.actual === 1 ? "día seguido" : "días seguidos"}` : "Anota la página en la que vas"}</span>
      </button>
      <button type="button" class="lib-meta${reto.estado === "cumplido" ? " is-cumplida" : ""}" data-lib="metas" data-lib-meta="reto">
        <span class="lib-meta-t">Reto ${anio}</span>
        ${reto.meta ? `<b>${reto.terminados} <small>de ${reto.meta} libros</small></b>
        <span class="lib-barra" aria-hidden="true"><i style="width:${reto.pct}%"></i></span>
        <span class="lib-meta-sub">${textoReto(reto)}</span>` : `<b>${reto.terminados} <small>${reto.terminados === 1 ? "libro" : "libros"}</small></b>
        <span class="lib-meta-sub">Ponte un reto de libros ›</span>`}
      </button>
    </div>
    <div class="lib-cifras">
      <div><b>${r.leyendo}</b><span>leyendo</span></div>
      <div><b>${r.terminadosEsteAnio}</b><span>${r.terminadosEsteAnio === 1 ? "terminado" : "terminados"} en ${anio}</span></div>
      <div><b>${nf(est.paginasAnio)}</b><span>páginas en ${anio}</span></div>
    </div>`;
}

// ---------- Sigue leyendo: página, ritmo y cuándo lo terminas ----------
function textoPagina(x) {
  if (x.pagina == null) return x.total ? `${x.total} páginas · ¿en cuál vas?` : "¿En qué página vas?";
  return x.total ? `Página ${x.pagina} de ${x.total} · ${x.pct} %` : `Página ${x.pagina}`;
}
function estimacion(x) {
  const falta = x.faltan ? `Faltan ${nf(x.faltan)} páginas. ` : "";
  if (x.finRitmo) return `${falta}A tu ritmo (${nf(x.ritmo)} pág. al día) lo terminas el ${P.fechaCorta(x.finRitmo)}.`;
  if (x.finMeta) return `${falta}Con ${metaDia()} páginas al día lo terminas el ${P.fechaCorta(x.finMeta)}.`;
  return "";
}
function renderLeyendo() {
  const el = $("lib-leyendo");
  const lista = cargados < 2 ? [] : L.ordenar(libros.filter(l => l.estado === "leyendo"), "inicio");
  if (!lista.length) { el.innerHTML = ""; return; }
  const hoy = hoyLocal();
  el.innerHTML = `<h2 class="lib-sec-t">Sigue leyendo</h2>` + lista.map(l => {
    const x = P.lectura(l, hoy, metaDia()), est = estimacion(x);
    return `
    <div class="lib-sigue" data-lib-sigue="${esc(l.id)}">
      <button type="button" class="lib-sigue-portada" data-lib-ver="${esc(l.id)}" aria-label="Ver ${esc(l.titulo)}"><span class="lib-portada">${tapa(l)}</span></button>
      <div class="lib-sigue-info">
        <b class="lib-sigue-t">${esc(l.titulo)}</b>
        <span class="lib-sigue-pag">${esc(textoPagina(x))}</span>
        ${x.pct != null ? `<span class="lib-barra" aria-hidden="true"><i style="width:${x.pct}%"></i></span>` : ""}
        ${est ? `<small class="lib-sigue-est">${esc(est)}</small>` : ""}
        <button type="button" class="lib-btn lib-btn-chico" data-lib-pagina="${esc(l.id)}">Anotar página</button>
      </div>
    </div>`;
  }).join("");
}

function renderEstados() {
  const r = L.resumen(libros, hoyLocal());
  const chips = [{ id: "", nombre: "Todos", n: r.total }].concat(L.ESTADOS.map(e => ({ id: e.id, nombre: e.nombre, n: r[e.id] })));
  $("lib-estados").innerHTML = chips.map(c => `<button type="button" class="lib-filtro${c.id === filtro.estado ? " active" : ""}" data-lib-estado="${c.id}" aria-pressed="${c.id === filtro.estado}">${esc(c.nombre)} <span>${c.n}</span></button>`).join("");
}

// El filtro de género aparece cuando algún libro tiene género.
function renderGeneros() {
  const sel = $("lib-genero");
  const usados = L.GENEROS.filter(g => libros.some(l => l.genero === g.id));
  if (filtro.genero && !usados.some(g => g.id === filtro.genero)) filtro.genero = "";
  sel.hidden = !usados.length;
  sel.innerHTML = `<option value="">Todos los géneros</option>` + usados.map(g => `<option value="${g.id}"${g.id === filtro.genero ? " selected" : ""}>${esc(g.nombre)}</option>`).join("");
}

function renderLista() {
  const el = $("lib-lista");
  if (cargados < 2) { el.innerHTML = ""; return; }
  if (!libros.length) { el.innerHTML = `<p class="empty-state">Todavía no agregaste libros. Toca «Agregar libro»; puedes cargar también los que leíste antes (la fecha se cambia).</p>`; return; }
  const visibles = L.ordenar(L.filtrar(libros, filtro), filtro.orden);
  if (!visibles.length) { el.innerHTML = `<p class="empty-state">Ningún libro coincide.</p>`; return; }
  el.innerHTML = `<div class="lib-grid">${visibles.map(l => {
    const fecha = filtro.orden === "fin" && l.fechaFin ? `Terminado ${L.fechaLarga(l.fechaFin)}` : filtro.orden === "inicio" && l.fechaInicio ? `Empezado ${L.fechaLarga(l.fechaInicio)}` : "";
    return `
    <button type="button" class="lib-card" data-lib-ver="${esc(l.id)}">
      <span class="lib-portada">${tapa(l)}</span>
      ${l.estado === "leyendo" && l.paginas && l.paginaActual != null ? `<span class="lib-barra lib-card-barra" aria-label="Vas en el ${Math.min(100, Math.round((l.paginaActual / l.paginas) * 100))} %"><i style="width:${Math.min(100, Math.round((l.paginaActual / l.paginas) * 100))}%"></i></span>` : ""}
      <span class="lib-card-t">${esc(l.titulo)}</span>
      ${l.autor ? `<span class="lib-card-a">${esc(l.autor)}</span>` : ""}
      <span class="lib-card-pie">${chipEstado(l.estado)}${l.calificacion ? `<span class="lib-estrellas" aria-label="${l.calificacion} de 5">${L.estrellas(l.calificacion)}</span>` : ""}</span>
      ${fecha ? `<span class="lib-card-a">${esc(fecha)}</span>` : ""}
    </button>`;
  }).join("")}</div>`;
}

const fraseHtml = (f, conLibro) => {
  const l = conLibro && libros.find(x => x.id === f.libroId);
  const pie = [conLibro && l ? `${l.titulo}${l.autor ? `, ${l.autor}` : ""}` : "", f.pagina ? `p. ${f.pagina}` : "", L.fechaLarga(f.fecha)].filter(Boolean).join(" · ");
  return `
      <button type="button" class="lib-frase" data-lib-frase="${esc(f.id)}">
        <span class="lib-frase-t">${esc(f.texto)}</span>
        <small>${esc(pie)}</small>
      </button>`;
};

function renderFrases() {
  const el = $("lib-frases");
  if (cargados < 2) { el.innerHTML = ""; return; }
  if (!frases.length) { el.innerHTML = `<p class="empty-state">Todavía no guardaste frases. Ábrelas desde cada libro o con «Agregar frase».</p>`; return; }
  const visibles = L.ordenarFrases(L.filtrarFrases(frases, libros, textoFrases));
  el.innerHTML = (textoFrases ? `<p class="lib-nota">${visibles.length} de ${frases.length}</p>` : "") +
    (visibles.length ? visibles.map(f => fraseHtml(f, true)).join("") : `<p class="empty-state">Ninguna frase coincide.</p>`);
}

// ---------- Estadísticas ----------
// Barras de una sola serie (sin leyenda: el título dice qué es), tocar una
// barra dice su valor y "Ver tabla" muestra todos los números.
const COLOR_BARRA = "#d9732e";   // naranja de Manolo, validado contra el fondo oscuro
function graficoBarras(id, datos, o) {
  const W = 320, H = 150, izq = 28, der = 8, arriba = 14, abajo = 22;
  const n = datos.length, alto = H - arriba - abajo, slot = (W - izq - der) / n;
  const ancho = Math.max(2, Math.min(24, slot - 2));
  const maxDato = Math.max(1, o.meta || 0, ...datos.map(d => d.valor));
  const paso = maxDato <= 5 ? 1 : maxDato <= 20 ? 5 : maxDato <= 50 ? 10 : maxDato <= 200 ? 50 : 100;
  const tope = Math.ceil(maxDato / paso) * paso;
  const y = v => arriba + alto - (v / tope) * alto;
  const base = y(0);
  const iMax = datos.reduce((m, d, i) => (d.valor > datos[m].valor ? i : m), 0);
  const barras = datos.map((d, i) => {
    const x = izq + i * slot + (slot - ancho) / 2;
    const h = base - y(d.valor), r = Math.min(4, ancho / 2, h);
    const forma = d.valor > 0 ? `<path d="M${x},${base}V${base - h + r}Q${x},${base - h} ${x + r},${base - h}H${x + ancho - r}Q${x + ancho},${base - h} ${x + ancho},${base - h + r}V${base}Z" fill="${COLOR_BARRA}"/>` : "";
    const valor = d.valor > 0 && (o.todosLosValores || i === iMax) ? `<text x="${x + ancho / 2}" y="${base - h - 4}" text-anchor="middle" class="lib-g-valor">${d.valor}</text>` : "";
    const etiqueta = o.etiquetas(i) ? `<text x="${x + ancho / 2}" y="${H - 6}" text-anchor="middle" class="lib-g-eje">${esc(d.etiqueta)}</text>` : "";
    return `<g class="lib-g-barra" data-graf="${id}" data-graf-i="${i}">${forma}${valor}${etiqueta}<rect x="${izq + i * slot}" y="${arriba}" width="${slot}" height="${alto}" fill="transparent"/></g>`;
  }).join("");
  const meta = o.meta ? `<line x1="${izq}" x2="${W - der}" y1="${y(o.meta)}" y2="${y(o.meta)}" class="lib-g-meta"/><text x="${W - der}" y="${y(o.meta) - 4}" text-anchor="end" class="lib-g-eje">meta ${o.meta}</text>` : "";
  return `
    <svg class="lib-g" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.titulo)}">
      <line x1="${izq}" x2="${W - der}" y1="${y(tope)}" y2="${y(tope)}" class="lib-g-grid"/>
      <line x1="${izq}" x2="${W - der}" y1="${base}" y2="${base}" class="lib-g-grid"/>
      <text x="${izq - 6}" y="${y(tope) + 4}" text-anchor="end" class="lib-g-eje">${tope}</text>
      <text x="${izq - 6}" y="${base + 4}" text-anchor="end" class="lib-g-eje">0</text>
      ${meta}${barras}
    </svg>
    <p class="lib-g-lectura" data-graf-lectura="${id}" aria-live="polite">Toca una barra para ver el número.</p>
    <details class="lib-g-tabla"><summary>Ver tabla</summary>
      <table><thead><tr><th scope="col">${esc(o.columna)}</th><th scope="col">${esc(o.unidad[1])}</th></tr></thead>
      <tbody>${datos.map(d => `<tr><td>${esc(d.nombre || d.etiqueta)}</td><td>${d.valor}</td></tr>`).join("")}</tbody></table>
    </details>`;
}
let graficos = {};   // id → { datos, unidad } para leer la barra tocada
function renderStats() {
  const el = $("lib-vista-stats");
  if (cargados < 2) { el.innerHTML = ""; return; }
  if (!libros.length) { el.innerHTML = `<p class="empty-state">Agrega libros y anota tus páginas: aquí verás cuánto lees.</p>`; return; }
  const hoy = hoyLocal();
  const e = P.estadisticas(libros, hoy);
  const porDia = P.paginasPorDia(libros);
  const ra = P.racha(porDia, hoy);
  const dias = P.ultimosDias(porDia, hoy, 30).map(d => ({ etiqueta: P.fechaCorta(d.fecha), nombre: P.fechaCorta(d.fecha), valor: d.paginas }));
  const meses = e.porMes.map(m => ({ etiqueta: m.nombre.slice(0, 1).toUpperCase(), nombre: m.nombre, valor: m.libros }));
  graficos = { dias: { datos: dias, unidad: ["página", "páginas"] }, meses: { datos: meses, unidad: ["libro", "libros"] } };
  const cifra = (t, v, sub) => `<div><span>${t}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
  const maxGen = e.generos.length ? e.generos[0].n : 1;
  el.innerHTML = `
    <div class="lib-stats-cifras">
      ${cifra(`Libros en ${e.anio}`, e.terminadosAnio)}
      ${cifra(`Páginas en ${e.anio}`, nf(e.paginasAnio))}
      ${cifra("Páginas al día", e.promedioDia30, "promedio de 30 días")}
      ${cifra("Racha", `${ra.actual} ${ra.actual === 1 ? "día" : "días"}`, `la mejor: ${ra.mejor}`)}
      ${cifra("Días leyendo", e.diasLeyendoAnio, `en ${e.anio}`)}
      ${cifra("Calificación", e.calificacionMedia ? `${String(e.calificacionMedia).replace(".", ",")} ★` : "—", "promedio")}
    </div>
    <section class="lib-graf">
      <h3>Páginas por día</h3>
      <p class="lib-nota">Últimos 30 días. La línea es tu meta de ${metaDia()}.</p>
      ${graficoBarras("dias", dias, { titulo: "Páginas leídas por día, últimos 30 días", meta: metaDia(), etiquetas: i => i === 0 || i === 14 || i === 29, columna: "Día", unidad: graficos.dias.unidad })}
    </section>
    <section class="lib-graf">
      <h3>Libros terminados por mes</h3>
      <p class="lib-nota">${e.anio}</p>
      ${graficoBarras("meses", meses, { titulo: `Libros terminados por mes en ${e.anio}`, etiquetas: () => true, todosLosValores: true, columna: "Mes", unidad: graficos.meses.unidad })}
    </section>
    ${e.generos.length ? `
    <section class="lib-graf">
      <h3>Lo que más lees</h3>
      <div class="lib-generos">${e.generos.slice(0, 6).map(g => `
        <div class="lib-genero-fila"><span>${esc(L.GENERO[g.nombre] ? L.GENERO[g.nombre].nombre : g.nombre)}</span><span class="lib-barra" aria-hidden="true"><i style="width:${Math.round((g.n / maxGen) * 100)}%"></i></span><b>${g.n}</b></div>`).join("")}
      </div>
    </section>` : ""}
    <ul class="lib-curiosos">
      ${e.autorTop ? `<li>Tu autor más leído: <b>${esc(e.autorTop.nombre)}</b> (${e.autorTop.n} libros).</li>` : ""}
      ${e.diasPorLibro ? `<li>Tardas en promedio <b>${e.diasPorLibro} ${e.diasPorLibro === 1 ? "día" : "días"}</b> en leer un libro.</li>` : ""}
      ${e.masLargo ? `<li>El más largo que terminaste: <b>${esc(e.masLargo.titulo)}</b> (${nf(e.masLargo.paginas)} páginas).</li>` : ""}
    </ul>`;
}
function leerBarra(g) {
  const id = g.dataset.graf, i = Number(g.dataset.grafI), gr = graficos[id];
  if (!gr) return;
  const d = gr.datos[i];
  const p = app.querySelector(`[data-graf-lectura="${id}"]`);
  if (p) p.textContent = `${d.nombre}: ${d.valor} ${d.valor === 1 ? gr.unidad[0] : gr.unidad[1]}`;
  app.querySelectorAll(`[data-graf="${id}"]`).forEach(x => x.classList.toggle("is-tenue", x !== g));
}
app.addEventListener("mouseover", e => { const g = e.target.closest("[data-graf-i]"); if (g) leerBarra(g); });

// ---------- Hoja: ficha del libro ----------
function ver(id) {
  const l = libros.find(x => x.id === id);
  if (!l) { hoja.cerrar(); return; }
  actual = { modo: "ver", id };
  const fs = L.frasesDe(frases, id);
  const dato = (n, v) => (v ? `<div><dt>${n}</dt><dd>${esc(v)}</dd></div>` : "");
  const x = P.lectura(l, hoyLocal(), metaDia()), est = estimacion(x);
  const dias = l.estado === "terminado" && l.fechaInicio && l.fechaFin ? P.diasEntre(l.fechaInicio, l.fechaFin) + 1 : null;
  hoja.abrir(l.titulo, `
      <div class="lib-ficha">
        <div class="lib-ficha-cab">
          <span class="lib-portada is-grande">${tapa(l, true)}</span>
          <div class="lib-ficha-info">
            <h4>${esc(l.titulo)}</h4>
            ${l.autor ? `<p>${esc(l.autor)}</p>` : ""}
            ${chipEstado(l.estado)}
            ${l.calificacion ? `<p class="lib-estrellas is-grande" aria-label="${l.calificacion} de 5">${L.estrellas(l.calificacion)}</p>` : ""}
            ${l.genero ? `<span class="lib-chip">${esc(L.GENERO[l.genero].nombre)}</span>` : ""}
          </div>
        </div>
        ${l.estado === "leyendo" ? `
        <div class="lib-progreso">
          <b>${esc(textoPagina(x))}</b>
          ${x.pct != null ? `<span class="lib-barra" aria-hidden="true"><i style="width:${x.pct}%"></i></span>` : ""}
          ${est ? `<p class="lib-nota">${esc(est)}</p>` : ""}
          <button type="button" class="lib-btn lib-btn-chico" data-lib-pagina="${esc(l.id)}">Anotar página</button>
        </div>` : ""}
        <dl class="lib-datos">
          ${dato("Páginas", l.paginas ? String(l.paginas) : "")}
          ${dato("Publicado", l.anio ? String(l.anio) : "")}
          ${dato("Lo leíste en", dias ? `${dias} ${dias === 1 ? "día" : "días"}` : "")}
          ${dato("Registrado", L.fechaLarga(l.fechaRegistro))}
          ${dato("Empezado", l.fechaInicio ? L.fechaLarga(l.fechaInicio) : "")}
          ${dato("Terminado", l.fechaFin ? L.fechaLarga(l.fechaFin) : "")}
        </dl>
        ${l.opinion ? `<h5 class="lib-h">Mi opinión</h5><p class="lib-opinion">${esc(l.opinion)}</p>` : ""}
        ${l.olKey ? `<p class="lib-nota"><a class="lib-enlace" href="https://openlibrary.org${esc(l.olKey)}" target="_blank" rel="noopener">Más datos en Open Library ↗</a></p>` : ""}
        <div class="lib-acciones">
          <button type="button" class="lib-btn-peligro" data-lib="borrar">Eliminar</button>
          <button type="button" class="lib-btn-sec" data-lib="editar">Editar</button>
        </div>
        <div class="lib-h lib-h-fila"><h5>Frases <span>${fs.length}</span></h5><button type="button" class="lib-btn-sec lib-btn-chico" data-lib="frase-de">＋ Frase</button></div>
        ${fs.length ? fs.map(f => fraseHtml(f, false)).join("") : `<p class="lib-nota">Guarda aquí las frases que te gustaron de este libro.</p>`}
      </div>`);
}

// ---------- Hoja: agregar o editar libro ----------
function formLibro(id) {
  const l = id ? libros.find(x => x.id === id) : null;
  actual = { modo: "libro", id: l ? l.id : null };
  const v = l || { titulo: "", autor: "", paginas: null, estado: "por_leer", calificacion: null, opinion: "", fechaRegistro: hoyLocal(), fechaInicio: null, fechaFin: null, genero: null, anio: null, olKey: null };
  encontrados = [];
  const hoy = hoyLocal();
  const fecha = (name, etiqueta, valor) => `<label class="lib-campo"><span>${etiqueta}</span><input type="date" name="${name}" max="${hoy}" value="${esc(valor || "")}" class="lib-input"></label>`;
  portadaSel = undefined;
  hoja.abrir(l ? "Editar libro" : "Agregar libro", `
      <form class="lib-form lib-form-libro" novalidate>
        <div class="lib-campo lib-buscar-libro"><span>Buscar el libro</span>
          <div class="lib-buscar-fila">
            <input type="search" class="lib-input" data-lib-q placeholder="Título, autor o ISBN" autocomplete="off" enterkeyhint="search" aria-label="Buscar el libro en Open Library">
            <button type="button" class="lib-btn-sec lib-btn-chico" data-lib="buscar-libro">Buscar</button>
          </div>
          <p class="lib-ayuda" data-lib-buscar-msg>${l ? "¿Te faltan datos? Búscalo y completo lo que falte." : "Escribe y elige tu libro: completo el título, el autor, las páginas, la portada y el género."}</p>
          <div class="lib-encontrados" data-lib-encontrados></div>
        </div>
        <div class="lib-campo"><span>Portada</span>
          <div class="lib-portada-editar">
            <span class="lib-portada is-grande" data-lib-prev>${tapa(v, true)}</span>
            <div class="lib-portada-botones">
              <button type="button" class="lib-btn-sec lib-btn-chico" data-lib="buscar-portada">🔎 Buscar portada</button>
              <label class="lib-btn-sec lib-btn-chico lib-subir">📷 Tomar o subir foto<input type="file" accept="image/*" data-lib-foto></label>
              <button type="button" class="lib-btn-sec lib-btn-chico" data-lib="quitar-portada"${v.portada ? "" : " hidden"}>Quitar portada</button>
            </div>
          </div>
          <p class="lib-ayuda" data-lib-portada-msg hidden></p>
          <div class="lib-resultados" data-lib-resultados></div>
        </div>
        <label class="lib-campo"><span>Título</span><input type="text" name="titulo" maxlength="200" autocomplete="off" value="${esc(v.titulo)}" class="lib-input" placeholder="Ej: Cien años de soledad"></label>
        <p class="lib-ayuda lib-aviso-dup" data-lib-dup hidden></p>
        <label class="lib-campo"><span>Autor</span><input type="text" name="autor" maxlength="150" autocomplete="off" value="${esc(v.autor)}" class="lib-input" placeholder="Ej: Gabriel García Márquez"></label>
        <div class="lib-par">
          <label class="lib-campo"><span>Páginas (opcional)</span><input type="text" inputmode="numeric" name="paginas" autocomplete="off" value="${esc(v.paginas || "")}" class="lib-input" placeholder="350"></label>
          <label class="lib-campo"><span>Género (opcional)</span><select name="genero" class="lib-input">
            <option value="">Sin género</option>
            ${L.GENEROS.map(g => `<option value="${g.id}"${g.id === v.genero ? " selected" : ""}>${esc(g.nombre)}</option>`).join("")}
          </select></label>
        </div>
        <input type="hidden" name="anio" value="${esc(v.anio || "")}">
        <input type="hidden" name="olKey" value="${esc(v.olKey || "")}">
        <div class="lib-campo"><span>Estado</span>
          <div class="lib-segmento" role="radiogroup" aria-label="Estado">
            ${L.ESTADOS.map(e => `<button type="button" class="${e.id === v.estado ? "active" : ""}" data-lib-set-estado="${e.id}" role="radio" aria-checked="${e.id === v.estado}">${e.nombre}</button>`).join("")}
          </div>
          <input type="hidden" name="estado" value="${esc(v.estado)}">
        </div>
        <div class="lib-campo"><span>Calificación (opcional)</span>
          <div class="lib-estrellas-elegir" role="radiogroup" aria-label="Calificación">
            ${[1, 2, 3, 4, 5].map(n => `<button type="button" data-lib-cal="${n}" aria-label="${n} de 5" aria-checked="${v.calificacion === n}" role="radio" class="${v.calificacion >= n ? "on" : ""}">★</button>`).join("")}
            <button type="button" class="lib-sin-cal" data-lib-cal="0">Sin calificar</button>
          </div>
          <input type="hidden" name="calificacion" value="${v.calificacion || 0}">
        </div>
        <div class="lib-par">${fecha("fechaRegistro", "Fecha de registro", v.fechaRegistro)}${fecha("fechaInicio", "Empecé a leerlo", v.fechaInicio)}</div>
        <div class="lib-par">${fecha("fechaFin", "Lo terminé", v.fechaFin)}<span></span></div>
        <p class="lib-ayuda" data-lib-aviso-fecha hidden></p>
        <label class="lib-campo"><span>Mi opinión (opcional)</span><textarea name="opinion" rows="5" class="lib-input" placeholder="Qué te pareció, qué te dejó…">${esc(v.opinion)}</textarea></label>
        <p class="lib-error" role="alert" hidden></p>
        <div class="lib-acciones">
          ${l ? `<button type="button" class="lib-btn-sec" data-lib="volver-ficha">Cancelar</button>` : ""}
          <button type="submit" class="lib-btn">Guardar</button>
        </div>
      </form>`);
}

// ---------- Hoja: agregar o editar frase ----------
function formFrase(id, libroId, volver) {
  const f = id ? frases.find(x => x.id === id) : null;
  const lid = f ? f.libroId : libroId || "";
  actual = { modo: "frase", id: f ? f.id : null, libroId: lid, volver: volver || null };
  const l = libros.find(x => x.id === lid);
  const v = f || { texto: "", pagina: null, fecha: hoyLocal() };
  const elegirLibro = volver === "ver" && l
    ? `<p class="lib-nota">De <b>${esc(l.titulo)}</b>${l.autor ? ` · ${esc(l.autor)}` : ""}</p><input type="hidden" name="libroId" value="${esc(l.id)}">`
    : `<label class="lib-campo"><span>Libro</span><select name="libroId" class="lib-input">
          <option value=""${lid ? "" : " selected"} disabled>Elige el libro</option>
          ${L.ordenar(libros, "titulo").map(x => `<option value="${esc(x.id)}"${x.id === lid ? " selected" : ""}>${esc(x.titulo)}${x.autor ? ` — ${esc(x.autor)}` : ""}</option>`).join("")}
        </select></label>`;
  hoja.abrir(f ? "Editar frase" : "Nueva frase", `
      <form class="lib-form lib-form-frase" novalidate>
        ${elegirLibro}
        <label class="lib-campo"><span>Frase</span><textarea name="texto" rows="4" class="lib-input" placeholder="Copia la frase tal cual">${esc(v.texto)}</textarea></label>
        <div class="lib-par">
          <label class="lib-campo"><span>Página (opcional)</span><input type="text" inputmode="numeric" name="pagina" autocomplete="off" value="${esc(v.pagina || "")}" class="lib-input" placeholder="72"></label>
          <label class="lib-campo"><span>Fecha</span><input type="date" name="fecha" max="${hoyLocal()}" value="${esc(v.fecha)}" class="lib-input"></label>
        </div>
        <p class="lib-error" role="alert" hidden></p>
        <div class="lib-acciones">
          ${f ? `<button type="button" class="lib-btn-peligro" data-lib="borrar-frase">Eliminar</button>` : ""}
          <button type="submit" class="lib-btn">Guardar</button>
        </div>
      </form>`);
}

const leer = f => { const o = {}; Array.from(f.elements).forEach(el => { if (el.name) o[el.name] = el.value; }); return o; };

hoja.el.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target, hoy = hoyLocal();
  if (actual && actual.modo === "libro") {
    const r = L.validarLibro(leer(f), { hoy });
    if (!r.ok) { window.Lectura.errores(f, r.errores); return; }
    const dup = !actual.id && L.duplicado(libros, r.doc.titulo, null);
    if (dup && !confirm(`Ya tienes «${dup.titulo}» en tu lista (${L.ESTADO[dup.estado].nombre}). ¿Agregarlo igual?`)) return;
    // Si lo marcas terminado y venías anotando páginas, la última es la final.
    const previo = actual.id ? libros.find(x => x.id === actual.id) : null;
    if (previo && r.doc.estado === "terminado" && previo.estado !== "terminado") Object.assign(r.doc, P.alTerminar(Object.assign({}, previo, { paginas: r.doc.paginas }), r.doc.fechaFin));
    // Portada: en el libro va solo el tipo (y la URL); la foto, aparte en
    // libros_portadas/{id} para no recargar la lista ni cada edición.
    const ahora = Date.now();
    const portada = L.portadaParaGuardar(portadaSel, ahora);
    const docRef = actual.id ? ref("libros").doc(actual.id) : ref("libros").doc();
    const fotoRef = ref("libros_portadas").doc(docRef.id);
    const lote = db.batch();
    if (portada !== undefined) r.doc.portada = portada;
    if (actual.id) lote.update(docRef, r.doc); else lote.set(docRef, Object.assign(r.doc, { creado: ahora }));
    if (portada && portada.tipo === "foto") lote.set(fotoRef, { v: 1, datos: portadaSel.datos, ancho: portadaSel.ancho, alto: portadaSel.alto, kb: L.kb(portadaSel.datos), actualizado: ahora });
    else if (portada !== undefined && portadasDocs[docRef.id]) lote.delete(fotoRef);
    lote.commit().catch(fallo("guardar"));
    if (actual.id) ver(actual.id); else hoja.cerrar();
  } else if (actual && actual.modo === "pagina") {
    const l = libros.find(x => x.id === actual.id);
    if (!l) { hoja.cerrar(); return; }
    const r = P.registrarPagina(l, f.elements.pagina.value, hoy);
    if (!r.ok) { window.Lectura.errores(f, [{ campo: "pagina", texto: r.error }]); return; }
    ref("libros").doc(l.id).update(r.cambios).catch(fallo("guardar"));
    if (r.terminado) festejo(l); else if (actual.volver === "ver") ver(l.id); else hoja.cerrar();
  } else if (actual && actual.modo === "metas") {
    const r = P.validarMetas(leer(f));
    if (!r.ok) { window.Lectura.errores(f, r.errores); return; }
    refAjustes().set({ metaPaginasDia: r.metaPaginasDia, retos: { [hoy.slice(0, 4)]: r.reto } }, { merge: true }).catch(fallo("guardar"));
    hoja.cerrar();
  } else if (actual && actual.modo === "frase") {
    const r = L.validarFrase(leer(f), { hoy, libros: libros.map(x => x.id) });
    if (!r.ok) { window.Lectura.errores(f, r.errores); return; }
    if (actual.id) ref("libros_frases").doc(actual.id).update(r.doc).catch(fallo("guardar"));
    else ref("libros_frases").add(Object.assign(r.doc, { creado: Date.now() })).catch(fallo("guardar"));
    if (actual.volver === "ver") ver(r.doc.libroId); else hoja.cerrar();
  }
});

hoja.el.addEventListener("input", e => {
  // Buscar el libro: busca solo cuando dejas de escribir.
  if (e.target.matches("[data-lib-q]")) {
    clearTimeout(relojBusqueda);
    if (e.target.value.trim().length >= 3) relojBusqueda = setTimeout(buscarLibro, 650);
    return;
  }
  if (e.target.name === "titulo" && actual && actual.modo === "libro") avisarDuplicado();
  if (e.target.type === "date") { const aviso = hoja.el.querySelector("[data-lib-aviso-fecha]"); if (aviso) aviso.hidden = true; }
  // La tapa genérica de la vista previa sigue al título y al autor que escribes.
  if ((e.target.name === "titulo" || e.target.name === "autor") && actual && actual.modo === "libro") {
    const f = e.target.form, previa = hoja.el.querySelector("[data-lib-prev]");
    const original = actual.id ? (libros.find(x => x.id === actual.id) || {}).portada : null;
    if (previa) previa.innerHTML = tapa({ titulo: f.elements.titulo.value.trim() || "Sin título", autor: f.elements.autor.value.trim(), id: actual.id || "" }, true, portadaSel !== undefined ? portadaSel : original);
  }
  if (!e.target.classList.contains("is-error")) return;
  e.target.classList.remove("is-error");
  e.target.removeAttribute("aria-invalid");
  const f = e.target.form;
  if (f && !f.querySelector(".is-error")) f.querySelector(".lib-error").hidden = true;
});

// Enter en "Buscar el libro" busca (no guarda el formulario).
hoja.el.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.matches("[data-lib-q]")) { e.preventDefault(); clearTimeout(relojBusqueda); buscarLibro(); }
});

hoja.el.addEventListener("click", e => {
  const f = hoja.el.querySelector("form");
  const sumar = e.target.closest("[data-lib-sumar]");
  if (sumar && f) {
    const l = libros.find(x => x.id === actual.id);
    const campo = f.elements.pagina;
    const ahora = Number(campo.value) || (l && l.paginaActual) || 0;
    campo.value = sumar.dataset.libSumar === "fin" ? String(l.paginas) : String(l && l.paginas ? Math.min(l.paginas, ahora + Number(sumar.dataset.libSumar)) : ahora + Number(sumar.dataset.libSumar));
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  const cal2 = e.target.closest("[data-lib-calificar]");
  if (cal2) {
    const n = Number(cal2.dataset.libCalificar);
    ref("libros").doc(actual.id).update({ calificacion: n }).catch(fallo("guardar"));
    hoja.el.querySelectorAll("[data-lib-calificar]").forEach(b => { const k = Number(b.dataset.libCalificar); b.classList.toggle("on", k <= n); b.setAttribute("aria-checked", String(k === n)); });
    return;
  }
  const pag = e.target.closest("[data-lib-pagina]");
  if (pag) { formPagina(pag.dataset.libPagina, "ver"); return; }
  const libroElegido = e.target.closest("[data-lib-elegir-libro]");
  if (libroElegido) { elegirLibro(encontrados[Number(libroElegido.dataset.libElegirLibro)]); return; }
  // Estado: al pasar a "Leyendo" o "Terminado" sin fecha, propone la de hoy.
  const est = e.target.closest("[data-lib-set-estado]");
  if (est && f) {
    const id = est.dataset.libSetEstado;
    f.elements.estado.value = id;
    hoja.el.querySelectorAll("[data-lib-set-estado]").forEach(b => { const on = b === est; b.classList.toggle("active", on); b.setAttribute("aria-checked", String(on)); });
    const campo = id === "leyendo" ? f.elements.fechaInicio : id === "terminado" ? f.elements.fechaFin : null;
    const aviso = hoja.el.querySelector("[data-lib-aviso-fecha]");
    if (campo && !campo.value) {
      campo.value = hoyLocal();
      aviso.textContent = `Puse hoy como fecha de ${id === "leyendo" ? "inicio" : "fin"}; cámbiala si fue otro día.`;
      aviso.hidden = false;
    }
    return;
  }
  const cal = e.target.closest("[data-lib-cal]");
  if (cal && f) {
    const n = Number(cal.dataset.libCal);
    f.elements.calificacion.value = String(n);
    hoja.el.querySelectorAll(".lib-estrellas-elegir [data-lib-cal]").forEach(b => {
      const k = Number(b.dataset.libCal);
      if (k) { b.classList.toggle("on", k <= n); b.setAttribute("aria-checked", String(k === n)); }
    });
    return;
  }
  const fr = e.target.closest("[data-lib-frase]");
  if (fr) { formFrase(fr.dataset.libFrase, null, "ver"); return; }
  const elegida = e.target.closest("[data-lib-elegir-portada]");
  if (elegida) {
    elegirPortada({ tipo: "url", url: elegida.dataset.libElegirPortada });
    // Lo que trae esa portada completa lo que falte (autor y año).
    if (f && !f.elements.autor.value.trim() && elegida.dataset.autor) { f.elements.autor.value = elegida.dataset.autor; f.elements.autor.dispatchEvent(new Event("input", { bubbles: true })); }
    if (f && !f.elements.anio.value && elegida.dataset.anio) f.elements.anio.value = elegida.dataset.anio;
    return;
  }
  const b = e.target.closest("[data-lib]");
  if (!b || !actual) return;
  const accion = b.dataset.lib;
  if (accion === "buscar-portada") { buscarPortada(); return; }
  if (accion === "buscar-libro") { clearTimeout(relojBusqueda); buscarLibro(); return; }
  if (accion === "listo") { hoja.cerrar(); return; }
  if (accion === "opinar") { formLibro(actual.id); return; }
  if (accion === "quitar-portada") { elegirPortada(null); mensajePortada("Sin portada: se usa la tapa con título y autor."); return; }
  if (accion === "editar") formLibro(actual.id);
  else if (accion === "volver-ficha") ver(actual.id);
  else if (accion === "frase-de") formFrase(null, actual.id, "ver");
  else if (accion === "borrar") borrarLibro(actual.id);
  else if (accion === "borrar-frase") borrarFrase(actual.id);
});

// ---------- Portada en el formulario ----------
function mensajePortada(t) {
  const m = hoja.el.querySelector("[data-lib-portada-msg]");
  if (!m) return;
  m.textContent = t || "";
  m.hidden = !t;
}
function elegirPortada(sel) {
  const f = hoja.el.querySelector(".lib-form-libro");
  if (!f) return;
  portadaSel = sel;
  const datos = { titulo: f.elements.titulo.value.trim() || "Sin título", autor: f.elements.autor.value.trim(), id: actual.id || "" };
  hoja.el.querySelector("[data-lib-prev]").innerHTML = tapa(datos, true, sel);
  hoja.el.querySelector('[data-lib="quitar-portada"]').hidden = !sel;
  hoja.el.querySelectorAll("[data-lib-elegir-portada]").forEach(b => b.classList.toggle("is-elegida", !!sel && sel.tipo === "url" && b.dataset.libElegirPortada === sel.url));
}
// Busca en Open Library con el título y el autor escritos en el formulario.
function buscarPortada() {
  const f = hoja.el.querySelector(".lib-form-libro");
  const titulo = f.elements.titulo.value.trim(), autor = f.elements.autor.value.trim();
  const caja = hoja.el.querySelector("[data-lib-resultados]");
  if (!titulo) { mensajePortada("Escribe el título primero (y el autor, si lo sabes)."); f.elements.titulo.focus(); return; }
  mensajePortada("Buscando portadas…");
  caja.innerHTML = "";
  const corte = typeof AbortController === "function" ? new AbortController() : null;
  const reloj = setTimeout(() => corte && corte.abort(), 12000);
  fetch(L.urlBusqueda(titulo, autor), corte ? { signal: corte.signal } : {})
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then(json => {
      if (!hoja.el.contains(caja)) return;
      const lista = L.leerBusqueda(json, 6);
      if (!lista.length) { mensajePortada("No encontré portadas con ese título. Prueba con el título original, sin el autor, o sube una foto."); return; }
      mensajePortada("Toca la portada que corresponde a tu libro (de Open Library).");
      caja.innerHTML = lista.map(x => `
          <button type="button" class="lib-resultado" data-lib-elegir-portada="${esc(x.url)}" data-autor="${esc(x.autor)}" data-anio="${esc(x.anio || "")}" title="${esc(`${x.titulo}${x.autor ? ` — ${x.autor}` : ""}${x.anio ? ` (${x.anio})` : ""}`)}">
            <img src="${esc(x.url)}" alt="${esc(x.titulo)}" loading="lazy" decoding="async">
          </button>`).join("");
    })
    .catch(() => mensajePortada("No se pudo buscar (¿estás sin internet?). Puedes subir una foto o intentarlo después."))
    .finally(() => clearTimeout(reloj));
}
// ---------- Buscar el libro (Open Library): completa todo de un toque ----------
function mensajeBusqueda(t) {
  const m = hoja.el.querySelector("[data-lib-buscar-msg]");
  if (m) m.textContent = t;
}
function buscarLibro() {
  const q = hoja.el.querySelector("[data-lib-q]");
  const caja = hoja.el.querySelector("[data-lib-encontrados]");
  if (!q || !caja) return;
  const texto = q.value.trim();
  if (texto.length < 2) { mensajeBusqueda("Escribe al menos parte del título (o el ISBN)."); q.focus(); return; }
  if (busquedaEnCurso) busquedaEnCurso.abort();
  const corte = typeof AbortController === "function" ? new AbortController() : null;
  busquedaEnCurso = corte;
  const reloj = setTimeout(() => corte && corte.abort(), 12000);
  mensajeBusqueda("Buscando…");
  fetch(L.urlBuscarLibro(texto), corte ? { signal: corte.signal } : {})
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then(json => {
      if (!hoja.el.contains(caja) || busquedaEnCurso !== corte) return;
      encontrados = L.leerLibros(json, 8);
      if (!encontrados.length) { caja.innerHTML = ""; mensajeBusqueda("No encontré ese libro. Prueba con menos palabras, con el título original o escríbelo a mano abajo."); return; }
      mensajeBusqueda("Toca tu libro:");
      caja.innerHTML = encontrados.map((x, i) => `
          <button type="button" class="lib-encontrado" data-lib-elegir-libro="${i}">
            <span class="lib-encontrado-portada">${x.url ? `<img src="${esc(x.url)}" alt="" loading="lazy" decoding="async">` : `<span class="lib-portada">${tapa({ titulo: x.titulo, autor: x.autor })}</span>`}</span>
            <span class="lib-encontrado-txt"><b>${esc(x.titulo)}</b>${x.autor ? `<small>${esc(x.autor)}</small>` : ""}
              <small>${esc([x.anio, x.paginas ? `${x.paginas} págs.` : "", x.genero ? L.GENERO[x.genero].nombre : ""].filter(Boolean).join(" · "))}</small></span>
          </button>`).join("");
    })
    .catch(err => { if (err && err.name === "AbortError" && busquedaEnCurso !== corte) return; mensajeBusqueda("No se pudo buscar (¿estás sin internet?). Puedes escribir los datos a mano."); })
    .finally(() => clearTimeout(reloj));
}
function elegirLibro(x) {
  const f = hoja.el.querySelector(".lib-form-libro");
  if (!f || !x) return;
  const llenos = [];
  const poner = (campo, valor, nombre) => { if (valor == null || valor === "") return; f.elements[campo].value = String(valor); if (nombre) llenos.push(nombre); };
  poner("titulo", x.titulo, "el título");
  poner("autor", x.autor, "el autor");
  poner("paginas", x.paginas, "las páginas");
  poner("genero", x.genero, "el género");
  f.elements.anio.value = x.anio || "";
  f.elements.olKey.value = x.olKey || "";
  // Al editar, una portada que ya tenías se respeta.
  const original = actual.id ? (libros.find(y => y.id === actual.id) || {}).portada : null;
  const tienePortada = portadaSel !== undefined ? !!portadaSel : !!original;
  if (x.url && !tienePortada) { elegirPortada({ tipo: "url", url: x.url }); llenos.push("la portada"); }
  else f.elements.titulo.dispatchEvent(new Event("input", { bubbles: true }));
  hoja.el.querySelector("[data-lib-encontrados]").innerHTML = "";
  hoja.el.querySelector("[data-lib-q]").value = "";
  const lista = llenos.length > 1 ? `${llenos.slice(0, -1).join(", ")} y ${llenos[llenos.length - 1]}` : llenos[0] || "los datos";
  mensajeBusqueda(`✓ Completé ${lista}. Revisa y toca Guardar.`);
  avisarDuplicado();
}
function avisarDuplicado() {
  const f = hoja.el.querySelector(".lib-form-libro"), aviso = hoja.el.querySelector("[data-lib-dup]");
  if (!f || !aviso) return;
  const d = L.duplicado(libros, f.elements.titulo.value, actual.id);
  aviso.hidden = !d;
  aviso.textContent = d ? `Ojo: ya tienes «${d.titulo}» en tu lista (${L.ESTADO[d.estado].nombre}).` : "";
}

// ---------- Hoja: anotar página ----------
function formPagina(id, volver) {
  const l = libros.find(x => x.id === id);
  if (!l) return;
  actual = { modo: "pagina", id, volver: volver || null };
  const hoy = hoyLocal();
  const x = P.lectura(l, hoy, metaDia());
  const hoyPags = P.paginasPorDia(libros)[hoy] || 0;
  hoja.abrir("¿En qué página vas?", `
      <form class="lib-form lib-form-pagina" novalidate>
        <p class="lib-nota"><b>${esc(l.titulo)}</b>${l.autor ? ` · ${esc(l.autor)}` : ""}</p>
        <label class="lib-campo"><span>Voy en la página${l.paginas ? ` (de ${l.paginas})` : ""}</span>
          <input type="text" inputmode="numeric" pattern="[0-9]*" name="pagina" autocomplete="off" value="${esc(x.pagina != null && l.estado !== "terminado" ? x.pagina : "")}" class="lib-input lib-input-grande"></label>
        <div class="lib-sumar" role="group" aria-label="Sumar páginas">
          ${[10, 20, 30].map(n => `<button type="button" class="lib-btn-sec lib-btn-chico" data-lib-sumar="${n}">+${n}</button>`).join("")}
          ${l.paginas ? `<button type="button" class="lib-btn-sec lib-btn-chico" data-lib-sumar="fin">Lo terminé</button>` : ""}
        </div>
        <p class="lib-ayuda">Hoy llevas ${nf(hoyPags)} de ${metaDia()} páginas.${!P.entradas(l).length && l.estado === "leyendo" && l.fechaInicio !== hoy ? " Como ya venías leyéndolo, desde hoy cuento tus páginas por día." : ""}</p>
        <p class="lib-error" role="alert" hidden></p>
        <div class="lib-acciones">
          ${volver === "ver" ? `<button type="button" class="lib-btn-sec" data-lib="volver-ficha">Cancelar</button>` : ""}
          <button type="submit" class="lib-btn">Guardar</button>
        </div>
      </form>`);
}
// ¡Terminaste! Calificarlo de un toque o escribir tu opinión.
function festejo(l) {
  actual = { modo: "festejo", id: l.id };
  const hoy = hoyLocal();
  const conEste = libros.map(x => (x.id === l.id ? Object.assign({}, x, { estado: "terminado", fechaFin: hoy }) : x));
  const reto = P.reto(conEste, metaAnio(), hoy);
  hoja.abrir("¡Terminaste!", `
      <div class="lib-festejo">
        <p class="lib-festejo-emoji" aria-hidden="true">🎉</p>
        <h4>¡Terminaste «${esc(l.titulo)}»!</h4>
        <p class="lib-nota">${reto.terminados} ${reto.terminados === 1 ? "libro terminado" : "libros terminados"} en ${reto.anio}${reto.meta ? ` de ${reto.meta} de tu reto` : ""}.</p>
        <p class="lib-festejo-p">¿Cuántas estrellas le das?</p>
        <div class="lib-estrellas-elegir" role="radiogroup" aria-label="Calificación">
          ${[1, 2, 3, 4, 5].map(n => `<button type="button" data-lib-calificar="${n}" aria-label="${n} de 5" role="radio" aria-checked="${l.calificacion === n}" class="${l.calificacion >= n ? "on" : ""}">★</button>`).join("")}
        </div>
        <div class="lib-acciones">
          <button type="button" class="lib-btn-sec" data-lib="opinar">Escribir mi opinión</button>
          <button type="button" class="lib-btn" data-lib="listo">Listo</button>
        </div>
      </div>`);
}

// ---------- Hoja: metas ----------
function formMetas() {
  actual = { modo: "metas" };
  const anio = hoyLocal().slice(0, 4);
  hoja.abrir("Tus metas de lectura", `
      <form class="lib-form lib-form-metas" novalidate>
        <label class="lib-campo"><span>Páginas por día</span><input type="text" inputmode="numeric" pattern="[0-9]*" name="metaPaginasDia" autocomplete="off" value="${metaDia()}" class="lib-input"></label>
        <p class="lib-ayuda">Empieza en 30, como tu rutina de «Leer 30 páginas».</p>
        <label class="lib-campo"><span>Libros para terminar en ${anio}</span><input type="text" inputmode="numeric" pattern="[0-9]*" name="reto" autocomplete="off" value="${metaAnio() || ""}" placeholder="Ej: 12" class="lib-input"></label>
        <p class="lib-ayuda">Déjalo vacío si no quieres un reto este año.</p>
        <p class="lib-error" role="alert" hidden></p>
        <div class="lib-acciones"><button type="submit" class="lib-btn">Guardar</button></div>
      </form>`);
}

// Foto del iPhone (cámara o fotos): se achica a 400 × 600 como máximo y se
// comprime en JPEG hasta que entre holgada en un documento de Firestore.
function comprimirFoto(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      try {
        let { ancho, alto } = L.medidasFoto(img.naturalWidth, img.naturalHeight);
        for (let intento = 0; intento < 3; intento++) {
          const c = document.createElement("canvas");
          c.width = ancho; c.height = alto;
          c.getContext("2d").drawImage(img, 0, 0, ancho, alto);
          for (const q of L.CALIDADES) {
            const datos = c.toDataURL("image/jpeg", q);
            if (L.fotoOk(datos)) { resolver({ tipo: "foto", datos, ancho, alto }); return; }
          }
          ancho = Math.round(ancho * 0.7); alto = Math.round(alto * 0.7);
        }
        rechazar(new Error("muy grande"));
      } catch (err) { rechazar(err); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error("no es una imagen")); };
    img.src = url;
  });
}
hoja.el.addEventListener("change", e => {
  if (!e.target.matches("[data-lib-foto]")) return;
  const archivo = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!archivo) return;
  mensajePortada("Preparando la foto…");
  comprimirFoto(archivo)
    .then(sel => { elegirPortada(sel); hoja.el.querySelector("[data-lib-resultados]").innerHTML = ""; mensajePortada(`Foto lista (≈ ${L.kb(sel.datos)} KB). Se guarda al tocar Guardar.`); })
    .catch(() => mensajePortada("No pude usar esa imagen. Prueba con otra foto."));
});

function borrarLibro(id) {
  const l = libros.find(x => x.id === id);
  if (!l) return;
  const fs = frases.filter(f => f.libroId === id);
  if (!confirm(`¿Eliminar «${l.titulo}»?${fs.length ? ` También se borran sus ${fs.length === 1 ? "frase" : `${fs.length} frases`}.` : ""} No se puede deshacer.`)) return;
  const lote = db.batch();
  lote.delete(ref("libros").doc(id));
  fs.forEach(f => lote.delete(ref("libros_frases").doc(f.id)));
  if (portadasDocs[id]) lote.delete(ref("libros_portadas").doc(id));
  lote.commit().catch(fallo("eliminar"));
  hoja.cerrar();
}
function borrarFrase(id) {
  const f = frases.find(x => x.id === id);
  if (!f || !confirm("¿Eliminar esta frase? No se puede deshacer.")) return;
  ref("libros_frases").doc(id).delete().catch(fallo("eliminar"));
  if (actual.volver === "ver") ver(f.libroId); else hoja.cerrar();
}

// ---------- Acciones de la sección ----------
app.addEventListener("click", e => {
  const t = e.target.closest("[data-lib-vista]");
  if (t) {
    vista = t.dataset.libVista;
    app.querySelectorAll("[data-lib-vista]").forEach(b => { const on = b === t; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
    $("lib-vista-libros").hidden = vista !== "libros";
    $("lib-vista-frases").hidden = vista !== "frases";
    $("lib-vista-stats").hidden = vista !== "stats";
    render();
    return;
  }
  const g = e.target.closest("[data-graf-i]");
  if (g) { leerBarra(g); return; }
  const pag = e.target.closest("[data-lib-pagina]");
  if (pag) { formPagina(pag.dataset.libPagina, null); return; }
  const v = e.target.closest("[data-lib-ver]");
  if (v) { ver(v.dataset.libVer); return; }
  const fr = e.target.closest("[data-lib-frase]");
  if (fr) { formFrase(fr.dataset.libFrase, null, null); return; }
  const est = e.target.closest("[data-lib-estado]");
  if (est) { filtro.estado = est.dataset.libEstado; renderEstados(); renderLista(); return; }
  const b = e.target.closest("[data-lib]");
  if (!b) return;
  if (b.dataset.lib === "nuevo") formLibro(null);
  else if (b.dataset.lib === "metas") formMetas();
  else if (b.dataset.lib === "nueva-frase") {
    if (!libros.length) { alert("Primero agrega un libro."); return; }
    formFrase(null, null, null);
  } else if (b.dataset.lib === "exportar") window.Lectura.descargar(`manolo-libros-${hoyLocal()}.json`, L.exportarJson(librosDocs, frasesDocs, new Date().toISOString(), portadasDocs), "application/json");
});
$("lib-buscar").addEventListener("input", e => { filtro.texto = e.target.value; renderLista(); });
$("lib-orden").addEventListener("change", e => { filtro.orden = e.target.value; renderLista(); });
$("lib-genero").addEventListener("change", e => { filtro.genero = e.target.value; renderLista(); });
$("lib-buscar-frases").addEventListener("input", e => { textoFrases = e.target.value; renderFrases(); });

// ---------- Datos ----------
onAuthReady(() => {
  let vistos = { libros: false, frases: false };
  const listo = k => { if (!vistos[k]) { vistos[k] = true; cargados++; } render(); };
  ref("libros").onSnapshot(snap => {
    librosDocs = {};
    snap.docs.forEach(d => { librosDocs[d.id] = d.data(); });
    libros = Object.keys(librosDocs).map(id => L.normalizarLibro(id, librosDocs[id]));
    listo("libros");
  }, err => console.warn("Libros:", err));
  ref("libros_frases").onSnapshot(snap => {
    frasesDocs = {};
    snap.docs.forEach(d => { frasesDocs[d.id] = d.data(); });
    frases = Object.keys(frasesDocs).map(id => L.normalizarFrase(id, frasesDocs[id]));
    listo("frases");
  }, err => console.warn("Libros (frases):", err));
  refAjustes().onSnapshot(d => {
    ajustesLib = d.exists ? d.data() || {} : {};
    if (cargados >= 2) { renderResumen(); renderLeyendo(); if (vista === "stats") renderStats(); }
  }, err => console.warn("Libros (metas):", err));
  ref("libros_portadas").onSnapshot(snap => {
    portadasDocs = {};
    snap.docs.forEach(d => { portadasDocs[d.id] = d.data(); });
    if (cargados >= 2 && vista === "libros") renderLista();
    if (hoja.abierta() && actual && actual.modo === "ver") ver(actual.id);
  }, err => console.warn("Libros (portadas):", err));
});
render();
})();
