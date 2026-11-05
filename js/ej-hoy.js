// ---------- ¿Qué entreno hoy?, recuperación y carga de la semana ----------
// - Tarjeta de hoy (#ej-hoy en Entrenamiento y #rut-hoy en Gimnasio): la
//   rutina del plan con el porqué, u otra si tus piernas no están listas
//   (carrera larga o dura ayer, o la que sueles hacer mañana) o si sus
//   músculos se recuperan; Movilidad o descanso si nada sirve. Los botones
//   "Empezar" los atiende js/rutinas-ui.js (data-rut-empezar).
// - Recuperación (#ej-recuperacion y #ejp-recuperacion en Perfil): figura
//   de frente y espalda con listo / recuperándose / cansado.
// - Carga de la semana (#ej-carga): gimnasio + Running + bici por día, en la
//   escala de Running.
// Cuentas en js/ej-recuperacion.js (D-096). Sin lecturas nuevas: usa lo que
// EjercicioDatos ya tiene (entrenos, carreras, bici) y tus rutinas.
(function () {
"use strict";

const RC = window.EjRecuperacion;
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIAS_C = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const ESTADO_TXT = { listo: "Listo", recuperando: "Recuperándose", cansado: "Cansado" };
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const st = () => EjercicioDatos.estado;
const fichaDe = x => EjercicioDatos.resolver(x.name || x.nombre, x.exerciseId);

function fat() {
  const r = st().registros;
  return RC.fatiga({ ahora: Date.now(), entrenos: r.gimnasio || [], carreras: r.running || [], bicis: r.bicicleta || [], fichaDe });
}

// ---- ¿Qué entreno hoy? ----
function recomendacion() {
  if (!window.RutinasUI) return null;
  const hoy = iso(new Date());
  const r = st().registros;
  const ajustes = st().ajustes || {};
  const vol = window.EjVolumen && EjVolumen.datos();
  const faltan = {};
  if (vol) vol.vol.forEach(v => { if (v.estado === "bajo") faltan[v.id] = Math.ceil(v.min - v.total); });
  const nombres = {};
  EjPrograma.MUSCULOS_OBJ.forEach(m => { nombres[m.id] = m.nombre; });
  const rutinas = RutinasUI.rutinas().map(rt => ({
    id: rt.id, name: rt.name, items: rt.items,
    zonas: RC.zonasDeRutina(rt.items, fichaDe),
    musculos: EjPrograma.seriesPorMusculo(rt.items.map(it => ({ ejercicio: fichaDe(it) || {}, series: Array(it.series).fill({ reps: 1 }) })))
  }));
  return RC.recomendar({
    hoy, fat: fat(), plan: RutinasUI.plan(), rutinas, faltan, nombres,
    carreras: r.running || [], hechoHoy: (r.gimnasio || []).some(w => w.date === hoy),
    descarga: !!EjPrograma.descargaActiva(ajustes.descargas, hoy)
  });
}

function tarjeta(rec) {
  const dia = DIAS[new Date().getDay()];
  const razones = xs => (xs && xs.length ? `<ul class="rut-hoy-razones">${xs.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
  const manana = rec.manana ? `<p class="rut-hoy-manana">${esc(rec.manana)}</p>` : "";
  const info = rt => `${rt.items.length} ejercicios · ${EjRutinas.totalSeries(rt)} series`;
  if (rec.tipo === "hecho") {
    if (rec.plan) {
      return { clase: "is-hecha", html: `<div><span class="rut-hoy-eyebrow">Hoy, ${dia}</span>
        <strong>${esc(rec.plan.name)} <span class="rut-hoy-ok">✓ Hecho</span></strong><small>Ya entrenaste lo de hoy. ¡Bien!</small>${manana}</div>
        <button type="button" class="rut-hoy-otra" data-rut-empezar="${esc(rec.plan.id)}">Repetir</button>` };
    }
    return { clase: "is-hecha", html: `<div><span class="rut-hoy-eyebrow">Hoy, ${dia}</span>
      <strong>Ya entrenaste <span class="rut-hoy-ok">✓</span></strong><small>${esc(rec.razones[0])}</small>${manana}</div>` };
  }
  if (rec.tipo === "plan") {
    return { clase: "is-rico", html: `<div><span class="rut-hoy-eyebrow">Hoy, ${dia}, toca</span>
      <strong>${esc(rec.rutina.name)}</strong><small>${info(rec.rutina)}</small>${razones(rec.razones)}${manana}</div>
      <div class="rut-hoy-acciones"><button type="button" class="rut-hoy-btn" data-rut-empezar="${esc(rec.rutina.id)}">Empezar</button></div>` };
  }
  const igual = rec.plan ? `<button type="button" class="rut-hoy-otra" data-rut-empezar="${esc(rec.plan.id)}">Hacer ${esc(rec.plan.name)} igual</button>` : "";
  if (rec.tipo === "cambio") {
    return { clase: "is-rico is-cambio", html: `<div><span class="rut-hoy-eyebrow">Hoy, ${dia}, tocaba ${esc(rec.plan.name)}</span>
      <strong>Mejor hoy: ${esc(rec.rutina.name)}</strong>${razones(rec.razones)}${manana}</div>
      <div class="rut-hoy-acciones"><button type="button" class="rut-hoy-btn" data-rut-empezar="${esc(rec.rutina.id)}">Empezar ${esc(rec.rutina.name)}</button>${igual}</div>` };
  }
  if (rec.tipo === "extra") {
    return { clase: "is-rico", html: `<div><span class="rut-hoy-eyebrow">Hoy, ${dia}, no tienes rutina</span>
      <strong>Si quieres entrenar: ${esc(rec.rutina.name)}</strong>${razones(rec.razones.filter(x => !/^Hoy no tienes/.test(x)))}${manana}</div>
      <div class="rut-hoy-acciones"><button type="button" class="rut-hoy-btn" data-rut-empezar="${esc(rec.rutina.id)}">Empezar</button>
      <a class="rut-hoy-otra" href="#movilidad">Movilidad</a></div>` };
  }
  // movilidad o descanso
  return { clase: "is-rico is-descanso", html: `<div><span class="rut-hoy-eyebrow">${rec.plan ? `Hoy, ${dia}, tocaba ${esc(rec.plan.name)}` : `Hoy, ${dia}`}</span>
    <strong>${esc(rec.titulo)}</strong>${razones(rec.razones)}${manana}</div>
    <div class="rut-hoy-acciones"><a class="rut-hoy-btn" href="#movilidad">Ir a Movilidad</a>${igual}</div>` };
}

function renderHoy() {
  const rec = recomendacion();
  const t = rec ? tarjeta(rec) : null;
  ["rut-hoy", "ej-hoy"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = !t;
    el.className = `rut-hoy${id === "ej-hoy" ? " ej-hoy" : ""}${t && t.clase ? " " + t.clase : ""}`;
    el.innerHTML = t ? t.html : "";
  });
}

// ---- Recuperación ----
function cuandoListo(h) {
  const f = new Date(Date.now() + h * 3600000);
  const hoy = new Date();
  const dif = Math.round((new Date(f.getFullYear(), f.getMonth(), f.getDate()) - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) / 86400000);
  if (dif <= 0) return "listo esta noche";
  if (dif === 1) return f.getHours() < 12 ? "listo mañana temprano" : "listo mañana";
  return `listo el ${DIAS_C[f.getDay()]}`;
}
function recuperacionHTML(ids) {
  return `<div class="radar-head"><h2 id="${ids}-t">Recuperación</h2><p class="radar-sub">Según tus entrenos y carreras de los últimos días</p></div>
    <div class="ejrec-figs">
      <figure class="ejrec-fig-wrap"><svg class="figura ejrec-fig" data-vista="frente" viewBox="0 0 140 300" role="img" aria-label="Recuperación de los músculos, de frente"></svg><figcaption>Frente</figcaption></figure>
      <figure class="ejrec-fig-wrap"><svg class="figura ejrec-fig" data-vista="espalda" viewBox="0 0 140 300" role="img" aria-label="Recuperación de los músculos, de espalda"></svg><figcaption>Espalda</figcaption></figure>
    </div>
    <div class="ejrec-leyenda"><span><i class="is-listo"></i>Listo</span><span><i class="is-recuperando"></i>Recuperándose</span><span><i class="is-cansado"></i>Cansado</span></div>
    <ul class="ejrec-lista"></ul><p class="ejrec-nota"></p>`;
}
function renderRecuperacion() {
  const f = fat();
  const nombre = z => (MuscleEngine.MUSCULO_POR_ID[z] || {}).nombre || z;
  const pendientes = Object.keys(f.zonas).filter(z => f.zonas[z].estado !== "listo").sort((a, b) => f.zonas[b].valor - f.zonas[a].valor);
  const hoy = iso(new Date());
  const corrida = RC.carreraReciente(st().registros.running || [], hoy);
  ["ej-recuperacion", "ejp-recuperacion"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!el.querySelector(".ejrec-fig")) {
      el.innerHTML = recuperacionHTML(id);
      el.querySelectorAll(".ejrec-fig").forEach(svg => BodyFigures.dibujar(svg, BodyFigures[svg.dataset.vista]));
    }
    el.querySelectorAll(".ejrec-fig .mz").forEach(g => {
      const z = f.zonas[g.dataset.muscle];
      g.setAttribute("data-rec", z ? z.estado : "listo");
    });
    el.querySelector(".ejrec-lista").innerHTML = pendientes.length
      ? pendientes.slice(0, 6).map(z => `<li class="is-${f.zonas[z].estado}" aria-label="${esc(`${nombre(z)}: ${ESTADO_TXT[f.zonas[z].estado].toLowerCase()}, ${cuandoListo(f.zonas[z].listoEnH)}`)}"><i aria-hidden="true"></i><b aria-hidden="true">${esc(nombre(z))}</b><span aria-hidden="true">${cuandoListo(f.zonas[z].listoEnH)}</span></li>`).join("")
      : `<li class="is-listo"><i aria-hidden="true"></i><b>Todo listo</b><span>Puedes entrenar lo que quieras.</span></li>`;
    const nota = el.querySelector(".ejrec-nota");
    nota.textContent = corrida ? `Incluye tu carrera: ${corrida.texto.replace(/^Ayer corriste/, "ayer corriste").replace(/^Hoy ya corriste/, "hoy corriste")}.` : "";
    nota.hidden = !corrida;
    el.hidden = false;
  });
}

// ---- Carga de la semana ----
function renderCarga() {
  const el = document.getElementById("ej-carga");
  if (!el) return;
  const r = st().registros;
  const hoy = iso(new Date());
  const c = RC.cargaSemana({ hoy, entrenos: r.gimnasio || [], carreras: r.running || [], bicis: r.bicicleta || [] });
  if (!c.total && !c.promedio) { el.hidden = true; return; }
  const max = Math.max(1, ...c.dias.map(d => d.gym + d.run + d.bici));
  const alto = v => Math.round((v / max) * 1000) / 10;
  const pct = c.promedio ? Math.round((c.total / c.promedio) * 100) : null;
  const frase = !c.promedio ? "Cuando tengas más semanas, te digo cómo va contra tu semana típica."
    : pct >= 115 ? `Ya pasaste tu semana típica (${pct} %): si te sientes cansado, toma un día suave.`
    : pct >= 85 ? `Vas en tu semana típica (${pct} %).`
    : `Llevas el ${pct} % de tu semana típica.`;
  const hayBici = c.bici > 0;
  el.innerHTML = `<div class="radar-head"><h2 id="ejcg-t">Carga de la semana</h2><p class="radar-sub">Gimnasio${hayBici ? ", bici" : ""} y Running en la misma escala (1 hora a esfuerzo 8 = 100)</p></div>
    <p class="ejcg-total"><b>${c.total}</b> esta semana${c.promedio ? ` · tu semana típica: ${c.promedio}` : ""}</p>
    <div class="ejcg-barras" role="img" aria-label="${esc(c.dias.map(d => `${DIAS[new Date(d.fecha + "T12:00:00").getDay()]}: ${d.gym + d.run + d.bici}`).join(", "))}">
      ${c.dias.map(d => {
        const t = d.gym + d.run + d.bici;
        return `<div class="ejcg-dia${d.fecha === hoy ? " is-hoy" : ""}${d.fecha > hoy ? " is-futuro" : ""}">
          <span class="ejcg-v">${t || ""}</span>
          <span class="ejcg-col"><i class="is-run" style="height:${alto(d.run)}%"></i><i class="is-bici" style="height:${alto(d.bici)}%"></i><i class="is-gym" style="height:${alto(d.gym)}%"></i></span>
          <span class="ejcg-d">${DIAS_C[new Date(d.fecha + "T12:00:00").getDay()]}</span></div>`;
      }).join("")}
    </div>
    <div class="ejrec-leyenda ejcg-leyenda"><span><i class="is-gym"></i>Gimnasio ${c.gym}</span><span><i class="is-run"></i>Running ${c.run}</span>${hayBici ? `<span><i class="is-bici"></i>Bici ${c.bici}</span>` : ""}</div>
    <p class="ejv-resumen ejcg-frase">${esc(frase)}</p>
    ${c.estimada ? `<p class="ejcg-nota">En los entrenos sin esfuerzo anotado, el gimnasio se estima (esfuerzo 7).</p>` : ""}`;
  el.hidden = false;
}

let pendiente = false;
function render() {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(() => {
    pendiente = false;
    const s = st();
    if (!s.datos || (!s.cargado.gimnasio && !(s.registros.gimnasio || []).length)) return;
    renderHoy();
    renderRecuperacion();
    renderCarga();
  });
}

EjercicioDatos.onCambio(render);
["ejercicio:ajustes", "rutinas:cambio"].forEach(ev => document.addEventListener(ev, render));
// Al volver a la app (otro día u horas después) se recalcula.
document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
window.EjHoy = { render, recomendacion };
})();
