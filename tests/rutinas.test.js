const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../js/rutinas.js");

test("rutina vieja (solo nombres) se lee con valores por defecto", () => {
  const r = R.normalizar({ id: "a", name: "Push", exercises: ["Press de banca", "", "Fondos"] });
  assert.equal(r.vieja, true);
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.items[0], { nombre: "Press de banca", exerciseId: null, series: 3, repsMin: 8, repsMax: 12, peso: null, descansoSeg: 90, notas: "", incremento: null });
});

test("item: limpia y corrige valores (reps al revés, comas, límites)", () => {
  const it = R.item({ nombre: "  Sentadilla ", series: "0", repsMin: "12", repsMax: "8", peso: "62,5", descansoSeg: "120", incremento: "5" });
  assert.equal(it.nombre, "Sentadilla");
  assert.equal(it.series, 1);
  assert.deepEqual([it.repsMin, it.repsMax], [8, 12]);
  assert.equal(it.peso, 62.5);
  assert.equal(it.descansoSeg, 120);
  assert.equal(it.incremento, 5);
  assert.equal(R.item({ nombre: "x", peso: "" }).peso, null);
});

test("aGuardar conserva la lista vieja de nombres y descarta ejercicios vacíos", () => {
  const d = R.aGuardar({ name: " Pierna ", orden: 2, items: [{ nombre: "Sentadilla", series: 4 }, { nombre: " " }] });
  assert.equal(d.name, "Pierna");
  assert.equal(d.v, 2);
  assert.deepEqual(d.exercises, ["Sentadilla"]);
  assert.equal(d.items.length, 1);
  assert.equal(d.items[0].series, 4);
});

test("orden, textos, copia y rutina del día", () => {
  const rs = [{ id: "b", name: "B", orden: 1 }, { id: "a", name: "A", orden: 0 }, { id: "c", name: "C", orden: null }];
  assert.deepEqual(R.ordenar(rs).map(r => r.id), ["a", "b", "c"]);
  assert.equal(R.resumenItem(R.item({ nombre: "x", peso: 60 })), "3 × 8-12 · 60 kg · descanso 1:30 min");
  assert.equal(R.descansoTxt(45), "45 s");
  assert.equal(R.nombreCopia("Push", ["Push", "Push (copia)"]), "Push (copia 2)");
  assert.equal(R.nombreCopia("Push (copia)", ["Push", "Push (copia)"]), "Push (copia 2)");
  // 2026-10-01 es jueves (getDay 4)
  assert.equal(R.rutinaDelDia({ dias: { "4": "a" } }, rs, "2026-10-01").id, "a");
  assert.equal(R.rutinaDelDia({ dias: { "4": "zzz" } }, rs, "2026-10-01"), null);
});
