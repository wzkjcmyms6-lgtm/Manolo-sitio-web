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
    // Fase 3 (D-106): los capítulos leídos en el lector cuentan para la racha.
    const L = window.BibliaLector, P = window.BibliaPlanes;
    const dias = L && P ? L.leidos() : {};
    const r = BibliaMotor.racha(biblia, hoy, P ? P.fechasLeidas(dias) : []);
    const deHoy = biblia.find(e => e.fecha === hoy);
    const pl = window.BibliaPlanesUI ? BibliaPlanesUI.estados().find(x => !x.e.terminado && x.e.lectura.length) : null;
    return { hoyHecho: r.hoyHecho, actual: r.actual, total: r.total, cita: deHoy ? deHoy.cita : "",
      capsHoy: (dias[hoy] || []).length, plan: pl ? { nombre: pl.e.nombre, texto: P.texto(pl.e.lectura) } : null };
  });
  d.dinero = probar(() => (window.FinanzasResumen ? FinanzasResumen.hoy() : null));
  d.tarjetas = probar(() => (window.FinanzasResumen && FinanzasResumen.tarjetas ? FinanzasResumen.tarjetas() : null));
  // Fase 7 (D-114): mi mañana, el libro que lees y el repaso de hoy.
  d.manana = probar(() => (window.TiemposManana && TiemposManana.paraMiDia ? TiemposManana.paraMiDia() : null));
  d.libro = probar(() => {
    const D = window.LibrosDatos, P = window.LibrosProgreso;
    if (!D || !P || !D.listo()) return null;
    const leyendo = D.lista().filter(l => l.estado === "leyendo" && !P.esAudio(l));
    if (!leyendo.length) return null;
    const porDia = P.paginasPorDia(D.lista());
    // El que tocaste último (el de la página más reciente).
    const ultimo = l => Object.keys(l.progreso || {}).sort().pop() || l.fechaInicio || "";
    const l = leyendo.slice().sort((a, b) => ultimo(b).localeCompare(ultimo(a)))[0];
    return { titulo: l.titulo, paginasHoy: porDia[hoy] || 0, meta: D.metaDia() };
  });
  d.repaso = probar(() => {
    const D = window.LibrosDatos, F = window.LibrosFrases;
    const frases = D && F && D.listo() ? F.paraHoy(D.frases(), hoy, D.frasesDia()).pendientes.length : 0;
    const versiculos = window.BibliaMemoriaUI && BibliaMemoriaUI.paraHoy ? BibliaMemoriaUI.paraHoy() : 0;
    return { frases, versiculos };
  });
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
  // Biblia manda también los días con capítulos leídos ({ fecha, leido }): aquí solo los versículos.
  if (d.fuente === "biblia") biblia = (d.datos || []).filter(e => e && !e.leido);
  pedir();
});
window.addEventListener("manolo:inicio", pedir);
window.addEventListener("biblia:lector", pedir);
window.addEventListener("biblia:planes", pedir);
window.addEventListener("biblia:memoria", pedir);
window.addEventListener("libros:datos", pedir);
window.addEventListener("tiempos:datos", pedir);
window.addEventListener("hashchange", pedir);
document.addEventListener("rutinas:cambio", pedir);
document.addEventListener("ejercicio:ajustes", pedir);
document.addEventListener("visibilitychange", () => { if (!document.hidden) pedir(); });
if (window.EjercicioDatos) EjercicioDatos.onCambio(pedir);
if (window.RunDatos && RunDatos.al) RunDatos.al(pedir);
pedir();
window.MiDia = { render };
})();
