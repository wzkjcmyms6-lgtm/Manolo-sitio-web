// ---------- Medir tiempos: estadísticas y experimentos (pantalla, fase 7) ----------
// - Estadísticas de cada actividad: promedio, mediana, mejor y peor,
//   tendencia (últimos 30 días contra los 30 anteriores) y días de semana
//   contra fin de semana; y el total de tu mañana por día (últimos 30).
// - Experimentos: "¿Qué cambiaste?" desde un día; sus 30 registros se
//   comparan con tu línea base (tus primeros 30). Se guardan en
//   meta/tiempos_ajustes.experimentos.
// Lógica en js/tiempos-stats.js. D-114.
(function () {
"use strict";
const S = window.TiemposStats, T = window.TiemposMotor, A = window.TiemposActividades;
if (!S || !T || !A || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const D = () => window.TiemposDatos || null;
let actSel = null;       // actividad elegida en Estadísticas
let nuevo = false;       // formulario de experimento abierto
const corta = f => { const d = new Date(f + "T12:00:00Z"); return `${d.getUTCDate()} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][d.getUTCMonth()]}`; };
const pct = n => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)} %`;

// ---------- Estadísticas ----------
function pintarStats(el) {
  if (!el) return;
  const d = D();
  if (!d || !d.listo()) { el.innerHTML = ""; return; }
  const hoy = hoyLocal(), ds = d.ds();
  const acts = d.actividades().filter(a => !a.archivada || ds.some(x => x.seg[a.id]));
  const est = S.estadisticas(ds, acts, hoy);
  const con = acts.filter(a => est[a.id]);
  if (!con.length) { el.innerHTML = `<h2 class="tmp-titulo">📊 Estadísticas</h2><p class="empty-state">Anota o mide tus tiempos: aquí verás tu mediana, tus mejores días y si vas más rápido.</p>`; return; }
  if (!actSel || !est[actSel]) actSel = con[0].id;
  const e = est[actSel];
  const t = e.tendencia;
  const tend = !t ? "Con un mes más de datos te digo si vas más rápido." : t.sentido === "mejor" ? `↓ ${Math.abs(t.cambio)} % más rápido que el mes anterior (${T.texto(t.antes)} → ${T.texto(t.ahora)}).`
    : t.sentido === "peor" ? `↑ ${t.cambio} % más lento que el mes anterior (${T.texto(t.antes)} → ${T.texto(t.ahora)}).` : `→ Igual que el mes anterior (${T.texto(t.ahora)}).`;
  const cifra = (n, v, sub) => `<div><span>${n}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
  // Tu mañana por día (últimos 30 días con algo).
  const ids = A.pasosManana(d.ajustes()).map(x => x.id);
  const mpd = S.mananaPorDia(ds, ids, 30);
  const max = Math.max(1, ...mpd.map(x => x.total));
  const medMan = S.mediana(mpd.map(x => x.total));
  el.innerHTML = `
    <h2 class="tmp-titulo">📊 Estadísticas</h2>
    <div class="tst-chips" role="group" aria-label="Actividad">${con.map(x => `<button type="button" class="tst-chip${x.id === actSel ? " is-sel" : ""}" data-tst-act="${x.id}" aria-pressed="${x.id === actSel}">${esc(A.etiqueta(x))}</button>`).join("")}</div>
    <div class="tst-cifras" data-tst-cifras>
      ${cifra("Promedio", T.texto(e.promedio), `${e.n} ${e.n === 1 ? "registro" : "registros"}`)}
      ${cifra("Mediana", T.texto(e.mediana), "tu día típico")}
      ${cifra("Mejor", T.texto(e.mejor.seg), esc(corta(e.mejor.fecha)))}
      ${cifra("Peor", T.texto(e.peor.seg), esc(corta(e.peor.fecha)))}
    </div>
    <p class="tst-tend ${t ? `is-${t.sentido}` : ""}">${esc(tend)}</p>
    <p class="tmp-nota">${e.semana.laborables.n ? `Lunes a viernes: <b>${T.texto(e.semana.laborables.promedio)}</b>` : "Sin datos de lunes a viernes"} · ${e.semana.finde.n ? `fin de semana: <b>${T.texto(e.semana.finde.promedio)}</b>` : "sin datos del fin de semana"}.</p>
    ${mpd.length >= 2 ? `
    <h3 class="tst-h">Tu mañana por día</h3>
    <p class="tmp-nota">El total de tus pasos de la mañana, los últimos ${mpd.length} días. Típico: <b>${T.texto(medMan)}</b>.</p>
    <div class="tst-barras" role="img" aria-label="Total de tu mañana por día, últimos ${mpd.length} días">${mpd.map(x => `<span class="tst-b${x.total > medMan ? " is-mas" : ""}" style="height:${Math.max(4, Math.round((x.total / max) * 100))}%" title="${esc(corta(x.fecha))}: ${esc(T.texto(x.total))}"></span>`).join("")}</div>
    <div class="tst-ejes"><span>${esc(corta(mpd[0].fecha))}</span><span>${esc(corta(mpd[mpd.length - 1].fecha))}</span></div>` : ""}`;
}

