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
  assert.deepStrictEqual(n[0], { id: "x", nombre: "Visa", limiteCent: 150050, diaPago: 10, diaCorte: null, color: TC.COLORES[0], creado: 0, pagoMinimoCent: null, cargos: [], cargosCategoria: null });
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
  assert.deepStrictEqual(r.datos, { nombre: "Visa Oro", limiteCent: 1500000, diaPago: 20, diaCorte: null, cargos: [], cargosCategoria: null });
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

// ---- Seguros y mantenimiento (D-165; reemplaza al pago mínimo de D-121) ----
test("seguros y mantenimiento: se guardan por tarjeta, opcionales", () => {
  let r = TC.validar({ nombre: "Visa", limite: "5000", cargosCategoria: "banco", cargos: [
    { nombre: "  Seguro de   desgravamen ", monto: "12,50" }, { nombre: "", monto: "" }, { id: "cg_viejo", nombre: "Mantenimiento", monto: "30" }] }, []);
  assert.ok(r.ok);
  assert.deepStrictEqual(r.datos.cargos, [{ id: null, nombre: "Seguro de desgravamen", montoCent: 1250 }, { id: "cg_viejo", nombre: "Mantenimiento", montoCent: 3000 }], "las filas vacías no cuentan");
  assert.strictEqual(r.datos.cargosCategoria, "banco");
  assert.strictEqual(TC.validar({ nombre: "Visa", limite: "5000", cargosCategoria: "banco", cargos: [] }, []).datos.cargosCategoria, null, "sin cargos, no guarda categoría");
  // Errores: le falta el nombre, el monto, no es número o es cero.
  r = TC.validar({ nombre: "Visa", limite: "5000", cargos: [{ nombre: "", monto: "30" }, { nombre: "Seguro", monto: "" }, { nombre: "Otro", monto: "treinta" }, { nombre: "Cero", monto: "0" }] }, []);
  assert.deepStrictEqual(r.errores.map(e => e.campo), ["cargoNombre0", "cargoMonto1", "cargoMonto2", "cargoMonto3"]);
  assert.match(r.errores[1].texto, /cuánto te cobran por «Seguro» cada mes/);
  assert.match(r.errores[2].texto, /«Otro» tiene que ser un número/);
  const siete = Array.from({ length: 7 }, (_, i) => ({ nombre: `S${i}`, monto: "1" }));
  assert.ok(!TC.validar({ nombre: "Visa", limite: "5000", cargos: siete }, []).ok, `hasta ${TC.MAX_CARGOS} cargos`);
  // Nueva: cada cargo con su id y el monto también en Bs.
  const n = TC.nueva({ nombre: "Visa", limiteCent: 500000, diaPago: 15, cargos: [{ id: null, nombre: "Seguro", montoCent: 1250 }, { id: null, nombre: "Mantenimiento", montoCent: 3000 }], cargosCategoria: "banco" }, [], 1767225600000);
  const b = (1767225600000).toString(36);
  assert.deepStrictEqual(n.cargos, [{ id: `cg_${b}_0`, nombre: "Seguro", montoCent: 1250, monto: 12.5 }, { id: `cg_${b}_1`, nombre: "Mantenimiento", montoCent: 3000, monto: 30 }]);
  assert.deepStrictEqual([n.cargosCategoria, n.cargosActualizado], ["banco", 1767225600000]);
  assert.ok(!("cargos" in TC.nueva({ nombre: "Sin", limiteCent: 100, diaPago: null, cargos: [] }, [], 1)), "sin cargos: la tarjeta queda como antes");
  // Editar: cada cargo conserva su id; lo demás (y lo desconocido, como el pago mínimo de antes) se conserva.
  const vieja = Object.assign({ extra: "x", pagoMinimoCent: 25000, pagoMinimo: 250 }, n);
  const e = TC.editar(vieja, { nombre: "Visa", limiteCent: 500000, diaPago: 15, cargos: [{ id: `cg_${b}_1`, nombre: "Mantenimiento", montoCent: 3500 }, { id: null, nombre: "Seguro contra fraude", montoCent: 1500 }] }, 1767312000000);
  assert.deepStrictEqual(e.cargos.map(c => [c.id, c.nombre, c.montoCent]), [[`cg_${b}_1`, "Mantenimiento", 3500], [`cg_${(1767312000000).toString(36)}_1`, "Seguro contra fraude", 1500]]);
  assert.deepStrictEqual([e.cargosActualizado, e.cargosCategoria, e.extra, e.pagoMinimoCent, e.id], [1767312000000, "banco", "x", 25000, n.id]);
  const igual = TC.editar(e, { nombre: "Visa Oro", limiteCent: 500000, diaPago: 15, cargos: e.cargos.map(c => ({ id: c.id, nombre: c.nombre, montoCent: c.montoCent })) }, 1767398400000);
  assert.strictEqual(igual.cargosActualizado, 1767312000000, "si no cambian, la fecha queda");
  assert.deepStrictEqual(TC.editar(e, { nombre: "Visa", limiteCent: 500000, diaPago: 15, cargos: [] }, 1767398400000).cargos, [], "quitarlos todos");
  // Lo guardado se lee limpio; el pago mínimo de antes se lee, pero ya no se usa.
  const l = TC.normalizar([{ id: "a", nombre: "A", limiteCent: 100, pagoMinimo: 80.5, cargosCategoria: "banco", cargos: [
    { id: "s", nombre: " Seguro ", monto: 12.5 }, { id: "s", nombre: "Repetido", montoCent: 1 }, { id: "m", nombre: "", montoCent: 3000 }, { id: "z", nombre: "Cero", montoCent: 0 }, { nombre: "Sin id", montoCent: 5 }] }])[0];
  assert.deepStrictEqual([l.cargos, l.cargosCategoria, l.pagoMinimoCent], [[{ id: "s", nombre: "Seguro", montoCent: 1250 }], "banco", 8050]);
  assert.ok(!("minimo" in TC.estado([], [l], "2026-11-10", 29).lista[0]), "ya no hay pago mínimo");
});

