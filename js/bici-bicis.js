// ---------- Bici › Tus bicis y su mantenimiento (D-143) ----------
// Como las zapatillas de Running: nombre, tipo, km que ya tenía, la
// predeterminada (se pone sola en lo que importes o anotes desde que la
// agregaste; en cada rodada se cambia con Editar) y retirar. Por bici, el
// mantenimiento: cadena, cubiertas, pastillas de freno y service general,
// con lo que llevan desde el último cambio, "Hecho hoy" (vuelve a contar
// desde ahí) y cada cuánto (se puede cambiar). Todo en
// users/{uid}/meta/bici_ajustes (`bicis`, `mantenimiento`); los cálculos en
// js/bici-analisis.js.
(function () {
"use strict";
const V = window.RunVista, M = window.RunMetricas, B = window.BiciAnalisis;
if (!V || !M || !B || !window.RunDatos) return;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const usuario = () => db.collection("users").doc(currentUser.uid);
const ref = () => usuario().collection("meta").doc("bici_ajustes");
let editando = null;    // id de la bici en edición ("nueva" para agregar)
let intervalos = null;  // id de la bici a la que se le cambia cada cuánto
let aviso = "";

const visible = () => location.hash.replace(/^#/, "").split("/")[0] === "bici-bicis";
const hoy = () => M.fechaLocal(Date.now());
const num = v => { const n = Number(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : NaN; };
const nombreTipo = t => (B.TIPOS.find(x => x[0] === t) || [null, ""])[1];
const lista = () => (RunDatos.ajustesBici().bicis || []).map(b => Object.assign({}, b));

function pintar() {
  if (!visible()) return;
  const app = document.getElementById("bb-app");
  if (!app) return;
  if (!RunDatos.cargada("bicicleta")) { app.innerHTML = `<p class="rd-nota">Cargando…</p>`; return; }
  const aj = RunDatos.ajustesBici();
  const docs = RunDatos.lista("bicicleta");
  const bs = B.bicis(docs, aj.bicis || []);
  const mant = aj.mantenimiento || {};
  const enUso = bs.filter(b => !b.retirada), retiradas = bs.filter(b => b.retirada);
  app.innerHTML = `
    ${aviso ? `<p class="tmp-ok" role="status">${esc(aviso)}</p>` : ""}
    ${!bs.length && editando !== "nueva" ? `<div class="run-vacio"><span class="icon" data-icon="cycling"></span><p><b>Agrega tu bici.</b></p><p>Manolo sumará sus km con cada rodada y te avisará cuándo toca cambiar la cadena, las cubiertas, las pastillas o hacer el service.</p></div>` : ""}
    ${enUso.map(b => tarjeta(b, mant[b.id])).join("")}
    ${editando === "nueva" ? `<section class="tmp-card bb-bici">${form(null)}</section>` : `<button type="button" class="lib-btn-sec rd-btn" data-bb-nueva>Agregar bici</button>`}
    ${sinBici(docs, enUso)}
    ${retiradas.length ? `<h2 class="bb-sub">Retiradas</h2>${retiradas.map(b => tarjeta(b, mant[b.id])).join("")}` : ""}`;
  if (typeof renderIcons === "function") renderIcons(app);
}
function tarjeta(b, m) {
  if (editando === b.id) return `<section class="tmp-card bb-bici">${form(b)}</section>`;
  const piezas = B.mantenimiento(b, m, hoy());
  const meta = [nombreTipo(b.tipo), `${V.numero(b.km, 0)} km`, `${b.n} ${b.n === 1 ? "rodada" : "rodadas"}`, b.ultima ? `la última, ${V.fechaActividad({ date: b.ultima })}` : ""].filter(Boolean).join(" · ");
  return `<section class="tmp-card bb-bici${b.retirada ? " is-retirada" : ""}" data-bb-bici="${esc(b.id)}">
    <div class="bb-cab"><span class="rf-avatar bf-avatar" aria-hidden="true"><span class="icon" data-icon="cycling"></span></span>
      <div><div class="bb-nombre"><h2 class="bb-t">${esc(b.nombre)}</h2>${b.predeterminada ? ` <span class="act-tag">Predeterminada</span>` : ""}${b.retirada ? ` <span class="act-tag rf-tag-mano">Retirada</span>` : ""}</div><small>${esc(meta)}</small></div></div>
    ${b.retirada ? "" : `<h3 class="bb-mant-t">Mantenimiento</h3>
    ${intervalos === b.id ? formIntervalos(b, piezas) : `<ul class="bb-piezas">${piezas.map(p => `<li class="bb-pieza is-${p.estado}">
      <div class="bb-pieza-t"><b>${esc(p.nombre)}</b><small>${esc(p.texto)}</small></div>
      <div class="rp-zap-barra"><i style="width:${Math.round(p.pct * 100)}%"></i></div>
      <button type="button" class="tmp-quitar" data-bb-hecho="${esc(p.id)}">Hecho hoy</button></li>`).join("")}</ul>
    <button type="button" class="tmp-quitar bb-cada" data-bb-intervalos>Cambiar cada cuánto</button>`}`}
    <div class="ra-zap-btns">
      <button type="button" class="tmp-quitar" data-bb-editar>Editar</button>
      ${b.retirada ? `<button type="button" class="tmp-quitar" data-bb-volver>Volver a usar</button>` : `${b.predeterminada ? "" : `<button type="button" class="tmp-quitar" data-bb-pred>Predeterminada</button>`}<button type="button" class="tmp-quitar" data-bb-retirar>Retirar</button>`}
    </div>
  </section>`;
}
function form(b) {
  return `<form id="bb-form" data-id="${b ? esc(b.id) : ""}" novalidate>
    <h2 class="tmp-titulo">${b ? "Editar bici" : "Nueva bici"}</h2>
    <label class="rd-campo">Nombre<input class="lib-input" name="nombre" maxlength="40" value="${b ? esc(b.nombre) : ""}" placeholder="Ej.: Trek Domane" required></label>
    <label class="rd-campo">Tipo<select class="lib-input" name="tipo">${B.TIPOS.map(([v, t]) => `<option value="${v}"${(b ? b.tipo : "ruta") === v ? " selected" : ""}>${t}</option>`).join("")}</select></label>
    <label class="rd-campo">Km que ya tenía<input class="lib-input" name="kmInicial" inputmode="decimal" value="${b ? b.kmInicial || 0 : 0}"></label>
    <p class="tmp-nota ra-error" data-bb-error hidden></p>
    <div class="ra-zap-btns"><button type="button" class="lib-btn-sec rd-btn" data-bb-cancelar>Cancelar</button><button type="submit" class="lib-btn rd-btn">Guardar</button></div>
  </form>`;
}
function formIntervalos(b, piezas) {
  return `<form id="bb-int-form" data-id="${esc(b.id)}" novalidate>
    ${piezas.map(p => `<div class="ra-metas bb-int">
      <label class="rd-campo">${esc(p.nombre)}: cada (km)<input class="lib-input" name="${p.id}-km" inputmode="numeric" value="${p.cadaKm}"></label>
      ${p.cadaDias ? `<label class="rd-campo">o cada (días)<input class="lib-input" name="${p.id}-dias" inputmode="numeric" value="${p.cadaDias}"></label>` : ""}
    </div>`).join("")}
    <p class="tmp-nota ra-error" data-bb-int-error hidden></p>
    <div class="ra-zap-btns"><button type="button" class="lib-btn-sec rd-btn" data-bb-int-cancelar>Cancelar</button><button type="submit" class="lib-btn rd-btn">Guardar</button></div>
  </form>`;
}
// Las rodadas sin bici: se la puedes poner a todas de una vez.
function sinBici(docs, enUso) {
  const n = docs.filter(d => !d.biciId).length;
  if (!n || !enUso.length) return "";
  const b = B.predeterminada(enUso) || enUso[0];
  return `<section class="tmp-card bb-sin">
    <p class="tmp-nota">${n} ${n === 1 ? "rodada no tiene" : "rodadas no tienen"} bici: sus km no cuentan en ninguna. En cada rodada puedes elegirla con <b>Editar</b>.</p>
    <button type="button" class="lib-btn-sec rd-btn" data-bb-asignar="${esc(b.id)}">Ponerle «${esc(b.nombre)}» a ${n === 1 ? "esa rodada" : `las ${n}`}</button>
  </section>`;
}
function error(sel, txt) {
  const el = document.querySelector(sel);
  if (!el) return;
  el.textContent = txt;
  el.hidden = !txt;
}
const guardarLista = l => ref().set({ bicis: l }, { merge: true }).catch(e => { console.error(e); alert("No se pudo guardar."); });
// Un id que no se repite (la hora y algo al azar).
function idNuevo(l) {
  let id;
  do id = `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; while (l.some(b => b.id === id));
  return id;
}
function guardarBici(f) {
  const nombre = f.elements.nombre.value.trim();
  const kmI = num(f.elements.kmInicial.value || 0);
  const tipo = f.elements.tipo.value;
  if (!nombre) return error("[data-bb-error]", "Escribe un nombre.");
  if (!(kmI >= 0 && kmI < 200000)) return error("[data-bb-error]", "Revisa los km que ya tenía.");
  const l = lista();
  const id = f.dataset.id;
  if (id) Object.assign(l.find(b => b.id === id) || {}, { nombre, tipo, kmInicial: Math.round(kmI * 10) / 10 });
  else l.push({ id: idNuevo(l), nombre, tipo, kmInicial: Math.round(kmI * 10) / 10, retirada: false, predeterminada: !l.some(b => b.predeterminada && !b.retirada), creado: Date.now() });
  editando = null;
  aviso = id ? "Bici actualizada." : "Bici agregada.";
  guardarLista(l);
  pintar();
}
function cambiarBici(id, fn) {
  const l = lista();
  l.forEach(b => fn(b, b.id === id));
  guardarLista(l);
}
function hechoHoy(id, pieza) {
  const b = B.bicis(RunDatos.lista("bicicleta"), RunDatos.ajustesBici().bicis || []).find(x => x.id === id);
  if (!b) return;
  const p = B.PIEZAS.find(x => x.id === pieza);
  ref().set({ mantenimiento: { [id]: { [pieza]: { desdeKm: Math.round(b.km * 10) / 10, desde: hoy() } } } }, { merge: true })
    .catch(e => { console.error(e); alert("No se pudo guardar."); });
  aviso = `Listo: ${p ? p.nombre.toLowerCase() : pieza} de «${b.nombre}» vuelve a contar desde hoy.`;
  pintar();
}
function guardarIntervalos(f) {
  const id = f.dataset.id;
  const cambios = {};
  for (const p of B.PIEZAS) {
    const km = num(f.elements[`${p.id}-km`].value);
    if (!(km >= 50 && km <= 100000)) return error("[data-bb-int-error]", "Los km van de 50 en adelante.");
    cambios[p.id] = { cadaKm: Math.round(km) };
    if (p.cadaDias) {
      const dias = num(f.elements[`${p.id}-dias`].value);
      if (!(dias >= 7 && dias <= 3650)) return error("[data-bb-int-error]", "Los días van de 7 a 3.650.");
      cambios[p.id].cadaDias = Math.round(dias);
    }
  }
  intervalos = null;
  aviso = "Listo: cada cuánto, guardado.";
  ref().set({ mantenimiento: { [id]: cambios } }, { merge: true }).catch(e => { console.error(e); alert("No se pudo guardar."); });
  pintar();
}
// Ponerle una bici a todas las rodadas que no tienen (en lotes de 400).
async function asignar(id, boton) {
  const b = lista().find(x => x.id === id);
  const sin = RunDatos.lista("bicicleta").filter(d => !d.biciId);
  if (!b || !sin.length) return;
  if (!confirm(`¿Ponerle «${b.nombre}» a ${sin.length === 1 ? "la rodada" : `las ${sin.length} rodadas`} sin bici? Después puedes cambiarla en cada una.`)) return;
  boton.disabled = true;
  try {
    for (let i = 0; i < sin.length; i += 400) {
      const lote = db.batch();
      sin.slice(i, i + 400).forEach(d => lote.update(usuario().collection("bicicleta").doc(d.id), { biciId: id }));
      await lote.commit();
    }
    aviso = `Listo: ${sin.length} ${sin.length === 1 ? "rodada" : "rodadas"} con «${b.nombre}».`;
  } catch (e) { console.error(e); alert("No se pudo guardar."); }
  pintar();
}

document.addEventListener("submit", e => {
  if (e.target.id === "bb-form") { e.preventDefault(); guardarBici(e.target); }
  else if (e.target.id === "bb-int-form") { e.preventDefault(); guardarIntervalos(e.target); }
});
document.addEventListener("click", e => {
  if (!e.target.closest("#panel-bici-bicis")) return;
  const btn = e.target.closest("button");
  if (!btn) return;
  const card = btn.closest("[data-bb-bici]");
  const id = card ? card.dataset.bbBici : null;
  const d = btn.dataset;
  if (d.bbNueva != null) { aviso = ""; editando = "nueva"; pintar(); }
  else if (d.bbCancelar != null) { editando = null; pintar(); }
  else if (d.bbEditar != null && id) { aviso = ""; editando = id; pintar(); }
  else if (d.bbIntervalos != null && id) { aviso = ""; intervalos = id; pintar(); }
  else if (d.bbIntCancelar != null) { intervalos = null; pintar(); }
  else if (d.bbHecho && id) hechoHoy(id, d.bbHecho);
  else if (d.bbPred != null && id) { aviso = ""; cambiarBici(id, (b, es) => { b.predeterminada = es; }); }
  else if (d.bbRetirar != null && id) {
    if (!confirm("¿Retirar esta bici? Sus km quedan guardados y deja de proponerse.")) return;
    aviso = "";
    cambiarBici(id, (b, es) => { if (es) { b.retirada = true; b.predeterminada = false; } });
  } else if (d.bbVolver != null && id) { aviso = ""; cambiarBici(id, (b, es) => { if (es) b.retirada = false; }); }
  else if (d.bbAsignar) asignar(d.bbAsignar, btn);
});
RunDatos.al(() => { if (!document.activeElement || !document.activeElement.closest("#bb-app form")) pintar(); });
window.addEventListener("hashchange", () => { aviso = ""; editando = null; intervalos = null; pintar(); });
document.addEventListener("DOMContentLoaded", pintar);
window.BiciBicis = { pintar };
})();
