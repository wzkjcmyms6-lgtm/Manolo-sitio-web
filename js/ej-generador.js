// ---------- Crear rutinas para mí (generador por reglas) ----------
// Hoja que se abre con cualquier botón data-generador (Gimnasio › Rutinas y
// la tarjeta de series por músculo). Preguntas → propuesta editable →
// guardar. La propuesta sale de EjPrograma.generar (js/ej-programa.js,
// D-095): días, minutos, meta, nivel y el equipo del perfil elegido.
// - Nunca pisa tus rutinas: se guardan como rutinas NUEVAS (con otro nombre
//   si ya tienes una que se llama igual).
// - El plan semanal solo se llena en días libres.
// - Opcional: bloque de 4–6 semanas con la última de descarga.
// Necesita el tipo de movimiento de cada ejercicio (data/ejercicios-tecnica.json),
// que carga la ficha (EjFicha.tecnica) solo al abrir esta hoja.
(function () {
"use strict";

const R = window.EjRutinas;
const METAS = [["hipertrofia", "Músculo"], ["fuerza", "Fuerza"], ["general", "General"]];
const NIVELES = [["principiante", "Principiante"], ["intermedio", "Intermedio"], ["avanzado", "Avanzado"]];
const MINUTOS = [30, 45, 60, 75, 90];
const DIA_TXT = { "1": "Lunes", "2": "Martes", "3": "Miércoles", "4": "Jueves", "5": "Viernes", "6": "Sábado", "0": "Domingo" };
let hoja = null;
let ed = null;
let tecnica = null;

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const chip = (attr, val, txt, on) => `<button type="button" class="ejg-chip${on ? " is-on" : ""}" ${attr}="${esc(val)}" aria-pressed="${!!on}">${esc(txt)}</button>`;
const plan = () => (window.RutinasUI && RutinasUI.plan()) || { dias: {} };
const misRutinas = () => (window.RutinasUI && RutinasUI.rutinas()) || [];

// Opciones para EjPrograma.generar / alternativasHueco.
function opciones() {
  const st = EjercicioDatos.estado;
  const pf = EjEquipo.perfiles(st.ajustes || {});
  const perfil = pf.perfiles[ed.perfil] || pf.perfiles[pf.activo];
  const base = st.base || [];
  return {
    dias: ed.dias, minutos: ed.minutos, meta: ed.meta, nivel: ed.nivel,
    equipos: EjEquipo.disponibles(perfil), dominadas: perfil ? perfil.dominadas !== false : true,
    patronDe: id => (tecnica && tecnica.ej[id] && tecnica.ej[id].pt) || null,
    destacados: new Set(base.slice(0, st.destacados || 0).map(f => f.id)),
    base
  };
}
const minutosDe = r => Math.round(r.items.reduce((s, it) => s + it.series * ((Number(it.descansoSeg) || 0) + 45), 0) / 60);
const descTxt = seg => (seg % 60 === 0 ? `${seg / 60} min` : seg > 60 ? `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")} min` : `${seg} s`);

// ---- Pasos ----
function preguntas() {
  const pf = EjEquipo.perfiles(EjercicioDatos.estado.ajustes || {});
  return `
    <h4 class="ejf-sub">¿Cuántos días por semana?</h4>
    <div class="ejg-chips">${[2, 3, 4, 5, 6].map(n => chip("data-gen-dias", n, `${n} días`, ed.dias === n)).join("")}</div>
    <p class="ejg-ayuda">${ed.dias <= 3 ? "Cuerpo completo: cada músculo 2–3 veces por semana." : ed.dias === 4 ? "Torso y pierna, dos veces cada uno." : ed.dias === 5 ? "Empuje, tirón y pierna, más torso y pierna." : "Empuje, tirón y pierna, dos veces."}</p>
    ${ed.nivel === "principiante" && ed.dias >= 5 ? `<p class="ejg-ayuda ejgen-aviso">Para empezar, 3 días por semana alcanzan: recuperas mejor y progresas igual.</p>` : ""}
    <h4 class="ejf-sub">¿Cuánto tiempo por sesión?</h4>
    <div class="ejg-chips">${MINUTOS.map(m => chip("data-gen-min", m, `${m} min`, ed.minutos === m)).join("")}</div>
    <h4 class="ejf-sub">Tu meta</h4>
    <div class="ejg-chips">${METAS.map(([k, t]) => chip("data-gen-meta", k, t, ed.meta === k)).join("")}</div>
    <h4 class="ejf-sub">Tu nivel</h4>
    <div class="ejg-chips">${NIVELES.map(([k, t]) => chip("data-gen-nivel", k, t, ed.nivel === k)).join("")}</div>
    <h4 class="ejf-sub">Dónde entrenas</h4>
    <div class="ejg-chips">${Object.keys(pf.perfiles).map(id => chip("data-gen-perfil", id, pf.perfiles[id].nombre, ed.perfil === id)).join("")}</div>
    <p class="ejg-ayuda">Solo elige ejercicios con el equipo de ese perfil. Lo cambias en <button type="button" class="ejf-link" data-ajustes-gym>Ajustes del gimnasio</button>.</p>
    ${ed.error ? `<p class="ejg-error" role="alert">${esc(ed.error)}</p>` : ""}
    <div class="ejg-acciones"><button type="button" class="ejf-btn-sec" data-cerrar>Cancelar</button><button type="button" class="ejf-btn" data-gen-ver>Ver propuesta</button></div>`;
}

function filaItem(r, i, it) {
  const f = EjercicioDatos.ficha(it.exerciseId) || { id: it.exerciseId, nombre: it.nombre };
  const img = window.EjDemos && EjDemos.tieneDemo(f) ? `<img class="ejgen-mini" src="${esc(EjDemos.rutas(f.id)[0])}" alt="" loading="lazy" decoding="async">` : `<span class="ejgen-mini" aria-hidden="true"></span>`;
  return `<li class="ejgen-item">
    ${img}
    <button type="button" class="ejgen-nombre" data-ficha="${esc(f.id)}"><b>${esc(it.nombre)}</b><small>${it.series} × ${esc(R.repsTxt(it))} · descanso ${descTxt(it.descansoSeg)}</small></button>
    <button type="button" class="ejgen-ico" data-gen-cambiar="${r}:${i}" aria-label="Cambiar ${esc(it.nombre)} por otro ejercicio"><span data-icon="swap"></span></button>
    <button type="button" class="ejgen-ico" data-gen-quitar="${r}:${i}" aria-label="Quitar ${esc(it.nombre)}"${ed.gen.rutinas[r].items.length <= 1 ? " disabled" : ""}><span data-icon="close"></span></button>
  </li>`;
}

function resumenVolumen() {
  const entradas = [];
  ed.gen.rutinas.forEach(r => r.items.forEach(it => {
    const f = EjercicioDatos.ficha(it.exerciseId);
    if (f) entradas.push({ ejercicio: f, series: Array(it.series).fill({ reps: it.repsMin }) });
  }));
  const vol = EjPrograma.volumenSemanal(entradas, ed.meta, ed.nivel);
  const eq = EjPrograma.equilibrio(entradas, MuscleEngine.calcularMusculos(entradas, EjercicioDatos.config())).filter(x => !x.ok);
  const n1 = v => String(Math.round(v * 10) / 10).replace(".", ",");
  return `<h4 class="ejf-sub">Series por semana con esta propuesta</h4>
    <div class="ejgen-vol">${vol.map(v => `<span class="ejgen-vol-chip is-${v.estado}" title="${esc(EjPrograma.textoVolumen(v))}">${esc(v.nombre)} <b>${n1(v.series)}</b></span>`).join("")}</div>
    ${eq.map(x => `<p class="ejg-ayuda ejgen-aviso">${esc(x.texto)}</p>`).join("")}`;
}

function propuesta() {
  const libres = EjPrograma.diasLibres(plan());
  const usados = ed.gen.rutinas.map(r => r.diaPlan).filter(Boolean);
  const cards = ed.gen.rutinas.map((r, k) => {
    const opts = libres.filter(d => d === r.diaPlan || !usados.includes(d));
    return `<section class="ejgen-rut" aria-label="${esc(r.nombre)}">
      <div class="ejgen-rut-head">
        <label class="ejg-campo ejgen-campo-nombre">Nombre<input type="text" maxlength="60" data-gen-nombre="${k}" value="${esc(r.nombre)}"></label>
        ${ed.enPlan && libres.length ? `<label class="ejg-campo ejgen-campo-dia">Día<select data-gen-dia="${k}">
          <option value="">Sin día</option>${opts.map(d => `<option value="${d}"${r.diaPlan === d ? " selected" : ""}>${DIA_TXT[d]}</option>`).join("")}</select></label>` : ""}
      </div>
      <ol class="ejgen-items">${r.items.map((it, i) => filaItem(k, i, it)).join("")}</ol>
      <p class="ejgen-pie">~${minutosDe(r)} min · ${R.totalSeries(r)} series</p>
    </section>`;
  }).join("");
  const ocupados = 7 - libres.length;
  return `
    <p class="ejg-ayuda ejgen-intro"><b>${esc(ed.gen.split)}</b> · ${ed.gen.rutinas.length} días · hasta ${ed.minutos} min. Toca un ejercicio para ver cómo se hace; con las flechas lo cambias por otro parecido.</p>
    ${resumenVolumen()}
    ${cards}
    <h4 class="ejf-sub">Opciones</h4>
    <label class="ejgen-op"><input type="checkbox" data-gen-plan${ed.enPlan ? " checked" : ""}${libres.length ? "" : " disabled"}>
      <span><b>Ponerlas en mi plan semanal</b><small>${libres.length ? `Solo en días libres${ocupados ? ` (tus ${ocupados} días con rutina no cambian)` : ""}.` : "Tu plan no tiene días libres: no se toca."}</small></span></label>
    <label class="ejgen-op"><input type="checkbox" data-gen-bloque${ed.bloque ? " checked" : ""}>
      <span><b>Hacerlo como bloque</b><small>Semanas subiendo peso o reps y la última de descarga (menos series y peso) para recuperarte.</small></span></label>
    ${ed.bloque ? `<div class="ejg-chips ejgen-semanas">${[4, 5, 6].map(n => chip("data-gen-semanas", n, `${n} semanas`, ed.semanas === n)).join("")}</div>
      <p class="ejg-ayuda">${esc(textoBloque())}</p>` : ""}
    <p class="ejg-ayuda">Se guardan como rutinas nuevas: las tuyas no cambian. Después puedes editarlas como cualquier rutina.</p>
    <div class="ejg-acciones"><button type="button" class="ejf-btn-sec" data-gen-atras>Atrás</button><button type="button" class="ejf-btn" data-gen-guardar>Guardar ${ed.gen.rutinas.length} rutinas</button></div>`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaTxt = iso => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MESES[m - 1]}`; };
function textoBloque() {
  const b = EjPrograma.nuevoBloque(hoyIso(), ed.semanas);
  return `Del ${fechaTxt(b.desde)} al ${fechaTxt(b.descarga.hasta)}; la semana del ${fechaTxt(b.descarga.desde)} es de descarga.`;
}

function listo() {
  return `<div class="ejgen-listo" role="status"><span class="ejgen-listo-ico" aria-hidden="true">✓</span>
    <p><b>${esc(ed.mensaje)}</b></p><p class="ejg-ayuda">Tus rutinas de antes siguen igual. Las nuevas están en Gimnasio › Rutinas.</p></div>
    <div class="ejg-acciones"><button type="button" class="ejf-btn" data-cerrar>Listo</button></div>`;
}

function contenido() {
  const sub = ed.paso === "propuesta" ? "Revisa y cambia lo que quieras antes de guardar" : ed.paso === "listo" ? "Guardado" : "Unas preguntas y te armo un plan";
  return `
    <div class="muscle-sheet-head">
      <div><span class="ejf-arriba">Rutinas</span><h3 id="ejgen-titulo">Crear rutinas para mí</h3>
        <span class="muscle-sheet-period">${sub}</span></div>
      <button type="button" class="muscle-sheet-close" data-cerrar aria-label="Cerrar"><span data-icon="close"></span></button>
    </div>
    ${ed.paso === "cargando" ? `<p class="ejf-cargando">Cargando…</p>` : ed.paso === "propuesta" ? propuesta() : ed.paso === "listo" ? listo() : preguntas()}`;
}

function pintar(arriba) {
  const panel = hoja.querySelector(".muscle-sheet-panel");
  const y = panel.scrollTop;
  hoja.querySelector(".ejg-cuerpo").innerHTML = contenido();
  if (typeof renderIcons === "function") renderIcons(hoja);
  panel.scrollTop = arriba ? 0 : y;
}

function abrir() {
  const a = EjercicioDatos.estado.ajustes || {};
  const conRutina = Object.keys(plan().dias || {}).filter(k => plan().dias[k]).length;
  ed = {
    paso: "preguntas", dias: conRutina >= 2 && conRutina <= 6 ? conRutina : 3, minutos: 60,
    meta: a.meta || "hipertrofia", nivel: a.nivel || "intermedio", perfil: EjEquipo.perfiles(a).activo,
    enPlan: true, bloque: false, semanas: 5, gen: null, error: ""
  };
  if (!hoja) {
    hoja = document.createElement("div");
    hoja.className = "muscle-sheet ejg-hoja ejgen-hoja";
    hoja.hidden = true;
    hoja.innerHTML = `<div class="muscle-sheet-overlay" data-cerrar></div>
      <div class="muscle-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="ejgen-titulo"><div class="muscle-sheet-grip"></div><div class="ejg-cuerpo"></div></div>`;
    document.body.appendChild(hoja);
    hoja.addEventListener("click", alClick);
    hoja.addEventListener("input", alEscribir);
    hoja.addEventListener("change", alCambiar);
    document.addEventListener("keydown", e => { if (e.key === "Escape" && hoja && !hoja.hidden && !document.querySelector(".ejf-hoja:not([hidden]), .ejg-hoja:not(.ejgen-hoja):not([hidden])")) cerrar(); });
  }
  pintar(true);
  hoja.hidden = false;
  hoja.classList.remove("closing");
  document.body.classList.add("sheet-open");
}
function cerrar() {
  if (!hoja || hoja.hidden) return;
  hoja.classList.add("closing");
  setTimeout(() => {
    hoja.hidden = true;
    hoja.classList.remove("closing");
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden]), .muscle-sheet:not([hidden])"));
  }, 220);
}

