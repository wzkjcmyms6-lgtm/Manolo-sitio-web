const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/inversiones-motor.js");

const n = (id, d) => M.normalizar(id, Object.assign({ v: 1, creado: 0 }, d));
const compra = (id, fecha, ticker, cantidad) => n(id, { tipo: "compra", fecha, ticker, cantidad, precio: 100, comision: 0.15 });
const PRECIOS = { dividendos: {
  SCHD: { frecuencia: "trimestral", historial: [{ ex: "2026-09-24", pago: "2026-09-29", monto: 0.27 }], proximo: { ex: "2026-12-09", pago: "2026-12-14", monto: 0.27, estimado: true } },
  VOO: { frecuencia: "trimestral", historial: [{ ex: "2026-09-26", pago: "2026-09-30", monto: 1.74 }], proximo: { ex: "2026-10-30", pago: "2026-11-03", monto: 1.8, estimado: false } },
  VT: { historial: [{ ex: "2026-10-26", pago: "2026-10-29", monto: 0.5 }], proximo: { ex: "2027-01-20", estimado: true } },
  QQQ: { historial: [], proximo: { ex: "2026-10-29", estimado: true } }
} };
const MOVS = [compra("a", "2026-10-02", "SCHD", 1), compra("b", "2026-10-02", "VOO", 0.05), compra("c", "2026-10-20", "VT", 0.2), compra("d", "2026-10-27", "VT", 0.3)];

test("agenda: solo lo que tienes, con monto estimado por tus acciones", () => {
  const a = M.agendaDividendos(PRECIOS, MOVS, "2026-10-28");
  assert.ok(!a.some(x => x.ticker === "QQQ"), "QQQ no lo tienes: no aparece");
  const voo = a.find(x => x.ticker === "VOO");
  assert.deepEqual([voo.ex, voo.pago, voo.diasEx, voo.diasPago, voo.total, voo.estimado], ["2026-10-30", "2026-11-03", 2, 6, M.red(1.8 * 0.05), false]);
  const vt = a.filter(x => x.ticker === "VT");
  assert.equal(vt.length, 2, "VT: el último (pago en 1 día) y el próximo");
  assert.equal(vt[0].acciones, 0.2, "para el dividendo ya pasado cuentan las acciones que tenías antes de la fecha ex");
  assert.equal(vt[0].total, 0.1);
  assert.equal(vt.find(x => x.ex === "2027-01-20").acciones, 0.5, "para el próximo, las de hoy");
  assert.equal(a[0].ticker, "VT", "ordenado: primero lo más cercano (pago de VT mañana)");
  assert.deepEqual(M.agendaDividendos(null, MOVS, "2026-10-28"), [], "sin datos de dividendos, nada");
});

test("avisos: de 3 días antes a 3 días después (fecha ex o pago)", () => {
  const av = M.avisosDividendos(M.agendaDividendos(PRECIOS, MOVS, "2026-10-28"));
  assert.deepEqual(av.map(x => `${x.ticker} ${x.ex}`), ["VT 2026-10-26", "VOO 2026-10-30"]);
  const voo = av.find(x => x.ticker === "VOO");
  assert.match(voo.lineas[0], /Fecha ex en 2 días \(30 oct 2026\): para cobrar este dividendo tienes que tener la acción antes/);
  assert.equal(voo.lineas.length, 1, "el pago (en 6 días) todavía no avisa");
  const vt = av.find(x => x.ticker === "VT");
  assert.deepEqual(vt.lineas, ["La fecha ex fue hace 2 días (26 oct 2026).", "Paga en 1 día (29 oct 2026)."]);
  assert.equal(vt.anotar, false);
});

test("después del pago: pide anotarlo y deja de pedirlo cuando ya lo anotaste", () => {
  let av = M.avisosDividendos(M.agendaDividendos(PRECIOS, MOVS, "2026-11-01"));
  const vt = av.find(x => x.ticker === "VT");
  assert.match(vt.lineas[0], /Pagó hace 3 días \(29 oct 2026\): anótalo/);
  assert.equal(vt.anotar, true);
  const conDiv = MOVS.concat(n("dv", { tipo: "dividendo", fecha: "2026-10-29", ticker: "VT", monto: 0.07 }));
  av = M.avisosDividendos(M.agendaDividendos(PRECIOS, conDiv, "2026-11-01"));
  assert.ok(!av.some(x => x.ticker === "VT"), "ya anotado: sin aviso");
  av = M.avisosDividendos(M.agendaDividendos(PRECIOS, MOVS, "2026-11-03"));
  assert.ok(!av.some(x => x.ticker === "VT"), "a los 5 días del pago ya no avisa");
  assert.match(av.find(x => x.ticker === "VOO").lineas.join(" "), /Paga hoy/);
});

test("comprar el mismo día de la fecha ex no da derecho al dividendo", () => {
  const movs = [compra("a", "2026-10-26", "VT", 1)];
  const a = M.agendaDividendos(PRECIOS, movs, "2026-10-28");
  assert.ok(!a.some(x => x.ex === "2026-10-26"), "compró el día ex: ese dividendo no le toca");
  assert.ok(a.some(x => x.ex === "2027-01-20"), "pero el próximo sí");
});
