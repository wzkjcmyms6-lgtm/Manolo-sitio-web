// ---------- Copia de seguridad de todo Manolo (pantalla) ----------
// D-118 (Tarea 3). Una hoja que se abre desde Inicio (abajo: "Copia de
// seguridad") y desde el menú ☰. La lógica (armar, revisar el archivo y qué
// falta) está en js/respaldo-motor.js, con pruebas.
// - Descargar: lee todas tus colecciones (de la nube; sin conexión, lo
//   guardado en este teléfono) y las fotos de Lugares → un archivo .json.
//   En dos toques (Descargar → Guardar archivo) porque el iPhone solo abre
//   "Compartir" justo después de un toque, y preparar la copia tarda.
// - Restaurar: revisa el archivo, lee de la nube lo que ya tienes (hace
//   falta internet: así no se pisa nada), muestra qué se agregaría y, al
//   confirmar, PRIMERO guarda una copia automática de lo que tienes ahora en
//   este teléfono (IndexedDB "manolo-respaldos", las últimas 3, se pueden
//   descargar) y recién después agrega SOLO lo que falta. Nunca borra ni
//   cambia lo que ya tienes. "Deshacer" quita exactamente lo que se agregó.
(function () {
"use strict";
const M = window.RespaldoMotor, L = window.Lectura;
if (!M || !L) return;
const esc = L.esc;
const $ = id => document.getElementById(id);
const CLAVE_ULTIMA = "manolo.respaldo.ultima";      // cuándo guardaste la última copia (este teléfono)
const LOTE_MAX = 400, LOTE_BYTES = 4 * 1024 * 1024; // Firestore: máx. 500 escrituras y 10 MB por lote
const ESPERA_MS = 20000;                            // sin respuesta: queda en el teléfono y se sube solo
const GUARDAR_N = 3;                                // copias automáticas que se guardan

if (typeof ICONS !== "undefined" && typeof ICON_ATTRS !== "undefined") {
  ICONS.respaldo = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M12 3.5 5 6.2v5.3c0 4.3 3 7.9 7 9 4-1.1 7-4.7 7-9V6.2Z"/><path d="M12 8v6.5"/><path d="m9.3 11.8 2.7 2.7 2.7-2.7"/></svg>`;
  ICONS.subir = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M4 18h16"/></svg>`;
}

// ---------- Utilidades ----------
const usuario = () => (typeof currentUser !== "undefined" && currentUser) || null;
const uref = () => db.collection("users").doc(usuario().uid);
const num = n => Number(n || 0).toLocaleString("es-BO");
const tamano = b => (b >= 1048576 ? `${(b / 1048576).toLocaleString("es-BO", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const dos = n => String(n).padStart(2, "0");
function fechaHora(ms) {
  const d = new Date(ms);
  if (isNaN(d)) return "";
  return `${d.toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" })}, ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}
const fechaArchivo = ms => { const d = new Date(ms); return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}`; };
const mayus = t => t.charAt(0).toUpperCase() + t.slice(1);
const leerLS = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const escribirLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin espacio: no pasa nada */ } };
const deUsuario = texto => Object.assign(new Error(texto), { usuario: true });
// Una escritura que no responde (sin señal) ya quedó en el teléfono: Firestore la sube solo.
function conTope(prom) {
  prom.catch(() => {});
  return Promise.race([prom.then(() => "ok"), new Promise(res => setTimeout(() => res("pendiente"), ESPERA_MS))]);
}
const leerTexto = f => (f.text ? f.text() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(f); }));
const sinConexion = err => !navigator.onLine || (err && (err.code === "unavailable" || err.code === "failed-precondition" || /offline|unavailable/i.test(err.message || "")));

// ---------- Leer lo que tienes ----------
// servidor: true → solo de la nube (falla sin conexión). Si no, Firestore usa
// lo guardado en el teléfono cuando no hay señal.
function leerColecciones(servidor) {
  return Promise.all(M.COLECCIONES.map(c => (servidor ? uref().collection(c.id).get({ source: "server" }) : uref().collection(c.id).get())
    .then(snap => {
      const docs = {};
      snap.forEach(d => { docs[d.id] = d.data(); });
      return { id: c.id, docs, cache: !!(snap.metadata && snap.metadata.fromCache) };
    })))
    .then(lista => {
      const colecciones = {};
      lista.forEach(x => { colecciones[x.id] = x.docs; });
      return { colecciones, deCache: lista.some(x => x.cache) };
    });
}
// Fotos de Lugares de este teléfono (solo las de lugares que existen).
const Fotos = () => window.LugaresFotos || null;
function fotosDe(lugares) {
  const F = Fotos();
  if (!F) return Promise.resolve([]);
  return F.todas().catch(() => [])
    .then(regs => Promise.all(regs.filter(r => r && r.blob && lugares[r.lugarId]).map(r => F.aDataUrl(r.blob)
      .then(datos => ({ id: r.id, lugarId: r.lugarId, ancho: r.ancho || 0, alto: r.alto || 0, datos }), () => null))))
    .then(xs => xs.filter(Boolean));
}
function idsFotos() {
  const F = Fotos();
  return F ? F.todas().then(regs => regs.map(r => r.id), () => []) : Promise.resolve([]);
}

// ---------- Copias automáticas (IndexedDB de este teléfono) ----------
const BASE = "manolo-respaldos", ALMACEN = "copias";
let baseAbierta = null;
function abrirBase() {
  if (baseAbierta) return baseAbierta;
  baseAbierta = new Promise((res, rej) => {
    if (!("indexedDB" in window)) { rej(new Error("Este navegador no guarda copias.")); return; }
    const p = indexedDB.open(BASE, 1);
    p.onupgradeneeded = () => { const d = p.result; if (!d.objectStoreNames.contains(ALMACEN)) d.createObjectStore(ALMACEN, { keyPath: "id" }); };
    p.onsuccess = () => { const d = p.result; d.onversionchange = () => { d.close(); baseAbierta = null; }; res(d); };
    p.onerror = () => rej(p.error);
    p.onblocked = () => rej(new Error("Las copias están ocupadas en otra pestaña."));
  });
  baseAbierta.catch(() => { baseAbierta = null; });
  return baseAbierta;
}
function operar(modo, hacer) {
  return abrirBase().then(d => new Promise((res, rej) => {
    const t = d.transaction(ALMACEN, modo);
    const p = hacer(t.objectStore(ALMACEN));
    t.oncomplete = () => res(p ? p.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error("No se pudo guardar la copia."));
  }));
}
const copiasAuto = () => operar("readonly", s => s.getAll()).then(r => (r || []).sort((a, b) => b.creado - a.creado), () => []);
function guardarAuto(copia, motivo) {
  const texto = JSON.stringify(copia);
  const blob = new Blob([texto], { type: "application/json" });
  const reg = { id: `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, creado: Date.now(), motivo, bytes: blob.size, registros: M.total(copia.conteos), fotos: copia.conteos.fotosLugares || 0, blob };
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  return operar("readwrite", s => s.put(reg))
    .then(() => copiasAuto())
    // Solo las últimas 3 (son copias que hizo la app, no tus datos).
    .then(todas => Promise.all(todas.slice(GUARDAR_N).map(v => operar("readwrite", s => s.delete(v.id)))))
    .then(() => reg);
}

// ---------- Estado de la hoja ----------
let h = null, volverA = null;
let paso = "inicio";          // inicio · revisando · plan · agregando · listo
let error = "";
let preparada = null;         // { texto, nombre, bytes, total, fotos, deCache }
let revisada = null;          // { v, p, archivo, colecciones }
let ultimo = null;            // { agregados: [[col, id]], fotos: [id], resumen, pendiente, deshecho }
let trabajando = false;
let turno = 0;                // cambia al cerrar: lo que estaba revisándose ya no se muestra
let avance = { fase: "copia", hechos: 0, total: 0 };
let autos = [];

function hoja() {
  if (h) return h;
  h = L.hoja("rsp-hoja");
  h.el.classList.add("rsp-raiz");
  const cerrarBase = h.cerrar;
  h.cerrar = () => {
    cerrarBase();
    // Al cerrar se olvida lo preparado (libera memoria); si está restaurando, sigue solo.
    if (!trabajando) { paso = "inicio"; revisada = null; preparada = null; ultimo = null; error = ""; turno++; }
    const v = volverA;
    volverA = null;
    if (v && document.contains(v) && v.getClientRects().length) setTimeout(() => v.focus({ preventScroll: true }), 220);
  };
  h.el.addEventListener("click", alTocar);
  h.el.addEventListener("change", e => { if (e.target.classList.contains("rsp-input")) revisar(e.target); });
  return h;
}
function cerrarMenu() {
  const sb = $("sidebar");
  if (sb && sb.classList.contains("open")) { const ov = $("sidebar-overlay"); if (ov) ov.click(); }
}
function abrir(desde) {
  if (!usuario() || typeof db === "undefined") return;
  cerrarMenu();
  const hh = hoja();
  // Desde el menú ☰ (que se cierra), el foco vuelve al botón del menú.
  if (!hh.abierta()) volverA = desde && desde.closest("#sidebar") ? $("menu-toggle") : desde || document.activeElement;
  hh.abrir("Copia de seguridad", "");
  pintar(".budget-sheet-close");
  cargarAutos();
}

// ---------- Pantallas ----------
const ic = (nombre, extra) => `<span class="rsp-ic${extra ? " " + extra : ""}" data-icon="${nombre}" aria-hidden="true"></span>`;
const errorHTML = () => (error ? `<p class="rsp-error" role="alert"><span class="rsp-ic-texto" aria-hidden="true">!</span><span>${esc(error)}</span></p>` : "");

function vistaInicio() {
  const ultima = Number(leerLS(CLAVE_ULTIMA)) || 0;
  const p = preparada;
  return `
    <p class="rsp-intro">Todo Manolo en un solo archivo: hábitos, finanzas, inversiones, ejercicio, running, libros, Biblia, tiempos, lugares (con sus fotos) y tus ajustes.</p>
    ${errorHTML()}
    <section class="rsp-bloque" aria-labelledby="rsp-t-guardar">
      <h4 class="rsp-h4" id="rsp-t-guardar" tabindex="-1">${ic("download")}Guardar una copia</h4>
      <p class="rsp-nota">${ultima ? `Última copia guardada desde este teléfono: ${esc(fechaHora(ultima))}.` : "Todavía no guardaste una copia desde este teléfono."} Guárdala en Archivos o en iCloud Drive.</p>
      ${p ? `
        <p class="rsp-ok" role="status">${ic("check")}<span>Lista: <strong class="rsp-num">${num(p.total)}</strong> ${p.total === 1 ? "registro" : "registros"}${p.fotos ? ` y <strong class="rsp-num">${num(p.fotos)}</strong> ${p.fotos === 1 ? "foto" : "fotos"}` : ""} · <span class="rsp-num">${esc(tamano(p.bytes))}</span></span></p>
        ${p.deCache ? `<p class="rsp-nota rsp-aviso">Sin conexión: tiene lo guardado en este teléfono. Con internet sale completa.</p>` : ""}
        <button type="button" class="lib-btn lib-btn-ancho rsp-btn" data-rsp="guardar">${ic("download")}Guardar archivo</button>`
      : `<button type="button" class="lib-btn lib-btn-ancho rsp-btn" data-rsp="preparar">${ic("download")}Descargar copia de todo</button>`}
    </section>
    <section class="rsp-bloque" aria-labelledby="rsp-t-restaurar">
      <h4 class="rsp-h4" id="rsp-t-restaurar">${ic("subir")}Restaurar desde una copia</h4>
      <p class="rsp-nota">Agrega lo que te falte. <strong>Nunca borra ni cambia lo que ya tienes.</strong></p>
      <button type="button" class="lib-btn-sec lib-btn-ancho rsp-btn" data-rsp="elegir">Elegir archivo de copia</button>
      <input type="file" class="rsp-input" accept="application/json,.json" tabindex="-1" aria-hidden="true">
    </section>
    <div class="rsp-autos-caja">${autosHTML()}</div>`;
}
function autosHTML() {
  if (!autos.length) return "";
  return `<section class="rsp-bloque" aria-labelledby="rsp-t-auto">
      <h4 class="rsp-h4" id="rsp-t-auto">${ic("respaldo")}Copias automáticas</h4>
      <p class="rsp-nota">Se guardan solas en este teléfono antes de cada restauración (las últimas ${GUARDAR_N}).</p>
      <ul class="rsp-autos">${autos.map(a => `
        <li class="rsp-auto"><span class="rsp-auto-txt"><strong>${esc(fechaHora(a.creado))}</strong><small><span class="rsp-num">${num(a.registros)}</span> registros · <span class="rsp-num">${esc(tamano(a.bytes))}</span></small></span>
          <button type="button" class="lib-btn-sec rsp-auto-btn" data-rsp-auto="${esc(a.id)}" aria-label="Descargar la copia automática del ${esc(fechaHora(a.creado))}">Descargar</button></li>`).join("")}
      </ul>
    </section>`;
}
function vistaRevisando() {
  return `<div class="rsp-cargando" role="status">
      <span class="rsp-rueda" aria-hidden="true"></span>
      <h4 class="rsp-h4" id="rsp-t-revisando" tabindex="-1">Revisando el archivo…</h4>
      <p class="rsp-nota">Comparo la copia con lo que ya tienes. No cambio nada todavía.</p>
    </div>`;
}
function vistaPlan() {
  const { v, p, archivo } = revisada;
  const filas = p.porColeccion.filter(c => c.nuevos).map(c => `<li><span>${esc(mayus(c.nombre))}</span><span class="rsp-num rsp-mas">+${num(c.nuevos)}</span></li>`);
  if (p.fotosNuevas.length) filas.push(`<li><span>Fotos de Lugares</span><span class="rsp-num rsp-mas">+${num(p.fotosNuevas.length)}</span></li>`);
  const fecha = v.exportado ? fechaHora(Date.parse(v.exportado)) : "";
  const total = p.totalNuevos + p.fotosNuevas.length;
  return `
    ${errorHTML()}
    <h4 class="rsp-h4 rsp-h4-paso" id="rsp-t-plan" tabindex="-1">${p.vacio ? "Ya tienes todo" : "Esto se agregaría"}</h4>
    <p class="rsp-archivo"><span class="rsp-archivo-nombre">«${esc(archivo)}»</span>${fecha ? `<span>Copia del ${esc(fecha)}</span>` : ""}${v.seccion === "lugares" ? "<span>Archivo de Lugares: trae tus lugares y sus fotos.</span>" : ""}</p>
    ${p.vacio ? `<p class="rsp-nota">Todo lo de esta copia ya está en tu Manolo. No hay nada que agregar.</p>` : `
      <p class="rsp-grande"><strong class="rsp-num">${num(total)}</strong> ${total === 1 ? "cosa para agregar" : "cosas para agregar"}</p>
      <ul class="rsp-filas">${filas.join("")}</ul>`}
    ${p.totalYaTenias && !p.vacio ? `<p class="rsp-nota">${p.totalYaTenias === 1 ? "El otro ya lo tienes: no se toca (aunque en la copia esté distinto)." : `Los otros <span class="rsp-num">${num(p.totalYaTenias)}</span> ya los tienes: no se tocan (aunque en la copia estén distintos).`}</p>` : ""}
    ${v.danados ? `<p class="rsp-nota rsp-aviso"><span class="rsp-ic-texto" aria-hidden="true">!</span>${num(v.danados)} ${v.danados === 1 ? "registro dañado queda" : "registros dañados quedan"} afuera.</p>` : ""}
    ${v.desconocidas.length ? `<p class="rsp-nota rsp-aviso"><span class="rsp-ic-texto" aria-hidden="true">!</span>La copia trae datos que esta versión de Manolo no conoce: quedan afuera.</p>` : ""}
    ${p.vacio ? `<button type="button" class="lib-btn lib-btn-ancho rsp-btn" data-rsp="inicio">Listo</button>` : `
      <p class="rsp-seguro">${ic("respaldo")}<span>Antes de agregar, guardo una copia automática de lo que tienes ahora en este teléfono.</span></p>
      <button type="button" class="lib-btn lib-btn-ancho rsp-btn" data-rsp="confirmar">Agregar lo que falta</button>
      <button type="button" class="lib-btn-sec lib-btn-ancho rsp-btn" data-rsp="inicio">Cancelar</button>`}`;
}
const TITULO_FASE = { copia: "Guardando la copia automática…", datos: "Agregando…", fotos: "Guardando las fotos…" };
function vistaAgregando() {
  return `<h4 class="rsp-h4 rsp-h4-paso" id="rsp-t-avance" tabindex="-1">${TITULO_FASE[avance.fase]}</h4>
    <div class="rsp-barra" role="progressbar" aria-label="Avance de la restauración" aria-valuemin="0" aria-valuemax="${avance.total}" aria-valuenow="${avance.hechos}"><span></span></div>
    <p class="rsp-nota rsp-num rsp-cuenta">${num(avance.hechos)} de ${num(avance.total)}</p>
    <p class="rsp-nota">Puedes cerrar esto: sigue solo y te aviso al terminar.</p>`;
}
function vistaListo() {
  const r = ultimo;
  return `
    ${errorHTML()}
    <h4 class="rsp-h4 rsp-h4-paso" id="rsp-t-listo" tabindex="-1">${r.deshecho ? "Deshecho" : "Listo"}</h4>
    <p class="rsp-ok" role="status">${ic("check")}<span>${r.deshecho ? "Quité lo que había agregado. Tu Manolo quedó como antes." : `Agregué ${esc(r.resumen)}.`}</span></p>
    ${r.pendiente && !r.deshecho ? `<p class="rsp-nota rsp-aviso">Sin conexión: quedó guardado en este teléfono y se sube solo cuando vuelva internet.</p>` : ""}
    ${r.deshecho ? "" : `<p class="rsp-nota">La copia automática de antes quedó en este teléfono (en «Copias automáticas»).</p>`}
    <button type="button" class="lib-btn lib-btn-ancho rsp-btn" data-rsp="cerrar">Listo</button>
    ${r.deshecho ? "" : `<button type="button" class="lib-btn-sec lib-btn-ancho rsp-btn" data-rsp="deshacer">Deshacer (quitar lo que agregué)</button>`}`;
}
const VISTAS = { inicio: vistaInicio, revisando: vistaRevisando, plan: vistaPlan, agregando: vistaAgregando, listo: vistaListo };
function pintar(enfocar) {
  if (!h || !h.abierta()) return;
  const cuerpo = h.el.querySelector(".lib-hoja-cuerpo");
  if (!cuerpo) return;
  cuerpo.innerHTML = (VISTAS[paso] || vistaInicio)();
  if (typeof renderIcons === "function") renderIcons(cuerpo);
  if (paso === "agregando") actualizarAvance();
  const destino = enfocar && (h.el.querySelector(enfocar) || cuerpo.querySelector(".rsp-error"));
  if (destino) setTimeout(() => { if (document.contains(destino)) destino.focus({ preventScroll: false }); }, 60);
}
function actualizarAvance() {
  if (!h || !h.abierta() || paso !== "agregando") return;
  const barra = h.el.querySelector(".rsp-barra");
  if (!barra) return;
  const t = h.el.querySelector("#rsp-t-avance");
  if (t) t.textContent = TITULO_FASE[avance.fase];
  barra.setAttribute("aria-valuemax", String(avance.total));
  barra.setAttribute("aria-valuenow", String(avance.hechos));
  barra.firstElementChild.style.transform = `scaleX(${avance.total ? Math.min(1, avance.hechos / avance.total) : 0})`;
  const c = h.el.querySelector(".rsp-cuenta");
  if (c) c.textContent = `${num(avance.hechos)} de ${num(avance.total)}`;
}
function cargarAutos() {
  copiasAuto().then(xs => {
    autos = xs;
    const caja = h && h.abierta() && h.el.querySelector(".rsp-autos-caja");
    if (caja) { caja.innerHTML = autosHTML(); if (typeof renderIcons === "function") renderIcons(caja); }
  });
}
function ocupado(b, texto) {
  if (!b) return;
  b.disabled = true;
  b.setAttribute("aria-busy", "true");
  b.innerHTML = `<span class="rsp-rueda rsp-rueda-chica" aria-hidden="true"></span>${esc(texto)}`;
}

// ---------- Aviso flotante ----------
let toastT = null;
function aviso(texto) {
  let el = $("rsp-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "rsp-toast";
    el.className = "undo-toast rsp-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = `<span class="undo-toast-msg"></span>`;
    document.body.appendChild(el);
  }
  el.querySelector(".undo-toast-msg").textContent = texto;
  el.hidden = false;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.classList.remove("show"); setTimeout(() => { if (!el.classList.contains("show")) el.hidden = true; }, 220); }, 3600);
}

