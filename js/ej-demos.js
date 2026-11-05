// ---------- Demos de los ejercicios (D-091) ----------
// Cada ejercicio de la base con demo: 1 tiene 2 fotos (inicio y final del
// movimiento) en img/ejercicios/{id}/0.webp y 1.webp (las genera
// scripts/build-demos.mjs desde free-exercise-db, dominio público).
// - Se muestran una sobre otra y se alternan con un fundido suave, como un
//   video corto en bucle (CSS). Botón de pausa. Con "reducir movimiento"
//   se ven quietas, una al lado de la otra.
// - No van en el precache del service worker: se bajan al abrir una ficha y
//   quedan en una caché con límite. Las de los ejercicios de tus rutinas se
//   guardan aparte (precarga) para verlas sin señal en el gimnasio.
// La parte sin DOM (rutas, qué precargar) se prueba en tests/ej-demos.test.js.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EjDemos = api;
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const VERSION = "1"; // subir si se regeneran las imágenes (nueva URL = nueva copia)
const CREDITO = "Imágenes: free-exercise-db (dominio público)";

function rutas(id) {
  return [0, 1].map(i => `img/ejercicios/${encodeURIComponent(id)}/${i}.webp?v=${VERSION}`);
}
function tieneDemo(ficha) {
  return !!(ficha && ficha.demo);
}
// Ids con demo de los ejercicios de tus rutinas (sin repetir).
// resolver(item) → ficha o null.
function idsDeRutinas(rutinas, resolver) {
  const out = [];
  const vistos = new Set();
  (rutinas || []).forEach(r => (r.items || []).forEach(it => {
    const f = resolver(it);
    if (!tieneDemo(f) || vistos.has(f.id)) return;
    vistos.add(f.id);
    out.push(f.id);
  }));
  return out;
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
// Marcado de la demo (las imágenes se piden recién cuando se pinta).
function html(ficha, opciones) {
  if (!tieneDemo(ficha)) return "";
  const o = opciones || {};
  const [a, b] = rutas(ficha.id);
  return `<figure class="ejd-demo${o.chica ? " is-chica" : ""}" data-demo="${esc(ficha.id)}">
      <div class="ejd-demo-marco">
        <img class="ejd-demo-img is-a" src="${a}" alt="${esc(ficha.nombre)}: inicio del movimiento" decoding="async">
        <img class="ejd-demo-img is-b" src="${b}" alt="${esc(ficha.nombre)}: final del movimiento" decoding="async">
        <span class="ejd-demo-etq is-a" aria-hidden="true">Inicio</span><span class="ejd-demo-etq is-b" aria-hidden="true">Final</span>
        <button type="button" class="ejd-demo-pausa" data-demo-pausa aria-pressed="false" aria-label="Pausar la demo"><span class="ejd-ico-pausa" aria-hidden="true"></span></button>
        <p class="ejd-demo-sinred" hidden>La demo se verá cuando haya conexión.</p>
      </div>
      ${o.sinCredito ? "" : `<figcaption class="ejd-credito">${CREDITO}</figcaption>`}
    </figure>`;
}

// ---- Navegador ----
// Pausa / sigue (delegado: sirve para todas las demos de la página).
function alClick(e) {
  const b = e.target.closest && e.target.closest("[data-demo-pausa]");
  if (!b) return;
  const fig = b.closest(".ejd-demo");
  const pausada = !fig.classList.contains("is-pausada");
  fig.classList.toggle("is-pausada", pausada);
  b.setAttribute("aria-pressed", String(pausada));
  b.setAttribute("aria-label", pausada ? "Seguir la demo" : "Pausar la demo");
}
// Sin conexión y sin copia: aviso en lugar de una imagen rota.
function alError(e) {
  const img = e.target;
  if (!img || !img.classList || !img.classList.contains("ejd-demo-img")) return;
  const fig = img.closest(".ejd-demo");
  if (!fig || fig.classList.contains("is-sinred")) return;
  fig.classList.add("is-sinred");
  const p = fig.querySelector(".ejd-demo-sinred");
  if (p) p.hidden = false;
}

// Precarga las demos de tus rutinas (una vez por cambio de la lista).
let ultimaPrecarga = "";
function precargarRutinas(rutinas, resolver) {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return [];
  const ids = idsDeRutinas(rutinas, resolver);
  const clave = ids.join(",");
  if (!ids.length || clave === ultimaPrecarga) return ids;
  // Con "ahorro de datos" no se precarga (se bajan al abrir cada ficha).
  if (navigator.connection && navigator.connection.saveData) return ids;
  ultimaPrecarga = clave;
  const urls = ids.flatMap(rutas).map(u => new URL(u, location.href).href);
  navigator.serviceWorker.ready.then(reg => {
    if (reg.active) reg.active.postMessage({ tipo: "demos", urls });
  }).catch(() => { ultimaPrecarga = ""; });
  return ids;
}

if (typeof document !== "undefined") {
  document.addEventListener("click", alClick);
  document.addEventListener("error", alError, true);
}

return { VERSION, CREDITO, rutas, tieneDemo, idsDeRutinas, html, precargarRutinas };
});
