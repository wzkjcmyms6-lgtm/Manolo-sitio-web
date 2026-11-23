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
// gasto(), tope(usd), alCambiar(fn), estado().
(function () {
"use strict";
// La dirección del puente (se completa al instalarlo). En las pruebas se cambia
// con localStorage "manolo.puente".
const PUENTE = "";
const puente = () => { try { return localStorage.getItem("manolo.puente") || PUENTE; } catch (e) { return PUENTE; } };
let estado = null;            // lo último de /quien: { permitido, uid, lista, gasto }
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
// ¿Quién soy para el puente? (se pregunta una vez por sesión)
function quien(forzar) {
  if (!puente()) return Promise.resolve(null);
  if (estado && !forzar) return Promise.resolve(estado);
  if (consultando) return consultando;
  consultando = pedir("/quien").then(j => { estado = j; avisar(); return j; })
    .catch(e => { console.warn("Ropa IA:", e.message); return null; })
    .then(x => { consultando = null; return x; });
  return consultando;
}
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
const gasto = () => pedir("/gasto").then(j => j.gasto);
const tope = usd => pedir("/tope", { tope: usd }).then(j => j.gasto);

if (typeof onAuthReady === "function") onAuthReady(() => { quien(); });
window.RopaIA = { puente, quien, disponible, pinterest, version, describir, analizar, look, estilo, tablero, pin, imagen, outfits, gasto, tope, alCambiar: fn => { oyentes.push(fn); }, estado: () => estado };
})();
