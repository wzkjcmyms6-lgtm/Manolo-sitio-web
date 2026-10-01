// Ejercicio → tarjetas de sesión, detalle y Perfil.
// - Tarjeta de sesión (Feed y Perfil): usuario, fecha, rutina, tiempo,
//   volumen, series, reps y ejercicios con su mejor serie; en el Feed
//   compartido, también likes y comentarios (ver js/ej-social.js).
// - Detalle al tocar una sesión: todas las series; Editar y Eliminar solo en
//   las tuyas.
// - Perfil: cabecera con tus cifras, gráfico semanal de duración, volumen o
//   repeticiones (últimos 3 meses, último año o todo) y tu historial.
// Los entrenamientos llegan desde gimnasio.js (window.Gimnasio). Solo se
// dibuja la pantalla que se está viendo.
(function () {
const ES = EjSesiones;
let historial = [];
let resumenes = new Map(); // id de entreno → resumen
let sucioPerfil = true;
let rango = "3m";       // "3m" | "1a" | "todo"
let metrica = "volumen"; // "duracion" | "volumen" | "reps"
let barraElegida = null;
let historialVisibles = 10;
let detalle = null;      // sesión abierta en la hoja
const registro = new Map(); // clave → sesión dibujada (para abrirla al tocar)
const oyentesDetalle = [];
const oyentesHistorial = [];

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
function resumenEntreno(w) {
  let r = resumenes.get(w.id);
  if (!r) { r = ES.resumen(w, Gimnasio.volumen(w)); resumenes.set(w.id, r); }
  return r;
}
function ordenadas() {
  return historial.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.startedAt || 0) - (a.startedAt || 0));
}

