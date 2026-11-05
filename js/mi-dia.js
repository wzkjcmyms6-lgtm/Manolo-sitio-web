// ---------- "Mi día" (arriba de Inicio) ----------
// En una tarjeta: qué entrenar hoy y por qué, los hábitos que faltan, el
// versículo de hoy, cuánto queda para gastar hoy y cómo va Running. Cada
// fila lleva a su sección. Usa lo que cada sección ya tiene cargado (sin
// lecturas nuevas); las frases salen de js/mi-dia-motor.js (D-100).
// Se oculta con "Ocultar «Mi día»" y vuelve con "Mostrar «Mi día»" (al pie
// de Inicio); se recuerda en este teléfono.
(function () {
"use strict";

const CLAVE = "manolo.miDia.oculto";
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MARCA = { hecho: "✓", pendiente: "", aviso: "!", libre: "" };
const el = document.getElementById("mi-dia");
const mostrar = document.getElementById("mi-dia-mostrar");
if (!el) return;

let biblia = null; // lista normalizada de Biblia (llega con "manolo:fuente")

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function oculto() {
  try { return localStorage.getItem(CLAVE) === "1"; } catch (e) { return false; }
}
// Cada sección por separado: si una falla o no cargó, las demás siguen.
const probar = fn => { try { return fn(); } catch (e) { return null; } };

function datos() {
  const hoy = hoyIso();
  const d = {};
  d.ejercicio = probar(() => (window.EjHoy && window.EjercicioDatos && EjercicioDatos.estado.datos ? EjHoy.recomendacion() : null));
  d.habitos = probar(() => (window.Habitos && Habitos.resumenHoy ? Habitos.resumenHoy() : null));
  d.biblia = probar(() => {
    if (!biblia || !window.BibliaMotor) return null;
    const r = BibliaMotor.racha(biblia, hoy);
    const deHoy = biblia.find(e => e.fecha === hoy);
    return { hoyHecho: r.hoyHecho, actual: r.actual, total: r.total, cita: deHoy ? deHoy.cita : "" };
  });
  d.dinero = probar(() => (window.FinanzasResumen ? FinanzasResumen.hoy() : null));
  d.running = probar(() => {
    if (!window.RunDatos || !window.RunAnalisis) return null;
    const docs = RunDatos.lista("running");
    const meta = Number(((RunDatos.ajustes() || {}).metas || {}).semanaKm) || 0;
    const manana = window.EjRecuperacion ? EjRecuperacion.habitoManana(docs, hoy) : null;
    // La última carrera: "hoy", "ayer" o el día de la semana.
    // (si ese día hubo varias, la más larga).
    const kmDe = x => (Number(x.distanciaM) > 0 ? Number(x.distanciaM) / 1000 : Number(x.distance) || 0);
    const ult = docs.filter(x => x.date && x.date <= hoy).sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : kmDe(y) - kmDe(x)))[0];
    let ultima = null;
    if (ult) {
      const dias = Math.round((new Date(hoy + "T12:00:00") - new Date(ult.date + "T12:00:00")) / 86400000);
      const km = kmDe(ult);
      if (km > 0 && dias <= 14) ultima = { km, cuando: dias === 0 ? "hoy" : dias === 1 ? "ayer" : dias < 7 ? `el ${DIAS[new Date(ult.date + "T12:00:00").getDay()]}` : `hace ${dias} días` };
    }
    return { kmSemana: docs.length ? RunAnalisis.periodo(docs, "semana", hoy).km : 0, meta, manana, ultima };
  });
  return d;
}

function render() {
  const fuera = oculto();
  if (mostrar) mostrar.hidden = !fuera;
  if (fuera) { el.hidden = true; return; }
  const filas = MiDiaMotor.filas(datos());
  if (!filas.length) { el.hidden = true; return; }
  const f = new Date();
  el.innerHTML = `<div class="md-cab"><span class="md-eyebrow">Mi día · ${DIAS[f.getDay()]} ${f.getDate()} ${MESES[f.getMonth()]}</span>
      <h2 id="mi-dia-t">${esc(MiDiaMotor.titular(filas))}</h2></div>
    <ul class="md-filas">${filas.map(x => `<li><a class="md-fila is-${x.estado}" href="${esc(x.href)}" data-md="${esc(x.id)}">
      <span class="md-ico" data-icon="${esc(x.icono)}" aria-hidden="true"></span>
      <span class="md-txt"><b>${esc(x.titulo)}</b>${x.detalle ? `<small>${esc(x.detalle)}</small>` : ""}</span>
      <span class="md-marca" aria-hidden="true">${MARCA[x.estado] || ""}</span></a></li>`).join("")}</ul>
    <button type="button" class="md-ocultar" data-md-ocultar>Ocultar «Mi día»</button>`;
  if (typeof renderIcons === "function") renderIcons(el);
  el.hidden = false;
}

let pendiente = false;
function pedir() {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(() => { pendiente = false; render(); });
}

el.addEventListener("click", e => {
  if (!e.target.closest("[data-md-ocultar]")) return;
  try { localStorage.setItem(CLAVE, "1"); } catch (err) { /* sin almacenamiento */ }
  render();
});
if (mostrar) mostrar.addEventListener("click", () => {
  try { localStorage.removeItem(CLAVE); } catch (err) { /* sin almacenamiento */ }
  render();
  el.scrollIntoView && el.scrollIntoView({ block: "nearest" });
});

window.addEventListener("manolo:fuente", e => {
  const d = e.detail || {};
  if (d.fuente === "biblia") biblia = d.datos || [];
  pedir();
});
window.addEventListener("manolo:inicio", pedir);
window.addEventListener("hashchange", pedir);
document.addEventListener("rutinas:cambio", pedir);
document.addEventListener("ejercicio:ajustes", pedir);
document.addEventListener("visibilitychange", () => { if (!document.hidden) pedir(); });
if (window.EjercicioDatos) EjercicioDatos.onCambio(pedir);
if (window.RunDatos && RunDatos.al) RunDatos.al(pedir);
pedir();
window.MiDia = { render };
})();
