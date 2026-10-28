const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/inversiones-motor.js");
const S = require("../js/inversiones-series.js");

const PRECIOS = { tickers: {
  QQQ: { ultimo: { fecha: "2026-10-27", cierre: 520 }, historial: { "2026-10-02": 500, "2026-10-09": 490, "2026-10-27": 520 } },
  VOO: { ultimo: { fecha: "2026-10-27", cierre: 610 }, historial: { "2026-10-02": 600, "2026-10-27": 610 } }
} };
const TC = { ultimo: { fecha: "2026-10-27", tco: 12.02 }, historial: { "2026-09-24": 12.26, "2026-10-01": 12.0, "2026-10-02": 11.9, "2026-10-27": 12.02 } };
const n = (id, d) => M.normalizar(id, Object.assign({ v: 1, creado: 0 }, d));
const MOVS = [
  M.normalizar("v", { date: "2026-09-28", name: "Fondo", amount: 30 }),
  n("f", { tipo: "fondeo", fecha: "2026-10-02", bs: 2800, tasa: 14, usdEnviado: 200, comisionAirtm: 2.8, comisionTransferencia: 1.2, usd: 196 }),
  n("c1", { tipo: "compra", fecha: "2026-10-02", ticker: "QQQ", cantidad: 0.2, precio: 500, comision: 0.15 }),
  n("c2", { tipo: "compra", fecha: "2026-10-09", ticker: "VOO", cantidad: 0.15, precio: 600, comision: 0.15 }),
  n("s1", { tipo: "venta", fecha: "2026-10-20", ticker: "QQQ", cantidad: 0.05, precio: 510, comision: 0.15 }),
  n("d1", { tipo: "dividendo", fecha: "2026-10-22", ticker: "VOO", monto: 0.4 }),
  n("c3", { tipo: "compra", fecha: "2026-10-25", ticker: "NVDA", cantidad: 1, precio: 130, comision: 0.15 })
];
const AJ = { preciosManuales: { NVDA: { precio: 140, fecha: "2026-10-26" } } };

test("serie diaria: termina igual que el Resumen y usa el precio de cada día", () => {
  const s = S.serie(MOVS, PRECIOS, AJ, "2026-10-28");
  assert.equal(s[0].fecha, "2026-09-28", "empieza en el primer movimiento");
  assert.equal(s[s.length - 1].fecha, "2026-10-28", "llega hasta hoy");
  assert.equal(s.length, 31);
  const c = M.cartera(MOVS, PRECIOS, AJ);
  const u = s[s.length - 1];
  assert.equal(u.valor, c.valor, "valor de hoy = valor de la cartera");
  assert.equal(u.aportado, c.resumen.aportado, "aportado de hoy = aportado del Resumen");
  assert.equal(u.dividendos, 0.4);
  const d9 = s.find(p => p.fecha === "2026-10-09");
  // 9 oct: QQQ 0,2 a 490; VOO 0,15 a 600 (cierre del 2 oct); efectivo 196 − 100,15 − 90,15; aporte viejo 30.
  assert.equal(d9.valor, M.red(0.2 * 490 + 0.15 * 600 + (196 - 100.15 - 90.15) + 30));
  const d25 = s.find(p => p.fecha === "2026-10-25");
  const d24 = s.find(p => p.fecha === "2026-10-24");
  assert.equal(M.red(d25.valor - d25.aportado), M.red(d24.valor - d24.aportado), "comprar NVDA sin precio (cuenta a su costo, con comisión) no cambia la ganancia");
  const d26 = s.find(p => p.fecha === "2026-10-26");
  assert.ok(d26.valor > d25.valor, "el precio manual de NVDA cuenta desde su fecha");
  assert.deepEqual(S.serie([], PRECIOS, AJ, "2026-10-28"), []);
});

test("aportes por mes y meta mensual", () => {
  const s = S.serie(MOVS, PRECIOS, AJ, "2026-10-28");
  const m = S.aportesPorMes(s);
  assert.deepEqual(m.map(x => [x.mes, x.corto]), [["2026-09", "sep"], ["2026-10", "oct"]]);
  assert.equal(m[0].monto, 30);
  assert.equal(M.red(m[0].monto + m[1].monto), s[s.length - 1].aportado, "la suma de los meses es lo aportado");
  assert.equal(S.metaMensual(null), 199.98, "US$ 33,18 × 6 + US$ 0,90");
});

