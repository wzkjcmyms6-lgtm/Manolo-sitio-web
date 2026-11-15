// ---------- Libros: escanear el código de barras (pantalla, fase 5d) ----------
// "📷 Escanear el código de barras" (en "Buscar el libro") abre esta hoja:
//  - Sacar foto del código: lo más confiable en el iPhone (la cámara del
//    sistema enfoca de cerca). La foto se lee acá mismo; no sale del teléfono.
//  - Elegir una foto (de Fotos o Archivos).
//  - Cámara en vivo: lee mientras apuntas, dentro del recuadro.
// El lector (js/libros-isbn.js, unos 14 KB) se carga recién al tocar
// "Escanear" y queda guardado para usarlo sin internet. Si el navegador
// trae su propio lector (BarcodeDetector: Chrome, Android), va primero.
// Al leer un ISBN avisa con el evento "libros:isbn" y libros.js busca el
// libro en Open Library como si lo hubieras escrito. D-111.
(function () {
"use strict";
if (!window.Lectura) return;
const hoja = window.Lectura.hoja("lesc-hoja");
const LECTOR = "js/libros-isbn.js";
const NO_ENCONTRE = "No encontré el código en la foto. Prueba otra: más cerca, con buena luz, el código derecho y sin reflejos.";
let cargando = null;     // promesa del lector
let detector;            // BarcodeDetector (null si no hay; undefined: sin revisar)
let flujo = null;        // cámara en vivo
let reloj = null;
let vistos = {};         // código → veces que lo leyó la cámara en vivo
let turno = 0;           // para ignorar una foto vieja si eliges otra

function cargar() {
  if (window.LibrosIsbn) return Promise.resolve(window.LibrosIsbn);
  cargando = cargando || new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = LECTOR;
    s.onload = () => (window.LibrosIsbn ? ok(window.LibrosIsbn) : mal(new Error("sin lector")));
    s.onerror = () => { s.remove(); mal(new Error("No se pudo cargar el lector")); };
    document.head.appendChild(s);
  }).catch(err => { cargando = null; throw err; });
  return cargando;
}
async function detectorListo() {
  if (detector !== undefined) return detector;
  detector = null;
  try {
    if (typeof window.BarcodeDetector === "function") {
      const formatos = await window.BarcodeDetector.getSupportedFormats();
      if (formatos.includes("ean_13")) detector = new window.BarcodeDetector({ formats: ["ean_13"] });
    }
  } catch (err) { detector = null; }
  return detector;
}
async function conDetector(fuente, I) {
  const d = await detectorListo();
  if (!d) return null;
  try {
    const r = await d.detect(fuente);
    return (r.map(x => String(x.rawValue || "")).find(I.ean13Valido)) || null;
  } catch (err) { return null; }
}

