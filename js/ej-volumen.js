// ---------- Series por músculo y equilibrio (tarjeta) ----------
// En Entrenamiento (#ej-volumen), debajo de la distribución muscular:
// - Series efectivas por músculo contra el rango de tu meta y nivel
//   (Ajustes del gimnasio): bajo, dentro o alto. Con plan semanal mira la
//   semana en curso (lunes a hoy) + lo que te queda del plan hasta el
//   domingo; sin plan, los últimos 7 días.
// - Equilibrio de las últimas 4 semanas: empuje/tirón, cuádriceps/isquios
//   y hombro de adelante/de atrás.
// - "Crear rutinas para mí" (js/ej-generador.js) y la semana del bloque.
// Las cuentas están en js/ej-programa.js (D-095).
(function () {
"use strict";

const META_TXT = { hipertrofia: "músculo", fuerza: "fuerza", general: "general" };
const EQ_TXT = { empuje_tiron: "Empuje / tirón", cuad_isquios: "Cuádriceps / isquios", deltoides: "Hombro adelante / atrás" };
const ORDEN = ["1", "2", "3", "4", "5", "6", "0"];
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const n1 = v => String(Math.round(v * 10) / 10).replace(".", ",");
const lista = xs => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

// Lo que queda del plan esta semana (de hoy al domingo), como entradas del
// mapa muscular. La rutina de hoy no cuenta si ya la hiciste.
function planeadas(hoy) {
  if (!window.RutinasUI) return { entradas: [], hayPlan: false };
  const dias = (RutinasUI.plan() || {}).dias || {};
  const rutinas = RutinasUI.rutinas() || [];
  const hayPlan = Object.keys(dias).some(k => rutinas.some(r => r.id === dias[k]));
  const k = String(new Date(hoy + "T12:00:00").getDay());
  const gym = EjercicioDatos.estado.registros.gimnasio || [];
  const entradas = [];
  ORDEN.slice(ORDEN.indexOf(k)).forEach(d => {
    const r = rutinas.find(x => x.id === dias[d]);
    if (!r) return;
    if (d === k && gym.some(w => w.date === hoy && w.rutinaId === r.id)) return;
    r.items.forEach(it => {
      const f = EjercicioDatos.resolver(it.nombre, it.exerciseId);
      if (f) entradas.push({ ejercicio: f, series: Array(it.series).fill({ reps: it.repsMin }) });
    });
  });
  return { entradas, hayPlan };
}

function calcular() {
  const st = EjercicioDatos.estado;
  if (!st.datos) return null;
  const hoy = hoyIso();
  const a = st.ajustes || {};
  const meta = a.meta || "hipertrofia", nivel = a.nivel || "intermedio";
  const gym = st.datos.entradas.filter(e => e.ejercicio && e.ejercicio.tipo !== "cardio" && e.fecha <= hoy);
  const pl = planeadas(hoy);
  const desde = pl.hayPlan ? EjPrograma.lunes(hoy) : EjPrograma.addDias(hoy, -6);
  const semana = gym.filter(e => e.fecha >= desde);
  const mes = gym.filter(e => e.fecha > EjPrograma.addDias(hoy, -28));
  return {
    meta, nivel, hoy, hay: mes.length > 0 || pl.entradas.length > 0, conPlan: pl.hayPlan,
    vol: EjPrograma.volumenConPlan(semana, pl.entradas, meta, nivel),
    eq: EjPrograma.equilibrio(mes, MuscleEngine.calcularMusculos(mes, EjercicioDatos.config())),
    descarga: EjPrograma.descargaActiva(a.descargas, hoy),
    bloque: a.bloque ? EjPrograma.semanaDeBloque(a.bloque, hoy) : null,
    semanasBloque: a.bloque && a.bloque.semanas
  };
}

function fila(v, escala) {
  const pct = x => Math.min(100, Math.round((x / escala) * 1000) / 10);
  const falta = Math.ceil(v.min - v.total - 0.01); // series enteras: "faltan 1", no "0,5"
  const estado = v.estado === "bajo" ? `Faltan ${n1(falta)}` : v.estado === "alto" ? "Mucho" : "Bien";
  const etq = `${v.nombre}: ${n1(v.series)} series${v.plan ? ` y ${n1(v.plan)} más en tu plan` : ""}; tu objetivo es de ${v.min} a ${v.max}. ${estado}.`;
  return `<li class="ejv-fila is-${v.estado}" aria-label="${esc(etq)}">
    <span class="ejv-linea" aria-hidden="true"><span class="ejv-nombre">${esc(v.nombre)}</span>
      <span class="ejv-num">${n1(v.series)}${v.plan ? `<small> + ${n1(v.plan)} del plan</small>` : ""}</span>
      <span class="ejv-estado">${estado}</span></span>
    <span class="ejv-barra" aria-hidden="true"><i class="ejv-zona" style="left:${pct(v.min)}%;width:${pct(v.max) - pct(v.min)}%"></i><i class="ejv-lleno" style="width:${pct(v.series)}%"></i>${v.plan ? `<i class="ejv-plan" style="left:${pct(v.series)}%;width:${pct(v.total) - pct(v.series)}%"></i>` : ""}</span>
  </li>`;
}

function resumen(d) {
  if (d.descarga) return "Semana de descarga: tener menos series es justo lo que toca.";
  const bajos = d.vol.filter(v => v.estado === "bajo").sort((a, b) => (b.min - b.total) / b.min - (a.min - a.total) / a.min);
  const altos = d.vol.filter(v => v.estado === "alto");
  const out = [];
  const nombres = vs => (vs.length > 3 ? `${vs.slice(0, 3).map(v => v.nombre.toLowerCase()).join(", ")} y ${vs.length - 3} más` : lista(vs.map(v => v.nombre.toLowerCase())));
  if (bajos.length) out.push(`${d.conPlan ? "Aun con lo que te queda del plan, l" : "L"}${bajos.length === 1 ? "e faltan" : "es faltan"} series a ${nombres(bajos)}.`);
  if (altos.length) out.push(`${lista(altos.map(v => v.nombre))}: más de lo recomendable; si te cuesta recuperarte, baja algo.`);
  if (!out.length) out.push(d.conPlan ? "Con lo que te queda del plan, todos tus músculos llegan a tu objetivo. ¡Bien!" : "Todos tus músculos están dentro de tu objetivo. ¡Bien!");
  return out.join(" ");
}

function html(d) {
  const sub = `${d.conPlan ? "Esta semana, con tu plan" : "Últimos 7 días"} · objetivo para ${META_TXT[d.meta] || "músculo"}, ${esc(d.nivel)}`;
  const botones = `<div class="ejv-acciones">
      <button type="button" class="ejc-btn" data-generador>Crear rutinas para mí</button>
      <button type="button" class="ejc-btn-sec" data-ajustes-gym>Meta y nivel</button></div>`;
  const bloque = d.bloque ? `<p class="ejv-bloque">Bloque: semana ${d.bloque} de ${esc(d.semanasBloque)}${d.bloque === Number(d.semanasBloque) ? " · semana de descarga" : ` · la ${esc(d.semanasBloque)}.ª es de descarga`}</p>` : "";
  if (!d.hay) {
    return `<div class="radar-head"><h2 id="ejv-titulo">Series por músculo</h2><p class="radar-sub">${sub}</p></div>${bloque}
      <p class="ej-texto">Cuando entrenes, aquí verás cuántas series hace cada músculo a la semana contra tu objetivo, y si tu entrenamiento está equilibrado.</p>${botones}`;
  }
  const escala = Math.max(...d.vol.map(v => Math.max(v.max, v.total))) * 1.04;
  const eq = d.eq.length ? `<h3 class="radar-subtitle">Equilibrio · últimas 4 semanas</h3>
    <ul class="ejv-eq">${d.eq.map(x => `<li class="${x.ok ? "is-ok" : "is-mal"}">
      <span class="ejv-eq-ico" aria-hidden="true">${x.ok ? "✓" : "!"}</span>
      <span><b>${esc(EQ_TXT[x.id] || x.id)}</b> <span class="ejv-eq-par">${n1(x.a)} : ${n1(x.b)} series</span><small>${esc(x.texto)}</small></span></li>`).join("")}</ul>` : "";
  return `<div class="radar-head"><h2 id="ejv-titulo">Series por músculo</h2><p class="radar-sub">${sub}</p></div>${bloque}
    <p class="ejv-resumen">${esc(resumen(d))}</p>
    <ul class="ejv-lista">${d.vol.map(v => fila(v, escala)).join("")}</ul>
    <p class="ejv-leyenda"><i aria-hidden="true"></i>Tu rango por semana.${d.conPlan ? ` <i class="is-plan" aria-hidden="true"></i>Lo que te queda del plan.` : ""} Una serie de un músculo que solo ayuda cuenta como media.</p>
    ${eq}${botones}`;
}

let pendiente = false;
function render() {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(() => {
    pendiente = false;
    const el = document.getElementById("ej-volumen");
    if (!el) return;
    const st = EjercicioDatos.estado;
    if (!st.cargado.gimnasio && !(st.registros.gimnasio || []).length) return;
    const d = calcular();
    if (!d) return;
    el.innerHTML = html(d);
    el.hidden = false;
  });
}

EjercicioDatos.onCambio(render);
document.addEventListener("ejercicio:ajustes", render);
document.addEventListener("rutinas:cambio", render);
window.EjVolumen = { render };
})();