// ---------- Descargar ----------
function preparar(b) {
  error = "";
  ocupado(b, "Preparando…");
  const mio = turno;
  leerColecciones(false)
    .then(({ colecciones, deCache }) => fotosDe(colecciones.lugares || {}).then(fotos => {
      if (mio !== turno) return;
      const copia = M.armar({ colecciones, fotosLugares: fotos });
      const texto = JSON.stringify(copia);
      preparada = { texto, nombre: `manolo-copia-${L.hoyLocal()}.json`, bytes: new Blob([texto]).size, total: M.total(copia.conteos), fotos: copia.conteos.fotosLugares, deCache };
    }))
    .catch(err => {
      console.warn("Copia de seguridad: preparar", err);
      if (mio === turno) error = "No pude preparar la copia. Revisa tu conexión e intenta de nuevo.";
    })
    .then(() => { if (mio === turno) pintar(preparada ? '[data-rsp="guardar"]' : "#rsp-t-guardar"); });
}
function guardarArchivo() {
  if (!preparada) return;
  L.descargar(preparada.nombre, preparada.texto, "application/json");
  escribirLS(CLAVE_ULTIMA, String(Date.now()));
  aviso(`Copia lista: «${preparada.nombre}».`);
}
function descargarAuto(id) {
  const a = autos.find(x => x.id === id);
  if (!a || !a.blob) return;
  L.descargar(`manolo-copia-automatica-${fechaArchivo(a.creado)}.json`, a.blob, "application/json");
}

