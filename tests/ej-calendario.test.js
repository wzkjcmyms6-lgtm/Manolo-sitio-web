const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../js/ej-calendario.js");

const HOY = "2026-10-29";
const R = [
  { id: "a", date: "2026-01-02", name: "Pecho" }, { id: "b", date: "2026-01-02", name: "Cardio" },
  { id: "c", date: "2026-01-05", name: "Pierna" }, { id: "d", date: "2026-02-10" },
  { id: "e", date: "2025-12-30", name: "Espalda" }, { id: "f", date: "mal" }, null
];

test("entrenamientos por día", () => {
  const d = C.porDia(R);
  assert.deepEqual(Object.keys(d).sort(), ["2025-12-30", "2026-01-02", "2026-01-05", "2026-02-10"]);
  assert.equal(d["2026-01-02"].length, 2);
  assert.equal(d["2026-02-10"][0].nombre, "Entrenamiento", "sin nombre: «Entrenamiento»");
});

test("un mes en semanas de lunes a domingo", () => {
  const ene = C.mes(2026, 0, C.porDia(R), HOY);
  // 1 de enero de 2026 es jueves: 3 huecos (lunes a miércoles) antes del 1.
  assert.deepEqual(ene.semanas[0].map(c => (c ? c.dia : null)), [null, null, null, 1, 2, 3, 4]);
  assert.ok(ene.semanas.every(s => s.length === 7));
  assert.equal(ene.semanas.flat().filter(Boolean).length, 31);
  assert.equal(ene.semanas[0][4].n, 2, "el 2 de enero: 2 entrenamientos");
  assert.equal(ene.dias, 2, "días entrenados en enero");
  const feb = C.mes(2026, 1, {}, HOY);
  assert.equal(feb.semanas.flat().filter(Boolean).length, 28);
  assert.equal(feb.semanas[0][6].dia, 1, "1 de febrero de 2026 es domingo");
  const oct = C.mes(2026, 9, {}, HOY);
  const d29 = oct.semanas.flat().find(c => c && c.dia === 29), d30 = oct.semanas.flat().find(c => c && c.dia === 30);
  assert.deepEqual([d29.hoy, d29.futuro, d30.futuro], [true, false, true]);
  assert.equal(C.mes(2028, 1, {}, HOY).semanas.flat().filter(Boolean).length, 29, "año bisiesto");
});

test("el año completo y los años disponibles", () => {
  const a = C.anio(R, 2026, HOY);
  assert.equal(a.meses.length, 12);
  assert.deepEqual([a.diasEntrenados, a.sesiones, a.mejorMes.nombre], [3, 4, "ene"]);
  assert.equal(C.anio(R, 2025, HOY).diasEntrenados, 1);
  assert.equal(C.anio([], 2026, HOY).mejorMes, null);
  assert.deepEqual(C.aniosDisponibles(R, HOY), [2025, 2026]);
  assert.deepEqual(C.aniosDisponibles([], HOY), [2026]);
  assert.equal(C.fechaLarga("2026-01-02"), "vie 2 de enero");
});
