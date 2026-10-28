const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/inversiones-motor.js");

const HOY = "2026-10-28";
const viejo = { date: "2026-10-01", name: "VOO", amount: 50, notes: "primer aporte" };

test("números con coma o punto (teclado del iPhone en español)", () => {
  assert.equal(M.numero("33,5"), 33.5);
  assert.equal(M.numero("33.5"), 33.5);
  assert.equal(M.numero("1.234,56"), 1234.56);
  assert.equal(M.numero("1,234.56"), 1234.56);
  assert.equal(M.numero(" US$ 12 "), 12);
  assert.ok(isNaN(M.numero("")));
  assert.ok(isNaN(M.numero("abc")));
  assert.ok(isNaN(M.numero("1,2,3x")));
  assert.equal(M.numero("8.020"), 8020, "punto de miles (estilo venezolano)");
  assert.equal(M.numero("8.020.000"), 8020000);
  assert.equal(M.numero("0.068"), 0.068);
  assert.equal(M.numero("487.10"), 487.1);
  assert.equal(M.numero("0,068"), 0.068);
  assert.equal(M.usd(1234.5), "US$ 1234,50");
  assert.equal(M.usd(-0.15), "−US$ 0,15");
  assert.equal(M.cantidadTexto(0.0523), "0,0523");
  assert.equal(M.fechaLarga("2026-10-05"), "5 oct 2026");
  assert.equal(M.mesTitulo("2026-10"), "Octubre 2026");
});

test("ajustes por defecto: núcleo de 6, DCA de US$ 200 con comisiones", () => {
  const a = M.ajustes(null);
  assert.deepEqual(M.nucleo(a), ["QQQ", "VOO", "SCHD", "VT", "VIG", "MSFT"]);
  assert.equal(a.broker, "Hapi");
  assert.equal(a.comisionTicker, 0.15);
  const total = M.nucleo(a).reduce((s, t) => s + a.tickers[t].dca, 0) + 6 * a.comisionTicker;
  assert.ok(total <= 200 && total > 199.9, `la ronda entra en US$ 200 (${total})`);
  const objetivo = M.nucleo(a).reduce((s, t) => s + a.tickers[t].objetivo, 0) + a.objetivoSatelite;
  assert.ok(Math.abs(objetivo - 100) < 0.1);
  const g = M.ajustes({ broker: "IBKR", comisionTicker: "x" });
  assert.equal(g.broker, "IBKR");
  assert.equal(g.comisionTicker, 0.15, "un valor raro vuelve al de por defecto");
});

test("registro viejo: se lee como aporte y conserva lo original", () => {
  const m = M.normalizar("a1", viejo);
  assert.equal(m.tipo, "aporte");
  assert.equal(m.viejo, true);
  assert.equal(m.monto, 50);
  assert.equal(m.fecha, "2026-10-01");
  assert.equal(m.nota, "primer aporte");
  assert.deepEqual(m.original, { fecha: "2026-10-01", nombre: "VOO", monto: 50, nota: "primer aporte" });
  assert.equal(M.tickerSugerido("voo"), "VOO");
  assert.equal(M.tickerSugerido("Fondo indexado"), "");
});

test("completar un aporte viejo solo AGREGA campos", () => {
  const r = M.validar("compra", { fecha: "2026-10-01", ticker: "voo", cantidad: "0,0805", precio: "619,20", comision: "0,15", broker: "Hapi", nota: "primer aporte" }, { hoy: HOY, viejo: true });
  assert.equal(r.ok, true);
  assert.equal(r.doc.v, undefined, "un registro viejo no recibe v");
  const add = M.camposCompletar(Object.assign({}, r.doc, { date: "x", name: "y", amount: 1, notes: "z" }));
  ["date", "name", "amount", "notes"].forEach(k => assert.equal(k in add, false, `no toca ${k}`));
  const guardado = Object.assign({}, viejo, add);
  const m = M.normalizar("a1", guardado);
  assert.equal(m.tipo, "compra");
  assert.equal(m.viejo, true);
  assert.equal(m.ticker, "VOO");
  assert.equal(m.original.monto, 50, "el monto original sigue ahí");
  assert.equal(m.total, M.red(0.0805 * 619.2 + 0.15));
  // Editar la fecha de un viejo: manda `fecha`, `date` queda igual.
  const editado = M.normalizar("a1", Object.assign({}, guardado, { fecha: "2026-09-30" }));
  assert.equal(editado.fecha, "2026-09-30");
  assert.equal(editado.original.fecha, "2026-10-01");
});

