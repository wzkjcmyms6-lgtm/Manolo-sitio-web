const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/finanzas/presupuesto.js");
const D = require("../js/finanzas/datos.js");

const base = { comida: 1500, transporte: 400.5, salario: 6500 };

test("sin cambios guardados, todos los periodos usan el presupuesto de siempre (en centavos)", () => {
  const r = P.delPeriodo(null, base, "2026-03");
  assert.equal(r.origen, null);
  assert.deepEqual(r.cats, { comida: 150000, transporte: 40050, salario: 650000 });
});

test("cambiar el periodo actual vale desde ahí en adelante; los anteriores no cambian", () => {
  const doc = P.guardar(null, base, "2026-09", { comida: 180000, transporte: 40050 }, "2026-09");
  assert.equal(P.delPeriodo(doc, base, "2026-08").cats.comida, 150000);
  assert.equal(P.delPeriodo(doc, base, "2026-09").cats.comida, 180000);
  assert.equal(P.delPeriodo(doc, base, "2026-10").cats.comida, 180000);
  assert.equal(P.delPeriodo(doc, base, "2026-10").origen, "2026-09");
});

test("cambiar un mes pasado no cambia los siguientes", () => {
  let doc = P.guardar(null, base, "2026-09", { comida: 180000 }, "2026-09");
  doc = P.guardar(doc, base, "2026-06", { comida: 100000 }, "2026-09");
  assert.equal(P.delPeriodo(doc, base, "2026-06").cats.comida, 100000);
  assert.equal(P.delPeriodo(doc, base, "2026-07").cats.comida, 150000); // quedó fijado
  assert.equal(P.delPeriodo(doc, base, "2026-08").cats.comida, 150000);
  assert.equal(P.delPeriodo(doc, base, "2026-05").cats.comida, 150000);
  assert.equal(P.delPeriodo(doc, base, "2026-09").cats.comida, 180000);
});

test("arrastre: lo que sobra o falta pasa al periodo siguiente", () => {
  const doc = { periodos: {}, arrastre: { comida: "2026-07" } };
  const gastado = { "2026-07": 120000, "2026-08": 170000 };
  // julio: sobran 300; agosto: faltan 200 → a septiembre pasan +100 Bs.
  assert.equal(P.arrastreHasta(doc, base, "comida", "2026-09", k => gastado[k] || 0), 10000);
  assert.equal(P.arrastreHasta(doc, base, "comida", "2026-07", k => gastado[k] || 0), 0);
  assert.equal(P.arrastreHasta(doc, base, "transporte", "2026-09", () => 0), 0);
});

test("sugerencia: promedio de meses con gasto, redondeado a Bs 10 hacia arriba", () => {
  assert.equal(P.sugerencia([100000, 0, 120500]), 111000); // promedio 1102,50 → 1110
  assert.equal(P.sugerencia([0, 0, 0]), 0);
  assert.equal(P.sugerencia([99901]), 100000);
});

test("estados: bien, rápido, alerta (80 %) y pasado", () => {
  assert.equal(P.estado(100000, 20000, 0.5, 15).estado, "bien");
  assert.equal(P.estado(100000, 70000, 0.4, 18).estado, "rapido");
  assert.equal(P.estado(100000, 80000, 0.9, 3).estado, "alerta");
  assert.equal(P.estado(100000, 100001, 0.9, 3).estado, "pasado");
  assert.equal(P.estado(0, 5000, 0.5, 10).estado, "sin");
  const e = P.estado(100000, 40000, 0.5, 15);
  assert.equal(e.ritmo, 50000);
  assert.equal(e.porDia, 4000);
});

test("cruce de 80 % y 100 %", () => {
  assert.equal(P.cruce(100000, 70000, 85000), 80);
  assert.equal(P.cruce(100000, 85000, 90000), null);
  assert.equal(P.cruce(100000, 90000, 100001), 100);
  assert.equal(P.cruce(100000, 70000, 120000), 100);
  assert.equal(P.cruce(0, 0, 5000), null);
});

test("respaldo: el presupuesto por periodo se copia y al importar solo agrega lo que falta", () => {
  assert.ok(D.META_COPIA.includes("presupuestos_periodos"));
  const copia = D.copiaCompleta({ finanzas: [], ahorros: [], carteras_movimientos: [], meta: {
    presupuestos_periodos: { v: 1, periodos: { "2026-08": { comida: 100000 }, "2026-09": { comida: 1 } }, arrastre: { comida: "2026-08", mala: "x" } }
  } }, Date.now());
  const plan = D.planImportacion(copia, { meta: { presupuestos_periodos: { periodos: { "2026-09": { comida: 180000 } }, arrastre: {} } } });
  assert.deepEqual(plan.meta.presupuestos_periodos, { v: 1, periodos: { "2026-08": { comida: 100000 } }, arrastre: { comida: "2026-08" } });
});
