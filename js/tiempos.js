// ---------- Medir tiempos (sub-panel de Inicio) ----------
// Arriba "Mi mañana" (js/tiempos-manana.js) y el plan de la mañana
// (js/tiempos-plan-ui.js). Anotar por día cuánto tardaste
// en cada actividad (minutos y segundos, cada una con su botón; o ⏱ Medir
// con cronómetro), promedios por semana, mes y día de la semana, la línea
// base (primeros 30 registros; se sigue midiendo) y tus días.
// Tus actividades (crear, renombrar, ordenar, archivar) en
// meta/tiempos_ajustes (js/tiempos-actividades.js); los tiempos que llegan
// solos de Running, Ejercicio, Libros y Movilidad, en js/tiempos-llenar.js.
// Datos en users/{uid}/tiempos (un documento por día, id = fecha).
// Definitiva desde la fase 6 (D-113). Fase 7 (D-114): plan de la mañana,
// estadísticas (js/tiempos-stats-ui.js), línea base y experimentos; avisa
// sus días a Hábitos ("manolo:fuente", fuente "tiempos").
(function () {
const T = window.TiemposMotor, A = window.TiemposActividades;
const app = document.getElementById("tmp-app");
if (!app || !T || !A || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;

let docs = {};            // id (fecha) → datos tal como están en Firestore
let ds = [];              // días normalizados
let cargado = false;
let ajustes = null;       // meta/tiempos_ajustes
let ajustesCargados = false;
let fecha = hoyLocal();   // día que se está anotando
let tipo = "semana";      // promedios: "semana" | "mes" | "dia" (por día de la semana)
let dow = new Date().getDay(); // día de la semana elegido en "Por día" (0 = domingo)
let ref = hoyLocal();     // semana o mes que se ve
let borradores = {};      // id → { min, seg } escritos y todavía sin guardar (del día elegido)
let aviso = null;         // { id, texto }: "✓ Guardado" junto a esa actividad

const usuario = () => db.collection("users").doc(currentUser.uid);
const coleccion = () => usuario().collection("tiempos");
const refAjustes = () => usuario().collection("meta").doc("tiempos_ajustes");
const borrar = () => firebase.firestore.FieldValue.delete();
const todas = () => A.lista(ajustes);
const activas = () => todas().filter(a => !a.archivada);
// En promedios y días: las activas y las archivadas que tienen algo anotado.
const conDatos = () => todas().filter(a => !a.archivada || ds.some(d => d.seg[a.id]));
const actDe = id => todas().find(a => a.id === id) || { id, nombre: id, emoji: "" };

app.innerHTML = `
  <section class="tmp-card tman-zona" id="tmp-manana" aria-label="Mi mañana"></section>
  <section class="tmp-card tman-zona" id="tmp-plan" aria-label="Plan de la mañana"></section>
  <section class="tmp-card tmp-anotar" id="tmp-anotar" aria-labelledby="tmp-anotar-t"></section>
  <section class="tmp-card" id="tmp-promedios" aria-labelledby="tmp-prom-t"></section>
  <section class="tmp-card tman-zona" id="tmp-stats" aria-label="Estadísticas"></section>
  <section class="tmp-card" id="tmp-avance" aria-labelledby="tmp-av-t"></section>
  <section class="tmp-card tman-zona" id="tmp-exp" aria-label="Experimentos"></section>
  <section class="tmp-card" id="tmp-dias" aria-labelledby="tmp-dias-t"></section>
  <div class="tmp-pie">
    <button type="button" class="lib-btn-sec lib-btn-chico" data-tmp-exportar="json">Exportar (JSON)</button>
    <button type="button" class="lib-btn-sec lib-btn-chico" data-tmp-exportar="csv">Exportar (CSV)</button>
  </div>`;
const $ = id => document.getElementById(id);
const anotar = $("tmp-anotar");
const fallo = err => alert(`No se pudo guardar: ${err && err.message ? err.message : err}`);

function render() {
  // (Estas piezas cargan después: se pintan también con "tiempos:datos".)
  if (window.TiemposManana) TiemposManana.tarjeta($("tmp-manana"));
  if (window.TiemposPlanUI) TiemposPlanUI.pintar($("tmp-plan"));
  if (window.TiemposStatsUI) { TiemposStatsUI.pintarStats($("tmp-stats")); TiemposStatsUI.pintarExp($("tmp-exp")); }
  renderForm();
  renderPromedios();
  renderAvance();
  renderDias();
}
const avisarDatos = () => window.dispatchEvent(new CustomEvent("tiempos:datos"));
// Hábitos (fase 7): un hábito puede llenarse con una actividad de Medir tiempos.
let servidor = false;
const avisarHabitos = () => window.dispatchEvent(new CustomEvent("manolo:fuente", { detail: { fuente: "tiempos", datos: ds, servidor } }));

// Cambia el día en memoria al toque (Firestore confirma después con onSnapshot).
function cambiarLocal(f, id, seg, o) {
  const previo = docs[f] || { fecha: f, seg: {} };
  const nuevo = JSON.parse(JSON.stringify(previo));
  nuevo.fecha = f;
  nuevo.seg = nuevo.seg || {};
  if (seg) nuevo.seg[id] = seg; else delete nuevo.seg[id];
  if (nuevo.auto) delete nuevo.auto[id];
  if (o && o.noAuto) nuevo.noAuto = Object.assign({}, nuevo.noAuto, { [id]: true });
  if (Object.keys(nuevo.seg).length || (nuevo.noAuto && Object.keys(nuevo.noAuto).length)) docs[f] = nuevo;
  else delete docs[f];
  ds = T.dias(docs);
  return nuevo.seg;
}
// Guardar un tiempo tuyo (escrito o medido): manda sobre lo automático.
function guardarSeg(f, id, seg) {
  coleccion().doc(f).set({ fecha: f, seg: { [id]: seg }, auto: { [id]: borrar() }, actualizado: Date.now() }, { merge: true }).catch(fallo);
  cambiarLocal(f, id, seg);
}

// ---------- Anotar ----------
// Cada actividad se guarda sola, con su botón: no todos los días se hace todo
// (pedido del dueño 2026-10-29). Desde la fase 6 se sigue anotando después
// de los 30 registros.
function renderForm() {
  const foco = anotar.contains(document.activeElement) ? document.activeElement.name : null;
  const hoy = hoyLocal();
  const docDia = docs[fecha] || null;
  const delDia = (ds.find(d => d.fecha === fecha) || { seg: {} }).seg;
  const lista = activas();
  anotar.innerHTML = `
    <div class="tmp-cab"><h2 class="tmp-titulo" id="tmp-anotar-t">Anotar tiempos</h2>
      <button type="button" class="tmp-editar" data-tact-abrir>⚙️ Tus actividades</button></div>
    <p class="tmp-nota">Guarda solo lo que hiciste ese día: cada actividad tiene su propio botón. Con ⏱ Medir, lo mides con cronómetro.</p>
    <label class="lib-campo"><span>Día</span><input type="date" class="lib-input" name="fecha" value="${fecha}" max="${hoy}"></label>
    ${lista.map(a => fila(a, delDia[a.id], docDia)).join("")}`;
  if (foco) { const el = anotar.querySelector(`[name="${foco}"]`); if (el) el.focus(); }
}

function fila(a, guardado, docDia) {
  const c = borradores[a.id] || T.campos(guardado);
  const ok = aviso && aviso.id === a.id ? aviso.texto : "";
  const auto = guardado && window.TiemposAuto ? TiemposAuto.deDonde(docDia, a.id) : null;
  return `
    <form class="tmp-fila${guardado ? " is-guardada" : ""}" data-tmp-act="${a.id}" novalidate>
      <div class="tmp-act">${a.emoji ? `<span class="tmp-emoji" aria-hidden="true">${esc(a.emoji)}</span>` : ""}<b>${esc(a.nombre)}</b>${guardado ? `<span class="tmp-hecho">✓ ${T.texto(guardado)}</span>` : ""}${auto ? `<span class="tmp-auto">⚡ de ${esc(auto)}</span>` : ""}
        <button type="button" class="tmp-medir" data-tman-medir="${a.id}" aria-label="Medir ahora: ${esc(a.nombre)}">⏱ Medir</button>
        ${a.detalle ? `<small>${esc(a.detalle)}</small>` : ""}</div>
      <div class="tmp-campos">
        <label><input class="lib-input" name="${a.id}-min" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" value="${esc(c.min)}" aria-label="${esc(a.nombre)}: minutos"><span aria-hidden="true">min</span></label>
        <label><input class="lib-input" name="${a.id}-seg" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" value="${esc(c.seg)}" aria-label="${esc(a.nombre)}: segundos"><span aria-hidden="true">seg</span></label>
        <button type="submit" class="lib-btn tmp-guardar">${guardado ? "Cambiar" : "Guardar"}</button>
      </div>
      <p class="lib-error" hidden></p>
      ${guardado ? `<button type="button" class="tmp-quitar" data-tmp-quitar="${a.id}">Quitar de este día</button>` : ""}
      <p class="tmp-ok" aria-live="polite">${ok}</p>
    </form>`;
}

anotar.addEventListener("input", e => {
  const f = e.target.closest("form[data-tmp-act]");
  if (!f) return;
  const id = f.dataset.tmpAct;
  borradores[id] = { min: f.elements[`${id}-min`].value, seg: f.elements[`${id}-seg`].value };
  if (aviso) { aviso = null; anotar.querySelectorAll(".tmp-ok").forEach(el => { el.textContent = ""; }); }
});
anotar.addEventListener("change", e => {
  if (e.target.name !== "fecha" || !e.target.value) return;
  fecha = e.target.value > hoyLocal() ? hoyLocal() : e.target.value;
  borradores = {};
  aviso = null;
  renderForm();
});
anotar.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target, id = f.dataset.tmpAct;
  if (!id) return;
  const r = T.leer(f.elements[`${id}-min`].value, f.elements[`${id}-seg`].value);
  const error = r.error || (r.seg ? "" : "Escribe los minutos (y los segundos, si quieres).");
  window.Lectura.errores(f, error ? [{ campo: `${id}-min`, texto: error }] : []);
  if (error) return;
  // Solo cambia esta actividad; las otras del día quedan como estaban.
  guardarSeg(fecha, id, r.seg);
  delete borradores[id];
  aviso = { id, texto: "✓ Guardado" };
  render();
  avisarDatos();
});
anotar.addEventListener("click", e => {
  const q = e.target.closest("[data-tmp-quitar]");
  if (!q) return;
  const id = q.dataset.tmpQuitar, a = actDe(id), d0 = docs[fecha] || {};
  if (!confirm(`¿Quitar ${a.nombre} del ${T.fechaLarga(fecha)}?`)) return;
  const fueAuto = !!(d0.auto && d0.auto[id]);
  const quedan = cambiarLocal(fecha, id, null, { noAuto: fueAuto });
  const ahora = Date.now();
  if (fueAuto) {
    // Llegó solo: queda anotado que lo quitaste, para que no vuelva.
    coleccion().doc(fecha).set({ seg: { [id]: borrar() }, auto: { [id]: borrar() }, noAuto: { [id]: true }, actualizado: ahora }, { merge: true }).catch(fallo);
  } else if (Object.keys(quedan).length || (d0.noAuto && Object.keys(d0.noAuto).length)) {
    coleccion().doc(fecha).update({ [`seg.${id}`]: borrar(), actualizado: ahora }).catch(fallo);
  } else coleccion().doc(fecha).delete().catch(fallo);
  delete borradores[id];
  aviso = { id, texto: "Quitado de este día" };
  render();
  avisarDatos();
});

// ---------- Promedios por semana y por mes ----------
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];
// "lunes" → "tus lunes"; "Sábado" → "tus sábados".
const plural = d => (d.dow === 6 || d.dow === 0 ? `${d.nombre.toLowerCase()}s` : d.nombre.toLowerCase());
const pestanas = () => `
    <div class="fin-tabs tmp-tabs" role="tablist" aria-label="Promedio por">
      <button type="button" class="fin-tab${tipo === "semana" ? " active" : ""}" role="tab" aria-selected="${tipo === "semana"}" data-tmp-tipo="semana">Semana</button>
      <button type="button" class="fin-tab${tipo === "mes" ? " active" : ""}" role="tab" aria-selected="${tipo === "mes"}" data-tmp-tipo="mes">Mes</button>
      <button type="button" class="fin-tab${tipo === "dia" ? " active" : ""}" role="tab" aria-selected="${tipo === "dia"}" data-tmp-tipo="dia">Por día</button>
    </div>`;
