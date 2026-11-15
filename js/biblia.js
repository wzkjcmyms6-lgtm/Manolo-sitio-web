// ---------- Biblia (sub-panel de Inicio) ----------
// El versículo que Juan lee al despertar: fecha, cita (libro, capítulo y
// versículo), texto y nota. Lista por fecha con filtro y buscador,
// calendario con racha, editar, borrar y exportar.
// Fase 3 (D-106): arriba, la lectura de hoy de tus planes y los versículos
// para repasar; accesos a Planes, Progreso y Memorizar; temas con filtro;
// la racha también cuenta los días con capítulos leídos; Ajustes (el
// versículo de arriba también de tus favoritos).
// Datos en users/{uid}/biblia; la lógica en js/biblia-motor.js.
// Ver docs/LIBROS_BIBLIA.md y docs/LECTURA_NIVEL2.md.
(function () {
// Ícono de la tarjeta de Inicio (mismo trazo que js/icons.js). Se registra
// aquí para no tocar el archivo compartido; renderIcons() corre después.
if (typeof ICONS === "object") {
  ICONS.biblia = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M7 3.5h11a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H7a2.5 2.5 0 0 1-2.5-2.5v-11A2.5 2.5 0 0 1 7 4"/><path d="M4.5 17.5A2.5 2.5 0 0 1 7 15h12"/><path d="M12 6.5v6M9.6 8.8h4.8"/></svg>`;
}

const B = window.BibliaMotor;
const { esc, hoyLocal } = window.Lectura;
const app = document.getElementById("bib-app");
const hoja = window.Lectura.hoja("bib-hoja");

let docs = {};            // id → datos tal como están en Firestore
let lista = [];           // registros normalizados
let cargado = false;
let vista = "lista";      // "lista" | "calendario"
const filtro = { libro: "", texto: "", tema: "" };
let servidor = false;     // la lista ya vino del servidor (no solo de la caché)
let mes = hoyLocal().slice(0, 7);
let diaElegido = null;
let editando = null;      // id que se edita en la hoja (null = nuevo)

const coleccion = () => db.collection("users").doc(currentUser.uid).collection("biblia");
// Días con algún capítulo marcado como leído en el lector (fase 3).
const fechasLeidas = () => (window.BibliaPlanes && window.BibliaLector ? BibliaPlanes.fechasLeidas(BibliaLector.leidos()) : []);
const hojaAjustes = window.Lectura.hoja("bib-hoja-ajustes");

// ---------- Estructura fija (no se repinta al escribir en el buscador) ----------
app.innerHTML = `
  <div class="bib-resumen" id="bib-resumen"></div>
  <div class="fin-tabs bib-tabs" role="tablist" aria-label="Biblia">
    <button type="button" class="fin-tab active" role="tab" data-bib-vista="lista" aria-selected="true">Lista</button>
    <button type="button" class="fin-tab" role="tab" data-bib-vista="calendario" aria-selected="false">Calendario</button>
    <button type="button" class="fin-tab" role="tab" data-bib-vista="marcados" aria-selected="false">Marcados</button>
  </div>
  <div id="bib-lista-vista">
    <div class="bib-filtros">
      <input type="search" id="bib-buscar" class="lib-input" placeholder="Buscar en tus versículos" autocomplete="off" aria-label="Buscar">
      <select id="bib-libro" class="lib-input" aria-label="Filtrar por libro"></select>
      <select id="bib-tema" class="lib-input" aria-label="Filtrar por tema" hidden></select>
    </div>
    <div id="bib-lista"></div>
  </div>
  <div id="bib-cal-vista" hidden></div>
  <div id="bib-marcas-vista" hidden></div>
  <div class="bib-pie">
    <button type="button" class="lib-btn-sec" data-bib="ajustes">⚙ Ajustes</button>
    <button type="button" class="lib-btn-sec" data-bib="exportar">Exportar (JSON)</button>
  </div>`;
const $ = id => document.getElementById(id);

function render() {
  renderResumen();
  if (vista === "lista") { renderFiltroLibros(); renderFiltroTemas(); renderLista(); }
  else if (vista === "calendario") renderCalendario();
  else if (window.BibliaSel) BibliaSel.renderMarcados($("bib-marcas-vista"));
}

function renderResumen() {
  const el = $("bib-resumen");
  if (!cargado) { el.innerHTML = `<p class="empty-state">Cargando…</p>`; return; }
  const leidas = fechasLeidas();
  const r = B.racha(lista, hoyLocal(), leidas);
  const mesNombre = B.MESES[Number(hoyLocal().slice(5, 7)) - 1];
  // La racha cuenta los días con un versículo anotado o un capítulo leído.
  const mensaje = r.anotadoHoy ? "✓ Hoy ya anotaste tu versículo."
    : r.leidoHoy ? "✓ Hoy ya leíste la Biblia. ¿Quieres anotar un versículo?"
    : leidas.length ? (r.actual > 0 ? "Lee un capítulo o anota un versículo para seguir la racha." : "Lee un capítulo o anota el versículo de hoy.")
    : r.actual > 0 ? "Anota el de hoy para seguir la racha." : "¿Qué versículo leíste hoy?";
  el.innerHTML = `
    <div class="bib-racha">
      <div><b>${r.actual > 0 ? "🔥 " : ""}${r.actual}</b><span>${r.actual === 1 ? "día seguido" : "días seguidos"}</span></div>
      <div><b>${r.mejor}</b><span>mejor racha</span></div>
      <div><b>${r.esteMes}</b><span>${r.esteMes === 1 ? "día" : "días"} en ${mesNombre}</span></div>
    </div>
    ${window.BibliaPlanesUI ? BibliaPlanesUI.tarjetasHoy() : ""}
    ${tarjetaLeer()}
    ${window.BibliaMemoriaUI ? BibliaMemoriaUI.tarjetaHoy() : ""}
    <p class="bib-hoy ${r.hoyHecho ? "is-hecho" : ""}">${mensaje}</p>
    <button type="button" class="lib-btn lib-btn-ancho" data-bib="nuevo">＋ ${r.anotadoHoy ? "Otro versículo" : "Anotar versículo"}</button>
    ${accesos()}`;
}

// Planes, Progreso y Memorizar (páginas propias, fase 3).
function accesos() {
  const xs = [];
  if (window.BibliaPlanesUI) xs.push(`<a href="#biblia-planes"><span aria-hidden="true">📅</span>Planes</a>`);
  if (window.BibliaProgresoUI) xs.push(`<a href="#biblia-progreso"><span aria-hidden="true">📊</span>Progreso</a>`);
  if (window.BibliaMemoriaUI) {
    const n = BibliaMemoriaUI.paraHoy();
    xs.push(`<a href="#biblia-memorizar"><span aria-hidden="true">🧠</span>Memorizar${n ? ` <i aria-label="${n} para hoy">${n}</i>` : ""}</a>`);
  }
  return xs.length ? `<nav class="bib-accesos" aria-label="Más de Biblia">${xs.join("")}</nav>` : "";
}

// "Leer la Biblia" / "Seguir leyendo": abre el lector (js/biblia-lector.js).
function tarjetaLeer() {
  const L = window.BibliaLector;
  if (!L) return "";
  const u = L.ultimo();
  const donde = u ? `${B.libro(u.libro).nombre} ${u.cap}` : "";
  return `<button type="button" class="bbl-entrar" data-bib="leer">
      <span class="bbl-entrar-ic" aria-hidden="true">📖</span>
      <span class="bbl-entrar-t"><b>${u ? "Seguir leyendo" : "Leer la Biblia"}</b><small>${u ? `${esc(donde)} · Reina-Valera 1909` : "Reina-Valera 1909, también sin internet"}</small></span>
      <span class="bbl-entrar-flecha" aria-hidden="true">›</span>
    </button>`;
}

function renderFiltroLibros() {
  const sel = $("bib-libro");
  const usados = B.librosUsados(lista);
  if (filtro.libro && !usados.some(l => l.id === filtro.libro)) filtro.libro = "";
  sel.innerHTML = `<option value="">Todos los libros (${lista.length})</option>` +
    usados.map(l => `<option value="${esc(l.id)}"${l.id === filtro.libro ? " selected" : ""}>${esc(l.nombre)} (${l.n})</option>`).join("");
  sel.disabled = !usados.length;
}

function renderFiltroTemas() {
  const sel = $("bib-tema");
  const usados = B.temasUsados(lista);
  if (filtro.tema && !usados.some(t => t.tema === filtro.tema)) filtro.tema = "";
  sel.hidden = !usados.length;
  sel.innerHTML = `<option value="">Todos los temas</option>` +
    usados.map(t => `<option value="${esc(t.tema)}"${t.tema === filtro.tema ? " selected" : ""}>${esc(t.tema)} (${t.n})</option>`).join("");
}

const tarjeta = e => `
      <button type="button" class="bib-item" data-bib-editar="${esc(e.id)}">
        <span class="bib-item-arriba"><b>${esc(e.cita)}${e.version ? ` <i class="bib-version-tag">${esc(e.version)}</i>` : ""}</b><small>${esc(B.fechaLarga(e.fecha))}</small></span>
        <span class="bib-texto">${esc(e.texto)}</span>
        ${e.nota ? `<span class="bib-nota">✍️ ${esc(e.nota)}</span>` : ""}
        ${e.temas && e.temas.length ? `<span class="bib-temas">${e.temas.map(t => `<i>${esc(t)}</i>`).join("")}</span>` : ""}
      </button>`;

function renderLista() {
  const el = $("bib-lista");
  if (!cargado) { el.innerHTML = ""; return; }
  if (!lista.length) { el.innerHTML = `<p class="empty-state">Todavía no anotaste versículos. Toca «Anotar versículo»; también puedes cargar días pasados cambiando la fecha.</p>`; return; }
  const visibles = B.filtrar(lista, filtro);
  if (!visibles.length) { el.innerHTML = `<p class="empty-state">Nada coincide con tu búsqueda.</p>`; return; }
  el.innerHTML = (filtro.texto || filtro.libro || filtro.tema ? `<p class="lib-nota">${visibles.length} de ${lista.length}</p>` : "") +
    B.porMes(visibles).map(g => `
    <section class="bib-mes">
      <h3 class="lib-mes-titulo">${esc(g.titulo)}<span>${g.items.length}</span></h3>
      ${g.items.map(tarjeta).join("")}
    </section>`).join("");
}

function renderCalendario() {
  const el = $("bib-cal-vista");
  const hoy = hoyLocal();
  const c = B.calendario(lista, mes, hoy, fechasLeidas());
  if (!diaElegido) diaElegido = hoy;
  const delDia = B.ordenar(B.filtrar(lista, { fecha: diaElegido }));
  const leidosMes = c.semanas.flat().filter(d => d.enMes && d.leido).length;
  const capsDia = window.BibliaLector && window.BibliaPlanes ? (BibliaLector.leidos()[diaElegido] || []) : [];
  el.innerHTML = `
    <div class="bib-cal">
      <div class="bib-cal-cab">
        <button type="button" class="bib-cal-nav" data-bib-mes="-1" aria-label="Mes anterior">‹</button>
        <b>${esc(c.titulo)}</b>
        <button type="button" class="bib-cal-nav" data-bib-mes="1" aria-label="Mes siguiente"${mes >= hoy.slice(0, 7) ? " disabled" : ""}>›</button>
      </div>
      <div class="bib-cal-grid" role="grid">
        ${["L", "M", "M", "J", "V", "S", "D"].map(d => `<span class="bib-cal-dow">${d}</span>`).join("")}
        ${c.semanas.flat().map(d => `<button type="button" class="bib-cal-dia${d.enMes ? "" : " is-fuera"}${d.n ? " is-hecho" : ""}${d.leido ? " is-leido" : ""}${d.hoy ? " is-hoy" : ""}${d.fecha === diaElegido ? " is-elegido" : ""}" data-bib-dia="${d.fecha}"${d.futuro ? " disabled" : ""} aria-label="${esc(B.fechaLarga(d.fecha))}${d.n ? `: ${d.n} ${d.n === 1 ? "versículo" : "versículos"}` : ""}${d.leido ? `${d.n ? " y" : ":"} capítulos leídos` : ""}">${d.dia}</button>`).join("")}
      </div>
      <p class="lib-nota">${c.dias} ${c.dias === 1 ? "día anotado" : "días anotados"}${leidosMes ? ` · ${leidosMes} ${leidosMes === 1 ? "día" : "días"} con capítulos leídos <span class="bib-cal-punto" aria-hidden="true"></span>` : ""} en ${esc(c.titulo.toLowerCase())}.</p>
    </div>
    <h3 class="lib-mes-titulo">${esc(B.fechaLarga(diaElegido))}</h3>
    ${capsDia.length ? `<p class="bib-cal-leido">📖 Leíste ${esc(BibliaPlanes.texto(BibliaPlanes.ordenClaves(capsDia)))}.</p>` : ""}
    ${delDia.length ? delDia.map(tarjeta).join("") : `<p class="empty-state">Ese día no anotaste versículo.</p>
    <button type="button" class="lib-btn-sec" data-bib="nuevo-dia">＋ Anotar el ${esc(B.fechaLarga(diaElegido))}</button>`}`;
}

// ---------- Hoja: agregar o editar ----------
const opcionesLibros = elegido => ["AT", "NT"].map(t => `
          <optgroup label="${t === "AT" ? "Antiguo Testamento" : "Nuevo Testamento"}">
            ${B.LIBROS.filter(l => l.testamento === t).map(l => `<option value="${l.id}"${l.id === elegido ? " selected" : ""}>${esc(l.nombre)}</option>`).join("")}
          </optgroup>`).join("");
const etiquetaCap = id => (B.libro(id) ? `Capítulo (1 a ${B.libro(id).capitulos})` : "Capítulo");

// Versiones para el campo "Versión del texto" (D-105).
const VERSIONES = [["RV1909", "Reina-Valera 1909"]].concat((window.BibliaTexto ? BibliaTexto.OTRAS : []).map(o => [o.id, o.nombre]), [["Otra", "Otra"]]);
const preferida = () => (window.BibliaLector ? BibliaLector.ajustes().version : "") || "RVR1960";
let auto = { texto: "", timer: null, yo: 0 };   // el último texto que puso Manolo solo

// pre (desde el lector): { libro, capitulo, versiculo, texto, version }.
function abrirHoja(id, fecha, pre) {
  editando = id || null;
  const e = id ? lista.find(x => x.id === id) : null;
  if (id && !e) return;
  const ultimo = B.ordenar(lista)[0];
  const v = e || Object.assign({ fecha: fecha || hoyLocal(), libro: ultimo ? ultimo.libro : "", capitulo: "", versiculo: "", texto: "", nota: "", version: "RV1909" }, pre || {});
  auto = { texto: pre && pre.texto ? pre.texto : "", timer: null, yo: 0 };
  const opciones = (e && !e.version ? [["", "Sin indicar"]] : []).concat(VERSIONES);
  if (v.version && !opciones.some(o => o[0] === v.version)) opciones.push([v.version, v.version]);
  hoja.abrir(e ? "Editar versículo" : "Anotar versículo", `
      <form class="lib-form bib-form" novalidate>
        <label class="lib-campo"><span>Fecha</span><input type="date" name="fecha" max="${hoyLocal()}" value="${esc(v.fecha)}" class="lib-input"></label>
        <label class="lib-campo"><span>Libro</span>
          <select name="libro" class="lib-input">
            <option value=""${v.libro ? "" : " selected"} disabled>Elige el libro</option>
            ${opcionesLibros(v.libro)}
          </select>
        </label>
        <div class="lib-par">
          <label class="lib-campo"><span data-bib-cap>${esc(etiquetaCap(v.libro))}</span><input type="text" inputmode="numeric" name="capitulo" autocomplete="off" placeholder="3" value="${esc(v.capitulo || "")}" class="lib-input"></label>
          <label class="lib-campo"><span>Versículo</span><input type="text" name="versiculo" autocomplete="off" placeholder="16 o 16-18" value="${esc(v.versiculo)}" class="lib-input"></label>
        </div>
        <label class="lib-campo"><span>Texto del versículo</span><textarea name="texto" rows="4" class="lib-input" placeholder="Se completa solo al poner la cita; también puedes pegar el tuyo">${esc(v.texto)}</textarea></label>
        <p class="bib-auto" data-bib-auto${pre && pre.texto ? "" : " hidden"}>${pre && pre.texto ? "✓ Texto de la Reina-Valera 1909." : ""}</p>
        <label class="lib-campo"><span>Versión del texto</span>
          <select name="version" class="lib-input">${opciones.map(o => `<option value="${esc(o[0])}"${o[0] === (v.version || "") ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select>
        </label>
        <label class="lib-campo"><span>Nota personal (opcional)</span><textarea name="nota" rows="2" class="lib-input" placeholder="Lo que te dejó este versículo">${esc(v.nota)}</textarea></label>
        ${camposTemas(v.temas || [])}
        <p class="lib-error" role="alert" hidden></p>
        ${window.BibliaLector ? `<button type="button" class="bib-leer-cita" data-bib="leer-cita">📖 Leer en la Biblia</button>` : ""}
        ${window.BibliaMemoriaUI ? `<button type="button" class="bib-leer-cita" data-bib="memorizar">🧠 Memorizar este versículo</button>` : ""}
        <div class="lib-acciones">
          ${e ? `<button type="button" class="lib-btn-peligro" data-bib="borrar">Eliminar</button>` : ""}
          <button type="submit" class="lib-btn">Guardar</button>
        </div>
      </form>`);
}

// Temas (fase 3): los de siempre, los tuyos y uno nuevo.
function camposTemas(elegidos) {
  const todos = B.TEMAS.concat(B.temasUsados(lista).map(t => t.tema), elegidos).filter((t, i, xs) => xs.indexOf(t) === i);
  return `<fieldset class="lib-campo bib-temas-campo"><legend>Temas (opcional)</legend>
      <div class="bib-chips" role="group" aria-label="Temas">
        ${todos.map(t => `<button type="button" class="bbl-chip${elegidos.includes(t) ? " is-activo" : ""}" data-bib-tema="${esc(t)}" aria-pressed="${elegidos.includes(t)}">${esc(t)}</button>`).join("")}
      </div>
      <input type="text" name="temaOtro" class="lib-input" maxlength="60" autocomplete="off" placeholder="Otro tema (por ejemplo: trabajo)" aria-label="Otro tema">
    </fieldset>`;
}
const temasDelForm = f => Array.from(f.querySelectorAll("[data-bib-tema].is-activo")).map(b => b.dataset.bibTema)
  .concat(String(f.elements.temaOtro ? f.elements.temaOtro.value : "").split(","));

hoja.el.addEventListener("change", e => {
  if (e.target.name === "libro") hoja.el.querySelector("[data-bib-cap]").textContent = etiquetaCap(e.target.value);
  if (["libro", "capitulo", "versiculo"].includes(e.target.name)) textoAuto();
});
// El texto se completa solo con la RV1909 al poner libro, capítulo y
// versículo (si el campo está vacío o tiene el que puso Manolo antes).
function textoAuto() {
  clearTimeout(auto.timer);
  auto.timer = setTimeout(() => {
    const f = hoja.el.querySelector(".bib-form");
    const T = window.BibliaTexto, L = window.BibliaLector;
    if (!f || !T || !L) return;
    const l = B.libro(f.elements.libro.value);
    const cap = Number(f.elements.capitulo.value);
    const vers = B.versiculoNormal(f.elements.versiculo.value);
    const aviso = f.querySelector("[data-bib-auto]");
    if (!l || !(cap >= 1 && cap <= l.capitulos) || !vers) return;
    const yo = ++auto.yo;
    L.cargarLibro(l.id).then(datos => {
      if (yo !== auto.yo || !f.isConnected) return;
      const ta = f.elements.texto;
      const t = T.textoCita(datos, cap, vers, { actual: L.ajustes().actual });
      if (!t) {
        const n = (datos.caps[cap - 1] || []).length;
        aviso.textContent = `${l.nombre} ${cap} tiene ${n} versículos.`;
        aviso.classList.add("is-aviso");
        aviso.hidden = false;
        return;
      }
      if (ta.value.trim() && ta.value !== auto.texto) return;   // lo escribiste tú: no se toca
      ta.value = t;
      auto.texto = t;
      f.elements.version.value = "RV1909";
      aviso.textContent = "✓ Texto de la Reina-Valera 1909. Puedes cambiarlo o pegar el de tu versión.";
      aviso.classList.remove("is-aviso");
      aviso.hidden = false;
      if (ta.classList.contains("is-error")) { ta.classList.remove("is-error"); ta.removeAttribute("aria-invalid"); }
    }).catch(() => { /* sin internet y sin descargar: se escribe a mano */ });
  }, 250);
}
// Al corregir un campo marcado, se le quita la marca; sin marcas, se va el aviso.
hoja.el.addEventListener("input", e => {
  if (["capitulo", "versiculo"].includes(e.target.name)) textoAuto();
  // Texto propio (pegado de otra Biblia): se propone tu versión de siempre.
  if (e.target.name === "texto" && e.target.value !== auto.texto && e.target.form.elements.version.value === "RV1909") {
    e.target.form.elements.version.value = preferida();
    const aviso = e.target.form.querySelector("[data-bib-auto]");
    aviso.textContent = "Texto tuyo: elige de qué versión es.";
    aviso.classList.add("is-aviso");
    aviso.hidden = false;
  }
  if (!e.target.classList.contains("is-error")) return;
  e.target.classList.remove("is-error");
  e.target.removeAttribute("aria-invalid");
  const f = e.target.form;
  if (f && !f.querySelector(".is-error")) f.querySelector(".lib-error").hidden = true;
});
hoja.el.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target;
  const datos = {};
  Array.from(f.elements).forEach(el => { if (el.name && el.name !== "temaOtro") datos[el.name] = el.value; });
  datos.temas = temasDelForm(f);
  const r = B.validar(datos, { hoy: hoyLocal() });
  if (!r.ok) { window.Lectura.errores(f, r.errores); return; }
  const fallo = err => alert(`No se pudo guardar: ${err && err.message ? err.message : err}`);
  // Al editar y quitar todos los temas, se borra el campo.
  if (editando && !r.doc.temas && docs[editando] && docs[editando].temas) r.doc.temas = firebase.firestore.FieldValue.delete();
  if (editando) coleccion().doc(editando).update(r.doc).catch(fallo);
  else coleccion().add(Object.assign(r.doc, { creado: Date.now() })).catch(fallo);
  if (vista === "calendario") { diaElegido = r.doc.fecha; mes = r.doc.fecha.slice(0, 7); }
  hoja.cerrar();
});
hoja.el.addEventListener("click", e => {
  const tema = e.target.closest("[data-bib-tema]");
  if (tema) {
    const on = !tema.classList.contains("is-activo");
    tema.classList.toggle("is-activo", on);
    tema.setAttribute("aria-pressed", String(on));
    return;
  }
  const mem = e.target.closest('[data-bib="memorizar"]');
  if (mem) {
    const f = hoja.el.querySelector(".bib-form");
    const l = B.libro(f.elements.libro.value);
    const cap = Number(f.elements.capitulo.value);
    const vers = B.versiculoNormal(f.elements.versiculo.value);
    const texto = f.elements.texto.value.trim();
    if (!l || !(cap >= 1 && cap <= l.capitulos) || !vers || !texto) {
      window.Lectura.errores(f, [{ campo: !l ? "libro" : !(cap >= 1 && cap <= l.capitulos) ? "capitulo" : !vers ? "versiculo" : "texto", texto: "Completa la cita y el texto para memorizarlo." }]);
      return;
    }
    const r = BibliaMemoriaUI.agregar({ libro: l.id, cap, vers, texto, version: f.elements.version.value });
    if (r === "cargando") { mem.textContent = "🧠 Un momento: vuelve a tocar"; return; }
    mem.textContent = r === "ya" ? "🧠 Ya está en Memorizar" : "✓ Agregado a Memorizar";
    mem.disabled = true;
    return;
  }
  if (e.target.closest('[data-bib="leer-cita"]')) {
    const f = hoja.el.querySelector(".bib-form");
    const l = B.libro(f.elements.libro.value);
    const cap = Number(f.elements.capitulo.value);
    if (!l || !(cap >= 1 && cap <= l.capitulos)) { window.Lectura.errores(f, [{ campo: l ? "capitulo" : "libro", texto: "Elige el libro y el capítulo para leerlo." }]); return; }
    const nums = window.BibliaTexto.numeros(f.elements.versiculo.value) || [];
    hoja.cerrar();
    window.BibliaLector.abrir(l.id, cap, { marcar: nums });
    return;
  }
  if (!e.target.closest('[data-bib="borrar"]') || !editando) return;
  const reg = lista.find(x => x.id === editando);
  if (!confirm(`¿Eliminar ${reg ? reg.cita : "este versículo"}${reg ? ` del ${B.fechaLarga(reg.fecha)}` : ""}? No se puede deshacer.`)) return;
  coleccion().doc(editando).delete().catch(err => alert(`No se pudo eliminar: ${err && err.message ? err.message : err}`));
  hoja.cerrar();
});

// ---------- Acciones de la sección ----------
app.addEventListener("click", e => {
  const t = e.target.closest("[data-bib-vista]");
  if (t) {
    vista = t.dataset.bibVista;
    app.querySelectorAll("[data-bib-vista]").forEach(b => { const on = b === t; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
    $("bib-lista-vista").hidden = vista !== "lista";
    $("bib-cal-vista").hidden = vista !== "calendario";
    $("bib-marcas-vista").hidden = vista !== "marcados";
    render();
    return;
  }
  const ed = e.target.closest("[data-bib-editar]");
  if (ed) { abrirHoja(ed.dataset.bibEditar); return; }
  const dia = e.target.closest("[data-bib-dia]");
  if (dia) { diaElegido = dia.dataset.bibDia; if (!diaElegido.startsWith(mes)) mes = diaElegido.slice(0, 7); renderCalendario(); return; }
  const m = e.target.closest("[data-bib-mes]");
  if (m) { mes = B.mesSiguiente(mes, Number(m.dataset.bibMes)); renderCalendario(); return; }
  const b = e.target.closest("[data-bib]");
  if (!b) return;
  if (b.dataset.bib === "leer") { const u = window.BibliaLector.ultimo(); window.BibliaLector.abrir(u ? u.libro : null, u ? u.cap : null); }
  else if (b.dataset.bib === "nuevo") abrirHoja(null);
  else if (b.dataset.bib === "nuevo-dia") abrirHoja(null, diaElegido);
  else if (b.dataset.bib === "ajustes") abrirAjustes();
  else if (b.dataset.bib === "exportar") {
    // Con lo del lector: resaltados, favoritos, notas y capítulos leídos.
    const extras = {
      marcas: window.BibliaSel ? BibliaSel.crudos() : {},
      leidos: window.BibliaLector ? BibliaLector.leidos() : {},
      lector: window.BibliaLector ? BibliaLector.ajustes() : null,
      planes: window.BibliaPlanesUI ? BibliaPlanesUI.crudos() : {},
      memoria: window.BibliaMemoriaUI ? BibliaMemoriaUI.crudos() : {}
    };
    window.Lectura.descargar(`manolo-biblia-${hoyLocal()}.json`, B.exportarJson(docs, new Date().toISOString(), extras), "application/json");
  }
});
// ---------- Ajustes (fase 3) ----------
function abrirAjustes() {
  const L = window.BibliaLector;
  if (!L) return;
  const n = window.BibliaSel ? BibliaSel.favoritos().length : 0;
  hojaAjustes.abrir("Ajustes de Biblia", `
    <label class="bbl-aa-fila bbl-switch">
      <span>Versículo de arriba: también de tus favoritos<small>En Inicio, un día sale uno de tus ★ favoritos de la Biblia y otro, uno de la lista de siempre.</small></span>
      <input type="checkbox" data-bib-favarriba${L.ajustes().favArriba ? " checked" : ""}>
    </label>
    <p class="lib-nota">${n ? `Tienes ${n} ${n === 1 ? "favorito" : "favoritos"}.` : "Todavía no tienes favoritos: en «Leer la Biblia», toca un versículo › ★ Favorito."}</p>
    <p class="lib-nota">La letra y la ortografía del texto se cambian en el lector, con «Aa».</p>`);
}
hojaAjustes.el.addEventListener("change", e => {
  if (e.target.matches("[data-bib-favarriba]") && window.BibliaLector) BibliaLector.guardar({ favArriba: e.target.checked });
});

// ---------- Hábitos: "se marca solo" (D-085) ----------
// Los días con capítulos leídos cuentan como una lectura más (D-106). Solo
// se deshace algo si la lista y los capítulos leídos vinieron del servidor.
let firmaLeidos = null;
function avisarFuente(forzar) {
  if (!cargado) return;
  const L = window.BibliaLector;
  const dias = L ? L.leidos() : {};
  const leidos = Object.keys(dias).filter(f => (dias[f] || []).length).sort();
  const est = L && L.leidosEstado ? L.leidosEstado() : { cargado: true, servidor: true };
  // También avisa cuando lo leído termina de llegar del servidor.
  const firma = `${leidos.join(",")}|${est.cargado}|${est.servidor}`;
  if (!forzar && firma === firmaLeidos) return;
  firmaLeidos = firma;
  const datos = lista.concat(leidos.map(f => ({ fecha: f, leido: true })));
  window.dispatchEvent(new CustomEvent("manolo:fuente", { detail: { fuente: "biblia", datos, servidor: servidor && est.cargado && est.servidor } }));
}

window.addEventListener("biblia:lector", () => {
  if (!cargado) return;
  renderResumen();
  if (vista === "calendario") renderCalendario();
  avisarFuente(false);
});
window.addEventListener("biblia:planes", () => { if (cargado) renderResumen(); });
window.addEventListener("biblia:memoria", () => { if (cargado) renderResumen(); });
// "Anotar" desde el lector: el formulario de siempre con la cita y el texto puestos.
window.BibliaAnotar = { abrir: pre => abrirHoja(null, null, pre) };
$("bib-buscar").addEventListener("input", e => { filtro.texto = e.target.value; renderLista(); });
$("bib-libro").addEventListener("change", e => { filtro.libro = e.target.value; renderLista(); });
$("bib-tema").addEventListener("change", e => { filtro.tema = e.target.value; renderLista(); });

// ---------- Datos ----------
onAuthReady(() => {
  coleccion().onSnapshot(snap => {
    docs = {};
    snap.docs.forEach(d => { docs[d.id] = d.data(); });
    lista = Object.keys(docs).map(id => B.normalizarDoc(id, docs[id]));
    cargado = true;
    servidor = !(snap.metadata && snap.metadata.fromCache);
    // Hábitos: "se marca solo" al anotar una lectura (js/habitos-auto.js).
    avisarFuente(true);
    render();
  }, err => console.warn("Biblia:", err));
});
render();
})();
