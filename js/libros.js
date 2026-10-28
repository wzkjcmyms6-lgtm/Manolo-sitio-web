// ---------- Libros (sub-panel de Inicio) ----------
// Libros leídos o por leer: título, autor, páginas, estado, calificación,
// opinión y fechas (registro, inicio, fin), con sus frases. Lista con
// portadas, buscador, filtro por estado y orden; "Todas mis frases" con
// buscador; editar, borrar y exportar.
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
const { esc, hoyLocal } = window.Lectura;
const app = document.getElementById("lib-app");
const hoja = window.Lectura.hoja("lib-hoja");

let librosDocs = {}, frasesDocs = {}, portadasDocs = {};
let libros = [], frases = [];
let cargados = 0;               // 2 = libros y frases ya llegaron
let vista = "libros";           // "libros" | "frases"
const filtro = { texto: "", estado: "", orden: "registro" };
let textoFrases = "";
let actual = null;              // qué muestra la hoja: { modo: "ver"|"libro"|"frase", id, libroId, volver }
let portadaSel;                 // en el formulario: undefined = sin cambios, null = quitar, { tipo: "url"|"foto", … }

const ref = n => db.collection("users").doc(currentUser.uid).collection(n);
const fallo = (que) => err => alert(`No se pudo ${que}: ${err && err.message ? err.message : err}`);

