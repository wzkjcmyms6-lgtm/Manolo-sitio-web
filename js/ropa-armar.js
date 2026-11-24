// ---------- Ropa: Armar el mío (#ropa-armar, D-156) ----------
// Tu outfit, prenda por prenda, sin IA y sin internet. Arriba, lo que elegiste
// en capas (de afuera hacia adentro), con ✕ para sacar cada prenda, "Ver en
// grande" y los avisos (solo avisan: js/ropa-armar-motor.js). En el medio, las
// partes (arriba, abajo, abrigo, zapatos, accesorios, cuerpo entero) y las
// fotos de cada una, con filtros de color y clima: tocar una la suma o la saca
// (en abajo, abrigo, zapatos y cuerpo entero, otra cambia la que había). Abajo,
// la ocasión, un nombre si quieres, "Me lo pongo", "Guardar" y "Para mañana".
// #ropa-armar/o/{id}: editar un guardado; #ropa-armar/d/{id}: duplicarlo.
// Desde una opción de Outfits, "Cambiar una prenda" (RopaArmar.abrir). El
// borrador se recuerda en este teléfono (manolo.ropa.armar).
(function () {
"use strict";
const M = window.RopaMotor, O = window.RopaOutfitMotor, AR = window.RopaArmarMotor, C = window.RopaClima;
const D = window.RopaDatos, DO = window.RopaOutfitsDatos, DI = window.RopaInspDatos;
const A = () => window.RopaApp, OF = () => window.RopaOutfits;
const app = document.getElementById("roar-app");
if (!M || !O || !AR || !C || !D || !DO || !DI || !app || !window.Lectura) return;
const { esc } = window.Lectura;
const partes = () => location.hash.replace(/^#/, "").split("/");
const pantalla = () => partes()[0];
const icono = n => `<span data-icon="${n}" aria-hidden="true"></span>`;
const pintarIconos = el => { if (typeof renderIcons === "function") renderIcons(el); };
const aviso = (t, d) => A().aviso(t, d);
const fallo = e => A().fallo(e);

// ---------- El borrador ----------
// { ids, parte, color, clima, ocasion, nombre, modo (nuevo | cambiar | editar |
// duplicar), deId (el guardado que editas o duplicas), base y datos (la opción
// de la que partiste: si no la cambias, se guarda como era) }.
const BORRADOR = "manolo.ropa.armar";
const nuevo = () => ({ ids: [], parte: "", color: "", clima: "", ocasion: "", nombre: "", modo: "nuevo", deId: "", base: [], datos: null });
let est = Object.assign(nuevo(), leerBorrador());
function leerBorrador() { try { const x = JSON.parse(localStorage.getItem(BORRADOR) || "null"); return x && typeof x === "object" ? x : {}; } catch (e) { return {}; } }
function guardarBorrador() { try { localStorage.setItem(BORRADOR, JSON.stringify(est)); } catch (e) { /* sin almacenamiento */ } }

// Desde Outfits: "Cambiar una prenda" (modo "cambiar", con la opción).
function abrir(ids, o) {
  const x = o || {};
  const listas = (ids || []).filter(id => D.una(id));
  est = Object.assign(nuevo(), { ids: listas, base: listas.slice(), modo: x.modo || "nuevo", ocasion: x.ocasion || "", datos: x.datos || null });
  guardarBorrador();
  if (pantalla() === "ropa-armar" && partes().length === 1) render();
  else location.hash = "ropa-armar";
}
// #ropa-armar/o/{id} (editar) y #ropa-armar/d/{id} (duplicar): una vez por guardado.
function desdeHash() {
  const [, que, id] = partes();
  if (!(que === "o" || que === "d") || !id) {
    // "Armar el mío" (sin un guardado): lo que editabas o duplicabas queda atrás.
    if (est.modo === "editar" || est.modo === "duplicar") { est = nuevo(); guardarBorrador(); }
    return true;
  }
  const modo = que === "o" ? "editar" : "duplicar", deId = decodeURIComponent(id);
  if (est.modo === modo && est.deId === deId) return true;
  const o = DO.una(deId);
  if (!o) return DO.cargada() ? "no" : false;   // todavía no llegaron tus outfits
  est = Object.assign(nuevo(), { ids: o.prendas.filter(x => D.una(x)), ocasion: o.ocasion, nombre: modo === "editar" ? o.nombre : "", modo, deId });
  guardarBorrador();
  return true;
}

// ---------- Lo de alrededor ----------
const ctxDia = () => (OF() && OF().contexto ? OF().contexto() : { dia: "hoy", fecha: D.hoy(), nec: null, clima: "", ciudad: "", ocasion: "" });
const propias = () => O.ocasionesPropias((DI.ajustes() || {}).ocasiones);
const ocasiones = () => O.OCASIONES.concat(propias());
const ocasion = () => { const v = est.ocasion || ctxDia().ocasion || "casual"; return ocasiones().some(o => o.id === v) ? v : "casual"; };
const tuRopa = () => D.lista().filter(p => p.estado !== "fuera");
const elegidas = () => AR.ordenar(est.ids.map(id => D.una(id)).filter(p => p && p.estado !== "fuera"));
const idsListos = () => elegidas().map(p => p.id);
// Lo que se guarda: si no cambiaste la opción de la que partiste, como era; si
// no, tuyo ("manual").
function datos() {
  const c = ctxDia();
  const igual = est.datos && O.clave(idsListos()) === O.clave(est.base || []);
  const base = igual ? est.datos : { origen: "manual" };
  return Object.assign({}, base, { ocasion: ocasion(), nombre: est.nombre.trim() || (igual ? base.nombre || "" : ""), ciudad: c.ciudad || base.ciudad || "", clima: c.clima || base.clima || "" });
}

// ---------- La pantalla ----------
function fotoHTML(p) { return A().fotoHTML(p, "ro-foto"); }
function outfitHTML(xs, avs) {
  const editando = est.modo === "editar" && DO.una(est.deId);
  return `<section class="tmp-card roar-outfit" aria-labelledby="roar-t">
    <div class="roar-cab"><h2 class="ro-sub" id="roar-t">Tu outfit</h2>
      ${xs.length ? `<button type="button" class="link-btn" data-roar="ver" aria-haspopup="dialog">${icono("ampliar")}Ver en grande</button>` : ""}</div>
    ${editando ? `<p class="rd-nota roar-editando">Editando ${editando.nombre ? `«${esc(editando.nombre)}»` : "un outfit guardado"}.</p>` : ""}
    ${est.modo === "duplicar" ? `<p class="rd-nota roar-editando">Una copia de tu outfit: cámbiale lo que quieras.</p>` : ""}
    ${xs.length ? `<ul class="roar-fila">${xs.map((p, k) => `<li>${fotoHTML(p)}<span class="roar-n" aria-hidden="true">${k + 1}</span>
        <button type="button" class="roar-x" data-roar-x="${esc(p.id)}" aria-label="Sacar ${esc(M.titulo(p))}">${icono("close")}</button>
        <small>${esc(M.titulo(p))}</small></li>`).join("")}</ul>`
      : `<p class="rd-nota roar-vacio">Elige abajo lo que te quieres poner: tócalo y aparece aquí.</p>`}
    <div class="roar-avisos" aria-live="polite">${avs.map(a => `<p class="roar-aviso${a.tipo === "info" ? " is-info" : ""}">${icono(a.tipo === "info" ? "clima" : "alerta")}<span>${esc(a.texto)}</span></p>`).join("")}</div>
  </section>`;
}
// La barra que queda fija al bajar: las partes y, cuando tu outfit ya no se
// ve, lo elegido en chico (tócalo para volver arriba).
function barraHTML(xs, todas, avs) {
  const n = avs.filter(a => a.tipo === "aviso").length;
  return `<div class="roar-barra">
    ${xs.length ? `<button type="button" class="roar-mini" data-roar="arriba" aria-label="Volver a tu outfit (${xs.length} ${xs.length === 1 ? "prenda" : "prendas"})">
      ${xs.map(p => fotoHTML(p)).join("")}<span class="roar-mini-n">${xs.length} ${xs.length === 1 ? "prenda" : "prendas"}${n ? ` · ${n} ${n === 1 ? "aviso" : "avisos"}` : ""}</span></button>` : ""}
    <div class="roar-partes" role="group" aria-label="Las partes del outfit">${AR.PARTES.filter(pt => todas.some(p => p.grupo === pt.id)).map(pt => {
      const k = xs.filter(p => p.grupo === pt.id).length;
      return `<button type="button" class="lug-chip${pt.id === est.parte ? " is-activo" : ""}" aria-pressed="${pt.id === est.parte}" data-roar-parte="${pt.id}">${pt.nombre}${k ? `<b class="roar-k" aria-label="(${k} elegida${k === 1 ? "" : "s"})">${k}</b>` : ""}</button>`;
    }).join("")}</div></div>`;
}
// Debajo de la barra de arriba de Manolo (en el teléfono).
function alturaBarra() {
  const t = document.querySelector(".topbar");
  const h = t && getComputedStyle(t).display !== "none" ? Math.round(t.getBoundingClientRect().height) : 0;
  app.style.setProperty("--roar-top", `${h}px`);
  return h;
}
let vigia = null;
function vigilar() {
  if (vigia) { vigia.disconnect(); vigia = null; }
  const card = app.querySelector(".roar-outfit"), mini = app.querySelector(".roar-mini");
  if (!card || !mini || !("IntersectionObserver" in window)) return;
  vigia = new IntersectionObserver(([e]) => mini.classList.toggle("is-visible", !e.isIntersecting), { rootMargin: `-${alturaBarra() + 60}px 0px 0px 0px` });
  vigia.observe(card);
}
window.addEventListener("resize", () => { if (pantalla() === "ropa-armar") alturaBarra(); });
const CLIMAS = [["", "Todo clima"], ["frio", "Para el frío"], ["templado", "Templado"], ["calor", "Para el calor"]];
function filtrosHTML(deParte) {
  const fams = M.familias(deParte);
  const climas = CLIMAS.filter(([v]) => !v || deParte.some(p => p.clima.includes(v)));
  const fila = (nombre, que, ops, actual) => `<div class="roar-fil" role="group" aria-label="${nombre}">${ops.map(([v, t, hex]) =>
    `<button type="button" class="lug-chip roar-chip${actual === v ? " is-activo" : ""}" aria-pressed="${actual === v}" data-roar-${que}="${esc(v)}">${hex ? `<i class="ro-muestra" style="background:${esc(hex)}" aria-hidden="true"></i>` : ""}${esc(t)}</button>`).join("")}</div>`;
  return `${fams.length > 1 ? fila("Color", "color", [["", "Todos los colores", null]].concat(fams.map(f => [f.id, f.nombre, f.hex])), est.color) : ""}
    ${climas.length > 2 ? fila("Clima", "clima", climas, est.clima) : ""}`;
}
function grillaHTML(deParte, xs) {
  const sel = new Set(xs.map(p => p.id));
  const vistas = M.filtrar(deParte, { color: est.color, clima: est.clima });
  const orden = M.ordenar(vistas, "mas", D.usos()).sort((a, b) => (a.estado === "lavar") - (b.estado === "lavar"));
  if (!orden.length) return `<p class="rd-nota roar-nada">Nada con ese filtro. <button type="button" class="link-btn" data-roar="sin-filtros">Quitar los filtros</button></p>`;
  return `<ul class="roar-grilla">${orden.map(p => {
    const on = sel.has(p.id), lavar = p.estado === "lavar";
    return `<li><button type="button" class="roar-p${on ? " is-sel" : ""}${lavar ? " is-lavar" : ""}" data-roar-p="${esc(p.id)}" aria-pressed="${on}">
      ${fotoHTML(p)}${on ? `<span class="roar-check" aria-hidden="true">${icono("check")}</span>` : ""}
      <span class="roar-p-n">${esc(M.titulo(p))}</span>${lavar ? `<span class="roar-p-l">Para lavar</span>` : ""}</button></li>`;
  }).join("")}</ul>`;
}
function pieHTML(xs) {
  const manana = ctxDia().dia === "manana";
  const editar = est.modo === "editar";
  return `<section class="roar-pie" aria-label="Guardar el outfit">
    <fieldset class="ro-campo"><legend>Para qué</legend><div class="ro-opciones">${ocasiones().map(o =>
      `<label class="ro-op-chip"><input type="radio" name="roar-ocasion" value="${esc(o.id)}"${ocasion() === o.id ? " checked" : ""}><span>${esc(o.nombre)}</span></label>`).join("")}</div></fieldset>
    <label class="rd-campo"><span>Nombre <small class="rd-nota">(si quieres)</small></span><input class="lib-input" name="roar-nombre" maxlength="40" value="${esc(est.nombre)}" placeholder="Por ejemplo: Oficina fresca" autocomplete="off"></label>
    ${xs.length >= 2 && window.RopaOpinion && window.RopaOpinion.disponible() ? `<button type="button" class="lib-btn-sec roar-opinar" data-roar="opinar" aria-haspopup="dialog">${icono("sparkle")}¿Qué opinas? <small>(tu estilista)</small></button>` : ""}
    <div class="roar-bots">
      <button type="button" class="lib-btn" data-roar="${manana ? "manana" : "puse"}"${xs.length ? "" : " disabled"}>${icono("check")}${manana ? "Para mañana" : "Me lo pongo"}</button>
      <button type="button" class="lib-btn-sec" data-roar="guardar"${xs.length ? "" : " disabled"}>${icono("guardar")}${editar ? "Guardar los cambios" : "Guardar"}</button>
      <button type="button" class="lib-btn-sec" data-roar="${manana ? "puse" : "manana"}"${xs.length ? "" : " disabled"}>${manana ? "Me lo pongo hoy" : "Para mañana"}</button>
    </div>
    ${xs.length ? `<button type="button" class="link-btn roar-cero" data-roar="cero">Empezar de cero</button>` : ""}
  </section>`;
}
function render(foco) {
  if (pantalla() !== "ropa-armar") return;
  if (!D.cargada()) { app.innerHTML = `<p class="rd-nota">Cargando…</p>`; return; }
  const listo = desdeHash();
  if (listo === false) { app.innerHTML = `<p class="rd-nota">Cargando…</p>`; return; }
  if (listo === "no") { app.innerHTML = `<p class="rd-nota">Ese outfit ya no está en tus guardados.</p><a class="lib-btn-sec" href="#ropa-outfits">Ir a Outfits</a>`; return; }
  const todas = tuRopa();
  if (!todas.length) {
    app.innerHTML = `<div class="run-vacio"><span class="icon" data-icon="ropa"></span><p><b>Primero, tu ropa.</b></p><p>Agrega tus prendas al ropero (con el +) y aquí armas tus outfits.</p><a class="lib-btn" href="#ropa">Ir al ropero</a></div>`;
    pintarIconos(app);
    return;
  }
  if (!AR.PARTES.some(pt => pt.id === est.parte && todas.some(p => p.grupo === pt.id))) est.parte = (AR.PARTES.find(pt => todas.some(p => p.grupo === pt.id)) || AR.PARTES[0]).id;
  const xs = elegidas();
  const tipoOc = O.tipoDe(O.ocasion(ocasion(), propias()));
  const avs = AR.avisos(xs, { nec: ctxDia().nec, ocasion: tipoOc, hayZapatos: todas.some(p => p.grupo === "zapatos" && p.estado === "activa") });
  const deParte = todas.filter(p => p.grupo === est.parte);
  app.innerHTML = `${outfitHTML(xs, avs)}
    ${barraHTML(xs, todas, avs)}
    <div class="roar-filtros">${filtrosHTML(deParte)}</div>
    ${grillaHTML(deParte, xs)}
    ${pieHTML(xs)}`;
  pintarIconos(app);
  alturaBarra();
  vigilar();
  if (foco) { const b = app.querySelector(foco); if (b) b.focus({ preventScroll: true }); }
}

// ---------- Guardar ----------
function terminar() {
  est = nuevo();
  guardarBorrador();
  location.hash = "ropa-outfits";
}
function vacio() { aviso("Elige al menos una prenda."); }
function ponerme() {
  const ids = idsListos();
  if (!ids.length) { vacio(); return; }
  const nuevas = ids.filter(id => !D.puestaHoy(id));
  DO.ponerme(ids, datos(), D.hoy()).then(r => aviso("Listo: anotado lo que te pusiste hoy.", () => DO.quitarme(r.id, nuevas, D.hoy(), r.nuevo).catch(fallo)), fallo);
  terminar();
}
// Guardar (o para mañana). Al editar, si cambiaste las prendas, el de antes
// deja de estar guardado (su historia queda); Deshacer deja todo como estaba.
function guardar(para) {
  const ids = idsListos();
  if (!ids.length) { vacio(); return; }
  const ya = DO.deCombo(ids), antes = ya ? DO.crudo(ya.id) : null;
  const viejo = est.modo === "editar" ? DO.una(est.deId) : null, antesViejo = viejo ? DO.crudo(viejo.id) : null;
  if (est.modo === "duplicar" && ya && ya.id === est.deId) { aviso("Es igual al que ya tienes: cámbiale algo para que sea otro."); return; }
  DO.guardarMio(ids, datos(), para || null).then(r => {
    const cambio = viejo && r.id !== viejo.id;
    const listo = para ? "Listo: queda para mañana." : viejo ? "Listo: guardé los cambios." : r.nuevo ? "Guardado en tus outfits." : "Listo: está en tus outfits.";
    const deshacer = () => Promise.all([
      r.nuevo ? DO.borrar(r.id) : DO.restaurar(r.id, antes),
      cambio ? DO.restaurar(viejo.id, antesViejo) : null
    ]).catch(fallo);
    return (cambio ? DO.quitarGuardado(viejo.id) : Promise.resolve()).then(() => aviso(listo, deshacer));
  }).catch(fallo);
  terminar();
}

// ---------- Los toques ----------
app.addEventListener("click", e => {
  const p = e.target.closest("[data-roar-p]");
  if (p) {
    const x = D.una(p.dataset.roarP);
    if (x) { est.ids = AR.tocar(idsListos(), x, tuRopa()); guardarBorrador(); render(`[data-roar-p="${CSS.escape(x.id)}"]`); }
    return;
  }
  const quitar = e.target.closest("[data-roar-x]");
  if (quitar) {
    const id = quitar.dataset.roarX;
    est.ids = idsListos().filter(x => x !== id);
    guardarBorrador();
    render(est.ids.length ? ".roar-x" : "[data-roar-parte].is-activo");
    return;
  }
  const parte = e.target.closest("[data-roar-parte]");
  if (parte) { est.parte = parte.dataset.roarParte; est.color = ""; est.clima = ""; guardarBorrador(); render(`[data-roar-parte="${est.parte}"]`); return; }
  const color = e.target.closest("[data-roar-color]");
  if (color) { est.color = color.dataset.roarColor; guardarBorrador(); render(`[data-roar-color="${CSS.escape(est.color)}"]`); return; }
  const clima = e.target.closest("[data-roar-clima]");
  if (clima) { est.clima = clima.dataset.roarClima; guardarBorrador(); render(`[data-roar-clima="${est.clima}"]`); return; }
  const b = e.target.closest("[data-roar]");
  if (!b || b.disabled) return;
  const a = b.dataset.roar;
  if (a === "ver") { if (OF() && OF().ver) OF().ver(idsListos(), est.nombre.trim() || "Tu outfit", b); }
  else if (a === "opinar") opinar(b);
  else if (a === "arriba") { window.scrollTo({ top: 0, behavior: "smooth" }); const v = app.querySelector('[data-roar="ver"]'); if (v) v.focus({ preventScroll: true }); }
  else if (a === "puse") ponerme();
  else if (a === "guardar") guardar(null);
  else if (a === "manana") { const c = ctxDia(); guardar(c.dia === "manana" ? c.fecha : C.manana(D.hoy())); }
  else if (a === "sin-filtros") { est.color = ""; est.clima = ""; guardarBorrador(); render(); }
  else if (a === "cero") {
    const antes = JSON.parse(JSON.stringify(est));
    est = Object.assign(nuevo(), { parte: est.parte });
    guardarBorrador();
    render();
    aviso("Empezaste de cero.", () => { est = antes; guardarBorrador(); render(); });
  }
});
app.addEventListener("change", e => {
  if (e.target.name !== "roar-ocasion") return;
  est.ocasion = e.target.value;
  guardarBorrador();
  render(`[name="roar-ocasion"][value="${CSS.escape(est.ocasion)}"]`);
});
app.addEventListener("input", e => {
  if (e.target.name !== "roar-nombre") return;
  est.nombre = e.target.value.slice(0, 40);
  guardarBorrador();
});

// "¿Qué opinas?" (D-160): tu estilista mira tu outfit; "Cambiar" lo aplica aquí (con Deshacer).
function opinar(desde) {
  const RP = window.RopaOpinion, PM = window.RopaOpinionMotor;
  if (!RP || !PM) return;
  RP.opinar(idsListos(), {
    desde, ocasion: O.ocasion(ocasion(), propias()).nombre,
    alCambiar: (sale, entra) => {
      const antes = est.ids.slice(), a = D.una(sale), b = D.una(entra);
      est.ids = PM.cambiar(idsListos(), sale, entra);
      guardarBorrador();
      render();
      aviso(`Listo: ${a ? M.titulo(a) : "esa prenda"} por ${b ? M.titulo(b) : "la otra"}.`, () => { est.ids = antes; guardarBorrador(); render(); });
    }
  });
}

// ---------- Cuándo se pinta ----------
function alEntrar() {
  if (pantalla() !== "ropa-armar") return;
  render();
  // El clima del día (para los avisos), si todavía no estaba.
  if (OF() && OF().pedirClima) OF().pedirClima().then(() => { if (pantalla() === "ropa-armar") render(); }, () => {});
}
window.addEventListener("hashchange", alEntrar);
document.addEventListener("DOMContentLoaded", alEntrar);
D.al(() => { if (pantalla() === "ropa-armar") render(); });
DO.al(() => { if (pantalla() === "ropa-armar") render(); });
DI.al(() => { if (pantalla() === "ropa-armar") render(); });
// Con la IA lista aparece "¿Qué opinas?" (D-160).
if (window.RopaIA) window.RopaIA.alCambiar(() => { if (pantalla() === "ropa-armar") render(); });
window.RopaArmar = { abrir, render };
})();
