// ---------- Perfil: tu semana y gráficos (fase 7) ----------
// - "Tu semana" (#ejp-semana): resumen por reglas (js/ej-inteligencia.js)
//   con "Compartir mi semana" (imagen, js/ej-compartir.js).
// - Gráficos (#ejp-graficos), con pestañas: Fuerza (1RM estimado de un
//   ejercicio), Volumen (series por grupo y semana), Frecuencia (días por
//   semana de cada músculo) y Peso (peso corporal y fuerza relativa).
// Se dibuja solo con Perfil a la vista; usa lo que la app ya tiene cargado.
(function () {
"use strict";

const I = window.EjInteligencia;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const COLORES = { pecho: "#ff7a30", espalda: "#4da3ff", hombros: "#ffb84d", brazos: "#b38cff", piernas: "#6fd08c", core: "#f1a193" };
const GRANDES = [["barbell-squat", "Sentadilla"], ["barbell-bench-press-medium-grip", "Press de banca"], ["barbell-deadlift", "Peso muerto"], ["standing-military-press", "Press militar"]];
let tab = "fuerza";
let ejercicio = null;

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const kg = n => `${String(Math.round(n * 10) / 10).replace(".", ",")} kg`;
const corta = iso => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;
const st = () => EjercicioDatos.estado;
const fichaDe = ex => EjercicioDatos.resolver(ex.name, ex.exerciseId);
const entrenos = () => (st().registros.gimnasio || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.startedAt || 0) - (b.startedAt || 0)));
const visible = () => location.hash === "#ej-perfil";

// ---- Tu semana ----
function recordsDeSemana(lista, hoy) {
  const lun = I.lunesDe(hoy);
  const nombres = [];
  lista.forEach((w, i) => {
    if (w.date < lun || w.date > hoy) return;
    const antes = lista.slice(0, i);
    (w.exercises || []).forEach(ex => {
      const f = fichaDe(ex);
      if (!f || f.tipo !== "carga" || nombres.includes(f.nombre)) return;
      const mismo = e => { const r = fichaDe(e); return !!r && r.id === f.id; };
      const prev = EjEntreno.previoDe(EjHistorial.sesiones(antes, mismo, { tipo: "carga" }));
      const hoyS = EjHistorial.sesiones([{ id: "x", date: w.date, exercises: [ex] }], () => true, { tipo: "carga" })[0];
      if (hoyS && hoyS.mejor && EjEntreno.recordEnVivo(hoyS.mejor, prev)) nombres.push(f.nombre);
    });
  });
  return nombres;
}
let ultimaSemana = null;
function renderSemana() {
  const el = document.getElementById("ejp-semana");
  if (!el) return;
  const hoy = hoyIso();
  const lista = entrenos();
  const plan = (window.RutinasUI && RutinasUI.plan().dias) || {};
  const rutinas = (window.RutinasUI && RutinasUI.rutinas()) || [];
  const planeados = Object.keys(plan).filter(k => plan[k] && rutinas.some(r => r.id === plan[k])).length;
  const vol = window.EjVolumen && EjVolumen.datos();
  const reg = st().registros;
  const carga = window.EjRecuperacion ? EjRecuperacion.cargaSemana({ hoy, entrenos: reg.gimnasio || [], carreras: reg.running || [], bicis: reg.bicicleta || [] }) : null;
  const s = I.resumenSemana({ hoy, entrenos: lista, planeados, records: recordsDeSemana(lista, hoy), volumen: vol && vol.vol, carga, resumenDe: w => EjEntreno.totales(w) });
  ultimaSemana = { s, carga, hoy };
  const lun = I.lunesDe(hoy);
  el.innerHTML = `<div class="radar-head"><h2 id="ejps-t">Tu semana</h2><p class="radar-sub">Del ${esc(corta(lun))} al ${esc(corta(I.addDias(lun, 6)))}</p></div>
    <p class="ejps-titulo">${esc(s.titulo)}</p>
    <ul class="ejps-lineas">${s.lineas.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
    ${s.cifras.entrenos ? `<div class="ejv-acciones"><button type="button" class="ejc-btn-sec" data-ejps-compartir>Compartir mi semana</button></div>` : ""}`;
  el.hidden = false;
}