// ---- Propuesta ----
function generar() {
  const g = EjPrograma.generar(opciones());
  if (!g.rutinas.length || g.rutinas.some(r => r.items.length < 2)) {
    ed.paso = "preguntas";
    ed.error = "Con el equipo de ese perfil no alcanzan los ejercicios. Marca más equipo en Ajustes del gimnasio o elige otro perfil.";
    pintar();
    return;
  }
  const existentes = misRutinas().map(r => r.name);
  const dias = EjPrograma.asignarDias(g.rutinas, plan());
  g.rutinas.forEach((r, k) => {
    r.nombre = EjPrograma.nombreLibre(r.nombre, existentes);
    existentes.push(r.nombre);
    r.diaPlan = dias[k];
  });
  ed.gen = g;
  ed.error = "";
  ed.paso = "propuesta";
  pintar(true);
}
function verPropuesta() {
  ed.paso = "cargando";
  pintar();
  const p = tecnica ? Promise.resolve(tecnica) : (window.EjFicha && EjFicha.tecnica ? EjFicha.tecnica() : Promise.resolve(null));
  p.then(t => {
    if (!hoja || hoja.hidden || ed.paso !== "cargando") return;
    tecnica = t;
    if (!t || !t.ej) {
      ed.paso = "preguntas";
      ed.error = "No se pudo cargar la lista de ejercicios. Prueba de nuevo con conexión.";
      pintar();
      return;
    }
    generar();
  });
}
function cambiar(k, i) {
  const r = ed.gen.rutinas[k];
  const it = r.items[i];
  const lista = EjPrograma.alternativasHueco(it.hueco, opciones())
    .filter(f => f.id === it.exerciseId || !r.items.some(x => x.exerciseId === f.id));
  if (lista.length < 2) return;
  const j = lista.findIndex(f => f.id === it.exerciseId);
  const f = lista[(j + 1) % lista.length];
  const comp = !!(EjPrograma.HUECOS[it.hueco] || {}).comp && f.mec !== "a";
  const antes = !!(EjPrograma.HUECOS[it.hueco] || {}).comp && (EjercicioDatos.ficha(it.exerciseId) || {}).mec !== "a";
  const d = comp === antes ? {} : EjPrograma.dosis(ed.meta, ed.nivel, comp, false);
  r.items[i] = Object.assign({}, it, d, { nombre: f.nombre, exerciseId: f.id });
}

