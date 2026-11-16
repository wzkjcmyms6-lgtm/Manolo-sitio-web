// ---------- Bici › Progreso (D-142) ----------
// Como Running › Progreso (js/run-progreso.js), con lo propio de bici:
// arriba los totales de la semana, el mes, el año o todo (km, tiempo,
// rodadas, desnivel y velocidad media) contra el período anterior; después
// el resumen semanal de siempre (#cycling-dash, js/actividad-registro.js) y,
// abajo: racha y metas con anillos, el diario (calendario), tus récords (la
// más larga, la de más desnivel, la más rápida, la velocidad máxima y los
// mejores tiempos de 5 a 160 km con su evolución), el número de Eddington,
// forma y fatiga y el mapa de calor. Los récords por distancia de las
// rodadas importadas antes se calculan una vez con su ruta y se guardan
// (`mejoresBici`): después no se vuelve a bajar nada.
(function () {
"use strict";
const V = window.RunVista, A = window.RunAnalisis, M = window.RunMetricas, B = window.BiciAnalisis;
if (!V || !A || !M || !B || !window.RunDatos) return;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PERIODOS = [["semana", "Semana", "la semana pasada"], ["mes", "Mes", "el mes pasado"], ["anio", "Año", "el año pasado"], ["total", "Total", ""]];
const DIAS_CAB = ["L", "M", "M", "J", "V", "S", "D"];
let periodo = "semana", mes = null, marca = null;

const hoy = () => M.fechaLocal(Date.now());
const visible = () => location.hash.replace(/^#/, "").split("/")[0] === "bici-progreso";
const ir = id => `#run-actividad/bicicleta/${encodeURIComponent(id)}`;
const kmh = v => `${V.numero(v, 1)} km/h`;

function pintar() {
  if (!visible()) return;
  const arriba = document.getElementById("bp-arriba"), app = document.getElementById("bp-app");
  if (!arriba || !app) return;
  if (!RunDatos.cargada("bicicleta")) { arriba.innerHTML = `<p class="rd-nota">Cargando…</p>`; app.innerHTML = ""; return; }
  const docs = RunDatos.lista("bicicleta");
  arriba.innerHTML = totales(docs);
  app.innerHTML = [rachaYMetas(docs), diario(docs), records(docs), eddington(docs), forma(docs), window.RunCalor ? RunCalor.tarjeta("bicicleta") : ""].join("");
  if (typeof renderIcons === "function") renderIcons(app);
  completar();
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
  const vel = t.seg > 0 ? t.km / (t.seg / 3600) : 0;
  return `<div class="fin-tabs rp-periodos" role="tablist">${PERIODOS.map(([k, n]) => `<button type="button" role="tab" class="fin-tab${k === periodo ? " active" : ""}" aria-selected="${k === periodo}" data-bp-periodo="${k}">${n}</button>`).join("")}</div>
    <div class="rp-total">
      <p class="rp-total-t">${nombre}</p>
      <p class="rp-total-km"><b>${V.numero(t.km, t.km >= 100 ? 0 : 1)}</b> km</p>
      ${delta(t.km, p && p.km, txtPrev, x => `${V.numero(x, 1)} km`)}
      <div class="rp-total-mas bp-total-mas">
        <div><span>Tiempo</span><b>${V.duracion(t.seg)}</b></div>
        <div><span>Rodadas</span><b>${t.n}</b></div>
        <div><span>Desnivel</span><b>${V.metros(t.desnivel)}</b></div>
        <div><span>Velocidad</span><b>${vel > 0 ? kmh(vel) : "—"}</b></div>
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
  const ms = A.metas(docs, hoy(), RunDatos.ajustesBici().metas || {});
  return `<section class="rd-sec rp-sec">
    <div class="rp-racha"><span class="rp-racha-n">🔥 ${r.semanas}</span><span><b>${r.semanas === 1 ? "semana seguida" : "semanas seguidas"}</b><small>${r.semanas && !r.estaSemana ? "Sal en bici esta semana para seguir la racha." : r.semanas ? "Con al menos una rodada por semana." : "Sal en bici esta semana para empezar una racha."}</small></span></div>
    ${ms.length ? `<div class="rp-metas">${ms.map(m => `<div class="rp-meta">${anillo(m.pct)}<span><b>${V.numero(m.km, m.km >= 100 ? 0 : 1)}</b>/${V.numero(m.meta)} km</span><small>${m.nombre}${m.pct >= 1 ? " ✓" : ""}</small></div>`).join("")}</div>`
      : `<a class="rp-cta" href="#bici-ajustes">Ponte una meta de km por semana, mes o año →</a>`}
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
      ? `<a class="rp-dia is-con${esHoy}" href="${ir(d.ids[0])}" aria-label="${n}: ${V.numero(d.km, 1)} km">${contenido}<span>${n}</span></a>`
      : `<span class="rp-dia${esHoy}">${contenido}<span>${n}</span></span>`);
  });
  const ant = new Date(anio, nm - 2, 1), sig = new Date(anio, nm, 1);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const futuro = iso(sig) > hoy().slice(0, 7);
  return `<section class="rd-sec rp-sec">
    <div class="rp-sec-cab"><h2>Diario</h2><small>${V.numero(total, 1)} km</small></div>
    <div class="rp-mes-nav"><button type="button" data-bp-mes="${iso(ant)}" aria-label="Mes anterior">‹</button><b>${V.MESES_LARGOS[nm - 1].replace(/^./, c => c.toUpperCase())} de ${anio}</b><button type="button" data-bp-mes="${iso(sig)}" aria-label="Mes siguiente"${futuro ? " disabled" : ""}>›</button></div>
    <div class="rp-cal">${DIAS_CAB.map(d => `<span class="rp-cal-cab">${d}</span>`).join("")}${celdas.join("")}</div>
  </section>`;
}

