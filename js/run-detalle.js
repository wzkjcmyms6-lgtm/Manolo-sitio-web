// ---------- Running: detalle de una actividad (#run-actividad/{col}/{id}) ----------
// Mapa con inicio y fin, cifras, logros, perfil de ritmo/FC/altura con cursor
// unido al mapa (y los intervalos de la rutina sombreados), parciales con
// barras, vueltas, zonas de FC, clima, zapatillas, RPE y notas. Menú ⋯:
// editar, exportar GPX, corregir desnivel y eliminar (también su ruta).
// Sirve para cualquier actividad: a mano, rutina, GPS viejo o importada.
(function () {
"use strict";
const V = window.RunVista, Gr = window.RunGraficos, M = window.RunMetricas, A = window.RunAnalisis, E = window.RunEnriquecer;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const usuario = () => db.collection("users").doc(currentUser.uid);
const ANCHO = 340, ALTO = 170;
const TIPOS = [["", "Carrera"], ["competencia", "Competencia"], ["fondo", "Fondo largo"], ["series", "Entrenamiento (series)"], ["trail", "Trail"], ["cinta", "Cinta"], ["pista", "Pista"]];
const TIPOS_BICI = [["", "Rodada"], ["competencia", "Competencia"], ["cinta", "Rodillo"], ["virtual", "Virtual"]];
const nombreTipo = (v, bici) => ((bici ? TIPOS_BICI : TIPOS).find(t => t[0] === v) || [, v])[1];
const ORIGEN = { fit: "un archivo FIT", gpx: "un archivo GPX", tcx: "un archivo TCX", csv: "el resumen del export" };
const APP = { strava: "Strava", apple: "Apple Salud" };

let actual = null;               // { col, id, doc, tramos, rutaDoc, serie, mapa, quitar, modo, bandas }
const rutas = new Map();         // id → { tramos, rutaDoc } (las últimas 3)

function param() {
  const p = location.hash.replace(/^#/, "").split("/");
  if (p[0] !== "run-actividad") return null;
  return { col: p[1] === "bicicleta" ? "bicicleta" : "running", id: decodeURIComponent(p.slice(2).join("/")) };
}
const app = () => document.getElementById("rd-app");

function abrirDesdeHash() {
  const p = param();
  if (!p || !p.id) { cerrar(); return; }
  if (actual && actual.col === p.col && actual.id === p.id) return;
  cerrar();
  actual = { col: p.col, id: p.id, modo: p.col === "bicicleta" ? "vel" : "ritmo", bandas: [] };
  const volver = document.querySelector("#panel-run-actividad .back-link");
  if (volver) { volver.href = p.col === "bicicleta" ? "#bicicleta" : "#running"; volver.lastChild.textContent = p.col === "bicicleta" ? "Bicicleta" : "Running"; }
  app().innerHTML = `<p class="rd-nota">Cargando…</p>`;
  onAuthReady(() => {
    if (!actual || actual.id !== p.id) return;
    const yo = actual;
    yo.quitar = usuario().collection(p.col).doc(p.id).onSnapshot(s => {
      if (actual !== yo) return;
      if (!s.exists) { app().innerHTML = `<p class="rd-nota">Esta actividad ya no existe.</p>`; return; }
      yo.doc = Object.assign({ id: s.id }, s.data());
      pintar();
      cargarRuta();
    }, () => { if (actual === yo) app().innerHTML = `<p class="rd-nota">No se pudo abrir la actividad.</p>`; });
  });
}
function cerrar() {
  if (!actual) return;
  if (actual.quitar) actual.quitar();
  if (actual.mapa) actual.mapa.destruir();
  document.body.classList.remove("rd-mapa-abierto");
  actual = null;
}
const tieneRuta = d => !!(d.conRuta || d.fuente === "importado" || d.conImportado);

function cargarRuta() {
  const yo = actual;
  if (!tieneRuta(yo.doc)) return;
  if (yo.tramos) { pintarRuta(); return; }
  const listo = r => {
    if (actual !== yo) return;
    yo.tramos = r.tramos; yo.rutaDoc = r.rutaDoc;
    yo.serie = Gr.serie(r.tramos, yo.col);
    pintarRuta();
    sombrearRutina();
  };
  if (rutas.has(yo.id)) return listo(rutas.get(yo.id));
  usuario().collection("rutas").doc(yo.id).get().then(s => {
    if (!s.exists) return;
    const r = { rutaDoc: s.data(), tramos: M.leerRuta(s.data()) };
    rutas.set(yo.id, r);
    if (rutas.size > 3) rutas.delete(rutas.keys().next().value);
    listo(r);
  }).catch(() => {});
}

// ---- Pantalla ----
function pintar() {
  const d = actual.doc, bici = actual.col === "bicicleta";
  const b = V.basicos(d);
  const titulo = d.titulo || (d.rutina ? d.rutina.nombre : M.tituloAuto(bici ? "bicicleta" : "running", d.inicio || Date.parse(`${d.date}T12:00:00`)));
  const clima = d.clima ? `${E.textoClima(d.clima.cod)}${E.textoClima(d.clima.cod) ? ", " : ""}${V.numero(d.clima.tC, 0)} °C` : "";
  const meta = [V.fechaActividad(d, true), d.lugar, clima].filter(Boolean).map(esc).join(" · ");
  const desn = d.desnivelCorr ? d.desnivelCorr.pos : d.desnivelPosM;
  const st = (et, val, nota) => `<div class="rd-stat"><span>${et}</span><b>${val}</b>${nota ? `<small>${nota}</small>` : ""}</div>`;
  const stats = [
    st("Distancia", b.distM > 0 ? V.km(b.distM) : "—"),
    bici ? st("Velocidad media", V.velocidad(b.movS, b.distM)) : st("Ritmo", V.ritmo(b.ritmoS)),
    st(d.tiempoMovS ? "En movimiento" : "Tiempo", V.tiempo(b.movS)),
    desn != null ? st("Desnivel", V.metros(desn), d.desnivelCorr ? `corregido · reloj ${V.metros(d.desnivelPosM)}` : "") : "",
    b.totalS - b.movS > 5 ? st("Tiempo total", V.tiempo(b.totalS), "con pausas") : "",
    d.gapS && !bici ? st("Ritmo ajustado", V.ritmo(d.gapS), "por pendiente") : "",
    d.velMaxKmh && bici ? st("Vel. máxima", `${V.numero(d.velMaxKmh, 1)} km/h`) : "",
    d.kcal ? st("Calorías", `${V.numero(d.kcal)} kcal`) : "",
    d.fcMedia ? st("FC media", `${d.fcMedia} lpm`) : "",
    d.fcMax ? st("FC máxima", `${d.fcMax} lpm`) : "",
    d.cadMedia ? st("Cadencia", `${d.cadMedia} ${bici ? "rpm" : "ppm"}`) : "",
    d.carga ? st("Carga", d.carga.v, d.carga.m === "trimp" ? "por FC" : d.carga.m === "rtss" ? "por ritmo" : "por RPE") : ""
  ].join("");
  const logros = bici ? [] : A.logros(d, window.RunDatos ? RunDatos.lista("running") : []);
  const zap = d.zapatillaId && ((RunDatos.ajustes().zapatillas || []).find(z => z.id === d.zapatillaId) || null);
  const extras = [];
  if (d.subtipo) extras.push(["Tipo", esc(nombreTipo(d.subtipo, bici))]);
  if (d.rutina) extras.push(["Rutina", `${esc(d.rutina.nombre)}${d.rutina.total ? ` · ${d.rutina.completados} de ${d.rutina.total} intervalos` : ""}`]);
  if (zap) extras.push(["Zapatillas", esc(zap.nombre)]);
  if (d.rpe) extras.push(["Esfuerzo percibido", `${d.rpe}/10`]);
  if (d.clima) extras.push(["Clima", esc([E.textoClima(d.clima.cod), d.clima.tC != null ? `${V.numero(d.clima.tC, 0)} °C` : "", d.clima.sensC != null ? `sensación ${V.numero(d.clima.sensC, 0)} °C` : "", d.clima.vientoKmh != null ? `viento ${V.numero(d.clima.vientoKmh, 0)} km/h` : "", d.clima.hum != null ? `humedad ${V.numero(d.clima.hum, 0)} %` : ""].filter(Boolean).join(" · "))]);
  if (d.origen && d.origen.formato) extras.push(["Origen", esc(`Importada de ${ORIGEN[d.origen.formato] || "un archivo"}${d.origen.app && APP[d.origen.app] ? ` (${APP[d.origen.app]})` : ""}${d.origen.dispositivo ? ` · ${d.origen.dispositivo}` : ""}`)]);
  else if (d.fuente === "gps") extras.push(["Origen", "Grabada con el GPS de Manolo"]);
  if (d.previo && (d.previo.distance || d.previo.duration)) extras.push(["Antes de unir", esc(`${V.numero(d.previo.distance, 2)} km · ${V.numero(d.previo.duration, 0)} min`)]);

  app().innerHTML = `
    <div class="rd-cab">
      <h1 class="rd-titulo">${esc(titulo)}</h1>
      <div class="rd-menu">
        <button type="button" class="rd-menu-btn" aria-label="Más opciones" aria-haspopup="true" aria-expanded="false" data-rd="menu">⋯</button>
        <div class="rd-menu-lista" hidden role="menu">
          <button type="button" role="menuitem" data-rd="editar">Editar</button>
          <button type="button" role="menuitem" data-rd="compartir">Compartir imagen</button>
          ${tieneRuta(d) && d.conRuta ? `<button type="button" role="menuitem" data-rd="gpx">Exportar GPX</button>` : ""}
          ${d.conRuta && !d.desnivelCorr && !bici ? `<button type="button" role="menuitem" data-rd="desnivel">Corregir desnivel</button>` : ""}
          ${d.conRuta && !bici && window.RunSegmentosUI ? `<button type="button" role="menuitem" data-rd="segmento">Crear segmento</button>` : ""}
          <button type="button" role="menuitem" class="rd-peligro" data-rd="eliminar">Eliminar</button>
        </div>
      </div>
    </div>
    <p class="rd-meta">${meta}</p>
    ${d.conRuta || d.mini ? `<div class="rd-mapa-caja"><div class="rd-mapa" id="rd-mapa">${d.mini ? V.svgRuta([M.leerMini(d.mini)], { ancho: 340, alto: 240, clase: "run-ruta run-ruta-mapa" }) : ""}</div>
      <button type="button" class="rd-ampliar" data-rd="ampliar" aria-label="Ampliar el mapa">⤢</button></div>` : ""}
    <div class="rd-stats">${stats}</div>
    <div id="rd-ia-caja">${inteligente(d, bici)}</div>
    ${d.notes ? `<p class="rd-notas">${esc(d.notes)}</p>` : ""}
    ${logros.length ? `<section class="rd-sec"><h2>Logros</h2><ul class="rd-logros">${logros.map(l => `<li><span>${A.MEDALLA[l.puesto]}</span><b>${esc(l.nombre)}</b><i>${V.tiempo(l.t)}</i><small>${A.textoPuesto(l.puesto)}</small></li>`).join("")}</ul></section>` : ""}
    <div id="rd-rec-caja">${bici ? "" : recorrido(d)}</div>
    <div id="rd-seg-caja">${bici ? "" : segmentos(d)}</div>
    <section class="rd-sec rd-perfil-sec" id="rd-perfil" hidden></section>
    ${parciales(d, bici)}
    ${vueltas(d, bici)}
    <section class="rd-sec" id="rd-zonas" hidden></section>
    ${extras.length ? `<section class="rd-sec"><h2>Detalles</h2><dl class="rd-detalles">${extras.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl></section>` : ""}
    <p class="rd-atribucion">${d.clima ? "Clima: Open-Meteo.com · " : ""}${d.lugar || d.conRuta ? "Mapas y lugar: © OpenStreetMap" : ""}</p>
    <div class="rd-acciones">
      <button type="button" class="lib-btn rd-btn" data-rd="compartir">Compartir</button>
      <button type="button" class="lib-btn-sec rd-btn" data-rd="editar">Editar</button>
      ${d.conRuta ? `<button type="button" class="lib-btn-sec rd-btn" data-rd="gpx">Exportar GPX</button>` : ""}
      <button type="button" class="lib-btn-peligro rd-btn" data-rd="eliminar">Eliminar</button>
    </div>`;
  if (actual.mapa) { actual.mapa.destruir(); actual.mapa = null; }
  if (actual.tramos) pintarRuta();
  else pintarZonas();
}

// ---- Inteligencia por reglas (fase 5, js/run-inteligencia.js) ----
function inteligente(d, bici) {
  if (bici || !window.RunInteligencia) return "";
  const frases = RunInteligencia.resumen(d, RunDatos.lista("running"));
  if (!frases.length) return "";
  return `<section class="rd-ia" aria-label="Resumen inteligente"><h2><span aria-hidden="true">✦</span> Resumen inteligente</h2>
    <ul>${frases.map(f => `<li>${esc(f)}</li>`).join("")}</ul></section>`;
}
function recorrido(d) {
  if (!window.RunInteligencia || !d.mini) return "";
  const r = RunInteligencia.mismoRecorrido(d, RunDatos.lista("running"));
  if (!r) return "";
  const lista = r.lista.slice(0, 10);
  const max = Math.max(...r.lista.map(x => x.t)), min = Math.min(...r.lista.map(x => x.t));
  return `<section class="rd-sec rd-recorrido"><h2>Mismo recorrido <small>${r.veces} veces</small></h2>
    <p class="rd-nota">${r.puesto === 1 ? "Este fue tu mejor tiempo en este recorrido." : `Puesto ${r.puesto} de ${r.veces}; tu mejor: ${V.tiempo(r.mejor.t)} (${esc(V.fechaActividad(r.mejor))}).`}</p>
    <ul class="rd-rec-lista">${lista.map(x => `<li class="${x.esta ? "is-esta" : ""}${x.id === r.mejor.id ? " is-mejor" : ""}">
      ${x.esta ? `<span class="rd-rec-fecha">Esta carrera</span>` : `<a class="rd-rec-fecha" href="#run-actividad/running/${encodeURIComponent(x.id)}">${esc(V.fechaActividad(x))}</a>`}
      <span class="rd-rec-barra"><i style="width:${max > min ? Math.round(35 + 65 * (max - x.t) / (max - min)) : 100}%"></i></span>
      <b>${V.tiempo(x.t)}</b><small>${V.ritmo(x.ritmo, true)}</small></li>`).join("")}</ul>
    ${r.veces > lista.length ? `<p class="rd-nota">Y ${r.veces - lista.length} más.</p>` : ""}
  </section>`;
}

// Segmentos por los que pasó esta carrera (fase 6).
function segmentos(d) {
  if (!window.RunSegmentos || !window.RunDatos) return "";
  const ss = RunSegmentos.deActividad(RunDatos.segmentos(), d.id);
  if (!ss.length) return "";
  const med = { 1: "🥇", 2: "🥈", 3: "🥉" };
  return `<section class="rd-sec"><h2>Segmentos</h2><ul class="rd-segs">${ss.map(x => `<li>
    <span class="rd-seg-med">${med[x.puesto] || ""}</span>
    <a href="#run-segmento/${encodeURIComponent(x.seg.id)}">${esc(x.seg.nombre)}</a>
    <b>${V.tiempo(x.t)}</b><small>${x.puesto === 1 ? "Tu mejor" : `${x.puesto}.º de ${x.total}`} · ${V.km(x.seg.distanciaM)}</small></li>`).join("")}</ul></section>`;
}
function crearSegmento() {
  const yo = actual;
  if (!yo.tramos) return alert("Espera a que cargue la ruta.");
  RunSegmentosUI.crearDesde({
    id: yo.id, doc: yo.doc, tramos: yo.tramos, mapa: yo.mapa,
    alCambiar: (a, b) => {
      if (actual !== yo || !yo.serie) return;
      // Distancias de la ruta (GPS) llevadas a la escala del perfil.
      const k = yo.serie.total / Math.max(1, RunSegmentos.largo(RunSegmentos.tramo(yo.tramos, 0, Infinity)));
      yo.bandasSeg = [[a * k, b * k, "rg-banda-seg"]];
      pintarRuta();
    },
    alCerrar: () => { if (actual === yo) { yo.bandasSeg = null; pintarRuta(); } }
  });
}

function parciales(d, bici) {
  if (bici || !d.splits || !d.splits.length) {
    if (!bici && d.parciales && d.parciales.length) {
      const filas = Gr.barrasParciales(d.parciales.map(s => ({ d: 1000, t: s, tm: s })));
      return tablaParciales(filas, false, false);
    }
    return "";
  }
  return tablaParciales(Gr.barrasParciales(d.splits), d.splits.some(s => s.dz != null), d.splits.some(s => s.fc != null));
}
function tablaParciales(filas, conDz, conFc) {
  return `<section class="rd-sec"><h2>Parciales</h2>
    <table class="rd-tabla rd-parciales">
      <thead><tr><th>Km</th><th>Ritmo</th><th aria-hidden="true"></th>${conDz ? "<th>Desn.</th>" : ""}${conFc ? "<th>FC</th>" : ""}</tr></thead>
      <tbody>${filas.map(f => `<tr class="${f.rapido ? "is-rapido" : ""}${f.lento ? " is-lento" : ""}">
        <td>${f.completo ? f.km : V.numero(f.d / 1000, 2)}</td>
        <td>${V.ritmo(f.ritmo, true)}${f.rapido ? ' <small>más rápido</small>' : ""}</td>
        <td class="rd-barra-celda"><i style="width:${Math.round(f.ancho * 100)}%"></i></td>
        ${conDz ? `<td>${f.dz == null ? "" : f.dz > 0 ? `+${f.dz}` : f.dz < 0 ? `−${-f.dz}` : "0"}</td>` : ""}
        ${conFc ? `<td>${f.fc || ""}</td>` : ""}</tr>`).join("")}</tbody>
    </table></section>`;
}
function vueltas(d, bici) {
  if (!d.vueltas || d.vueltas.length < 2) return "";
  const conFc = d.vueltas.some(v => v.fc);
  return `<section class="rd-sec"><h2>Vueltas</h2>
    <table class="rd-tabla rd-vueltas">
      <thead><tr><th>#</th><th>Distancia</th><th>Tiempo</th><th>${bici ? "Vel." : "Ritmo"}</th>${conFc ? "<th>FC</th>" : ""}</tr></thead>
      <tbody>${d.vueltas.map((v, i) => `<tr><td>${i + 1}</td><td>${V.km(v.d)}</td><td>${V.tiempo(v.tm || v.t)}</td>
        <td>${bici ? V.velocidad(v.tm || v.t, v.d, true) : V.ritmo(V.ritmoDe(v.tm || v.t, v.d), true)}</td>${conFc ? `<td>${v.fc || ""}</td>` : ""}</tr>`).join("")}</tbody>
    </table></section>`;
}

function pintarZonas() {
  const cont = document.getElementById("rd-zonas");
  if (!cont) return;
  const aj = RunDatos.ajustes();
  const lim = M.limitesZonas(RunDatos.fcMax(), Number(aj.fcReposo) || null);
  const seg = actual.tramos ? Gr.zonasDeRuta(actual.tramos, lim) : actual.doc.zonas;
  const zs = Gr.zonas(seg, lim);
  if (!zs.length) { cont.hidden = true; return; }
  cont.hidden = false;
  cont.innerHTML = `<h2>Zonas de FC</h2>
    ${aj.fcMax ? "" : `<p class="rd-nota">Con tu FC máxima estimada (${RunDatos.fcMax()} lpm, la más alta registrada).</p>`}
    <ul class="rd-zonas">${zs.slice().reverse().map(z => `<li class="rd-z${z.z}"><span>Z${z.z}</span>
      <small>${z.desde == null ? `&lt; ${z.hasta + 1}` : z.hasta == null ? `&gt; ${z.desde}` : `${z.desde}–${z.hasta}`} lpm</small>
      <div class="rd-z-barra"><i style="width:${Math.round(z.pct * 100)}%"></i></div><b>${Math.round(z.pct * 100)} %</b><em>${V.tiempo(z.seg)}</em></li>`).join("")}</ul>`;
}

// Mapa + perfil, cuando llega la ruta completa.
function pintarRuta() {
  const caja = document.getElementById("rd-mapa");
  if (caja && !actual.mapa) actual.mapa = RunMapa.crear(caja, actual.tramos, { alto: 240 });
  pintarZonas();
  const s = actual.serie, cont = document.getElementById("rd-perfil");
  if (!s || !cont) return;
  const bici = actual.col === "bicicleta";
  const modos = [[bici ? "vel" : "ritmo", bici ? "Velocidad" : "Ritmo"]];
  if (s.conFc) modos.push(["fc", "FC"]);
  if (s.conAlt) modos.push(["altura", "Altura"]);
  if (!modos.some(m => m[0] === actual.modo)) actual.modo = modos[0][0];
  cont.hidden = false;
  cont.innerHTML = `<div class="rd-perfil-cab"><h2>Análisis</h2>
      <div class="fin-tabs rd-modos" role="tablist">${modos.map(([k, t]) => `<button type="button" role="tab" class="fin-tab${actual.modo === k ? " active" : ""}" aria-selected="${actual.modo === k}" data-rd-modo="${k}">${t}</button>`).join("")}</div></div>
    <p class="rd-lectura" aria-live="polite">${lecturaTexto(null)}</p>
    <div class="rd-perfil" data-rd-perfil>${Gr.svgPerfil(s, { ancho: ANCHO, alto: ALTO, modo: actual.modo, bandas: actual.bandas.concat(actual.bandasSeg || []) })}</div>
    ${actual.bandas.length ? `<p class="rd-nota"><span class="rd-leyenda"></span> Intervalos de correr de la rutina</p>` : ""}`;
}
function lecturaTexto(i) {
  const s = actual.serie;
  if (i == null) return "Desliza sobre el gráfico para ver cada punto en el mapa.";
  const bici = actual.col === "bicicleta";
  const partes = [`km ${V.numero(s.d[i] / 1000, 2)}`];
  partes.push(bici ? `${V.numero((s.vel[i] || 0) * 3.6, 1)} km/h` : V.ritmo(s.ritmo[i]));
  if (s.conAlt && s.alt[i] != null) partes.push(`${V.numero(Math.round(s.alt[i]))} m`);
  if (s.conFc && s.fc[i] != null) partes.push(`${Math.round(s.fc[i])} lpm`);
  return partes.join(" · ");
}
function moverCursor(e) {
  const caja = e.target.closest("[data-rd-perfil]");
  if (!caja || !actual || !actual.serie) return;
  const svg = caja.querySelector("svg");
  const r = svg.getBoundingClientRect();
  const x = (e.clientX - r.left) * (ANCHO / r.width);
  const i = Gr.indicePorX(actual.serie, x, ANCHO);
  const p = Gr.puntoCursor(actual.serie, i, actual.modo, ANCHO, ALTO);
  const g = svg.querySelector(".rg-cursor");
  if (!g || !p) return;
  g.removeAttribute("hidden");
  g.querySelector("line").setAttribute("x1", p.x); g.querySelector("line").setAttribute("x2", p.x);
  const c = g.querySelector("circle");
  if (p.y != null) { c.setAttribute("cx", p.x); c.setAttribute("cy", p.y); c.removeAttribute("hidden"); } else c.setAttribute("hidden", "");
  const lect = document.querySelector(".rd-lectura");
  if (lect) lect.textContent = lecturaTexto(i);
  if (actual.mapa) actual.mapa.mover(actual.serie.lat[i], actual.serie.lon[i]);
}

// Intervalos de correr de la rutina guiada, sombreados en el perfil.
function sombrearRutina() {
  const yo = actual, d = yo.doc;
  if (!d.rutina || !d.rutina.id || !yo.serie || !yo.rutaDoc) return;
  usuario().collection("rutinas_running").doc(d.rutina.id).get().then(s => {
    if (actual !== yo || !s.exists) return;
    const ints = (s.data().intervalos || []);
    const inicioRutina = (d.previo && d.previo.inicio) || d.inicio;
    let t = (inicioRutina - yo.rutaDoc.inicio) / 1000;
    const distEn = seg => {
      const S = yo.serie;
      if (seg <= S.t[0]) return 0;
      for (let i = 1; i < S.t.length; i++) if (S.t[i] >= seg) { const f = (seg - S.t[i - 1]) / Math.max(1, S.t[i] - S.t[i - 1]); return S.d[i - 1] + f * (S.d[i] - S.d[i - 1]); }
      return S.total;
    };
    yo.bandas = [];
    ints.forEach(iv => {
      const a = t, b = t + (Number(iv.seg) || 0);
      if (iv.tipo === "correr" || iv.tipo === "trotar") yo.bandas.push([distEn(a), distEn(b), `rg-banda-${iv.tipo}`]);
      t = b;
    });
    yo.bandas = yo.bandas.filter(([x, y]) => y > x);
    if (yo.bandas.length) pintarRuta();
  }).catch(() => {});
}

// ---- Acciones ----
function menu(abrir) {
  const lista = document.querySelector(".rd-menu-lista"), btn = document.querySelector(".rd-menu-btn");
  if (!lista) return;
  const ab = abrir == null ? lista.hidden : abrir;
  lista.hidden = !ab;
  btn.setAttribute("aria-expanded", String(ab));
}
function exportarGpx() {
  const yo = actual;
  const hacer = () => {
    const blob = new Blob([V.gpx(Object.assign({ deporte: yo.col }, yo.doc), yo.tramos)], { type: "application/gpx+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = V.nombreArchivo(yo.doc);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  if (yo.tramos) return hacer();
  usuario().collection("rutas").doc(yo.id).get().then(s => {
    if (!s.exists) return alert("Esta actividad no tiene ruta para exportar.");
    yo.tramos = M.leerRuta(s.data());
    hacer();
  }).catch(() => alert("No se pudo leer la ruta. Prueba con internet."));
}
function eliminar() {
  const yo = actual, d = yo.doc;
  const que = yo.col === "bicicleta" ? "esta rodada" : "esta carrera";
  if (!confirm(`¿Eliminar ${que}${d.titulo ? ` («${d.titulo}»)` : ""}? También se borra su ruta. No se puede deshacer.`)) return;
  const lote = db.batch();
  lote.delete(usuario().collection(yo.col).doc(yo.id));
  if (tieneRuta(d)) lote.delete(usuario().collection("rutas").doc(yo.id));
  // Sus tiempos en los segmentos se quitan (el segmento queda).
  (window.RunDatos ? RunDatos.segmentos() : []).forEach(s => {
    if (s.esfuerzos && s.esfuerzos[yo.id]) lote.update(usuario().collection("run_segmentos").doc(s.id), { [`esfuerzos.${yo.id}`]: firebase.firestore.FieldValue.delete() });
  });
  rutas.delete(yo.id);
  lote.commit().catch(err => console.error("Manolo: no se pudo eliminar", err));
  location.hash = yo.col === "bicicleta" ? "#bicicleta" : "#running";
}
async function corregirDesnivel() {
  const yo = actual;
  if (!yo.tramos) return alert("Espera a que cargue la ruta.");
  if (navigator.onLine === false) return alert("Hace falta internet para corregir el desnivel.");
  if (!confirm("Se enviarán unos puntos de tu ruta (sin tu nombre) a Open-Meteo para leer la altura del terreno. ¿Seguir?")) return;
  const muestras = E.muestrasDesnivel(yo.tramos, M.haversine, 1000);
  const btns = document.querySelectorAll('[data-rd="desnivel"]');
  btns.forEach(b => { b.disabled = true; b.textContent = "Corrigiendo…"; });
  try {
    const alturas = [];
    for (const url of E.urlsElevacion(muestras)) {
      const res = await fetch(url, { credentials: "omit" });
      if (!res.ok) throw new Error(String(res.status));
      alturas.push(...((await res.json()).elevation || []));
    }
    const des = E.desnivelDe(alturas, 1);
    if (!des) throw new Error("sin datos");
    const lote = db.batch();
    lote.update(usuario().collection(yo.col).doc(yo.id), { desnivelCorr: { pos: des.pos, neg: des.neg, fuente: "open-meteo" } });
    lote.update(usuario().collection("rutas").doc(yo.id), { altCorr: M.codificar(muestras.map((p, i) => [p.d, alturas[i] == null ? M.SIN : Math.round(alturas[i])]), [1, 1]) });
    await lote.commit();
  } catch (e) {
    console.warn("Manolo: corregir desnivel", e);
    alert("No se pudo corregir el desnivel ahora. Prueba más tarde.");
    btns.forEach(b => { b.disabled = false; b.textContent = "Corregir desnivel"; });
  }
}

// ---- Compartir (imagen tipo historia, fase 7) ----
let hojaComp = null, fondoComp = "oscuro", blobComp = null;
function abrirCompartir() {
  if (!window.RunCompartir) return;
  if (!hojaComp) {
    hojaComp = document.createElement("div");
    hojaComp.id = "rc-compartir";
    hojaComp.className = "js-sheet budget-sheet";
    hojaComp.hidden = true;
    hojaComp.innerHTML = `<div class="budget-sheet-overlay"></div>
      <div class="budget-sheet-panel ri-panel" role="dialog" aria-modal="true" aria-labelledby="rc-comp-t">
        <div class="budget-sheet-header"><button type="button" class="budget-sheet-close" aria-label="Cerrar"><span data-icon="close"></span></button><h3 id="rc-comp-t">Compartir</h3></div>
        <div class="ri-cuerpo rcm-cuerpo">
          <div class="fin-tabs rcm-fondos" role="tablist"><button type="button" role="tab" class="fin-tab" data-rcm-fondo="oscuro">Fondo oscuro</button><button type="button" role="tab" class="fin-tab" data-rcm-fondo="transparente">Transparente</button></div>
          <div class="rcm-previa" id="rcm-previa"><p class="rd-nota">Preparando la imagen…</p></div>
          <p class="rd-nota">Transparente: para ponerla encima de una foto en tus historias.</p>
        </div>
        <div class="txn-sheet-actions ri-acciones"><button type="button" class="txn-save" data-rcm="compartir" disabled>Compartir</button></div>
      </div>`;
    document.body.appendChild(hojaComp);
    renderIcons(hojaComp);
    hojaComp.addEventListener("click", e => {
      if (e.target.closest(".budget-sheet-close") || e.target.classList.contains("budget-sheet-overlay")) return cerrarCompartir();
      const f = e.target.closest("[data-rcm-fondo]");
      if (f) { fondoComp = f.dataset.rcmFondo; prepararImagen(); return; }
      if (e.target.closest('[data-rcm="compartir"]') && blobComp) {
        RunCompartir.compartir(blobComp, RunCompartir.nombre(actual.doc)).then(r => { if (r !== "cancelado") cerrarCompartir(); });
      }
    });
  }
  hojaComp.classList.remove("is-closing");
  hojaComp.hidden = false;
  document.body.classList.add("sheet-open");
  prepararImagen();
}
function cerrarCompartir() {
  if (!hojaComp || hojaComp.hidden) return;
  hojaComp.classList.add("is-closing");
  setTimeout(() => { hojaComp.hidden = true; hojaComp.classList.remove("is-closing"); document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden])")); }, 200);
}
async function prepararImagen() {
  const yo = actual;
  hojaComp.querySelectorAll("[data-rcm-fondo]").forEach(b => { const s = b.dataset.rcmFondo === fondoComp; b.classList.toggle("active", s); b.setAttribute("aria-selected", String(s)); });
  const btn = hojaComp.querySelector('[data-rcm="compartir"]');
  btn.disabled = true;
  blobComp = null;
  // La ruta completa si ya está; si no, la mini ruta del resumen.
  const tramos = yo.tramos || (yo.doc.mini ? [M.leerMini(yo.doc.mini)] : []);
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { /* sin fuentes: la del sistema */ }
  const canvas = RunCompartir.dibujar(document.createElement("canvas"), RunCompartir.plan(Object.assign({ deporte: yo.col }, yo.doc), tramos, { fondo: fondoComp }));
  const blob = await RunCompartir.aBlob(canvas).catch(() => null);
  if (actual !== yo || !blob) return;
  blobComp = blob;
  const prev = document.getElementById("rcm-previa");
  const viejo = prev.querySelector("img");
  if (viejo) URL.revokeObjectURL(viejo.src);
  prev.innerHTML = `<img alt="Vista previa de la imagen para compartir" class="rcm-img${fondoComp === "transparente" ? " is-transparente" : ""}">`;
  prev.querySelector("img").src = URL.createObjectURL(blob);
  btn.disabled = false;
  btn.textContent = navigator.canShare ? "Compartir" : "Descargar imagen";
}

// ---- Editar (hoja) ----
let hoja = null;
function abrirEditar() {
  const d = actual.doc, bici = actual.col === "bicicleta";
  if (!hoja) {
    hoja = document.createElement("div");
    hoja.id = "rd-hoja";
    hoja.className = "js-sheet budget-sheet";
    hoja.hidden = true;
    hoja.innerHTML = `<div class="budget-sheet-overlay"></div>
      <div class="budget-sheet-panel ri-panel" role="dialog" aria-modal="true" aria-labelledby="rd-hoja-t">
        <div class="budget-sheet-header"><button type="button" class="budget-sheet-close" aria-label="Cerrar"><span data-icon="close"></span></button><h3 id="rd-hoja-t">Editar actividad</h3></div>
        <form class="ri-cuerpo rd-form" id="rd-form" novalidate></form>
        <div class="txn-sheet-actions ri-acciones"><button type="button" class="txn-save txn-save-otro" data-rdh="cancelar">Cancelar</button><button type="button" class="txn-save" data-rdh="guardar">Guardar</button></div>
      </div>`;
    document.body.appendChild(hoja);
    if (typeof renderIcons === "function") renderIcons(hoja);
    hoja.addEventListener("click", e => {
      if (e.target.closest(".budget-sheet-close") || e.target.classList.contains("budget-sheet-overlay") || e.target.closest('[data-rdh="cancelar"]')) return cerrarHoja();
      if (e.target.closest('[data-rdh="guardar"]')) guardarEdicion();
    });
    hoja.addEventListener("submit", e => { e.preventDefault(); guardarEdicion(); });
  }
  const zaps = (RunDatos.ajustes().zapatillas || []).filter(z => !z.retirada || z.id === d.zapatillaId);
  const tipos = bici ? TIPOS_BICI : TIPOS;
  document.getElementById("rd-form").innerHTML = `
    <label class="rd-campo">Título<input class="lib-input" name="titulo" maxlength="120" value="${esc(d.titulo || "")}" placeholder="${esc(M.tituloAuto(bici ? "bicicleta" : "running", d.inicio || Date.now()))}"></label>
    <label class="rd-campo">Descripción<textarea class="lib-input" name="notes" maxlength="2000" rows="4">${esc(d.notes || "")}</textarea></label>
    <label class="rd-campo">Tipo<select class="lib-input" name="subtipo">${tipos.map(([v, t]) => `<option value="${v}"${(d.subtipo || "") === v ? " selected" : ""}>${t}</option>`).join("")}${d.subtipo && !tipos.some(t => t[0] === d.subtipo) ? `<option value="${esc(d.subtipo)}" selected>${esc(d.subtipo)}</option>` : ""}</select></label>
    ${zaps.length ? `<label class="rd-campo">Zapatillas<select class="lib-input" name="zapatillaId"><option value="">Sin elegir</option>${zaps.map(z => `<option value="${esc(z.id)}"${z.id === d.zapatillaId ? " selected" : ""}>${esc(z.nombre)}</option>`).join("")}</select></label>` : ""}
    <label class="rd-campo">Esfuerzo percibido (RPE)<select class="lib-input" name="rpe"><option value="">—</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option value="${n}"${Number(d.rpe) === n ? " selected" : ""}>${n}</option>`).join("")}</select></label>`;
  hoja.classList.remove("is-closing");
  hoja.hidden = false;
  document.body.classList.add("sheet-open");
}
function cerrarHoja() {
  if (!hoja || hoja.hidden) return;
  hoja.classList.add("is-closing");
  setTimeout(() => { hoja.hidden = true; hoja.classList.remove("is-closing"); document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden])")); }, 200);
}
function guardarEdicion() {
  const f = document.getElementById("rd-form");
  const d = actual.doc, borrar = firebase.firestore.FieldValue.delete();
  const val = n => (f.elements[n] ? f.elements[n].value.trim() : null);
  const cambios = {};
  const titulo = val("titulo");
  if (titulo !== (d.titulo || "")) cambios.titulo = titulo ? titulo.slice(0, 120) : borrar;
  const notes = val("notes");
  if (notes !== (d.notes || "")) cambios.notes = notes.slice(0, 2000);
  const sub = val("subtipo");
  if (sub !== (d.subtipo || "")) cambios.subtipo = sub || borrar;
  const z = val("zapatillaId");
  if (z != null && z !== (d.zapatillaId || "")) cambios.zapatillaId = z || borrar;
  const rpe = val("rpe");
  if (rpe !== (d.rpe ? String(d.rpe) : "")) cambios.rpe = rpe ? Number(rpe) : borrar;
  if (Object.keys(cambios).length) usuario().collection(actual.col).doc(actual.id).update(cambios).catch(err => { console.error(err); alert("No se pudo guardar."); });
  cerrarHoja();
}

// ---- Eventos ----
document.addEventListener("click", e => {
  if (!actual || !e.target.closest("#panel-run-actividad")) {
    if (!e.target.closest(".rd-menu")) document.querySelectorAll(".rd-menu-lista").forEach(l => { l.hidden = true; });
    return;
  }
  const b = e.target.closest("[data-rd]");
  const modo = e.target.closest("[data-rd-modo]");
  if (modo) { actual.modo = modo.dataset.rdModo; pintarRuta(); return; }
  if (!b) { if (!e.target.closest(".rd-menu")) menu(false); return; }
  const a = b.dataset.rd;
  if (a !== "menu") menu(false);
  if (a === "menu") menu();
  else if (a === "editar") abrirEditar();
  else if (a === "gpx") exportarGpx();
  else if (a === "desnivel") corregirDesnivel();
  else if (a === "segmento") crearSegmento();
  else if (a === "compartir") abrirCompartir();
  else if (a === "eliminar") eliminar();
  else if (a === "ampliar") {
    const grande = document.body.classList.toggle("rd-mapa-abierto");
    b.textContent = grande ? "✕" : "⤢";
    b.setAttribute("aria-label", grande ? "Cerrar el mapa grande" : "Ampliar el mapa");
    if (actual.mapa) actual.mapa.ampliar(grande);
  }
});
document.addEventListener("pointermove", moverCursor);
document.addEventListener("pointerdown", moverCursor);
document.addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("rd-mapa-abierto")) document.querySelector('[data-rd="ampliar"]').click(); });
window.addEventListener("hashchange", abrirDesdeHash);
document.addEventListener("DOMContentLoaded", abrirDesdeHash);
// Cuando llegan o cambian las listas: zonas, resumen y mismo recorrido (sin redibujar el mapa).
if (window.RunDatos) RunDatos.al(() => {
  if (!actual || !actual.doc || document.querySelector("#rd-hoja:not([hidden])")) return;
  pintarZonas();
  const bici = actual.col === "bicicleta";
  const ia = document.getElementById("rd-ia-caja"), rec = document.getElementById("rd-rec-caja");
  if (ia) ia.innerHTML = inteligente(actual.doc, bici);
  if (rec) rec.innerHTML = bici ? "" : recorrido(actual.doc);
  const sg = document.getElementById("rd-seg-caja");
  if (sg) sg.innerHTML = bici ? "" : segmentos(actual.doc);
});
})();
