// ---------- Medir tiempos (sub-panel de Inicio, provisoria) ----------
// Anotar por día cuánto tardaste en cada actividad (minutos y segundos),
// promedios por semana y por mes, y el promedio final al llegar a 30
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
let sucio = false;        // hay tiempos escritos sin guardar
let aviso = "";           // "✓ Guardado"

const coleccion = () => db.collection("users").doc(currentUser.uid).collection("tiempos");

app.innerHTML = `
  <form class="tmp-card tmp-form" id="tmp-form" novalidate></form>
  <section class="tmp-card" id="tmp-promedios" aria-labelledby="tmp-prom-t"></section>
  <section class="tmp-card" id="tmp-avance" aria-labelledby="tmp-av-t"></section>
  <section class="tmp-card" id="tmp-dias" aria-labelledby="tmp-dias-t"></section>`;
const $ = id => document.getElementById(id);
const form = $("tmp-form");

function render() {
  if (!sucio) renderForm();
  renderPromedios();
  renderAvance();
  renderDias();
}

// ---------- Anotar ----------
function renderForm() {
  const hoy = hoyLocal();
  const e = T.estado(ds);
  const delDia = (ds.find(d => d.fecha === fecha) || { seg: {} }).seg;
  form.innerHTML = `
    <h2 class="tmp-titulo">Anotar tiempos</h2>
    <label class="lib-campo"><span>Día</span><input type="date" class="lib-input" name="fecha" value="${fecha}" max="${hoy}"></label>
    ${T.ACTIVIDADES.map(a => {
      const c = T.campos(delDia[a.id]);
      const cerrada = T.bloqueada(ds, a.id, fecha);
      return `
    <div class="tmp-fila${cerrada ? " is-cerrada" : ""}" data-tmp-act="${a.id}">
      <div class="tmp-act"><b>${esc(a.nombre)}</b>${a.detalle ? `<small>${esc(a.detalle)}</small>` : ""}</div>
      ${cerrada
        ? `<p class="tmp-cerrada">✅ ${T.LIMITE} de ${T.LIMITE} · promedio final <b>${T.texto(e[a.id].promedio)}</b></p>`
        : `<div class="tmp-campos">
        <label><input class="lib-input" name="${a.id}-min" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" value="${c.min}" aria-label="${esc(a.nombre)}: minutos"><span aria-hidden="true">min</span></label>
        <label><input class="lib-input" name="${a.id}-seg" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" value="${c.seg}" aria-label="${esc(a.nombre)}: segundos"><span aria-hidden="true">seg</span></label>
      </div>`}
    </div>`;
    }).join("")}
    <p class="lib-error" hidden></p>
    <button type="submit" class="lib-btn lib-btn-ancho">Guardar</button>
    <p class="tmp-ok" aria-live="polite">${aviso}</p>`;
}

form.addEventListener("input", e => {
  if (e.target.name === "fecha") return;
  sucio = true;
  if (aviso) { aviso = ""; form.querySelector(".tmp-ok").textContent = ""; }
});
form.addEventListener("change", e => {
  if (e.target.name !== "fecha" || !e.target.value) return;
  fecha = e.target.value > hoyLocal() ? hoyLocal() : e.target.value;
  sucio = false;
  aviso = "";
  renderForm();
});
form.addEventListener("submit", e => {
  e.preventDefault();
  const anterior = (docs[fecha] && docs[fecha].seg) || {};
  const seg = Object.assign({}, anterior);   // lo que no se edita aquí queda igual
  const errores = [];
  T.ACTIVIDADES.forEach(a => {
    if (T.bloqueada(ds, a.id, fecha)) return;
    const r = T.leer(form.elements[`${a.id}-min`].value, form.elements[`${a.id}-seg`].value);
    if (r.error) errores.push({ campo: `${a.id}-min`, texto: `${a.nombre}: ${r.error}` });
    else if (r.seg) seg[a.id] = r.seg;
    else delete seg[a.id];
  });
  if (!errores.length && !Object.keys(seg).length && !docs[fecha]) errores.push({ campo: `${T.ACTIVIDADES[0].id}-min`, texto: "Escribe al menos un tiempo." });
  window.Lectura.errores(form, errores);
  if (errores.length) return;
  const fallo = err => alert(`No se pudo guardar: ${err && err.message ? err.message : err}`);
  if (Object.keys(seg).length) coleccion().doc(fecha).set({ fecha, seg, actualizado: Date.now() }).catch(fallo);
  else coleccion().doc(fecha).delete().catch(fallo);
  sucio = false;
  aviso = Object.keys(seg).length ? `✓ Guardado (${T.fechaLarga(fecha)})` : "✓ Día borrado";
  renderForm();
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
  el.innerHTML = `
    <h2 class="tmp-titulo" id="tmp-dias-t">Tus días</h2>
    ${!cargado ? `<p class="empty-state">Cargando…</p>` : !lista.length ? `<p class="empty-state">Todavía no anotaste ningún día.</p>` : `
    <p class="tmp-nota">Toca un día para corregirlo.</p>
    ${lista.map(d => `
    <button type="button" class="bib-item tmp-dia" data-tmp-dia="${d.fecha}">
      <b>${esc(T.fechaLarga(d.fecha))}</b>
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
    sucio = false;
    aviso = "";
    renderForm();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
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
