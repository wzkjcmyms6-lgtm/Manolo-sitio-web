const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/inversiones-motor.js");

const n = (id, d) => M.normalizar(id, Object.assign({ v: 1, creado: 0 }, d));
const compra = (id, fecha, ticker, extra) => n(id, Object.assign({ tipo: "compra", fecha, ticker, cantidad: 0.1, precio: 300, comision: 0.15, broker: "Hapi" }, extra));

test("ronda del mes: hechos, faltan y completa", () => {
  const movs = [compra("a", "2026-10-02", "QQQ", { ronda: "2026-10" }), compra("b", "2026-10-15", "VOO"), compra("c", "2026-09-30", "VT"), compra("d", "2026-10-03", "NVDA")];
  const r = M.estadoRonda(movs, null, "2026-10");
  assert.deepEqual(r.hechos, ["QQQ", "VOO"], "cuenta compras de la ronda y sueltas del mes");
  assert.deepEqual(r.faltan, ["SCHD", "VT", "VIG", "MSFT"], "VT de septiembre no cuenta");
  assert.equal(r.invertido, M.red(2 * 30.15), "NVDA (satélite) no suma a la ronda");
  assert.equal(r.completa, false);
  const todo = ["QQQ", "VOO", "SCHD", "VT", "VIG", "MSFT"].map((t, i) => compra(`x${i}`, "2026-10-02", t));
  assert.equal(M.estadoRonda(todo, null, "2026-10").completa, true);
  const sinPlan = M.estadoRonda(todo, { tickers: { QQQ: { grupo: "nucleo", dca: 0 } } }, "2026-10");
  assert.equal(sinPlan.completa, false, "sin tickers con monto mensual no hay ronda");
  assert.deepEqual(sinPlan.plan, []);
});

test("CSV para Excel en español: ; coma decimal, comillas y registro original", () => {
  const movs = [
    compra("a", "2026-10-02", "QQQ", { nota: 'ronda; "octubre"', ronda: "2026-10" }),
    n("f", { tipo: "fondeo", fecha: "2026-10-01", bs: 2800, tasa: 14, usdEnviado: 200, comisionAirtm: 2.8, comisionTransferencia: 1.28, usd: 195.92 }),
    n("r", { tipo: "efectivo", fecha: "2026-10-20", sentido: "retiro", monto: 5 }),
    M.normalizar("v", { date: "2026-09-28", name: "VOO", amount: 50, notes: "primer aporte" })
  ];
  const csv = M.exportarCsv(movs);
  assert.ok(csv.startsWith("﻿"), "BOM para que Excel lea los acentos");
  const filas = csv.slice(1).trim().split("\r\n");
  assert.equal(filas[0], M.COLUMNAS_CSV.join(";"));
  assert.equal(filas.length, 5);
  assert.ok(filas[1].startsWith("2026-09-28;aporte;"), "de la más vieja a la más nueva");
  assert.match(filas[1], /2026-09-28 VOO US\$ 50 \(primer aporte\)/);
  const q = filas.find(f => f.includes(";QQQ;")).split(";");
  assert.equal(q[3], "0,1");
  assert.equal(q[4], "300");
  assert.equal(q[6], "30,15", "total con comisión");
  assert.match(filas.find(f => f.includes(";QQQ;")), /"ronda; ""octubre"""/, "la nota con ; y comillas va entre comillas");
  const f = filas.find(x => x.includes(";fondeo;")).split(";");
  assert.deepEqual([f[9], f[10], f[11], f[14]], ["2800", "14", "200", "195,92"]);
  assert.ok(filas.some(x => x.startsWith("2026-10-20;retiro;")));
});

test("JSON completo con ids y ajustes", () => {
  const docs = { b: { v: 1, tipo: "interes", fecha: "2026-10-27", monto: 0.2 }, a: { date: "2026-09-28", name: "VOO", amount: 50, notes: "" } };
  const j = JSON.parse(M.exportarJson(docs, { broker: "IBKR" }, "2026-10-28T10:00:00Z"));
  assert.equal(j.version, 1);
  assert.equal(j.ajustes.broker, "IBKR");
  assert.deepEqual(j.movimientos.map(m => m.id), ["a", "b"]);
  assert.equal(j.movimientos[0].amount, 50, "los registros viejos salen tal cual");
});
