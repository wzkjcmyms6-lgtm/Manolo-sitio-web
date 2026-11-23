// ---------- Ropa: el ropero y la ficha de cada prenda (D-146) ----------
// Sub-panel de Inicio (#ropa). El ropero: cuántas tienes, buscar, grupos,
// filtros en chips (color, clima, formalidad, orden, para lavar) y la grilla
// de fotos; abajo, las que ya no tienes. La ficha (#ropa-prenda/{id}): foto,
// datos, cuántas veces te la pusiste, "Me la puse hoy", para lavar, ya no la
// tengo, editar y borrar (con Deshacer). Agregar y editar: js/ropa-form.js
// (el "+" de la barra de Ropa). Inspiración: js/ropa-insp.js.
// Datos: js/ropa-datos.js; lógica: js/ropa-motor.js.
(function () {
"use strict";
// Íconos (mismo trazo que js/icons.js); se registran antes de renderIcons().
if (typeof ICONS === "object") {
  ICONS.ropa = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M10 5.6a2 2 0 1 1 2.6 1.9c-.4.1-.6.5-.6.9v1.2"/><path d="M12 9.6l8.1 6a1.6 1.6 0 0 1-.95 2.9H4.85a1.6 1.6 0 0 1-.95-2.9Z"/></svg>`;
  ICONS.lavar = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M4 7h16l-1.6 11.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8Z"/><path d="M4 7c1.5-1.3 3-1.3 4 0s3 1.3 4 0 3-1.3 4 0 2.5 1.3 4 0"/></svg>`;
  // Inspiración (D-148): una chinche, una imagen y un link.
  ICONS.inspiracion = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M8.5 3.5h7"/><path d="M10 3.5l-.7 5.6-2.8 3.4h11l-2.8-3.4L14 3.5"/><path d="M12 12.5v8"/></svg>`;
  ICONS.imagen = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-4.6-4.6a1.2 1.2 0 0 0-1.7 0L6.5 19.5"/></svg>`;
  ICONS.enlace = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M10 14a4 4 0 0 0 5.66 0l3.17-3.17a4 4 0 0 0-5.66-5.66l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.66 0l-3.17 3.17a4 4 0 0 0 5.66 5.66l1.2-1.2"/></svg>`;
  // Outfits (D-149): una polera, el clima (sol con nube) y guardar.
  ICONS.outfit = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M8.5 4 4 6.6l1.7 3.5L8 9.2V20h8V9.2l2.3.9L20 6.6 15.5 4c-.6 1.4-1.9 2.2-3.5 2.2S9.1 5.4 8.5 4Z"/></svg>`;
  ICONS.clima = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><circle cx="9" cy="9" r="3.2"/><path d="M9 2.5v1.3M3.8 4.2l.9.9M2.5 9h1.3M14.2 4.2l-.9.9"/><path d="M8.5 19.5h9a3 3 0 0 0 .4-6 4.3 4.3 0 0 0-8.2-.9 3.2 3.2 0 0 0-1.2 6.9Z"/></svg>`;
  ICONS.guardar = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M7 3.5h10a1 1 0 0 1 1 1v16l-6-4-6 4v-16a1 1 0 0 1 1-1Z"/></svg>`;
}
const M = window.RopaMotor, D = window.RopaDatos;
const app = document.getElementById("ro-app"), ficha = document.getElementById("rop-app");
if (!M || !D || !app || !window.Lectura) return;
const { esc } = window.Lectura;
const pintarIconos = el => { if (typeof renderIcons === "function") renderIcons(el); };
const pantalla = () => location.hash.replace(/^#/, "").split("/")[0];

// ---------- Aviso breve (con "Deshacer" 5 s) ----------
let toastT = null, toastDeshacer = null, toastVencer = null;
function toastEl() {
  let el = document.getElementById("ro-toast");
  if (el) return el;
  el = document.createElement("div");
  el.id = "ro-toast";
  el.className = "undo-toast lug-toast";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.hidden = true;
  el.innerHTML = `<span class="undo-toast-msg"></span><button type="button" class="undo-toast-btn">Deshacer</button><span class="undo-toast-bar"></span>`;
  el.querySelector("button").addEventListener("click", () => { const f = toastDeshacer; toastVencer = null; ocultarToast(); if (f) f(); });
  document.body.appendChild(el);
  return el;
}
function ocultarToast() {
  clearTimeout(toastT);
  const v = toastVencer;
  toastDeshacer = null; toastVencer = null;
  const el = document.getElementById("ro-toast");
  if (el) { el.classList.remove("show"); el.hidden = true; }
  if (v) v();
}
// aviso(texto) o aviso(texto, deshacer, alVencer): alVencer corre si no deshiciste.
function aviso(texto, deshacer, alVencer) {
  if (toastVencer) { const v = toastVencer; toastVencer = null; v(); }
  const el = toastEl();
  clearTimeout(toastT);
  toastDeshacer = deshacer || null;
  toastVencer = alVencer || null;
  el.querySelector(".undo-toast-msg").textContent = texto;
  el.querySelector("button").hidden = !deshacer;
  el.classList.toggle("is-simple", !deshacer);
  el.hidden = false;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  toastT = setTimeout(ocultarToast, deshacer ? 5000 : 2600);
}
const fallo = err => { console.warn("Ropa:", err); aviso("No se pudo guardar. Revisa tu conexión: se reintenta solo."); };

// ---------- Hojas (con el foco bien puesto) ----------
const hojas = {};
function hoja(nombre) {
  if (hojas[nombre]) return hojas[nombre];
  const h = window.Lectura.hoja(nombre);
  h.el.classList.add("lug-hoja", "ro-hoja");
  const cerrar = h.cerrar;
  h.cerrar = () => { cerrar(); const v = h.volver; h.volver = null; if (h.alCerrar) { const f = h.alCerrar; h.alCerrar = null; f(); } if (v && document.contains(v)) setTimeout(() => v.focus(), 220); };
  h.mostrar = (titulo, html, enfocar) => {
    if (!h.abierta()) h.volver = document.activeElement;
    h.abrir(titulo, html);
    const destino = (enfocar && h.el.querySelector(enfocar)) || h.el.querySelector(".budget-sheet-close");
    if (destino) setTimeout(() => destino.focus({ preventScroll: true }), 60);
  };
  hojas[nombre] = h;
  return h;
}
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  const abiertas = Object.values(hojas).filter(h => h.abierta());
  if (abiertas.length) abiertas[abiertas.length - 1].cerrar();
});

// ---------- Lo que estás mirando (se recuerda en este teléfono) ----------
const VISTA = "manolo.ropa.vista";
const vista = Object.assign({ grupo: "", color: "", clima: "", formalidad: "", orden: "recientes", lavar: false, fuera: false, q: "" }, leerVista());
function leerVista() { try { return JSON.parse(localStorage.getItem(VISTA) || "{}"); } catch (e) { return {}; } }
function guardarVista() { try { localStorage.setItem(VISTA, JSON.stringify(Object.assign({}, vista, { q: "" }))); } catch (e) { /* sin almacenamiento */ } }
vista.q = "";

// ---------- Fotos: la miniatura al toque y la grande cuando se ve ----------
const verFoto = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  verFoto.unobserve(e.target);
  subirFoto(e.target);
}), { rootMargin: "200px" }) : null;
// En la grilla, la mediana (480 px); en la ficha, la grande.
function subirFoto(img) {
  const id = img.dataset.foto;
  if (!id || !D.Fotos) return;
  D.Fotos.url(id, img.dataset.tam === "grande" ? "" : "media").then(u => { if (u && img.dataset.foto === id) img.src = u; });
}
function fotosGrandes(raiz) {
  if (verFoto) verFoto.disconnect();   // lo de antes ya no está en pantalla
  raiz.querySelectorAll("img[data-foto]").forEach(img => { if (verFoto) verFoto.observe(img); else subirFoto(img); });
}
function fotoHTML(p, clase, grande) {
  const f = p.fotos[0];
  if (!f) return `<span class="${clase} is-vacia" aria-hidden="true"><span data-icon="ropa"></span></span>`;
  // La grande, con la forma de la foto (y el ancho que entra en 70% del alto de la pantalla).
  const forma = grande && f.ancho > 0 && f.alto > 0 ? ` style="aspect-ratio:${f.ancho} / ${f.alto};width:min(100%, calc(70vh * ${Math.round((f.ancho / f.alto) * 1000) / 1000}))"` : "";
  return `<span class="${clase}"${forma}><img src="${esc(f.mini || "")}" data-foto="${esc(f.id)}"${grande ? ' data-tam="grande"' : ""} alt="${esc(M.titulo(p))}" decoding="async"${grande ? "" : ' loading="lazy"'}></span>`;
}
const puntos = p => `<span class="ro-puntos" aria-hidden="true">${p.colores.map(c => `<i style="background:${esc(c.hex)}"></i>`).join("")}</span>`;