// Una sesión para dibujar, venga de tu historial o del Feed compartido.
function sesionDeEntreno(w) {
  return {
    clave: "e:" + w.id, entrenoId: w.id, propio: true, uid: currentUser && currentUser.uid, usuario: nombreUsuario(),
    fecha: w.date, rutina: w.name || "Entrenamiento", ejercicios: w.exercises || [], r: resumenEntreno(w)
  };
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
function statsHTML(r) {
  return `<div class="ejf-stats">
    <div><span>Tiempo</span><strong>${duracionTxt(r.duracionMin)}</strong></div>
    <div><span>Volumen</span><strong>${volTxt(r.volumen)}</strong></div>
    <div><span>Series</span><strong>${r.series}</strong></div>
    <div><span>Reps</span><strong>${numero(r.reps, 0)}</strong></div>
  </div>`;
}

// ---- Tarjeta de sesión ----
// opciones.usuario: mostrar quién (Feed). ses.social: likes y comentarios.
function tarjetaHTML(ses, opciones) {
  registro.set(ses.clave, ses);
  const r = ses.r;
  const conUsuario = opciones && opciones.usuario;
  const cuando = ES.fechaRelativa(ses.fecha, hoy());
  const primeros = r.ejercicios.slice(0, 3);
  const resto = r.ejercicios.length - primeros.length;
  const s = ses.social;
  return `
    <article class="ejf-card">
      <button type="button" class="ejf-abrir" data-ej-abrir="${escapeHtml(ses.clave)}" aria-label="Ver ${escapeHtml(ses.rutina)}${conUsuario ? ` de ${escapeHtml(ses.usuario)}` : ""}, ${escapeHtml(cuando.toLowerCase())}"></button>
      ${conUsuario ? `<header class="ejf-head">
        <button type="button" class="ejf-quien-btn" data-ej-usuario="${escapeHtml(ses.uid || "")}" data-nombre="${escapeHtml(ses.usuario)}" aria-label="Ver récords de ${escapeHtml(ses.usuario)}">
          <span class="ejf-avatar" aria-hidden="true">${escapeHtml((ses.usuario || "?").charAt(0))}</span>
          <span class="ejf-quien"><strong>${escapeHtml(ses.usuario)}</strong><span>${escapeHtml(cuando)}</span></span>
        </button>
      </header>` : ""}
      <h3 class="ejf-titulo">${escapeHtml(ses.rutina)}${conUsuario ? "" : `<span class="ejf-fecha">${escapeHtml(cuando)}</span>`}</h3>
      ${statsHTML(r)}
      <ul class="ejf-ejs">${primeros.map(lineaEjercicio).join("")}</ul>
      ${resto > 0 ? `<p class="ejf-mas">Ver ${resto} ${resto === 1 ? "ejercicio" : "ejercicios"} más</p>` : ""}
      ${s ? `<footer class="ejf-social">
        <button type="button" class="ejf-accion${s.yoLike ? " is-on" : ""}" data-ej-like="${escapeHtml(s.postId)}" aria-pressed="${s.yoLike}" aria-label="${s.yoLike ? "Quitar me gusta" : "Me gusta"}${s.likes ? `, ${s.likes}` : ""}">
          <span data-icon="${s.yoLike ? "likeOn" : "like"}"></span><span>${s.likes || ""}</span></button>
        <button type="button" class="ejf-accion" data-ej-comentar="${escapeHtml(ses.clave)}" aria-label="Comentar${s.comentarios ? `, ${s.comentarios} comentarios` : ""}">
          <span data-icon="comment"></span><span>${s.comentarios || ""}</span></button>
      </footer>` : ""}
    </article>`;
}

// ---- Perfil: cabecera y gráfico semanal (estilo apps de gimnasio) ----
// Arriba tu nombre con Entrenos, Esta semana y Récords. Debajo, el valor de
// esta semana, el periodo (3 meses, 1 año o todo), las barras por semana con
// su escala y las pastillas Duración · Volumen · Repeticiones.
// Tocar una barra muestra esa semana; tocarla de nuevo vuelve a esta semana.
const RANGOS = { "3m": { semanas: 13, texto: "Últimos 3 meses" }, "1a": { semanas: 52, texto: "Último año" }, todo: { semanas: null, texto: "Todo" } };
const METRICAS = {
  duracion: { label: "Duración", valor: v => duracionTxt(v) },
  volumen: { label: "Volumen", valor: v => volTxt(v) },
  reps: { label: "Repeticiones", valor: v => `${numero(v, 0)} reps` }
};
// Etiqueta corta del eje: "30k kg", "1,5 h", "600 reps".
function etiquetaEje(v, metrica, tope) {
  if (metrica === "volumen") return v >= 1000 ? `${numero(v / 1000, 1)}k kg` : `${numero(v, 0)} kg`;
  if (metrica === "duracion") return tope >= 120 ? `${numero(v / 60, 1)} h` : `${numero(v, 0)} min`;
  return `${numero(v, 0)} reps`;
}
function cabeceraPerfilHTML() {
  const semana = ES.porSemana(historial, hoy(), 1, resumenEntreno)[0];
  const records = historial.reduce((s, w) => s + (Number(w.prs) || 0), 0);
  const nombre = nombreUsuario();
  return `
    <div class="ejd-perfil">
      <span class="ejd-avatar" aria-hidden="true">${escapeHtml(nombre.charAt(0))}</span>
      <div class="ejd-perfil-info">
        <p class="ejd-nombre">${escapeHtml(nombre)}</p>
        <div class="ejd-cifras">
          <div><span>Entrenos</span><strong>${numero(historial.length, 0)}</strong></div>
          <div><span>Esta semana</span><strong>${semana ? semana.sesiones : 0}</strong></div>
          <div><span>Récords</span><strong>${numero(records, 0)}</strong></div>
        </div>
      </div>
    </div>`;
}
function renderDashboard() {
  const el = $("ejd-dash");
  if (!el) return;
  const semanas = ES.porSemana(historial, hoy(), RANGOS[rango].semanas, resumenEntreno);
  const porMes = semanas.length > 60;
  const barras = porMes ? ES.porMes(semanas) : semanas;
  const max = Math.max(0, ...barras.map(b => b[metrica]));
  const { paso, tope } = ES.escalaY(max, metrica);
  const lineas = [];
  for (let v = 0; v <= tope + 1e-9; v += paso) lineas.push(v);
  const elegida = barraElegida != null && barraElegida < barras.length ? barraElegida : null;
  const b = barras[elegida != null ? elegida : barras.length - 1];
  const nombreBarra = x => (porMes ? ES.etiquetaMes(x.mes) : ES.etiquetaSemana(x.desde));
  const cuando = elegida == null
    ? (porMes ? "este mes" : "esta semana")
    : (porMes ? `en ${nombreBarra(b)}` : `semana del ${nombreBarra(b)}`);
  const cadaCuanto = Math.max(1, Math.ceil(barras.length / 6));
  const conEtiqueta = i => (barras.length - 1 - i) % cadaCuanto === 0;
  const pct = v => (tope > 0 ? (v / tope) * 100 : 0).toFixed(2);
  el.innerHTML = `
    ${cabeceraPerfilHTML()}
    <h2 class="visually-hidden" id="ejd-titulo">Tu progreso</h2>
    <div class="ejd-cab">
      <p class="ejd-valor" aria-live="polite"><strong>${escapeHtml(METRICAS[metrica].valor(b ? b[metrica] : 0))}</strong> ${escapeHtml(cuando)}</p>
      <label class="ejd-rango-sel">
        <span class="ejd-rango-txt">${RANGOS[rango].texto}</span>
        <select data-ejd-rango-sel aria-label="Periodo del gráfico">
          ${Object.keys(RANGOS).map(k => `<option value="${k}"${rango === k ? " selected" : ""}>${RANGOS[k].texto}</option>`).join("")}
        </select>
        <span class="ejd-rango-ic" data-icon="chevronDown" aria-hidden="true"></span>
      </label>
    </div>
    <div class="ejd-graf${elegida != null ? " con-eleccion" : ""}">
      <div class="ejd-ejey" aria-hidden="true">
        <span class="ejd-ejey-ancho">${escapeHtml(lineas.map(v => etiquetaEje(v, metrica, tope)).reduce((a, t) => (t.length > a.length ? t : a), ""))}</span>
        ${lineas.map(v => `<span style="bottom:${pct(v)}%">${escapeHtml(etiquetaEje(v, metrica, tope))}</span>`).join("")}
      </div>
      <div class="ejd-area">
        ${lineas.map(v => `<i class="ejd-linea" style="bottom:${pct(v)}%"></i>`).join("")}
        <div class="ejd-barras" role="group" aria-label="${METRICAS[metrica].label} por ${porMes ? "mes" : "semana"}">
          ${barras.map((x, i) => `<button type="button" class="ejd-col${i === elegida ? " sel" : ""}" data-ejd-col="${i}" aria-pressed="${i === elegida}" aria-label="${escapeHtml(nombreBarra(x))}: ${escapeHtml(METRICAS[metrica].valor(x[metrica]))}">
            <span class="ejd-bar" style="height:${x[metrica] > 0 ? Math.max(1.5, Number(pct(x[metrica]))) : 0}%"></span>
          </button>`).join("")}
        </div>
      </div>
      <span></span>
      <div class="ejd-ejex" aria-hidden="true">${barras.map((x, i) => `<span>${conEtiqueta(i) ? `<em>${escapeHtml(nombreBarra(x))}</em>` : ""}</span>`).join("")}</div>
    </div>
    <div class="ejd-metricas" role="group" aria-label="Qué mostrar en el gráfico">
      ${Object.keys(METRICAS).map(k => `<button type="button" class="ejd-pill${metrica === k ? " sel" : ""}" data-ejd-metrica="${k}" aria-pressed="${metrica === k}">${METRICAS[k].label}</button>`).join("")}
    </div>`;
  renderIcons(el);
}

// ---- Perfil: historial (solo tus sesiones) ----
function renderHistorialPerfil() {
  const cont = $("ejp-historial");
  if (!cont) return;
  const lista = ordenadas();
  $("ejp-historial-vacio").hidden = lista.length > 0;
  cont.innerHTML = lista.slice(0, historialVisibles).map(w => tarjetaHTML(sesionDeEntreno(w))).join("")
    + (lista.length > historialVisibles ? `<button type="button" class="ejp-ver-mas" data-ejp-mas>Ver ${Math.min(10, lista.length - historialVisibles)} más</button>` : "");
  renderIcons(cont);
}
function renderPerfil() {
  renderDashboard();
  renderHistorialPerfil();
  sucioPerfil = false;
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
function abrirDetalle(ses, opciones) {
  detalle = ses;
  const r = ses.r;
  const f = new Date(ses.fecha + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fecha = f.charAt(0).toUpperCase() + f.slice(1);
  $("ejs-titulo").textContent = ses.rutina;
  $("ejs-cuerpo").innerHTML = `
    <p class="ejs-fecha">${ses.propio ? "" : `${escapeHtml(ses.usuario)} · `}${escapeHtml(fecha)}</p>
    ${statsHTML(r)}
    ${ses.ejercicios.map(ex => {
      let n = 0;
      const sets = ex.sets || [];
      return `<section class="ejs-ej">
        <h4>${escapeHtml(ex.name || ex.nombre || "Ejercicio")}</h4>
        ${ex.minutos && !sets.length ? `<p class="ejs-nota">${numero(ex.minutos, 0)} min</p>` : ""}
        <ol class="ejs-series">${sets.map(s => serieTxt(s, s.calentamiento ? 0 : ++n)).join("")}</ol>
        ${ex.rpe ? `<p class="ejs-nota">RPE ${escapeHtml(ex.rpe)}</p>` : ""}
        ${ex.notas ? `<p class="ejs-nota">${escapeHtml(ex.notas)}</p>` : ""}
      </section>`;
    }).join("")}`;
  const editable = ses.propio && historial.some(w => w.id === ses.entrenoId);
  $("ejs-acciones").hidden = !editable;
  const social = $("ejs-social");
  social.hidden = !ses.social;
  social.innerHTML = "";
  oyentesDetalle.forEach(cb => { try { cb(ses, social, opciones || {}); } catch (e) { console.error(e); } });
  const hoja = $("ejs-hoja");
  hoja.hidden = false;
  hoja.classList.remove("is-closing");
  document.body.classList.add("sheet-open");
  renderIcons(hoja);
  if (!(opciones && opciones.comentar)) $("ejs-cerrar").focus();
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
  detalle = null;
  oyentesDetalle.forEach(cb => { try { cb(null); } catch (e) { console.error(e); } });
}

// ---- Eventos ----
document.addEventListener("click", e => {
  const ab = e.target.closest("[data-ej-abrir]");
  if (ab) { const ses = registro.get(ab.dataset.ejAbrir); if (ses) abrirDetalle(ses); return; }
  const com = e.target.closest("[data-ej-comentar]");
  if (com) { const ses = registro.get(com.dataset.ejComentar); if (ses) abrirDetalle(ses, { comentar: true }); return; }
  const m = e.target.closest("[data-ejd-metrica]");
  if (m) { metrica = m.dataset.ejdMetrica; renderDashboard(); return; }
  const c = e.target.closest("[data-ejd-col]");
  if (c) {
    const i = Number(c.dataset.ejdCol);
    barraElegida = barraElegida === i ? null : i;
    renderDashboard();
    return;
  }
  if (e.target.closest("[data-ejp-mas]")) { historialVisibles += 10; renderHistorialPerfil(); }
});
document.addEventListener("change", e => {
  const sel = e.target.closest("[data-ejd-rango-sel]");
  if (!sel || !RANGOS[sel.value]) return;
  rango = sel.value;
  barraElegida = null;
  renderDashboard();
});
$("ejs-cerrar").addEventListener("click", cerrarDetalle);
$("ejs-hoja").querySelector(".budget-sheet-overlay").addEventListener("click", cerrarDetalle);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("ejs-hoja").hidden) cerrarDetalle(); });
$("ejs-editar").addEventListener("click", () => {
  const w = detalle && historial.find(x => x.id === detalle.entrenoId);
  cerrarDetalle();
  if (w) Gimnasio.editar(w);
});
$("ejs-borrar").addEventListener("click", () => {
  const w = detalle && historial.find(x => x.id === detalle.entrenoId);
  if (w && Gimnasio.borrar(w)) cerrarDetalle();
});

