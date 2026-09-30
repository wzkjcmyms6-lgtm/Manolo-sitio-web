const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../js/ej-sesiones.js");

const w = {
  id: "a", date: "2026-09-30", name: "Push", durationMin: 29.4,
  exercises: [
    { name: "Press de banca", sets: [{ kg: 20, reps: 12, calentamiento: true }, { kg: 60, reps: 10 }, { kg: 62.5, reps: 6 }, { kg: 62.5, reps: 8 }] },
    { name: "Plancha", sets: [{ seg: 60 }] },
    { name: "Bici", minutos: 15, sets: [] }
  ]
};

test("resumen: sin calentamiento, mejor serie por peso y luego reps", () => {
  const r = S.resumen(w, 1234.5);
  assert.equal(r.duracionMin, 29);
  assert.equal(r.volumen, 1234.5);
  assert.equal(r.series, 4); // 3 de banca + 1 de plancha
  assert.equal(r.reps, 24);
  assert.deepEqual(r.ejercicios[0].mejor, { kg: 62.5, reps: 8, seg: 0 });
  assert.equal(r.ejercicios[2].minutos, 15);
});

test("fecha relativa", () => {
  assert.equal(S.fechaRelativa("2026-10-01", "2026-10-01"), "Hoy");
  assert.equal(S.fechaRelativa("2026-09-30", "2026-10-01"), "Ayer");
  assert.equal(S.fechaRelativa("2026-09-27", "2026-10-01"), "Hace 4 días");
  assert.equal(S.fechaRelativa("2026-09-12", "2026-10-01"), "12 sept");
  assert.equal(S.fechaRelativa("2025-12-31", "2026-10-01"), "31 dic 2025");
});

test("por semana: de lunes a domingo, semanas vacías incluidas", () => {
  const ses = [
    { id: "1", date: "2026-09-28", durationMin: 30, exercises: [{ name: "x", sets: [{ kg: 10, reps: 10 }] }] }, // lunes
    { id: "2", date: "2026-10-04", durationMin: 20, exercises: [] },                                         // domingo misma semana
    { id: "3", date: "2026-09-14", durationMin: 40, exercises: [] },
    { id: "4", date: "2026-10-05", durationMin: 99, exercises: [] }                                          // futuro: no cuenta
  ];
  const sem = S.porSemana(ses, "2026-10-04", 4, x => S.resumen(x, 100));
  assert.deepEqual(sem.map(s => s.desde), ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
  assert.deepEqual(sem.map(s => s.duracion), [0, 40, 0, 50]);
  assert.equal(sem[3].sesiones, 2);
  assert.equal(sem[3].reps, 10);
  assert.equal(sem[3].volumen, 200);
  const todo = S.porSemana(ses, "2026-10-04", null, x => S.resumen(x, 0));
  assert.equal(todo[0].desde, "2026-09-14");
  assert.equal(S.porMes(todo).length, 1); // cada semana cuenta en el mes de su lunes
});
