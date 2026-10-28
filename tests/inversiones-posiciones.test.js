const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/inversiones-motor.js");

const PRECIOS = {
  tickers: {
    QQQ: { ultimo: { fecha: "2026-10-27", cierre: 500 }, historial: { "2026-10-01": 480, "2026-10-15": 490, "2026-10-27": 500 } },
    VOO: { ultimo: { fecha: "2026-10-27", cierre: 600 }, historial: { "2026-10-27": 600 } },
    VT: { historial: { "2026-10-20": 130, "2026-10-24": 131 } }
  }
};
const mov = (id, d) => M.normalizar(id, Object.assign({ v: 1 }, d));
const compra = (id, fecha, ticker, cantidad, precio, comision = 0.15, creado = 0) => mov(id, { tipo: "compra", fecha, ticker, cantidad, precio, comision, creado });

test("precio: diario, manual más nuevo o sin precio", () => {
  assert.deepEqual(M.precioDe("QQQ", PRECIOS, {}), { fecha: "2026-10-27", precio: 500, fuente: "diario", listado: true });
  assert.equal(M.precioDe("VT", PRECIOS, {}).precio, 131, "sin «ultimo», usa el último del historial");
  const man = { QQQ: { precio: 505, fecha: "2026-10-28" }, VOO: { precio: 590, fecha: "2026-10-27" }, NVDA: { precio: 140, fecha: "2026-10-26" } };
  assert.equal(M.precioDe("QQQ", PRECIOS, man).fuente, "manual", "manual más nuevo que el diario");
  assert.equal(M.precioDe("VOO", PRECIOS, man).fuente, "diario", "el mismo día gana el diario");
  assert.deepEqual(M.precioDe("NVDA", PRECIOS, man), { fecha: "2026-10-26", precio: 140, fuente: "manual", listado: false });
  assert.deepEqual(M.precioDe("AAPL", PRECIOS, man), { precio: null, fecha: null, fuente: null, listado: false });
  assert.equal(M.precioDe("QQQ", null, null).precio, null, "sin archivo de precios (sin conexión la primera vez)");
  assert.equal(M.precioEn(PRECIOS, "QQQ", "2026-10-20"), 490, "el cierre anterior más cercano");
  assert.equal(M.precioEn(PRECIOS, "QQQ", "2026-09-30"), null);
  assert.equal(M.fechaPrecios(PRECIOS), "2026-10-27");
  assert.equal(M.diasEntre("2026-10-27", "2026-11-03"), 7);
});

test("posiciones a costo promedio, con G/P y peso", () => {
  const movs = [
    compra("a", "2026-10-01", "QQQ", 0.1, 480),
    compra("b", "2026-10-15", "QQQ", 0.1, 490),
    compra("c", "2026-10-15", "VOO", 0.05, 600),
    compra("d", "2026-10-20", "NVDA", 1, 130),
    mov("e", { tipo: "dividendo", fecha: "2026-10-25", ticker: "VOO", monto: 0.3 })
  ];
  const r = M.posiciones(movs, PRECIOS, null);
  const q = r.abiertas.find(o => o.ticker === "QQQ");
  assert.equal(q.cantidad, 0.2);
  assert.equal(q.invertido, M.red(48.15 + 49.15));
  assert.equal(q.costoPromedio, M.red(97.3 / 0.2, 4));
  assert.equal(q.valor, 100);
  assert.equal(q.gp, M.red(100 - 97.3));
  assert.equal(q.gpPct, M.red((2.7 / 97.3) * 100));
  assert.equal(q.grupo, "nucleo");
  const n = r.abiertas.find(o => o.ticker === "NVDA");
  assert.deepEqual([n.grupo, n.precio, n.valor, n.gp], ["satelite", null, null, null], "sin precio: sin valor ni G/P");
  assert.equal(r.abiertas.find(o => o.ticker === "VOO").dividendos, 0.3);
  assert.equal(r.total.sinPrecio, 1);
  assert.equal(r.total.valor, M.red(100 + 30 + 130.15), "sin precio cuenta a su costo");
  const pesos = r.abiertas.reduce((s, o) => s + o.peso, 0);
  assert.ok(Math.abs(pesos - 100) < 0.2);
  assert.deepEqual(r.abiertas.map(o => o.ticker), ["NVDA", "QQQ", "VOO"], "ordenadas por valor");
  assert.equal(r.total.gp, M.red(2.7 + (30 - 30.15)), "G/P solo de las que tienen precio");
});

