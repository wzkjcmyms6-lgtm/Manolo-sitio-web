const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../js/scalping-habit.js");
const A = require("../js/scalping-avance.js");

const completoEl = (st, f) => A.marcarSesion(A.marcarSesion(st, f, "manana"), f, "noche");

test("sin días completos, el plan se queda en el día 1", () => {
  const st = S.createInitialState("2026-10-21");
  assert.equal(A.diaPorAvance(st, "2026-10-21"), 1);
  assert.equal(A.diaPorAvance(st, "2026-10-25"), 1, "cuatro días después sigue en el día 1");
  assert.equal(A.planHoy(st, "2026-10-25").dia, 1);
});

test("solo mañana (o solo noche) no avanza; mañana y noche sí", () => {
  let st = S.createInitialState("2026-10-21");
  st = A.marcarSesion(st, "2026-10-21", "manana");
  assert.equal(A.diaPorAvance(st, "2026-10-22"), 1, "día incompleto: sigue en el 1");
  st = A.marcarSesion(st, "2026-10-21", "noche");
  assert.equal(A.diaPorAvance(st, "2026-10-21"), 1, "completar hoy no cambia el día de hoy");
  assert.equal(A.diaPorAvance(st, "2026-10-22"), 2, "al día siguiente pasa al 2");
  assert.equal(A.diaPorAvance(st, "2026-10-24"), 2, "días sin completar no lo mueven");
  st = completoEl(st, "2026-10-24");
  assert.equal(A.diaPorAvance(st, "2026-10-25"), 3);
});

test("la zona de la noche sigue el día de la semana real", () => {
  const st = S.createInitialState("2026-10-21");          // miércoles
  const p = A.planHoy(st, "2026-10-25");                    // domingo, pero día 1 del plan
  assert.equal(p.dia, 1);
  assert.equal(p.zonaNoche.nombre, "Toda la cabeza");
  assert.equal(p.fecha, "2026-10-25");
});

test("fases y minutos según los días completos (no el calendario)", () => {
  let st = S.createInitialState("2026-10-01");
  for (let i = 0; i < 30; i++) st = completoEl(st, S.addDays("2026-10-01", i));
  // 30 días completos y luego 10 días sin completar: hoy es el día 31.
  const hoy = S.addDays("2026-10-01", 40);
  const p = A.planHoy(st, hoy);
  assert.equal(p.dia, 31);
  assert.equal(p.fase.nombre, "Constancia");
  assert.deepEqual([p.manana.minutos, p.noche.minutos], [8, 12]);
  const m = A.marcarSesion(st, hoy, "manana");
  assert.equal(S.getLog(m, hoy).manana.minutos, 8, "marca con los minutos del día 31");
  assert.equal(m.settings.startDate, "2026-10-01", "los ajustes reales no cambian");
  assert.equal(A.aviso(st, new Date(2026, 10, 10, 7, 30)).minutos, 8, "el aviso usa los minutos del día 31");
});

test("plan que aún no empieza", () => {
  const st = S.createInitialState("2026-11-01");
  assert.equal(A.diaPorAvance(st, "2026-10-25"), null);
  assert.equal(A.planHoy(st, "2026-10-25").estado, "pendiente");
});

test("reiniciar: vuelve al día 1 desde hoy, sin borrar sesiones", () => {
  let st = S.createInitialState("2026-10-21");
  st = completoEl(st, "2026-10-21");
  st = completoEl(st, "2026-10-22");
  st = S.markPhotos(st, 1, "2026-10-21");
  const r = A.reiniciar(st, "2026-10-23");
  assert.equal(r.settings.startDate, "2026-10-23");
  assert.equal(A.diaPorAvance(r, "2026-10-23"), 1);
  assert.equal(r.fotos["1"], null, "controles de fotos sin marcar");
  assert.equal(S.getLog(r, "2026-10-21").manana.hecho, true, "las sesiones viejas siguen guardadas");
  assert.equal(S.getStats(r, "2026-10-23").minutosTotales, 0, "pero el plan nuevo empieza de cero");
});

test("el módulo original sigue intacto", () => {
  assert.equal(S.selfTest(), "ScalpingHabit selfTest OK (142 comprobaciones)");
});
