// ---------- Running › Segmentos: pantallas (fase 6, D-074) ----------
// - Pestaña Segmentos (#run-segmentos): la lista con el mejor tiempo.
// - Página de un segmento (#run-segmento/{id}): mapa, datos y tu tabla
//   personal con medallas; renombrar, buscar de nuevo y eliminar.
// - Crear uno desde una carrera (menú ⋯ del detalle): eligiendo inicio y
//   fin con dos controles sobre el recorrido, con vista previa en el mapa,
//   en el perfil y en un trazo propio; al crearlo se busca solo en todas tus
//   carreras (retroactivo).
// - Al importar, cada carrera nueva se compara con tus segmentos.
// Lógica sin pantalla en js/run-segmentos.js.
(function () {
"use strict";
const V = window.RunVista, M = window.RunMetricas, S = window.RunSegmentos, A = window.RunAnalisis;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const usuario = () => db.collection("users").doc(currentUser.uid);
const colSeg = () => usuario().collection("run_segmentos");
const MED = { 1: "🥇", 2: "🥈", 3: "🥉" };

// ---- Buscar en carreras (retroactivo y al importar) ----
// docs: actividades con mini ruta; leerTramos(doc) → Promise<tramos>.
async function buscar(seg, docs, leerTramos, avance) {
  const candidatas = docs.filter(d => d.mini && S.pasaCerca(d, seg));
  const encontrados = {};
  for (let i = 0; i < candidatas.length; i++) {
    if (avance) avance(i, candidatas.length);
    const d = candidatas[i];
    try {
      const tramos = await leerTramos(d);
      const e = tramos && S.esfuerzo(seg, tramos);
      if (e) encontrados[d.id] = { t: e.t, fecha: d.date, inicio: e.inicio };
    } catch (err) { /* sin esa ruta (sin internet): se intenta otra vez después */ }
  }
  if (avance) avance(candidatas.length, candidatas.length);
  return encontrados;
}
const leerDeFirestore = d => usuario().collection("rutas").doc(d.id).get().then(s => (s.exists ? M.leerRuta(s.data()) : null));
// Después de importar: las nuevas contra todos los segmentos (la ruta ya está en memoria).
function detectarNuevas(guardadas) {
  const segs = window.RunDatos ? RunDatos.segmentos() : [];
  const nuevas = (guardadas || []).filter(g => g.col === "running" && g.ruta && g.doc && g.doc.mini);
  if (!segs.length || !nuevas.length) return Promise.resolve(0);
  const lote = db.batch();
  let n = 0;
  segs.forEach(seg => nuevas.forEach(g => {
    if (!S.pasaCerca(g.doc, seg)) return;
    const e = S.esfuerzo(seg, M.leerRuta(g.ruta));
    if (!e) return;
    lote.update(colSeg().doc(seg.id), { [`esfuerzos.${g.id}`]: { t: e.t, fecha: g.doc.date, inicio: e.inicio } });
    n++;
  }));
  return n ? lote.commit().then(() => n) : Promise.resolve(0);
}

// ---- Crear desde una carrera ----
let hoja = null, creando = null;
function hojaCrear() {
  if (hoja) return hoja;
  hoja = document.createElement("div");
  hoja.id = "rs-hoja";
  hoja.className = "js-sheet budget-sheet";
  hoja.hidden = true;
  hoja.innerHTML = `<div class="budget-sheet-overlay"></div>
    <div class="budget-sheet-panel ri-panel" role="dialog" aria-modal="true" aria-labelledby="rs-hoja-t">
      <div class="budget-sheet-header"><button type="button" class="budget-sheet-close" aria-label="Cerrar"><span data-icon="close"></span></button><h3 id="rs-hoja-t">Nuevo segmento</h3></div>
      <div class="ri-cuerpo" id="rs-cuerpo"></div>
      <div class="txn-sheet-actions ri-acciones" id="rs-acciones"></div>
    </div>`;
  document.body.appendChild(hoja);
  renderIcons(hoja);
  hoja.addEventListener("click", e => {
    if (e.target.closest(".budget-sheet-close") || e.target.classList.contains("budget-sheet-overlay") || e.target.closest('[data-rsh="cancelar"]')) return cerrarHoja();
    if (e.target.closest('[data-rsh="crear"]')) guardarNuevo();
    if (e.target.closest('[data-rsh="ver"]')) { cerrarHoja(); location.hash = `run-segmento/${creando.segId}`; }
  });
  hoja.addEventListener("input", e => { if (e.target.matches("[data-rs-rango]")) vistaPrevia(e.target.dataset.rsRango); });
  return hoja;
}
function abrirHoja() { const h = hojaCrear(); h.classList.remove("is-closing"); h.hidden = false; document.body.classList.add("sheet-open"); }
function cerrarHoja() {
  if (!hoja || hoja.hidden) return;
  if (creando && creando.ctl && creando.ctl.resaltar) creando.ctl.resaltar(null);
  if (creando && creando.alCerrar) creando.alCerrar();
  hoja.classList.add("is-closing");
  setTimeout(() => { hoja.hidden = true; hoja.classList.remove("is-closing"); document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden])")); }, 200);
}
// act = { id, doc, tramos, mapa (control de RunMapa), alCambiar(desdeM, hastaM), alCerrar() }
function crearDesde(act) {
  const total = S.largo(S.tramo(act.tramos, 0, Infinity));
  if (!(total >= 200)) return alert("La ruta es muy corta para un segmento.");
  creando = Object.assign({}, act, { total, desde: Math.round(total * 0.25), hasta: Math.round(total * 0.6), ctl: act.mapa });
  abrirHoja();
  document.getElementById("rs-cuerpo").innerHTML = `
    <label class="rd-campo">Nombre<input class="lib-input" id="rs-nombre" maxlength="60" placeholder="Ej.: Subida al mirador"></label>
    <div class="rs-previa" id="rs-previa"></div>
    <label class="rd-campo rs-rango">Inicio <b id="rs-desde-t"></b><input type="range" min="0" max="${Math.round(total)}" step="10" value="${creando.desde}" data-rs-rango="desde"></label>
    <label class="rd-campo rs-rango">Fin <b id="rs-hasta-t"></b><input type="range" min="0" max="${Math.round(total)}" step="10" value="${creando.hasta}" data-rs-rango="hasta"></label>
    <p class="rs-dato" id="rs-dato" aria-live="polite"></p>
    <p class="rd-nota">Manolo lo buscará solo en todas tus carreras (también las que importes después) y guardará tus tiempos.</p>`;
  document.getElementById("rs-acciones").innerHTML = `<button type="button" class="txn-save txn-save-otro" data-rsh="cancelar">Cancelar</button><button type="button" class="txn-save" data-rsh="crear">Crear</button>`;
  vistaPrevia();
}
function vistaPrevia(cual) {
  const c = creando;
  const r = hoja.querySelectorAll("[data-rs-rango]");
  let a = Number(r[0].value), b = Number(r[1].value);
  // El inicio siempre antes del fin (con al menos 100 m entre los dos).
  if (b - a < 100) { if (cual === "hasta") a = Math.max(0, b - 100); else b = Math.min(c.total, a + 100); r[0].value = a; r[1].value = b; }
  c.desde = a; c.hasta = b;
  const pts = S.tramo(c.tramos, a, b);
  const todo = [].concat(...c.tramos).filter(p => p.lat != null);
  const pr = V.proyectar([V.aligerar(todo, 400), pts], 320, 140, 12);
  const linea = arr => arr.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  document.getElementById("rs-previa").innerHTML = pr.length ? `<svg viewBox="0 0 320 140" class="run-ruta" role="img" aria-label="Vista previa del segmento"><polyline class="rs-previa-todo" points="${linea(pr[0])}"/><polyline class="rs-previa-sel" points="${linea(pr[1])}"/></svg>` : "";
  document.getElementById("rs-desde-t").textContent = `km ${V.numero(a / 1000, 2)}`;
  document.getElementById("rs-hasta-t").textContent = `km ${V.numero(b / 1000, 2)}`;
  const seg = S.crear(c.tramos, a, b, "x");
  document.getElementById("rs-dato").textContent = seg ? `${V.km(seg.distanciaM)}${seg.desnivelM != null ? ` · +${seg.desnivelM} m · ${V.numero(seg.pendiente, 1)} %` : ""}` : "";
  if (c.ctl && c.ctl.resaltar) c.ctl.resaltar(pts);
  if (c.alCambiar) c.alCambiar(a, b);
}
async function guardarNuevo() {
  const c = creando;
  const seg = S.crear(c.tramos, c.desde, c.hasta, document.getElementById("rs-nombre").value, c.id, Date.now());
  if (!seg) return alert("Elige un tramo de al menos 100 m.");
  const propio = S.esfuerzo(seg, c.tramos);
  if (propio) seg.esfuerzos[c.id] = { t: propio.t, fecha: c.doc.date, inicio: propio.inicio };
  const btn = hoja.querySelector('[data-rsh="crear"]');
  btn.disabled = true;
  const ref = colSeg().doc();
  c.segId = ref.id;
  ref.set(seg).catch(e => console.error("Manolo: segmento", e));
  if (c.ctl && c.ctl.resaltar) c.ctl.resaltar(null);
  // Buscar en todas las demás carreras.
  const cuerpo = document.getElementById("rs-cuerpo");
  const otras = RunDatos.lista("running").filter(d => d.id !== c.doc.id);
  cuerpo.innerHTML = `<div class="ri-avance"><p><b>Segmento creado: ${esc(seg.nombre)}</b></p><div class="ri-barra"><i style="width:0%"></i></div><p class="ri-nota" id="rs-avance">Buscándolo en tus carreras…</p></div>`;
  document.getElementById("rs-acciones").innerHTML = "";
  const encontrados = await buscar(seg, otras, leerDeFirestore, (i, n) => {
    const barra = cuerpo.querySelector(".ri-barra i"), txt = document.getElementById("rs-avance");
    if (barra) barra.style.width = `${n ? Math.round(100 * i / n) : 100}%`;
    if (txt) txt.textContent = n ? `Buscándolo en tus carreras: ${i} de ${n}` : "Buscándolo en tus carreras…";
  });
  const n = Object.keys(encontrados).length;
  if (n) await ref.set({ esfuerzos: encontrados }, { merge: true }).catch(e => console.error(e));
  cuerpo.innerHTML = `<div class="ri-avance"><p class="ri-grande"><b>¡Listo!</b></p><p>${n ? `Lo encontré en ${n} ${n === 1 ? "carrera más" : "carreras más"}.` : "Por ahora solo está en esta carrera; se sumarán las próximas."}</p></div>`;
  document.getElementById("rs-acciones").innerHTML = `<button type="button" class="txn-save" data-rsh="ver">Ver el segmento</button>`;
}

// ---- Lista (pestaña Segmentos) ----
function pintarLista() {
  const app = document.getElementById("rs-app");
  if (!app || location.hash.replace(/^#/, "").split("/")[0] !== "run-segmentos") return;
  const segs = RunDatos.segmentos().slice().sort((a, b) => (b.creado || 0) - (a.creado || 0));
  if (!segs.length) {
    app.innerHTML = `<div class="run-vacio"><span class="icon" data-icon="segmento"></span>
      <p><b>Tus tramos favoritos, cronometrados solos.</b></p>
      <p>Abre una carrera con ruta, toca ⋯ y elige <b>Crear segmento</b>: marca el inicio y el fin (una subida, una vuelta al parque) y Manolo lo buscará en todas tus carreras.</p></div>`;
    renderIcons(app);
    return;
  }
  app.innerHTML = `<ul class="rs-lista">${segs.map(s => {
    const tb = S.tabla(s);
    const pts = S.trazo(s);
    return `<li><a class="rs-card" href="#run-segmento/${encodeURIComponent(s.id)}">
      <span class="rs-card-mapa">${V.svgRuta([pts], { ancho: 96, alto: 64, margen: 6, clase: "run-ruta" })}</span>
      <span class="rs-card-txt"><b>${esc(s.nombre)}</b><small>${V.km(s.distanciaM)}${s.pendiente != null ? ` · ${V.numero(s.pendiente, 1)} %` : ""} · ${tb.length} ${tb.length === 1 ? "vez" : "veces"}</small></span>
      <span class="rs-card-mejor">${tb.length ? `<b>${V.tiempo(tb[0].t)}</b><small>tu mejor</small>` : ""}</span></a></li>`;
  }).join("")}</ul>`;
}

// ---- Página de un segmento ----
let mapaSeg = null, segActual = null;
function idDeHash() {
  const p = location.hash.replace(/^#/, "").split("/");
  return p[0] === "run-segmento" ? decodeURIComponent(p.slice(1).join("/")) : null;
}
function pintarSegmento() {
  const id = idDeHash();
  const app = document.getElementById("rsg-app");
  if (!id) { if (mapaSeg) { mapaSeg.destruir(); mapaSeg = null; } segActual = null; return; }
  if (!app) return;
  if (!RunDatos.segmentosCargados()) { app.innerHTML = `<p class="rd-nota">Cargando…</p>`; return; }
  const s = RunDatos.segmentos().find(x => x.id === id);
  if (!s) { app.innerHTML = `<p class="rd-nota">Este segmento ya no existe.</p>`; return; }
  const tb = S.tabla(s);
  const docs = RunDatos.lista("running");
  const mismo = segActual === id;
  segActual = id;
  const fila = e => {
    const d = docs.find(x => x.id === e.id);
    return `<li class="${e.puesto <= 3 ? "is-podio" : ""}"><span class="rsg-puesto">${MED[e.puesto] || e.puesto}</span>
      <a href="#run-actividad/running/${encodeURIComponent(e.id)}">${esc(d ? (d.titulo || V.fechaActividad(d)) : e.fecha || "")}</a>
      <b>${V.tiempo(e.t)}</b><small>${V.ritmo(V.ritmoDe(e.t, s.distanciaM))} · ${esc(e.fecha ? V.fechaActividad({ date: e.fecha }) : "")}</small></li>`;
  };
  const html = `
    <div class="rd-cab"><h1 class="rd-titulo">${esc(s.nombre)}</h1>
      <div class="rd-menu"><button type="button" class="rd-menu-btn" aria-label="Más opciones" data-rsg="menu">⋯</button>
        <div class="rd-menu-lista" hidden role="menu">
          <button type="button" role="menuitem" data-rsg="renombrar">Renombrar</button>
          <button type="button" role="menuitem" data-rsg="buscar">Buscar de nuevo en mis carreras</button>
          <button type="button" role="menuitem" class="rd-peligro" data-rsg="eliminar">Eliminar segmento</button>
        </div></div></div>
    <p class="rd-meta">${[V.km(s.distanciaM), s.desnivelM != null ? `+${s.desnivelM} m` : "", s.pendiente != null ? `${V.numero(s.pendiente, 1)} % de pendiente media` : ""].filter(Boolean).join(" · ")}</p>
    <div class="rd-mapa-caja"><div class="rd-mapa" id="rsg-mapa"></div></div>
    <p class="rsg-aviso" id="rsg-aviso" aria-live="polite"></p>
    <section class="rd-sec"><h2>Tu tabla <small class="rsg-n">${tb.length} ${tb.length === 1 ? "vez" : "veces"}</small></h2>
      ${tb.length ? `<ol class="rsg-tabla">${tb.map(fila).join("")}</ol>` : `<p class="rd-nota">Todavía no pasaste por aquí en ninguna carrera con ruta.</p>`}
    </section>`;
  if (mismo && mapaSeg && document.getElementById("rsg-mapa")) {
    // Solo cambió la tabla: no se vuelve a crear el mapa.
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    app.querySelector(".rd-titulo").textContent = s.nombre;
    app.querySelector("section.rd-sec").replaceWith(tmp.querySelector("section.rd-sec"));
    return;
  }
  if (mapaSeg) mapaSeg.destruir();
  app.innerHTML = html;
  mapaSeg = RunMapa.crear(document.getElementById("rsg-mapa"), [S.trazo(s)], { alto: 220 });
}
function aviso(txt) { const el = document.getElementById("rsg-aviso"); if (el) el.textContent = txt; }
async function accionSegmento(a) {
  const s = RunDatos.segmentos().find(x => x.id === segActual);
  if (!s) return;
  if (a === "renombrar") {
    const nombre = prompt("Nombre del segmento", s.nombre);
    if (nombre && nombre.trim() && nombre.trim() !== s.nombre) colSeg().doc(s.id).update({ nombre: nombre.trim().slice(0, 60) });
  } else if (a === "eliminar") {
    if (!confirm(`¿Eliminar el segmento «${s.nombre}»? Tus carreras no se tocan.`)) return;
    colSeg().doc(s.id).delete();
    location.hash = "run-segmentos";
  } else if (a === "buscar") {
    if (navigator.onLine === false) return aviso("Hace falta internet para leer tus rutas.");
    const encontrados = await buscar(s, RunDatos.lista("running"), leerDeFirestore, (i, n) => aviso(i < n ? `Buscando en tus carreras: ${i} de ${n}…` : ""));
    const nuevos = Object.keys(encontrados).filter(id => !(s.esfuerzos || {})[id] || s.esfuerzos[id].t !== encontrados[id].t);
    if (nuevos.length) await colSeg().doc(s.id).set({ esfuerzos: encontrados }, { merge: true });
    aviso(nuevos.length ? `Listo: ${nuevos.length} ${nuevos.length === 1 ? "tiempo nuevo" : "tiempos nuevos"}.` : "Listo: no hay tiempos nuevos.");
  }
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-rsg]");
  if (!b || !e.target.closest("#panel-run-segmento")) {
    if (!e.target.closest(".rd-menu")) document.querySelectorAll("#panel-run-segmento .rd-menu-lista").forEach(l => { l.hidden = true; });
    return;
  }
  const lista = document.querySelector("#panel-run-segmento .rd-menu-lista");
  if (b.dataset.rsg === "menu") { lista.hidden = !lista.hidden; return; }
  lista.hidden = true;
  accionSegmento(b.dataset.rsg);
});
function pintar() { pintarLista(); pintarSegmento(); }
if (window.RunDatos) RunDatos.al(pintar);
window.addEventListener("hashchange", () => { if (hoja && !hoja.hidden && !document.querySelector("#rs-hoja .ri-avance")) cerrarHoja(); pintar(); });
document.addEventListener("DOMContentLoaded", pintar);
window.RunSegmentosUI = { crearDesde, detectarNuevas, buscar };
})();