test("validar cada tipo", () => {
  const ok = (t, d) => M.validar(t, Object.assign({ fecha: "2026-10-15" }, d), { hoy: HOY });
  let r = ok("compra", { ticker: "QQQ", cantidad: "0,068", precio: "487,1", comision: "0,15", broker: "Hapi" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.doc, { tipo: "compra", fecha: "2026-10-15", ticker: "QQQ", cantidad: 0.068, precio: 487.1, comision: 0.15, broker: "Hapi", nota: "", v: 1 });
  r = ok("venta", { ticker: "QQQ", cantidad: "0", precio: "1" });
  assert.equal(r.ok, false);
  assert.equal(r.errores[0].campo, "cantidad");
  r = ok("dividendo", { ticker: "schd", monto: "0,42" });
  assert.deepEqual([r.ok, r.doc.ticker, r.doc.monto], [true, "SCHD", 0.42]);
  r = ok("interes", { monto: "0,9" });
  assert.equal(r.doc.monto, 0.9);
  r = ok("efectivo", { monto: "10", sentido: "retiro" });
  assert.equal(r.doc.sentido, "retiro");
  r = ok("fondeo", { bs: "8000", tasa: "", usd: "190" });
  assert.equal(r.ok, false, "Bs sin tipo de cambio");
  assert.equal(r.errores[0].campo, "tasa");
  r = ok("fondeo", { usd: "199,10" });
  assert.equal(r.ok, true, "fondeo directo en US$");
  r = M.validar("compra", { fecha: "2026-11-01", ticker: "VOO", cantidad: 1, precio: 1 }, { hoy: HOY });
  assert.equal(r.errores[0].texto, "La fecha no puede ser futura.");
  r = M.validar("compra", { fecha: "2026-09-01", ticker: "VOO", cantidad: 1, precio: 1 }, { hoy: HOY });
  assert.equal(r.ok, true, "fechas pasadas sí");
  r = ok("compra", { ticker: "<b>", cantidad: 1, precio: 1 });
  assert.equal(r.errores[0].campo, "ticker");
  assert.equal(M.validar("otro", {}, {}).ok, false);
});

test("fondeo: AirTM 1,40 % y transferencia 0,65 %", () => {
  const f = M.calcularFondeo({ bs: "8.020", tasa: "40,1" }, null);
  assert.equal(f.usdEnviado, 200);
  assert.equal(f.comisionAirtm, 2.8);
  assert.equal(f.comisionTransferencia, M.red((200 - 2.8) * 0.0065));
  assert.equal(f.usd, M.red(200 - 2.8 - (200 - 2.8) * 0.0065));
  assert.equal(M.calcularFondeo({ usdEnviado: "100" }, { comisionAirtm: 0, comisionTransferencia: 0 }).usd, 100);
  assert.equal(M.calcularFondeo({}, null), null);
  const mano = M.calcularFondeo({ usdEnviado: "100", comisionAirtm: "1,5" }, null);
  assert.equal(mano.comisionAirtm, 1.5, "la comisión escrita a mano manda");
  assert.equal(mano.comisionTransferencia, M.red(98.5 * 0.0065));
});

test("ronda DCA: una compra por ticker con su comisión", () => {
  const filas = [
    { ticker: "QQQ", monto: "33,18", precio: "487,10" },
    { ticker: "VOO", monto: "33,18", precio: "619,20", cantidad: "0,05" },
    { ticker: "SCHD", monto: "", precio: "" }
  ];
  const r = M.ronda({ fecha: "2026-10-15", broker: "Hapi", filas }, null, { hoy: HOY });
  assert.equal(r.ok, true);
  assert.equal(r.docs.length, 2, "la fila vacía se salta");
  assert.equal(r.docs[0].cantidad, M.cantidadDesdeMonto(33.18, 487.1));
  assert.equal(r.docs[1].cantidad, 0.05, "la cantidad escrita a mano manda");
  assert.equal(r.docs[0].ronda, "2026-10");
  assert.equal(r.docs[0].comision, 0.15);
  assert.equal(r.comisiones, 0.3);
  const mal = M.ronda({ fecha: "2026-10-15", filas: [{ ticker: "VT", monto: "30", precio: "" }] }, null, { hoy: HOY });
  assert.equal(mal.ok, false);
  assert.deepEqual(mal.errores.map(e => e.texto), ["VT: revisa el precio."], "solo el precio (la cantidad era automática)");
  const sinMonto = M.ronda({ fecha: "2026-10-15", filas: [{ ticker: "VT", monto: "abc", precio: "130" }] }, null, { hoy: HOY });
  assert.deepEqual(sinMonto.errores.map(e => [e.campo, e.texto]), [["VT.monto", "VT: revisa el monto."]]);
  assert.equal(M.ronda({ fecha: "2026-10-15", filas: [] }, null, {}).errores[0].campo, "filas");
  assert.equal(M.cantidadDesdeMonto(10, 3), 3.333333);
});

test("resumen: aportado, efectivo y comisiones", () => {
  const docs = {
    v1: viejo,
    f1: { v: 1, tipo: "fondeo", fecha: "2026-10-02", bs: 8020, tasa: 40.1, usdEnviado: 200, comisionAirtm: 2.8, comisionTransferencia: 1.28, usd: 195.92 },
    c1: { v: 1, tipo: "compra", fecha: "2026-10-03", ticker: "QQQ", cantidad: 0.1, precio: 500, comision: 0.15 },
    c2: { v: 1, tipo: "compra", fecha: "2026-10-03", ticker: "VOO", cantidad: 0.2, precio: 600, comision: 0.15 },
    d1: { v: 1, tipo: "dividendo", fecha: "2026-10-20", ticker: "VOO", monto: 0.5 },
    i1: { v: 1, tipo: "interes", fecha: "2026-10-27", monto: 0.2 }
  };
  const movs = Object.keys(docs).map(id => M.normalizar(id, docs[id]));
  const r = M.resumen(movs);
  assert.equal(r.comprado, 170.3);
  assert.equal(r.efectivo, M.red(195.92 + 0.5 + 0.2 - 170.3));
  assert.equal(r.aportado, M.red(195.92 + 50));
  assert.equal(r.comisiones, M.red(0.3 + 2.8 + 1.28));
  assert.equal(r.nAportesViejos, 1);
  assert.equal(r.tasaPromedio, 40.1);
  // Compras sin fondeo anotado: lo que falta cuenta como aportado.
  const solo = M.resumen([M.normalizar("c1", docs.c1)]);
  assert.equal(solo.aportado, 50.15);
  assert.equal(solo.efectivo, 0);
  assert.equal(M.interesMensual(1200, 6.5), 6.5);
});

test("orden, meses, cantidades y rondas", () => {
  const movs = [
    M.normalizar("a", { v: 1, tipo: "compra", fecha: "2026-09-30", ticker: "VT", cantidad: 1, precio: 1, creado: 1 }),
    M.normalizar("b", { v: 1, tipo: "compra", fecha: "2026-10-15", ticker: "VT", cantidad: 0.5, precio: 1, ronda: "2026-10", creado: 1 }),
    M.normalizar("c", { v: 1, tipo: "venta", fecha: "2026-10-15", ticker: "VT", cantidad: 0.2, precio: 1, creado: 2 })
  ];
  assert.deepEqual(M.ordenar(movs).map(m => m.id), ["c", "b", "a"]);
  assert.deepEqual(M.porMes(movs).map(g => [g.titulo, g.items.length]), [["Octubre 2026", 2], ["Septiembre 2026", 1]]);
  assert.deepEqual(M.cantidades(movs), { VT: 1.3 });
  assert.deepEqual(M.cantidades(movs, "c"), { VT: 1.5 });
  assert.equal(M.comprasDeRonda(movs, "2026-10").length, 1);
  assert.deepEqual(M.tickersConocidos(movs.concat(M.normalizar("d", { v: 1, tipo: "compra", fecha: "2026-10-01", ticker: "NVDA", cantidad: 1, precio: 1 })), null).slice(-2), ["MSFT", "NVDA"], "núcleo primero, sin repetir VT");
  assert.equal(M.normalizar("x", { v: 1, tipo: "raro" }).tipo, "desconocido");
});