test("ciclo: día de pago anterior", () => {
  assert.strictEqual(TC.pagoAnterior(29, "2026-11-15"), "2026-10-29");
  assert.strictEqual(TC.pagoAnterior(29, "2026-11-29"), "2026-10-29", "el mismo día de pago");
  assert.strictEqual(TC.pagoAnterior(29, "2026-11-30"), "2026-11-29");
  assert.strictEqual(TC.pagoAnterior(31, "2027-03-10"), "2027-02-28", "en febrero, el último día");
  assert.strictEqual(TC.pagoAnterior(15, "2027-01-10"), "2026-12-15", "cruza el año");
});

const conCargos = Object.assign({}, visa, { cargos: [{ id: "seg", nombre: "Seguro de desgravamen", montoCent: 3450 }, { id: "man", nombre: "Mantenimiento", montoCent: 3000 }] });   // paga el 15
const gasto = (id, date, amount, extra) => mov(id, Object.assign({ date, type: "gasto", payment: "credito", amount, tarjetaId: "tc_visa" }, extra));
const pagoA = (id, date, amount, extra) => mov(id, Object.assign({ date, type: "transferencia", from: "debito", to: "tarjeta", amount, tarjetaId: "tc_visa" }, extra));

test("a pagar: lo que gastaste + seguros y mantenimiento, todo", () => {
  const movs = [gasto("g1", "2026-10-20", 1170)];
  // 10 nov: paga el 15 (en 5 días). Gastó 1.170; seguros y mantenimiento, 64,50.
  let c = TC.estado(movs, [conCargos], "2026-11-10", 29).lista[0];
  assert.deepStrictEqual(c.pagar, { cent: 123450, deudaCent: 117000, favorCent: 0, cargosCent: 6450, cargos: conCargos.cargos, alDia: null, pagadoCent: 0, urgencia: "aviso", desde: "2026-10-15",
    corte: null, abierto: false, despuesCent: 0 });
  assert.strictEqual(c.cargosMesCent, 6450);
  // Sin cargos: todo lo que debes. Un día antes, en rojo; con más de 7 días, normal.
  assert.deepStrictEqual([TC.estado(movs, [visa], "2026-11-14", 29).lista[0].pagar.cent, TC.estado(movs, [visa], "2026-11-14", 29).lista[0].pagar.urgencia], [117000, "mal"]);
  assert.strictEqual(TC.estado(movs, [visa], "2026-11-01", 29).lista[0].pagar.urgencia, "normal");
  // Sin gastos: igual te cobran seguros y mantenimiento.
  c = TC.estado([], [conCargos], "2026-11-10", 29).lista[0];
  assert.deepStrictEqual([c.pagar.cent, c.pagar.deudaCent, c.pagar.cargosCent], [6450, 0, 6450]);
  // Un saldo a favor se descuenta.
  c = TC.estado([pagoA("f", "2026-10-01", 20)], [conCargos], "2026-11-10", 29).lista[0];
  assert.deepStrictEqual([c.pagar.cent, c.pagar.favorCent], [4450, 2000]);
  // Total de todas las tarjetas.
  assert.strictEqual(TC.estado(movs.concat([mov("m1", { date: "2026-11-01", type: "gasto", payment: "credito", amount: 100, tarjetaId: "tc_master" })]), [conCargos, master], "2026-11-10", 29).pagarCent, 123450 + 10000);
});

