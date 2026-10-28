// ---------- Biblia (sub-panel de Inicio) ----------
// El versículo que Juan lee al despertar: fecha, cita (libro, capítulo y
// versículo), texto y nota. Lista por fecha con filtro y buscador,
// calendario con racha, editar, borrar y exportar.
// Datos en users/{uid}/biblia; la lógica en js/biblia-motor.js.
// Ver docs/LIBROS_BIBLIA.md.
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
const filtro = { libro: "", texto: "" };
let mes = hoyLocal().slice(0, 7);
let diaElegido = null;
let editando = null;      // id que se edita en la hoja (null = nuevo)

const coleccion = () => db.collection("users").doc(currentUser.uid).collection("biblia");

// ---------- Estructura fija (no se repinta al escribir en el buscador) ----------
app.innerHTML = `
  <div class="bib-resumen" id="bib-resumen"></div>
  <div class="fin-tabs bib-tabs" role="tablist" aria-label="Biblia">
    <button type="button" class="fin-tab active" role="tab" data-bib-vista="lista" aria-selected="true">Lista</button>
    <button type="button" class="fin-tab" role="tab" data-bib-vista="calendario" aria-selected="false">Calendario</button>
  </div>
  <div id="bib-lista-vista">
    <div class="bib-filtros">
      <input type="search" id="bib-buscar" class="lib-input" placeholder="Buscar en tus versículos" autocomplete="off" aria-label="Buscar">
      <select id="bib-libro" class="lib-input" aria-label="Filtrar por libro"></select>
    </div>
    <div id="bib-lista"></div>
  </div>
  <div id="bib-cal-vista" hidden></div>
  <button type="button" class="lib-btn-sec lib-exportar" data-bib="exportar">Exportar (JSON)</button>`;
const $ = id => document.getElementById(id);

function render() {
  renderResumen();
  if (vista === "lista") { renderFiltroLibros(); renderLista(); } else renderCalendario();
}

function renderResumen() {
  const el = $("bib-resumen");
  if (!cargado) { el.innerHTML = `<p class="empty-state">Cargando…</p>`; return; }
  const r = B.racha(lista, hoyLocal());
  const mesNombre = B.MESES[Number(hoyLocal().slice(5, 7)) - 1];
  el.innerHTML = `
    <div class="bib-racha">
      <div><b>${r.actual > 0 ? "🔥 " : ""}${r.actual}</b><span>${r.actual === 1 ? "día seguido" : "días seguidos"}</span></div>
      <div><b>${r.mejor}</b><span>mejor racha</span></div>
      <div><b>${r.esteMes}</b><span>${r.esteMes === 1 ? "día" : "días"} en ${mesNombre}</span></div>
    </div>
    <p class="bib-hoy ${r.hoyHecho ? "is-hecho" : ""}">${r.hoyHecho ? "✓ Hoy ya anotaste tu versículo." : r.actual > 0 ? "Anota el de hoy para seguir la racha." : "¿Qué versículo leíste hoy?"}</p>
    <button type="button" class="lib-btn lib-btn-ancho" data-bib="nuevo">＋ ${r.hoyHecho ? "Otro versículo" : "Anotar versículo"}</button>`;
}

function renderFiltroLibros() {
  const sel = $("bib-libro");
  const usados = B.librosUsados(lista);
  if (filtro.libro && !usados.some(l => l.id === filtro.libro)) filtro.libro = "";
  sel.innerHTML = `<option value="">Todos los libros (${lista.length})</option>` +
    usados.map(l => `<option value="${esc(l.id)}"${l.id === filtro.libro ? " selected" : ""}>${esc(l.nombre)} (${l.n})</option>`).join("");
  sel.disabled = !usados.length;
}

const tarjeta = e => `
      <button type="button" class="bib-item" data-bib-editar="${esc(e.id)}">
        <span class="bib-item-arriba"><b>${esc(e.cita)}</b><small>${esc(B.fechaLarga(e.fecha))}</small></span>
        <span class="bib-texto">${esc(e.texto)}</span>
        ${e.nota ? `<span class="bib-nota">✍️ ${esc(e.nota)}</span>` : ""}
      </button>`;

function renderLista() {
  const el = $("bib-lista");
  if (!cargado) { el.innerHTML = ""; return; }
  if (!lista.length) { el.innerHTML = `<p class="empty-state">Todavía no anotaste versículos. Toca «Anotar versículo»; también puedes cargar días pasados cambiando la fecha.</p>`; return; }
  const visibles = B.filtrar(lista, filtro);
  if (!visibles.length) { el.innerHTML = `<p class="empty-state">Nada coincide con tu búsqueda.</p>`; return; }
  el.innerHTML = (filtro.texto || filtro.libro ? `<p class="lib-nota">${visibles.length} de ${lista.length}</p>` : "") +
    B.porMes(visibles).map(g => `
    <section class="bib-mes">
      <h3 class="lib-mes-titulo">${esc(g.titulo)}<span>${g.items.length}</span></h3>
      ${g.items.map(tarjeta).join("")}
    </section>`).join("");
}