// ---- Guardar ----
function guardar() {
  const st = EjercicioDatos.estado;
  const lote = db.batch();
  let orden = Math.max(0, ...misRutinas().map(r => r.orden || 0)) + 1;
  const dias = Object.assign({}, plan().dias || {});
  let conDias = 0;
  const existentes = misRutinas().map(r => r.name);
  ed.gen.rutinas.forEach(r => {
    const ref = EjercicioDatos.coleccion("rutinas").doc();
    const nombre = EjPrograma.nombreLibre(String(r.nombre || "").trim() || "Rutina", existentes);
    existentes.push(nombre);
    lote.set(ref, R.aGuardar({ name: nombre, orden: orden++, items: r.items }));
    // Solo días libres (se vuelve a mirar el plan por si cambió mientras tanto).
    if (ed.enPlan && r.diaPlan && !dias[r.diaPlan]) { dias[r.diaPlan] = ref.id; conDias++; }
  });
  if (conDias) lote.set(EjercicioDatos.meta("plan_semanal"), { dias }, { merge: true });
  const aj = { meta: ed.meta, nivel: ed.nivel };
  if (ed.bloque) {
    const b = EjPrograma.nuevoBloque(hoyIso(), ed.semanas);
    aj.bloque = { desde: b.desde, semanas: b.semanas, descarga: b.descarga.desde };
    aj.descargas = { [b.descarga.desde]: b.descarga.hasta };
  }
  lote.set(EjercicioDatos.meta("ajustes_ejercicio"), aj, { merge: true });
  lote.commit().catch(err => console.error("Manolo: no se pudieron guardar las rutinas creadas", err));
  // Al instante en la pantalla (el snapshot llega después).
  st.ajustes = Object.assign({}, st.ajustes, { meta: aj.meta, nivel: aj.nivel }, aj.bloque ? { bloque: aj.bloque, descargas: Object.assign({}, st.ajustes && st.ajustes.descargas, aj.descargas) } : {});
  document.dispatchEvent(new CustomEvent("ejercicio:ajustes"));
  const n = ed.gen.rutinas.length;
  ed.mensaje = `Se guardaron ${n} rutinas nuevas${conDias ? ` y ${conDias === 1 ? "1 día" : `${conDias} días`} de tu plan semanal` : ""}${ed.bloque ? `, en un bloque de ${ed.semanas} semanas` : ""}.`;
  ed.paso = "listo";
  pintar(true);
}

