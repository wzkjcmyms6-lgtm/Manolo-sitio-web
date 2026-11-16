// ---------- Rutinas del gimnasio desde un entreno (en el resumen) ----------
// Un bloque al final del resumen del entreno (js/ej-entreno-ui.js):
// - entreno de una rutina que hoy cambiaste: la lista de cambios (agregar,
//   quitar, series, orden), todos marcados; "Guardar en la rutina" guarda
//   los que dejes marcados. Con "Deshacer".
// - entreno libre: "Guardar como rutina" (queda al final de tus rutinas).
// Las rutinas se guardan como en el editor (users/{uid}/rutinas, formato de
// js/rutinas.js), con merge: nada más del documento se pierde.
// Lógica en js/rutina-desde-entreno.js; ver docs/EJERCICIO.md (D-125).
(function () {
"use strict";
const D = window.RutinaDesdeEntreno, R = window.EjRutinas;
if (!D || !R) return;

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const rutinas = () => (window.RutinasUI && RutinasUI.rutinas()) || [];
const col = () => EjercicioDatos.coleccion("rutinas");

// Estado por entreno (el resumen se vuelve a pintar al elegir el esfuerzo).
// rutina: la rutina tal como la dejamos al guardar o deshacer (la lista de
// RutinasUI se pone al día un poco después).
let de = null;   // { id, quitados: Set (cambios desmarcados), hecho: { texto, deshacer }, rutina }
function estado(entreno) {
  const id = entreno.id || entreno.startedAt || "x";
  if (!de || de.id !== id) de = { id, quitados: new Set(), hecho: null, rutina: null };
  return de;
}
function rutinaDe(entreno) {
  const st = estado(entreno);
  if (st.rutina && st.rutina.id === entreno.rutinaId) return st.rutina;
  return rutinas().find(x => x.id === entreno.rutinaId) || null;
}

function html(entreno) {
  if (!entreno || !(entreno.exercises || []).length) return "";
  const st = estado(entreno);
  if (st.hecho) {
    return `<section class="rde is-hecho" aria-live="polite"><p>${esc(st.hecho.texto)}</p>
      <button type="button" class="link-btn rde-deshacer" data-rde="deshacer">Deshacer</button></section>`;
  }
  if (entreno.rutinaId) {
    const r = rutinaDe(entreno);
    if (!r) return "";
    const cs = D.cambios(r, entreno);
    if (!cs.length) return "";
    return `
      <section class="rde" aria-labelledby="rde-t">
        <h4 class="ejf-sub" id="rde-t">Hoy cambiaste «${esc(r.name)}»</h4>
        <p class="rde-txt">¿Guardar estos cambios en la rutina para la próxima vez? Quita la marca de lo que fue solo por hoy.</p>
        <div class="rde-lista">${cs.map(c => `
          <label class="rde-op is-${c.tipo}"><input type="checkbox" data-rde-cambio="${esc(c.id)}"${st.quitados.has(c.id) ? "" : " checked"}><span>${esc(c.texto)}</span></label>`).join("")}
        </div>
        <button type="button" class="ejf-btn rde-guardar" data-rde="guardar"${cs.every(c => st.quitados.has(c.id)) ? " disabled" : ""}>Guardar en la rutina</button>
        <p class="rde-nota">Los pesos no cambian: los ajusta la progresión.</p>
      </section>`;
  }
  return `
    <section class="rde" aria-labelledby="rde-t">
      <h4 class="ejf-sub" id="rde-t">¿Repetir este entreno?</h4>
      <p class="rde-txt">Guárdalo como rutina y la próxima vez lo empiezas con un toque.</p>
      <button type="button" class="ejf-btn-sec rde-guardar" data-rde="nueva">Guardar como rutina</button>
    </section>`;
}

function guardarEnRutina(entreno, repintar) {
  const st = estado(entreno);
  const r = rutinaDe(entreno);
  if (!r) return;
  const elegidos = D.cambios(r, entreno).map(c => c.id).filter(id => !st.quitados.has(id));
  if (!elegidos.length) return;
  const antes = { id: r.id, name: r.name, orden: r.orden, items: r.items.map(it => Object.assign({}, it)) };
  const nueva = D.aplicar(r, entreno, elegidos);
  st.rutina = Object.assign({}, antes, { items: nueva.items });
  col().doc(r.id).set(R.aGuardar({ name: r.name, orden: r.orden, items: nueva.items }), { merge: true })
    .catch(err => { console.error("Manolo: no se pudo actualizar la rutina", err); alert("No se pudo guardar la rutina."); });
  st.hecho = {
    texto: `✓ Cambios guardados en «${r.name}».`,
    deshacer: () => {
      st.rutina = antes;
      col().doc(r.id).set(R.aGuardar(antes), { merge: true }).catch(err => console.error("Manolo: no se pudo deshacer", err));
    }
  };
  repintar();
}
function guardarNueva(entreno, repintar) {
  const st = estado(entreno);
  const lista = rutinas();
  const nueva = D.desdeEntreno(entreno, lista.map(r => r.name));
  if (!nueva.items.length) return;
  const orden = Math.max(0, ...lista.map(r => r.orden || 0)) + 1;
  const ref = col().doc();
  ref.set(R.aGuardar({ name: nueva.name, orden, items: nueva.items }))
    .catch(err => { console.error("Manolo: no se pudo crear la rutina", err); alert("No se pudo guardar la rutina."); });
  st.hecho = {
    texto: `✓ Guardado como la rutina «${nueva.name}» (está en Rutinas).`,
    deshacer: () => ref.delete().catch(err => console.error("Manolo: no se pudo deshacer", err))
  };
  repintar();
}

// Toques dentro del bloque. true si era suyo.
function click(e, entreno, repintar) {
  if (!entreno) return false;
  const caja = e.target.closest(".rde");
  if (!caja) return false;
  const st = estado(entreno);
  const op = e.target.closest("[data-rde-cambio]");
  if (op) {
    if (op.checked) st.quitados.delete(op.dataset.rdeCambio); else st.quitados.add(op.dataset.rdeCambio);
    const b = caja.querySelector('[data-rde="guardar"]');
    if (b) b.disabled = ![...caja.querySelectorAll("[data-rde-cambio]")].some(x => x.checked);
    return true;
  }
  const b = e.target.closest("[data-rde]");
  if (!b || b.disabled) return true;
  if (b.dataset.rde === "guardar") guardarEnRutina(entreno, repintar);
  else if (b.dataset.rde === "nueva") guardarNueva(entreno, repintar);
  else if (b.dataset.rde === "deshacer" && st.hecho) {
    const f = st.hecho.deshacer;
    st.hecho = null;
    st.quitados = new Set();
    f();
    repintar();
  }
  return true;
}

window.RutinaDesdeEntrenoUI = { html, click };
})();
