// ---------- Medir tiempos (sub-panel de Inicio, provisoria) ----------
// Anotar por día cuánto tardaste en cada actividad (minutos y segundos;
// cada una se guarda sola, con su botón), promedios por semana y por mes, y el promedio final al llegar a 30
// registros por actividad (ahí se cierra). Datos en users/{uid}/tiempos
// (un documento por día, id = fecha); la lógica en js/tiempos-motor.js.
// Para quitar la sección, ver docs/TIEMPOS.md.
(function () {
const T = window.TiemposMotor;
const app = document.getElementById("tmp-app");
if (!app || !T || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;

let docs = {};            // id (fecha) → datos tal como están en Firestore
let ds = [];              // días normalizados
let cargado = false;
let fecha = hoyLocal();   // día que se está anotando
let tipo = "semana";      // promedios: "semana" | "mes"
let ref = hoyLocal();     // semana o mes que se ve
let borradores = {};      // id → { min, seg } escritos y todavía sin guardar (del día elegido)
let aviso = null;         // { id, texto }: "✓ Guardado" junto a esa actividad

const coleccion = () => db.collection("users").doc(currentUser.uid).collection("tiempos");

app.innerHTML = `
  <section class="tmp-card tmp-anotar" id="tmp-anotar" aria-labelledby="tmp-anotar-t"></section>
  <section class="tmp-card" id="tmp-promedios" aria-labelledby="tmp-prom-t"></section>
  <section class="tmp-card" id="tmp-avance" aria-labelledby="tmp-av-t"></section>
  <section class="tmp-card" id="tmp-dias" aria-labelledby="tmp-dias-t"></section>`;
const $ = id => document.getElementById(id);
const anotar = $("tmp-anotar");
const fallo = err => alert(`No se pudo guardar: ${err && err.message ? err.message : err}`);

function render() {
  renderForm();
  renderPromedios();
  renderAvance();
  renderDias();
}

// Cambia el día en memoria al toque (Firestore confirma después con onSnapshot).
function cambiarLocal(id, seg) {
  const previo = (docs[fecha] && docs[fecha].seg) || {};
  const nuevo = Object.assign({}, previo);
  if (seg) nuevo[id] = seg; else delete nuevo[id];
  if (Object.keys(nuevo).length) docs[fecha] = Object.assign({}, docs[fecha], { fecha, seg: nuevo });
  else delete docs[fecha];
  ds = T.dias(docs);
  return nuevo;
}

// ---------- Anotar ----------
// Cada actividad se guarda sola, con su botón: no todos los días se hace todo
// (pedido del dueño 2026-10-29).
function renderForm() {
  const foco = anotar.contains(document.activeElement) ? document.activeElement.name : null;
  const hoy = hoyLocal();
  const e = T.estado(ds);
  const delDia = (ds.find(d => d.fecha === fecha) || { seg: {} }).seg;
  anotar.innerHTML = `
    <h2 class="tmp-titulo" id="tmp-anotar-t">Anotar tiempos</h2>
    <p class="tmp-nota">Guarda solo lo que hiciste ese día: cada actividad tiene su propio botón.</p>
    <label class="lib-campo"><span>Día</span><input type="date" class="lib-input" name="fecha" value="${fecha}" max="${hoy}"></label>
    ${T.ACTIVIDADES.map(a => fila(a, delDia[a.id], e[a.id])).join("")}`;
  if (foco) { const el = anotar.querySelector(`[name="${foco}"]`); if (el) el.focus(); }
}

function fila(a, guardado, est) {
  const cerrada = T.bloqueada(ds, a.id, fecha);
  const c = borradores[a.id] || T.campos(guardado);
  const ok = aviso && aviso.id === a.id ? aviso.texto : "";
  return `
    <form class="tmp-fila${cerrada ? " is-cerrada" : ""}${guardado ? " is-guardada" : ""}" data-tmp-act="${a.id}" novalidate>
      <div class="tmp-act"><b>${esc(a.nombre)}</b>${guardado ? `<span class="tmp-hecho">✓ ${T.texto(guardado)}</span>` : ""}${a.detalle ? `<small>${esc(a.detalle)}</small>` : ""}</div>
      ${cerrada
        ? `<p class="tmp-cerrada">✅ ${T.LIMITE} de ${T.LIMITE} · promedio final <b>${T.texto(est.promedio)}</b></p>`
        : `<div class="tmp-campos">
        <label><input class="lib-input" name="${a.id}-min" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" value="${esc(c.min)}" aria-label="${esc(a.nombre)}: minutos"><span aria-hidden="true">min</span></label>
        <label><input class="lib-input" name="${a.id}-seg" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" value="${esc(c.seg)}" aria-label="${esc(a.nombre)}: segundos"><span aria-hidden="true">seg</span></label>
        <button type="submit" class="lib-btn tmp-guardar">${guardado ? "Cambiar" : "Guardar"}</button>
      </div>
      <p class="lib-error" hidden></p>
      ${guardado ? `<button type="button" class="tmp-quitar" data-tmp-quitar="${a.id}">Quitar de este día</button>` : ""}
      <p class="tmp-ok" aria-live="polite">${ok}</p>`}
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
  if (!id || T.bloqueada(ds, id, fecha)) return;
  const r = T.leer(f.elements[`${id}-min`].value, f.elements[`${id}-seg`].value);
  const error = r.error || (r.seg ? "" : "Escribe los minutos (y los segundos, si quieres).");
  window.Lectura.errores(f, error ? [{ campo: `${id}-min`, texto: error }] : []);
  if (error) return;
  // merge: solo cambia esta actividad; las otras del día quedan como estaban.
  coleccion().doc(fecha).set({ fecha, seg: { [id]: r.seg }, actualizado: Date.now() }, { merge: true }).catch(fallo);
  cambiarLocal(id, r.seg);
  delete borradores[id];
  aviso = { id, texto: "✓ Guardado" };
  render();
});
anotar.addEventListener("click", e => {
  const q = e.target.closest("[data-tmp-quitar]");
  if (!q) return;
  const id = q.dataset.tmpQuitar, a = T.ACTIVIDADES.find(x => x.id === id);
  if (!confirm(`¿Quitar ${a.nombre} del ${T.fechaLarga(fecha)}?`)) return;
  const quedan = cambiarLocal(id, null);
  if (Object.keys(quedan).length) coleccion().doc(fecha).update({ [`seg.${id}`]: firebase.firestore.FieldValue.delete(), actualizado: Date.now() }).catch(fallo);
  else coleccion().doc(fecha).delete().catch(fallo);
  delete borradores[id];
  aviso = { id, texto: "Quitado de este día" };
  render();
});

// ---------- Promedios por semana y por mes ----------
function renderPromedios() {
  const el = $("tmp-promedios");
  const hoy = hoyLocal();
  const p = T.periodo(ds, tipo, ref, hoy);
  const ahora = tipo === "semana" ? "Esta semana" : "Este mes";
  el.innerHTML = `
    <h2 class="tmp-titulo" id="tmp-prom-t">Promedios</h2>
    <div class="fin-tabs tmp-tabs" role="tablist" aria-label="Promedio por">
      <button type="button" class="fin-tab${tipo === "semana" ? " active" : ""}" role="tab" aria-selected="${tipo === "semana"}" data-tmp-tipo="semana">Semana</button>
      <button type="button" class="fin-tab${tipo === "mes" ? " active" : ""}" role="tab" aria-selected="${tipo === "mes"}" data-tmp-tipo="mes">Mes</button>
    </div>
    <div class="tmp-nav">
      <button type="button" data-tmp-mover="-1" aria-label="${tipo === "semana" ? "Semana anterior" : "Mes anterior"}">‹</button>
      <b id="tmp-periodo">${p.enCurso ? `${ahora} · ` : ""}${esc(p.titulo)}</b>
      <button type="button" data-tmp-mover="1" aria-label="${tipo === "semana" ? "Semana siguiente" : "Mes siguiente"}"${p.enCurso || p.futuro ? " disabled" : ""}>›</button>
    </div>
    ${cargado && !p.hayDatos ? `<p class="empty-state">Sin tiempos ${tipo === "semana" ? "esta semana" : "este mes"}.</p>` : `
    <table class="tmp-tabla">
      <thead><tr><th scope="col">Actividad</th><th scope="col">Promedio</th><th scope="col">Días</th></tr></thead>
      <tbody>${T.ACTIVIDADES.map(a => `
        <tr data-tmp-prom="${a.id}"><td>${esc(a.nombre)}</td><td>${T.texto(p.act[a.id].promedio)}</td><td>${p.act[a.id].n}</td></tr>`).join("")}
      </tbody>
      <tfoot><tr data-tmp-prom="dia"><th scope="row">Tu día (todo junto)</th><td>${T.texto(p.dias.promedio)}</td><td>${p.dias.dias}</td></tr></tfoot>
    </table>`}
    ${p.enCurso && p.hayDatos ? `<p class="tmp-nota">${tipo === "semana" ? "La semana" : "El mes"} todavía no termina: el promedio se va armando con cada día.</p>` : ""}`;
}

// ---------- Camino a los 30 registros ----------
function renderAvance() {
  const el = $("tmp-avance");
  const e = T.estado(ds);
  el.innerHTML = `
    <h2 class="tmp-titulo" id="tmp-av-t">Promedio final</h2>
    <p class="tmp-nota">Con ${T.LIMITE} registros de una actividad, se cierra y ese es tu tiempo promedio.</p>
    ${T.ACTIVIDADES.map(a => {
      const x = e[a.id];
      return `
    <div class="tmp-avance${x.completa ? " is-completa" : ""}" data-tmp-avance="${a.id}">
      <div class="tmp-avance-fila"><b>${esc(a.nombre)}</b><span>${x.n} de ${T.LIMITE}</span></div>
      <span class="tmp-barra" aria-hidden="true"><i style="width:${Math.round((x.n / T.LIMITE) * 100)}%"></i></span>
      <small>${x.completa ? `✅ Promedio final: <b>${T.texto(x.promedio)}</b>` : x.n ? `Promedio hasta ahora: <b>${T.texto(x.promedio)}</b> · ${x.faltan === 1 ? "falta 1" : `faltan ${x.faltan}`}` : "Sin registros todavía"}</small>
    </div>`;
    }).join("")}`;
}

// ---------- Días anotados ----------
function renderDias() {
  const el = $("tmp-dias");
  const lista = ds.slice().reverse();
  const todos = T.promedioDias(ds);
  el.innerHTML = `
    <h2 class="tmp-titulo" id="tmp-dias-t">Tus días</h2>
    ${!cargado ? `<p class="empty-state">Cargando…</p>` : !lista.length ? `<p class="empty-state">Todavía no anotaste ningún día.</p>` : `
    <div class="tmp-resumen-dias" data-tmp-resumen-dias>
      <div><b>${todos.dias}</b><span>${todos.dias === 1 ? "día registrado" : "días registrados"}</span></div>
      <div><b>${T.texto(todos.promedio)}</b><span>tu día en promedio (todo junto)</span></div>
    </div>
    <p class="tmp-nota">Toca un día para corregirlo.</p>
    ${lista.map(d => `
    <button type="button" class="bib-item tmp-dia" data-tmp-dia="${d.fecha}">
      <span class="tmp-dia-cab"><b>${esc(T.fechaLarga(d.fecha))}</b><b class="tmp-dia-total">${T.texto(T.totalDia(d))}</b></span>
      <span>${T.ACTIVIDADES.filter(a => d.seg[a.id]).map(a => `${esc(a.nombre)}: ${T.texto(d.seg[a.id])}`).join(" · ")}</span>
    </button>`).join("")}`}`;
}

app.addEventListener("click", e => {
  const t = e.target.closest("[data-tmp-tipo]");
  if (t) { tipo = t.dataset.tmpTipo; ref = hoyLocal(); renderPromedios(); return; }
  const m = e.target.closest("[data-tmp-mover]");
  if (m) { ref = T.mover(tipo, ref, Number(m.dataset.tmpMover)); renderPromedios(); return; }
  const d = e.target.closest("[data-tmp-dia]");
  if (d) {
    fecha = d.dataset.tmpDia;
    borradores = {};
    aviso = null;
    renderForm();
    anotar.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

// ---------- Datos ----------
onAuthReady(() => {
  coleccion().onSnapshot(snap => {
    docs = {};
    snap.docs.forEach(d => { docs[d.id] = d.data(); });
    ds = T.dias(docs);
    cargado = true;
    render();
  }, err => console.warn("Medir tiempos:", err));
});
render();
})();