// Promedio por día de la semana: todos los lunes, todos los martes…
function renderPorDia(el) {
  const acts = conDatos();
  const pd = T.porDiaSemana(ds, acts);
  const d = pd.find(x => x.dow === dow) || pd[0];
  const max = Math.max(1, ...pd.map(x => x.total.promedio || 0));
  const ex = T.extremosSemana(pd);
  const hay = pd.some(x => x.total.dias);
  el.innerHTML = `
    <h2 class="tmp-titulo" id="tmp-prom-t">Promedios</h2>
    ${pestanas()}
    ${cargado && !hay ? `<p class="empty-state">Todavía no hay tiempos anotados.</p>` : `
    <p class="tmp-nota tmp-nota-arriba">Tu día todo junto, en promedio, según el día de la semana. Toca un día para ver cada actividad.</p>
    <div class="tmp-sem" role="group" aria-label="Tu día en promedio, de lunes a domingo">
      ${pd.map(x => `<button type="button" class="tmp-sem-b${x.dow === d.dow ? " is-elegida" : ""}" data-tmp-dow="${x.dow}" aria-pressed="${x.dow === d.dow}" aria-label="${x.nombre}: ${T.texto(x.total.promedio)} en promedio (${x.total.dias} ${x.total.dias === 1 ? "día" : "días"})">
        <span class="tmp-sem-v">${x.total.dias ? T.corto(x.total.promedio) : "—"}</span>
        <span class="tmp-sem-col"><span style="height:${x.total.promedio ? Math.max(4, Math.round(x.total.promedio / max * 100)) : 0}%"></span></span>
        <span class="tmp-sem-d">${x.corto}</span>
      </button>`).join("")}
    </div>
    <div class="tmp-nav">
      <button type="button" data-tmp-dow-mover="-1" aria-label="Día anterior">‹</button>
      <b id="tmp-periodo">Tus ${esc(plural(d))} · ${d.total.dias} ${d.total.dias === 1 ? "día" : "días"}</b>
      <button type="button" data-tmp-dow-mover="1" aria-label="Día siguiente">›</button>
    </div>
    ${d.total.dias ? `
    <table class="tmp-tabla">
      <thead><tr><th scope="col">Actividad</th><th scope="col">Promedio</th><th scope="col">Días</th></tr></thead>
      <tbody>${acts.map(a => `
        <tr data-tmp-prom="${a.id}"><td>${esc(a.nombre)}</td><td>${T.texto(d.act[a.id].promedio)}</td><td>${d.act[a.id].n}</td></tr>`).join("")}
      </tbody>
      <tfoot><tr data-tmp-prom="dia"><th scope="row">Tu día (todo junto)</th><td>${T.texto(d.total.promedio)}</td><td>${d.total.dias}</td></tr></tfoot>
    </table>` : `<p class="empty-state">No tienes ${esc(plural(d))} anotados todavía.</p>`}
    ${ex ? `<p class="tmp-nota">Tus ${esc(plural(ex.largo))} son los más largos (${T.texto(ex.largo.total.promedio)}) y tus ${esc(plural(ex.corto))} los más cortos (${T.texto(ex.corto.total.promedio)}): ${T.texto(ex.diferencia)} de diferencia.</p>` : ""}`}`;
}

