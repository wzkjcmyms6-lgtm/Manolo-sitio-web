// ---------- Ficha del ejercicio (hoja) ----------
// Se abre tocando el nombre de un ejercicio (cualquier elemento con
// data-ficha="id" o data-ficha-nombre="nombre guardado"): en el entreno en
// vivo, las rutinas (lista y editor), el buscador, Rangos y el detalle de
// una sesión. Muestra:
//   - la demo (js/ej-demos.js) y los músculos en el mapa;
//   - "Cómo se hace": pasos y errores comunes (data/ejercicios-tecnica.json,
//     se carga recién al abrir la primera ficha), "Ver video" (búsqueda en
//     YouTube) y "Mi video" (tu link; el reproductor carga solo al tocar);
//   - "Historial": 1RM estimado, mejor serie, volumen por sesión, última vez;
//   - "Récords": 1RM a 12RM (real y estimado) y el rango del ejercicio;
//   - tus notas y alternativas con los mismos músculos.
// Todo sale de los entrenos que la app ya tiene cargados (sin lecturas
// nuevas por ficha). Notas y "Mi video" van en meta/ejercicio_fichas.
(function () {
"use strict";

const NS = "http://www.w3.org/2000/svg";
const RUTA_TECNICA = "data/ejercicios-tecnica.json?v=202611051500";
const H = EjHistorial;
let hoja = null;
let actual = null;      // ficha abierta
let pila = [];          // fichas anteriores (al abrir una alternativa)
let pestana = "como";
let tecnica = null;     // { errores, ej } cuando cargó
let pidiendoTecnica = null;
let fichas = {};        // meta/ejercicio_fichas: { id: { video, nota } }
let escuchando = false;
let videoAbierto = false;

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const kg = n => `${String(Math.round(num(n) * 10) / 10).replace(".", ",")} kg`;
const nombreMusculo = id => (MuscleEngine.MUSCULO_POR_ID[id] || {}).nombre || id;
const equipoTexto = f => (window.ExerciseSearch && ExerciseSearch.EQUIPOS[f.equipo] || {}).nombre || "";
const MECANICA = { c: "Compuesto", a: "Aislamiento" };
const TIPO = { carga: "Con peso", peso_corporal: "Peso corporal", cardio: "Cardio", isometrico: "Isométrico" };
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaCorta = iso => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;
function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function haceTxt(dias) {
  if (dias == null) return "";
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 60) return `hace ${Math.round(dias / 7)} semanas`;
  return `hace ${Math.round(dias / 30)} meses`;
}

// ---- Datos ----
function cargarTecnica() {
  if (tecnica || pidiendoTecnica) return pidiendoTecnica;
  pidiendoTecnica = fetch(RUTA_TECNICA).then(r => (r.ok ? r.json() : null)).then(t => {
    tecnica = t || { errores: {}, ej: {} };
    if (actual && hoja && !hoja.hidden) pintar();
  }).catch(() => { pidiendoTecnica = null; });
  return pidiendoTecnica;
}
const patronDe = id => (tecnica && tecnica.ej[id] && tecnica.ej[id].pt) || null;

function escucharFichas() {
  if (escuchando || typeof currentUser === "undefined" || !currentUser) return;
  escuchando = true;
  EjercicioDatos.meta("ejercicio_fichas").onSnapshot(doc => {
    fichas = (doc && doc.exists && doc.data()) || {};
    // Repinta solo si no estás escribiendo una nota.
    if (actual && hoja && !hoja.hidden && !hoja.contains(document.activeElement)) pintar();
  }, () => { escuchando = false; });
}
function guardarFicha(id, cambios) {
  fichas[id] = Object.assign({}, fichas[id], cambios);
  Object.keys(cambios).forEach(k => { if (cambios[k] == null) delete fichas[id][k]; });
  const fv = firebase.firestore.FieldValue;
  const datos = {};
  Object.keys(cambios).forEach(k => { datos[k] = cambios[k] == null ? fv.delete() : cambios[k]; });
  return EjercicioDatos.meta("ejercicio_fichas").set({ [id]: datos }, { merge: true });
}

function sesionesDe(f) {
  const entrenos = (EjercicioDatos.estado.registros && EjercicioDatos.estado.registros.gimnasio) || [];
  const mismo = ex => {
    const r = EjercicioDatos.resolver(ex.name, ex.exerciseId);
    return !!r && r.id === f.id;
  };
  const pesoEn = window.Rangos && Rangos.pesoEn ? fecha => Rangos.pesoEn(fecha) : () => num((EjercicioDatos.estado.ajustes || {}).pesoCorporal) || 70;
  return H.sesiones(entrenos, mismo, { tipo: f.tipo, factor: f.factorPesoCorporal || 1, pesoEn });
}

// Rango del ejercicio (si Rangos lo reconoce).
function rangoDe(f) {
  if (!window.Rangos || !Rangos.deFicha) return null;
  try { return Rangos.deFicha(f); } catch (e) { return null; }
}

// ---- Partes de la hoja ----
function figuras(f) {
  const out = [];
  [["frente", "Frente"], ["espalda", "Espalda"]].forEach(([vista, txt]) => {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "figura ejf-fig");
    svg.setAttribute("viewBox", "0 0 140 300");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${txt}: músculos que trabaja`);
    BodyFigures.dibujar(svg, BodyFigures[vista]);
    svg.querySelectorAll(".mz").forEach(g => {
      const m = g.getAttribute("data-muscle");
      if ((f.primarios || []).includes(m)) g.setAttribute("data-nivel", "3");
      else if ((f.secundarios || []).includes(m)) { g.setAttribute("data-nivel", "2"); g.setAttribute("data-suave", ""); }
    });
    out.push(svg.outerHTML);
  });
  return `<div class="ejf-figs">${out.join("")}</div>`;
}

function seccionComo(f) {
  if (!tecnica) return `<p class="ejf-cargando">Cargando…</p>`;
  const t = tecnica.ej[f.id] || {};
  const errores = (tecnica.errores || {})[t.pt] || [];
  const pasos = t.p
    ? `<ol class="ejf-pasos">${t.p.map(p => `<li>${esc(p)}</li>`).join("")}</ol>`
    : `<p class="ejf-texto">Los pasos en español de este ejercicio llegan pronto. Mientras tanto, mira la demo y el video.</p>`;
  const v = (fichas[f.id] || {}).video;
  const miVideo = v
    ? (videoAbierto
      ? `<div class="ejf-video"><iframe src="${esc(H.reproductor(v))}" title="Mi video de ${esc(f.nombre)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
      : `<button type="button" class="ejf-video ejf-video-mini" data-ejf="ver-video" aria-label="Ver mi video de ${esc(f.nombre)}">
          <img src="${esc(H.miniaturaVideo(v))}" alt="" loading="lazy" decoding="async"><span class="ejf-play" aria-hidden="true"></span></button>`) +
      `<div class="ejf-video-acc"><button type="button" class="ejf-link" data-ejf="cambiar-video">Cambiar link</button><button type="button" class="ejf-link" data-ejf="quitar-video">Quitar</button></div>`
    : `<form class="ejf-mi-video" data-ejf-form="video" novalidate>
        <label class="ejf-label" for="ejf-video-in">Mi video (link de YouTube)</label>
        <div class="ejf-fila"><input id="ejf-video-in" type="url" inputmode="url" placeholder="https://youtu.be/…" autocomplete="off">
          <button type="submit" class="ejf-btn-sec">Guardar</button></div>
        <p class="ejf-error" role="alert" hidden>Ese link no es de un video de YouTube.</p>
      </form>`;
  return `${pasos}
    ${errores.length ? `<h4 class="ejf-sub">Errores comunes</h4><ul class="ejf-errores">${errores.map(e => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
    <div class="ejf-videos">
      <a class="ejf-btn" href="${esc(H.busquedaVideo(f))}" target="_blank" rel="noopener noreferrer"><span class="ejf-play-chico" aria-hidden="true"></span>Ver video</a>
      ${miVideo}
    </div>
    ${t.p ? `<p class="ejd-credito">Pasos resumidos de free-exercise-db (dominio público).</p>` : ""}`;
}

function grafico(lista, campo, titulo, fmt) {
  const pts = lista.filter(s => s[campo] > 0);
  if (pts.length < 2) return "";
  const vals = pts.map(s => s[campo]);
  const min = Math.min(...vals), max = Math.max(...vals);
  const pad = Math.max(1, (max - min) * 0.15);
  const lo = Math.max(0, Math.floor((min - pad) / 5) * 5), hi = Math.ceil((max + pad) / 5) * 5;
  const n = pts.length;
  const svg = HabitosGraficos.linea(pts.map((s, i) => ({ x: n === 1 ? 1 : i / (n - 1), y: s[campo], tip: `${fechaCorta(s.fecha)}: ${fmt(s[campo])}` })),
    { min: lo, max: hi, ejeY: [lo, Math.round((lo + hi) / 2), hi], fmt: v => String(v), inicio: fechaCorta(pts[0].fecha), fin: fechaCorta(pts[n - 1].fecha), titulo });
  return `<figure class="ejf-graf"><figcaption>${esc(titulo)}</figcaption>${svg}<p class="ejf-tip" aria-live="polite">Toca el gráfico para ver cada sesión.</p></figure>`;
}

function seccionHistorial(f, lista) {
  if (!lista.length) return `<p class="ejf-vacio">Todavía no hiciste este ejercicio. Cuando lo anotes, aquí verás tu progreso.</p>`;
  const r = H.resumen(lista, hoyIso());
  const conPeso = f.tipo === "carga" || (f.tipo === "peso_corporal" && lista.some(s => s.maxKg > 0));
  const kpis = [];
  kpis.push(["Última vez", `${haceTxt(r.diasDesde)}`, fechaCorta(r.ultima)]);
  if (f.tipo === "isometrico") kpis.push(["Mejor tiempo", `${r.maxSeg} s`, ""]);
  else if (f.tipo === "cardio") kpis.push(["Sesiones", String(r.sesiones), ""]);
  else {
    if (r.mejorSerie && (f.tipo === "carga" || r.mejorSerie.kg > 0)) kpis.push(["Mejor serie", `${kg(r.mejorSerie.kg)} × ${r.mejorSerie.reps}`, fechaCorta(r.mejorFecha)]);
    else kpis.push(["Más reps", `${r.maxReps}`, ""]);
    if (r.mejorE1rm > 0) kpis.push(["1RM estimado", kg(r.mejorE1rm), f.tipo === "peso_corporal" ? "con tu peso" : ""]);
  }
  kpis.push(["Sesiones", String(r.sesiones), ""]);
  const ultimas = lista.slice(-6).reverse();
  const est = f.tipo === "carga" && window.EjPrograma ? EjPrograma.estancamiento(lista, hoyIso()) : null;
  const estHtml = est ? `<div class="ejf-estanca"><b>Estancado</b><span>${esc(EjPrograma.textoEstancamiento(est))}</span>
      <ul>${EjPrograma.sugerenciasEstancamiento(null, (H.alternativas(f, EjercicioDatos.estado.base || [], { patronDe, limite: 1 })[0] || {}).nombre || "").map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>` : "";
  return `${estHtml}<div class="ejf-kpis">${kpis.slice(0, 4).map(([t, v, s]) => `<div class="ejf-kpi"><span>${esc(t)}</span><b>${esc(v)}</b>${s ? `<small>${esc(s)}</small>` : ""}</div>`).join("")}</div>
    ${f.tipo === "isometrico" ? grafico(lista, "maxSeg", "Mejor tiempo por sesión (s)", v => `${v} s`)
      : f.tipo === "cardio" ? grafico(lista, "minutos", "Minutos por sesión", v => `${v} min`)
      : grafico(lista, "e1rm", "1RM estimado por sesión (kg)", kg) + (conPeso ? grafico(lista, "volumen", "Volumen por sesión (kg)", kg) : "")}
    <h4 class="ejf-sub">Últimas sesiones</h4>
    <ul class="ejf-sesiones">${ultimas.map(s => `<li><span>${esc(fechaCorta(s.fecha))}</span><span>${esc(lineaSesion(s, f))}</span>${s.volumen > 0 && f.tipo !== "cardio" ? `<small>${esc(kg(s.volumen))}</small>` : "<small></small>"}</li>`).join("")}</ul>`;
}
function lineaSesion(s, f) {
  if (f.tipo === "cardio") return `${s.minutos} min`;
  if (f.tipo === "isometrico") return s.sets.map(x => `${num(x.seg)} s`).join(" · ");
  const pesos = new Set(s.sets.map(x => num(x.kg)));
  const reps = s.sets.map(x => num(x.reps)).join(" · ");
  if (pesos.size === 1) {
    const k = [...pesos][0];
    return k > 0 ? `${s.series} × ${reps} con ${kg(k)}` : `${s.series} series: ${reps} reps`;
  }
  return s.sets.map(x => `${kg(x.kg)}×${num(x.reps)}`).join(" · ");
}

function seccionRecords(f, lista) {
  const rango = rangoDe(f);
  const rk = rango
    ? `<button type="button" class="ejf-rango" data-ejf="rango" data-rk="${esc(rango.id)}">
        ${rango.insignia || ""}<span><small>Rango</small><b>${esc(rango.nombre)}</b>${rango.texto ? `<em>${esc(rango.texto)}</em>` : ""}</span><span class="ejf-ir" aria-hidden="true">›</span></button>`
    : "";
  if (f.tipo === "cardio" || f.tipo === "isometrico" || !lista.some(s => s.maxKg > 0)) {
    const r = H.resumen(lista, hoyIso());
    return rk + (r ? `<div class="ejf-kpis"><div class="ejf-kpi"><span>${f.tipo === "isometrico" ? "Mejor tiempo" : f.tipo === "cardio" ? "Sesiones" : "Más reps seguidas"}</span><b>${f.tipo === "isometrico" ? `${r.maxSeg} s` : f.tipo === "cardio" ? r.sesiones : r.maxReps}</b></div></div>`
      : `<p class="ejf-vacio">Sin récords todavía.</p>`);
  }
  const recs = H.recordsPorReps(lista);
  return rk + `<table class="ejf-recs"><thead><tr><th scope="col">Reps</th><th scope="col">Tu mejor</th><th scope="col">Estimado</th></tr></thead>
    <tbody>${recs.map(x => `<tr${x.real ? "" : ' class="is-est"'}><th scope="row">${x.reps}RM</th><td>${x.real ? `${esc(kg(x.real.kg))} <small>${esc(fechaCorta(x.real.fecha))}</small>` : "—"}</td><td>${x.estimado ? esc(kg(x.estimado)) : "—"}</td></tr>`).join("")}</tbody></table>
    <p class="ejf-nota-chica">"Tu mejor" es el mayor peso con el que hiciste al menos esas reps. "Estimado" sale de tu mejor 1RM (fórmula de Epley).</p>`;
}

function seccionAlternativas(f) {
  const base = EjercicioDatos.estado.base || [];
  const destacados = new Set(base.slice(0, EjercicioDatos.estado.destacados || 0).map(e => e.id));
  // Solo el equipo de tu perfil activo (Ajustes del gimnasio).
  const equipos = window.EjEquipo && EjEquipo.disponibles ? EjEquipo.disponibles(EjEquipo.perfilActivo(EjercicioDatos.estado.ajustes)) : null;
  const alt = H.alternativas(f, base, { destacados, patronDe, equipos });
  if (!alt.length) return "";
  return `<h4 class="ejf-sub">Alternativas (mismos músculos)</h4>
    <ul class="ejf-alts">${alt.map(a => `<li><button type="button" data-ficha="${esc(a.id)}"><span>${esc(a.nombre)}</span><small>${esc(a.primarios.map(nombreMusculo).join(" · "))}</small><span class="ejf-ir" aria-hidden="true">›</span></button></li>`).join("")}</ul>`;
}

function contenido(f) {
  const pri = (f.primarios || []).map(nombreMusculo);
  const sec = (f.secundarios || []).map(nombreMusculo);
  const datos = [equipoTexto(f), MECANICA[f.mec], TIPO[f.tipo]].filter(Boolean);
  const lista = sesionesDe(f);
  const nota = (fichas[f.id] || {}).nota || "";
  const tabs = [["como", "Cómo se hace"], ["historial", "Historial"], ["records", "Récords"]];
  const cuerpo = pestana === "historial" ? seccionHistorial(f, lista) : pestana === "records" ? seccionRecords(f, lista) : seccionComo(f);
  return `
    <div class="muscle-sheet-head">
      <div>${pila.length ? `<button type="button" class="ejf-volver" data-ejf="volver">‹ ${esc(pila[pila.length - 1].nombre)}</button>` : `<span class="ejf-arriba">Ejercicio</span>`}
        <h3 id="ejf-titulo">${esc(f.nombre)}</h3>
        <span class="muscle-sheet-period">${esc(datos.join(" · "))}</span></div>
      <button type="button" class="muscle-sheet-close" data-cerrar aria-label="Cerrar"><span data-icon="close"></span></button>
    </div>
    ${EjDemos.html(f) || `<p class="ejf-sin-demo">Este ejercicio no tiene demo con fotos. Abajo ves los músculos que trabaja.</p>`}
    <section class="ejf-musculos" aria-label="Músculos">
      ${figuras(f)}
      <div class="ejf-musc-txt">
        ${pri.length ? `<p><b>Principales</b>${esc(pri.join(" · "))}</p>` : ""}
        ${sec.length ? `<p><b>Ayudan</b>${esc(sec.join(" · "))}</p>` : ""}
      </div>
    </section>
    <div class="fin-tabs ejf-tabs" role="tablist" aria-label="Secciones de la ficha">${tabs.map(([id, t]) => `<button type="button" class="fin-tab${pestana === id ? " active" : ""}" role="tab" aria-selected="${pestana === id}" data-ejf-tab="${id}">${t}</button>`).join("")}</div>
    <section class="ejf-panel" role="tabpanel">${cuerpo}</section>
    <h4 class="ejf-sub">Mis notas</h4>
    <textarea class="ejf-nota" data-ejf-nota rows="2" maxlength="300" placeholder="Ej: asiento en el 4, agarre cerrado" aria-label="Mis notas de ${esc(f.nombre)}">${esc(nota)}</textarea>
    ${seccionAlternativas(f)}`;
}

function pintar() {
  if (!actual) return;
  const cuerpo = hoja.querySelector(".ejf-cuerpo");
  const panel = hoja.querySelector(".muscle-sheet-panel");
  const scroll = panel.scrollTop;
  cuerpo.innerHTML = contenido(actual);
  if (typeof renderIcons === "function") renderIcons(hoja);
  panel.scrollTop = scroll;
}

function crearHoja() {
  hoja = document.createElement("div");
  hoja.className = "muscle-sheet ejf-hoja";
  hoja.hidden = true;
  hoja.innerHTML = `<div class="muscle-sheet-overlay" data-cerrar></div>
    <div class="muscle-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="ejf-titulo"><div class="muscle-sheet-grip"></div><div class="ejf-cuerpo"></div></div>`;
  document.body.appendChild(hoja);
  hoja.addEventListener("click", alClick);
  hoja.addEventListener("submit", alEnviar);
  hoja.addEventListener("change", e => {
    if (e.target.matches("[data-ejf-nota]") && actual) {
      const t = e.target.value.trim().slice(0, 300);
      guardarFicha(actual.id, { nota: t || null });
    }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && hoja && !hoja.hidden) cerrar(); });
}

function alClick(e) {
  if (e.target.closest("[data-cerrar]")) { cerrar(); return; }
  const tab = e.target.closest("[data-ejf-tab]");
  if (tab) { pestana = tab.dataset.ejfTab; videoAbierto = false; pintar(); return; }
  const hit = e.target.closest(".ejf-graf .hbg-hit");
  if (hit) { const tip = hit.closest(".ejf-graf").querySelector(".ejf-tip"); if (tip) tip.textContent = hit.dataset.tip; return; }
  const b = e.target.closest("[data-ejf]");
  if (!b || !actual) return;
  const acc = b.dataset.ejf;
  if (acc === "volver") { actual = pila.pop(); videoAbierto = false; pintar(); hoja.querySelector(".muscle-sheet-panel").scrollTop = 0; }
  else if (acc === "ver-video") { videoAbierto = true; pintar(); }
  else if (acc === "cambiar-video" || acc === "quitar-video") {
    if (acc === "quitar-video" && !confirm("¿Quitar tu video de este ejercicio?")) return;
    videoAbierto = false;
    guardarFicha(actual.id, { video: null });
    pintar();
    if (acc === "cambiar-video") { const i = hoja.querySelector("#ejf-video-in"); if (i) i.focus(); }
  } else if (acc === "rango") {
    const id = b.dataset.rk;
    cerrar(true);
    location.hash = "ej-rangos";
    setTimeout(() => { if (window.Rangos && Rangos.abrirEjercicio) Rangos.abrirEjercicio(id); }, 350);
  }
}
function alEnviar(e) {
  const form = e.target.closest("[data-ejf-form='video']");
  if (!form || !actual) return;
  e.preventDefault();
  const id = H.idYoutube(form.querySelector("input").value);
  const err = form.querySelector(".ejf-error");
  if (!id) { err.hidden = false; return; }
  err.hidden = true;
  guardarFicha(actual.id, { video: id });
  pintar();
}

function abrir(f, desdeAlternativa) {
  if (!f) return;
  if (!hoja) crearHoja();
  escucharFichas();
  cargarTecnica();
  if (desdeAlternativa && actual && !hoja.hidden && actual.id !== f.id) pila.push(actual);
  else if (!desdeAlternativa || hoja.hidden) pila = [];
  actual = f;
  videoAbierto = false;
  if (document.activeElement && document.activeElement.blur && !hoja.contains(document.activeElement)) document.activeElement.blur();
  pintar();
  hoja.hidden = false;
  hoja.classList.remove("closing");
  hoja.querySelector(".muscle-sheet-panel").scrollTop = 0;
  document.body.classList.add("sheet-open");
}
function cerrar(rapido) {
  if (!hoja || hoja.hidden) return;
  actual = null;
  pila = [];
  hoja.classList.add("closing");
  setTimeout(() => {
    hoja.hidden = true;
    hoja.classList.remove("closing");
    hoja.querySelector(".ejf-cuerpo").innerHTML = "";
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden]), .muscle-sheet:not([hidden])"));
  }, rapido ? 0 : 220);
}

// La ficha de un ejercicio por id o por el nombre guardado.
function abrirPor(id, nombre, desdeAlternativa) {
  const f = EjercicioDatos.resolver(nombre || "", id || null);
  if (f) abrir(f, desdeAlternativa);
  return !!f;
}

document.addEventListener("click", e => {
  const el = e.target.closest && e.target.closest("[data-ficha], [data-ficha-nombre]");
  if (!el) return;
  const enHoja = hoja && hoja.contains(el);
  if (abrirPor(el.dataset.ficha, el.dataset.fichaNombre, enHoja)) { e.preventDefault(); e.stopPropagation(); }
}, true);

// tecnica(): promesa con { errores, ej } (el generador de rutinas usa el tipo de movimiento).
window.EjFicha = { abrir: (id, nombre) => abrirPor(id, nombre), cerrar, fichas: () => fichas, tecnica: () => Promise.resolve(cargarTecnica()).then(() => tecnica) };
})();