test("a pagar: al pagar se anotan los cargos y la tarjeta queda al día", () => {
  const antes = [gasto("g1", "2026-10-20", 1170, { createdAt: 1 })];
  const t = TC.normalizar([conCargos])[0];
  // El pago del 13 nov: los cargos de este ciclo (el que vence el 15 nov).
  const pend = TC.cargosDelPago(t, antes, [t], "2026-11-13", 29);
  assert.deepStrictEqual([pend.ciclo, pend.cent, pend.lista.map(c => c.id)], ["2026-11-15", 6450, ["seg", "man"]]);
  const gastos = TC.gastosDeCargos(t, pend, "2026-11-13", "banco");
  assert.deepStrictEqual(gastos[0], { date: "2026-11-13", type: "gasto", category: "banco", payment: "credito", desc: "Seguro de desgravamen", amount: 34.5, excluded: false, factura: false, tarjetaId: "tc_visa", cargoCiclo: "2026-11-15", cargoId: "seg" });
  // Se guardan los cargos (un poco antes) y el pago de todo.
  const despues = antes.concat(gastos.map((g, i) => mov(`c${i}`, Object.assign({ createdAt: 9 }, g))), [pagoA("p", "2026-11-13", 1234.5, { createdAt: 10 })]);
  let c = TC.estado(despues, [t], "2026-11-13", 29).lista[0];
  assert.strictEqual(c.deudaCent, 0);
  assert.deepStrictEqual([c.pagar.cent, c.pagar.alDia, c.pagar.cargosCent, c.pagar.pagadoCent, c.pagar.urgencia], [0, "2026-11-13", 0, 123450, "ok"]);
  assert.strictEqual(TC.cargosDelPago(t, despues, [t], "2026-11-14", 29).cent, 0, "ya no faltan en este ciclo");
  // Lo que gastas después del pago va al pago siguiente: sigue al día.
  const luego = despues.concat([gasto("g2", "2026-11-13", 50, { createdAt: 11 }), gasto("g3", "2026-11-14", 20, { createdAt: 12 })]);
  c = TC.estado(luego, [t], "2026-11-14", 29).lista[0];
  assert.deepStrictEqual([c.deudaCent, c.pagar.cent, c.pagar.alDia], [7000, 0, "2026-11-13"]);
  // Nuevo ciclo (vence el 15 dic): lo nuevo + los cargos de diciembre.
  c = TC.estado(luego, [t], "2026-11-16", 29).lista[0];
  assert.deepStrictEqual([c.pagar.cent, c.pagar.alDia, c.pagar.cargosCent], [7000 + 6450, null, 6450]);
  assert.strictEqual(TC.cargosDelPago(t, luego, [t], "2026-11-16", 29).ciclo, "2026-12-15");
  // Un pago que no cubre todo: no está al día y falta lo que queda.
  c = TC.estado(antes.concat([pagoA("p", "2026-11-12", 1000, { createdAt: 5 })]), [t], "2026-11-13", 29).lista[0];
  assert.deepStrictEqual([c.pagar.alDia, c.pagar.cent, c.pagar.pagadoCent], [null, 17000 + 6450, 100000]);
  // Un pago del ciclo anterior no cuenta para este.
  c = TC.estado(antes.concat([pagoA("p", "2026-10-15", 1170, { createdAt: 5 }), gasto("g4", "2026-10-20", 10, { createdAt: 6 })]), [t], "2026-11-10", 29).lista[0];
  assert.deepStrictEqual([c.pagar.alDia, c.pagar.cent], [null, 1000 + 6450]);
  // Un cargo anotado para otra tarjeta u otro ciclo no cuenta.
  const otro = [gasto("x1", "2026-11-01", 34.5, { cargoCiclo: "2026-10-15", cargoId: "seg" }), mov("x2", { date: "2026-11-01", type: "gasto", payment: "credito", amount: 30, tarjetaId: "tc_master", cargoCiclo: "2026-11-15", cargoId: "man" })];
  assert.deepStrictEqual(TC.cargosPendientes(t, otro, [t, master], "2026-11-15").map(x => x.id), ["seg", "man"]);
});