function renderPromedios() {
  const el = $("tmp-promedios");
  if (tipo === "dia") { renderPorDia(el); return; }
  const hoy = hoyLocal(), acts = conDatos();
  const p = T.periodo(ds, tipo, ref, hoy, acts);
  const ahora = tipo === "semana" ? "Esta semana" : "Este mes";
  el.innerHTML = `
    <h2 class="tmp-titulo" id="tmp-prom-t">Promedios</h2>
    ${pestanas()}
    <div class="tmp-nav">
      <button type="button" data-tmp-mover="-1" aria-label="${tipo === "semana" ? "Semana anterior" : "Mes anterior"}">‹</button>
      <b id="tmp-periodo">${p.enCurso ? `${ahora} · ` : ""}${esc(p.titulo)}</b>
      <button type="button" data-tmp-mover="1" aria-label="${tipo === "semana" ? "Semana siguiente" : "Mes siguiente"}"${p.enCurso || p.futuro ? " disabled" : ""}>›</button>
    </div>
    ${cargado && !p.hayDatos ? `<p class="empty-state">Sin tiempos ${tipo === "semana" ? "esta semana" : "este mes"}.</p>` : `
    <table class="tmp-tabla">
      <thead><tr><th scope="col">Actividad</th><th scope="col">Promedio</th><th scope="col">Días</th></tr></thead>
      <tbody>${acts.map(a => `
        <tr data-tmp-prom="${a.id}"><td>${esc(a.nombre)}</td><td>${T.texto(p.act[a.id].promedio)}</td><td>${p.act[a.id].n}</td></tr>`).join("")}
      </tbody>
      <tfoot><tr data-tmp-prom="dia"><th scope="row">Tu día (todo junto)</th><td>${T.texto(p.dias.promedio)}</td><td>${p.dias.dias}</td></tr></tfoot>
    </table>`}
    ${p.enCurso && p.hayDatos ? `<p class="tmp-nota">${tipo === "semana" ? "La semana" : "El mes"} todavía no termina: el promedio se va armando con cada día.</p>` : ""}`;
}

