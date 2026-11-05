// ---------- Resumen al terminar un entreno (hoja) ----------
// Lo abre js/gimnasio.js justo después de guardar. Muestra la comparación
// con la última vez de la misma rutina (volumen, series, reps), los récords
// de hoy, los músculos trabajados, la duración y pide el esfuerzo de la
// sesión (RPE 1–10): con él se guarda `rpeSesion` en el entreno y se ve la
// carga (RPE × minutos, en la misma escala que Running; D-093).
// Arriba, "En pocas palabras": hasta 4 frases por reglas (récords,
// comparación, estancamiento, qué queda cansado, lo próximo del plan;
// js/ej-inteligencia.js, D-097). Abajo, "Compartir imagen" (js/ej-compartir.js).
(function () {
"use strict";

const NS = "http://www.w3.org/2000/svg";
let hoja = null;
let actual = null; // { id, entreno }

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const miles = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaCorta = iso => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;
const nombreMusculo = id => (MuscleEngine.MUSCULO_POR_ID[id] || {}).nombre || id;
function delta(n, unidad) {
  if (n == null) return "";
  if (n === 0) return `<small class="ejr-igual">= que la última vez</small>`;
  return `<small class="${n > 0 ? "ejr-sube" : "ejr-baja"}">${n > 0 ? "+" : "−"}${Math.abs(n)}${unidad || ""}</small>`;
}

function fichaDe(ex) {
  return EjercicioDatos.resolver(ex.name, ex.exerciseId);
}
// Récords de hoy contra todos tus entrenos anteriores.
function records(entreno, antes) {
  const out = [];
  (entreno.exercises || []).forEach(ex => {
    const f = fichaDe(ex);
    if (!f || f.tipo !== "carga") return;
    const mismo = e => { const r = fichaDe(e); return !!r && r.id === f.id; };
    const prev = EjEntreno.previoDe(EjHistorial.sesiones(antes, mismo, { tipo: "carga" }));
    const hoy = EjHistorial.sesiones([{ id: "hoy", date: entreno.date, exercises: [ex] }], () => true, { tipo: "carga" })[0];
    if (!hoy || !hoy.mejor) return;
    const r = EjEntreno.recordEnVivo(hoy.mejor, prev);
    const kg = n => `${String(Math.round(n * 10) / 10).replace(".", ",")} kg`;
    if (r) out.push({ nombre: f.nombre, texto: r.tipo === "1rm" ? `1RM estimado ${kg(r.valor)}${r.antes ? ` (antes ${kg(r.antes)})` : ""}` : `${kg(r.kg)} para ${r.reps} reps${r.antes ? ` (antes ${kg(r.antes)})` : ""}` });
  });
  return out;
}
function musculos(entreno) {
  const roles = {};
  (entreno.exercises || []).forEach(ex => {
    const f = fichaDe(ex);
    if (!f) return;
    (f.secundarios || []).forEach(m => { roles[m] = roles[m] || "sec"; });
    (f.primarios || []).forEach(m => { roles[m] = "pri"; });
  });
  return roles;
}
function figuras(roles) {
  return [["frente", "Frente"], ["espalda", "Espalda"]].map(([vista, txt]) => {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "figura ejr-fig");
    svg.setAttribute("viewBox", "0 0 140 300");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${txt}: músculos trabajados`);
    BodyFigures.dibujar(svg, BodyFigures[vista]);
    svg.querySelectorAll(".mz").forEach(g => {
      const r = roles[g.getAttribute("data-muscle")];
      if (r === "pri") g.setAttribute("data-nivel", "3");
      else if (r === "sec") { g.setAttribute("data-nivel", "2"); g.setAttribute("data-suave", ""); }
    });
    return svg.outerHTML;
  }).join("");
}

const DIAS_C = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
// Datos para "En pocas palabras".
function frases(entreno, antes, c, recs) {
  if (!window.EjInteligencia) return [];
  const todos = antes.concat(entreno);
  const estancados = [];
  (entreno.exercises || []).forEach(ex => {
    const f = fichaDe(ex);
    if (!f || f.tipo !== "carga" || estancados.includes(f.nombre)) return;
    const mismo = e => { const r = fichaDe(e); return !!r && r.id === f.id; };
    if (EjPrograma.estancamiento(EjHistorial.sesiones(todos, mismo, { tipo: "carga" }), entreno.date)) estancados.push(f.nombre);
  });
  const reg = EjercicioDatos.estado.registros;
  const fat = window.EjRecuperacion ? EjRecuperacion.fatiga({ ahora: Date.now(), entrenos: todos, carreras: reg.running || [], bicis: reg.bicicleta || [], fichaDe }) : { zonas: {} };
  // Solo los músculos que trabajaste hoy como principales (no los de la carrera de ayer).
  const hoyPri = new Set();
  (entreno.exercises || []).forEach(ex => { const f = fichaDe(ex); if (f) (f.primarios || []).forEach(z => hoyPri.add(z)); });
  const cansados = EjPrograma.MUSCULOS_OBJ.filter(m => m.regiones.some(z => hoyPri.has(z) && fat.zonas[z] && fat.zonas[z].estado === "cansado")).map(m => m.nombre.toLowerCase());
  let planeadas = 0, proximo = null;
  if (window.RutinasUI) {
    const r = entreno.rutinaId && RutinasUI.rutinas().find(x => x.id === entreno.rutinaId);
    const aj = EjercicioDatos.estado.ajustes || {};
    if (r && !EjPrograma.descargaActiva(aj.descargas, entreno.date)) planeadas = EjRutinas.totalSeries(r);
    for (let k = 1; k <= 7 && !proximo; k++) {
      const f = EjPrograma.addDias(entreno.date, k);
      const prox = EjRutinas.rutinaDelDia(RutinasUI.plan(), RutinasUI.rutinas(), f);
      if (prox) proximo = { nombre: prox.name, cuando: k === 1 ? "mañana" : `el ${DIAS_C[new Date(f + "T12:00:00").getDay()]}` };
    }
  }
  return EjInteligencia.resumenSesion({ comparacion: c, records: recs, planeadas, hechas: c.series, estancados, cansados, proximo });
}

function contenido() {
  const { entreno, antes } = actual;
  const ant = EjEntreno.anteriorComparable(antes, entreno);
  const c = EjEntreno.comparar(entreno, ant);
  const recs = records(entreno, antes);
  const roles = musculos(entreno);
  const principales = Object.keys(roles).filter(m => roles[m] === "pri").map(nombreMusculo);
  const rpe = entreno.rpeSesion;
  const carga = EjEntreno.cargaSesion(rpe, entreno.durationMin);
  const fr = frases(entreno, antes, c, recs);
  actual.extras = { records: recs, frases: fr.map(x => x.texto) };
  return `
    <div class="muscle-sheet-head">
      <div><span class="ejf-arriba">Entreno terminado</span><h3 id="ejr-titulo">${esc(entreno.name)}</h3>
        <span class="muscle-sheet-period">${esc(entreno.durationMin)} min · ${c.series} series · ${c.reps} reps</span></div>
      <button type="button" class="muscle-sheet-close" data-cerrar aria-label="Cerrar"><span data-icon="close"></span></button>
    </div>
    ${fr.length ? `<ul class="ejr-frases" aria-label="En pocas palabras">${fr.map(x => `<li class="is-${x.tipo}">${esc(x.texto)}</li>`).join("")}</ul>` : ""}
    <div class="ejf-kpis ejr-kpis">
      <div class="ejf-kpi"><span>Volumen</span><b>${miles(c.volumen)} kg</b>${c.anterior ? delta(c.dVolumenPct, " %") : ""}</div>
      <div class="ejf-kpi"><span>Series</span><b>${c.series}</b>${c.anterior ? delta(c.dSeries) : ""}</div>
      <div class="ejf-kpi"><span>Reps</span><b>${c.reps}</b>${c.anterior ? delta(c.dReps) : ""}</div>
      <div class="ejf-kpi"><span>Duración</span><b>${esc(entreno.durationMin)} min</b></div>
    </div>
    <p class="ejr-contra">${c.anterior ? `Comparado con la última vez (${fechaCorta(c.anterior.fecha)}).` : "Es la primera vez con esta rutina: la próxima vas a ver la comparación."}</p>
    <h4 class="ejf-sub">Récords de hoy</h4>
    ${recs.length ? `<ul class="ejr-recs">${recs.map(r => `<li><b>${esc(r.nombre)}</b><span>${esc(r.texto)}</span></li>`).join("")}</ul>` : `<p class="ejf-texto">Hoy no hubo récords. La constancia también cuenta.</p>`}
    <h4 class="ejf-sub">Músculos trabajados</h4>
    <div class="ejf-musculos"><div class="ejf-figs">${figuras(roles)}</div><div class="ejf-musc-txt"><p><b>Principales</b>${esc(principales.join(" · ") || "—")}</p></div></div>
    <h4 class="ejf-sub">¿Qué tan duro fue el entreno?</h4>
    <div class="ejr-rpe" role="group" aria-label="Esfuerzo de la sesión de 1 a 10">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button type="button" data-ejr-rpe="${n}" aria-pressed="${rpe === n}"${rpe === n ? ' class="is-on"' : ""}>${n}</button>`).join("")}</div>
    <p class="ejr-rpe-txt">${rpe ? `Esfuerzo ${rpe} de 10 · carga de la sesión <b>${carga}</b> (misma escala que Running).` : "1 = muy fácil · 10 = no podías más. Sirve para medir tu carga junto con Running."}</p>
    <div class="ejr-acciones"><button type="button" class="ejf-btn-sec" data-ejr-compartir>Compartir imagen</button><button type="button" class="ejf-btn ejr-listo" data-cerrar>Listo</button></div>`;
}

function pintar() {
  hoja.querySelector(".ejr-cuerpo").innerHTML = contenido();
  if (typeof renderIcons === "function") renderIcons(hoja);
}

function resumen(entreno, antes) {
  if (!entreno || !(entreno.exercises || []).length) return;
  actual = { entreno: Object.assign({}, entreno), antes: (antes || []).filter(w => w.id !== entreno.id) };
  if (!hoja) {
    hoja = document.createElement("div");
    hoja.className = "muscle-sheet ejr-hoja";
    hoja.hidden = true;
    hoja.innerHTML = `<div class="muscle-sheet-overlay" data-cerrar></div>
      <div class="muscle-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="ejr-titulo"><div class="muscle-sheet-grip"></div><div class="ejr-cuerpo"></div></div>`;
    document.body.appendChild(hoja);
    hoja.addEventListener("click", e => {
      if (e.target.closest("[data-cerrar]")) { cerrar(); return; }
      const comp = e.target.closest("[data-ejr-compartir]");
      if (comp && actual && window.EjCompartir) {
        comp.disabled = true;
        comp.textContent = "Preparando…";
        EjCompartir.entreno(actual.entreno, actual.extras).then(r => {
          comp.textContent = r === "descargado" ? "Imagen descargada" : "Compartir imagen";
        }).catch(() => { comp.textContent = "No se pudo"; }).then(() => { comp.disabled = false; });
        return;
      }
      const b = e.target.closest("[data-ejr-rpe]");
      if (!b || !actual) return;
      const n = Number(b.dataset.ejrRpe);
      actual.entreno.rpeSesion = n;
      if (actual.entreno.id) EjercicioDatos.coleccion("entrenamientos").doc(actual.entreno.id).update({ rpeSesion: n }).catch(err => console.error("No se pudo guardar el esfuerzo", err));
      pintar();
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && hoja && !hoja.hidden) cerrar(); });
  }
  pintar();
  hoja.hidden = false;
  hoja.classList.remove("closing");
  hoja.querySelector(".muscle-sheet-panel").scrollTop = 0;
  document.body.classList.add("sheet-open");
}
function cerrar() {
  if (!hoja || hoja.hidden) return;
  hoja.classList.add("closing");
  setTimeout(() => {
    hoja.hidden = true;
    hoja.classList.remove("closing");
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden]), .muscle-sheet:not([hidden])"));
    // Recién ahora puede salir el aviso de "Nuevos rangos" (js/rangos.js).
    document.dispatchEvent(new CustomEvent("entreno:resumen-cerrado"));
  }, 220);
}
const abierto = () => !!hoja && !hoja.hidden;

window.EjEntrenoUI = { resumen, cerrar, abierto };
})();