// ---- Eventos ----
function alEscribir(e) {
  const k = e.target.dataset.genNombre;
  if (k != null && ed && ed.gen) ed.gen.rutinas[Number(k)].nombre = e.target.value;
}
function alCambiar(e) {
  if (!ed || !ed.gen) return;
  const k = e.target.dataset.genDia;
  if (k != null) { ed.gen.rutinas[Number(k)].diaPlan = e.target.value || null; pintar(); return; }
  if (e.target.hasAttribute("data-gen-plan")) { ed.enPlan = e.target.checked; pintar(); return; }
  if (e.target.hasAttribute("data-gen-bloque")) { ed.bloque = e.target.checked; pintar(); }
}
function alClick(e) {
  if (e.target.closest("[data-cerrar]")) { cerrar(); return; }
  if (!ed) return;
  const t = e.target.closest("[data-gen-dias], [data-gen-min], [data-gen-meta], [data-gen-nivel], [data-gen-perfil], [data-gen-ver], [data-gen-atras], [data-gen-cambiar], [data-gen-quitar], [data-gen-semanas], [data-gen-guardar]");
  if (!t || t.disabled) return;
  const d = t.dataset;
  if (d.genDias) ed.dias = Number(d.genDias);
  else if (d.genMin) ed.minutos = Number(d.genMin);
  else if (d.genMeta) ed.meta = d.genMeta;
  else if (d.genNivel) ed.nivel = d.genNivel;
  else if (d.genPerfil) ed.perfil = d.genPerfil;
  else if (d.genSemanas) ed.semanas = Number(d.genSemanas);
  else if (t.hasAttribute("data-gen-ver")) { verPropuesta(); return; }
  else if (t.hasAttribute("data-gen-atras")) { ed.paso = "preguntas"; pintar(true); return; }
  else if (t.hasAttribute("data-gen-guardar")) { guardar(); return; }
  else if (d.genCambiar || d.genQuitar) {
    const [k, i] = (d.genCambiar || d.genQuitar).split(":").map(Number);
    if (d.genCambiar) cambiar(k, i);
    else ed.gen.rutinas[k].items.splice(i, 1);
  }
  if (ed.paso === "preguntas") ed.error = "";
  pintar();
}

// Si cambias el equipo en Ajustes con la hoja abierta, se ven los perfiles nuevos.
document.addEventListener("ejercicio:ajustes", () => { if (hoja && !hoja.hidden && ed && ed.paso === "preguntas") pintar(); });

document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-generador]");
  if (!b) return;
  e.preventDefault();
  if (!EjercicioDatos.estado.base || !EjercicioDatos.estado.base.length) return;
  abrir();
});

window.EjGenerador = { abrir, cerrar };
})();
