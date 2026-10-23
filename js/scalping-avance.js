// ---------- Scalping: el plan avanza solo con días completos ----------
// Pedido del dueño (2026-10-23): el día del plan sube solo cuando completas
// mañana Y noche. Si un día no lo completas, al día siguiente sigues en el
// mismo día del plan (no se salta al siguiente).
//
// js/scalping-habit.js (el módulo del dueño) no se toca: cuenta el día por
// calendario desde la fecha de inicio. Aquí se le pasa un inicio "corrido"
// para que su día coincida con el día por avance; la fecha real sigue
// mandando el día de la semana (y con él la zona de la noche).
// Sin DOM ni Firebase: tests/scalping-avance.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./scalping-habit.js"));
  else root.ScalpingAvance = factory(root.ScalpingHabit);
})(typeof self !== "undefined" ? self : this, function (S) {
"use strict";

function completo(estado, f) {
  const l = S.getLog(estado, f);
  return l.manana.hecho && l.noche.hecho;
}

// Día del plan hoy = días completos antes de hoy (desde el inicio) + 1.
// Hoy no cuenta todavía: completar hoy hace que mañana sea el día siguiente.
// null si el plan aún no empieza.
function diaPorAvance(estado, hoy) {
  const inicio = estado.settings.startDate;
  if (hoy < inicio) return null;
  let n = 0;
  for (let f = inicio; f < hoy; f = S.addDays(f, 1)) if (completo(estado, f)) n++;
  return n + 1;
}

// Ajustes para el módulo: los mismos, con el inicio corrido de modo que
// getPlanForDate(…, hoy) dé el día por avance.
function ajustesPlan(estado, hoy) {
  const dia = diaPorAvance(estado, hoy);
  if (dia == null) return estado.settings;
  return Object.assign({}, estado.settings, { startDate: S.addDays(hoy, -(dia - 1)) });
}
const conAjustes = (estado, ajustes) => Object.assign({}, estado, { settings: ajustes });

// Todo lo que toca hoy (día, fase, sesiones, zona, fotos…), por avance.
function planHoy(estado, hoy) {
  return S.getPlanForDate(ajustesPlan(estado, hoy), hoy);
}

// Marcar con los minutos del día por avance (no del día de calendario).
// Devuelve un estado nuevo con los ajustes reales.
function marcarSesion(estado, hoy, sesion, opciones) {
  const nuevo = S.markSession(conAjustes(estado, ajustesPlan(estado, hoy)), hoy, sesion, opciones);
  nuevo.settings = S.normalizeState(estado).settings;
  return nuevo;
}

// Aviso de sesión pendiente con los minutos del día por avance.
function aviso(estado, ahora) {
  const hoy = S.toISODate(ahora);
  return S.getReminder(conAjustes(estado, ajustesPlan(estado, hoy)), ahora);
}

// Volver al día 1 desde hoy: inicio = hoy y controles de fotos sin marcar.
// Las sesiones anteriores no se borran (quedan antes del nuevo inicio y el
// plan ya no las cuenta).
function reiniciar(estado, hoy) {
  let nuevo = S.updateSettings(estado, { startDate: hoy });
  S.PHOTO_DAYS.forEach(c => { nuevo = S.markPhotos(nuevo, c, null); });
  return nuevo;
}

return { completo, diaPorAvance, ajustesPlan, conAjustes, planHoy, marcarSesion, aviso, reiniciar };
});