// ---------- Línea base: los primeros 30 registros (antes "promedio final") ----------
function renderAvance() {
  const el = $("tmp-avance");
  const acts = activas(), e = T.estado(ds, acts);
  el.innerHTML = `
    <h2 class="tmp-titulo" id="tmp-av-t">Línea base</h2>
    <p class="tmp-nota">Tus primeros ${T.LIMITE} registros de cada actividad son tu línea base (antes, «promedio final»). Después se sigue midiendo; con un experimento comparas un cambio contra ella.</p>
    ${acts.map(a => {
      const x = e[a.id];
      return `
    <div class="tmp-avance${x.completa ? " is-completa" : ""}" data-tmp-avance="${a.id}">
      <div class="tmp-avance-fila"><b>${esc(a.nombre)}</b><span>${x.n} de ${T.LIMITE}</span></div>
      <span class="tmp-barra" aria-hidden="true"><i style="width:${Math.round((x.n / T.LIMITE) * 100)}%"></i></span>
      <small>${x.completa ? `✅ Línea base: <b>${T.texto(x.promedio)}</b>${x.total > x.n ? ` · ya llevas ${x.total} registros` : ""}` : x.n ? `Promedio hasta ahora: <b>${T.texto(x.promedio)}</b> · ${x.faltan === 1 ? "falta 1" : `faltan ${x.faltan}`}` : "Sin registros todavía"}</small>
    </div>`;
    }).join("")}`;
}

