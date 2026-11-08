// ---------- Rutinas listas de Ejercicio (pantalla) ----------
// Tarjeta en Entrenamiento ("Rutinas listas") y su página
// (#rutina-lista/{id}): los días como pestañas, con el de hoy destacado,
// calentamiento, ejercicios con series para marcar, "Terminar el día y
// guardar" (va al historial de Ejercicio de siempre), "Cómo progresar" y
// "Consejos". Lógica en js/rutinas-listas-motor.js; las rutinas son
// archivos en data/rutinas/ (docs/RUTINAS_LISTAS.md).
//
// Las series marcadas se guardan en el teléfono (localStorage) hasta
// terminar el día: no se pierden si se cierra la app.
(function () {
const M = window.RutinasListasMotor;
const tarjetas = document.getElementById("rl-tarjetas");
const app = document.getElementById("rl-app");
if (!M || !tarjetas || !app) return;

let rutinaId = null;   // la que está abierta
let diaId = null;      // pestaña elegida
let guardado = null;   // { dia, fecha, min } después de guardar

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
function fechaCorta(f) {
  const d = new Date(f + "T12:00:00");
  return `${DIAS[d.getDay()]} ${d.getDate()}`;
}
const rutinas = () => (window.EjercicioDatos ? EjercicioDatos.estado.rutinasListas : []) || [];
const entrenos = () => (window.EjercicioDatos ? EjercicioDatos.estado.registros.gimnasio : []) || [];
const rutinaActual = () => rutinas().find(r => r.id === rutinaId) || null;

// ---- Series marcadas (en el teléfono, por rutina y día) ----
const clave = id => `manolo-rl:${(typeof currentUser !== "undefined" && currentUser && currentUser.uid) || "anon"}:${id}`;
function borradores(id) {
  try { return JSON.parse(localStorage.getItem(clave(id)) || "{}") || {}; } catch (e) { return {}; }
}
function guardarBorradores(id, b) {
  try { localStorage.setItem(clave(id), JSON.stringify(b)); } catch (e) { /* sin espacio */ }
}
function borrador(id, dia) {
  const b = borradores(id)[dia];
  return b && b.marcas ? b : null;
}
function marcar(id, dia, ejId, serie, series) {
  const b = borradores(id);
  const d = b[dia] && b[dia].marcas ? b[dia] : { fecha: hoyLocal(), inicio: Date.now(), marcas: {} };
  const xs = (d.marcas[ejId] || []).slice(0, series);
  while (xs.length < series) xs.push(false);
  xs[serie] = !xs[serie];
  d.marcas[ejId] = xs;
  // La sesión empieza con la primera serie marcada.
  if (!Object.values(d.marcas).some(a => a.some(Boolean))) { delete b[dia]; } else b[dia] = d;
  guardarBorradores(id, b);
}
function olvidar(id, dia) {
  const b = borradores(id);
  delete b[dia];
  guardarBorradores(id, b);
}

// ---- Tarjeta en Entrenamiento ----
function renderTarjetas() {
  const rs = rutinas();
  tarjetas.hidden = !rs.length;
  if (!rs.length) return;
  const hoy = hoyLocal();
  tarjetas.innerHTML = `
    <div class="gym-section-header"><h2>Rutinas listas</h2></div>
    ${rs.map(r => {
      const t = M.diaDeHoy(r, hoy);
      const hechos = M.hechosSemana(r, entrenos(), hoy);
      const enCurso = r.dias.some(d => borrador(r.id, d.id));
      const cuando = t.hoy ? `Hoy: Día ${t.dia.id}` : t.enDias === 1 ? `Mañana: Día ${t.dia.id}` : t.dia.dow != null ? `${CORTO[t.dia.dow]}: Día ${t.dia.id}` : "";
      return `<a class="rl-tarjeta" href="#rutina-lista/${esc(r.id)}">
        <span class="rl-tarjeta-ic" aria-hidden="true">🏠</span>
        <span class="rl-tarjeta-t"><b>${esc(r.nombre)}</b>
          <small>${[r.nivel, `${r.diasPorSemana} días por semana`, r.duracion ? `${r.duracion} min` : ""].filter(Boolean).map(esc).join(" · ")}</small>
          <span class="rl-semana" aria-label="Esta semana">${r.dias.map(d => `<i class="${hechos[d.id] ? "is-hecho" : ""}${t.hoy && t.dia.id === d.id ? " is-hoy" : ""}" title="Día ${esc(d.id)}">${hechos[d.id] ? "✓" : esc(d.id)}</i>`).join("")}</span>
        </span>
        <span class="rl-tarjeta-cuando${t.hoy ? " is-hoy" : ""}">${enCurso ? "En curso" : esc(cuando)}</span>
      </a>`;
    }).join("")}`;
}

// ---- Página de la rutina ----
function render() {
  const r = rutinaActual();
  if (!r) {
    app.innerHTML = rutinas().length || !(window.EjercicioDatos && EjercicioDatos.estado.cargado.base)
      ? `<p class="empty-state">Cargando la rutina…</p>` : `<p class="empty-state">No se encontró esa rutina.</p>`;
    return;
  }
  const hoy = hoyLocal();
  const t = M.diaDeHoy(r, hoy);
  if (!diaId || !r.dias.some(d => d.id === diaId)) diaId = t.dia.id;
  const dia = r.dias.find(d => d.id === diaId);
  const hechos = M.hechosSemana(r, entrenos(), hoy);
  const b = borrador(r.id, dia.id);
  const marcas = b ? b.marcas : {};
  const p = M.progreso(dia, marcas);
  const viejo = b && b.fecha !== hoy;
  app.innerHTML = `
    <h1 class="page-title rl-titulo">${esc(r.nombre)}</h1>
    <p class="rl-meta">${[r.nivel, `${r.diasPorSemana} días por semana`, r.duracion ? `${r.duracion} min` : ""].filter(Boolean).map(esc).join(" · ")}</p>
    <dl class="rl-datos">
      ${r.equipo.length ? `<div><dt>Equipo</dt><dd>${r.equipo.map(esc).join(", ")}</dd></div>` : ""}
      ${r.descanso ? `<div><dt>Descanso entre series</dt><dd>${esc(r.descanso)}</dd></div>` : ""}
    </dl>
    <div class="rl-dias" role="tablist" aria-label="Días de la rutina">
      ${r.dias.map(d => {
        const esHoy = t.hoy && t.dia.id === d.id;
        return `<button type="button" role="tab" class="rl-dia-tab${d.id === dia.id ? " is-activo" : ""}${esHoy ? " is-hoy" : ""}" data-rl-dia="${esc(d.id)}" aria-selected="${d.id === dia.id}">
          <b>Día ${esc(d.id)}</b><small>${d.dow != null ? esc(CORTO[d.dow]) : ""}${esHoy ? " · Hoy" : ""}</small>${hechos[d.id] ? `<span class="rl-dia-ok" aria-label="hecho esta semana">✓</span>` : ""}
        </button>`;
      }).join("")}
    </div>
    <p class="rl-aviso${t.hoy ? " is-hoy" : ""}">${t.hoy ? `Hoy ${esc(DIAS[new Date(hoy + "T12:00:00").getDay()])} toca el <b>Día ${esc(t.dia.id)}</b>.` : `Hoy es día de descanso. El próximo: <b>Día ${esc(t.dia.id)}</b> (${t.enDias === 1 ? "mañana" : esc(DIAS[t.dia.dow])}).`}${hechos[dia.id] ? ` El Día ${esc(dia.id)} ya lo hiciste esta semana (${esc(fechaCorta(hechos[dia.id]))}).` : ""}</p>

    <section class="rl-dia" role="tabpanel" aria-label="Día ${esc(dia.id)}">
      <h2 class="rl-dia-t">Día ${esc(dia.id)} · ${esc(dia.titulo)}</h2>
      ${guardado && guardado.dia === dia.id ? `<p class="rl-guardado" role="status">✓ Guardado en tu historial: Día ${esc(dia.id)}, ${esc(fechaCorta(guardado.fecha))}, ${guardado.min} min. Ya cuenta en tu mapa muscular.</p>` : ""}
      ${viejo ? `<p class="rl-viejo">Marcaste series el ${esc(fechaCorta(b.fecha))} y no terminaste. Puedes guardarlas con esa fecha o borrar las marcas.</p>` : ""}
      <div class="rl-progreso"><span>${p.hechas} de ${p.total} series</span><i><b style="width:${p.total ? Math.round(p.hechas / p.total * 100) : 0}%"></b></i></div>
      ${dia.calentamiento ? `<div class="rl-calent"><b>🔥 Calentamiento</b><p>${esc(dia.calentamiento)}</p></div>` : ""}
      <ol class="rl-ejercicios">
        ${dia.ejercicios.map(e => {
          const xs = marcas[e.id] || [];
          const listas = xs.slice(0, e.series).filter(Boolean).length;
          return `<li class="rl-ej${listas === e.series ? " is-completo" : ""}">
            <div class="rl-ej-cab"><h3>${esc(e.nombre)}</h3><span class="rl-ej-dosis">${e.series} × ${esc(e.reps)}</span></div>
            <p class="rl-musculos">${e.musculos.map(m => `<span>${esc(m)}</span>`).join("")}</p>
            ${e.tip ? `<p class="rl-tip"><span aria-hidden="true">💡</span> ${esc(e.tip)}</p>` : ""}
            <div class="rl-series" role="group" aria-label="Series de ${esc(e.nombre)}">
              ${Array.from({ length: e.series }, (_, i) => `<button type="button" class="rl-serie${xs[i] ? " is-hecha" : ""}" role="checkbox" aria-checked="${!!xs[i]}" data-rl-ej="${esc(e.id)}" data-rl-serie="${i}" aria-label="Serie ${i + 1}${xs[i] ? " hecha" : ""}">${xs[i] ? "✓" : i + 1}</button>`).join("")}
            </div>
          </li>`;
        }).join("")}
      </ol>
      <div class="rl-acciones">
        <button type="button" class="rl-terminar" data-rl="terminar"${p.hechas ? "" : " disabled"}>${viejo ? `Guardar el ${esc(fechaCorta(b.fecha))}` : "Terminar el día y guardar"}</button>
        ${p.hechas ? `<button type="button" class="rl-borrar" data-rl="borrar">Borrar las marcas</button>` : `<p class="rl-ayuda">Toca cada serie cuando la termines. Se guarda en tu historial al terminar el día.</p>`}
      </div>
    </section>

    ${r.progresion.length ? `<section class="rl-bloque" aria-labelledby="rl-prog-t">
      <h2 id="rl-prog-t">Cómo progresar</h2>
      <ol class="rl-progresion">${r.progresion.map(x => `<li><b>Semanas ${esc(x.semanas)}</b><span>${esc(x.queHacer)}</span></li>`).join("")}</ol>
    </section>` : ""}
    ${r.consejos.length ? `<section class="rl-bloque" aria-labelledby="rl-cons-t">
      <h2 id="rl-cons-t">Consejos</h2>
      <ul class="rl-consejos">${r.consejos.map(c => `<li>${esc(c)}</li>`).join("")}</ul>
    </section>` : ""}`;
}

function terminar() {
  const r = rutinaActual();
  const dia = r && r.dias.find(d => d.id === diaId);
  const b = dia && borrador(r.id, dia.id);
  if (!b) return;
  const w = M.entreno(r, dia, b.marcas, { fecha: b.fecha, inicio: b.inicio, fin: Date.now() });
  if (!w) return;
  EjercicioDatos.coleccion("entrenamientos").doc().set(w)
    .catch(err => alert(`No se pudo guardar: ${err && err.message ? err.message : err}`));
  // Hábitos vinculados a Gimnasio y Rangos se enteran como con cualquier entreno.
  document.dispatchEvent(new CustomEvent("entreno:guardado", { detail: { fecha: w.date } }));
  olvidar(r.id, dia.id);
  guardado = { dia: dia.id, fecha: w.date, min: w.durationMin };
  render();
  renderTarjetas();
  const ok = app.querySelector(".rl-guardado");
  if (ok) ok.scrollIntoView({ behavior: "smooth", block: "center" });
}

app.addEventListener("click", e => {
  const r = rutinaActual();
  if (!r) return;
  const tab = e.target.closest("[data-rl-dia]");
  if (tab) { diaId = tab.dataset.rlDia; guardado = null; render(); return; }
  const s = e.target.closest("[data-rl-serie]");
  if (s) {
    const dia = r.dias.find(d => d.id === diaId);
    const ej = dia.ejercicios.find(x => x.id === s.dataset.rlEj);
    if (!ej) return;
    guardado = null;
    marcar(r.id, dia.id, ej.id, Number(s.dataset.rlSerie), ej.series);
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
    renderTarjetas();
    return;
  }
  const b = e.target.closest("[data-rl]");
  if (!b) return;
  if (b.dataset.rl === "terminar") terminar();
  else if (b.dataset.rl === "borrar") {
    if (!confirm("¿Borrar las series marcadas de este día?")) return;
    olvidar(r.id, diaId);
    render();
    renderTarjetas();
  }
});

// #rutina-lista/{id}: abre esa rutina (o la primera).
function desdeHash() {
  const h = location.hash.replace("#", "").split("/");
  if (h[0] !== "rutina-lista") return;
  const id = h[1] || (rutinas()[0] && rutinas()[0].id) || null;
  if (id !== rutinaId) { rutinaId = id; diaId = null; guardado = null; }
  render();
}
window.addEventListener("hashchange", desdeHash);
if (window.EjercicioDatos) EjercicioDatos.onCambio(() => { renderTarjetas(); if (location.hash.startsWith("#rutina-lista")) desdeHash(); });
renderTarjetas();
desdeHash();

window.RutinasListas = { render, renderTarjetas };
})();