// ---------- Restaurar ----------
function revisar(input) {
  const f = input.files && input.files[0];
  input.value = "";
  if (!f || trabajando) return;
  error = "";
  if (f.size > M.MAX_BYTES) { error = M.validar({}, f.size).error; pintar("#rsp-t-restaurar"); return; }
  paso = "revisando";
  pintar("#rsp-t-revisando");
  const mio = turno;
  leerTexto(f)
    .then(texto => {
      let copia;
      try { copia = JSON.parse(texto); } catch (e) { throw deUsuario("No pude leer el archivo. Elige una copia guardada desde Manolo (.json)."); }
      const v = M.validar(copia, f.size);
      if (!v.ok) throw deUsuario(v.error);
      // Lo que ya tienes, desde la nube: así no se pisa nada.
      return Promise.all([leerColecciones(true), idsFotos()]).then(([actual, fotos]) => {
        if (mio !== turno) return;
        const ids = {};
        Object.keys(actual.colecciones).forEach(k => { ids[k] = Object.keys(actual.colecciones[k]); });
        revisada = { v, p: M.plan(v, ids, fotos), archivo: f.name || "copia.json", colecciones: actual.colecciones };
        paso = "plan";
      });
    })
    .catch(err => {
      if (mio !== turno) return;
      paso = "inicio";
      if (err && err.usuario) error = err.message;
      else if (sinConexion(err)) error = "Para restaurar necesitas internet: así reviso bien lo que ya tienes y no piso nada.";
      else {
        console.warn("Copia de seguridad: revisar", err);
        error = "No pude revisar el archivo. Intenta de nuevo.";
      }
    })
    .then(() => { if (mio === turno) pintar(paso === "plan" ? "#rsp-t-plan" : "#rsp-t-restaurar"); });
}

