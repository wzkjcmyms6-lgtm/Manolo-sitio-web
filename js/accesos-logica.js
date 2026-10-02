// ---------- Accesos (lógica sin pantalla) ----------
// Evento de inicio de sesión y bandeja del administrador. Sin DOM ni
// Firebase: se prueba en tests/accesos-logica.test.js.
//
// Un inicio de sesión real = un documento accesos/{uid}_{loginMs}. La clave
// sale de user.metadata.lastSignInTime, que Firebase cambia solo cuando
// alguien inicia sesión (no al reabrir la app): reintentos, recargas o dos
// pestañas escriben el mismo id y las reglas no dejan pisarlo.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AccesosLogica = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const USUARIO_MAX = 60;

function claveLogin(uid, lastSignInTime) {
  const ms = Date.parse(lastSignInTime);
  if (!uid || typeof uid !== "string" || !isFinite(ms)) return null;
  return `${uid}_${ms}`;
}

// "lentina@manolo-panel.local" → "Lentina". Nunca el correo completo.
function nombreUsuario(email) {
  const u = String(email || "").split("@")[0].trim();
  return u ? (u.charAt(0).toUpperCase() + u.slice(1)).slice(0, USUARIO_MAX) : "Usuario";
}

// Lo que se guarda (la hora la pone el servidor: serverTimestamp).
// Solo estos campos: las reglas rechazan cualquier otro.
function eventoLogin(user) {
  if (!user) return null;
  const id = claveLogin(user.uid, user.metadata && user.metadata.lastSignInTime);
  if (!id) return null;
  return { id, datos: { uid: user.uid, usuario: nombreUsuario(user.email), tipo: "login", leido: false } };
}

// Abrir la app (o volver a ella después de un rato) también cuenta como
// "ingresó": la sesión queda guardada en el teléfono y casi nadie vuelve a
// escribir su contraseña. Como mucho uno cada 30 minutos por teléfono.
// Mismo formato que el login (id uid_ms, tipo "login"): lo aceptan las
// reglas que ya están publicadas.
const PAUSA_APERTURA_MS = 30 * 60000;
function eventoApertura(user, ahoraMs, ultimoMs) {
  if (!user || !user.uid || typeof user.uid !== "string" || !isFinite(ahoraMs)) return null;
  if (ultimoMs && ahoraMs - ultimoMs < PAUSA_APERTURA_MS && ahoraMs >= ultimoMs) return null;
  return { id: `${user.uid}_${Math.floor(ahoraMs)}`, datos: { uid: user.uid, usuario: nombreUsuario(user.email), tipo: "login", leido: false } };
}

function msDe(creado) {
  if (!creado) return null;
  if (typeof creado.toMillis === "function") return creado.toMillis();
  if (typeof creado.seconds === "number") return creado.seconds * 1000;
  const n = Number(creado);
  return isFinite(n) ? n : null;
}

// Bandeja del admin: sin sus propios accesos, de más nuevo a más viejo.
// docs = [{ id, uid, usuario, creado, leido }]
function bandeja(docs, miUid) {
  const lista = (docs || [])
    .filter(d => d && d.uid !== miUid)
    .map(d => ({ id: d.id, usuario: d.usuario || "Usuario", ms: msDe(d.creado), leido: !!d.leido }))
    .sort((a, b) => (b.ms || Infinity) - (a.ms || Infinity));
  return { lista, noLeidos: lista.filter(x => !x.leido).length };
}

// "30/09/2026 · 22:15" (hora local del teléfono).
function fechaHora(ms) {
  if (!Number.isFinite(ms)) return "Ahora";
  const d = new Date(ms);
  const dos = n => String(n).padStart(2, "0");
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} · ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

return { claveLogin, nombreUsuario, eventoLogin, eventoApertura, PAUSA_APERTURA_MS, bandeja, fechaHora, msDe, USUARIO_MAX };
});
