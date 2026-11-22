// ---------- Ropa: la IA, por el puente (D-147) ----------
// Manolo no guarda ninguna clave: le pide al puente (puente/, un Worker en
// Cloudflare) con el token de tu sesión de Firebase; el puente revisa que seas
// el dueño, llama a la IA y lleva la cuenta del gasto del mes con su tope.
// A la IA solo le llega la foto (ni tu nombre ni tu usuario).
// window.RopaIA: puente(), quien(forzar), disponible(), describir(blob),
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
async function pedir(ruta, cuerpo) {
  const base = puente();
  if (!base) throw error("sin-puente", "La IA todavía no está conectada.");
  if (navigator.onLine === false) throw error("sin-internet", "La IA necesita internet.");
  if (typeof currentUser === "undefined" || !currentUser || !currentUser.getIdToken) throw error("sesion", "Vuelve a iniciar sesión en Manolo.");
  const token = await currentUser.getIdToken();
  let r;
  try {
    r = await fetch(base.replace(/\/+$/, "") + ruta, {
      method: cuerpo ? "POST" : "GET",
      headers: Object.assign({ Authorization: `Bearer ${token}` }, cuerpo ? { "Content-Type": "application/json" } : {}),
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
  } catch (e) { throw error("red", "No pude hablar con la IA. Revisa tu conexión."); }
  const j = await r.json().catch(() => ({}));
  if (j && j.gasto && estado) { estado.gasto = j.gasto; avisar(); }
  if (!r.ok) throw error(j.error || `http-${r.status}`, j.mensaje || "La IA no respondió. Intenta de nuevo.", j);
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
const gasto = () => pedir("/gasto").then(j => j.gasto);
const tope = usd => pedir("/tope", { tope: usd }).then(j => j.gasto);

if (typeof onAuthReady === "function") onAuthReady(() => { quien(); });
window.RopaIA = { puente, quien, disponible, describir, gasto, tope, alCambiar: fn => { oyentes.push(fn); }, estado: () => estado };
})();