// ---- La hoja ----
function abrir() {
  turno++;
  detener();
  const vivo = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  hoja.abrir("Escanear el código", `
    <div class="lesc">
      <div class="lesc-inicio">
        <p>Busca el código de barras en la contratapa: el que dice <b>ISBN</b> y empieza con 978 o 979.</p>
        <label class="lib-btn lib-btn-ancho lesc-archivo">📷 Sacar foto del código<input type="file" accept="image/*" capture="environment" data-lesc-foto aria-label="Sacar foto del código de barras"></label>
        <p class="lib-ayuda">De cerca, con buena luz y el código derecho. Es lo que mejor funciona en el iPhone.</p>
        <div class="lesc-otros">
          <label class="lib-btn-sec lib-btn-chico lesc-archivo">🖼️ Elegir una foto<input type="file" accept="image/*" data-lesc-foto aria-label="Elegir una foto del código de barras"></label>
          ${vivo ? `<button type="button" class="lib-btn-sec lib-btn-chico" data-lesc="vivo">🎥 Cámara en vivo</button>` : ""}
        </div>
      </div>
      <div class="lesc-vivo" data-lesc-vivo hidden>
        <div class="lesc-video"><video playsinline muted autoplay></video><span class="lesc-guia" aria-hidden="true"></span></div>
        <p class="lib-ayuda">Pon el código dentro del recuadro, derecho. Si se ve borroso, aleja un poco el teléfono.</p>
        <button type="button" class="lib-btn-sec lib-btn-ancho" data-lesc="parar">Parar la cámara</button>
      </div>
      <p class="lesc-estado" data-lesc-estado role="status" aria-live="polite" hidden></p>
    </div>`);
}
function estado(texto, tipo) {
  const el = hoja.el.querySelector("[data-lesc-estado]");
  if (!el) return;
  el.hidden = !texto;
  el.textContent = texto || "";
  el.className = `lesc-estado${tipo ? ` is-${tipo}` : ""}`;
}
// Leyó un código: si es de un libro, cierra y lo busca.
function resultado(codigo, I) {
  if (!codigo) { estado(NO_ENCONTRE, "error"); return false; }
  if (!I.esIsbn13(codigo)) { estado(`Ese código (${codigo.slice(0, 3)}…) no es de un libro. Busca el que dice ISBN y empieza con 978 o 979.`, "error"); return false; }
  detener();
  estado(`✓ Leí el ISBN ${codigo}. Buscando el libro…`, "ok");
  setTimeout(() => {
    hoja.cerrar();
    document.dispatchEvent(new CustomEvent("libros:isbn", { detail: { isbn: codigo } }));
  }, 450);
  return true;
}

// ---- Una foto ----
function abrirImagen(archivo) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error("imagen")); };
    img.src = url;
  });
}
// Los píxeles de la imagen con su lado mayor en `lado` px (o menos).
function pixeles(fuente, ancho, alto, lado) {
  const k = Math.min(1, lado / Math.max(ancho, alto));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(ancho * k));
  c.height = Math.max(1, Math.round(alto * k));
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(fuente, 0, 0, c.width, c.height);
  const datos = g.getImageData(0, 0, c.width, c.height);
  c.width = c.height = 0;     // el iPhone libera la memoria del lienzo
  return datos;
}
async function leerFoto(archivo) {
  const mio = ++turno;
  detener();
  estado("Leyendo la foto…");
  let I, img;
  try { [I, img] = await Promise.all([cargar(), abrirImagen(archivo)]); }
  catch (err) { if (mio === turno) estado(err && err.message === "imagen" ? "No pude abrir esa imagen. Prueba con otra foto." : "No pude cargar el lector. Revisa tu internet y vuelve a intentar.", "error"); return; }
  if (mio !== turno) return;
  let codigo = await conDetector(img, I);
  // Grande primero (código chico en la foto); más chica, si no (menos ruido).
  for (const lado of [2000, 1100]) {
    if (codigo) break;
    const r = I.leerImagen(pixeles(img, img.naturalWidth, img.naturalHeight, lado));
    // Con una sola línea vale si es de un libro (978/979: un error al azar casi nunca empieza así).
    if (r && (r.votos >= 2 || I.esIsbn13(r.codigo))) codigo = r.codigo;
  }
  if (mio === turno) resultado(codigo, I);
}

