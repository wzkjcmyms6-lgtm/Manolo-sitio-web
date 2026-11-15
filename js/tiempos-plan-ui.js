// ---------- Medir tiempos: plan de la mañana (pantalla, fase 7) ----------
// Pones a qué hora te levantas y a qué hora tienes que estar listo; con tus
// medianas se arma la línea de tiempo del día que elijas (los pasos que
// sueles hacer ese día de la semana): si te sobra o te falta tiempo, dónde
// se te va más y dónde podrías ahorrar. Guarda en
// meta/tiempos_ajustes.plan = { levantarse, listo }. Lógica en
// js/tiempos-plan.js. D-114.
(function () {
"use strict";
const P = window.TiemposPlan, T = window.TiemposMotor, A = window.TiemposActividades;
if (!P || !T || !A || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const D = () => window.TiemposDatos || null;
const DIAS = [["Lu", 1], ["Ma", 2], ["Mi", 3], ["Ju", 4], ["Vi", 5], ["Sá", 6], ["Do", 0]];
const NOMBRES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
let dow = null;          // día de la semana elegido (null = hoy)
let editando = false;
const aprox = s => T.texto(Math.max(60, Math.round(s / 60) * 60));
// "5:30" → "05:30" (lo que pide el campo de hora).
const paraCampo = h => (h && /^\d:/.test(h) ? `0${h}` : h || "");

// El plan del día elegido (lo usa también "Mi mañana" y "Mi día").
function planDe(fecha) {
  const d = D();
  if (!d || !d.listo()) return null;
  const cfg = d.ajustes() && d.ajustes().plan;
  if (!cfg || !P.validar(cfg).ok) return null;
  const pasos = A.pasosManana(d.ajustes());
  const dw = new Date(fecha + "T12:00:00Z").getUTCDay();
  const ids = P.pasosDelDia(d.ds(), pasos.map(a => a.id), dw);
  const del = pasos.filter(a => ids.includes(a.id));
  return { cfg, dow: dw, pl: P.plan(cfg, del.map(a => ({ id: a.id, nombre: A.etiqueta(a) })), P.tiempos(d.ds().filter(x => x.fecha !== fecha), ids)) };
}

function pintar(el) {
  if (!el) return;
  const d = D();
  if (!d || !d.listo()) { el.innerHTML = ""; return; }
  const cfg = d.ajustes() && d.ajustes().plan;
  if (!cfg || editando) {
    el.innerHTML = `
      <h2 class="tmp-titulo">🗓️ Plan de la mañana</h2>
      <p class="tmp-nota">¿A qué hora te levantas y a qué hora tienes que estar listo? Con tus tiempos te armo la mañana.</p>
      <form class="tpl-form" novalidate>
        <label class="lib-campo"><span>Me levanto</span><input type="time" class="lib-input" name="levantarse" value="${esc(paraCampo(cfg && cfg.levantarse) || "05:30")}"></label>
        <label class="lib-campo"><span>Listo a las</span><input type="time" class="lib-input" name="listo" value="${esc(paraCampo(cfg && cfg.listo) || "08:00")}"></label>
        <p class="lib-error" role="alert" hidden></p>
        <div class="tpl-botones">${cfg ? `<button type="button" class="lib-btn-sec" data-tpl="cancelar">Cancelar</button>` : ""}<button type="submit" class="lib-btn">Armar mi plan</button></div>
      </form>`;
    return;
  }
  const hoyDow = new Date(hoyLocal() + "T12:00:00Z").getUTCDay();
  const elegido = dow == null ? hoyDow : dow;
  // La fecha del próximo día de la semana elegido (para los pasos de ese día).
  const fecha = (() => { const h = new Date(hoyLocal() + "T12:00:00Z"); h.setUTCDate(h.getUTCDate() + ((elegido - hoyDow + 7) % 7)); return h.toISOString().slice(0, 10); })();
  const r = planDe(fecha), pl = r && r.pl;
  el.innerHTML = `
    <div class="tmp-cab"><h2 class="tmp-titulo">🗓️ Plan de la mañana</h2><button type="button" class="tmp-editar" data-tpl="editar">Cambiar horas</button></div>
    <p class="tmp-nota">Te levantas a las <b>${esc(P.aHora(P.aSeg(cfg.levantarse)))}</b> y tienes que estar listo a las <b>${esc(P.aHora(P.aSeg(cfg.listo)))}</b>.</p>
    <div class="tpl-dias" role="group" aria-label="Día de la semana">${DIAS.map(([c, n]) => `<button type="button" class="tpl-dia${n === elegido ? " is-sel" : ""}" data-tpl-dow="${n}" aria-pressed="${n === elegido}" aria-label="${NOMBRES[n]}">${c}</button>`).join("")}</div>
    ${!pl || !pl.ok ? `<p class="lib-error">${esc((pl && pl.error) || "No pude armar el plan.")}</p>` : !pl.linea.length ? `<p class="empty-state">No tienes pasos en tu mañana.</p>` : `
    <ol class="tpl-linea">${pl.linea.map(p => `
      <li class="${p.sinDatos ? "is-sin" : ""}"><span class="tpl-hora">${esc(p.desde)}</span><span class="tpl-paso">${esc(p.nombre)}</span><small>${p.sinDatos ? "sin datos" : aprox(p.seg)}</small></li>`).join("")}
      <li class="tpl-fin"><span class="tpl-hora">${esc(pl.termina)}</span><span class="tpl-paso">Listo</span><small></small></li>
    </ol>
    <p class="tpl-veredicto ${pl.sobra >= 0 ? "is-sobra" : "is-falta"}">${pl.sobra >= 0 ? `✓ Te sobran <b>${aprox(pl.sobra)}</b>` : `⚠️ Te faltan <b>${aprox(-pl.sobra)}</b>: termina a las ${esc(pl.termina)}`} (tu hora: ${esc(P.aHora(P.aSeg(cfg.listo)))}).</p>
    ${pl.mayor ? `<p class="tmp-nota">Donde más se te va: <b>${esc(pl.mayor.nombre)}</b> (${aprox(pl.mayor.seg)}, el ${pl.mayor.pct} % de tu mañana).</p>` : ""}
    ${pl.ahorro ? `<p class="tmp-nota">Podrías ahorrar en <b>${esc(pl.ahorro.nombre)}</b>: tus mejores días tardas ${aprox(pl.ahorro.mejor)}, ${aprox(pl.ahorro.seg)} menos que de costumbre.</p>` : ""}
    ${pl.faltanDatos.length ? `<p class="tmp-nota">Sin datos todavía: ${pl.faltanDatos.length === 1 ? "un paso cuenta" : `${pl.faltanDatos.length} pasos cuentan`} 0 min. Mídelos con «Mi mañana».</p>` : ""}
    <p class="tmp-nota">Pasos de los ${esc(NOMBRES[elegido])}: los que sueles hacer ese día. Tiempos: la mediana de tus últimos 30.</p>`}`;
}

document.addEventListener("submit", e => {
  const f = e.target.closest(".tpl-form");
  if (!f) return;
  e.preventDefault();
  const v = P.validar({ levantarse: f.elements.levantarse.value.replace(/^0(\d)/, "$1"), listo: f.elements.listo.value.replace(/^0(\d)/, "$1") });
  if (!v.ok) { const p = f.querySelector(".lib-error"); p.textContent = v.error; p.hidden = false; return; }
  editando = false;
  if (D()) D().guardarAjustes({ plan: v.plan });
});
document.addEventListener("click", e => {
  const b = e.target.closest("[data-tpl], [data-tpl-dow]");
  if (!b) return;
  if (b.dataset.tplDow != null) dow = Number(b.dataset.tplDow);
  else if (b.dataset.tpl === "editar") editando = true;
  else if (b.dataset.tpl === "cancelar") editando = false;
  pintar(document.getElementById("tmp-plan"));
});
window.addEventListener("tiempos:datos", () => pintar(document.getElementById("tmp-plan")));

window.TiemposPlanUI = { pintar, planDe };
})();
