// ---------- Ropa: la IA y Pinterest, por el puente (D-147 / D-148) ----------
// Manolo no guarda ninguna clave: le pide al puente (puente/, un Worker en
// Cloudflare) con el token de tu sesión de Firebase; el puente revisa que seas
// el dueño, llama a la IA y lleva la cuenta del gasto del mes con su tope.
// A la IA solo le llega la foto o las listas de ropa (ni tu nombre ni tu
// usuario). El puente también lee Pinterest (que no deja leerlo directo desde
// el teléfono): tu tablero, los pines que pegas y sus imágenes.
// window.RopaIA: puente(), quien(forzar), disponible(), pinterest(),
// describir(blob), analizar(blob), look(pin, ropero), estilo(pines),
// tablero(datos), pin(link), imagen(url), outfits(datos), version(),
// estilista(), charla(datos), opinar(datos), opinion(datos),
// gasto(), tope(usd), alCambiar(fn), estado(), fallo(), sinInternet().
(function () {
"use strict";
// La dirección del puente (instalado en la cuenta de Cloudflare del dueño,
// 2026-11-24). En las pruebas se cambia con localStorage "manolo.puente": otra
// dirección (un puente de mentira) o "ninguno" (sin puente).
const PUENTE = "https://manolo-puente.manolo-ropa-482.workers.dev";
const puente = () => {
  try { const v = localStorage.getItem("manolo.puente"); return v === "ninguno" ? "" : (v || PUENTE); } catch (e) { return PUENTE; }
};
let estado = null;            // lo último de /quien: { permitido, uid, lista, gasto }
let fallo = "";               // por qué no contestó /quien la última vez ("" si contestó)
let consultando = null;
const oyentes = [];
const avisar = () => oyentes.forEach(f => { try { f(estado); } catch (e) { console.error(e); } });

function error(codigo, mensaje, extra) { const e = new Error(mensaje); e.codigo = codigo; e.ia = true; if (extra) e.datos = extra; return e; }
// comoBlob: la respuesta es una imagen (Pinterest), no JSON.
async function pedir(ruta, cuerpo, comoBlob) {
  const base = puente();
  if (!base) throw error("sin-puente", "La IA todavía no está conectada.");
  if (navigator.onLine === false) throw error("sin-internet", "Para esto hace falta internet.");
  if (typeof currentUser === "undefined" || !currentUser || !currentUser.getIdToken) throw error("sesion", "Vuelve a iniciar sesión en Manolo.");
  const token = await currentUser.getIdToken();
  let r;
  try {
    r = await fetch(base.replace(/\/+$/, "") + ruta, {
      method: cuerpo ? "POST" : "GET",
      headers: Object.assign({ Authorization: `Bearer ${token}` }, cuerpo ? { "Content-Type": "application/json" } : {}),
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
  } catch (e) { throw error("red", "No pude conectarme. Revisa tu conexión."); }
  if (comoBlob && r.ok) {
    const b = await r.blob();
    if (!/^image\//.test(b.type)) throw error("imagen", "No pude traer esa imagen de Pinterest.");
    return b;
  }
  const j = await r.json().catch(() => ({}));
  if (j && j.gasto && estado) { estado.gasto = j.gasto; avisar(); }
  if (!r.ok) throw error(j.error || `http-${r.status}`, j.mensaje || "No respondió. Intenta de nuevo.", j);
  return j;
}
// Lo último que contestó /quien en este teléfono (sin el gasto): si abres
// Manolo sin internet, igual se sabe que la IA es tuya y avisa que necesita
// conexión (D-152).
const GUARDADO = "manolo.ropa.ia";
function recordar(j) {
  try { localStorage.setItem(GUARDADO, JSON.stringify({ uid: String(j.uid || ""), permitido: !!j.permitido, lista: !!j.lista })); } catch (e) { /* sin lugar */ }
}
function recordado() {
  try {
    const r = JSON.parse(localStorage.getItem(GUARDADO) || "null");
    const uid = typeof currentUser !== "undefined" && currentUser ? currentUser.uid : "";
    return r && uid && r.uid === uid ? r : null;
  } catch (e) { return null; }
}
// ¿Quién soy para el puente? (se pregunta una vez por sesión)
function quien(forzar) {
  if (!puente()) return Promise.resolve(null);
  if (estado && !forzar) return Promise.resolve(estado);
  if (consultando) return consultando;
  fallo = "";
  consultando = pedir("/quien").then(j => { estado = j; recordar(j); avisar(); return j; })
    .catch(e => { console.warn("Ropa IA:", e.message); fallo = e.message || "No respondió."; avisar(); return null; })
    .then(x => { consultando = null; return x; });
  return consultando;
}
// Sin internet y la IA es tuya (por lo de ahora o lo de la última vez): la
// pantalla lo avisa en vez de esconder la IA.
const sinInternet = () => {
  if (!puente() || navigator.onLine !== false) return false;
  const r = estado || recordado();
  return !!(r && r.permitido && r.lista);
};
// Cuando vuelve internet, pregunta de nuevo si no se sabía; los avisos se actualizan.
window.addEventListener("online", () => { if (puente() && !estado) quien(true); else avisar(); });
window.addEventListener("offline", avisar);
const disponible = () => !!(puente() && estado && estado.permitido && estado.lista);
// Pinterest no necesita la clave de la IA: alcanza con el puente (versión 2 o más).
const version = () => (estado && estado.version) || 1;
const pinterest = () => !!(puente() && estado && estado.permitido && version() >= 2);

// La foto (Blob) → lo que la IA ve en ella (ya limpio, con las listas de Manolo).
function aBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
async function describir(blob) {
  if (!blob) throw error("foto", "Esa prenda no tiene foto en este teléfono.");
  const tipo = ["image/jpeg", "image/png", "image/webp"].includes(blob.type) ? blob.type : "image/jpeg";
  const j = await pedir("/describir", { imagen: await aBase64(blob), tipo });
  return j.prenda;
}
// Lo que se ve en una inspiración (D-148).
async function analizar(blob) {
  if (!blob) throw error("foto", "Esa inspiración no tiene imagen en este teléfono.");
  const tipo = ["image/jpeg", "image/png", "image/webp"].includes(blob.type) ? blob.type : "image/jpeg";
  return (await pedir("/inspiracion", { imagen: await aBase64(blob), tipo })).inspiracion;
}
const look = (pin, ropero) => pedir("/look", { pin, ropero }).then(j => j.look);
const estilo = pines => pedir("/estilo", { pines }).then(j => j.estilo);
// Pinterest: { link } o { usuario, tablero } → { usuario, tablero, titulo, pines }.
const tablero = datos => pedir("/pinterest/tablero", datos);
const pin = link => pedir("/pinterest/pin", { link }).then(j => j.pin);
const imagen = url => pedir("/pinterest/imagen", { url }, true);
// "¿Qué me pongo hoy?" (D-149, puente versión 3).
const outfits = datos => pedir("/outfits", datos);
// El estilista (D-157, puente versión 5): conversar (charla), «¿Qué opinas?»
// de un outfit tuyo (opinar) y lo que opina de tu ropero (opinion).
const estilista = () => !!(disponible() && version() >= 5);
const charla = datos => pedir("/charla", datos);
const opinar = datos => pedir("/opinar", datos);
const opinion = datos => pedir("/opinion", datos);
const gasto = () => pedir("/gasto").then(j => j.gasto);
const tope = usd => pedir("/tope", { tope: usd }).then(j => j.gasto);

if (typeof onAuthReady === "function") onAuthReady(() => { quien(); });
window.RopaIA = { puente, quien, disponible, pinterest, version, describir, analizar, look, estilo, tablero, pin, imagen, outfits, estilista, charla, opinar, opinion, gasto, tope, alCambiar: fn => { oyentes.push(fn); }, estado: () => estado, fallo: () => fallo, sinInternet };
})();
