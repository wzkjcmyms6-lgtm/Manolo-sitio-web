const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../js/scalping-habit.js");

test("autoprueba del módulo", () => {
  assert.equal(S.selfTest(), "ScalpingHabit selfTest OK (142 comprobaciones)");
});

test("tabla de verificación con inicio 2026-10-21", () => {
  const ajustes = { startDate: "2026-10-21" };
  const casos = [
    ["2026-10-21", "Miércoles", 1, "Adaptación", 5, 10, "Costados y nuca"],
    ["2026-10-25", "Domingo", 5, "Adaptación", 5, 10, "Toda la cabeza"],
    ["2026-11-20", "Viernes", 31, "Constancia", 8, 12, "Coronilla y parte superior"],
    ["2027-01-19", "Martes", 91, "Intensificación", 10, 15, "Coronilla y parte superior"],
    ["2027-04-18", "Domingo", 180, "Intensificación", 10, 15, "Toda la cabeza"],
    ["2027-04-19", "Lunes", 181, "Mantenimiento", 10, 15, "Entradas y sienes"]
  ];
  casos.forEach(([fecha, dia, n, fase, man, noc, zona]) => {
    const p = S.getPlanForDate(ajustes, fecha);
    assert.deepEqual([p.diaSemana, p.dia, p.fase.nombre, p.manana.minutos, p.noche.minutos, p.zonaNoche.nombre], [dia, n, fase, man, noc, zona], fecha);
  });
  assert.equal(S.getPlanForDate(ajustes, "2027-04-18").mostrarDecision, true, "día 180 con la tarjeta de decisión");
});

test("horas del plan acumuladas", () => {
  const a = { startDate: "2026-10-21" };
  const horas = d => S.formatHoras(S.getPlannedCumulativeMinutes(d, a));
  assert.deepEqual([horas(90), horas(112), horas(144), horas(180)], ["27,5 h", "36,7 h", "50 h", "65 h"]);
});
