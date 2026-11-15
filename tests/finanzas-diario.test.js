// Finanzas: disponible por día según los ingresos reales (js/finanzas/diario.js, D-116).
const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../js/finanzas/diario.js");

const ing = (date, bs, extra) => Object.assign({ type: "ingreso", montoCent: Math.round(bs * 100), date }, extra);
const gas = (date, bs, extra) => Object.assign({ type: "gasto", montoCent: Math.round(bs * 100), date }, extra);
// Noviembre de 2026: 30 días.
const NOV = { inicio: "2026-11-01", fin: "2026-11-30" };

test("presupuesto 5000 e ingresos reales 3000 en un mes de 30 días → 100 por día (no 170)", () => {
  const r = D.calcular(Object.assign({ movimientos: [ing("2026-11-01", 2000), ing("2026-11-10", 1000)], hoy: "2026-11-15", presupuestoCent: 500000 }, NOV));
  assert.equal(r.ingresosCent, 300000);
  assert.equal(r.diasMes, 30);
  assert.equal(r.disponibleDiaCent, 10000, "3000 ÷ 30 = 100");
  assert.deepEqual(r.presupuesto, { metaCent: 500000, recibidoCent: 300000, pct: 60 }, "recibido vs. presupuestado: 3000 de 5000 · 60 %");
  // Te queda por día desde hoy: (3000 − 0) ÷ 16 días (del 15 al 30).
  assert.equal(r.diasRestantes, 16);
  assert.equal(r.quedaDiaCent, 18750);
  assert.equal(r.estado, "verde");
});

test("sin ingresos este mes → estado vacío, sin números inventados", () => {
  const r = D.calcular(Object.assign({ movimientos: [gas("2026-11-03", 50)], hoy: "2026-11-15", presupuestoCent: 500000 }, NOV));
  assert.equal(r.estado, "vacio");
  assert.equal(r.ingresosCent, 0);
  assert.equal(r.disponibleDiaCent, 0);
  assert.equal(r.presupuesto.pct, 0);
  assert.equal(D.calcular(Object.assign({ movimientos: [], hoy: "2026-11-15" }, NOV)).estado, "vacio");
});

test("gastos mayores que los ingresos → lo que te queda es negativo (rojo)", () => {
  const r = D.calcular(Object.assign({ movimientos: [ing("2026-11-01", 1000), gas("2026-11-05", 1300)], hoy: "2026-11-21" }, NOV));
  assert.equal(r.quedaCent, -30000);
  assert.equal(r.diasRestantes, 10);
  assert.equal(r.quedaDiaCent, -3000, "−300 ÷ 10 = −30 por día");
  assert.equal(r.estado, "rojo");
});

test("verde si te queda por día igual o más que el disponible; ámbar si menos", () => {
  // 3000 en el mes (100 por día); el día 21 quedan 10 días.
  const base = (gastado) => D.calcular(Object.assign({ movimientos: [ing("2026-11-01", 3000), gas("2026-11-02", gastado)], hoy: "2026-11-21" }, NOV));
  assert.equal(base(2000).quedaDiaCent, 10000);
  assert.equal(base(2000).estado, "verde", "te queda justo 100 por día: verde");
  assert.equal(base(2000.01).estado, "ambar", "un centavo de menos: ámbar");
  assert.equal(base(500).estado, "verde");
});

test("último día del mes: queda 1 día (nunca se divide entre cero); después, mes cerrado", () => {
  const ultimo = D.calcular(Object.assign({ movimientos: [ing("2026-11-01", 3000), gas("2026-11-20", 2950)], hoy: "2026-11-30" }, NOV));
  assert.equal(ultimo.diasRestantes, 1);
  assert.equal(ultimo.quedaDiaCent, 5000);
  const despues = D.calcular(Object.assign({ movimientos: [ing("2026-11-01", 3000), gas("2026-11-20", 2950)], hoy: "2026-12-02" }, NOV));
  assert.equal(despues.diasRestantes, 0);
  assert.equal(despues.quedaDiaCent, null);
  assert.equal(despues.estado, "cerrado");
  assert.equal(despues.disponibleDiaCent, 10000);
  const pasado = D.calcular(Object.assign({ movimientos: [ing("2026-11-01", 3000), gas("2026-11-20", 3100)], hoy: "2026-12-02" }, NOV));
  assert.equal(pasado.estado, "rojo", "un mes pasado en negativo sigue en rojo");
});