function renderCalendario() {
  const el = $("bib-cal-vista");
  const hoy = hoyLocal();
  const c = B.calendario(lista, mes, hoy);
  if (!diaElegido) diaElegido = hoy;
  const delDia = B.ordenar(B.filtrar(lista, { fecha: diaElegido }));
  el.innerHTML = `
    <div class="bib-cal">
      <div class="bib-cal-cab">
        <button type="button" class="bib-cal-nav" data-bib-mes="-1" aria-label="Mes anterior">‹</button>
        <b>${esc(c.titulo)}</b>
        <button type="button" class="bib-cal-nav" data-bib-mes="1" aria-label="Mes siguiente"${mes >= hoy.slice(0, 7) ? " disabled" : ""}>›</button>
      </div>
      <div class="bib-cal-grid" role="grid">
        ${["L", "M", "M", "J", "V", "S", "D"].map(d => `<span class="bib-cal-dow">${d}</span>`).join("")}
        ${c.semanas.flat().map(d => `<button type="button" class="bib-cal-dia${d.enMes ? "" : " is-fuera"}${d.n ? " is-hecho" : ""}${d.hoy ? " is-hoy" : ""}${d.fecha === diaElegido ? " is-elegido" : ""}" data-bib-dia="${d.fecha}"${d.futuro ? " disabled" : ""} aria-label="${esc(B.fechaLarga(d.fecha))}${d.n ? `: ${d.n} ${d.n === 1 ? "versículo" : "versículos"}` : ""}">${d.dia}</button>`).join("")}
      </div>
      <p class="lib-nota">${c.dias} ${c.dias === 1 ? "día anotado" : "días anotados"} en ${esc(c.titulo.toLowerCase())}.</p>
    </div>
    <h3 class="lib-mes-titulo">${esc(B.fechaLarga(diaElegido))}</h3>
    ${delDia.length ? delDia.map(tarjeta).join("") : `<p class="empty-state">Ese día no anotaste versículo.</p>
    <button type="button" class="lib-btn-sec" data-bib="nuevo-dia">＋ Anotar el ${esc(B.fechaLarga(diaElegido))}</button>`}`;
}

// ---------- Hoja: agregar o editar ----------
const opcionesLibros = elegido => ["AT", "NT"].map(t => `
          <optgroup label="${t === "AT" ? "Antiguo Testamento" : "Nuevo Testamento"}">
            ${B.LIBROS.filter(l => l.testamento === t).map(l => `<option value="${l.id}"${l.id === elegido ? " selected" : ""}>${esc(l.nombre)}</option>`).join("")}
          </optgroup>`).join("");
const etiquetaCap = id => (B.libro(id) ? `Capítulo (1 a ${B.libro(id).capitulos})` : "Capítulo");

function abrirHoja(id, fecha) {
  editando = id || null;
  const e = id ? lista.find(x => x.id === id) : null;
  if (id && !e) return;
  const ultimo = B.ordenar(lista)[0];
  const v = e || { fecha: fecha || hoyLocal(), libro: ultimo ? ultimo.libro : "", capitulo: "", versiculo: "", texto: "", nota: "" };
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
        <label class="lib-campo"><span>Texto del versículo</span><textarea name="texto" rows="4" class="lib-input" placeholder="Escríbelo o pégalo">${esc(v.texto)}</textarea></label>
        <label class="lib-campo"><span>Nota personal (opcional)</span><textarea name="nota" rows="2" class="lib-input" placeholder="Lo que te dejó este versículo">${esc(v.nota)}</textarea></label>
        <p class="lib-error" role="alert" hidden></p>
        <div class="lib-acciones">
          ${e ? `<button type="button" class="lib-btn-peligro" data-bib="borrar">Eliminar</button>` : ""}
          <button type="submit" class="lib-btn">Guardar</button>
        </div>
      </form>`);
}

hoja.el.addEventListener("change", e => {
  if (e.target.name === "libro") hoja.el.querySelector("[data-bib-cap]").textContent = etiquetaCap(e.target.value);
});
// Al corregir un campo marcado, se le quita la marca; sin marcas, se va el aviso.
hoja.el.addEventListener("input", e => {
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
  Array.from(f.elements).forEach(el => { if (el.name) datos[el.name] = el.value; });
  const r = B.validar(datos, { hoy: hoyLocal() });
  if (!r.ok) { window.Lectura.errores(f, r.errores); return; }
  const fallo = err => alert(`No se pudo guardar: ${err && err.message ? err.message : err}`);
  if (editando) coleccion().doc(editando).update(r.doc).catch(fallo);
  else coleccion().add(Object.assign(r.doc, { creado: Date.now() })).catch(fallo);
  if (vista === "calendario") { diaElegido = r.doc.fecha; mes = r.doc.fecha.slice(0, 7); }
  hoja.cerrar();
});
hoja.el.addEventListener("click", e => {
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
  if (b.dataset.bib === "nuevo") abrirHoja(null);
  else if (b.dataset.bib === "nuevo-dia") abrirHoja(null, diaElegido);
  else if (b.dataset.bib === "exportar") window.Lectura.descargar(`manolo-biblia-${hoyLocal()}.json`, B.exportarJson(docs, new Date().toISOString()), "application/json");
});
$("bib-buscar").addEventListener("input", e => { filtro.texto = e.target.value; renderLista(); });
$("bib-libro").addEventListener("change", e => { filtro.libro = e.target.value; renderLista(); });

// ---------- Datos ----------
onAuthReady(() => {
  coleccion().onSnapshot(snap => {
    docs = {};
    snap.docs.forEach(d => { docs[d.id] = d.data(); });
    lista = Object.keys(docs).map(id => B.normalizarDoc(id, docs[id]));
    cargado = true;
    render();
  }, err => console.warn("Biblia:", err));
});
render();
})();