// Escribe en lotes; alLote([[col, id]], "ok" | "pendiente") después de cada uno.
function escribir(p, alLote) {
  const T = typeof firebase !== "undefined" && firebase.firestore && firebase.firestore.Timestamp;
  const crearTs = T && T.fromMillis ? ms => T.fromMillis(ms) : null;
  const lotes = [];
  let lote = [], peso = 0;
  M.COLECCIONES.forEach(c => (p.nuevos[c.id] || []).forEach(d => {
    const t = JSON.stringify(d.data).length;
    if (lote.length && (lote.length >= LOTE_MAX || peso + t > LOTE_BYTES)) { lotes.push(lote); lote = []; peso = 0; }
    lote.push({ col: c.id, id: d.id, data: d.data });
    peso += t;
  }));
  if (lote.length) lotes.push(lote);
  return lotes.reduce((prom, l) => prom.then(() => {
    const b = db.batch();
    // set sin merge: el documento NO existe (se revisó en la nube).
    l.forEach(o => b.set(uref().collection(o.col).doc(o.id), M.decodificar(o.data, crearTs)));
    return conTope(b.commit()).then(est => alLote(l.map(o => [o.col, o.id]), est));
  }), Promise.resolve());
}
function guardarFotos(v, p, alGuardar) {
  const F = Fotos();
  if (!F || !p.fotosNuevas.length) return Promise.resolve();
  // La miniatura de cada foto viene en el documento del lugar.
  const minis = {};
  const lugares = v.colecciones.lugares || {};
  Object.keys(lugares).forEach(id => (Array.isArray(lugares[id].fotos) ? lugares[id].fotos : []).forEach(x => { if (x && x.id && typeof x.mini === "string") minis[x.id] = x.mini; }));
  const n = x => (Number.isFinite(x) && x > 0 ? Math.round(x) : 0);
  return p.fotosNuevas.reduce((prom, x) => prom.then(() => F.deDataUrl(x.datos)
    .then(blob => F.guardar({ id: x.id, lugarId: x.lugarId, blob, mini: minis[x.id] || null, ancho: n(x.ancho), alto: n(x.alto), creado: Date.now() }))
    .then(() => alGuardar(x.id), err => console.warn("Copia de seguridad: foto", err))), Promise.resolve());
}
function restaurar() {
  if (!revisada || trabajando) return;
  const { v, p, archivo, colecciones } = revisada;
  trabajando = true;
  error = "";
  const agregados = [], fotos = [];
  let pendiente = false;
  avance = { fase: "copia", hechos: 0, total: p.totalNuevos + p.fotosNuevas.length };
  paso = "agregando";
  pintar("#rsp-t-avance");
  // 1. Primero la copia automática de lo que tienes ahora. Si falla, no se cambia nada.
  fotosDe(colecciones.lugares || {})
    .then(fotosAct => guardarAuto(M.armar({ colecciones, fotosLugares: fotosAct }), `Antes de restaurar «${archivo}»`))
    .catch(err => { console.warn("Copia de seguridad: copia automática", err); throw deUsuario("No pude guardar la copia automática en este teléfono (¿poco espacio?), así que no cambié nada."); })
    // 2. Recién ahora, solo lo que falta.
    .then(() => {
      avance.fase = "datos";
      actualizarAvance();
      return escribir(p, (ids, est) => {
        ids.forEach(x => agregados.push(x));
        if (est === "pendiente") pendiente = true;
        avance.hechos = agregados.length;
        actualizarAvance();
      });
    })
    .then(() => {
      avance.fase = "fotos";
      actualizarAvance();
      return guardarFotos(v, p, id => { fotos.push(id); avance.hechos = agregados.length + fotos.length; actualizarAvance(); });
    })
    .then(() => {
      trabajando = false;
      revisada = null;
      ultimo = { agregados, fotos, resumen: M.resumen(p) || "lo que faltaba", pendiente, deshecho: false };
      cargarAutos();
      if (h && h.abierta()) { paso = "listo"; pintar("#rsp-t-listo"); }
      else { paso = "inicio"; ultimo = null; aviso(`Copia restaurada: agregué ${M.resumen(p) || "lo que faltaba"}.`); }
    })
    .catch(err => {
      trabajando = false;
      revisada = null;
      if (!(err && err.usuario)) console.warn("Copia de seguridad: restaurar", err);
      error = err && err.usuario ? err.message
        : agregados.length ? `Se cortó a la mitad: agregué ${num(agregados.length)} de ${num(p.totalNuevos)}. Restaura la misma copia otra vez para agregar el resto (lo que ya está no se repite).`
        : "No pude agregar nada. Revisa tu conexión e intenta de nuevo.";
      paso = "inicio";
      cargarAutos();
      if (h && h.abierta()) pintar("#rsp-t-restaurar"); else aviso(error);
    });
}
// Deshacer: quita exactamente lo que esta restauración agregó (nada más).
function deshacer(b) {
  if (!ultimo || ultimo.deshecho || trabajando) return;
  const r = ultimo;
  trabajando = true;
  error = "";
  ocupado(b, "Quitando…");
  const lotes = [];
  for (let i = 0; i < r.agregados.length; i += LOTE_MAX) lotes.push(r.agregados.slice(i, i + LOTE_MAX));
  lotes.reduce((prom, l) => prom.then(() => {
    const bt = db.batch();
    l.forEach(([col, id]) => bt.delete(uref().collection(col).doc(id)));
    return conTope(bt.commit());
  }), Promise.resolve())
    .then(() => { const F = Fotos(); return F ? Promise.all(r.fotos.map(id => F.borrar(id).catch(() => {}))) : null; })
    .then(() => { r.deshecho = true; aviso("Listo: quité lo que había agregado."); })
    .catch(err => { console.warn("Copia de seguridad: deshacer", err); error = "No pude deshacer. Revisa tu conexión e intenta de nuevo."; })
    .then(() => { trabajando = false; pintar("#rsp-t-listo"); });
}

// ---------- Toques ----------
function alTocar(e) {
  const b = e.target.closest("[data-rsp], [data-rsp-auto]");
  if (!b || b.disabled) return;
  if (b.dataset.rspAuto) { descargarAuto(b.dataset.rspAuto); return; }
  const a = b.dataset.rsp;
  if (a === "preparar") preparar(b);
  else if (a === "guardar") guardarArchivo();
  else if (a === "elegir") { const i = h.el.querySelector(".rsp-input"); if (i) i.click(); }
  else if (a === "confirmar") restaurar();
  else if (a === "deshacer") deshacer(b);
  else if (a === "inicio") { paso = "inicio"; revisada = null; error = ""; pintar("#rsp-t-restaurar"); }
  else if (a === "cerrar") h.cerrar();
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-respaldo-abrir]");
  if (b) { e.preventDefault(); abrir(b); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && h && h.abierta()) h.cerrar(); });

window.RespaldoApp = { abrir };
})();