// ---- Récords ----
function records(docs) {
  const r = B.records(docs);
  const caja = (x, nombre, valor, nota) => x ? `<a class="bp-record" href="${ir(x.doc.id)}"><span>${nombre}</span><b>${valor}</b><small>${esc(nota ? `${nota} · ` : "")}${esc(V.fechaActividad(x.doc))}</small></a>` : "";
  const sueltos = [
    caja(r.larga, "La más larga", V.km(r.larga && r.larga.valor, 1)),
    caja(r.subida, "Más desnivel", V.metros(r.subida && r.subida.valor)),
    caja(r.rapida, "La más rápida", r.rapida ? kmh(r.rapida.valor) : "", r.rapida ? `${V.km(B.distM(r.rapida.doc), 1)}` : ""),
    caja(r.vmax, "Velocidad máxima", r.vmax ? kmh(r.vmax.valor) : "")
  ].join("");
  const filas = B.mejoresTiempos(docs, 3);
  const pendientes = B.sinRecords(docs).length;
  let tiempos;
  if (!filas.length) tiempos = `<p class="rd-nota">${pendientes ? `Calculando tus mejores tiempos con las rutas de tus rodadas (${pendientes} por revisar)…` : "Tus mejores tiempos de 5 a 160 km aparecen al importar rodadas con ruta (del reloj o de Strava)."}</p>`;
  else {
    if (!marca || !filas.some(f => f.clave === marca)) marca = (filas.find(f => f.clave === "20000") || filas[0]).clave;
    const sel = filas.find(f => f.clave === marca);
    const evo = B.evolucion(docs, marca);
    tiempos = `<ul class="rp-marcas">${filas.map(f => `<li><button type="button" class="rp-marca${f.clave === marca ? " is-sel" : ""}" data-bp-marca="${f.clave}" aria-pressed="${f.clave === marca}"><span>${esc(f.nombre)}</span><b>${V.tiempo(f.top[0].t)}</b><small>${kmh(f.top[0].kmh)}</small></button></li>`).join("")}</ul>
      <div class="rp-marca-sel">
        <h3>${esc(sel.nombre)}: tus 3 mejores</h3>
        <ol class="rp-top">${sel.top.map((e, i) => `<li><span>${A.MEDALLA[i + 1]}</span><a href="${ir(e.id)}">${esc(e.titulo || V.fechaActividad(e))}</a><b>${V.tiempo(e.t)}</b><small>${kmh(e.kmh)} · ${V.fechaActividad(e)}</small></li>`).join("")}</ol>
        ${evo.length > 1 ? `<p class="rd-nota">Cómo fue mejorando</p>${svgEvolucion(evo)}` : ""}
      </div>
      ${pendientes ? `<p class="rd-nota" data-bp-pendientes>Revisando las rutas de ${pendientes} ${pendientes === 1 ? "rodada" : "rodadas"} más…</p>` : ""}`;
  }
  if (!sueltos && !filas.length && !pendientes) return `<section class="rd-sec rp-sec"><h2>Tus récords</h2><p class="rd-nota">Aparecen con tus primeras rodadas.</p></section>`;
  return `<section class="rd-sec rp-sec">
    <h2>Tus récords</h2>
    ${sueltos ? `<div class="bp-records">${sueltos}</div>` : ""}
    <h3 class="bp-sub">Mejores tiempos</h3>
    ${tiempos}
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
  return `<svg class="rp-evo" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Evolución del tiempo">
    <path class="rp-evo-linea" d="${escalon}"/>${puntos}
    <text class="rg-eje" x="${W - 4}" y="${(y(yMin) + 4).toFixed(1)}" text-anchor="end">${V.tiempo(yMin)}</text>
    <text class="rg-eje" x="${W - 4}" y="${(y(yMax) + 4).toFixed(1)}" text-anchor="end">${V.tiempo(yMax)}</text>
    <text class="rg-eje" x="${m.i}" y="${H - 4}">${fecha(t0)}</text><text class="rg-eje" x="${W - m.d}" y="${H - 4}" text-anchor="end">${fecha(t1)}</text></svg>`;
}

// ---- Número de Eddington ----
function eddington(docs) {
  const e = B.eddington(docs);
  if (!e.dias) return "";
  return `<section class="rd-sec rp-sec bp-edd">
    <div class="rp-sec-cab"><h2>Número de Eddington</h2></div>
    <div class="bp-edd-caja"><b>${e.e}</b><span>${e.e ? `Saliste ${V.numero(e.e)} ${e.e === 1 ? "día" : "días"} con al menos ${V.numero(e.e)} km.` : "Todavía no tienes un día de al menos 1 km."}</span></div>
    <p class="rd-nota">Para llegar a ${e.siguiente}: ${e.faltan === 1 ? "te falta 1 día" : `te faltan ${e.faltan} días`} de ${e.siguiente} km o más (llevas ${e.tienen}). Cuenta lo que hiciste en bici cada día.</p>
  </section>`;
}

// ---- Forma y fatiga (la misma cuenta que Running, con tus rodadas) ----
function forma(docs) {
  const serie = A.formaFatiga(docs, hoy(), 90);
  const ult = serie[serie.length - 1];
  if (!serie.some(x => x.carga > 0)) return `<section class="rd-sec rp-sec"><h2>Forma y fatiga</h2><p class="rd-nota">Aparece cuando tus rodadas tienen carga (con FC o con el esfuerzo percibido).</p></section>`;
  const W = 340, H = 150, m = { i: 6, d: 34, a: 10, b: 18 };
  const max = Math.max(10, ...serie.map(s => Math.max(s.estado, s.fatiga)));
  const minF = Math.min(0, ...serie.map(s => s.forma));
  const x = i => m.i + (i / (serie.length - 1)) * (W - m.i - m.d);
  const y = v => m.a + (max - v) / (max - minF) * (H - m.a - m.b);
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
    <p class="rd-nota">Estado físico: tu carga de las últimas ~6 semanas. Fatiga: la de la última semana. Forma = estado − fatiga. Solo cuenta lo que hiciste en bici.</p>
  </section>`;
}

