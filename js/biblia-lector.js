// ---------- Biblia: lector de la Reina-Valera 1909 (pantalla) ----------
// Pantalla completa dentro de Biblia: elegir libro y capítulo, tamaño de
// letra, ortografía actual, pasar de capítulo (botones o deslizando),
// marcar como leído, seguir donde quedaste, "Abrir en otra versión" y
// descargar la Biblia para usarla sin internet. Lógica en
// js/biblia-texto.js; diseño en docs/LECTURA_NIVEL2.md (D-102).
//
// Datos: users/{uid}/meta/biblia_lector (ajustes y último lugar) y
// meta/biblia_leidos ({ dias: { AAAA-MM-DD: ["John.3", …] } }).
// El texto viene de data/biblia/rv1909/{libro}.json: se baja al abrir el
// libro y queda en la caché "manolo-biblia" (no va en el precache).
(function () {
const B = window.BibliaMotor;
const T = window.BibliaTexto;
const { esc, hoyLocal } = window.Lectura;

const TAMS = [0.95, 1.05, 1.15, 1.28, 1.42, 1.6]; // rem
const CLAVE_LOCAL = "manolo-biblia-lector";
const MEMORIA_MAX = 8; // libros guardados en memoria

// ---- Estado ----
const ajustes = Object.assign({ tam: 2, actual: true, version: "RVR1960", ultimo: null }, leerLocal());
let leidos = {};          // AAAA-MM-DD → [claves de capítulo]
let lugar = null;         // { libro, cap }
let datos = null;         // libro cargado { libro, nombre, caps }
const memoria = new Map();
const oyentes = [];
let guardarTimer = null;
let cargando = 0;

function leerLocal() {
  try { return JSON.parse(localStorage.getItem(CLAVE_LOCAL) || "{}") || {}; } catch (e) { return {}; }
}
function guardarLocal() {
  try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify(ajustes)); } catch (e) { /* sin espacio */ }
}
const meta = doc => db.collection("users").doc(currentUser.uid).collection("meta").doc(doc);
function guardarAjustes(campos, ya) {
  Object.assign(ajustes, campos, { ts: Date.now() });
  guardarLocal();
  avisar();
  if (typeof currentUser === "undefined" || !currentUser) return;
  clearTimeout(guardarTimer);
  const escribir = () => meta("biblia_lector").set(Object.assign({}, ajustes, { actualizado: Date.now() }), { merge: true })
    .catch(err => console.warn("Biblia lector:", err));
  if (ya) escribir(); else guardarTimer = setTimeout(escribir, 1500);
}
function avisar() {
  oyentes.forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
  window.dispatchEvent(new CustomEvent("biblia:lector"));
}

// ---- Capítulos leídos ----
function fechaLeido(clave) {
  let f = null;
  Object.keys(leidos).forEach(d => { if ((leidos[d] || []).includes(clave) && (!f || d > f)) f = d; });
  return f;
}
const leidosSet = () => { const s = new Set(); Object.values(leidos).forEach(xs => (xs || []).forEach(k => s.add(k))); return s; };
function marcarLeido(libro, cap, si) {
  const k = T.claveCap(libro, cap);
  const hoy = hoyLocal();
  const fv = firebase.firestore.FieldValue;
  // Al instante en pantalla; Firestore lo confirma después.
  const dia = (leidos[hoy] || []).filter(x => x !== k);
  if (si) dia.push(k);
  leidos = Object.assign({}, leidos, { [hoy]: dia });
  avisar();
  return meta("biblia_leidos").set({ dias: { [hoy]: si ? fv.arrayUnion(k) : fv.arrayRemove(k) }, actualizado: Date.now() }, { merge: true })
    .catch(err => alert(`No se pudo guardar: ${err && err.message ? err.message : err}`));
}