// ---------- El ropero ----------
app.innerHTML = `
  <div class="ro-resumen-fila"><p class="ro-resumen" id="ro-resumen" aria-live="polite"></p>
    <a class="ro-numeros-link" id="ro-numeros-link" href="#ropa-numeros" hidden><span data-icon="chart" aria-hidden="true"></span>Tus números</a></div>
  <label class="lug-buscar ro-buscar">
    <span class="lug-buscar-ic" data-icon="search" aria-hidden="true"></span>
    <input type="search" class="lib-input" id="ro-q" placeholder="Tipo, color, marca o tela" aria-label="Buscar en tu ropero por tipo, color, marca o tela" autocomplete="off" enterkeyhint="search">
  </label>
  <h2 class="visually-hidden">Tu ropero</h2>
  <div class="lug-chips ro-grupos" id="ro-grupos" role="toolbar" aria-label="Grupos de prendas"></div>
  <div class="lug-chips" id="ro-chips" role="toolbar" aria-label="Filtros y orden"></div>
  <div id="ro-lista" aria-live="polite"></div>
  <div class="ro-pie" id="ro-pie"></div>`;
pintarIconos(app);
const $ = id => document.getElementById(id);

const plural = (n, uno, varios) => `${n.toLocaleString("es-BO")} ${n === 1 ? uno : varios}`;
const hayFiltros = () => !!(vista.grupo || vista.color || vista.clima || vista.formalidad || vista.lavar);
function textoChip(c) {
  if (c === "color") return vista.color ? (M.familias(D.lista()).find(f => f.id === vista.color) || { nombre: "Color" }).nombre : "Color";
  if (c === "clima") return vista.clima ? M.nombreDe(M.CLIMAS, vista.clima) : "Clima";
  if (c === "formalidad") return vista.formalidad ? `Formal: ${vista.formalidad}` : "Formalidad";
  return M.nombreDe(M.ORDENES, vista.orden) || "Recientes";
}
function render() {
  if (!D.cargada()) {
    $("ro-resumen").textContent = "";
    $("ro-lista").innerHTML = D.error() ? `<p class="rd-nota">No pude leer tu ropero. Revisa tu conexión.</p>` : `<p class="rd-nota">Cargando…</p>`;
    $("ro-grupos").innerHTML = ""; $("ro-chips").innerHTML = ""; $("ro-pie").innerHTML = "";
    return;
  }
  const todas = D.lista();
  const r = M.resumen(todas);
  $("ro-resumen").textContent = r.total ? `${plural(r.total, "prenda", "prendas")}${r.lavar ? ` · ${plural(r.lavar, "para lavar", "para lavar")}` : ""}` : "";
  $("ro-numeros-link").hidden = !r.total || !window.RopaNumeros;
  if (!todas.length) {
    $("ro-grupos").innerHTML = ""; $("ro-chips").innerHTML = ""; $("ro-pie").innerHTML = "";
    $("ro-lista").innerHTML = `<div class="run-vacio ro-vacio"><span class="icon" data-icon="ropa"></span>
      <p><b>Tu ropero está vacío.</b></p>
      <p>Sácale una foto a cada prenda: una por foto, con buena luz y sobre un fondo liso (la cama o el piso). Puedes elegir varias a la vez.</p>
      <button type="button" class="lib-btn" data-ro="agregar">Agregar prendas</button></div>`;
    pintarIconos($("ro-lista"));
    return;
  }
  // Grupos (con cuántas hay) y chips de filtros.
  $("ro-grupos").innerHTML = [{ id: "", nombre: "Todo" }].concat(M.GRUPOS).map(g => {
    const n = g.id ? r.porGrupo[g.id] : r.total;
    const sel = vista.grupo === g.id;
    return `<button type="button" class="lug-chip ro-grupo${sel ? " is-activo" : ""}" data-ro-grupo="${g.id}" aria-pressed="${sel}">${esc(g.nombre)}<span class="ro-n">${n}</span></button>`;
  }).join("");
  $("ro-chips").innerHTML = ["color", "clima", "formalidad", "orden"].map(c => `<button type="button" class="lug-chip${c === "orden" ? " is-orden" : ""}${c !== "orden" && vista[c] ? " is-activo" : ""}" data-ro-chip="${c}" aria-haspopup="dialog">${esc(textoChip(c))}<span class="lug-chip-ic" data-icon="chevronDown" aria-hidden="true"></span></button>`).join("")
    + (r.lavar || vista.lavar ? `<button type="button" class="lug-chip${vista.lavar ? " is-activo" : ""}" data-ro="lavar" aria-pressed="${vista.lavar}"><span class="lug-chip-ic" data-icon="lavar" aria-hidden="true"></span>Para lavar</button>` : "")
    + (hayFiltros() ? `<button type="button" class="lug-chip is-limpiar" data-ro="limpiar">Quitar filtros</button>` : "");
  const estado = vista.fuera ? "fuera" : vista.lavar ? "lavar" : "activas";
  const xs = M.ordenar(M.buscar(M.filtrar(todas, { grupo: vista.grupo, color: vista.color, clima: vista.clima, formalidad: vista.formalidad, estado }), vista.q), vista.orden, D.usos());
  const titulo = vista.fuera ? `<h2 class="ro-sub">Las que ya no tienes</h2><p class="rd-nota">Su historial queda guardado. Ábrela para volver a tenerla.</p>` : "";
  $("ro-lista").innerHTML = titulo + (xs.length
    ? `<ul class="ro-grilla">${xs.map(p => {
      const u = D.usosDe(p.id);
      return `<li><a class="ro-card${p.estado === "lavar" ? " is-lavar" : ""}" href="#ropa-prenda/${encodeURIComponent(p.id)}">
        ${fotoHTML(p, "ro-foto")}
        <span class="ro-card-t">${esc(M.titulo(p))}</span>
        <span class="ro-card-m">${puntos(p)}<span>${u.n ? `${plural(u.n, "vez", "veces")}` : "Sin usar"}</span></span>
        ${p.estado === "lavar" ? `<span class="ro-tag"><span data-icon="lavar" aria-hidden="true"></span>Para lavar</span>` : ""}
      </a></li>`;
    }).join("")}</ul>`
    : `<div class="run-vacio"><p><b>${vista.q ? "No encontré nada con eso." : "No hay prendas con esos filtros."}</b></p>${hayFiltros() || vista.q ? `<button type="button" class="lib-btn-sec" data-ro="limpiar">Quitar filtros</button>` : ""}</div>`);
  $("ro-pie").innerHTML = vista.fuera
    ? `<button type="button" class="lib-btn-sec lib-btn-chico" data-ro="ropero">Volver al ropero</button>`
    : (r.fuera ? `<button type="button" class="link-btn ro-fuera-btn" data-ro="fuera">Ya no las tengo (${r.fuera})</button>` : "");
  pintarIconos(app);
  fotosGrandes($("ro-lista"));
  inicio();
}