// ---- Gráficos ----
function svgLinea(puntos, opciones) {
  const o = opciones || {};
  const Wd = 340, Ht = 170, pl = 8, pr = 8, pt = 14, pb = 22;
  if (!puntos.length) return "";
  const ys = puntos.map(p => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (max - min < 1) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15;
  min -= pad; max += pad;
  const n = puntos.length;
  const x = i => pl + (n === 1 ? (Wd - pl - pr) / 2 : (i / (n - 1)) * (Wd - pl - pr));
  const y = v => pt + (1 - (v - min) / (max - min)) * (Ht - pt - pb);
  const d = puntos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const area = `${d} L${x(n - 1).toFixed(1)},${Ht - pb} L${x(0).toFixed(1)},${Ht - pb} Z`;
  const etq = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
  return `<svg class="ejpg-svg" viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="${esc(o.label || "")}">
    <path d="${area}" fill="${o.color || "#ff9a3c"}" opacity="0.12"/>
    <path d="${d}" fill="none" stroke="${o.color || "#ff9a3c"}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${puntos.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="${i === n - 1 ? 4.5 : 2.5}" fill="${o.color || "#ff9a3c"}"/>`).join("")}
    ${etq.map(i => `<text x="${x(i).toFixed(1)}" y="${Ht - 5}" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}" class="ejpg-eje">${esc(puntos[i].etq)}</text>`).join("")}
  </svg>`;
}

function fuerza() {
  const lista = entrenos();
  // Ejercicios con peso y 2+ sesiones, los más hechos primero.
  const cuenta = {};
  lista.forEach(w => (w.exercises || []).forEach(ex => {
    const f = fichaDe(ex);
    if (f && f.tipo === "carga") (cuenta[f.id] = cuenta[f.id] || { f, n: 0 }).n++;
  }));
  // Primero los grandes (sentadilla, banca, peso muerto, press militar), después
  // los compuestos y al final los de aislamiento; dentro, los más hechos.
  const rango = f => (GRANDES.some(([id]) => id === f.id) ? 0 : f.mec === "c" ? 1 : 2);
  const opciones = Object.values(cuenta).filter(x => x.n >= 2).sort((a, b) => rango(a.f) - rango(b.f) || b.n - a.n || a.f.nombre.localeCompare(b.f.nombre));
  if (!opciones.length) return `<p class="ej-texto">Con 2 entrenos del mismo ejercicio vas a ver aquí cómo sube tu fuerza.</p>`;
  if (!ejercicio || !opciones.some(x => x.f.id === ejercicio)) ejercicio = opciones[0].f.id;
  const f = cuenta[ejercicio].f;
  const mismo = e => { const r = fichaDe(e); return !!r && r.id === f.id; };
  const desde = I.addDias(hoyIso(), -365);
  const ses = EjHistorial.sesiones(lista, mismo, { tipo: "carga" }).filter(s => s.e1rm > 0 && s.fecha >= desde);
  const ult = ses[ses.length - 1], pri = ses[0];
  const mejor = Math.max(...ses.map(x => x.e1rm));
  const dif = ult.e1rm - pri.e1rm;
  const semanas = Math.max(1, Math.round(EjHistorial.diasEntre(pri.fecha, ult.fecha) / 7));
  return `<label class="ejg-campo ejpg-sel">Ejercicio<select data-ejpg-ej>${opciones.map(x => `<option value="${esc(x.f.id)}"${x.f.id === ejercicio ? " selected" : ""}>${esc(x.f.nombre)} (${x.n})</option>`).join("")}</select></label>
    <p class="ejpg-dato"><b>${kg(ult.e1rm)}</b> 1RM estimado${ses.length > 1 ? ` · <span class="${dif >= 0 ? "ejr-sube" : "ejr-baja"}">${dif >= 0 ? "+" : "−"}${kg(Math.abs(dif))}</span> en ${semanas} ${semanas === 1 ? "semana" : "semanas"}` : ""}${mejor > ult.e1rm ? ` (tu mejor: ${kg(mejor)})` : ""}</p>
    ${svgLinea(ses.map(s => ({ y: s.e1rm, etq: corta(s.fecha) })), { label: `1RM estimado de ${f.nombre} por sesión` })}
    <p class="ejpg-nota">Mejor serie de cada sesión con la fórmula de Epley. Toca el nombre en tus rutinas para ver la ficha completa.</p>`;
}

function volumen() {
  const hoy = hoyIso();
  const lun = I.lunesDe(hoy);
  const cfg = EjercicioDatos.config();
  const semanas = [];
  for (let i = 7; i >= 0; i--) {
    const desde = I.addDias(lun, -7 * i), hasta = I.addDias(desde, 6);
    const g = MuscleEngine.calcularGrupos(MuscleEngine.filtrar(st().datos, desde, hasta).entradas, cfg);
    semanas.push({ desde, g });
  }
  const grupos = MuscleEngine.GRUPOS.map(g => g.id);
  const total = s => grupos.reduce((a, k) => a + s.g[k].series, 0);
  const max = Math.max(1, ...semanas.map(total));
  return `<p class="ejpg-dato"><b>${Math.round(total(semanas[7]))}</b> series esta semana · últimas 8 semanas</p>
    <div class="ejpg-barras" role="img" aria-label="${esc(semanas.map(s => `semana del ${corta(s.desde)}: ${Math.round(total(s))} series`).join(", "))}">
      ${semanas.map((s, i) => `<div class="ejpg-col${i === 7 ? " is-hoy" : ""}"><span class="ejpg-pila">${grupos.slice().reverse().map(k => s.g[k].series > 0 ? `<i style="height:${((s.g[k].series / max) * 100).toFixed(1)}%;background:${COLORES[k]}"></i>` : "").join("")}</span><span class="ejpg-d">${esc(corta(s.desde).replace(/ \w+$/, ""))}</span></div>`).join("")}
    </div>
    <div class="ejrec-leyenda ejpg-leyenda">${MuscleEngine.GRUPOS.map(g => `<span><i style="background:${COLORES[g.id]}"></i>${esc(g.nombre)}</span>`).join("")}</div>
    <p class="ejpg-nota">Series efectivas: una serie de un músculo que solo ayuda cuenta como media.</p>`;
}

function frecuencia() {
  const f = I.frecuencia(st().datos.entradas, EjPrograma.MUSCULOS_OBJ, hoyIso());
  const max = Math.max(3, ...f.map(x => x.porSemana));
  return `<p class="ejpg-dato">Días por semana que entrenas cada músculo · últimas 4 semanas</p>
    <ul class="ejpg-frec">${f.map(x => `<li class="${x.porSemana >= 2 ? "is-ok" : x.porSemana > 0 ? "is-poco" : "is-nada"}" aria-label="${esc(`${x.nombre}: ${String(x.porSemana).replace(".", ",")} días por semana`)}">
      <span>${esc(x.nombre)}</span><span class="ejpg-frec-barra" aria-hidden="true"><i style="width:${((x.porSemana / max) * 100).toFixed(1)}%"></i><b style="left:${((2 / max) * 100).toFixed(1)}%"></b></span><em aria-hidden="true">${String(x.porSemana).replace(".", ",")}</em></li>`).join("")}</ul>
    <p class="ejpg-nota">La línea marca 2 días: entrenar cada músculo 2 veces por semana da mejores resultados que 1 (Schoenfeld y otros, 2016).</p>`;
}

function peso() {
  const pes = (st().perfil && st().perfil.pesajes) || {};
  const ks = Object.keys(pes).sort();
  const hoy = hoyIso();
  const lista = entrenos();
  const rel = GRANDES.map(([id, nombre]) => {
    const mismo = e => { const r = fichaDe(e); return !!r && r.id === id; };
    const r = I.fuerzaRelativa(EjHistorial.sesiones(lista, mismo, { tipo: "carga" }), pes, hoy);
    return r ? { nombre, r } : null;
  }).filter(Boolean);
  if (!ks.length) return `<p class="ej-texto">Anota tu peso en «Tu cuerpo» (más abajo) para ver tu evolución y tu fuerza relativa.</p>`;
  const ultimo = pes[ks[ks.length - 1]];
  return `<p class="ejpg-dato"><b>${kg(ultimo)}</b> tu último peso${ks.length > 1 ? ` · ${kg(Math.abs(ultimo - pes[ks[0]])).replace(" kg", "")} kg ${ultimo <= pes[ks[0]] ? "menos" : "más"} desde el ${esc(corta(ks[0]))}` : ""}</p>
    ${ks.length > 1 ? svgLinea(ks.map(k => ({ y: Number(pes[k]), etq: corta(k) })), { color: "#4da3ff", label: "Peso corporal" }) : ""}
    ${rel.length ? `<h4 class="ejf-sub">Fuerza relativa</h4><ul class="ejpg-rel">${rel.map(x => `<li><span>${esc(x.nombre)}</span><b>${String(x.r.ratio).replace(".", ",")} × tu peso</b><small>${kg(x.r.e1rm)} de 1RM estimado</small></li>`).join("")}</ul>
    <p class="ejpg-nota">Tu mejor 1RM estimado de las últimas 12 semanas dividido por tu peso de ese día.</p>` : ""}`;
}

const TABS = [["fuerza", "Fuerza"], ["volumen", "Volumen"], ["frecuencia", "Frecuencia"], ["peso", "Peso"]];
function renderGraficos() {
  const el = document.getElementById("ejp-graficos");
  if (!el || !st().datos) return;
  const cuerpo = tab === "volumen" ? volumen() : tab === "frecuencia" ? frecuencia() : tab === "peso" ? peso() : fuerza();
  el.innerHTML = `<div class="radar-head"><h2 id="ejpg-t">Gráficos</h2></div>
    <div class="fin-tabs ejpg-tabs" role="tablist" aria-label="Qué ver">${TABS.map(([k, t]) => `<button type="button" class="fin-tab${tab === k ? " active" : ""}" role="tab" aria-selected="${tab === k}" data-ejpg-tab="${k}">${t}</button>`).join("")}</div>
    <div class="ejpg-cuerpo" role="tabpanel">${cuerpo}</div>`;
  el.hidden = false;
}

let pendiente = false;
function render() {
  if (pendiente || !visible()) return;
  pendiente = true;
  requestAnimationFrame(() => {
    pendiente = false;
    if (!st().datos || !visible()) return;
    renderSemana();
    renderGraficos();
  });
}

document.addEventListener("click", e => {
  const t = e.target.closest("[data-ejpg-tab]");
  if (t) { tab = t.dataset.ejpgTab; renderGraficos(); return; }
  const c = e.target.closest("[data-ejps-compartir]");
  if (c && ultimaSemana && window.EjCompartir) {
    c.disabled = true;
    c.textContent = "Preparando…";
    EjCompartir.semana(ultimaSemana.s, ultimaSemana.carga, ultimaSemana.hoy)
      .then(r => { c.textContent = r === "descargado" ? "Imagen descargada" : "Compartir mi semana"; })
      .catch(() => { c.textContent = "No se pudo"; })
      .then(() => { c.disabled = false; });
  }
});
document.addEventListener("change", e => {
  if (e.target.matches && e.target.matches("[data-ejpg-ej]")) { ejercicio = e.target.value; renderGraficos(); }
});
EjercicioDatos.onCambio(render);
["hashchange", "rutinas:cambio", "ejercicio:ajustes"].forEach(ev => (ev === "hashchange" ? window : document).addEventListener(ev, render));
window.EjGraficos = { render };
})();
