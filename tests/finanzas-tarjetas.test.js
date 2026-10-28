const test = require("node:test");
const assert = require("node:assert");
const TC = require("../js/finanzas/tarjetas.js");
const FD = require("../js/finanzas/datos.js");

const visa = { id: "tc_visa", nombre: "Visa BNB", limiteCent: 500000, diaPago: 15, color: "#e05656" };
const master = { id: "tc_master", nombre: "Master Ganadero", limiteCent: 200000, diaPago: null, color: "#4d9de0" };
const mov = (id, d) => FD.adaptarMovimiento(id, d);

const MOVS = [
  mov("a", { date: "2026-10-01", type: "gasto", payment: "credito", amount: 300 }),                         // viejo: sin tarjetaId → principal
  mov("b", { date: "2026-10-02", type: "gasto", payment: "credito", amount: 150.5, tarjetaId: "tc_master" }),
  mov("c", { date: "2026-10-03", type: "gasto", payment: "efectivo", amount: 40 }),                         // no es tarjeta
  mov("d", { date: "2026-10-04", type: "transferencia", from: "debito", to: "tarjeta", amount: 100, tarjetaId: "tc_visa" }),
  mov("e", { date: "2026-10-05", type: "pago_tarjeta", payment: "debito", amount: 50 }),                    // pago viejo → principal
  mov("f", { date: "2026-10-06", type: "ajuste_tarjeta", amount: 20, tarjetaId: "tc_master" }),
  mov("g", { date: "2026-10-07", type: "gasto", payment: "credito", amount: 75, tarjetaId: "tc_borrada" }), // tarjeta que ya no existe → principal
  mov("h", { date: "2026-10-08", type: "ingreso", payment: "debito", amount: 1000 })
];

test("normalizar: limpia lo guardado", () => {
  const n = TC.normalizar([
    { id: "x", nombre: "  Visa ", limite: 1500.5, diaPago: "10" },
    { id: "x", nombre: "repetida" },
    { id: "", nombre: "sin id" },
    { id: "y", nombre: "   " },
    { id: "z", nombre: "Master", limiteCent: 200000, diaPago: 40, color: "rojo" }
  ]);
  assert.strictEqual(n.length, 2);
  assert.deepStrictEqual(n[0], { id: "x", nombre: "Visa", limiteCent: 150050, diaPago: 10, color: TC.COLORES[0], creado: 0 });
  assert.strictEqual(n[1].diaPago, null);
  assert.strictEqual(n[1].color, TC.COLORES[1]);
  assert.deepStrictEqual(TC.normalizar(null), []);
});

test("cada movimiento va a su tarjeta; lo viejo, a la principal", () => {
  const t = [visa, master];
  assert.strictEqual(TC.tarjetaDe(MOVS[0], t), "tc_visa");
  assert.strictEqual(TC.tarjetaDe(MOVS[1], t), "tc_master");
  assert.strictEqual(TC.tarjetaDe(MOVS[6], t), "tc_visa");
  assert.strictEqual(TC.tarjetaDe(MOVS[0], []), null);
});

test("deudas: la suma es siempre la deuda total de Finanzas", () => {
  const d = TC.deudas(MOVS, [visa, master]);
  assert.deepStrictEqual(d, { tc_visa: 30000 - 10000 - 5000 + 7500, tc_master: 15050 - 2000 });
  assert.strictEqual(d.tc_visa + d.tc_master, FD.saldos(MOVS).deuda);
  const una = TC.deudas(MOVS, [master]);
  assert.strictEqual(una.tc_master, FD.saldos(MOVS).deuda, "con una sola tarjeta, toda la deuda es suya");
  assert.deepStrictEqual(TC.deudas(MOVS, []), {});
});

test("pago a la tarjeta en otra moneda: cuenta lo que llegó", () => {
  const m = mov("p", { date: "2026-10-09", type: "transferencia", from: "ahorro", to: "tarjeta", amount: 10, amountTo: 69.6, tarjetaId: "tc_master" });
  assert.strictEqual(TC.efectoDeuda(m), -6960);
});

test("próximo pago (último día en meses cortos)", () => {
  assert.deepStrictEqual(TC.proximoPago(15, "2026-10-10"), { fecha: "2026-10-15", dias: 5 });
  assert.deepStrictEqual(TC.proximoPago(15, "2026-10-15"), { fecha: "2026-10-15", dias: 0 });
  assert.deepStrictEqual(TC.proximoPago(15, "2026-10-16"), { fecha: "2026-11-15", dias: 30 });
  assert.deepStrictEqual(TC.proximoPago(31, "2027-02-10"), { fecha: "2027-02-28", dias: 18 });
  assert.deepStrictEqual(TC.proximoPago(30, "2026-12-31"), { fecha: "2027-01-30", dias: 30 });
});