// ---------- Estructura fija (el buscador no se repinta al escribir) ----------
app.innerHTML = `
  <div class="lib-resumen" id="lib-resumen"></div>
  <button type="button" class="lib-btn lib-btn-ancho" data-lib="nuevo">＋ Agregar libro</button>
  <div class="fin-tabs lib-tabs" role="tablist" aria-label="Libros">
    <button type="button" class="fin-tab active" role="tab" data-lib-vista="libros" aria-selected="true">Mis libros</button>
    <button type="button" class="fin-tab" role="tab" data-lib-vista="frases" aria-selected="false">Todas mis frases</button>
  </div>
  <div id="lib-vista-libros">
    <div class="lib-filtros">
      <input type="search" id="lib-buscar" class="lib-input" placeholder="Buscar por título o autor" autocomplete="off" aria-label="Buscar libros">
      <select id="lib-orden" class="lib-input" aria-label="Ordenar">${L.ORDENES.map(o => `<option value="${o.id}">${esc(o.nombre)}</option>`).join("")}</select>
    </div>
    <div class="lib-chips" id="lib-estados" role="group" aria-label="Filtrar por estado"></div>
    <div id="lib-lista"></div>
  </div>
  <div id="lib-vista-frases" hidden>
    <input type="search" id="lib-buscar-frases" class="lib-input" placeholder="Buscar en tus frases" autocomplete="off" aria-label="Buscar frases">
    <button type="button" class="lib-btn-sec lib-btn-ancho lib-mt" data-lib="nueva-frase">＋ Agregar frase</button>
    <div id="lib-frases"></div>
  </div>
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
  if (vista === "libros") { renderEstados(); renderLista(); } else renderFrases();
  if (hoja.abierta() && actual && actual.modo === "ver") ver(actual.id);
}

function renderResumen() {
  const el = $("lib-resumen");
  if (cargados < 2) { el.innerHTML = `<p class="empty-state">Cargando…</p>`; return; }
  const r = L.resumen(libros, hoyLocal());
  el.innerHTML = `
    <div class="lib-cifras">
      <div><b>${r.leyendo}</b><span>leyendo</span></div>
      <div><b>${r.terminadosEsteAnio}</b><span>${r.terminadosEsteAnio === 1 ? "terminado" : "terminados"} en ${hoyLocal().slice(0, 4)}</span></div>
      <div><b>${r.paginasLeidas.toLocaleString("es-ES")}</b><span>páginas leídas</span></div>
    </div>`;
}

function renderEstados() {
  const r = L.resumen(libros, hoyLocal());
  const chips = [{ id: "", nombre: "Todos", n: r.total }].concat(L.ESTADOS.map(e => ({ id: e.id, nombre: e.nombre, n: r[e.id] })));
  $("lib-estados").innerHTML = chips.map(c => `<button type="button" class="lib-filtro${c.id === filtro.estado ? " active" : ""}" data-lib-estado="${c.id}" aria-pressed="${c.id === filtro.estado}">${esc(c.nombre)} <span>${c.n}</span></button>`).join("");
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

// ---------- Hoja: ficha del libro ----------
function ver(id) {
  const l = libros.find(x => x.id === id);
  if (!l) { hoja.cerrar(); return; }
  actual = { modo: "ver", id };
  const fs = L.frasesDe(frases, id);
  const dato = (n, v) => (v ? `<div><dt>${n}</dt><dd>${esc(v)}</dd></div>` : "");
  hoja.abrir(l.titulo, `
      <div class="lib-ficha">
        <div class="lib-ficha-cab">
          <span class="lib-portada is-grande">${tapa(l, true)}</span>
          <div class="lib-ficha-info">
            <h4>${esc(l.titulo)}</h4>
            ${l.autor ? `<p>${esc(l.autor)}</p>` : ""}
            ${chipEstado(l.estado)}
            ${l.calificacion ? `<p class="lib-estrellas is-grande" aria-label="${l.calificacion} de 5">${L.estrellas(l.calificacion)}</p>` : ""}
          </div>
        </div>
        <dl class="lib-datos">
          ${dato("Páginas", l.paginas ? String(l.paginas) : "")}
          ${dato("Registrado", L.fechaLarga(l.fechaRegistro))}
          ${dato("Empezado", l.fechaInicio ? L.fechaLarga(l.fechaInicio) : "")}
          ${dato("Terminado", l.fechaFin ? L.fechaLarga(l.fechaFin) : "")}
        </dl>
        ${l.opinion ? `<h5 class="lib-h">Mi opinión</h5><p class="lib-opinion">${esc(l.opinion)}</p>` : ""}
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
  const v = l || { titulo: "", autor: "", paginas: null, estado: "por_leer", calificacion: null, opinion: "", fechaRegistro: hoyLocal(), fechaInicio: null, fechaFin: null };
  const hoy = hoyLocal();
  const fecha = (name, etiqueta, valor) => `<label class="lib-campo"><span>${etiqueta}</span><input type="date" name="${name}" max="${hoy}" value="${esc(valor || "")}" class="lib-input"></label>`;
  portadaSel = undefined;
  hoja.abrir(l ? "Editar libro" : "Agregar libro", `
      <form class="lib-form lib-form-libro" novalidate>
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
        <label class="lib-campo"><span>Autor</span><input type="text" name="autor" maxlength="150" autocomplete="off" value="${esc(v.autor)}" class="lib-input" placeholder="Ej: Gabriel García Márquez"></label>
        <label class="lib-campo"><span>Páginas (opcional)</span><input type="text" inputmode="numeric" name="paginas" autocomplete="off" value="${esc(v.paginas || "")}" class="lib-input" placeholder="350"></label>
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
  } else if (actual && actual.modo === "frase") {
    const r = L.validarFrase(leer(f), { hoy, libros: libros.map(x => x.id) });
    if (!r.ok) { window.Lectura.errores(f, r.errores); return; }
    if (actual.id) ref("libros_frases").doc(actual.id).update(r.doc).catch(fallo("guardar"));
    else ref("libros_frases").add(Object.assign(r.doc, { creado: Date.now() })).catch(fallo("guardar"));
    if (actual.volver === "ver") ver(r.doc.libroId); else hoja.cerrar();
  }
});

hoja.el.addEventListener("input", e => {
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

hoja.el.addEventListener("click", e => {
  const f = hoja.el.querySelector("form");
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
  if (elegida) { elegirPortada({ tipo: "url", url: elegida.dataset.libElegirPortada }); return; }
  const b = e.target.closest("[data-lib]");
  if (!b || !actual) return;
  const accion = b.dataset.lib;
  if (accion === "buscar-portada") { buscarPortada(); return; }
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
          <button type="button" class="lib-resultado" data-lib-elegir-portada="${esc(x.url)}" title="${esc(`${x.titulo}${x.autor ? ` — ${x.autor}` : ""}${x.anio ? ` (${x.anio})` : ""}`)}">
            <img src="${esc(x.url)}" alt="${esc(x.titulo)}" loading="lazy" decoding="async">
          </button>`).join("");
    })
    .catch(() => mensajePortada("No se pudo buscar (¿estás sin internet?). Puedes subir una foto o intentarlo después."))
    .finally(() => clearTimeout(reloj));
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
    render();
    return;
  }
  const v = e.target.closest("[data-lib-ver]");
  if (v) { ver(v.dataset.libVer); return; }
  const fr = e.target.closest("[data-lib-frase]");
  if (fr) { formFrase(fr.dataset.libFrase, null, null); return; }
  const est = e.target.closest("[data-lib-estado]");
  if (est) { filtro.estado = est.dataset.libEstado; renderEstados(); renderLista(); return; }
  const b = e.target.closest("[data-lib]");
  if (!b) return;
  if (b.dataset.lib === "nuevo") formLibro(null);
  else if (b.dataset.lib === "nueva-frase") {
    if (!libros.length) { alert("Primero agrega un libro."); return; }
    formFrase(null, null, null);
  } else if (b.dataset.lib === "exportar") window.Lectura.descargar(`manolo-libros-${hoyLocal()}.json`, L.exportarJson(librosDocs, frasesDocs, new Date().toISOString(), portadasDocs), "application/json");
});
$("lib-buscar").addEventListener("input", e => { filtro.texto = e.target.value; renderLista(); });
$("lib-orden").addEventListener("change", e => { filtro.orden = e.target.value; renderLista(); });
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
  ref("libros_portadas").onSnapshot(snap => {
    portadasDocs = {};
    snap.docs.forEach(d => { portadasDocs[d.id] = d.data(); });
    if (cargados >= 2 && vista === "libros") renderLista();
    if (hoja.abierta() && actual && actual.modo === "ver") ver(actual.id);
  }, err => console.warn("Libros (portadas):", err));
});
render();
})();
