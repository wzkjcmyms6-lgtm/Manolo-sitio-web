// ---------- Libros: "¿Cuántas páginas tiene tu libro?" (nivel 3, fase 2, D-130) ----------
// Al elegir un libro en "Buscar el libro", debajo de "Páginas" aparecen las
// ediciones en español agrupadas por largo ("326–338 págs. · 4 ediciones")
// con la recomendada ya puesta; con el código de barras (ISBN), tu edición
// exacta. Tocar otra cambia las páginas (y la portada, si era la de la
// búsqueda). Si escribes las páginas a mano, mandan las tuyas.
// También: "¿Para cuándo lo quieres terminar?" (páginas por día) en la ficha.
// Lógica: js/libros-fuentes.js y js/libros-progreso.js.
(function () {
"use strict";
const F = window.LibrosFuentes, L = window.LibrosMotor, P = window.LibrosProgreso;
if (!F || !L || !P) return;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const VISIBLES = 4;
let turno = 0;   // para ignorar respuestas de una búsqueda anterior

function pedir(url, corte) {
  const reloj = setTimeout(() => corte && corte.abort(), 12000);
  return fetch(url, corte ? { signal: corte.signal } : {})
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null)
    .finally(() => clearTimeout(reloj));
}

const caja = f => f && f.querySelector("[data-lib-ediciones]");
function poner(f, ed, paginas) {
  if (paginas) f.elements.paginas.value = String(paginas);
  f.elements.edicionKey.value = (ed && ed.key) || "";
  f.elements.edicionEditorial.value = (ed && ed.editorial) || "";
  f.elements.edicionAnio.value = (ed && ed.anio) || "";
  f.elements.edicionFormato.value = (ed && ed.formato) || "";
  f.dataset.paginasEdicion = paginas ? String(paginas) : "";
}

function opcionHtml(i, paginas, titulo, detalle, elegida, nota) {
  return `<button type="button" class="lib-ed${elegida ? " is-on" : ""}" role="radio" aria-checked="${elegida}" data-lib-ed="${i}">
      <b>${esc(paginas)} págs.</b>${nota ? `<span class="lib-ed-nota">${esc(nota)}</span>` : ""}
      <span class="lib-ed-t">${esc(titulo)}</span>${detalle ? `<small>${esc(detalle)}</small>` : ""}
    </button>`;
}

// libro: el resultado elegido ({ olKey, edicionKey, paginas = mediana, … });
// o: { isbn, alElegir(edicion) } (alElegir: para cambiar la portada).
function mostrar(f, libro, o) {
  const c = caja(f);
  if (!c || !libro) return Promise.resolve(null);
  o = o || {};
  const mio = ++turno;
  const corte = typeof AbortController === "function" ? new AbortController() : null;
  c.hidden = false;
  c.innerHTML = `<p class="lib-ayuda">Buscando las páginas de las ediciones en español…</p>`;
  delete f.dataset.paginasAMano;
  const ediciones = [];
  const isbnUrl = o.isbn ? F.urlIsbn(o.isbn) : null;
  const pedidos = [isbnUrl ? pedir(isbnUrl, corte) : Promise.resolve(null)];
  // Primera página de ediciones; si es una obra con cientos y casi no hay en
  // español, se piden más (hasta 300).
  const todas = (async () => {
    let desde = 0, ok = false;
    for (let i = 0; i < 3; i++) {
      const url = F.urlEdiciones(libro.olKey, desde);
      if (!url) break;
      const j = await pedir(url, corte);
      if (!j || mio !== turno) break;
      ok = true;
      ediciones.push(...F.leerEdiciones(j));
      desde += 100;
      if (!F.pedirMas(j, desde, ediciones.filter(e => F.enEspanol(e) && e.paginas).length)) break;
    }
    return ok;
  })();
  pedidos.push(todas);
  return Promise.all(pedidos).then(async ([jIsbn, okEds]) => {
    if (mio !== turno || !f.isConnected) return null;
    const exacta = jIsbn ? F.leerEdicion(jIsbn) : null;
    let deBusqueda = null;
    if (!F.gruposDePaginas(ediciones).length && !(exacta && exacta.paginas) && libro.edicionKey) {
      const j = await pedir(F.urlEdicion(libro.edicionKey), corte);
      if (mio !== turno || !f.isConnected) return null;
      deBusqueda = j ? F.leerEdicion(j) : null;
    }
    const r = F.recomendar(ediciones, { exacta, deBusqueda, mediana: libro.paginas });
    pintar(f, r, okEds || !!jIsbn, o);
    return r;
  });
}

function pintar(f, r, huboRespuesta, o) {
  const c = caja(f);
  const opciones = [];
  if (r.razon === "isbn") opciones.push({ paginas: r.paginas, edicion: r.edicion, titulo: "Tu edición (por el código de barras)", detalle: F.textoEdicion(r.edicion), nota: "Exacta" });
  else if (r.razon === "busqueda") opciones.push({ paginas: r.paginas, edicion: r.edicion, titulo: "La edición en español que encontré", detalle: F.textoEdicion(r.edicion), nota: "Recomendada" });
  r.grupos.forEach((g, i) => {
    const rango = g.min === g.max ? `${g.n} ${g.n === 1 ? "edición" : "ediciones"}` : `De ${g.min} a ${g.max} págs. · ${g.n} ediciones`;
    const quienes = g.ediciones.slice(0, 3).map(e => [e.editorial, e.anio].filter(Boolean).join(" ")).filter(Boolean).join(" · ");
    opciones.push({ paginas: g.paginas, edicion: g.edicion, titulo: `${rango}${g.especial ? " (edición especial)" : ""}`, detalle: quienes,
      nota: r.razon !== "isbn" && i === 0 ? "Recomendada" : "" });
  });
  f._ediciones = opciones;
  if (!opciones.length) {
    c.innerHTML = r.paginas
      ? `<p class="lib-ayuda">${huboRespuesta ? "No encontré las páginas de las ediciones en español" : "No pude ver las ediciones (¿estás sin internet?)"}: puse ${esc(r.paginas)} (de otras ediciones, aproximado). Mira la última página de tu libro y corrígelo si hace falta.</p>`
      : `<p class="lib-ayuda">No encontré las páginas de este libro: escríbelas mirando la última página de tu libro.</p>`;
    return;
  }
  // La recomendada queda puesta (salvo que ya hayas escrito las páginas a mano).
  const elegida = f.dataset.paginasAMano ? -1 : 0;
  if (elegida === 0) { poner(f, opciones[0].edicion, opciones[0].paginas); if (o.alElegir) o.alElegir(opciones[0].edicion); }
  c.innerHTML = `<p class="lib-ed-pregunta"><b>¿Cuántas páginas tiene tu libro?</b> Cambia según la edición:</p>
    <div class="lib-ed-lista" role="radiogroup" aria-label="Edición">
      ${opciones.map((x, i) => (i < VISIBLES ? opcionHtml(i, x.paginas, x.titulo, x.detalle, i === elegida, x.nota) : "")).join("")}
    </div>
    ${opciones.length > VISIBLES ? `<button type="button" class="lib-btn-sec lib-btn-chico" data-lib-ed-mas>Ver ${opciones.length - VISIBLES} más</button>` : ""}
    <p class="lib-ayuda">¿No es ninguna? Escribe las páginas arriba: mira el número de la última página de tu libro.</p>`;
}

// Clics dentro del formulario (los delega js/libros.js). true = era de aquí.
function click(e, f, o) {
  const mas = e.target.closest("[data-lib-ed-mas]");
  if (mas && f._ediciones) {
    const lista = caja(f).querySelector(".lib-ed-lista");
    const on = f._ediciones.findIndex(x => String(x.paginas) === f.elements.paginas.value && (x.edicion && x.edicion.key) === (f.elements.edicionKey.value || (x.edicion && x.edicion.key)));
    lista.innerHTML = f._ediciones.map((x, i) => opcionHtml(i, x.paginas, x.titulo, x.detalle, i === on && !f.dataset.paginasAMano, x.nota)).join("");
    mas.remove();
    return true;
  }
  const b = e.target.closest("[data-lib-ed]");
  if (!b || !f._ediciones) return false;
  const x = f._ediciones[Number(b.dataset.libEd)];
  if (!x) return true;
  delete f.dataset.paginasAMano;
  poner(f, x.edicion, x.paginas);
  caja(f).querySelectorAll("[data-lib-ed]").forEach(y => { const on = y === b; y.classList.toggle("is-on", on); y.setAttribute("aria-checked", String(on)); });
  if (o && o.alElegir) o.alElegir(x.edicion);
  return true;
}
// Escribiste las páginas a mano: mandan las tuyas (y ya no es esa edición).
function aMano(f) {
  if (!caja(f) || f.elements.paginas.value === (f.dataset.paginasEdicion || "")) return;
  f.dataset.paginasAMano = "1";
  poner(f, null, null);
  caja(f).querySelectorAll("[data-lib-ed]").forEach(y => { y.classList.remove("is-on"); y.setAttribute("aria-checked", "false"); });
}
function limpiar(f) {
  turno++;
  const c = caja(f);
  if (c) { c.hidden = true; c.innerHTML = ""; }
  if (f) delete f._ediciones;
}

// ---- Ficha: "¿Para cuándo lo quieres terminar?" (páginas por día) ----
const fechaCorta = f => new Date(f + "T12:00:00").toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" });
const unidad = (r, n) => (r.unidad === "pct" ? `${n} % por día` : `${n} ${n === 1 ? "página" : "páginas"} por día`);
function metaFin(l, hoy) {
  if (l.estado !== "leyendo") return "";
  const r = l.metaFin ? P.paraTerminar(l, l.metaFin, hoy) : null;
  const opciones = P.sugerenciasFin(l, hoy);
  if (!r && !opciones.length) return "";
  const chips = `<div class="lib-fin-chips">${opciones.map(s => `<button type="button" class="lib-btn-sec lib-btn-chico" data-lib-fin="${s.fecha}">${esc(s.nombre)} · ${esc(unidad(s, s.porDia))}</button>`).join("")}
      <label class="lib-btn-sec lib-btn-chico lib-fin-otra">Otra fecha<input type="date" data-lib-fin-fecha min="${hoy}" aria-label="Otra fecha para terminarlo"></label></div>`;
  if (r && !r.vencida) {
    return `<div class="lib-fin" data-lib-fin-caja><p>🎯 Para terminarlo el <b>${esc(fechaCorta(r.fecha))}</b>: <b>${esc(unidad(r, r.porDia))}</b></p>
      <button type="button" class="lib-btn-sec lib-btn-chico" data-lib-fin-cambiar>Cambiar</button>
      <div hidden data-lib-fin-mas>${chips}<button type="button" class="lib-btn-sec lib-btn-chico" data-lib-fin="">Quitar la meta</button></div></div>`;
  }
  return `<div class="lib-fin" data-lib-fin-caja><p>${r && r.vencida ? `Tu meta era terminarlo el ${esc(fechaCorta(r.fecha))}. ¿Nueva fecha?` : "¿Para cuándo lo quieres terminar?"}</p>${chips}</div>`;
}
const finSuelto = (l, hoy) => {
  const r = l.estado === "leyendo" && l.metaFin ? P.paraTerminar(l, l.metaFin, hoy) : null;
  return r && !r.vencida ? `Para el ${fechaCorta(r.fecha)}: ${unidad(r, r.porDia)}` : "";
};

window.LibrosEdicionesUI = { mostrar, click, aMano, limpiar, metaFin, finSuelto };
})();
