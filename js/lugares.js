// ---------- Lugares (sub-panel de Inicio) ----------
// Tu guía personal de dónde comer (D-117, docs/LUGARES.md): pestañas
// "Visitados" y "Quiero ir", buscador, filtros en chips, orden, "¿Dónde como
// hoy?", estadísticas y exportar. El detalle y los formularios están en
// js/lugares-hojas.js; la lógica en js/lugares-motor.js; las fotos en
// js/lugares-fotos.js. Datos en users/{uid}/lugares (en la nube, con copia
// en el teléfono, como Libros).
(function () {
"use strict";
// Íconos (mismo trazo que js/icons.js); se registran antes de renderIcons().
if (typeof ICONS === "object") {
  ICONS.lugar = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><path d="M10.2 6.8v3a1.8 1.8 0 0 0 3.6 0v-3M12 6.8v8.4"/></svg>`;
  ICONS.dado = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r=".9"/><circle cx="15" cy="9" r=".9"/><circle cx="12" cy="12" r=".9"/><circle cx="9" cy="15" r=".9"/><circle cx="15" cy="15" r=".9"/></svg>`;
  ICONS.quizas = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M5 12.5c2.2-2.6 4.4-2.6 7 0s4.8 2.6 7 0"/></svg>`;
  ICONS.externo = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M14 5h5v5M19 5l-8 8"/><path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/></svg>`;
}

const M = window.LugaresMotor, F = window.LugaresFotos;
const app = document.getElementById("lug-app");
if (!M || !app || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const ref = () => db.collection("users").doc(currentUser.uid).collection("lugares");

let lugares = [];                 // normalizados (js/lugares-motor.js)
const crudos = new Map();         // id → documento tal cual (para Deshacer y exportar)
let cargado = false, errorCarga = null;
const VISTA = "manolo.lugares.vista";
const vista = Object.assign({ tab: "visitado", q: "", tipo: "", zona: "", precio: "", volveria: "", minCal: "", orden: "mejores" }, leerVista());
function leerVista() { try { return JSON.parse(localStorage.getItem(VISTA) || "{}"); } catch (e) { return {}; } }
function guardarVista() { try { localStorage.setItem(VISTA, JSON.stringify(Object.assign({}, vista, { q: "" }))); } catch (e) { /* sin almacenamiento */ } }

// ---------- Aviso breve (con "Deshacer" 5 s) ----------
// El mismo cartel que Finanzas (clases .undo-toast). Nunca confirm().
let toastT = null, toastDeshacer = null, toastVencer = null;
function toastEl() {
  let el = document.getElementById("lug-toast");
  if (el) return el;
  el = document.createElement("div");
  el.id = "lug-toast";
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
  const el = document.getElementById("lug-toast");
  if (el) { el.classList.remove("show"); el.hidden = true; }
  if (v) v();
}
// aviso(texto) o aviso(texto, deshacer, alVencer): alVencer corre si no deshiciste.
function aviso(texto, deshacer, alVencer) {
  if (toastVencer) { const v = toastVencer; toastVencer = null; v(); }   // el anterior ya no se puede deshacer
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
const fallo = err => { console.warn("Lugares:", err); aviso("No se pudo guardar. Revisa tu conexión: se reintenta solo."); };

// ---------- Hojas (con el foco bien puesto para el lector de pantalla) ----------
const hojas = {};
function hoja(nombre) {
  if (hojas[nombre]) return hojas[nombre];
  // Una sola clase al crearla (el título usa ese nombre como id); la clase común va aparte.
  const h = window.Lectura.hoja(nombre);
  h.el.classList.add("lug-hoja");
  const cerrar = h.cerrar;
  h.cerrar = () => { cerrar(); const v = h.volver; h.volver = null; if (v && document.contains(v)) setTimeout(() => v.focus(), 220); };
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

// ---------- Pantalla ----------
app.innerHTML = `
  <div class="lug-acciones">
    <button type="button" class="lug-accion" data-lug="sugerir"><span data-icon="dado"></span>¿Dónde como hoy?</button>
    <button type="button" class="lug-accion" data-lug="stats"><span data-icon="chart"></span>Estadísticas</button>
  </div>
  <label class="lug-buscar">
    <span class="lug-buscar-ic" data-icon="search" aria-hidden="true"></span>
    <input type="search" class="lib-input" id="lug-q" placeholder="Nombre, plato o etiqueta" aria-label="Buscar lugares por nombre, plato o etiqueta" autocomplete="off" enterkeyhint="search">
  </label>
  <div class="fin-tabs lug-tabs" role="tablist" aria-label="Lugares">
    <button type="button" class="fin-tab" role="tab" id="lug-tab-visitado" data-lug-tab="visitado" aria-controls="lug-lista">Visitados</button>
    <button type="button" class="fin-tab" role="tab" id="lug-tab-quiero" data-lug-tab="quiero" aria-controls="lug-lista">Quiero ir</button>
  </div>
  <div class="lug-chips" id="lug-chips" role="toolbar" aria-label="Filtros y orden"></div>
  <div id="lug-lista" role="tabpanel" aria-live="polite"></div>
  <button type="button" class="lib-btn-sec lib-btn-chico lug-exportar" data-lug="exportar">Exportar (JSON)</button>
  <button type="button" class="lug-fab" data-lug="nuevo" aria-label="Agregar lugar"><span data-icon="plus"></span></button>`;
const $ = id => document.getElementById(id);

// Las opciones de cada chip.
function opciones(chip) {
  if (chip === "orden") return M.ORDENES.map(o => ({ v: o.id, t: o.nombre }));
  if (chip === "tipo") return [{ v: "", t: "Todos los tipos" }].concat(M.TIPOS.map(t => ({ v: t.id, t: `${t.emoji} ${t.nombre}` })));
  if (chip === "zona") return [{ v: "", t: "Todas las zonas" }].concat(M.zonas(lugares).map(z => ({ v: z, t: z })));
  if (chip === "precio") return [{ v: "", t: "Cualquier precio" }, { v: "1", t: "$ · barato" }, { v: "2", t: "$$ · medio" }, { v: "3", t: "$$$ · caro" }];
  if (chip === "volveria") return [{ v: "", t: "Todos" }].concat(M.VOLVERIA.map(x => ({ v: x.id, t: `Volvería: ${x.nombre}` })));
  return [{ v: "", t: "Cualquier calificación" }].concat([5, 4, 3, 2].map(n => ({ v: String(n), t: `${"★".repeat(n)} ${n === 5 ? "solo 5" : `${n} o más`}` })));
}
const TITULO_CHIP = { orden: "Ordenar", tipo: "Tipo", zona: "Zona", precio: "Precio", volveria: "¿Volverías?", minCal: "Calificación mínima" };
function textoChip(chip) {
  const v = vista[chip];
  if (chip === "orden") return `Ordenar: ${(M.ORDENES.find(o => o.id === v) || M.ORDENES[0]).nombre}`;
  if (!v) return TITULO_CHIP[chip];
  if (chip === "tipo") return M.TIPO[v] ? `${M.TIPO[v].emoji} ${M.TIPO[v].nombre}` : "Tipo";
  if (chip === "precio") return "$".repeat(Number(v));
  if (chip === "volveria") return `Volvería: ${M.VOLV[v] ? M.VOLV[v].nombre : ""}`;
  if (chip === "minCal") return `★ ${v}${v === "5" ? "" : "+"}`;
  return v;
}
// Los filtros que tienen sentido en cada pestaña.
const chipsDe = tab => (tab === "quiero" ? ["orden", "tipo", "zona", "precio"] : ["orden", "tipo", "zona", "precio", "volveria", "minCal"]);
const hayFiltros = () => chipsDe(vista.tab).some(c => c !== "orden" && vista[c]);

function filtros() {
  const f = { estado: vista.tab, q: vista.q, tipo: vista.tipo, zona: vista.zona, precio: vista.precio };
  if (vista.tab === "visitado") Object.assign(f, { volveria: vista.volveria, minCal: vista.minCal });
  return f;
}

// Insignia "Volvería" con color, ícono y texto (nunca solo color).
function volvHTML(v) {
  if (!M.VOLV[v]) return "";
  const ic = v === "si" ? "check" : v === "no" ? "close" : "quizas";
  return `<span class="lug-volv is-${v}"><span class="lug-volv-ic" data-icon="${ic}" aria-hidden="true"></span>Volvería: ${M.VOLV[v].nombre}</span>`;
}
function fotoHTML(l, clase) {
  const f = l.fotos[0];
  if (f && f.mini) return `<span class="${clase}"><img src="${f.mini}" alt="" width="64" height="64" loading="lazy" decoding="async"></span>`;
  return `<span class="${clase} is-icono" aria-hidden="true">${l.tipo ? M.TIPO[l.tipo].emoji : "📍"}</span>`;
}
function metaHTML(l) {
  return [l.tipo ? M.TIPO[l.tipo].nombre : "", l.zona, M.precioTxt(l.precio)].filter(Boolean).map(esc).join(" · ");
}
function tarjeta(l) {
  const r = M.resumenVisitas(l), hoy = hoyLocal();
  const cal = l.calificacion ? `<span class="lug-cal" role="img" aria-label="${l.calificacion} de 5 estrellas"><span aria-hidden="true">★</span> ${l.calificacion}</span>` : "";
  const pie = l.estado === "visitado"
    ? `${volvHTML(l.volveria)}${r.ultima ? `<span class="lug-ult">Última: ${esc(M.fechaCorta(r.ultima, hoy))}</span>` : ""}`
    : (l.especialidad || l.notas ? `<span class="lug-nota">${esc(l.especialidad || l.notas)}</span>` : "");
  return `<li class="lug-item${l.estado === "quiero" ? " is-quiero" : ""}">
    <button type="button" class="lug-card" data-lug-ver="${esc(l.id)}">
      ${fotoHTML(l, "lug-foto")}
      <span class="lug-cuerpo">
        <span class="lug-nombre">${esc(l.nombre)}</span>
        ${metaHTML(l) ? `<span class="lug-meta">${metaHTML(l)}</span>` : ""}
        ${pie ? `<span class="lug-pie">${pie}</span>` : ""}
      </span>
      ${cal}
    </button>
    ${l.estado === "quiero" ? `<button type="button" class="lug-yafui" data-lug-yafui="${esc(l.id)}">Ya fui</button>` : ""}
  </li>`;
}

function render() {
  const t = vista.tab;
  ["visitado", "quiero"].forEach(x => {
    const b = $(`lug-tab-${x}`), n = lugares.filter(l => l.estado === x).length;
    b.classList.toggle("active", x === t);
    b.setAttribute("aria-selected", String(x === t));
    b.textContent = `${x === "visitado" ? "Visitados" : "Quiero ir"}${cargado ? ` · ${n}` : ""}`;
  });
  $("lug-chips").innerHTML = chipsDe(t).map(c => `<button type="button" class="lug-chip${c === "orden" ? " is-orden" : ""}${c !== "orden" && vista[c] ? " is-activo" : ""}" data-lug-chip="${c}" aria-haspopup="dialog">${esc(textoChip(c))}<span class="lug-chip-ic" data-icon="chevronDown" aria-hidden="true"></span></button>`).join("")
    + (hayFiltros() ? `<button type="button" class="lug-chip is-limpiar" data-lug="limpiar">Quitar filtros</button>` : "");
  const el = $("lug-lista");
  const sugerir = document.querySelector('[data-lug="sugerir"]');
  if (sugerir) sugerir.disabled = !lugares.some(l => l.estado === "visitado" && l.volveria === "si");
  const exp = document.querySelector('[data-lug="exportar"]');
  if (exp) exp.hidden = !lugares.length;
  if (errorCarga) {
    el.innerHTML = `<div class="lug-vacio" role="alert"><p><strong>No pude cargar tus lugares.</strong> Revisa tu conexión.</p><button type="button" class="lib-btn" data-lug="reintentar">Reintentar</button></div>`;
  } else if (!cargado) {
    el.innerHTML = `<p class="lug-cargando" aria-busy="true"><span class="lug-cargando-barra"></span>Cargando tus lugares…</p>`;
  } else if (!lugares.length) {
    el.innerHTML = `<div class="lug-vacio"><p class="lug-vacio-t">Tu guía de dónde comer</p><p>Anota los lugares a los que vas: qué venden, qué probaste, si te gustó y si volverías. Toma menos de 15 segundos.</p><button type="button" class="lib-btn" data-lug="nuevo">＋ Agregar mi primer lugar</button></div>`;
  } else {
    const lista = M.ordenar(M.filtrar(lugares, filtros()), vista.orden);
    const delTab = lugares.filter(l => l.estado === t).length;
    el.innerHTML = lista.length ? `<ul class="lug-lista">${lista.map(tarjeta).join("")}</ul>`
      : !delTab ? `<div class="lug-vacio"><p>${t === "quiero" ? "¿Algún lugar que quieres probar? Anótalo aquí y, cuando vayas, toca «Ya fui»." : "Todavía no marcaste ningún lugar como visitado."}</p><button type="button" class="lib-btn" data-lug="nuevo">＋ Agregar lugar</button></div>`
      : `<div class="lug-vacio"><p>Nada coincide${vista.q ? ` con «${esc(vista.q)}»` : ""}${hayFiltros() ? " con esos filtros" : ""}.</p>${hayFiltros() || vista.q ? `<button type="button" class="lib-btn-sec" data-lug="limpiar-todo">Ver todos</button>` : ""}</div>`;
  }
  if (typeof renderIcons === "function") renderIcons(app);
  window.dispatchEvent(new CustomEvent("lugares:datos"));
}

// ---------- Eventos ----------
let reloj = null;
$("lug-q").addEventListener("input", e => {
  clearTimeout(reloj);
  reloj = setTimeout(() => { vista.q = e.target.value; render(); }, 200);   // con debounce
});
app.addEventListener("click", e => {
  const tab = e.target.closest("[data-lug-tab]");
  if (tab) {
    vista.tab = tab.dataset.lugTab;
    if (vista.tab === "quiero" && (vista.orden === "mejores" || vista.orden === "visitados")) vista.orden = "recientes";
    guardarVista(); render(); return;
  }
  const chip = e.target.closest("[data-lug-chip]");
  if (chip) { elegir(chip.dataset.lugChip); return; }
  const ver = e.target.closest("[data-lug-ver]");
  if (ver) { window.LugaresHojas.detalle(ver.dataset.lugVer); return; }
  const ya = e.target.closest("[data-lug-yafui]");
  if (ya) { window.LugaresHojas.formLugar(ya.dataset.lugYafui, { yaFui: true }); return; }
  const b = e.target.closest("[data-lug]");
  if (!b) return;
  const a = b.dataset.lug;
  if (a === "nuevo") window.LugaresHojas.formLugar(null, { estado: vista.tab });
  else if (a === "sugerir") abrirSugerir();
  else if (a === "stats") abrirStats();
  else if (a === "exportar") exportar();
  else if (a === "limpiar" || a === "limpiar-todo") {
    ["tipo", "zona", "precio", "volveria", "minCal"].forEach(k => { vista[k] = ""; });
    if (a === "limpiar-todo") { vista.q = ""; $("lug-q").value = ""; }
    guardarVista(); render();
  } else if (a === "reintentar") { errorCarga = null; render(); escuchar(); }
});

// Elegir una opción de un chip (hoja con la lista).
function elegir(chip) {
  const h = hoja("lug-hoja-elegir");
  const ops = opciones(chip);
  h.mostrar(TITULO_CHIP[chip], `<div class="lug-opciones" role="radiogroup" aria-label="${esc(TITULO_CHIP[chip])}">${ops.map(o => `
    <button type="button" class="lug-opcion${String(vista[chip] || "") === o.v || (chip === "orden" && !vista.orden && o.v === "mejores") ? " is-sel" : ""}" role="radio" aria-checked="${String(vista[chip] || "") === o.v}" data-lug-op="${esc(o.v)}">${esc(o.t)}<span class="lug-opcion-ic" data-icon="check" aria-hidden="true"></span></button>`).join("")}
    ${chip === "zona" && ops.length === 1 ? `<p class="lib-ayuda">Cuando anotes la zona de tus lugares, aparecen aquí.</p>` : ""}</div>`, ".lug-opcion.is-sel");
  h.el.onclick = e => {
    const op = e.target.closest("[data-lug-op]");
    if (!op) return;
    vista[chip] = op.dataset.lugOp;
    guardarVista();
    h.cerrar();
    render();
  };
}

// ---------- ¿Dónde como hoy? ----------
const sug = { tipo: "", precio: "", ultimo: null };
function abrirSugerir() {
  const h = hoja("lug-hoja-sugerir");
  h.mostrar("¿Dónde como hoy?", `<div class="lug-sug">
    <p class="lib-ayuda">Uno al azar entre los lugares a los que volverías.</p>
    <div class="lug-sug-filtro" role="group" aria-label="Tipo">${[{ id: "", nombre: "Cualquiera", emoji: "" }].concat(M.TIPOS).map(t => `<button type="button" class="lug-mini-chip${sug.tipo === t.id ? " is-sel" : ""}" data-sug-tipo="${t.id}" aria-pressed="${sug.tipo === t.id}">${t.emoji ? `${t.emoji} ` : ""}${esc(t.nombre)}</button>`).join("")}</div>
    <div class="lug-sug-filtro" role="group" aria-label="Precio">${["", "1", "2", "3"].map(p => `<button type="button" class="lug-mini-chip${sug.precio === p ? " is-sel" : ""}" data-sug-precio="${p}" aria-pressed="${sug.precio === p}">${p ? "$".repeat(Number(p)) : "Cualquier precio"}</button>`).join("")}</div>
    <div class="lug-sug-res" data-sug-res aria-live="polite"></div>
    <button type="button" class="lib-btn lib-btn-ancho lug-btn-ic" data-sug="otra"><span data-icon="dado" aria-hidden="true"></span>Otra opción</button>
  </div>`, '[data-sug="otra"]');
  sortear(false);
  h.el.onclick = e => {
    const t = e.target.closest("[data-sug-tipo]"), p = e.target.closest("[data-sug-precio]");
    if (t) { sug.tipo = t.dataset.sugTipo; marcar(h.el, "[data-sug-tipo]", x => x.dataset.sugTipo === sug.tipo); sortear(true); return; }
    if (p) { sug.precio = p.dataset.sugPrecio; marcar(h.el, "[data-sug-precio]", x => x.dataset.sugPrecio === sug.precio); sortear(true); return; }
    if (e.target.closest('[data-sug="otra"]')) { sortear(true); return; }
    const ver = e.target.closest("[data-sug-ver]");
    if (ver) { h.cerrar(); setTimeout(() => window.LugaresHojas.detalle(ver.dataset.sugVer), 230); }
  };
}
function marcar(raiz, sel, si) { raiz.querySelectorAll(sel).forEach(b => { b.classList.toggle("is-sel", si(b)); b.setAttribute("aria-pressed", String(si(b))); }); }
function sortear(animar) {
  const caja = document.querySelector(".lug-hoja-sugerir [data-sug-res]");
  if (!caja) return;
  const l = M.sugerir(lugares, { tipo: sug.tipo, precio: sug.precio }, Math.random, sug.ultimo);
  sug.ultimo = l ? l.id : null;
  const fav = l && M.favorito(l);
  caja.innerHTML = l ? `<div class="lug-sug-tarjeta${animar ? " is-nueva" : ""}">
      ${fotoHTML(l, "lug-sug-foto")}
      <div class="lug-sug-cuerpo">
        <p class="lug-sug-nombre">${esc(l.nombre)}</p>
        <p class="lug-meta">${metaHTML(l)}${l.calificacion ? ` · ★ ${l.calificacion}` : ""}</p>
        ${fav ? `<p class="lug-meta">Tu favorito de aquí: <strong>${esc(fav.nombre)}</strong></p>` : ""}
        <div class="lug-sug-botones"><button type="button" class="lib-btn-sec" data-sug-ver="${esc(l.id)}">Ver lugar</button>${l.maps ? `<a class="lib-btn-sec lug-maps" href="${esc(l.maps)}" target="_blank" rel="noopener">Cómo llegar<span data-icon="externo" aria-hidden="true"></span></a>` : ""}</div>
      </div>
    </div>`
    : `<p class="lug-vacio-mini">Nada con esos filtros. Prueba con otro tipo o precio (solo cuentan los lugares a los que volverías).</p>`;
  if (typeof renderIcons === "function") renderIcons(caja);
  // Sin opciones, "Otra opción" no tiene sentido.
  const otra = document.querySelector('.lug-hoja-sugerir [data-sug="otra"]');
  if (otra) otra.disabled = !l;
}

// ---------- Estadísticas ----------
function abrirStats() {
  const e = M.estadisticas(lugares);
  const h = hoja("lug-hoja-stats");
  h.mostrar("Estadísticas", !e.total ? `<p class="lug-vacio-mini">Cuando agregues lugares, aquí verás tus números.</p>` : `
    <div class="lug-stats">
      <div class="lug-stat"><b class="an-num">${e.total}</b><span>${e.total === 1 ? "lugar" : "lugares"}${e.quiero ? ` (${e.quiero} por ir)` : ""}</span></div>
      <div class="lug-stat"><b class="an-num">${e.promedio != null ? `★ ${String(e.promedio).replace(".", ",")}` : "—"}</b><span>promedio</span></div>
      <div class="lug-stat"><b class="an-num">${M.bs(e.gastoTotalCent)}</b><span>en salidas (${e.visitasTotal} ${e.visitasTotal === 1 ? "visita" : "visitas"})</span></div>
    </div>
    ${e.tipoTop ? `<p class="lug-stat-linea">Tu tipo de comida más visitado: <strong>${e.tipoTop.emoji} ${esc(e.tipoTop.nombre)}</strong> (${e.tipoTop.n} ${e.tipoTop.por === "visitas" ? (e.tipoTop.n === 1 ? "visita" : "visitas") : (e.tipoTop.n === 1 ? "lugar" : "lugares")}).</p>` : ""}
    ${e.top5.length ? `<h4 class="lug-h4">Tus mejores lugares</h4><ol class="lug-top">${e.top5.map(l => `<li><button type="button" class="lug-top-btn" data-top-ver="${esc(l.id)}"><span>${esc(l.nombre)}</span><span class="lug-cal" role="img" aria-label="${l.calificacion} de 5 estrellas"><span aria-hidden="true">★</span> ${l.calificacion}</span></button></li>`).join("")}</ol>` : ""}`);
  h.el.onclick = ev => {
    const v = ev.target.closest("[data-top-ver]");
    if (v) { h.cerrar(); setTimeout(() => window.LugaresHojas.detalle(v.dataset.topVer), 230); }
  };
}

// ---------- Exportar (con las fotos completas de este teléfono) ----------
function exportar() {
  const docs = [...crudos.entries()].map(([id, d]) => Object.assign({ id }, d));
  (F ? F.todas() : Promise.resolve([])).catch(() => [])
    .then(regs => Promise.all(regs.filter(r => r.lugarId !== "borrador" && crudos.has(r.lugarId)).map(r => F.aDataUrl(r.blob).then(datos => ({ id: r.id, lugarId: r.lugarId, ancho: r.ancho, alto: r.alto, datos })))))
    .then(fotos => {
      window.Lectura.descargar(`manolo-lugares-${hoyLocal()}.json`, JSON.stringify({ app: "Manolo · Lugares", version: 1, exportado: new Date().toISOString(), lugares: docs, fotos }, null, 1), "application/json");
      aviso(`Listo: ${docs.length} ${docs.length === 1 ? "lugar" : "lugares"} y ${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}.`);
    })
    .catch(err => { console.warn("Lugares: exportar", err); aviso("No se pudo preparar el archivo."); });
}

// ---------- Datos ----------
let dejarDeEscuchar = null;
function escuchar() {
  if (dejarDeEscuchar) dejarDeEscuchar();
  dejarDeEscuchar = ref().onSnapshot(snap => {
    crudos.clear();
    snap.docs.forEach(d => crudos.set(d.id, d.data()));
    lugares = [...crudos.entries()].map(([id, d]) => M.normalizar(id, d));
    cargado = true;
    errorCarga = null;
    render();
  }, err => { console.warn("Lugares:", err); errorCarga = err; render(); });
}
onAuthReady(() => escuchar());

// Borrar un lugar: al instante, con "Deshacer" 5 s; sus fotos del teléfono
// se borran recién cuando ya no se puede deshacer.
function borrarLugar(id) {
  const d = crudos.get(id);
  if (!d) return;
  ref().doc(id).delete().catch(fallo);
  aviso(`Borraste «${d.nombre || "el lugar"}».`,
    () => ref().doc(id).set(d).catch(fallo),
    () => { if (F) F.deLugar(id).then(rs => rs.forEach(r => F.borrar(r.id))).catch(() => {}); });
}

window.LugaresApp = {
  lista: () => lugares, uno: id => lugares.find(l => l.id === id) || null, crudo: id => crudos.get(id) || null,
  listo: () => cargado, ref, aviso, fallo, hoja, borrarLugar, render, zonas: () => M.zonas(lugares), volvHTML, fotoHTML, metaHTML
};
render();
})();