test("ventas: ganancia realizada y posiciones cerradas", () => {
  const movs = [
    compra("a", "2026-10-01", "QQQ", 1, 400, 0),
    compra("b", "2026-10-02", "QQQ", 1, 500, 0),
    mov("c", { tipo: "venta", fecha: "2026-10-10", ticker: "QQQ", cantidad: 0.5, precio: 520, comision: 0.15 }),
    compra("d", "2026-10-01", "VT", 1, 100, 0),
    mov("e", { tipo: "venta", fecha: "2026-10-05", ticker: "VT", cantidad: 1, precio: 110, comision: 0 })
  ];
  const r = M.posiciones(movs, PRECIOS, null);
  const q = r.abiertas.find(o => o.ticker === "QQQ");
  assert.equal(q.cantidad, 1.5);
  assert.equal(q.costoPromedio, 450, "vender no cambia el costo promedio");
  assert.equal(q.realizado, M.red(260 - 0.15 - 225));
  assert.equal(r.cerradas.length, 1);
  assert.deepEqual([r.cerradas[0].ticker, r.cerradas[0].realizado, r.cerradas[0].cantidad], ["VT", 10, 0]);
  assert.equal(r.total.realizado, M.red(34.85 + 10));
  // Vender más de lo registrado: queda en cero, sin negativos.
  const raro = M.posiciones([compra("a", "2026-10-01", "VOO", 0.1, 600, 0), mov("b", { tipo: "venta", fecha: "2026-10-02", ticker: "VOO", cantidad: 1, precio: 600 })], PRECIOS, null);
  assert.equal(raro.abiertas.length, 0);
  assert.equal(raro.cerradas[0].cantidad, 0);
});

test("cartera: valor y G/P sobre lo aportado (con aportes viejos y efectivo)", () => {
  const movs = [
    M.normalizar("v", { date: "2026-09-28", name: "VOO", amount: 30 }),
    mov("f", { tipo: "fondeo", fecha: "2026-10-01", usd: 200 }),
    compra("a", "2026-10-01", "QQQ", 0.2, 480, 0.15)
  ];
  const c = M.cartera(movs, PRECIOS, null);
  assert.equal(c.resumen.aportado, 230);
  assert.equal(c.resumen.efectivo, M.red(200 - 96.15));
  assert.equal(c.valor, M.red(100 + (200 - 96.15) + 30));
  assert.equal(c.gp, M.red(c.valor - 230));
  assert.equal(c.gpPct, M.red((c.gp / 230) * 100));
  const sinPrecios = M.cartera(movs, null, null);
  assert.equal(sinPrecios.gp, 0, "sin precios, todo a su costo: G/P cero");
});

test("montos con signo", () => {
  assert.equal(M.usdS(2.1), "+US$ 2,10");
  assert.equal(M.usdS(-1.2), "−US$ 1,20");
  assert.equal(M.usdS(0), "US$ 0,00");
  assert.equal(M.pctS(1.44), "+1,4 %");
  assert.equal(M.pctS(-0.26), "−0,3 %");
  assert.equal(M.pct(-2.5), "−2,5 %");
});

test("ajustes: precios manuales se conservan", () => {
  assert.deepEqual(M.ajustes(null).preciosManuales, {});
  assert.deepEqual(M.ajustes({ preciosManuales: { NVDA: { precio: 1, fecha: "2026-10-01" } } }).preciosManuales.NVDA, { precio: 1, fecha: "2026-10-01" });
});
