// ---------- Hábitos: Scalping (masaje del cuero cabelludo, plan de 180 días) ----------
// Pantallas del hábito: tarjeta en la lista de Hoy, vista "Scalping"
// (#hab-scalping: Hoy · Progreso · Semana · Guía · Ajustes) y temporizador
// guiado a pantalla completa. Todo el contenido, el plan y los cálculos son
// de js/scalping-habit.js (ScalpingHabit), que no se modifica.
//
// Datos: es un hábito más en users/{uid}/habitos, con id fijo "scalping":
// - Para el motor de Hábitos es "Medible" con meta 2 sesiones: el día cuenta
//   como cumplido con mañana y noche, y como parcial con una sola. Así entra
//   solo en rachas, XP, niveles, estadísticas y días perfectos.
// - El estado propio del plan (ajustes, sesiones con minutos, aceite, nota y
//   fotos) va en el campo `scalping` del mismo documento.
// - Cada cambio sale de las funciones del módulo (markSession, setOil,
//   setNote, markPhotos, updateSettings) y se guarda por ruta de campo junto
//   con registros.AAAA-MM-DD (cantidad de sesiones del día).
// - "Hoy" es siempre ScalpingHabit.todayISO() (fecha local, no UTC).
(function () {
const S = ScalpingHabit;
const ID = S.HABIT_ID;
const TABS = [["hoy", "Hoy"], ["progreso", "Progreso"], ["semana", "Semana"], ["guia", "Guía"], ["ajustes", "Ajustes"]];
const ZONA_OPCIONES = [["", "Ninguna (toda la cabeza)"]].concat(S.PRIORITY_ZONES.map(z => [z, S.ZONES[z].nombre]));
const DIAS_CORTOS = { Domingo: "Dom", Lunes: "Lun", Martes: "Mar", "Miércoles": "Mié", Jueves: "Jue", Viernes: "Vie", "Sábado": "Sáb" };

let raw = null;          // documento de Firestore (o null si no existe)
let st = null;           // estado del plan, normalizado
let tab = "hoy";
let renderPendiente = false;
let notaTimer = null;
let guia = null;         // temporizador guiado abierto

const panel = document.getElementById("panel-hab-scalping");
const app = document.getElementById("sc-app");

// ---------- Utilidades ----------
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const col = () => db.collection("users").doc(currentUser.uid).collection("habitos");
const FP = (...p) => new firebase.firestore.FieldPath(...p);
const FV = () => firebase.firestore.FieldValue;
const hoy = () => S.todayISO();
const mmss = seg => `${Math.floor(seg / 60)}:${String(Math.max(0, seg) % 60).padStart(2, "0")}`;
const pct = v => (v == null ? "—" : `${Math.round(v * 100)} %`);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
function barra(fr, etiqueta) {
  const v = Math.max(0, Math.min(1, fr || 0));
  return `<div class="hb-xp sc-barra" role="progressbar" aria-label="${esc(etiqueta)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(v * 100)}"><span style="width:${(v * 100).toFixed(1)}%"></span></div>`;
}
function claveLocal(nombre) {
  return `manolo.scalping.${nombre}.${currentUser ? currentUser.uid : ""}`;
}
function leerLocal(nombre) {
  try { return localStorage.getItem(claveLocal(nombre)); } catch (e) { return null; }
}
function guardarLocal(nombre, valor) {
  try { localStorage.setItem(claveLocal(nombre), valor); } catch (e) { /* sin almacenamiento */ }
}
const activo = () => !!raw && !raw.archivado;

// ---------- Guardar ----------
// cambios: { fecha } para el registro de un día, { foto: "30" } para un
// control de fotos y { ajustes: true } para los ajustes (y la fecha de inicio).
function guardar(nuevo, cambios) {
  if (!raw) return;
  const args = [];
  if (cambios.fecha) {
    const f = cambios.fecha;
    const log = S.getLog(nuevo, f);
    const n = (log.manana.hecho ? 1 : 0) + (log.noche.hecho ? 1 : 0);
    args.push(FP("scalping", "logs", f), nuevo.logs[f]);
    args.push(FP("registros", f), n ? { v: n, t: Date.now() } : FV().delete());
  }
  if (cambios.foto) args.push(FP("scalping", "fotos", cambios.foto), nuevo.fotos[cambios.foto]);
  if (cambios.ajustes) args.push(FP("scalping", "settings"), nuevo.settings, FP("inicio"), nuevo.settings.startDate);
  args.push(FP("scalping", "version"), nuevo.version, FP("scalping", "habitId"), nuevo.habitId);
  st = nuevo;
  col().doc(ID).update(...args).catch(err => {
    console.error("Manolo: no se pudo guardar Scalping", err);
    alert("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
  });
  pintar();
}

function marcarSesion(sesion, hecho, minutos) {
  const f = hoy();
  const opciones = hecho ? (minutos ? { minutos } : {}) : { hecho: false };
  guardar(S.markSession(st, f, sesion, opciones), { fecha: f });
}

// ---------- Crear y archivar ----------
function crear(orden) {
  const inicio = hoy();
  const estado = S.createInitialState(inicio);
  return col().doc(ID).set({
    v: 2, especial: ID, name: S.HABIT_NAME, emoji: "💆", tipo: "medible", meta: 2, unidad: "sesiones",
    freqType: "diario", days: [true, true, true, true, true, true, true], timesPerWeek: 3, cadaN: 2,
    timeOfDay: "cualquiera", dificultad: "media", area: "cuerpo", minima: "", despuesDe: null, vinculo: null,
    descripcion: S.CONTENT.subtitulo,
    done: [], registros: {}, createdAt: Date.now(), inicio, orden: orden || 0,
    scalping: estado
  });
}
function archivar() {
  if (!raw || !confirm("¿Archivar Scalping? Deja de aparecer en Hoy y su historial se conserva. Puedes restaurarlo desde los ajustes de Hábitos.")) return;
  col().doc(ID).update({ archivado: true, archivadoEn: hoy() }).catch(err => console.error("Manolo: no se pudo archivar Scalping", err));
  location.hash = "habitos";
}

// ---------- Tarjeta en la lista de Hoy ----------
function botonRapido(sesion, plan, log) {
  const hecho = log[sesion].hecho;
  const titulo = sesion === "manana" ? "Mañana" : "Noche";
  return `<button type="button" class="sc-rapido${hecho ? " is-hecho" : ""}" data-sc-sesion="${sesion}" aria-pressed="${hecho}"
    aria-label="${hecho ? `Desmarcar la sesión de ${titulo.toLowerCase()}` : `Marcar la sesión de ${titulo.toLowerCase()}`}">
    ${hecho ? `<span data-icon="check"></span>` : ""}${titulo} · ${plan[sesion].minutos} min</button>`;
}
function filaHtml() {
  if (!st) return "";
  const f = hoy();
  const plan = S.getPlanForDate(st.settings, f);
  const log = S.getLog(st, f);
  const stats = S.getStats(st, f);
  const completo = log.manana.hecho && log.noche.hecho;
  const sub = plan.estado === "pendiente"
    ? `Empiezas en ${plural(plan.diasParaEmpezar, "día", "días")} · ${S.formatFecha(st.settings.startDate)}`
    : `Día ${plan.dia}/${S.TOTAL_DAYS} · ${plan.fase.nombre} · Noche: ${plan.zonaNoche.nombre}`;
  return `<li class="hb-fila sc-fila${completo ? " is-hecho" : ""}">
    <button type="button" class="hb-fila-info" data-detalle="${ID}" aria-label="Abrir Scalping">
      <span class="hb-emoji" aria-hidden="true">💆</span>
      <span class="hb-fila-txt">
        <span class="hb-nombre">${esc(S.HABIT_NAME)}</span>
        <span class="hb-sub"><span>${esc(sub)}</span></span>
        <span class="sc-fila-prog">${barra(plan.progreso, "Progreso del plan de 180 días")}<span>${esc(S.formatHoras(stats.minutosTotales))}</span></span>
      </span>
    </button>
    ${plan.estado === "pendiente" ? "" : `<div class="sc-rapidos" data-xp-ancla="${ID}">${botonRapido("manana", plan, log)}${botonRapido("noche", plan, log)}</div>`}
  </li>`;
}

// Sugerencia en Hoy mientras el hábito no exista (se puede descartar).
function sugerenciaHtml() {
  if (raw || leerLocal("sugerencia") === "no") return "";
  return `<section class="sc-sugerencia" aria-label="Plan sugerido">
    <span class="sc-sug-emoji" aria-hidden="true">💆</span>
    <div><b>Scalping</b><span>${esc(S.CONTENT.subtitulo)}. Sesión de mañana y de noche, todos los días.</span></div>
    <div class="sc-sug-botones">
      <button type="button" class="hb-btn" data-sc-crear>Agregar</button>
      <button type="button" class="hb-btn-sec" data-sc-descartar>Ahora no</button>
    </div>
  </section>`;
}

// ---------- Vista: encabezado y pestañas ----------
function render() {
  if (!panel || panel.hidden || !currentUser) return;
  // No se redibuja mientras escribes (nota o minutos): se hace al salir del campo.
  const foco = document.activeElement;
  if (foco && app.contains(foco) && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName) && foco.type !== "checkbox") { renderPendiente = true; return; }
  renderPendiente = false;
  if (!raw) {
    app.innerHTML = `<h1 class="page-title">Scalping</h1>
      <div class="hb-vacio"><p class="hb-vacio-t">${esc(S.CONTENT.subtitulo)}</p>
        <p>${esc(S.CONTENT.objetivo)}</p>
        <button type="button" class="hb-btn" data-sc-crear>Agregar a mis hábitos</button></div>`;
    return;
  }
  const cuerpo = { hoy: tabHoy, progreso: tabProgreso, semana: tabSemana, guia: tabGuia, ajustes: tabAjustes }[tab]();
  app.innerHTML = `
    <h1 class="page-title">Scalping</h1>
    <p class="sc-subtitulo">${esc(S.CONTENT.subtitulo)}</p>
    ${raw.archivado ? `<p class="sc-aviso">Este hábito está archivado: no aparece en Hoy. Restáuralo desde Hábitos › Ajustes.</p>` : ""}
    <div class="fin-tabs hb-tabs sc-tabs" role="tablist">${TABS.map(([id, t]) =>
      `<button type="button" class="fin-tab${tab === id ? " active" : ""}" role="tab" aria-selected="${tab === id}" data-sc-tab="${id}">${t}</button>`).join("")}</div>
    <div class="sc-cuerpo">${cuerpo}</div>`;
  if (typeof renderIcons === "function") renderIcons(app);
  celebrarHitos();
}
// Tras guardar: la vista se redibuja ya; la lista de Hoy, rachas y XP se
// actualizan solos cuando Firestore avisa del cambio (al instante, incluso
// sin conexión).
const pintar = () => render();

// ---------- Pestaña Hoy ----------
function pasosHtml(sesion) {
  return `<ol class="sc-pasos">${sesion.pasos.map(p => `
    <li><div class="sc-paso-cab"><b>${esc(p.nombre)}</b><span>${p.minutos} min · ${esc(p.zona)}</span></div>
      <p>${esc(p.instrucciones)}</p></li>`).join("")}</ol>`;
}
function sesionHtml(sesion, log, interactivo) {
  const reg = log && log[sesion.id];
  const hecha = !!(reg && reg.hecho);
  let acciones = "";
  if (interactivo) {
    acciones = hecha ? `
      <div class="sc-hecha"><span class="sc-hecha-t"><span data-icon="check"></span>Hecha · ${reg.minutos != null ? reg.minutos : sesion.minutos} min</span>
        <button type="button" class="hb-btn-sec" data-sc-desmarcar="${sesion.id}">Desmarcar</button></div>` : `
      <div class="sc-acciones">
        <button type="button" class="hb-btn" data-sc-guiado="${sesion.id}"><span data-icon="timer"></span>Iniciar guiado</button>
        <div class="sc-marcar">
          <label class="sc-min-campo">Minutos<input type="number" inputmode="numeric" min="1" max="240" step="1" value="${sesion.minutos}" data-sc-min="${sesion.id}" aria-label="Minutos de la sesión de ${sesion.titulo.toLowerCase()}"></label>
          <button type="button" class="hb-btn-sec" data-sc-marcar="${sesion.id}">Marcar hecha</button>
        </div>
      </div>`;
  }
  const aceite = sesion.id === "noche" && sesion.aceite ? `
    <p class="sc-aceite">${esc(sesion.notaAceite)}</p>
    ${interactivo ? `<label class="sc-check"><input type="checkbox" class="switch" data-sc-aceite${log && log.aceite ? " checked" : ""}> Usé aceite hoy</label>` : ""}` : "";
  return `<section class="hb-card sc-sesion${hecha ? " is-hecha" : ""}" aria-label="Sesión de ${esc(sesion.titulo.toLowerCase())}">
    <div class="sc-sesion-cab"><h2 class="hb-card-t">${esc(sesion.titulo)}</h2><span class="sc-min">${sesion.minutos} min</span></div>
    <p class="sc-momento">${esc(sesion.momento)}</p>
    <p class="sc-zona"><b>Zona:</b> ${esc(sesion.zona)}</p>
    ${pasosHtml(sesion)}
    ${aceite}
    ${acciones}
  </section>`;
}
function tabHoy() {
  const f = hoy();
  const plan = S.getPlanForDate(st.settings, f);
  const log = S.getLog(st, f);
  let html = `<section class="hb-card sc-encabezado">
    <p class="sc-dia">${plan.estado === "pendiente" ? `Empiezas en ${plural(plan.diasParaEmpezar, "día", "días")}` : `Día ${plan.dia} de ${S.TOTAL_DAYS}`}</p>
    <h2 class="sc-fase">${esc(plan.fase.nombre)}</h2>
    <p class="hb-texto">${esc(plan.fase.descripcion)}</p>
    <p class="sc-fecha">${esc(plan.diaSemana)} · ${esc(plan.fechaTexto)}</p>
    ${barra(plan.progreso, "Progreso del plan de 180 días")}
  </section>`;
  if (plan.estado === "mantenimiento") html += `<p class="sc-banner">Plan de 180 días completado · Mantenimiento</p>`;
  if (plan.estado === "pendiente") {
    const p1 = S.getPlanForDate(st.settings, st.settings.startDate);
    html += `<p class="sc-banner">Empiezas en ${plural(plan.diasParaEmpezar, "día", "días")} (${esc(S.formatFecha(st.settings.startDate))}). Así será tu día 1:</p>
      ${sesionHtml(p1.manana, null, false)}${sesionHtml(p1.noche, null, false)}`;
  } else {
    const aviso = S.getReminder(st, new Date());
    if (aviso) html += `<p class="sc-recordatorio" role="status"><span data-icon="bell"></span>${esc(aviso.texto)}</p>`;
    if (plan.fotos && !st.fotos[String(plan.fotos.checkpoint)]) {
      html += `<section class="sc-fotos" aria-label="Fotos de control">
        <b>Fotos de control · día ${plan.fotos.checkpoint}</b>
        <p>${esc(plan.fotos.instrucciones)}</p>
        <p class="sc-fotos-fecha">Fecha ideal: ${esc(S.formatFecha(plan.fotos.fechaIdeal))}${plan.fotos.esHoy ? " (hoy)" : ""}</p>
        <button type="button" class="hb-btn" data-sc-fotos="${plan.fotos.checkpoint}">Fotos tomadas</button>
      </section>`;
    }
    html += sesionHtml(plan.manana, log, true) + sesionHtml(plan.noche, log, true);
  }
  html += `<section class="hb-card sc-esperar"><h2 class="hb-card-t">Qué esperar</h2><p class="sc-esperar-t">${esc(plan.queEsperar.titulo)}</p><p class="hb-texto">${esc(plan.queEsperar.texto)}</p></section>`;
  if (plan.mostrarDecision) {
    html += `<section class="hb-card sc-decision"><h2 class="hb-card-t">Decisión del día 180</h2><ul class="sc-lista">${S.CONTENT.decision.map(t => `<li>${esc(t)}</li>`).join("")}</ul></section>`;
  }
  if (plan.estado !== "pendiente") {
    html += `<label class="hb-campo sc-nota"><span>Nota del día <span class="hb-opcional">(opcional)</span></span>
      <textarea rows="2" maxlength="300" data-sc-nota placeholder="Cómo te sentiste, si notaste algo…">${esc(log.nota)}</textarea></label>`;
  }
  return html;
}

// ---------- Pestaña Progreso ----------
function heatmapHtml(historia) {
  const celdas = historia.map(d => {
    const clases = ["sc-celda", `n${d.sesiones}`, d.futuro ? "is-futuro" : "", d.esHoy ? "is-hoy" : "", d.esDiaFoto ? "is-foto" : ""].filter(Boolean).join(" ");
    const txt = `Día ${d.dia} · ${S.formatFecha(d.fecha)}: ${d.futuro ? "por venir" : d.sesiones === 2 ? "mañana y noche" : d.sesiones === 1 ? "1 sesión" : "sin sesiones"}${d.esDiaFoto ? " · fotos" : ""}`;
    return `<span class="${clases}" title="${esc(txt)}" role="img" aria-label="${esc(txt)}"></span>`;
  }).join("");
  return `<div class="sc-heat">${celdas}</div>
    <div class="hb-leyenda-heat sc-leyenda"><span>Sesiones:</span><i class="sc-celda n0"></i>0<i class="sc-celda n1"></i>1<i class="sc-celda n2"></i>2<i class="sc-celda n0 is-foto"></i>fotos</div>`;
}
function tabProgreso() {
  const f = hoy();
  const stats = S.getStats(st, f);
  const plan = stats.minutosPlanHastaHoy;
  const fotosHechas = st.fotos;
  const diaHoy = stats.diaHoy;
  let html = `<section class="hb-card"><h2 class="hb-card-t">Horas acumuladas</h2>
    <div class="sc-horas"><span class="hb-num">${esc(S.formatHoras(stats.minutosTotales))}</span><span>de ${esc(S.formatHoras(plan))} que lleva el plan hasta hoy</span></div>
    ${barra(plan ? stats.minutosTotales / plan : 0, "Horas hechas contra las del plan")}
  </section>`;
  html += `<section class="hb-card"><h2 class="hb-card-t">Hitos</h2><ul class="sc-hitos">${stats.hitos.map(h => `
    <li class="sc-hito${h.alcanzado ? " is-on" : ""}" data-sc-hito="${h.minutos}">
      <span class="sc-hito-ico" aria-hidden="true"><span data-icon="${h.alcanzado ? "trophy" : "star"}"></span></span>
      <span><b>${esc(h.titulo)}</b><span>${esc(h.texto)}</span>${h.alcanzado ? `<span class="hb-tag">Alcanzado</span>` : ""}</span>
    </li>`).join("")}</ul>
    ${stats.siguienteHito ? `<p class="hb-texto">Te faltan <b>${esc(S.formatHoras(stats.minutosParaSiguienteHito))}</b> para ${esc(stats.siguienteHito.titulo)}.</p>` : `<p class="hb-texto"><b>Llegaste a todos los hitos.</b></p>`}
  </section>`;
  html += `<div class="hb-stats-grid sc-stats">
    <div class="hb-stat"><span class="hb-num">${stats.rachaActual}</span><span>Racha actual (días)</span></div>
    <div class="hb-stat"><span class="hb-num">${stats.mejorRacha}</span><span>Mejor racha</span></div>
    <div class="hb-stat"><span class="hb-num">${stats.diasCompletos}</span><span>Días completos</span></div>
    <div class="hb-stat"><span class="hb-num">${pct(stats.cumplimiento)}</span><span>Cumplimiento</span></div>
  </div>`;
  html += `<section class="hb-card"><h2 class="hb-card-t">Los ${S.TOTAL_DAYS} días</h2>${heatmapHtml(S.getHistory(st, f))}</section>`;
  html += `<section class="hb-card"><h2 class="hb-card-t">Fotos de control</h2><ul class="sc-filas">${S.getPhotoSchedule(st.settings.startDate).map(c => {
    const hecha = fotosHechas[String(c.checkpoint)];
    const abierta = diaHoy >= c.checkpoint - S.PHOTO_WINDOW;
    return `<li><span><b>Día ${c.checkpoint}</b> · ${esc(c.fechaTexto)}</span>
      ${hecha ? `<span class="sc-ok"><span data-icon="check"></span>Marcadas</span>` : abierta ? `<button type="button" class="hb-btn-sec sc-mini" data-sc-fotos="${c.checkpoint}">Marcar</button>` : `<span class="sc-pend">Pendiente</span>`}</li>`;
  }).join("")}</ul></section>`;
  html += `<section class="hb-card"><h2 class="hb-card-t">Cuándo llega el plan a cada hito</h2><p class="hb-texto">Si haces todas las sesiones con los minutos del plan.</p><ul class="sc-filas">${S.getPlanMarkers(st.settings).map(m =>
    `<li><span><b>${esc(m.titulo)}</b></span><span>Día ${m.dia} · ${esc(m.fechaTexto)}</span></li>`).join("")}</ul></section>`;
  return html;
}
// Al alcanzar un hito nuevo: una animación en su fila (una sola vez).
function celebrarHitos() {
  if (tab !== "progreso" || !st) return;
  const vistos = (leerLocal("hitos") || "").split(",").filter(Boolean);
  const stats = S.getStats(st, hoy());
  const nuevos = stats.hitos.filter(h => h.alcanzado && !vistos.includes(String(h.minutos)));
  if (!nuevos.length) return;
  nuevos.forEach(h => { const li = app.querySelector(`[data-sc-hito="${h.minutos}"]`); if (li) li.classList.add("is-nuevo"); });
  guardarLocal("hitos", stats.hitos.filter(h => h.alcanzado).map(h => h.minutos).join(","));
}

// ---------- Pestaña Semana ----------
function tabSemana() {
  return `<ul class="sc-semana">${S.getWeekPreview(st.settings, hoy(), 7).map((d, i) => `
    <li class="sc-sem-dia${i === 0 ? " is-hoy" : ""}">
      <div class="sc-sem-fecha"><b>${i === 0 ? "Hoy" : esc(DIAS_CORTOS[d.diaSemana] || d.diaSemana)}</b><span>${esc(d.fechaTexto)}</span></div>
      <div class="sc-sem-info">
        <span>${d.estado === "pendiente" ? "Antes del inicio" : `Día ${d.dia} · ${esc(d.fase)}`}</span>
        <span>Noche: ${esc(d.zonaNoche)}</span>
        <span>Mañana ${d.minutosManana} min · Noche ${d.minutosNoche} min</span>
      </div>
      ${d.tocaFoto ? `<span class="hb-tag sc-sem-foto">Fotos</span>` : ""}
    </li>`).join("")}</ul>`;
}

// ---------- Pestaña Guía ----------
function seccion(titulo, cuerpo, abierta) {
  return `<details class="sc-guia-sec"${abierta ? " open" : ""}><summary>${esc(titulo)}</summary><div class="sc-guia-cuerpo">${cuerpo}</div></details>`;
}
const lista = items => `<ul class="sc-lista">${items.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`;
function tabGuia() {
  const C = S.CONTENT;
  const movs = Object.keys(S.MOVEMENTS).map(k => S.MOVEMENTS[k]);
  const fases = S.getPhaseSummary();
  const pasos = ps => ps.map(p => `${esc(p.nombre)} ${p.minutos} min`).join(" · ");
  return [
    seccion("Objetivo", `<p>${esc(C.objetivo)}</p>`, true),
    seccion("Fundamento", lista(C.fundamento)),
    seccion("Horario", lista(C.horario)),
    seccion("Reglas", lista(C.reglas)),
    seccion("Movimientos", `<dl class="sc-movs">${movs.map(m => `<dt>${esc(m.nombre)}</dt><dd>${esc(m.instrucciones)}</dd>`).join("")}</dl><p class="sc-nota-guia">${esc(C.notaCalentamiento)}</p>`),
    seccion("Zonas por día", `<ul class="sc-filas">${C.zonasSemana.map(z => `<li><span><b>${esc(z.dias)}</b></span><span>${esc(z.zona)}</span></li>`).join("")}</ul>`),
    seccion("Fases", fases.map(fa => `<div class="sc-fase-guia"><b>Fase ${fa.id} · ${esc(fa.nombre)}</b> <span class="sc-dias">días ${esc(fa.dias)}</span>
      <p>${esc(fa.descripcion)}</p>
      <p><b>Mañana ${fa.minutosManana} min:</b> ${pasos(fa.pasosManana)}</p>
      <p><b>Noche ${fa.minutosNoche} min:</b> ${pasos(fa.pasosNoche)}</p>
      <p><b>Total:</b> ${fa.minutosDia} min al día${fa.minutosNocheExtendida ? ` · noche extendida: ${fa.minutosNocheExtendida} min` : ""}</p></div>`).join("")),
    seccion("Qué esperar", `<ul class="sc-filas">${C.queEsperar.map(q => `<li class="sc-col"><b>${esc(q.etapa)}</b><span>${esc(q.texto)}</span></li>`).join("")}</ul>`),
    seccion("Fotos de control", `<p>${esc(C.fotos)}</p>`),
    seccion("Aceite opcional", lista(C.aceite)),
    seccion("Noche extendida", `<p>${esc(C.textoNocheExtendida)}</p>`),
    seccion("Cuándo pausar y consultar", lista(C.pausaYConsulta)),
    seccion("Decisión del día 180", lista(C.decision)),
    seccion("Fuentes", lista(C.fuentes))
  ].join("");
}

// ---------- Pestaña Ajustes ----------
function tabAjustes() {
  const s = st.settings;
  const plan = S.getPlanForDate(s, hoy());
  return `<section class="hb-card">
    <label class="hb-campo"><span>Fecha de inicio</span>
      <input type="date" data-sc-inicio value="${esc(s.startDate)}"></label>
    <p class="hb-texto">Cambiarla mueve el día del plan: hoy pasaría a ser otro día (y otra fase). Tus sesiones ya marcadas se conservan.</p>
    <p class="sc-error" data-sc-error hidden></p>
    <label class="hb-campo"><span>Zona prioritaria del domingo</span>
      <select data-sc-zona>${ZONA_OPCIONES.map(([v, t]) => `<option value="${v}"${(s.zonaPrioritaria || "") === v ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
    <p class="hb-texto">El domingo la noche es en toda la cabeza; si notas que una zona ralea, elígela aquí.</p>
    <label class="sc-check sc-ajuste"><span><b>Usar aceite de romero</b><small>Solo de noche. Lee “Aceite opcional” en la Guía.</small></span>
      <input type="checkbox" class="switch" data-sc-ajuste="usarAceite"${s.usarAceite ? " checked" : ""}></label>
    <label class="sc-check sc-ajuste"><span><b>Noche extendida a 20 minutos</b><small>${esc(S.CONTENT.textoNocheExtendida)} Solo aplica desde la fase 3 (día 91)${plan.nocheExtendidaDisponible ? "" : "; antes no cambia nada"}.</small></span>
      <input type="checkbox" class="switch" data-sc-ajuste="nocheExtendida"${s.nocheExtendida ? " checked" : ""}></label>
  </section>
  ${activo() ? `<div class="hb-acciones sc-archivar"><button type="button" class="hb-btn-sec" data-sc-archivar>Archivar hábito</button></div>` : ""}`;
}

// ---------- Temporizador guiado (pantalla completa) ----------
function abrirGuia(sesionId) {
  const f = hoy();
  const plan = S.getPlanForDate(st.settings, f);
  const sesion = plan[sesionId];
  // En el mismo toque: audio (iOS solo lo permite tras un gesto) y pantalla encendida.
  S.browser.prepareAudio();
  guia = { fecha: f, sesion, timer: null, bloqueo: null, el: document.createElement("div") };
  pedirPantalla();
  guia.el.className = "sc-guiado";
  guia.el.setAttribute("role", "dialog");
  guia.el.setAttribute("aria-modal", "true");
  guia.el.setAttribute("aria-label", `Sesión guiada de ${sesion.titulo.toLowerCase()}`);
  guia.el.innerHTML = `
    <div class="sc-g-top"><span>Scalping · ${esc(sesion.titulo)}</span><span data-g="pasoN"></span></div>
    <div class="sc-g-centro">
      <p class="sc-g-zona" data-g="zona"></p>
      <h2 class="sc-g-nombre" data-g="nombre"></h2>
      <div class="sc-g-reloj" data-g="reloj" aria-live="off">0:00</div>
      <p class="sc-g-instr" data-g="instr"></p>
    </div>
    <div class="sc-g-pie">
      <div class="sc-g-barra" aria-hidden="true"><i data-g="barra"></i></div>
      <p class="sc-g-sig" data-g="sig"></p>
      <div class="sc-g-botones">
        <button type="button" class="hb-btn-sec" data-g-accion="pausa">Pausar</button>
        <button type="button" class="hb-btn-sec" data-g-accion="siguiente">Siguiente paso</button>
        <button type="button" class="hb-btn" data-g-accion="terminar">Terminar</button>
      </div>
    </div>`;
  document.body.appendChild(guia.el);
  document.body.classList.add("sc-en-guia");
  guia.el.addEventListener("click", alTocarGuia);
  guia.timer = S.createGuidedTimer(sesion.pasos, {
    onStep: () => { S.browser.beep(); S.browser.vibrate(); },
    onTick: pintarGuia,
    onFinish: terminoGuia
  });
  pintarGuia(guia.timer.start());
}
function pedirPantalla() {
  if (!guia) return;
  S.browser.requestWakeLock().then(b => { if (guia && b) guia.bloqueo = b; else if (b) b.release().catch(() => {}); });
}
function pintarGuia(e) {
  if (!guia) return;
  const snap = e || guia.timer.getState();
  const $ = k => guia.el.querySelector(`[data-g="${k}"]`);
  const txt = (k, t) => { const el = $(k); if (el && el.textContent !== t) el.textContent = t; };
  txt("pasoN", `Paso ${snap.indice + 1} de ${snap.totalPasos}`);
  txt("nombre", snap.paso.nombre);
  txt("zona", snap.paso.zona || "");
  txt("instr", snap.paso.instrucciones || "");
  txt("reloj", mmss(snap.restanteSeg));
  txt("sig", snap.siguiente ? `Siguiente: ${snap.siguiente.nombre} · ${mmss(snap.siguiente.segundos)}` : "Último paso");
  $("barra").style.width = `${(snap.progreso * 100).toFixed(1)}%`;
  const b = guia.el.querySelector('[data-g-accion="pausa"]');
  const t = snap.estado === "pausado" ? "Reanudar" : "Pausar";
  if (b.textContent !== t) b.textContent = t;
  guia.el.classList.toggle("is-pausado", snap.estado === "pausado");
}
function terminoGuia(e) {
  if (!guia) return;
  const { sesion, fecha } = guia;
  cerrarGuia();
  if (e.completo) {
    S.browser.beep(660, 400);
    guardar(S.markSession(st, fecha, sesion.id), { fecha });
    return;
  }
  const minutos = Math.max(1, Math.round(e.transcurridoSeg / 60));
  if (confirm(`¿Marcar la sesión de ${sesion.titulo.toLowerCase()} como hecha con ${minutos} min?`)) {
    guardar(S.markSession(st, fecha, sesion.id, { minutos }), { fecha });
  }
}
function cerrarGuia() {
  if (!guia) return;
  guia.timer.destroy();
  if (guia.bloqueo) guia.bloqueo.release().catch(() => {});
  guia.el.remove();
  document.body.classList.remove("sc-en-guia");
  guia = null;
}
function alTocarGuia(e) {
  const b = e.target.closest("[data-g-accion]");
  if (!b || !guia) return;
  const t = guia.timer;
  const a = b.dataset.gAccion;
  if (a === "pausa") {
    const estado = t.getState().estado;
    pintarGuia(estado === "pausado" ? t.resume() : t.pause());
    if (estado === "pausado") S.browser.prepareAudio();
  } else if (a === "siguiente") pintarGuia(t.skip());
  else if (a === "terminar") t.finish();
}
// El temporizador va por marcas de tiempo: al volver a la app se pone al día.
document.addEventListener("visibilitychange", () => {
  if (!guia || document.visibilityState !== "visible") return;
  guia.timer.tick();
  if (guia && !guia.bloqueo) pedirPantalla();
});

// ---------- Eventos de la vista ----------
app.addEventListener("click", e => {
  const b = e.target.closest("[data-sc-tab],[data-sc-crear],[data-sc-guiado],[data-sc-marcar],[data-sc-desmarcar],[data-sc-fotos],[data-sc-archivar]");
  if (!b) return;
  const d = b.dataset;
  if (d.scTab) { tab = d.scTab; render(); window.scrollTo(0, 0); return; }
  if (b.hasAttribute("data-sc-crear")) { document.dispatchEvent(new CustomEvent("scalping:crear")); return; }
  if (!st) return;
  if (d.scGuiado) { abrirGuia(d.scGuiado); return; }
  if (d.scMarcar) {
    const input = app.querySelector(`[data-sc-min="${d.scMarcar}"]`);
    const v = Math.round(Number(input && input.value));
    marcarSesion(d.scMarcar, true, v > 0 && v <= 240 ? v : null);
    return;
  }
  if (d.scDesmarcar) { marcarSesion(d.scDesmarcar, false); return; }
  if (d.scFotos) {
    const c = Number(d.scFotos);
    const marcada = st.fotos[String(c)];
    guardar(S.markPhotos(st, c, marcada ? null : hoy()), { foto: String(c) });
    return;
  }
  if (b.hasAttribute("data-sc-archivar")) archivar();
});
app.addEventListener("change", e => {
  const t = e.target;
  if (!st) return;
  if (t.matches("[data-sc-aceite]")) { const f = hoy(); guardar(S.setOil(st, f, t.checked), { fecha: f }); return; }
  if (t.matches("[data-sc-inicio]")) {
    const err = app.querySelector("[data-sc-error]");
    if (!S.isValidISO(t.value)) { err.textContent = "Elige una fecha válida."; err.hidden = false; return; }
    err.hidden = true;
    guardar(S.updateSettings(st, { startDate: t.value }), { ajustes: true });
    return;
  }
  if (t.matches("[data-sc-zona]")) { guardar(S.updateSettings(st, { zonaPrioritaria: t.value || null }), { ajustes: true }); return; }
  if (t.matches("[data-sc-ajuste]")) guardar(S.updateSettings(st, { [t.dataset.scAjuste]: t.checked }), { ajustes: true });
});
// Nota del día: se guarda sola al dejar de escribir.
app.addEventListener("input", e => {
  if (!e.target.matches("[data-sc-nota]") || !st) return;
  clearTimeout(notaTimer);
  const valor = e.target.value;
  notaTimer = setTimeout(() => { const f = hoy(); guardar(S.setNote(st, f, valor), { fecha: f }); }, 700);
});
app.addEventListener("focusout", () => { setTimeout(() => { if (renderPendiente) render(); }, 0); });
window.addEventListener("hashchange", render);

// ---------- API para js/habitos.js ----------
window.HabitoScalping = {
  ID,
  // Es el hábito de Scalping (por id o por la marca del documento).
  es: idOHabito => (typeof idOHabito === "string" ? idOHabito === ID : !!idOHabito && idOHabito.id === ID),
  // Hábitos avisa cada vez que cambian los datos.
  datos(doc) {
    raw = doc || null;
    st = raw ? S.normalizeState(raw.scalping || { settings: { startDate: raw.inicio } }) : null;
    render();
  },
  // Minutos reales registrados (para los logros); null si no tienes el hábito.
  minutosTotales: () => (st ? S.getStats(st, hoy()).minutosTotales : null),
  filaHtml,
  sugerenciaHtml,
  crear,
  descartarSugerencia() { guardarLocal("sugerencia", "no"); },
  // Botones rápidos de la tarjeta: marca o desmarca con los minutos del plan.
  alternar(sesion) {
    if (!st) return;
    const hecho = S.getLog(st, hoy())[sesion].hecho;
    marcarSesion(sesion, !hecho);
  },
  abrir() { location.hash = "hab-scalping"; }
};
})();