// ---------- Filtros en hojas ----------
function elegir(c) {
  const h = hoja("ro-hoja-filtro");
  let ops = [];
  if (c === "color") ops = [["", "Todos los colores", null]].concat(M.familias(D.lista()).map(f => [f.id, f.nombre, f.hex]));
  else if (c === "clima") ops = [["", "Cualquier clima"]].concat(M.CLIMAS);
  else if (c === "formalidad") ops = [["", "Cualquiera"]].concat([1, 2, 3, 4, 5].map(n => [String(n), `${n} · ${M.FORMALIDAD[n]}`]));
  else ops = M.ORDENES;
  const actual = c === "orden" ? vista.orden : vista[c];
  const titulos = { color: "Color", clima: "Clima", formalidad: "Qué tan formal", orden: "Ordenar" };
  h.mostrar(titulos[c], `<div class="ro-ops" role="radiogroup" aria-label="${esc(titulos[c])}">${ops.map(([v, t, hex]) => `<button type="button" class="ro-op${String(actual || "") === v ? " is-sel" : ""}" role="radio" aria-checked="${String(actual || "") === v}" data-ro-valor="${esc(v)}">${hex ? `<i class="ro-muestra" style="background:${esc(hex)}" aria-hidden="true"></i>` : ""}<span>${esc(t)}</span></button>`).join("")}</div>`, ".ro-op.is-sel");
  h.el.onclick = e => {
    const b = e.target.closest("[data-ro-valor]");
    if (!b) return;
    if (c === "orden") vista.orden = b.dataset.roValor || "recientes"; else vista[c] = b.dataset.roValor;
    guardarVista();
    h.cerrar();
    render();
  };
}

