// Ejercicio → Feed y Perfil.
// - Feed: una tarjeta por sesión terminada (usuario, fecha, rutina, tiempo,
//   volumen, series, reps y ejercicios con su mejor serie). Por ahora con tus
//   sesiones; en la fase 2 se suman las de los demás.
// - Perfil: gráfico semanal de duración, volumen o reps (4 semanas,
//   12 semanas o todo) y tu historial. Tocar una sesión abre su detalle,
//   con Editar y Eliminar.
// Los entrenamientos llegan desde gimnasio.js (window.Gimnasio). Solo se
// dibuja la pantalla que se está viendo.
(function () {
const ES = EjSesiones;
let historial = [];
let resumenes = new Map(); // id → resumen (se recalcula al cambiar el historial)
let sucio = { feed: true, perfil: true };
let rango = "4";        // "4" | "12" | "todo"
let metrica = "volumen"; // "duracion" | "volumen" | "reps"
let barraElegida = null;
let historialVisibles = 10;
let detalleId = null;

const $ = id => document.getElementById(id);
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nombreUsuario() {
  const u = currentUser && currentUser.email ? currentUser.email.split("@")[0] : "";
  return u ? u.charAt(0).toUpperCase() + u.slice(1) : "Tú";
}
function numero(n, dec) {
  return Number(n || 0).toLocaleString("es-BO", { maximumFractionDigits: dec == null ? 1 : dec });
}
function duracionTxt(min) {
  const m = Math.round(min || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
// Volumen: con decimales solo si es chico (12.850 kg, 850,5 kg).
function volTxt(v) {
  return `${numero(v, v >= 1000 ? 0 : 1)} kg`;
}
function resumenDe(w) {
  let r = resumenes.get(w.id);
  if (!r) { r = ES.resumen(w, Gimnasio.volumen(w)); resumenes.set(w.id, r); }
  return r;
}
function ordenadas() {
  return historial.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.startedAt || 0) - (a.startedAt || 0));
}
function mejorSerieTxt(e) {
  if (e.minutos && !e.series) return `${numero(e.minutos, 0)} min`;
  const m = e.mejor;
  if (!m) return "";
  if (m.seg && !m.reps) return `${numero(m.seg, 0)} s`;
  return m.kg ? `${numero(m.kg)} kg × ${m.reps}` : `${m.reps} reps`;
}
function lineaEjercicio(e) {
  const que = e.minutos && !e.series ? `${numero(e.minutos, 0)} min` : `${e.series} ${e.series === 1 ? "serie" : "series"}`;
  const mejor = mejorSerieTxt(e);
  return `<li class="ejf-ej"><span class="ejf-ej-ic" aria-hidden="true"><span data-icon="exercise"></span></span>
    <span class="ejf-ej-txt"><span>${escapeHtml(que)} · ${escapeHtml(e.nombre)}</span>${mejor && e.series ? `<small>Mejor: ${escapeHtml(mejor)}</small>` : ""}</span></li>`;
}

// ---- Tarjeta de sesión (Feed y Perfil) ----
function tarjetaHTML(w, opciones) {
  const r = resumenDe(w);
  const conUsuario = opciones && opciones.usuario;
  const primeros = r.ejercicios.slice(0, 3);
  const resto = r.ejercicios.length - primeros.length;
  return `
    <article class="ejf-card">
      <button type="button" class="ejf-abrir" data-ej-ses="${escapeHtml(w.id)}" aria-label="Ver ${escapeHtml(w.name || "entrenamiento")} del ${escapeHtml(ES.fechaRelativa(w.date, hoy()).toLowerCase())}"></button>
      ${conUsuario ? `<header class="ejf-head">
        <span class="ejf-avatar" aria-hidden="true">${escapeHtml(conUsuario.charAt(0))}</span>
        <span class="ejf-quien"><strong>${escapeHtml(conUsuario)}</strong><span>${escapeHtml(ES.fechaRelativa(w.date, hoy()))}</span></span>
      </header>` : ""}
      <h3 class="ejf-titulo">${escapeHtml(w.name || "Entrenamiento")}${conUsuario ? "" : `<span class="ejf-fecha">${escapeHtml(ES.fechaRelativa(w.date, hoy()))}</span>`}</h3>
      <div class="ejf-stats">
        <div><span>Tiempo</span><strong>${duracionTxt(r.duracionMin)}</strong></div>
        <div><span>Volumen</span><strong>${volTxt(r.volumen)}</strong></div>
        <div><span>Series</span><strong>${r.series}</strong></div>
        <div><span>Reps</span><strong>${numero(r.reps, 0)}</strong></div>
      </div>
      <ul class="ejf-ejs">${primeros.map(lineaEjercicio).join("")}</ul>
      ${resto > 0 ? `<p class="ejf-mas">Ver ${resto} ${resto === 1 ? "ejercicio" : "ejercicios"} más</p>` : ""}
    </article>`;
}

// ---- Feed ----
function renderFeed() {
  const cont = $("ejf-lista");
  if (!cont) return;
  const lista = ordenadas();
  $("ejf-vacio").hidden = lista.length > 0;
  const nombre = nombreUsuario();
  cont.innerHTML = lista.slice(0, 30).map(w => tarjetaHTML(w, { usuario: nombre })).join("");
  renderIcons(cont);
  sucio.feed = false;
}

// ---- Perfil: gráfico semanal ----
const METRICAS = {
  duracion: { label: "Duración", total: v => duracionTxt(v), barra: v => duracionTxt(v) },
  volumen: { label: "Volumen", total: v => `${numero(v, 0)} kg`, barra: v => `${numero(v, 0)} kg` },
  reps: { label: "Reps", total: v => numero(v, 0), barra: v => `${numero(v, 0)} reps` }
};
function renderDashboard() {
  const el = $("ejd-dash");
  if (!el) return;
  const semanas = ES.porSemana(historial, hoy(), rango === "todo" ? null : Number(rango), resumenDe);
  const porMes = semanas.length > 26;
  const barras = porMes ? ES.porMes(semanas) : semanas;
  const tot = barras.reduce((a, b) => ({ duracion: a.duracion + b.duracion, volumen: a.volumen + b.volumen, reps: a.reps + b.reps, sesiones: a.sesiones + b.sesiones }), { duracion: 0, volumen: 0, reps: 0, sesiones: 0 });
  const max = Math.max(1, ...barras.map(b => b[metrica]));
  const sel = barraElegida != null && barraElegida < barras.length ? barraElegida : barras.length - 1;
  const b = barras[sel];
  const cadaCuanto = Math.max(1, Math.ceil(barras.length / 6));
  const nombreBarra = x => (porMes ? ES.etiquetaMes(x.mes) : ES.etiquetaSemana(x.desde));
  el.innerHTML = `
    <div class="ejd-top">
      <h2 class="ejd-titulo" id="ejd-titulo">Tu progreso</h2>
      <div class="fin-tabs ejd-rango" role="group" aria-label="Rango">
        ${[["4", "4 sem"], ["12", "12 sem"], ["todo", "Todo"]].map(([k, t]) => `<button type="button" class="fin-tab${rango === k ? " active" : ""}" data-ejd-rango="${k}" aria-pressed="${rango === k}">${t}</button>`).join("")}
      </div>
    </div>
    <div class="ejd-kpis">
      ${Object.keys(METRICAS).map(k => `<button type="button" class="ejd-kpi${metrica === k ? " sel" : ""}" data-ejd-metrica="${k}" aria-pressed="${metrica === k}">
        <span>${METRICAS[k].label}</span><strong>${METRICAS[k].total(tot[k])}</strong></button>`).join("")}
    </div>
    <p class="ejd-detalle" aria-live="polite">${b ? `<strong>${porMes ? "Mes de" : "Semana del"} ${escapeHtml(nombreBarra(b))}:</strong> ${METRICAS[metrica].barra(b[metrica])} · ${b.sesiones} ${b.sesiones === 1 ? "sesión" : "sesiones"}` : ""}</p>
    <div class="ejd-barras" role="group" aria-label="${METRICAS[metrica].label} por ${porMes ? "mes" : "semana"}">
      ${barras.map((x, i) => `<button type="button" class="ejd-col${i === sel ? " sel" : ""}" data-ejd-col="${i}" aria-pressed="${i === sel}" aria-label="${escapeHtml(nombreBarra(x))}: ${METRICAS[metrica].barra(x[metrica])}">
        <span class="ejd-par"><span class="ejd-bar" style="height:${x[metrica] > 0 ? Math.max(3, x[metrica] / max * 100).toFixed(1) : 0}%"></span></span>
        <span class="ejd-lbl">${i % cadaCuanto === 0 || i === barras.length - 1 ? escapeHtml(nombreBarra(x)) : ""}</span>
      </button>`).join("")}
    </div>
    <p class="ejd-pie">${tot.sesiones} ${tot.sesiones === 1 ? "sesión" : "sesiones"} ${rango === "todo" ? "en total" : `en las últimas ${rango} semanas`}${porMes ? " · agrupado por mes" : ""}.</p>`;
}

// ---- Perfil: historial (solo tus sesiones) ----
function renderHistorialPerfil() {
  const cont = $("ejp-historial");
  if (!cont) return;
  const lista = ordenadas();
  $("ejp-historial-vacio").hidden = lista.length > 0;
  cont.innerHTML = lista.slice(0, historialVisibles).map(w => tarjetaHTML(w)).join("")
    + (lista.length > historialVisibles ? `<button type="button" class="ejp-ver-mas" data-ejp-mas>Ver ${Math.min(10, lista.length - historialVisibles)} más</button>` : "");
  renderIcons(cont);
}
function renderPerfil() {
  renderDashboard();
  renderHistorialPerfil();
  sucio.perfil = false;
}

// ---- Detalle de una sesión ----
function serieTxt(s, i) {
  const kg = Number(s.kg), reps = Number(s.reps), seg = Number(s.seg), asis = Number(s.asistencia);
  const partes = [];
  if (asis > 0) partes.push(`−${numero(asis)} kg asistida`);
  else if (kg > 0) partes.push(`${numero(kg)} kg`);
  if (reps > 0) partes.push(`${reps} reps`);
  if (seg > 0) partes.push(`${seg} s`);
  return `<li><span class="ejs-n">${s.calentamiento ? "C" : i}</span><span>${partes.join(" × ") || "—"}</span></li>`;
}
function abrirDetalle(id) {
  const w = historial.find(x => x.id === id);
  if (!w) return;
  detalleId = id;
  const r = resumenDe(w);
  const f = new Date(w.date + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fecha = f.charAt(0).toUpperCase() + f.slice(1);
  $("ejs-titulo").textContent = w.name || "Entrenamiento";
  $("ejs-cuerpo").innerHTML = `
    <p class="ejs-fecha">${escapeHtml(fecha)}</p>
    <div class="ejf-stats">
      <div><span>Tiempo</span><strong>${duracionTxt(r.duracionMin)}</strong></div>
      <div><span>Volumen</span><strong>${volTxt(r.volumen)}</strong></div>
      <div><span>Series</span><strong>${r.series}</strong></div>
      <div><span>Reps</span><strong>${numero(r.reps, 0)}</strong></div>
    </div>
    ${(w.exercises || []).map(ex => {
      let n = 0;
      return `<section class="ejs-ej">
        <h4>${escapeHtml(ex.name || "Ejercicio")}</h4>
        ${ex.minutos && !(ex.sets || []).length ? `<p class="ejs-nota">${numero(ex.minutos, 0)} min</p>` : ""}
        <ol class="ejs-series">${(ex.sets || []).map(s => serieTxt(s, s.calentamiento ? 0 : ++n)).join("")}</ol>
        ${ex.rpe ? `<p class="ejs-nota">RPE ${escapeHtml(ex.rpe)}</p>` : ""}
        ${ex.notas ? `<p class="ejs-nota">${escapeHtml(ex.notas)}</p>` : ""}
      </section>`;
    }).join("")}`;
  const hoja = $("ejs-hoja");
  hoja.hidden = false;
  hoja.classList.remove("is-closing");
  document.body.classList.add("sheet-open");
  $("ejs-cerrar").focus();
}
function cerrarDetalle() {
  const hoja = $("ejs-hoja");
  if (hoja.hidden) return;
  hoja.classList.add("is-closing");
  setTimeout(() => {
    hoja.hidden = true;
    hoja.classList.remove("is-closing");
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden])"));
  }, 200);
  detalleId = null;
}

// ---- Eventos ----
document.addEventListener("click", e => {
  const ses = e.target.closest("[data-ej-ses]");
  if (ses) { abrirDetalle(ses.dataset.ejSes); return; }
  const r = e.target.closest("[data-ejd-rango]");
  if (r) { rango = r.dataset.ejdRango; barraElegida = null; renderDashboard(); return; }
  const m = e.target.closest("[data-ejd-metrica]");
  if (m) { metrica = m.dataset.ejdMetrica; renderDashboard(); return; }
  const c = e.target.closest("[data-ejd-col]");
  if (c) { barraElegida = Number(c.dataset.ejdCol); renderDashboard(); return; }
  if (e.target.closest("[data-ejp-mas]")) { historialVisibles += 10; renderHistorialPerfil(); }
});
$("ejs-cerrar").addEventListener("click", cerrarDetalle);
$("ejs-hoja").querySelector(".budget-sheet-overlay").addEventListener("click", cerrarDetalle);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("ejs-hoja").hidden) cerrarDetalle(); });
$("ejs-editar").addEventListener("click", () => {
  const w = historial.find(x => x.id === detalleId);
  cerrarDetalle();
  if (w) Gimnasio.editar(w);
});
$("ejs-borrar").addEventListener("click", () => {
  const w = historial.find(x => x.id === detalleId);
  if (w && Gimnasio.borrar(w)) cerrarDetalle();
});

// Solo se dibuja lo que se ve; lo demás queda marcado para cuando entres.
function visible(id) {
  const p = $(id);
  return p && !p.hidden;
}
function dibujarVisibles() {
  if (sucio.feed && visible("panel-ej-feed")) renderFeed();
  if (sucio.perfil && visible("panel-ej-perfil")) renderPerfil();
}
window.addEventListener("hashchange", () => setTimeout(dibujarVisibles, 0));
document.addEventListener("DOMContentLoaded", () => setTimeout(dibujarVisibles, 0));

Gimnasio.alCambiarHistorial(lista => {
  historial = lista || [];
  resumenes = new Map();
  sucio = { feed: true, perfil: true };
  dibujarVisibles();
  if (detalleId && !historial.some(x => x.id === detalleId)) cerrarDetalle();
});
})();