// ---- Texto (memoria → caché → red) ----
async function cargarLibro(id) {
  if (memoria.has(id)) return memoria.get(id);
  const url = T.url(id);
  let res = null;
  try {
    if ("caches" in window) {
      const cache = await caches.open(T.CACHE);
      res = await cache.match(url);
      if (!res) {
        res = await fetch(url);
        if (res.ok) await cache.put(url, res.clone());
      }
    }
  } catch (e) { res = null; }
  if (!res) res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  memoria.set(id, d);
  if (memoria.size > MEMORIA_MAX) memoria.delete(memoria.keys().next().value);
  return d;
}
// ¿Cuántos libros están guardados para leer sin internet?
async function descargados() {
  if (!("caches" in window)) return 0;
  try {
    const keys = await (await caches.open(T.CACHE)).keys();
    const quiero = new Set(B.LIBROS.map(l => new URL(T.url(l.id), location.href).href));
    return keys.filter(r => quiero.has(r.url)).length;
  } catch (e) { return 0; }
}
let descargando = false;
async function descargarTodo(progreso) {
  if (descargando || !("caches" in window)) return;
  descargando = true;
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    const cache = await caches.open(T.CACHE);
    let n = 0;
    const cola = B.LIBROS.slice();
    const trabajar = async () => {
      while (cola.length) {
        const l = cola.shift();
        const url = T.url(l.id);
        if (!(await cache.match(url))) {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          await cache.put(url, res);
        }
        progreso(++n);
      }
    };
    await Promise.all([trabajar(), trabajar(), trabajar()]);
  } finally { descargando = false; }
}
async function quitarDescarga() {
  if (!("caches" in window)) return;
  await caches.delete(T.CACHE);
  memoria.clear();
}

// ---- Pantalla ----
const el = document.createElement("div");
el.className = "bbl-lector";
el.id = "bbl-lector";
el.hidden = true;
el.setAttribute("role", "dialog");
el.setAttribute("aria-modal", "true");
el.setAttribute("aria-label", "Leer la Biblia");
el.innerHTML = `
  <header class="bbl-barra">
    <button type="button" class="bbl-icono" data-bbl="cerrar" aria-label="Cerrar el lector"><span class="icon-sm" data-icon="close"></span></button>
    <button type="button" class="bbl-donde" data-bbl="elegir" aria-haspopup="dialog"><span id="bbl-donde-t">Biblia</span><span class="bbl-flecha" aria-hidden="true">▾</span></button>
    <button type="button" class="bbl-icono bbl-aa" data-bbl="aa" aria-label="Letra, ortografía y descarga">Aa</button>
  </header>
  <div class="bbl-scroll" id="bbl-scroll">
    <article class="bbl-texto" id="bbl-texto" aria-live="polite"></article>
  </div>`;
document.body.appendChild(el);
const scroll = el.querySelector("#bbl-scroll");
const art = el.querySelector("#bbl-texto");
const hojaSel = window.Lectura.hoja("bbl-hoja-sel");
const hojaAa = window.Lectura.hoja("bbl-hoja-aa");

function aplicarTam() { art.style.setProperty("--bbl-tam", `${TAMS[ajustes.tam] || TAMS[2]}rem`); }

function abrir(libro, cap, opciones) {
  const o = opciones || {};
  const ult = ajustes.ultimo;
  const l = B.libro(libro) ? libro : (ult && B.libro(ult.libro) ? ult.libro : "Matt");
  const c = Math.min(Math.max(1, Number(cap) || (l === (ult && ult.libro) ? ult.cap : 1)), B.libro(l).capitulos);
  if (el.hidden) {
    el.hidden = false;
    document.body.classList.add("bbl-leyendo");
    history.pushState({ bblLector: true }, "");
  }
  aplicarTam();
  irA(l, c, { y: o.y != null ? o.y : (ult && ult.libro === l && ult.cap === c ? ult.y : 0), marcar: o.marcar });
}
function cerrar(desdeHistoria) {
  if (el.hidden) return;
  el.hidden = true;
  document.body.classList.remove("bbl-leyendo");
  hojaSel.cerrar();
  hojaAa.cerrar();
  recordarScroll(true);
  if (!desdeHistoria && history.state && history.state.bblLector) history.back();
}
window.addEventListener("popstate", () => { if (!el.hidden) cerrar(true); });

