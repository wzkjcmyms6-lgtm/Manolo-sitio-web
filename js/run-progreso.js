// ---------- Running › Progreso (fase 4) ----------
// Arriba: totales de la semana, el mes, el año o todo, contra el período
// anterior; después el resumen semanal de siempre (D-035, lo dibuja
// js/actividad-registro.js en #running-dash) y, abajo: racha y metas con
// anillos, el diario (calendario con círculos según los km), mejores marcas
// (top 3 y su evolución), predicciones, forma y fatiga y zapatillas.
// Cálculos en js/run-analisis.js; datos de js/run-datos.js.
(function () {
"use strict";
const V = window.RunVista, A = window.RunAnalisis, M = window.RunMetricas;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PERIODOS = [["semana", "Semana", "la semana pasada"], ["mes", "Mes", "el mes pasado"], ["anio", "Año", "el año pasado"], ["total", "Total", ""]];
const DIAS_CAB = ["L", "M", "M", "J", "V", "S", "D"];
let periodo = "semana", mes = null, marca = null;

const hoy = () => M.fechaLocal(Date.now());
const visible = () => location.hash.replace(/^#/, "").split("/")[0] === "run-progreso";

function pintar() {
  if (!visible()) return;
  const arriba = document.getElementById("rp-arriba"), app = document.getElementById("rp-app");
  if (!arriba || !app) return;
  if (!RunDatos.cargada("running")) { arriba.innerHTML = `<p class="rd-nota">Cargando…</p>`; app.innerHTML = ""; return; }
  const docs = RunDatos.lista("running");
  arriba.innerHTML = totales(docs);
  app.innerHTML = [rachaYMetas(docs), diario(docs), marcas(docs), predicciones(docs), forma(docs), zapatillas(docs)].join("");
  renderIcons(app);
}

// ---- Totales ----
function delta(act, prev, txtPrev, fmt) {
  if (!prev) return "";
  const d = act - prev;
  if (Math.abs(d) < 1e-9) return `<small class="rp-delta">Igual que ${txtPrev}</small>`;
  return `<small class="rp-delta ${d > 0 ? "is-mas" : "is-menos"}">${d > 0 ? "▲" : "▼"} ${fmt(Math.abs(d))} vs ${txtPrev}</small>`;
}
function totales(docs) {
  const [, , txtPrev] = PERIODOS.find(p => p[0] === periodo);
  const t = A.periodo(docs, periodo, hoy());
  const p = t.previo;
  const nombre = { semana: "Esta semana", mes: "Este mes", anio: "Este año", total: "Desde que registras" }[periodo];
  return `<div class="fin-tabs rp-periodos" role="tablist">${PERIODOS.map(([k, n]) => `<button type="button" role="tab" class="fin-tab${k === periodo ? " active" : ""}" aria-selected="${k === periodo}" data-rp-periodo="${k}">${n}</button>`).join("")}</div>
    <div class="rp-total">
      <p class="rp-total-t">${nombre}</p>
      <p class="rp-total-km"><b>${V.numero(t.km, t.km >= 100 ? 0 : 1)}</b> km</p>
      ${delta(t.km, p && p.km, txtPrev, x => `${V.numero(x, 1)} km`)}
      <div class="rp-total-mas">
        <div><span>Tiempo</span><b>${V.duracion(t.seg)}</b></div>
        <div><span>Carreras</span><b>${t.n}</b></div>
        <div><span>Desnivel</span><b>${V.metros(t.desnivel)}</b></div>
      </div>
    </div>`;
}

// ---- Racha y metas ----
function anillo(pct) {
  const r = 26, c = 2 * Math.PI * r;
  return `<svg class="rp-anillo" viewBox="0 0 64 64" aria-hidden="true"><circle class="rp-anillo-fondo" cx="32" cy="32" r="${r}"/><circle class="rp-anillo-valor" cx="32" cy="32" r="${r}" stroke-dasharray="${(c * pct).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/></svg>`;
}
function rachaYMetas(docs) {
  const r = A.racha(docs, hoy());
  const ms = A.metas(docs, hoy(), RunDatos.ajustes().metas || {});
  return `<section class="rd-sec rp-sec">
    <div class="rp-racha"><span class="rp-racha-n">🔥 ${r.semanas}</span><span><b>${r.semanas === 1 ? "semana seguida" : "semanas seguidas"}</b><small>${r.semanas && !r.estaSemana ? "Corre esta semana para seguir la racha." : r.semanas ? "Con al menos una carrera por semana." : "Corre esta semana para empezar una racha."}</small></span></div>
    ${ms.length ? `<div class="rp-metas">${ms.map(m => `<div class="rp-meta">${anillo(m.pct)}<span><b>${V.numero(m.km, m.km >= 100 ? 0 : 1)}</b>/${V.numero(m.meta)} km</span><small>${m.nombre}${m.pct >= 1 ? " ✓" : ""}</small></div>`).join("")}</div>`
      : `<a class="rp-cta" href="#run-ajustes">Ponte una meta de km por semana, mes o año →</a>`}
  </section>`;
}

// ---- Diario (calendario) ----
function diario(docs) {
  const m = mes || hoy().slice(0, 7);
  const cal = A.calendario(docs, m);
  const [anio, nm] = m.split("-").map(Number);
  const total = cal.dias.reduce((s, d) => s + d.km, 0);
  const celdas = [];
  for (let i = 0; i < cal.inicioSemana; i++) celdas.push(`<span class="rp-dia is-vacio"></span>`);
  cal.dias.forEach(d => {
    const n = Number(d.fecha.slice(8, 10));
    const tam = d.km > 0 ? Math.round(14 + 22 * Math.sqrt(d.km / Math.max(cal.max, 1))) : 0;
    const contenido = d.km > 0 ? `<i style="width:${tam}px;height:${tam}px"></i>` : "";
    const esHoy = d.fecha === hoy() ? " is-hoy" : "";
    celdas.push(d.ids.length
      ? `<a class="rp-dia is-con${esHoy}" href="#run-actividad/running/${encodeURIComponent(d.ids[0])}" aria-label="${n}: ${V.numero(d.km, 1)} km">${contenido}<span>${n}</span></a>`
      : `<span class="rp-dia${esHoy}">${contenido}<span>${n}</span></span>`);
  });
  const ant = new Date(anio, nm - 2, 1), sig = new Date(anio, nm, 1);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const futuro = iso(sig) > hoy().slice(0, 7);
  return `<section class="rd-sec rp-sec">
    <div class="rp-sec-cab"><h2>Diario</h2><small>${V.numero(total, 1)} km</small></div>
    <div class="rp-mes-nav"><button type="button" data-rp-mes="${iso(ant)}" aria-label="Mes anterior">‹</button><b>${V.MESES_LARGOS[nm - 1].replace(/^./, c => c.toUpperCase())} de ${anio}</b><button type="button" data-rp-mes="${iso(sig)}" aria-label="Mes siguiente"${futuro ? " disabled" : ""}>›</button></div>
    <div class="rp-cal">${DIAS_CAB.map(d => `<span class="rp-cal-cab">${d}</span>`).join("")}${celdas.join("")}</div>
  </section>`;
}

// ---- Mejores marcas ----
function marcas(docs) {
  const filas = M.DISTANCIAS.map(([, clave, nombre]) => ({ clave, nombre, top: A.topMarcas(docs, clave, 3) })).filter(f => f.top.length);
  if (!filas.length) return `<section class="rd-sec rp-sec"><h2>Mejores marcas</h2><p class="rd-nota">Aparecen al importar carreras con ruta o con el reloj.</p></section>`;
  if (!marca || !filas.some(f => f.clave === marca)) marca = (filas.find(f => f.clave === "5000") || filas[0]).clave;
  const sel = filas.find(f => f.clave === marca);
  const evo = A.evolucion(docs, marca);
  return `<section class="rd-sec rp-sec">
    <h2>Mejores marcas</h2>
    <ul class="rp-marcas">${filas.map(f => `<li><button type="button" class="rp-marca${f.clave === marca ? " is-sel" : ""}" data-rp-marca="${f.clave}" aria-pressed="${f.clave === marca}"><span>${esc(f.nombre)}</span><b>${V.tiempo(f.top[0].t)}</b><small>${V.fechaActividad(f.top[0])}</small></button></li>`).join("")}</ul>
    <div class="rp-marca-sel">
      <h3>${esc(sel.nombre)}: tus 3 mejores</h3>
      <ol class="rp-top">${sel.top.map((e, i) => `<li><span>${A.MEDALLA[i + 1]}</span><a href="#run-actividad/running/${encodeURIComponent(e.id)}">${esc(e.titulo || V.fechaActividad(e))}</a><b>${V.tiempo(e.t)}</b><small>${V.fechaActividad(e)}</small></li>`).join("")}</ol>
      ${evo.length > 1 ? `<p class="rd-nota">Cómo fue mejorando</p>${svgEvolucion(evo)}` : ""}
    </div>
  </section>`;
}
function svgEvolucion(evo) {
  const W = 340, H = 140, m = { i: 8, d: 52, a: 10, b: 20 };
  const t0 = evo[0].inicio, t1 = evo[evo.length - 1].inicio;
  const ys = evo.map(e => e.t);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const pad = Math.max(5, (yMax - yMin) * 0.12);
  const x = t => m.i + (t1 > t0 ? (t - t0) / (t1 - t0) : 0.5) * (W - m.i - m.d);
  const y = v => m.a + (1 - (yMax + pad - v) / (yMax - yMin + 2 * pad)) * (H - m.a - m.b); // más rápido arriba
  let escalon = "";
  evo.forEach((e, i) => { escalon += i ? ` L${x(e.inicio).toFixed(1)},${y(evo[i - 1].mejor).toFixed(1)} L${x(e.inicio).toFixed(1)},${y(e.mejor).toFixed(1)}` : `M${x(e.inicio).toFixed(1)},${y(e.mejor).toFixed(1)}`; });
  escalon += ` L${(W - m.d).toFixed(1)},${y(evo[evo.length - 1].mejor).toFixed(1)}`;
  const puntos = evo.map(e => `<circle cx="${x(e.inicio).toFixed(1)}" cy="${y(e.t).toFixed(1)}" r="3" class="${e.t === e.mejor ? "rp-pr" : ""}"/>`).join("");
  const fecha = ms => { const d = new Date(ms); return `${V.MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`; };
  return `<svg class="rp-evo" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Evolución de la marca">
    <path class="rp-evo-linea" d="${escalon}"/>${puntos}
    <text class="rg-eje" x="${W - 4}" y="${(y(yMin) + 4).toFixed(1)}" text-anchor="end">${V.tiempo(yMin)}</text>
    <text class="rg-eje" x="${W - 4}" y="${(y(yMax) + 4).toFixed(1)}" text-anchor="end">${V.tiempo(yMax)}</text>
    <text class="rg-eje" x="${m.i}" y="${H - 4}">${fecha(t0)}</text><text class="rg-eje" x="${W - m.d}" y="${H - 4}" text-anchor="end">${fecha(t1)}</text></svg>`;
}

// ---- Predicciones ----
function predicciones(docs) {
  const ps = A.predicciones(docs, hoy());
  return `<section class="rd-sec rp-sec">
    <h2>Predicciones</h2>
    <div class="rp-pred">${ps.map(p => `<div><span>${esc(p.nombre)}</span>${p.t ? `<b>${V.tiempo(p.t)}</b><small>${V.ritmo(p.t / (p.m / 1000))}</small>` : `<b class="rp-falta">—</b><small>Faltan datos</small>`}</div>`).join("")}</div>
    <p class="rd-nota">Según tus mejores marcas de las últimas 12 semanas (fórmula de Riegel). Es una estimación, no una promesa.</p>
  </section>`;
}

// ---- Forma y fatiga ----
function forma(docs) {
  const serie = A.formaFatiga(docs, hoy(), 90);
  const ult = serie[serie.length - 1];
  if (!serie.some(x => x.carga > 0)) return `<section class="rd-sec rp-sec"><h2>Forma y fatiga</h2><p class="rd-nota">Aparece cuando tus carreras tienen carga (con FC, con ruta o con el esfuerzo percibido).</p></section>`;
  const W = 340, H = 150, m = { i: 6, d: 34, a: 10, b: 18 };
  const max = Math.max(10, ...serie.map(s => Math.max(s.estado, s.fatiga)));
  const minF = Math.min(0, ...serie.map(s => s.forma));
  const top = max, bot = minF;
  const x = i => m.i + (i / (serie.length - 1)) * (W - m.i - m.d);
  const y = v => m.a + (top - v) / (top - bot) * (H - m.a - m.b);
  const linea = k => serie.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s[k]).toFixed(1)}`).join(" ");
  const ancho = Math.max(1, (W - m.i - m.d) / serie.length - 0.6);
  const barras = serie.map((s, i) => s.forma ? `<rect class="${s.forma >= 0 ? "rp-ff-pos" : "rp-ff-neg"}" x="${(x(i) - ancho / 2).toFixed(1)}" y="${Math.min(y(0), y(s.forma)).toFixed(1)}" width="${ancho.toFixed(1)}" height="${Math.abs(y(s.forma) - y(0)).toFixed(1)}"/>` : "").join("");
  return `<section class="rd-sec rp-sec">
    <h2>Forma y fatiga</h2>
    <div class="rp-ff-cifras">
      <div><span><i class="rp-ff-k rp-k-estado"></i>Estado físico</span><b>${Math.round(ult.estado)}</b></div>
      <div><span><i class="rp-ff-k rp-k-fatiga"></i>Fatiga</span><b>${Math.round(ult.fatiga)}</b></div>
      <div><span><i class="rp-ff-k rp-k-forma"></i>Forma</span><b>${ult.forma > 0 ? "+" : ""}${Math.round(ult.forma)}</b></div>
    </div>
    <svg class="rp-ff" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Forma y fatiga de los últimos 90 días">
      ${barras}<line class="rg-base" x1="${m.i}" x2="${W - m.d}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>
      <path class="rp-ff-estado" d="${linea("estado")}"/><path class="rp-ff-fatiga" d="${linea("fatiga")}"/>
      <text class="rg-eje" x="${W - 2}" y="${(y(max) + 4).toFixed(1)}" text-anchor="end">${Math.round(max)}</text>
      <text class="rg-eje" x="${m.i}" y="${H - 3}">hace 90 días</text><text class="rg-eje" x="${W - m.d}" y="${H - 3}" text-anchor="end">hoy</text>
    </svg>
    <p class="rp-ff-texto">${esc(A.textoForma(ult.forma, ult.estado))}</p>
    <p class="rd-nota">Estado físico: tu carga de las últimas ~6 semanas. Fatiga: la de la última semana. Forma = estado − fatiga.</p>
  </section>`;
}

// ---- Zapatillas ----
function zapatillas(docs) {
  const zs = A.zapatillas(docs, RunDatos.ajustes().zapatillas || []).filter(z => !z.retirada);
  if (!zs.length) return `<section class="rd-sec rp-sec"><h2>Zapatillas</h2><a class="rp-cta" href="#run-ajustes">Agrega tus zapatillas para saber cuántos km llevan →</a></section>`;
  const est = { ok: "", pronto: "Pronto para cambiar", cambiar: "Ya pasaron su límite" };
  return `<section class="rd-sec rp-sec">
    <div class="rp-sec-cab"><h2>Zapatillas</h2><a href="#run-ajustes">Administrar</a></div>
    <ul class="rp-zaps">${zs.map(z => `<li class="rp-zap is-${z.estado}"><div class="rp-zap-cab"><b>${esc(z.nombre)}${z.predeterminada ? " <small>predeterminada</small>" : ""}</b><span>${V.numero(z.km, 0)} / ${V.numero(z.limite)} km</span></div>
      <div class="rp-zap-barra"><i style="width:${Math.round(z.pct * 100)}%"></i></div>${est[z.estado] ? `<small class="rp-zap-aviso">${est[z.estado]}</small>` : ""}</li>`).join("")}</ul>
  </section>`;
}

document.addEventListener("click", e => {
  if (!e.target.closest("#panel-run-progreso")) return;
  const p = e.target.closest("[data-rp-periodo]");
  if (p) { periodo = p.dataset.rpPeriodo; pintar(); return; }
  const m = e.target.closest("[data-rp-mes]");
  if (m && !m.disabled) { mes = m.dataset.rpMes; pintar(); return; }
  const k = e.target.closest("[data-rp-marca]");
  if (k) { marca = k.dataset.rpMarca; pintar(); }
});
if (window.RunDatos) RunDatos.al(pintar);
window.addEventListener("hashchange", pintar);
document.addEventListener("DOMContentLoaded", pintar);
})();
