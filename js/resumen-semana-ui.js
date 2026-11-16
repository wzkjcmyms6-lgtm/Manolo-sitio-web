// ---------- "Tu semana" (D-136, fase 2) ----------
// En Inicio, lunes y martes: una tarjeta con la semana que terminó (titular
// y 3 cifras); "Listo" la oculta hasta el lunes siguiente. La pantalla
// #semana/AAAA-MM-DD (también en el menú ☰ y al pie de Inicio): ‹ semana ›,
// el titular, lo mejor, cada área contra la semana anterior, lo que se quedó
// atrás, una sugerencia y "Compartir mi semana" (imagen sin montos de
// dinero). Usa lo que cada sección ya tiene en memoria (js/resumen-fuentes.js);
// la lógica está en js/resumen-motor.js.
(function () {
"use strict";
const R = window.ResumenMotor, F = window.ResumenFuentes, I = window.ResumenImagen;
if (!R || !F) return;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CLAVE = "manolo.semana.vista";   // el lunes de la semana que ya viste en Inicio
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
let ultima = null;   // la semana dibujada (para compartir)

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const diaSemana = f => new Date(`${f}T12:00:00`).getDay();
const lunesHoy = () => R.lunesDe(hoyLocal());
// Lunes y martes se mira la semana que terminó; el resto, la que va.
const porDefecto = () => (diaSemana(hoyLocal()) === 1 || diaSemana(hoyLocal()) === 2 ? R.sumar(lunesHoy(), -7) : lunesHoy());
function lunesDelHash() {
  const m = location.hash.match(/^#semana\/(\d{4}-\d{2}-\d{2})/);
  return m && R.fechaOk(m[1]) ? R.lunesDe(m[1]) : null;
}
function leerVista() { try { return localStorage.getItem(CLAVE) || ""; } catch (e) { return ""; } }
function guardarVista(l) { try { localStorage.setItem(CLAVE, l); } catch (e) { /* sin almacenamiento */ } }
const visible = el => !!(el && el.getClientRects().length);
const iconos = el => { if (typeof renderIcons === "function") renderIcons(el); };

// ---- Inicio ----
function renderTarjeta() {
  const el = document.getElementById("sem-inicio");
  if (!el) return;
  const d = diaSemana(hoyLocal());
  const lunes = R.sumar(lunesHoy(), -7);
  if ((d !== 1 && d !== 2) || leerVista() === lunes) { el.hidden = true; el.innerHTML = ""; return; }
  // Solo se calcula con Inicio a la vista (al volver a Inicio se recalcula):
  // así abrir otra sección no espera a que se arme la semana.
  const ini = document.getElementById("panel-inicio");
  if (ini && ini.hidden) return;
  const s = R.semana(F.datos(), lunes);
  if (!s.areas.length) { el.hidden = true; el.innerHTML = ""; return; }
  const cifras = s.areas.filter(a => a.id !== "finanzas" && a.valor && a.valor !== "—").slice(0, 3);
  el.hidden = false;
  el.innerHTML = `<p class="sem-ini-eyebrow"><span class="icon-sm" data-icon="calendar"></span>Tu semana · ${esc(s.rango)}</p>
    <p class="sem-ini-t" id="sem-ini-t">${esc(s.titular)}</p>
    ${cifras.length ? `<div class="sem-ini-cifras">${cifras.map(a => `<div><span>${esc(a.nombre)}</span><b>${esc(a.valor)}</b></div>`).join("")}</div>` : ""}
    <div class="sem-ini-acciones"><a class="lib-btn lib-btn-chico" href="#semana/${lunes}">Ver mi semana</a>
      <button type="button" class="lib-btn-sec lib-btn-chico" data-sem-listo="${lunes}">Listo</button></div>`;
  iconos(el);
}

// ---- La pantalla ----
function areaHtml(a) {
  const c = a.cambio;
  return `<a class="sem-area" href="${esc(a.href)}">
      <span class="sem-area-ico" aria-hidden="true"><span data-icon="${esc(a.icono)}"></span></span>
      <span class="sem-area-t"><b>${esc(a.nombre)}</b><span>${esc(a.linea)}</span>
        ${c ? `<small class="sem-cambio${c.signo > 0 ? " is-bien" : c.signo < 0 ? " is-mal" : ""}">${esc(c.texto)}</small>` : ""}
        ${a.detalle ? `<small>${esc(a.detalle)}</small>` : ""}</span>
      <span class="sem-area-ir" aria-hidden="true">›</span>
    </a>`;
}
function renderPantalla() {
  const el = document.getElementById("sem-app");
  if (!el || !visible(el)) return;
  const hoy = hoyLocal();
  let lunes = lunesDelHash() || porDefecto();
  if (lunes > lunesHoy()) lunes = lunesHoy();
  const s = R.semana(F.datos(), lunes);
  ultima = s;
  const pasada = R.sumar(lunesHoy(), -7);
  const quien = s.enCurso ? `Esta semana, hasta el ${DIAS[diaSemana(hoy)]}` : lunes === pasada ? "La semana pasada" : lunes === lunesHoy() ? "Esta semana" : "";
  const siguiente = R.sumar(lunes, 7);
  // La sugerencia es para la semana que sigue: solo para la pasada y la que va.
  const conSugerencia = s.sugerencia && (lunes === pasada || lunes === lunesHoy());
  el.innerHTML = `
    <nav class="sem-nav" aria-label="Elegir semana">
      <a class="sem-flecha" href="#semana/${R.sumar(lunes, -7)}" aria-label="Semana anterior"><span data-icon="chevronLeft"></span></a>
      <div class="sem-nav-t"><b>${esc(s.rango)}</b>${quien ? `<small>${esc(quien)}</small>` : ""}</div>
      ${siguiente <= lunesHoy() ? `<a class="sem-flecha" href="#semana/${siguiente}" aria-label="Semana siguiente"><span data-icon="chevronRight"></span></a>` : `<span class="sem-flecha is-off" aria-hidden="true"><span data-icon="chevronRight"></span></span>`}
    </nav>
    <p class="sem-titular">${esc(s.titular)}</p>
    ${s.mejor.length ? `<section class="sem-bloque" aria-labelledby="sem-mejor-t"><h2 class="sem-h" id="sem-mejor-t">Lo mejor</h2>
      <ul class="sem-lista">${s.mejor.map(m => `<li><span class="sem-emoji" aria-hidden="true">${esc(m.icono)}</span><span>${esc(m.texto)}</span></li>`).join("")}</ul></section>` : ""}
    ${s.areas.length ? `<section class="sem-bloque" aria-labelledby="sem-areas-t"><h2 class="sem-h" id="sem-areas-t">Por área</h2>
      <div class="sem-areas">${s.areas.map(areaHtml).join("")}</div></section>`
      : `<p class="empty-state">No hay nada anotado esta semana. Cuando registres hábitos, entrenos, lecturas o gastos, aquí verás tu semana.</p>`}
    ${s.atras.length ? `<section class="sem-bloque" aria-labelledby="sem-atras-t"><h2 class="sem-h" id="sem-atras-t">Se quedó atrás</h2>
      <ul class="sem-lista is-atras">${s.atras.map(m => `<li><span class="sem-emoji" aria-hidden="true">${esc(m.icono)}</span><span>${esc(m.texto)}</span></li>`).join("")}</ul></section>` : ""}
    ${conSugerencia ? `<section class="sem-sug" aria-labelledby="sem-sug-t"><h2 class="sem-h" id="sem-sug-t">${s.enCurso ? "Para lo que queda de la semana" : "Para esta semana"}</h2>
      <p>${esc(s.sugerencia.texto)}</p>${s.sugerencia.href ? `<a class="lib-btn-sec lib-btn-chico" href="${esc(s.sugerencia.href)}">Ir</a>` : ""}</section>` : ""}
    ${s.areas.length ? `<button type="button" class="lib-btn lib-btn-ancho sem-compartir" data-sem-compartir><span class="icon-sm" data-icon="send"></span>Compartir mi semana</button>
      <p class="lib-nota sem-nota">La imagen lleva tus cifras de la semana, sin montos de dinero.</p>` : ""}`;
  iconos(el);
}

async function compartir() {
  if (!ultima || !I || !window.RunCompartir) return;
  const canvas = document.createElement("canvas");
  I.dibujar(canvas, I.planSemana(ultima, I.medidor(canvas)));
  try {
    const blob = await RunCompartir.aBlob(canvas);
    await RunCompartir.compartir(blob, `mi-semana-${ultima.lunes}.png`);
  } catch (e) { alert("No se pudo armar la imagen."); }
}

document.addEventListener("click", e => {
  const listo = e.target.closest("[data-sem-listo]");
  if (listo) { guardarVista(listo.dataset.semListo); renderTarjeta(); return; }
  if (e.target.closest("[data-sem-compartir]")) compartir();
});
const todo = () => { renderTarjeta(); renderPantalla(); };
window.addEventListener("hashchange", () => setTimeout(todo, 0));
F.alCambiar(todo);
setTimeout(todo, 0);

window.ResumenSemanaUI = { renderTarjeta, renderPantalla, ultima: () => ultima };
})();