async function irA(libro, cap, o) {
  lugar = { libro, cap };
  const l = B.libro(libro);
  el.querySelector("#bbl-donde-t").textContent = `${l.nombre} ${cap}`;
  const yo = ++cargando;
  if (!datos || datos.libro !== libro) {
    art.innerHTML = `<p class="bbl-cargando">Abriendo ${esc(l.nombre)}…</p>`;
    try {
      datos = await cargarLibro(libro);
    } catch (err) {
      if (yo !== cargando) return;
      datos = null;
      art.innerHTML = `<div class="bbl-error"><p><b>No se pudo abrir ${esc(l.nombre)}.</b></p>
        <p>${navigator.onLine === false ? "Estás sin internet y este libro no está descargado. Con internet, toca «Aa» › «Descargar la Biblia» para leerla siempre sin conexión." : "Revisa tu conexión e intenta otra vez."}</p>
        <button type="button" class="lib-btn" data-bbl="reintentar">Intentar otra vez</button></div>`;
      return;
    }
  }
  if (yo !== cargando) return;
  pintar(o && o.marcar);
  scroll.scrollTop = 0;
  if (o && o.y) requestAnimationFrame(() => { scroll.scrollTop = o.y * Math.max(0, scroll.scrollHeight - scroll.clientHeight); });
  guardarAjustes({ ultimo: { libro, cap, y: (o && o.y) || 0 } });
}

function pintar(marcar) {
  const { libro, cap } = lugar;
  const l = B.libro(libro);
  const vs = (datos.caps[cap - 1] || []);
  const poesia = T.esPoesia(libro);
  const versos = vs.map((t, i) => (t ? `<span class="bbl-v${marcar && marcar.includes(i + 1) ? " is-marcado" : ""}" data-v="${i + 1}" id="bbl-v${i + 1}"><sup class="bbl-n">${i + 1}</sup>${esc(T.mostrar(t, { actual: ajustes.actual, numero: i + 1 }))} </span>` : "")).join(poesia ? "" : "");
  const k = T.claveCap(libro, cap);
  const hoy = hoyLocal();
  const leidoHoy = (leidos[hoy] || []).includes(k);
  const antes = !leidoHoy && fechaLeido(k);
  const prev = T.vecino(libro, cap, -1), next = T.vecino(libro, cap, 1);
  const nombre = x => `${B.libro(x.libro).nombre} ${x.cap}`;
  art.innerHTML = `
    <p class="bbl-libro">${esc(l.nombre)}</p>
    <h2 class="bbl-cap">${cap}</h2>
    <div class="bbl-versos${poesia ? " is-poesia" : ""}">${versos}</div>
    <div class="bbl-fin">
      ${leidoHoy
        ? `<button type="button" class="bbl-leido is-hecho" data-bbl="desmarcar" aria-pressed="true">✓ Leído hoy</button>`
        : `<button type="button" class="lib-btn lib-btn-ancho" data-bbl="leido">Marcar como leído</button>
           ${antes ? `<p class="lib-nota">Ya lo leíste el ${esc(B.fechaLarga(antes))}.</p>` : ""}`}
      <div class="bbl-nav">
        ${prev ? `<button type="button" class="lib-btn-sec" data-bbl-ir="${prev.libro}.${prev.cap}">‹ ${esc(nombre(prev))}</button>` : "<span></span>"}
        ${next ? `<button type="button" class="${leidoHoy ? "lib-btn" : "lib-btn-sec"}" data-bbl-ir="${next.libro}.${next.cap}">${esc(nombre(next))} ›</button>` : "<span></span>"}
      </div>
      <a class="bbl-otra" href="${esc(T.linkOtraVersion(libro, cap, null, ajustes.version))}" target="_blank" rel="noopener">Abrir en otra versión (${esc(ajustes.version)}) ↗</a>
      <p class="bbl-fuente">Reina-Valera 1909 · dominio público${ajustes.actual ? " · ortografía actual" : ""}</p>
    </div>`;
  if (marcar && marcar.length) {
    const v = el.querySelector(`#bbl-v${marcar[0]}`);
    if (v) requestAnimationFrame(() => { scroll.scrollTop = Math.max(0, v.offsetTop - 90); });
  }
}