// ---------- Días anotados ----------
// Los 90 más nuevos; "Ver 90 días más" trae los anteriores (QA fase 8, D-115).
const DIAS_POR_VEZ = 90;
let diasVer = DIAS_POR_VEZ;
function renderDias() {
  const el = $("tmp-dias");
  const lista = ds.slice().reverse(), ver = lista.slice(0, diasVer), resto = lista.length - ver.length;
  const todos = T.promedioDias(ds);
  const orden = todas();
  el.innerHTML = `
    <h2 class="tmp-titulo" id="tmp-dias-t">Tus días</h2>
    ${!cargado ? `<p class="empty-state">Cargando…</p>` : !lista.length ? `<p class="empty-state">Todavía no anotaste ningún día.</p>` : `
    <div class="tmp-resumen-dias" data-tmp-resumen-dias>
      <div><b>${todos.dias}</b><span>${todos.dias === 1 ? "día registrado" : "días registrados"}</span></div>
      <div><b>${T.texto(todos.promedio)}</b><span>tu día en promedio (todo junto)</span></div>
    </div>
    <p class="tmp-nota">Toca un día para corregirlo.</p>
    ${ver.map(d => `
    <button type="button" class="bib-item tmp-dia" data-tmp-dia="${d.fecha}">
      <span class="tmp-dia-cab"><b>${esc(T.fechaLarga(d.fecha))}</b><b class="tmp-dia-total">${T.texto(T.totalDia(d))}</b></span>
      <span>${orden.filter(a => d.seg[a.id]).concat(Object.keys(d.seg).filter(id => !orden.some(a => a.id === id)).map(actDe)).map(a => `${esc(a.nombre)}: ${T.texto(d.seg[a.id])}${d.auto && d.auto[a.id] ? " ⚡" : ""}`).join(" · ")}</span>
    </button>`).join("")}
    ${resto > 0 ? `<button type="button" class="lib-btn-sec lib-btn-ancho lib-mt" data-tmp-mas>${resto > DIAS_POR_VEZ ? `Ver ${DIAS_POR_VEZ} días más` : `Ver ${resto === 1 ? "el día que falta" : `los ${resto} días que faltan`}`}</button>` : ""}`}`;
}