test("a pagar: la categoría de los cargos", () => {
  const cats = [{ id: "comida", label: "Comida" }, { id: "otros", label: "Otros" }];
  assert.strictEqual(TC.categoriaCargos({}, cats), "otros", "sin una de banco: Otros");
  assert.strictEqual(TC.categoriaCargos({}, cats.concat([{ id: "banco_1", label: "Comisiones del banco" }])), "banco_1", "una de banco o seguros");
  assert.strictEqual(TC.categoriaCargos({ cargosCategoria: "comida" }, cats), "comida", "la que elegiste");
  assert.strictEqual(TC.categoriaCargos({ cargosCategoria: "borrada" }, cats), "otros", "si la borraste, la de siempre");
  assert.strictEqual(TC.categoriaCargos({}, [{ id: "a", label: "A" }]), "a");
  assert.strictEqual(TC.categoriaCargos({}, []), "otros");
});

// ---- Día de corte y de qué sale lo que pagas (D-166) ----
test("corte: el último antes del día de pago", () => {
  assert.strictEqual(TC.corteDe(20, "2026-12-05"), "2026-11-20", "corte 20, pago 5: el del mes anterior");
  assert.strictEqual(TC.corteDe(5, "2026-11-25"), "2026-11-05", "corte 5, pago 25: el mismo mes");
  assert.strictEqual(TC.corteDe(31, "2027-03-10"), "2027-02-28", "en febrero, el último día");
  assert.strictEqual(TC.corteDe(25, "2026-11-25"), "2026-10-25", "el mismo día que el pago: el del mes anterior");
  assert.strictEqual(TC.corteDe(20, "2026-11-20"), "2026-10-20", "el corte anterior a un corte");
  assert.strictEqual(TC.corteDe(28, "2027-01-05"), "2026-12-28", "cruza el año");
});

test("corte: se guarda en la tarjeta, opcional", () => {
  assert.strictEqual(TC.validar({ nombre: "Visa", limite: "5000", diaCorte: "20" }, []).datos.diaCorte, 20);
  assert.strictEqual(TC.validar({ nombre: "Visa", limite: "5000", diaCorte: "" }, []).datos.diaCorte, null, "vacío: no lo sabes");
  assert.deepStrictEqual(TC.validar({ nombre: "Visa", limite: "5000", diaCorte: "32" }, []).errores.map(e => e.campo), ["diaCorte"]);
  const n = TC.nueva({ nombre: "Visa", limiteCent: 500000, diaPago: 5, diaCorte: 20, cargos: [] }, [], 1);
  assert.strictEqual(n.diaCorte, 20);
  assert.ok(!("diaCorte" in TC.nueva({ nombre: "Otra", limiteCent: 100, diaPago: 5, diaCorte: null, cargos: [] }, [], 1)), "sin corte: la tarjeta queda como antes");
  assert.strictEqual(TC.editar(n, { nombre: "Visa", limiteCent: 500000, diaPago: 5, diaCorte: 22, cargos: [] }, 2).diaCorte, 22);
  assert.strictEqual(TC.editar(n, { nombre: "Visa", limiteCent: 500000, diaPago: 5, diaCorte: null, cargos: [] }, 2).diaCorte, null, "quitarlo");
  assert.ok(!("diaCorte" in TC.editar({ id: "a", nombre: "A" }, { nombre: "A", limiteCent: 100, diaPago: null, diaCorte: null, cargos: [] }, 2)), "si no cambia, no se toca");
  assert.strictEqual(TC.normalizar([{ id: "a", nombre: "A", limiteCent: 100, diaCorte: 40 }])[0].diaCorte, null);
});

// Corte el 20, pago el 5, seguro de Bs 40. El extracto de octubre (Bs 800) se
// pagó el 5 nov; en noviembre gastó 600 y 400 antes del corte y 80 después.
const conCorte = Object.assign({}, visa, { diaPago: 5, diaCorte: 20, cargos: [{ id: "seg", nombre: "Seguro", montoCent: 4000 }] });
const MESES = [
  gasto("o1", "2026-10-10", 800, { createdAt: 1 }), pagoA("p0", "2026-11-05", 800, { createdAt: 2 }),
  gasto("n1", "2026-11-10", 600, { createdAt: 3, desc: "Super" }), gasto("n2", "2026-11-18", 400, { createdAt: 4, desc: "Ropa" }),
  gasto("n3", "2026-11-25", 80, { createdAt: 5, desc: "Cena" })
];
const ids = l => l.map(m => m.id || m.nombre);