function recordarScroll(ya) {
  if (!lugar) return;
  const max = Math.max(1, scroll.scrollHeight - scroll.clientHeight);
  const y = Math.round(Math.min(1, scroll.scrollTop / max) * 100) / 100;
  if (ajustes.ultimo && ajustes.ultimo.libro === lugar.libro && ajustes.ultimo.cap === lugar.cap && ajustes.ultimo.y === y && !ya) return;
  guardarAjustes({ ultimo: { libro: lugar.libro, cap: lugar.cap, y } }, ya);
}
let scrollTimer = null;
scroll.addEventListener("scroll", () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(() => recordarScroll(false), 600); }, { passive: true });

// Deslizar de lado: capítulo anterior o siguiente.
let toque = null;
scroll.addEventListener("touchstart", e => { const t = e.touches[0]; toque = { x: t.clientX, y: t.clientY, ms: Date.now() }; }, { passive: true });
scroll.addEventListener("touchend", e => {
  if (!toque || !lugar) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - toque.x, dy = t.clientY - toque.y;
  toque = null;
  if (Math.abs(dx) < 80 || Math.abs(dy) > 50 || Math.abs(dx) < Math.abs(dy) * 2) return;
  if (window.getSelection && String(window.getSelection()).length) return;
  const v = T.vecino(lugar.libro, lugar.cap, dx < 0 ? 1 : -1);
  if (v) irA(v.libro, v.cap);
}, { passive: true });

// ---- Hoja: elegir libro y capítulo ----
function hojaLibros(filtro) {
  const leidos = leidosSet();
  const q = B.normalizar(filtro || "");
  const grupo = t => {
    const ls = B.LIBROS.filter(l => l.testamento === t && (!q || B.normalizar(l.nombre).includes(q)));
    if (!ls.length) return "";
    return `<h4 class="bbl-sel-t">${t === "AT" ? "Antiguo Testamento" : "Nuevo Testamento"}</h4>
      <div class="bbl-libros">${ls.map(l => {
        let n = 0;
        for (let c = 1; c <= l.capitulos; c++) if (leidos.has(T.claveCap(l.id, c))) n++;
        return `<button type="button" class="bbl-libro-b${lugar && lugar.libro === l.id ? " is-actual" : ""}" data-bbl-libro="${l.id}">
          <span>${esc(l.nombre)}</span><small>${n ? `${n}/${l.capitulos}` : l.capitulos}</small></button>`;
      }).join("")}</div>`;
  };
  return grupo("AT") + grupo("NT") || `<p class="empty-state">Ningún libro se llama así.</p>`;
}
function abrirSelector() {
  hojaSel.abrir("Elegir libro", `
    <input type="search" class="lib-input bbl-sel-buscar" placeholder="Buscar libro (ej: salmos)" autocomplete="off" aria-label="Buscar libro">
    <div class="bbl-sel-lista">${hojaLibros("")}</div>`);
}
function abrirCapitulos(id) {
  const l = B.libro(id);
  const leidos = leidosSet();
  let html = `<button type="button" class="bbl-sel-volver" data-bbl="libros">‹ Libros</button><div class="bbl-caps">`;
  for (let c = 1; c <= l.capitulos; c++) {
    const actual = lugar && lugar.libro === id && lugar.cap === c;
    html += `<button type="button" class="bbl-cap-b${leidos.has(T.claveCap(id, c)) ? " is-leido" : ""}${actual ? " is-actual" : ""}" data-bbl-ir="${id}.${c}" aria-label="${esc(l.nombre)} ${c}${leidos.has(T.claveCap(id, c)) ? " (leído)" : ""}">${c}</button>`;
  }
  hojaSel.abrir(l.nombre, html + `</div><p class="lib-nota">✓ = capítulos que ya leíste.</p>`);
}
hojaSel.el.addEventListener("input", e => {
  if (!e.target.classList.contains("bbl-sel-buscar")) return;
  hojaSel.el.querySelector(".bbl-sel-lista").innerHTML = hojaLibros(e.target.value);
});
hojaSel.el.addEventListener("click", e => {
  const lb = e.target.closest("[data-bbl-libro]");
  if (lb) {
    const l = B.libro(lb.dataset.bblLibro);
    if (l.capitulos === 1) { hojaSel.cerrar(); irA(l.id, 1); } else abrirCapitulos(l.id);
    return;
  }
  const ir = e.target.closest("[data-bbl-ir]");
  if (ir) { const k = T.leerClave(ir.dataset.bblIr); hojaSel.cerrar(); irA(k.libro, k.cap); return; }
  if (e.target.closest('[data-bbl="libros"]')) abrirSelector();
});