// ---------- Exportar (JSON y CSV) ----------
function exportar(formato) {
  const hoy = hoyLocal(), nombres = {};
  todas().forEach(a => { nombres[a.id] = a.nombre; });
  if (formato === "json") {
    // Con el plan de la mañana y los experimentos (fase 7; QA fase 8, D-115).
    const datos = { app: "Manolo", seccion: "Medir tiempos", version: 1, exportado: new Date().toISOString(), actividades: A.paraGuardar(todas()),
      plan: (ajustes && ajustes.plan) || null, experimentos: (ajustes && ajustes.experimentos) || {}, dias: docs };
    window.Lectura.descargar(`manolo-tiempos-${hoy}.json`, JSON.stringify(datos, null, 2), "application/json");
    return;
  }
  const filas = [["fecha", "actividad", "id", "segundos", "minutos", "automatico"]];
  ds.forEach(d => Object.keys(d.seg).forEach(id => filas.push([d.fecha, nombres[id] || id, id, d.seg[id], (d.seg[id] / 60).toFixed(1).replace(".", ","), d.auto && d.auto[id] ? d.auto[id].f : ""])));
  // Separado con ";" y decimales con coma, como lo abre Excel en español.
  const csv = filas.map(f => f.map(x => { const t = String(x); return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }).join(";")).join("\n");
  window.Lectura.descargar(`manolo-tiempos-${hoy}.csv`, `﻿${csv}\n`, "text/csv");
}