// ---- Completar los récords de las rodadas importadas antes ----
// Una a la vez, con Bici a la vista: lee su ruta (rutas/{id}), calcula los
// mejores tiempos y los guarda en la rodada (`mejoresBici`, {} si no
// alcanza). Así cada ruta se lee una sola vez en la vida.
let trabajando = false;
const hechos = new Set();
async function completar() {
  if (trabajando || typeof db === "undefined" || typeof currentUser === "undefined" || !currentUser || !RunDatos.cargada("bicicleta")) return;
  trabajando = true;
  try {
    const u = db.collection("users").doc(currentUser.uid);
    for (let k = 0; k < 400; k++) {
      if (!/^(bicicleta|bici-)/.test(location.hash.replace(/^#/, ""))) break;
      const d = B.sinRecords(RunDatos.lista("bicicleta")).find(x => !hechos.has(x.id));
      if (!d) break;
      hechos.add(d.id);
      const s = await u.collection("rutas").doc(d.id).get();
      const mb = s.exists ? B.mejoresDeRuta(s.data()) : {};
      await u.collection("bicicleta").doc(d.id).update({ mejoresBici: mb });
    }
  } catch (e) { console.warn("Bici: récords", e); }
  trabajando = false;
}

document.addEventListener("click", e => {
  if (!e.target.closest("#panel-bici-progreso")) return;
  const p = e.target.closest("[data-bp-periodo]");
  if (p) { periodo = p.dataset.bpPeriodo; pintar(); return; }
  const m = e.target.closest("[data-bp-mes]");
  if (m && !m.disabled) { mes = m.dataset.bpMes; pintar(); return; }
  const k = e.target.closest("[data-bp-marca]");
  if (k) { marca = k.dataset.bpMarca; pintar(); }
});
// Con Bici a la vista (Actividades, Progreso…), se completan los récords que falten.
const enBici = () => /^#(bicicleta|bici-)/.test(location.hash);
RunDatos.al(() => { pintar(); if (enBici()) completar(); });
window.addEventListener("hashchange", () => { pintar(); if (enBici()) completar(); });
document.addEventListener("DOMContentLoaded", pintar);
window.BiciProgreso = { pintar, completar };
})();