// ---- Hoja: letra, ortografía, versión y descarga ----
function abrirAa() {
  hojaAa.abrir("Lectura", `
    <div class="bbl-aa-fila">
      <span>Tamaño de letra</span>
      <div class="bbl-aa-tam">
        <button type="button" class="lib-btn-sec" data-bbl-tam="-1" aria-label="Letra más chica"${ajustes.tam <= 0 ? " disabled" : ""}>A−</button>
        <button type="button" class="lib-btn-sec" data-bbl-tam="1" aria-label="Letra más grande"${ajustes.tam >= TAMS.length - 1 ? " disabled" : ""}>A+</button>
      </div>
    </div>
    <label class="bbl-aa-fila bbl-switch">
      <span>Ortografía actual<small>«vino á Jesús» → «vino a Jesús». El texto original no se cambia.</small></span>
      <input type="checkbox" data-bbl-op="actual"${ajustes.actual ? " checked" : ""}>
    </label>
    <label class="lib-campo"><span>Versión para «Abrir en otra versión»</span>
      <select class="lib-input" data-bbl-op="version">
        ${T.OTRAS.map(o => `<option value="${o.id}"${o.id === ajustes.version ? " selected" : ""}>${esc(o.nombre)} (${esc(o.id)})</option>`).join("")}
      </select>
    </label>
    <p class="lib-nota">Esas versiones tienen derechos de autor: se abren en BibleGateway con un link.</p>
    <div class="bbl-descarga" id="bbl-descarga"><p class="lib-nota">Revisando la descarga…</p></div>`);
  pintarDescarga();
}
async function pintarDescarga(texto) {
  const caja = hojaAa.el.querySelector("#bbl-descarga");
  if (!caja) return;
  if (!("caches" in window)) { caja.innerHTML = `<p class="lib-nota">Este navegador no permite guardar la Biblia sin internet.</p>`; return; }
  const n = await descargados();
  if (texto) { caja.innerHTML = `<p class="bbl-desc-estado">${esc(texto)}</p>`; return; }
  caja.innerHTML = n >= 66
    ? `<p class="bbl-desc-estado is-hecho">✓ La Biblia está descargada: se lee sin internet.</p>
       <button type="button" class="lib-btn-sec" data-bbl="quitar-descarga">Quitar la descarga (libera ~4 MB)</button>`
    : `<p class="bbl-desc-estado">${n ? `Guardados para leer sin internet: ${n} de 66 libros.` : "Cada libro se guarda al abrirlo."}</p>
       <button type="button" class="lib-btn lib-btn-ancho" data-bbl="descargar">Descargar la Biblia para usar sin internet (~4 MB)</button>`;
}
hojaAa.el.addEventListener("click", e => {
  const t = e.target.closest("[data-bbl-tam]");
  if (t) {
    const n = Math.min(TAMS.length - 1, Math.max(0, ajustes.tam + Number(t.dataset.bblTam)));
    guardarAjustes({ tam: n });
    aplicarTam();
    hojaAa.el.querySelector('[data-bbl-tam="-1"]').disabled = n <= 0;
    hojaAa.el.querySelector('[data-bbl-tam="1"]').disabled = n >= TAMS.length - 1;
    return;
  }
  const b = e.target.closest("[data-bbl]");
  if (!b) return;
  if (b.dataset.bbl === "descargar") {
    b.disabled = true;
    descargarTodo(n => pintarDescarga(`Descargando… ${n} de 66 libros`))
      .then(() => pintarDescarga())
      .catch(() => pintarDescarga("No se pudo terminar (¿sin internet?). Lo ya bajado queda guardado; intenta otra vez con conexión."));
  } else if (b.dataset.bbl === "quitar-descarga") {
    if (!confirm("¿Quitar la Biblia descargada? Tus versículos y lo leído no se borran; cada libro se vuelve a guardar al abrirlo.")) return;
    quitarDescarga().then(() => pintarDescarga());
  }
});
hojaAa.el.addEventListener("change", e => {
  const op = e.target.dataset.bblOp;
  if (op === "actual") { guardarAjustes({ actual: e.target.checked }, true); if (datos && lugar) pintar(); }
  else if (op === "version") { guardarAjustes({ version: e.target.value }, true); if (datos && lugar) pintar(); }
});