test("febrero: 28 días (y 29 en año bisiesto)", () => {
  const feb = D.calcular({ movimientos: [ing("2026-02-01", 2800)], inicio: "2026-02-01", fin: "2026-02-28", hoy: "2026-02-10" });
  assert.equal(feb.diasMes, 28);
  assert.equal(feb.disponibleDiaCent, 10000);
  assert.equal(feb.diasRestantes, 19);
  const bis = D.calcular({ movimientos: [ing("2028-02-01", 2900)], inicio: "2028-02-01", fin: "2028-02-29", hoy: "2028-02-29" });
  assert.equal(bis.diasMes, 29);
  assert.equal(bis.disponibleDiaCent, 10000);
  assert.equal(bis.diasRestantes, 1);
  // Meses de 31 días: 3100 ÷ 31 = 100.
  assert.equal(D.calcular({ movimientos: [ing("2026-12-05", 3100)], inicio: "2026-12-01", fin: "2026-12-31", hoy: "2026-12-05" }).disponibleDiaCent, 10000);
});

test("los ingresos y gastos de otros meses no cuentan", () => {
  const r = D.calcular(Object.assign({ movimientos: [ing("2026-10-31", 9000), ing("2026-11-01", 3000), ing("2026-12-01", 7000), gas("2026-10-15", 400), gas("2026-12-01", 800)], hoy: "2026-11-15" }, NOV));
  assert.equal(r.ingresosCent, 300000);
  assert.equal(r.gastosCent, 0);
});

test("no cuentan lo excluido del presupuesto, las transferencias ni los pagos de tarjeta", () => {
  const r = D.calcular(Object.assign({ hoy: "2026-11-15", movimientos: [
    ing("2026-11-01", 3000), ing("2026-11-02", 500, { excluded: true }), gas("2026-11-03", 200), gas("2026-11-04", 999, { excluded: true }),
    { type: "transferencia", montoCent: 100000, date: "2026-11-05" }, { type: "pago_tarjeta", montoCent: 50000, date: "2026-11-06" }
  ] }, NOV));
  assert.deepEqual([r.ingresosCent, r.gastosCent], [300000, 20000]);
});

test("en centavos: sin errores de decimales; los movimientos viejos con amount también suman", () => {
  const r = D.calcular(Object.assign({ hoy: "2026-11-01", movimientos: [
    { type: "ingreso", amount: 0.1, date: "2026-11-01" }, { type: "ingreso", amount: 0.2, date: "2026-11-01" }, ing("2026-11-01", 2999.7)
  ] }, NOV));
  assert.equal(r.ingresosCent, 300000, "0,1 + 0,2 + 2999,7 = 3000 exactos");
  assert.equal(r.disponibleDiaCent, 10000);
  // 1000 ÷ 30 = 33,333… → 33,33 (hacia abajo: nunca más de lo que hay).
  assert.equal(D.calcular(Object.assign({ hoy: "2026-11-01", movimientos: [ing("2026-11-01", 1000)] }, NOV)).disponibleDiaCent, 3333);
});

test("periodo del presupuesto que empieza otro día (del 25 al 24)", () => {
  const r = D.calcular({ movimientos: [ing("2026-10-25", 3100), ing("2026-10-24", 999)], inicio: "2026-10-25", fin: "2026-11-24", hoy: "2026-11-24" });
  assert.equal(r.diasMes, 31);
  assert.equal(r.disponibleDiaCent, 10000);
  assert.equal(r.diasRestantes, 1);
});

test("fechas inválidas: avisa (no calcula con basura)", () => {
  assert.throws(() => D.calcular({ inicio: "2026-11", fin: "2026-11-30", hoy: "2026-11-15" }));
  assert.throws(() => D.calcular({ inicio: "2026-11-30", fin: "2026-11-01", hoy: "2026-11-15" }));
});
