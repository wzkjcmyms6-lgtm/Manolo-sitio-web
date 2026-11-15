// ---------- Medir tiempos: tus actividades (pantalla, fase 6) ----------
// "Tus actividades": crear, renombrar, elegir emoji, ordenar (ese es el
// orden de "Mi mañana"), sacar o poner en la mañana, de dónde se llena
// sola (Running, Ejercicio, Libros, Movilidad o nada) y archivar (sus
// tiempos quedan; vuelve con "Volver a usar"). Lógica en
// js/tiempos-actividades.js; guarda en meta/tiempos_ajustes. D-113.
(function () {
"use strict";
const A = window.TiemposActividades;
if (!A || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const D = () => window.TiemposDatos || null;
const hoja = window.Lectura.hoja("tact-hoja");
let editando = null;   // id que se edita, "nueva" o null
let emojiSel = "";

function todas() { return D() ? D().actividades() : A.lista(null); }
function guardar(lista) {
  const d = D();
  if (!d) return;
  d.guardarActividades(A.paraGuardar(lista));
}
const fuenteTxt = f => { const x = A.FUENTES.find(y => y.id === f); return x ? `se llena con ${x.nombre}` : ""; };

function abrir() {
  editando = null;
  const l = todas(), act = l.filter(a => !a.archivada), arch = l.filter(a => a.archivada);
  hoja.abrir("Tus actividades", `
    <div class="tact">
      <p class="tmp-nota">Este orden es el de «Mi mañana». Toca ✎ para cambiar el nombre, el emoji o si se llena sola.</p>
      <ol class="tact-lista">${act.map((a, i) => `
        <li class="tact-fila">
          <span class="tact-emoji" aria-hidden="true">${esc(a.emoji || "•")}</span>
          <span class="tact-nombre"><b>${esc(a.nombre)}</b><small>${esc([a.manana ? "en tu mañana" : "fuera de la mañana", fuenteTxt(a.fuente)].filter(Boolean).join(" · "))}</small></span>
          <button type="button" class="tact-b" data-tact-mover="${a.id}" data-delta="-1" aria-label="Subir ${esc(a.nombre)}"${i === 0 ? " disabled" : ""}>↑</button>
          <button type="button" class="tact-b" data-tact-mover="${a.id}" data-delta="1" aria-label="Bajar ${esc(a.nombre)}"${i === act.length - 1 ? " disabled" : ""}>↓</button>
          <button type="button" class="tact-b" data-tact-editar="${a.id}" aria-label="Editar ${esc(a.nombre)}">✎</button>
        </li>`).join("")}
      </ol>
      <button type="button" class="lib-btn-sec lib-btn-ancho" data-tact-editar="nueva">＋ Nueva actividad</button>
      ${arch.length ? `<h4 class="tact-h">Archivadas</h4>
      <ul class="tact-lista">${arch.map(a => `
        <li class="tact-fila is-archivada"><span class="tact-emoji" aria-hidden="true">${esc(a.emoji || "•")}</span><span class="tact-nombre"><b>${esc(a.nombre)}</b><small>sus tiempos quedan guardados</small></span>
          <button type="button" class="lib-btn-sec lib-btn-chico" data-tact-volver="${a.id}">Volver a usar</button></li>`).join("")}
      </ul>` : ""}
    </div>`);
}

function editar(id) {
  const l = todas(), a = id === "nueva" ? null : l.find(x => x.id === id);
  if (id !== "nueva" && !a) return;
  editando = id;
  emojiSel = a ? a.emoji : "⏰";
  hoja.abrir(a ? "Editar actividad" : "Nueva actividad", `
    <form class="lib-form tact-form" novalidate>
      <label class="lib-campo"><span>Nombre</span><input type="text" name="nombre" class="lib-input" maxlength="40" autocomplete="off" value="${esc(a ? a.nombre : "")}" placeholder="Ej: Orar"></label>
      ${a && a.detalle ? `<p class="lib-ayuda">${esc(a.detalle)}</p>` : ""}
      <div class="lib-campo"><span>Emoji</span>
        <div class="tact-emojis" role="radiogroup" aria-label="Emoji">${A.EMOJIS.map(x => `<button type="button" class="tact-e${x === emojiSel ? " is-sel" : ""}" data-tact-emoji="${esc(x)}" role="radio" aria-checked="${x === emojiSel}">${x}</button>`).join("")}</div>
      </div>
      <label class="tact-check"><input type="checkbox" name="manana"${!a || a.manana ? " checked" : ""}> Va en «Mi mañana»</label>
      <label class="lib-campo"><span>Se llena sola con</span><select name="fuente" class="lib-input">
        <option value="">Nada (la anoto yo)</option>
        ${A.FUENTES.map(f => `<option value="${f.id}"${a && a.fuente === f.id ? " selected" : ""}>${esc(f.nombre)}: ${esc(f.que)}</option>`).join("")}
      </select></label>
      <p class="lib-ayuda">Lo que anotas a mano siempre manda; empieza a llenarse desde hoy.</p>
      <p class="lib-error" role="alert" hidden></p>
      <div class="lib-acciones">
        ${a ? `<button type="button" class="lib-btn-peligro" data-tact-archivar="${a.id}">Archivar</button>` : `<button type="button" class="lib-btn-sec" data-tact-volver-lista>Cancelar</button>`}
        <button type="submit" class="lib-btn">Guardar</button>
      </div>
    </form>`);
}

hoja.el.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target, l = todas(), hoy = hoyLocal();
  const datos = { nombre: f.elements.nombre.value, emoji: emojiSel };
  const err = t => { const p = f.querySelector(".lib-error"); p.textContent = t; p.hidden = false; f.elements.nombre.classList.add("is-error"); };
  if (editando === "nueva") {
    const n = A.nueva(datos, l);
    if (!n.ok) { err(n.error); return; }
    const nueva = A.conFuente(Object.assign({ id: n.id }, n.doc, { manana: f.elements.manana.checked }), f.elements.fuente.value, hoy);
    guardar(l.concat([nueva]));
  } else {
    const a = l.find(x => x.id === editando);
    if (!a) return;
    const v = A.validar(datos, l, a.id);
    if (!v.ok) { err(v.error); return; }
    const cambiada = A.conFuente(Object.assign({}, a, { nombre: v.nombre, emoji: v.emoji, manana: f.elements.manana.checked }), f.elements.fuente.value, hoy);
    guardar(l.map(x => (x.id === a.id ? cambiada : x)));
  }
  abrir();
});
hoja.el.addEventListener("click", e => {
  const em = e.target.closest("[data-tact-emoji]");
  if (em) {
    emojiSel = em.dataset.tactEmoji;
    hoja.el.querySelectorAll("[data-tact-emoji]").forEach(b => { const on = b === em; b.classList.toggle("is-sel", on); b.setAttribute("aria-checked", String(on)); });
    return;
  }
  const mv = e.target.closest("[data-tact-mover]");
  if (mv) {
    const l = todas(), orden = A.mover(l, mv.dataset.tactMover, Number(mv.dataset.delta));
    if (orden) { guardar(l.map(a => Object.assign({}, a, { orden: orden[a.id] }))); abrir(); }
    return;
  }
  const ed = e.target.closest("[data-tact-editar]");
  if (ed) { editar(ed.dataset.tactEditar); return; }
  const ar = e.target.closest("[data-tact-archivar]");
  if (ar) {
    const l = todas(), a = l.find(x => x.id === ar.dataset.tactArchivar);
    if (!a || !confirm(`¿Archivar «${a.nombre}»? Sus tiempos quedan guardados y puedes volver a usarla.`)) return;
    if (l.filter(x => !x.archivada).length <= 1) { alert("Necesitas al menos una actividad."); return; }
    const fin = l.reduce((m, x) => Math.max(m, x.orden), 0) + 1;
    guardar(l.map(x => (x.id === a.id ? Object.assign({}, x, { archivada: true, orden: fin }) : x)));
    abrir();
    return;
  }
  const vo = e.target.closest("[data-tact-volver]");
  if (vo) {
    const l = todas(), maxAct = l.filter(x => !x.archivada).reduce((m, x) => Math.max(m, x.orden), -1);
    guardar(l.map(x => (x.id === vo.dataset.tactVolver ? Object.assign({}, x, { archivada: false, orden: maxAct + 0.5 }) : x)));
    abrir();
    return;
  }
  if (e.target.closest("[data-tact-volver-lista]")) abrir();
});
document.addEventListener("click", e => { if (e.target.closest("[data-tact-abrir]")) abrir(); });
window.addEventListener("tiempos:datos", () => { if (hoja.abierta() && !editando) abrir(); });

window.TiemposActividadesUI = { abrir };
})();
