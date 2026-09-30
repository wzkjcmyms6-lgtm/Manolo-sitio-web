const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../js/finanzas/analisis.js");

const periodos = [
  { desde: "2026-09-01", hasta: "2026-09-30" },
  { desde: "2026-08-01", hasta: "2026-08-31" },
  { desde: "2026-07-01", hasta: "2026-07-31" },
  { desde: "2026-06-01", hasta: "2026-06-30" }
];
let n = 0;
const g = (date, cent, category = "comida", extra) => Object.assign({ id: "m" + (n++), date, type: "gasto", category, montoCent: cent }, extra);
const ing = (date, cent) => ({ id: "m" + (n++), date, type: "ingreso", category: "salario", montoCent: cent });

test("no cuenta transferencias ni lo excluido", () => {
  const movs = [
    g("2026-09-02", 1000),
    g("2026-09-03", 5000, "comida", { excluded: true }),
    { id: "t", date: "2026-09-04", type: "transferencia", from: "debito", to: "ahorro", montoCent: 70000 },
    ing("2026-09-01", 100000)
  ];
  const a = A.analizar(movs, periodos, "2026-09-30");
  assert.equal(a.actual.gastos, 1000);
  assert.equal(a.actual.ingresos, 100000);
  assert.equal(a.tasaAhorro, 0.99);
});

test("periodo en curso: compara a la misma altura", () => {
  const movs = [
    // Meses anteriores: 100 Bs en los primeros 10 días y 900 Bs después.
    g("2026-08-05", 10000), g("2026-08-25", 90000),
    g("2026-07-05", 10000), g("2026-07-25", 90000),
    // Este mes, al día 10: 150 Bs.
    g("2026-09-03", 15000)
  ];
  const a = A.analizar(movs, periodos, "2026-09-10");
  assert.equal(a.parcial, true);
  assert.equal(a.corte, 10);
  assert.equal(a.prom.n, 2); // junio no tiene movimientos: no cuenta
  assert.equal(a.prom.gastosCorte, 10000);
  assert.equal(a.prom.gastos, 100000);
  const h = A.hallazgos(a, id => id, c => `Bs ${c / 100}`, 2500);
  assert.match(h[0].texto, /50 % más/);
});

test("periodo cerrado: compara completo", () => {
  const movs = [g("2026-08-31", 10000), g("2026-09-30", 20000)];
  const a = A.analizar(movs, periodos, "2026-10-05");
  assert.equal(a.parcial, false);
  assert.equal(a.prom.gastosCorte, 10000);
});

test("cambios por categoría, días sin gastar, racha y hormiga", () => {
  const movs = [
    g("2026-08-02", 30000, "comida"), g("2026-08-03", 10000, "transporte"),
    g("2026-09-01", 50000, "comida"), g("2026-09-02", 1500, "transporte"), g("2026-09-02", 2000, "comida"),
    g("2026-09-03", 2500, "comida"), g("2026-09-03", 2600, "comida")
  ];
  const a = A.analizar(movs, periodos, "2026-09-06", { umbralHormigaCent: 2500 });
  const comida = a.cambios.find(c => c.id === "comida");
  assert.equal(comida.dif, 57100 - 30000);
  const transporte = a.cambios.find(c => c.id === "transporte");
  assert.equal(transporte.dif, 1500 - 10000);
  assert.equal(a.sinGastar, 3); // 4, 5 y 6 de septiembre
  assert.equal(a.racha, 3);
  assert.equal(a.hormiga.n, 3); // 15, 20 y 25 Bs (26 Bs no)
  assert.equal(a.hormiga.total, 6000);
  assert.equal(a.mayores[0].montoCent, 50000);
  assert.equal(a.tendencia.length, 4);
  assert.equal(a.tendencia[3].desde, "2026-09-01");
});

test("semana: promedio por día, lunes primero", () => {
  // 2026-09-07 es lunes.
  const a = A.analizar([g("2026-09-07", 7000)], periodos, "2026-09-30");
  assert.equal(a.semana.length, 7);
  assert.ok(a.semana[0] > 0);
  assert.equal(a.semana[1], 0);
});

test("meses cubiertos y horas de trabajo", () => {
  assert.equal(A.mesesCubiertos(300000, 100000), 3);
  assert.equal(A.mesesCubiertos(-5, 100000), 0);
  assert.equal(A.mesesCubiertos(300000, 0), null);
  assert.equal(A.horasDeTrabajo(16000, 160000, 160), 16);
  assert.equal(A.horasDeTrabajo(16000, 0, 160), null);
});