test("distribución contra el objetivo (núcleo y satélite)", () => {
  const pos = M.posiciones(MOVS, PRECIOS, AJ);
  const d = S.distribucion(pos, AJ);
  const nvda = d.filas.find(f => f.ticker === "NVDA");
  assert.equal(nvda.grupo, "satelite");
  assert.equal(nvda.objetivo, null, "el satélite tiene objetivo de grupo, no por ticker");
  assert.equal(d.filas.find(f => f.ticker === "QQQ").objetivo, 15.83);
  const vt = d.filas.find(f => f.ticker === "VT");
  assert.deepEqual([vt.peso, vt.objetivo], [0, 15.83], "los del núcleo sin comprar también aparecen");
  assert.ok(Math.abs(d.nucleo + d.satelite - 100) < 0.2);
  assert.equal(d.objetivoNucleo, 95);
  assert.equal(d.objetivoSatelite, 5);
  assert.deepEqual(d.filas.slice(-1).map(f => f.ticker), ["NVDA"], "satélite al final");
});

test("tipos de cambio: TCO del BCB y tipo real de AirTM", () => {
  const tco = S.lectorTco(TC);
  assert.equal(tco("2026-09-01"), 12.26, "antes del historial, el primero");
  assert.equal(tco("2026-10-02"), 11.9);
  assert.equal(tco("2026-10-15"), 11.9, "fin de semana o día sin dato: el anterior");
  assert.equal(tco("2026-10-28"), 12.02);
  assert.equal(S.lectorTco(null), null);
  assert.equal(S.lectorTco({ ultimo: { tco: 12 } })("2026-01-01"), 12);
  const real = S.lectorReal(MOVS.concat(n("f2", { tipo: "fondeo", fecha: "2026-10-26", bs: 1500, tasa: 15, usdEnviado: 100, usd: 98 })));
  assert.equal(real.costoEn("2026-09-28"), 2800 / 196, "antes del primer fondeo, el del primero");
  assert.equal(real.costoEn("2026-10-26"), 4300 / 294, "promedio de los fondeos hasta esa fecha");
  assert.equal(real.ultimo, 15);
  assert.equal(real.fechaUltimo, "2026-10-26");
  assert.equal(S.lectorReal([MOVS[2]]), null, "sin fondeos con Bs no hay tipo real");
});

test("rendimiento: US$, Bs con TCO y Bs con el tipo real", () => {
  const base = [MOVS[1], MOVS[2]]; // fondeo 2800 Bs (196 US$ llegaron) y compra de QQQ
  const r = S.rendimiento(base, PRECIOS, null, TC, "2026-10-28");
  const valor = M.red(0.2 * 520 + (196 - 100.15));
  assert.equal(r.usd.valor, valor);
  assert.equal(r.usd.aportado, 196);
  assert.equal(r.usd.gp, M.red(valor - 196));
  assert.equal(r.bsTco.aportado, M.red(196 * 11.9), "lo aportado, al TCO del día del fondeo");
  assert.equal(r.bsTco.valor, M.red(valor * 12.02), "el valor, al TCO de hoy");
  assert.equal(r.bsTco.gp, M.red(valor * 12.02 - 196 * 11.9));
  assert.equal(r.bsReal.aportado, 2800, "con el tipo real cuentan los Bs que mandaste");
  assert.equal(r.bsReal.valor, M.red(valor * 14), "y el valor, al tipo de tu último fondeo");
  assert.equal(r.bsReal.tasa, 14);
  const q = r.tickers.find(t => t.ticker === "QQQ");
  assert.equal(q.usd, M.red(0.2 * 520 - 100.15));
  assert.equal(q.bsTco, M.red(0.2 * 520 * 12.02 - 100.15 * 11.9));
  assert.equal(q.bsReal, M.red(0.2 * 520 * 14 - 100.15 * (2800 / 196)));
  // Sin tipo de cambio ni fondeos con Bs: solo US$.
  const solo = S.rendimiento([MOVS[2]], PRECIOS, null, null, "2026-10-28");
  assert.equal(solo.bsTco, null);
  assert.equal(solo.bsReal, null);
  assert.equal(solo.tickers[0].bsTco, null);
  assert.equal(S.rendimiento([], PRECIOS, null, TC, "2026-10-28"), null);
});

test("rendimiento por ticker en US$ = G/P abierta + realizada + dividendos", () => {
  const r = S.rendimiento(MOVS, PRECIOS, AJ, TC, "2026-10-28");
  const pos = M.posiciones(MOVS, PRECIOS, AJ);
  pos.abiertas.forEach(o => {
    const t = r.tickers.find(x => x.ticker === o.ticker);
    assert.equal(t.usd, M.red(o.gp + o.realizado + o.dividendos), o.ticker);
  });
  assert.equal(r.usd.gp, M.red(M.cartera(MOVS, PRECIOS, AJ).gp));
  assert.deepEqual(S.dividendosPorTicker(MOVS), [{ ticker: "VOO", monto: 0.4 }]);
});