app.addEventListener("click", e => {
  const g = e.target.closest("[data-ro-grupo]");
  if (g) { vista.grupo = g.dataset.roGrupo; guardarVista(); render(); return; }
  const c = e.target.closest("[data-ro-chip]");
  if (c) { elegir(c.dataset.roChip); return; }
  const b = e.target.closest("[data-ro]");
  if (!b) return;
  const a = b.dataset.ro;
  if (a === "agregar") { if (window.RopaForm) window.RopaForm.agregar(b); }
  else if (a === "lavar") { vista.lavar = !vista.lavar; vista.fuera = false; guardarVista(); render(); }
  else if (a === "limpiar") { Object.assign(vista, { grupo: "", color: "", clima: "", formalidad: "", lavar: false, q: "" }); $("ro-q").value = ""; guardarVista(); render(); }
  else if (a === "fuera") { vista.fuera = true; vista.lavar = false; render(); window.scrollTo(0, 0); }
  else if (a === "ropero") { vista.fuera = false; render(); }
});
let buscarT = null;
$("ro-q").addEventListener("input", e => { clearTimeout(buscarT); buscarT = setTimeout(() => { vista.q = e.target.value; render(); }, 120); });

// ---------- La ficha de una prenda ----------
const fechaLarga = M.fechaLarga;
const plata = n => `Bs ${n.toLocaleString("es-BO", { maximumFractionDigits: 2 })}`;
const idDeHash = () => { const p = location.hash.replace(/^#/, "").split("/"); return p[0] === "ropa-prenda" ? decodeURIComponent(p.slice(1).join("/")) : null; };
let fichaId = null;
function renderFicha() {
  const id = idDeHash();
  if (!id || !ficha) return;
  if (!D.cargada()) { ficha.innerHTML = `<p class="rd-nota">Cargando…</p>`; return; }
  const p = D.una(id);
  if (!p) { ficha.innerHTML = `<p class="rd-nota">Esta prenda ya no está en tu ropero.</p><a class="lib-btn-sec" href="#ropa">Ir al ropero</a>`; fichaId = null; return; }
  const u = D.usosDe(p.id), hoy = D.puestaHoy(p.id);
  const cpu = M.costoPorUso(p.precio, u.n);
  const datos = [
    ["Tela", p.tela], ["Estampado", M.nombreDe(M.ESTAMPADOS, p.estampado)], ["Marca", p.marca], ["Talla", p.talla],
    ["Precio", p.precio != null ? plata(p.precio) : ""], ["La compraste", p.compra ? fechaLarga(p.compra) : ""], ["Notas", p.notas]
  ].filter(x => x[1]);
  const chips = [
    ...p.colores.map(c => `<li class="ro-info"><i class="ro-muestra" style="background:${esc(c.hex)}" aria-hidden="true"></i>${esc(c.nombre)}</li>`),
    ...p.estilo.map(s => `<li class="ro-info">${esc(M.nombreDe(M.ESTILOS, s))}</li>`),
    ...p.clima.map(c => `<li class="ro-info">${esc(M.nombreDe(M.CLIMAS, c))}</li>`),
    p.formalidad ? `<li class="ro-info">Formal: ${p.formalidad} de 5 · ${esc(M.FORMALIDAD[p.formalidad])}</li>` : ""
  ].join("");
  const mismo = fichaId === id;
  fichaId = id;
  ficha.innerHTML = `
    ${fotoHTML(p, "ro-ficha-foto", true)}
    <h1 class="page-title ro-ficha-t">${esc(M.titulo(p))}</h1>
    <p class="ro-ficha-sub">${esc(M.GRUPO[p.grupo].nombre)} · ${esc(p.tipo)}${p.estado === "lavar" ? ` · <b class="ro-lavar-t">Para lavar</b>` : ""}${p.estado === "fuera" ? ` · Ya no la tienes${p.fueraFecha ? ` (desde el ${esc(fechaLarga(p.fueraFecha))})` : ""}` : ""}</p>
    ${chips ? `<ul class="ro-infos">${chips}</ul>` : ""}
    ${p.estado === "fuera" ? "" : `<button type="button" class="ro-puse${hoy ? " is-on" : ""}" data-rop="puse" aria-pressed="${hoy}"><span data-icon="check" aria-hidden="true"></span>${hoy ? "Te la pusiste hoy" : "Me la puse hoy"}</button>`}
    <section class="tmp-card ro-uso" aria-labelledby="rop-uso-t">
      <h2 class="ro-sub" id="rop-uso-t">Cuánto la usas</h2>
      <p class="ro-uso-n">${u.n ? `Te la pusiste <b>${plural(u.n, "vez", "veces")}</b>` : "Todavía no te la pusiste."}</p>
      ${u.ultima ? `<p class="rd-nota">La última, el ${esc(fechaLarga(u.ultima))}.</p>` : ""}
      ${cpu != null ? `<p class="rd-nota">Te sale a <b>${esc(plata(cpu))}</b> cada vez.</p>` : ""}
    </section>
    ${datos.length ? `<dl class="ro-datos">${datos.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
    <div class="ro-acciones">
      ${p.estado === "activa" && window.RopaOutfits ? `<a class="lib-btn-sec" href="#ropa-outfits/con/${encodeURIComponent(p.id)}"><span data-icon="outfit" aria-hidden="true"></span>¿Con qué combino esto?</a>` : ""}
      ${window.RopaIA && window.RopaIA.disponible() && p.fotos.length && p.estado !== "fuera" ? `<button type="button" class="lib-btn-sec" data-rop="ia"><span data-icon="sparkle" aria-hidden="true"></span>Describir con IA</button>` : ""}
      <button type="button" class="lib-btn-sec" data-rop="editar"><span data-icon="edit" aria-hidden="true"></span>Editar</button>
      ${p.estado === "fuera" ? `<button type="button" class="lib-btn-sec" data-rop="volver">La volví a tener</button>`
        : `<button type="button" class="lib-btn-sec" data-rop="lavar"><span data-icon="lavar" aria-hidden="true"></span>${p.estado === "lavar" ? "Ya está limpia" : "Para lavar"}</button>
           <button type="button" class="lib-btn-sec" data-rop="fuera">Ya no la tengo</button>`}
      <button type="button" class="lib-btn-peligro" data-rop="borrar"><span data-icon="trash" aria-hidden="true"></span>Borrar</button>
    </div>`;
  pintarIconos(ficha);
  fotosGrandes(ficha);
  if (!mismo) window.scrollTo(0, 0);
}
if (ficha) ficha.addEventListener("click", e => {
  const b = e.target.closest("[data-rop]");
  const p = fichaId && D.una(fichaId);
  if (!b || !p) return;
  const a = b.dataset.rop;
  const nombre = M.titulo(p);
  if (a === "puse") D.meLaPuse(p.id, D.hoy(), !D.puestaHoy(p.id)).catch(fallo);
  else if (a === "editar") { if (window.RopaForm) window.RopaForm.editar(p.id, b); }
  else if (a === "ia") describirConIA(p, b);
  else if (a === "lavar") { const e2 = p.estado === "lavar" ? "activa" : "lavar"; D.estado(p.id, e2).catch(fallo); aviso(e2 === "lavar" ? `${nombre}: para lavar.` : `${nombre}: ya está limpia.`); }
  else if (a === "fuera") { D.estado(p.id, "fuera").catch(fallo); aviso(`${nombre} salió de tu ropero.`, () => D.estado(p.id, p.estado).catch(fallo)); }
  else if (a === "volver") { D.estado(p.id, "activa").catch(fallo); aviso(`${nombre} volvió a tu ropero.`); }
  else if (a === "borrar") {
    const doc = D.crudo(p.id);
    const fotos = p.fotos.map(f => f.id);
    D.borrar(p.id).catch(fallo);
    location.hash = "ropa";
    aviso(`Borraste ${nombre}.`, () => D.restaurar(p.id, doc).catch(fallo),
      () => { if (D.Fotos) fotos.forEach(id => D.Fotos.borrar(id).catch(() => {})); });
  }
});

// "Describir con IA": la foto grande de este teléfono (o la miniatura) → el
// formulario de editar con lo que vio la IA, para revisar antes de guardar.
async function describirConIA(p, b) {
  if (!window.RopaIA || b.disabled) return;
  b.disabled = true;
  const antes = b.innerHTML;
  b.textContent = "Describiendo…";
  try {
    const f = p.fotos[0];
    const r = D.Fotos ? await D.Fotos.leer(f.id).catch(() => null) : null;
    const blob = r && r.blob ? r.blob : await fetch(f.mini).then(x => x.blob());
    const ia = await window.RopaIA.describir(blob);
    if (window.RopaForm) window.RopaForm.editar(p.id, b, ia);
  } catch (e) { aviso((e && e.message) || "La IA no pudo. Intenta de nuevo."); }
  if (b.isConnected) { b.disabled = false; b.innerHTML = antes; }
}

// ---------- Tarjeta de Inicio ----------
// Cuántas prendas tienes y, si ya está, el outfit del día (D-151): lo que te
// pusiste hoy o lo que elegiste para hoy, con sus fotos; entonces la tarjeta
// lleva a Outfits.
function inicio() {
  const el = document.getElementById("ropa-inicio");
  if (!el || !D.cargada()) return;
  const r = M.resumen(D.lista());
  el.textContent = r.total ? `${plural(r.total, "prenda", "prendas")} en tu ropero${r.lavar ? ` · ${plural(r.lavar, "para lavar", "para lavar")}` : ""}.` : "Tu ropero con fotos, outfits e inspiración.";
  const card = el.closest("a.card");
  if (!card) return;
  const hoy = D.hoy(), u = D.usosDocs()[hoy];
  const puestas = (u && Array.isArray(u.prendas) ? u.prendas : []).map(id => D.una(id)).filter(Boolean);
  const DO = window.RopaOutfitsDatos;
  const para = !puestas.length && DO ? DO.lista().find(o => o.para === hoy && o.guardado && o.prendas.some(id => D.una(id))) : null;
  const ps = (puestas.length ? puestas : para ? para.prendas.map(id => D.una(id)).filter(Boolean) : []);
  const fotos = ps.filter(p => p.grupo !== "accesorios").slice(0, 4);
  let hoyEl = card.querySelector(".ro-ini-hoy");
  if (!ps.length) { if (hoyEl) hoyEl.remove(); card.setAttribute("href", "#ropa"); return; }
  if (!hoyEl) { hoyEl = document.createElement("span"); hoyEl.className = "ro-ini-hoy"; card.appendChild(hoyEl); }
  const que = puestas.length ? "Hoy te pusiste" : `Para hoy elegiste${para.nombre ? ` «${para.nombre}»` : ""}`;
  hoyEl.innerHTML = `<span class="ro-ini-t">${esc(que)}:</span><span class="ro-ini-fotos" aria-hidden="true">${fotos.map(p => fotoHTML(p, "ro-foto")).join("")}</span>
    <span class="visually-hidden">${esc(ps.map(p => M.titulo(p)).join(", "))}.</span>`;
  card.setAttribute("href", "#ropa-outfits");
}

// El outfit del día también cambia con tus outfits (lo que elegiste para hoy).
if (window.RopaOutfitsDatos) window.RopaOutfitsDatos.al(inicio);
D.al(() => {
  inicio();
  if (pantalla() === "ropa") render();
  else if (pantalla() === "ropa-prenda") renderFicha();
});
window.addEventListener("hashchange", () => {
  if (pantalla() === "ropa") render();
  else if (pantalla() === "ropa-prenda") renderFicha();
  else fichaId = null;
});
document.addEventListener("DOMContentLoaded", () => { if (pantalla() === "ropa") render(); else if (pantalla() === "ropa-prenda") renderFicha(); });
// Cuando se sabe si la IA está conectada, la ficha muestra (o no) "Describir con IA".
if (window.RopaIA) window.RopaIA.alCambiar(() => { if (pantalla() === "ropa-prenda") renderFicha(); });
render();
window.RopaApp = { aviso, fallo, hoja, render, renderFicha, fotoHTML, puntos };
})();