// ---- Clicks del lector ----
el.addEventListener("click", e => {
  const ir = e.target.closest("[data-bbl-ir]");
  if (ir) { const k = T.leerClave(ir.dataset.bblIr); irA(k.libro, k.cap); return; }
  const b = e.target.closest("[data-bbl]");
  if (!b) return;
  const a = b.dataset.bbl;
  if (a === "cerrar") cerrar();
  else if (a === "elegir") abrirSelector();
  else if (a === "aa") abrirAa();
  else if (a === "reintentar" && lugar) irA(lugar.libro, lugar.cap);
  else if (a === "leido" && lugar) { marcarLeido(lugar.libro, lugar.cap, true); pintar(); }
  else if (a === "desmarcar" && lugar) { marcarLeido(lugar.libro, lugar.cap, false); pintar(); }
});
document.addEventListener("keydown", e => {
  if (el.hidden || hojaSel.abierta() || hojaAa.abierta()) return;
  if (e.key === "Escape") cerrar();
  else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && lugar && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) {
    const v = T.vecino(lugar.libro, lugar.cap, e.key === "ArrowRight" ? 1 : -1);
    if (v) irA(v.libro, v.cap);
  }
});

// ---- Datos ----
onAuthReady(() => {
  meta("biblia_lector").onSnapshot(s => {
    const d = s.exists ? s.data() : {};
    // Gana lo más nuevo entre este teléfono y la cuenta (otro aparato).
    if ((d.actualizado || 0) <= (ajustes.ts || 0)) return;
    ["tam", "actual", "version"].forEach(k => { if (d[k] != null) ajustes[k] = d[k]; });
    if (d.ultimo && B.libro(d.ultimo.libro)) ajustes.ultimo = d.ultimo;
    ajustes.ts = d.actualizado;
    guardarLocal();
    avisar();
  }, err => console.warn("Biblia lector:", err));
  meta("biblia_leidos").onSnapshot(s => {
    leidos = (s.exists && s.data().dias) || {};
    avisar();
    if (!el.hidden && datos && lugar) {
      const y = scroll.scrollTop;
      pintar();
      scroll.scrollTop = y;
    }
  }, err => console.warn("Biblia leídos:", err));
});

window.BibliaLector = {
  abrir, cerrar, cargarLibro, descargados,
  ultimo: () => (ajustes.ultimo && B.libro(ajustes.ultimo.libro) ? ajustes.ultimo : null),
  ajustes: () => Object.assign({}, ajustes),
  leidos: () => leidos,
  leidosSet,
  alCambiar: cb => oyentes.push(cb)
};
})();
