const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../js/entreno-series.js");

const mismoPress = ex => ex.name === "Press";
const historial = [
  { id: "a", date: "2026-09-20", startedAt: 1, exercises: [{ name: "Press", sets: [{ kg: 40, reps: 8 }] }] },
  { id: "b", date: "2026-09-27", startedAt: 5, exercises: [{ name: "Press", sets: [{ kg: 20, reps: 12, calentamiento: true }, { kg: 50, reps: 8 }, { kg: 55, reps: 6 }] }] },
  { id: "c", date: "2026-09-27", startedAt: 2, exercises: [{ name: "Press", sets: [{ kg: 45, reps: 8 }] }] },
  { id: "d", date: "2026-09-29", startedAt: 9, exercises: [{ name: "Sentadilla", sets: [{ kg: 80, reps: 5 }] }] }
];

test("anterior: el entreno más reciente que tiene ese ejercicio", () => {
  assert.equal(S.seriesAnteriores(historial, mismoPress, null), historial[1].exercises[0].sets);
  assert.deepEqual(S.seriesAnteriores(historial, ex => ex.name === "Remo", null), []);
});

test("anterior al editar: solo cuentan los entrenos de antes", () => {
  const antes = S.seriesAnteriores(historial, mismoPress, { id: "b", date: "2026-09-27", startedAt: 5 });
  assert.deepEqual(antes, [{ kg: 45, reps: 8 }]);
  assert.deepEqual(S.seriesAnteriores(historial, mismoPress, { id: "a", date: "2026-09-20", startedAt: 1 }), []);
});

test("emparejar: calentamientos con calentamientos, efectivas en orden", () => {
  const prev = historial[1].exercises[0].sets;
  const hoy = [{ calentamiento: true }, {}, {}, {}];
  assert.deepEqual(S.emparejar(hoy, prev), [prev[0], prev[1], prev[2], null]);
});

test("texto de la columna Anterior según el tipo", () => {
  assert.equal(S.textoAnterior({ kg: 42.5, reps: 8 }, "carga"), "42,5kg × 8");
  assert.equal(S.textoAnterior({ kg: 0, reps: 12 }, "peso_corporal"), "12 reps");
  assert.equal(S.textoAnterior({ kg: 5, reps: 10 }, "peso_corporal"), "+5kg × 10");
  assert.equal(S.textoAnterior({ asistencia: 20, reps: 6 }, "peso_corporal"), "−20kg × 6");
  assert.equal(S.textoAnterior({ seg: 45 }, "isometrico"), "45 s");
  assert.equal(S.textoAnterior(null, "carga"), "—");
});

test("completar al marcar: usa lo de la vez anterior si está vacío", () => {
  const r = S.completar({ kg: "", reps: "" }, "carga", { anterior: { kg: 50, reps: 8 } });
  assert.deepEqual(r, { kg: 50, reps: 8 });
  // Lo que escribiste no se cambia.
  assert.deepEqual(S.completar({ kg: 60, reps: 5 }, "carga", { anterior: { kg: 50, reps: 8 } }), { kg: 60, reps: 5 });
  // La sugerencia de hoy manda sobre lo anterior; luego el mínimo de la rutina.
  assert.equal(S.completar({ kg: 40, reps: "", meta: 10 }, "carga", { anterior: { kg: 40, reps: 8 } }).reps, 10);
  assert.equal(S.completar({ kg: 40, reps: "" }, "carga", { objetivo: { repsMin: 6 } }).reps, 6);
  // Sin reps por ningún lado: hay que escribirlas.
  assert.equal(S.completar({ kg: 40, reps: "" }, "carga", {}), null);
  assert.deepEqual(S.completar({ seg: "" }, "isometrico", { anterior: { seg: 30 } }), { seg: 30 });
  assert.equal(S.completar({ seg: "" }, "isometrico", {}), null);
});

test("completar en peso corporal respeta lastre o asistencia", () => {
  assert.equal(S.completar({ kg: "", reps: "" }, "peso_corporal", { anterior: { asistencia: 20, reps: 6 }, asistencia: true }).kg, 20);
  assert.equal(S.completar({ kg: "", reps: "" }, "peso_corporal", { anterior: { asistencia: 20, reps: 6 } }).kg, 0);
  assert.equal(S.completar({ kg: "", reps: "" }, "peso_corporal", { anterior: { kg: 10, reps: 6 } }).kg, 10);
});

test("cuenta series marcadas y con datos sin marcar", () => {
  const ej = [
    { tipo: "carga", sets: [{ kg: 50, reps: 8, hecha: true }, { kg: 50, reps: 8 }, { kg: 60, reps: "", pre: true }] },
    { tipo: "isometrico", sets: [{ seg: 30, hecha: true }, { seg: "" }] },
    { tipo: "cardio", minutos: 20, sets: [] }
  ];
  assert.deepEqual(S.cuenta(ej), { hechas: 2, sinMarcar: 1 });
});

test("limpiar: todas las series con datos, o solo las marcadas", () => {
  const ex = { name: "Press", exerciseId: "x", tipo: "carga", rpe: "", notas: " ok ", sets: [
    { kg: 50, reps: 8, hecha: true }, { kg: 50, reps: 6 }, { kg: 60, reps: "", pre: true }, { kg: 20, reps: 10, calentamiento: true, hecha: true }
  ] };
  assert.deepEqual(S.limpiar(ex), { name: "Press", exerciseId: "x", notas: "ok", sets: [
    { kg: 50, reps: 8 }, { kg: 50, reps: 6 }, { kg: 20, reps: 10, calentamiento: true }
  ] });
  assert.deepEqual(S.limpiar(ex, { soloHechas: true }).sets, [{ kg: 50, reps: 8 }, { kg: 20, reps: 10, calentamiento: true }]);
  assert.equal(S.limpiar({ name: "P", tipo: "carga", sets: [{ kg: 50, reps: 8 }] }, { soloHechas: true }), null);
  assert.deepEqual(S.limpiar({ name: "D", tipo: "peso_corporal", asistencia: true, sets: [{ kg: 20, reps: 6, hecha: true }] }).sets, [{ asistencia: 20, reps: 6 }]);
  assert.deepEqual(S.limpiar({ name: "Correr", tipo: "cardio", minutos: 25, sets: [] }), { name: "Correr", sets: [], minutos: 25 });
  assert.equal(S.limpiar({ name: "Correr", tipo: "cardio", minutos: "", sets: [] }), null);
});

test("textos del descanso y del reloj", () => {
  assert.equal(S.textoDescanso(0), "Apagado");
  assert.equal(S.textoDescanso(45), "45s");
  assert.equal(S.textoDescanso(120), "2min");
  assert.equal(S.textoDescanso(150), "2min 30s");
  assert.equal(S.reloj(65), "1:05");
  assert.equal(S.reloj(0.2), "0:01");
  assert.equal(S.reloj(-3), "0:00");
});