// ---- Cámara en vivo ----
async function vivo() {
  const mio = ++turno;
  estado("Abriendo la cámara…");
  let I;
  try {
    I = await cargar();
    const f = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
    if (mio !== turno || !hoja.abierta()) { f.getTracks().forEach(t => t.stop()); return; }
    flujo = f;
  } catch (err) {
    if (mio !== turno) return;
    detener();
    const permiso = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
    estado(permiso ? "No hay permiso para la cámara. Puedes darlo en Ajustes › Safari › Cámara, o sacar una foto del código."
      : err && err.message === "No se pudo cargar el lector" ? "No pude cargar el lector. Revisa tu internet y vuelve a intentar."
      : "No pude abrir la cámara. Mejor saca una foto del código.", "error");
    return;
  }
  // Mientras filma, la cámara arriba de todo (fuera de la vista, el
  // navegador deja de mostrar cuadros).
  const caja = hoja.el.querySelector("[data-lesc-vivo]"), video = caja.querySelector("video");
  caja.hidden = false;
  hoja.el.querySelector(".lesc").classList.add("is-vivo");
  const cuerpo = hoja.el.querySelector(".lib-hoja-cuerpo");
  if (cuerpo) cuerpo.scrollTop = 0;
  video.srcObject = flujo;
  try { await video.play(); } catch (err) { /* autoplay: igual muestra cuadros */ }
  estado("Apunta al código…");
  vistos = {};
  const lienzo = document.createElement("canvas");
  const paso = async () => {
    if (!flujo || mio !== turno) return;
    let codigo = null;
    if (video.readyState >= 2 && video.videoWidth) {
      if (await detectorListo()) codigo = await conDetector(video, I);
      else {
        // La franja del medio (donde está el recuadro), a 1280 px como mucho.
        const vw = video.videoWidth, vh = video.videoHeight;
        const zx = vw * 0.05, zy = vh * 0.25, zw = vw * 0.9, zh = vh * 0.5, k = Math.min(1, 1280 / zw);
        lienzo.width = Math.round(zw * k);
        lienzo.height = Math.round(zh * k);
        const g = lienzo.getContext("2d", { willReadFrequently: true });
        g.drawImage(video, zx, zy, zw, zh, 0, 0, lienzo.width, lienzo.height);
        const r = I.leerImagen(g.getImageData(0, 0, lienzo.width, lienzo.height), { filas: 14, diagonales: false, basta: 2 });
        if (r) {
          vistos[r.codigo] = (vistos[r.codigo] || 0) + r.votos;
          if (vistos[r.codigo] >= 2) codigo = r.codigo;
        }
      }
    }
    if (!flujo || mio !== turno) return;
    // Un código que no es de libro: avisa y sigue buscando.
    if (codigo && resultado(codigo, I)) return;
    if (codigo) vistos[codigo] = -1000;
    reloj = setTimeout(paso, 160);
  };
  paso();
}
function detener() {
  clearTimeout(reloj);
  reloj = null;
  if (flujo) flujo.getTracks().forEach(t => t.stop());
  flujo = null;
  const caja = hoja.el.querySelector("[data-lesc-vivo]");
  if (caja) {
    const video = caja.querySelector("video");
    if (video) { try { video.pause(); } catch (err) { /* nada */ } video.srcObject = null; }
    caja.hidden = true;
  }
  const lesc = hoja.el.querySelector(".lesc");
  if (lesc) lesc.classList.remove("is-vivo");
}

hoja.el.addEventListener("change", e => {
  const input = e.target.closest("[data-lesc-foto]");
  if (!input || !input.files || !input.files[0]) return;
  const archivo = input.files[0];
  input.value = "";
  leerFoto(archivo);
});
hoja.el.addEventListener("click", e => {
  const b = e.target.closest("[data-lesc]");
  if (b && b.dataset.lesc === "vivo") vivo();
  else if (b && b.dataset.lesc === "parar") { turno++; detener(); estado(""); }
});
// Al cerrar la hoja (o salir de la app) se apaga la cámara.
new MutationObserver(() => { if (hoja.el.hidden) { turno++; detener(); } }).observe(hoja.el, { attributes: true, attributeFilter: ["hidden"] });
document.addEventListener("visibilitychange", () => { if (document.hidden && flujo) { turno++; detener(); estado("Se apagó la cámara. Toca «Cámara en vivo» para seguir."); } });
document.addEventListener("click", e => {
  if (!e.target.closest("[data-lib-escanear]")) return;
  abrir();
  // El lector se va cargando mientras eliges.
  cargar().catch(() => {});
});

window.LibrosEscaner = { abrir, cargar };
})();
