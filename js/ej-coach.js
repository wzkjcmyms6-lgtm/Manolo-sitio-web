// ---------- Entrenador de Ejercicio (tarjetas) ----------
// Arriba de la pestaña Entrenamiento (#ej-coach) y de Gimnasio (#gym-coach):
// - Semana de descarga: la sugiere cuando coinciden 2+ señales
//   (js/ej-programa.js) y se aplica con un toque; mientras dura, un aviso
//   con "Terminar". "Ahora no" la calla 7 días (en este teléfono).
// La fase 6 suma aquí la recuperación y "¿Qué entreno hoy?".
(function () {
"use strict";

const CLAVE_CALLAR = "manolo.descarga.ahoraNo";
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fechaTxt(iso) {
  const d = new Date(iso + "T12:00:00");
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}
function callada() {
  try { return Number(localStorage.getItem(CLAVE_CALLAR) || 0) > Date.now(); } catch (e) { return false; }
}

function datos() {
  const st = EjercicioDatos.estado;
  return { st, hoy: hoyIso(), descargas: (st.ajustes && st.ajustes.descargas) || {} };
}
function descargaActiva() {
  const { hoy, descargas } = datos();
  return EjPrograma.descargaActiva(descargas, hoy);
}
function senales() {
  const { st, hoy, descargas } = datos();
  const idDe = ex => { const f = EjercicioDatos.resolver(ex.name, ex.exerciseId); return f ? f.id : null; };
  const nombreDe = id => { const f = EjercicioDatos.ficha(id); return f ? f.nombre : id; };
  return EjPrograma.senalesDescarga(st.registros.gimnasio || [], idDe, { hoy, descargas, nombreDe });
}

function html() {
  const activa = descargaActiva();
  if (activa) {
    return `<section class="ejc-card is-descarga" aria-label="Semana de descarga">
      <div><span class="ejc-eyebrow">Semana de descarga</span><strong>Hasta el ${esc(fechaTxt(activa.hasta))}</strong>
      <small>Tus rutinas vienen con menos series y algo menos de peso.</small></div>
      <button type="button" class="ejc-btn-sec" data-ejc="terminar-descarga">Terminar</button></section>`;
  }
  const s = senales();
  if (!s.sugerir || callada()) return "";
  return `<section class="ejc-card" aria-label="Te conviene una descarga">
    <div><span class="ejc-eyebrow">Te conviene una semana de descarga</span>
    <ul class="ejc-senales">${s.senales.map(x => `<li>${esc(x.texto)}</li>`).join("")}</ul>
    <small>Una semana con menos series (~40 %) y algo menos de peso (~10 %) para recuperarte y volver más fuerte.</small></div>
    <div class="ejc-acciones"><button type="button" class="ejc-btn" data-ejc="aplicar-descarga">Aplicar descarga</button>
    <button type="button" class="ejc-btn-sec" data-ejc="ahora-no">Ahora no</button></div></section>`;
}

function render() {
  if (!EjercicioDatos.estado.cargado.gimnasio && !(EjercicioDatos.estado.registros.gimnasio || []).length) return;
  const h = html();
  ["ej-coach", "gym-coach"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = h;
    el.hidden = !h;
  });
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-ejc]");
  if (!b) return;
  const acc = b.dataset.ejc;
  const { hoy } = datos();
  const ref = EjercicioDatos.meta("ajustes_ejercicio");
  if (acc === "aplicar-descarga") {
    const d = EjPrograma.nuevaDescarga(hoy);
    ref.set({ descargas: { [d.desde]: d.hasta } }, { merge: true });
    EjercicioDatos.estado.ajustes.descargas = Object.assign({}, EjercicioDatos.estado.ajustes.descargas, { [d.desde]: d.hasta });
  } else if (acc === "terminar-descarga") {
    const a = descargaActiva();
    if (!a) return;
    const ayer = EjPrograma.addDias(hoy, -1);
    const valor = a.desde > ayer ? firebase.firestore.FieldValue.delete() : ayer;
    ref.set({ descargas: { [a.desde]: valor } }, { merge: true });
    const loc = Object.assign({}, EjercicioDatos.estado.ajustes.descargas);
    if (a.desde > ayer) delete loc[a.desde]; else loc[a.desde] = ayer;
    EjercicioDatos.estado.ajustes.descargas = loc;
  } else if (acc === "ahora-no") {
    try { localStorage.setItem(CLAVE_CALLAR, String(Date.now() + 7 * 86400000)); } catch (err) { /* sin almacenamiento */ }
  }
  render();
});

EjercicioDatos.onCambio(render);
window.EjCoach = { render, descargaActiva };
})();