// ---------- Línea base y experimentos ----------
function pintarExp(el) {
  if (!el) return;
  const d = D();
  if (!d || !d.listo()) { el.innerHTML = ""; return; }
  const hoy = hoyLocal(), ds = d.ds(), acts = d.actividades().filter(a => !a.archivada);
  const exps = (d.ajustes() && d.ajustes().experimentos) || {};
  const lista = Object.keys(exps).filter(id => exps[id] && exps[id].nombre && exps[id].desde).sort((x, y) => (exps[y].desde || "").localeCompare(exps[x].desde || ""));
  el.innerHTML = `
    <div class="tmp-cab"><h2 class="tmp-titulo">🧪 Experimentos</h2>${nuevo ? "" : `<button type="button" class="tmp-editar" data-tex="nuevo">＋ Nuevo</button>`}</div>
    <p class="tmp-nota">¿Cambiaste algo en tu rutina? Desde ese día, tus próximos ${S.LIMITE} registros de cada actividad se comparan con tu línea base (tus primeros ${S.LIMITE}).</p>
    ${nuevo ? `
    <form class="tex-form" novalidate>
      <label class="lib-campo"><span>¿Qué cambiaste?</span><input type="text" class="lib-input" name="nombre" maxlength="60" autocomplete="off" placeholder="Ej: dejo la ropa lista la noche anterior"></label>
      <label class="lib-campo"><span>Desde</span><input type="date" class="lib-input" name="desde" value="${hoy}" max="${hoy}"></label>
      <label class="lib-campo"><span>Nota (opcional)</span><input type="text" class="lib-input" name="nota" maxlength="300" autocomplete="off"></label>
      <p class="lib-error" role="alert" hidden></p>
      <div class="tpl-botones"><button type="button" class="lib-btn-sec" data-tex="cancelar">Cancelar</button><button type="submit" class="lib-btn">Empezar</button></div>
    </form>` : ""}
    ${lista.length ? lista.map(id => tarjetaExp(id, exps[id], ds, acts, hoy)).join("") : nuevo ? "" : `<p class="empty-state">Todavía no tienes experimentos.</p>`}`;
}
function tarjetaExp(id, x, ds, acts, hoy) {
  const r = S.experimento(ds, x, acts);
  const filas = acts.filter(a => r.act[a.id] && r.act[a.id].n).map(a => {
    const v = r.act[a.id];
    const dif = v.pct != null ? `<small class="${v.pct < 0 ? "is-mejor" : v.pct > 0 ? "is-peor" : ""}">${pct(v.pct)}</small>` : "<small>sin base</small>";
    return `<li><span>${esc(A.etiqueta(a))}</span><b>${T.texto(v.mediana)}</b><span class="tex-antes">${v.base.mediana != null ? `antes ${T.texto(v.base.mediana)}` : ""}</span>${dif}<span class="tex-n">${v.n}/${S.LIMITE}</span></li>`;
  }).join("");
  return `
    <div class="tex-tarjeta${r.terminado ? " is-terminado" : ""}" data-tex-id="${esc(id)}">
      <div class="tex-cab"><b>${esc(x.nombre)}</b><small>desde ${esc(corta(x.desde))}${x.hasta ? ` hasta ${esc(corta(x.hasta))}` : ""}${r.terminado ? " · terminado" : " · en curso"}</small></div>
      ${x.nota ? `<p class="tmp-nota">${esc(x.nota)}</p>` : ""}
      ${filas ? `<ul class="tex-lista">${filas}</ul><p class="tmp-nota">Mediana del experimento contra tu línea base (− = más rápido).</p>` : `<p class="tmp-nota">Todavía sin registros desde ${esc(corta(x.desde))}.</p>`}
      <div class="tex-acciones">${!x.hasta ? `<button type="button" class="tman-link" data-tex-terminar="${esc(id)}">Terminarlo hoy</button>` : ""}<button type="button" class="tman-link is-tenue" data-tex-quitar="${esc(id)}">Quitar</button></div>
    </div>`;
}

function repintar() {
  pintarStats(document.getElementById("tmp-stats"));
  pintarExp(document.getElementById("tmp-exp"));
}
document.addEventListener("click", e => {
  const a = e.target.closest("[data-tst-act]");
  if (a) { actSel = a.dataset.tstAct; pintarStats(document.getElementById("tmp-stats")); return; }
  const n = e.target.closest("[data-tex]");
  if (n) { nuevo = n.dataset.tex === "nuevo"; pintarExp(document.getElementById("tmp-exp")); if (nuevo) { const i = document.querySelector('.tex-form [name="nombre"]'); if (i) i.focus(); } return; }
  const t = e.target.closest("[data-tex-terminar]");
  if (t && D()) { D().guardarAjustes({ experimentos: { [t.dataset.texTerminar]: { hasta: hoyLocal() } } }); return; }
  const q = e.target.closest("[data-tex-quitar]");
  if (q && D() && confirm("¿Quitar este experimento? Tus tiempos no se borran.")) {
    D().quitarExperimento(q.dataset.texQuitar);
  }
});
document.addEventListener("submit", e => {
  const f = e.target.closest(".tex-form");
  if (!f) return;
  e.preventDefault();
  const v = S.validarExperimento({ nombre: f.elements.nombre.value, desde: f.elements.desde.value, nota: f.elements.nota.value }, hoyLocal());
  if (!v.ok) { const p = f.querySelector(".lib-error"); p.textContent = v.error; p.hidden = false; return; }
  nuevo = false;
  if (D()) D().guardarAjustes({ experimentos: { [`e${Date.now().toString(36)}`]: Object.assign(v.doc, { creado: Date.now() }) } });
});
window.addEventListener("tiempos:datos", repintar);

window.TiemposStatsUI = { pintarStats, pintarExp };
})();