test("estado: disponible, uso y totales", () => {
  const e = TC.estado(MOVS, [visa, master], "2026-10-10", 29);
  const v = e.lista[0], m = e.lista[1];
  assert.strictEqual(v.deudaCent, 22500);
  assert.strictEqual(v.disponibleCent, 477500);
  assert.strictEqual(v.nivel, "ok");
  assert.deepStrictEqual(v.pago, { fecha: "2026-10-15", dias: 5 });
  assert.deepStrictEqual(m.pago, { fecha: "2026-10-29", dias: 19 }, "sin día propio usa el de Ajustes");
  assert.strictEqual(m.disponibleCent, 200000 - 13050);
  assert.deepStrictEqual(e.total, { limiteCent: 700000, deudaCent: 35550, disponibleCent: 700000 - 35550, uso: 35550 / 700000, nivel: "ok" });
});

test("estado: saldo a favor no suma disponible extra; pasarse del límite", () => {
  const t = [{ id: "a", nombre: "A", limiteCent: 10000, diaPago: 1, color: "#e05656" }];
  const aFavor = TC.estado([mov("x", { date: "2026-10-01", type: "transferencia", from: "debito", to: "tarjeta", amount: 30 })], t, "2026-10-10");
  assert.strictEqual(aFavor.lista[0].deudaCent, -3000);
  assert.strictEqual(aFavor.lista[0].disponibleCent, 10000);
  assert.strictEqual(aFavor.lista[0].uso, 0);
  const pasada = TC.estado([mov("y", { date: "2026-10-01", type: "gasto", payment: "credito", amount: 120 })], t, "2026-10-10");
  assert.strictEqual(pasada.lista[0].disponibleCent, -2000);
  assert.strictEqual(pasada.lista[0].nivel, "pasado");
  assert.strictEqual(TC.nivel(0.5), "medio");
  assert.strictEqual(TC.nivel(0.8), "alto");
  assert.strictEqual(TC.nivel(1), "alto");
});

test("leerMonto: coma decimal y punto de miles", () => {
  assert.strictEqual(TC.leerMonto("5000"), 500000);
  assert.strictEqual(TC.leerMonto("5000,50"), 500050);
  assert.strictEqual(TC.leerMonto("5000.5"), 500050);
  assert.strictEqual(TC.leerMonto("15.000"), 1500000);
  assert.strictEqual(TC.leerMonto("1.500.000,25"), 150000025);
  assert.strictEqual(TC.leerMonto("Bs 8.000"), 800000);
  assert.strictEqual(TC.leerMonto(""), null);
  assert.ok(Number.isNaN(TC.leerMonto("cinco mil")));
});

test("validar el formulario", () => {
  let r = TC.validar({ nombre: "  Visa   Oro ", limite: "15.000", diaPago: "20" }, [visa]);
  assert.ok(r.ok);
  assert.deepStrictEqual(r.datos, { nombre: "Visa Oro", limiteCent: 1500000, diaPago: 20 });
  r = TC.validar({ nombre: "", limite: "", diaPago: "" }, []);
  assert.deepStrictEqual(r.errores.map(e => e.campo), ["nombre", "limite"]);
  r = TC.validar({ nombre: "visa bnb", limite: "0", diaPago: "32" }, [visa]);
  assert.deepStrictEqual(r.errores.map(e => e.campo), ["nombre", "limite", "diaPago"]);
  assert.ok(TC.validar({ nombre: "Visa BNB", limite: "6000" }, [visa], "tc_visa").ok, "al editar, su propio nombre no choca");
  assert.strictEqual(TC.validar({ nombre: "Otra", limite: "100" }, []).datos.diaPago, null);
  const diez = Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, nombre: `T${i}` }));
  assert.ok(!TC.validar({ nombre: "Once", limite: "100" }, diez).ok);
});

test("nueva y editar", () => {
  const n = TC.nueva({ nombre: "Visa", limiteCent: 500000, diaPago: 15 }, [master], 1767225600000);
  assert.deepStrictEqual(n, { id: "tc_" + (1767225600000).toString(36), nombre: "Visa", limiteCent: 500000, limite: 5000, diaPago: 15, color: TC.COLORES[1], creado: 1767225600000 });
  const otra = TC.nueva({ nombre: "Otra", limiteCent: 100, diaPago: null }, [master, n], 1767225600000);
  assert.strictEqual(otra.id, "tc_" + (1767225600000).toString(36) + "_2", "mismo milisegundo: id distinto");
  const e = TC.editar(n, { nombre: "Visa Oro", limiteCent: 800000, diaPago: null });
  assert.strictEqual(e.id, n.id);
  assert.strictEqual(e.color, n.color);
  assert.strictEqual(e.limite, 8000);
  assert.strictEqual(e.diaPago, null);
});