app.addEventListener("click", e => {
  const t = e.target.closest("[data-tmp-tipo]");
  if (t) { tipo = t.dataset.tmpTipo; ref = hoyLocal(); renderPromedios(); return; }
  const bd = e.target.closest("[data-tmp-dow]");
  if (bd) { dow = Number(bd.dataset.tmpDow); renderPromedios(); return; }
  const dm = e.target.closest("[data-tmp-dow-mover]");
  if (dm) { const i = ORDEN_DIAS.indexOf(dow); dow = ORDEN_DIAS[(i + Number(dm.dataset.tmpDowMover) + 7) % 7]; renderPromedios(); return; }
  const m = e.target.closest("[data-tmp-mover]");
  if (m) { ref = T.mover(tipo, ref, Number(m.dataset.tmpMover)); renderPromedios(); return; }
  const ex = e.target.closest("[data-tmp-exportar]");
  if (ex) { exportar(ex.dataset.tmpExportar); return; }
  if (e.target.closest("[data-tmp-mas]")) { diasVer += DIAS_POR_VEZ; renderDias(); return; }
  const d = e.target.closest("[data-tmp-dia]");
  if (d) {
    fecha = d.dataset.tmpDia;
    borradores = {};
    aviso = null;
    renderForm();
    anotar.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

// ---------- Para las otras piezas (Mi mañana, Tus actividades, se llena solo) ----------
window.TiemposDatos = {
  listo: () => cargado && ajustesCargados,
  docs: () => docs,
  ds: () => ds,
  ajustes: () => ajustes,
  actividades: () => todas(),
  // Tu promedio (últimos 30 registros), sin el día `sin` (el que estás midiendo).
  promedios: sin => T.promedios(sin ? ds.filter(d => d.fecha !== sin) : ds, todas()),
  segDe: (f, id) => { const d = docs[f]; return d && d.seg && d.seg[id] > 0 ? d.seg[id] : 0; },
  // Un tiempo medido (⏱ o Mi mañana): igual que si lo escribieras.
  guardar: (f, id, seg) => { guardarSeg(f, id, seg); if (f === fecha) { delete borradores[id]; aviso = { id, texto: "✓ Guardado" }; } render(); avisarDatos(); },
  // Plan de la mañana y experimentos (fase 7): se suman a lo que ya había.
  guardarAjustes: parcial => {
    const prev = ajustes || {};
    const nuevo = Object.assign({}, prev, parcial);
    if (parcial.experimentos) {
      nuevo.experimentos = Object.assign({}, prev.experimentos);
      Object.keys(parcial.experimentos).forEach(k => { nuevo.experimentos[k] = Object.assign({}, nuevo.experimentos[k], parcial.experimentos[k]); });
    }
    ajustes = nuevo;
    render();
    avisarDatos();
    return refAjustes().set(Object.assign({}, parcial, { actualizado: Date.now() }), { merge: true }).catch(fallo);
  },
  quitarExperimento: id => {
    if (ajustes && ajustes.experimentos) { ajustes = Object.assign({}, ajustes, { experimentos: Object.assign({}, ajustes.experimentos) }); delete ajustes.experimentos[id]; }
    render();
    avisarDatos();
    return refAjustes().update({ [`experimentos.${id}`]: borrar(), actualizado: Date.now() }).catch(fallo);
  },
  guardarActividades: mapa => {
    ajustes = Object.assign({}, ajustes, { actividades: Object.assign({}, ajustes && ajustes.actividades, mapa) });
    render();
    avisarDatos();
    return refAjustes().set({ actividades: mapa, actualizado: Date.now() }, { merge: true }).catch(fallo);
  },
  // Lo que llega solo (js/tiempos-llenar.js): [{ tipo: "poner"|"quitar", fecha, id, fuente, seg }].
  escribirAuto: lista => {
    const lote = db.batch(), ahora = Date.now();
    lista.forEach(x => {
      const r = coleccion().doc(x.fecha);
      if (x.tipo === "poner") {
        lote.set(r, { fecha: x.fecha, seg: { [x.id]: x.seg }, auto: { [x.id]: { f: x.fuente, s: x.seg } }, actualizado: ahora }, { merge: true });
        const d = JSON.parse(JSON.stringify(docs[x.fecha] || { fecha: x.fecha, seg: {} }));
        d.seg = Object.assign({}, d.seg, { [x.id]: x.seg });
        d.auto = Object.assign({}, d.auto, { [x.id]: { f: x.fuente, s: x.seg } });
        docs[x.fecha] = d;
      } else {
        lote.set(r, { seg: { [x.id]: borrar() }, auto: { [x.id]: borrar() }, actualizado: ahora }, { merge: true });
        if (docs[x.fecha]) { const d = JSON.parse(JSON.stringify(docs[x.fecha])); delete d.seg[x.id]; if (d.auto) delete d.auto[x.id]; docs[x.fecha] = d; }
      }
    });
    ds = T.dias(docs);
    render();
    return lote.commit();
  }
};

// ---------- Datos ----------
onAuthReady(() => {
  coleccion().onSnapshot(snap => {
    docs = {};
    snap.docs.forEach(d => { docs[d.id] = d.data(); });
    ds = T.dias(docs);
    cargado = true;
    servidor = !(snap.metadata && snap.metadata.fromCache);
    render();
    avisarDatos();
    avisarHabitos();
  }, err => console.warn("Medir tiempos:", err));
  refAjustes().onSnapshot(snap => {
    ajustes = snap.exists ? snap.data() : null;
    ajustesCargados = true;
    // El primer día con la versión nueva: se guardan tus actividades y las
    // que se llenan solas empiezan desde hoy (tus días de antes no cambian).
    if (!snap.exists && !(snap.metadata && snap.metadata.fromCache)) {
      const inicial = A.inicial(hoyLocal());
      ajustes = { actividades: inicial };
      refAjustes().set({ v: 1, actividades: inicial, creado: Date.now() }, { merge: true }).catch(err => console.warn("Medir tiempos (ajustes):", err));
    }
    render();
    avisarDatos();
  }, err => { console.warn("Medir tiempos (ajustes):", err); ajustesCargados = true; render(); });
});
render();
})();