test("corte: pagas lo del extracto; lo de después va al pago siguiente", () => {
  const t = TC.normalizar([conCorte])[0];
  let c = TC.cuenta(t, MESES, [t], "2026-11-28", 29);
  assert.deepStrictEqual([c.pago.fecha, c.corte, c.abierto, c.antesCent], ["2026-12-05", "2026-11-20", false, 80000]);
  assert.deepStrictEqual([ids(c.gastos), ids(c.pagos), ids(c.nuevos), ids(c.pendientes)], [["n1", "n2"], ["p0"], ["n3"], ["seg"]]);
  assert.strictEqual(c.totalCent, 100000 + 4000, "el extracto (Bs 1.000) + el seguro; la cena va al pago siguiente");
  let e = TC.estado(MESES, [t], "2026-11-28", 29).lista[0];
  assert.deepStrictEqual([e.pagar.cent, e.pagar.deudaCent, e.pagar.cargosCent, e.pagar.despuesCent, e.pagar.urgencia, e.pagar.corte], [104000, 100000, 4000, 8000, "aviso", "2026-11-20"]);
  assert.strictEqual(e.deudaCent, 108000, "lo que debes en total sí incluye la cena");
  // Antes del corte, el extracto sigue abierto: cuenta todo hasta hoy.
  c = TC.cuenta(t, MESES.slice(0, 4), [t], "2026-11-18", 29);
  assert.deepStrictEqual([c.abierto, c.totalCent, c.nuevos.length], [true, 104000, 0]);
  // Al pagar el 1 dic, el seguro se anota con la fecha del corte (sale en ese extracto).
  const pend = TC.cargosDelPago(t, MESES, [t], "2026-12-01", 29);
  const g = TC.gastosDeCargos(t, pend, "2026-12-01", "otros");
  assert.deepStrictEqual([g[0].date, g[0].cargoCiclo, g[0].amount], ["2026-11-20", "2026-12-05", 40]);
  assert.strictEqual(TC.gastosDeCargos(t, TC.cargosDelPago(t, [], [t], "2026-11-15", 29), "2026-11-15", "otros")[0].date, "2026-11-15", "si pagas antes del corte, con la fecha del pago");
  const pagados = MESES.concat([mov("s1", Object.assign({ createdAt: 9 }, g[0])), pagoA("p1", "2026-12-01", 1040, { createdAt: 10 })]);
  e = TC.estado(pagados, [t], "2026-12-01", 29).lista[0];
  assert.deepStrictEqual([e.pagar.cent, e.pagar.alDia, e.pagar.despuesCent, e.pagar.cargosCent], [0, "2026-12-01", 8000, 0], "al día; la cena va al próximo");
  // El 6 dic empieza el ciclo siguiente: la cena + el seguro de enero.
  c = TC.cuenta(t, pagados, [t], "2026-12-06", 29);
  assert.deepStrictEqual([c.corte, c.abierto, c.antesCent, ids(c.gastos), ids(c.pagos), c.totalCent], ["2026-12-20", true, 104000, ["n3"], ["p1"], 8000 + 4000]);
});

test("de qué sale, sin corte: lo gastado, los seguros y lo ya pagado", () => {
  const t = TC.normalizar([conCargos])[0];
  const antes = [gasto("g1", "2026-10-20", 1170, { createdAt: 1 }), pagoA("p", "2026-11-12", 100, { createdAt: 2 })];
  let c = TC.cuenta(t, antes, [t], "2026-11-13", 29);
  assert.deepStrictEqual([c.corte, c.antesCent, ids(c.gastos), ids(c.pagos), ids(c.pendientes), c.totalCent, c.alDia], [null, 0, ["g1"], ["p"], ["seg", "man"], 107000 + 6450, null]);
  // Pagó todo el 13: lo cubierto y lo nuevo, separados.
  const pend = TC.cargosDelPago(t, antes, [t], "2026-11-13", 29);
  const todo = antes.concat(TC.gastosDeCargos(t, pend, "2026-11-13", "otros").map((g, i) => mov(`c${i}`, Object.assign({ createdAt: 5 }, g))),
    [pagoA("q", "2026-11-13", 1134.5, { createdAt: 6 }), gasto("g2", "2026-11-14", 50, { createdAt: 7 })]);
  c = TC.cuenta(t, todo, [t], "2026-11-14", 29);
  assert.deepStrictEqual([c.alDia, ids(c.gastos), ids(c.cargos), ids(c.pagos), ids(c.nuevos), c.totalCent, c.pendientes.length], ["2026-11-13", ["g1"], ["c0", "c1"], ["p", "q"], ["g2"], 0, 0]);
  // Un saldo de antes sin pagar (no pagó todo el mes pasado) se suma.
  c = TC.cuenta(t, [gasto("v", "2026-10-01", 500, { createdAt: 1 })], [t], "2026-11-10", 29);
  assert.deepStrictEqual([c.antesCent, c.gastos.length, c.totalCent], [50000, 0, 50000 + 6450]);
});