function visible(id) {
  const p = $(id);
  return p && !p.hidden;
}
function dibujarVisibles() {
  if (sucioPerfil && visible("panel-ej-perfil")) renderPerfil();
}
window.addEventListener("hashchange", () => setTimeout(dibujarVisibles, 0));
document.addEventListener("DOMContentLoaded", () => setTimeout(dibujarVisibles, 0));

Gimnasio.alCambiarHistorial(lista => {
  historial = lista || [];
  resumenes = new Map();
  sucioPerfil = true;
  dibujarVisibles();
  oyentesHistorial.forEach(cb => { try { cb(historial); } catch (e) { console.error(e); } });
  if (detalle && detalle.propio && !historial.some(x => x.id === detalle.entrenoId)) cerrarDetalle();
});

// Para el Feed (js/ej-social.js).
window.EjVistas = {
  tarjetaHTML, abrirDetalle, cerrarDetalle, sesionDeEntreno, escapeHtml, numero, volTxt, duracionTxt, hoy, nombreUsuario, visible,
  historial: () => historial,
  ordenadas,
  detalleAbierto: () => detalle,
  alAbrirDetalle(cb) { oyentesDetalle.push(cb); },
  alCambiarHistorial(cb) { oyentesHistorial.push(cb); cb(historial); }
};
})();
