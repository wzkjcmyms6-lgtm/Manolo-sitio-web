const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../js/finanzas/datos.js");

// Cálculo de saldos tal como lo hacía la app antes (con decimales), para
// comprobar que el nuevo (en centavos) da exactamente lo mismo.
function saldosViejos(list) {
  const isCash = id => id === "efectivo" || id === "debito" || id === "gastos";
  const cw = id => (id === "gastos" ? "debito" : id);
  const pw = p => (p === "efectivo" ? "efectivo" : "debito");
  const cash = { efectivo: 0, debito: 0 };
  let deuda = 0;
  list.forEach(m => {
    if (m.type === "ingreso") cash[pw(m.payment)] += m.amount;
    else if (m.type === "gasto") { if (m.payment === "credito") deuda += m.amount; else cash[pw(m.payment)] -= m.amount; }
    else if (m.type === "pago_tarjeta") { cash[pw(m.payment)] -= m.amount; deuda -= m.amount; }
    else if (m.type === "transferencia") {
      const r = m.amountTo != null ? m.amountTo : m.amount;
      if (isCash(m.from)) cash[cw(m.from)] -= m.amount;
      if (isCash(m.to)) cash[cw(m.to)] += r;
      if (m.to === "tarjeta") deuda -= r;
    } else if (m.type === "ajuste_tarjeta") deuda -= m.amount;
  });
  return { efectivo: cash.efectivo, debito: cash.debito, saldo: cash.efectivo + cash.debito, deuda };
}

// Datos de ejemplo con todos los tipos y formatos viejos (ficticios).
function ejemplo(n) {
  const out = [];
  let s = 11;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pagos = ["efectivo", "debito", "credito"];
  for (let i = 0; i < n; i++) {
    const r = rnd();
    const amount = Math.round(rnd() * 50000) / 100;
    if (r < 0.7) out.push({ type: "gasto", payment: pagos[i % 3], amount, category: "comida", date: "2026-09-01" });
    else if (r < 0.8) out.push({ type: "ingreso", payment: i % 2 ? "debito" : "efectivo", amount, category: "salario", date: "2026-09-01" });
    else if (r < 0.88) out.push({ type: "transferencia", from: ["debito", "gastos", "efectivo", "ahorro"][i % 4], to: ["ahorro", "tarjeta", "debito", "viajes"][i % 4], amount, amountTo: i % 4 === 0 ? Math.round(amount / 6.96 * 100) / 100 : undefined, date: "2026-09-02" });
    else if (r < 0.95) out.push({ type: "pago_tarjeta", payment: "debito", amount, date: "2026-09-03" });
    else out.push({ type: "ajuste_tarjeta", amount, date: "2026-09-03" });
  }
  return out.map(m => { if (m.amountTo === undefined) delete m.amountTo; return m; });
}

test("centavos: números y texto con coma o punto", () => {
  assert.equal(D.aCentavos(12.5), 1250);
  assert.equal(D.aCentavos("12,5"), 1250);
  assert.equal(D.aCentavos("0.1"), 10);
  assert.equal(D.aCentavos(0.1 + 0.2), 30);
  assert.equal(D.aCentavos(1.005), 101); // el redondeo nunca deja medio centavo
  assert.equal(D.aCentavos(""), 0);
  assert.equal(D.aCentavos("abc"), 0);
  assert.equal(D.aCentavos(null), 0);
  assert.equal(D.sumaBs([{ a: 0.1 }, { a: 0.2 }], x => x.a), 0.3); // sin 0,30000000000000004
});

test("leer movimientos viejos y nuevos sin tocar el original", () => {
  const viejo = { type: "gasto", amount: 12.5, category: "comida", date: "2026-09-01" };
  const copia = JSON.parse(JSON.stringify(viejo));
  const m = D.adaptarMovimiento("a", viejo);
  assert.deepEqual(viejo, copia);
  assert.equal(m.montoCent, 1250);
  assert.equal(m.amount, 12.5);
  assert.equal(m.id, "a");
  // Transferencia en dos monedas
  const t = D.adaptarMovimiento("t", { type: "transferencia", from: "debito", to: "ahorro", amount: 700, amountTo: 100.57 });
  assert.equal(t.montoDestinoCent, 10057);
  // Nuevo: montoCent + amount
  assert.equal(D.adaptarMovimiento("n", { amount: 3.4, montoCent: 340 }).montoCent, 340);
  // Si una versión vieja de la app cambió solo "amount", manda "amount"
  assert.equal(D.adaptarMovimiento("x", { amount: 9, montoCent: 340 }).montoCent, 900);
  // Solo centavos (formato futuro)
  assert.equal(D.adaptarMovimiento("f", { montoCent: 777 }).amount, 7.77);
  // Datos raros no rompen nada
  const raro = D.adaptarMovimiento("r", { amount: "nada" });
  assert.equal(raro.montoCent, 0);
  assert.equal(raro.type, "gasto");
  assert.equal(raro.date, "");
});

test("escribir: lo nuevo lleva centavos y decimal iguales", () => {
  const w = D.conCentavos({ type: "gasto", amount: 25.1 });
  assert.equal(w.montoCent, 2510);
  assert.equal(w.amount, 25.1);
  assert.equal(w.v, D.ESQUEMA);
  const t = D.conCentavos({ type: "transferencia", amount: 700, amountTo: 100.567 });
  assert.equal(t.montoDestinoCent, 10057);
  assert.equal(D.conCentavos({ monto: -300 }).montoCent, -30000);
  assert.deepEqual(D.sinId({ id: "x", a: 1 }), { a: 1 });
});

test("saldos en centavos = saldos de antes (5.000 movimientos de todo tipo)", () => {
  const datos = ejemplo(5000);
  const nuevos = D.saldos(datos.map((d, i) => D.adaptarMovimiento("m" + i, d)));
  const viejos = saldosViejos(datos);
  for (const k of ["efectivo", "debito", "saldo", "deuda"]) assert.equal(nuevos[k], Math.round(viejos[k] * 100), k);
});

test("transferencias y pago de tarjeta nunca cuentan como gasto ni ingreso", () => {
  const movs = [
    { type: "ingreso", payment: "debito", amount: 1000 },
    { type: "transferencia", from: "debito", to: "ahorro", amount: 300, amountTo: 43.1 },
    { type: "gasto", payment: "credito", amount: 200 },
    { type: "pago_tarjeta", payment: "debito", amount: 200 }
  ].map((d, i) => D.adaptarMovimiento("m" + i, d));
  const s = D.saldos(movs);
  assert.equal(s.debito, 50000); // 1000 − 300 − 200
  assert.equal(s.deuda, 0);
  const gastos = D.sumaCent(movs.filter(m => m.type === "gasto"), m => m.amount);
  const ingresos = D.sumaCent(movs.filter(m => m.type === "ingreso"), m => m.amount);
  assert.equal(gastos, 20000);
  assert.equal(ingresos, 100000);
});

test("categoría borrada: se muestra su nombre, no «Otros»", () => {
  assert.equal(D.etiquetaDesdeId("gimnasio"), "Gimnasio");
  assert.equal(D.etiquetaDesdeId("comida_rapida"), "Comida rapida");
  assert.equal(D.etiquetaDesdeId("cafe_2"), "Cafe");
  assert.equal(D.etiquetaDesdeId(""), "Sin categoría");
});

test("fechas locales: a las 23:00 en Bolivia sigue siendo el mismo día", () => {
  const d = new Date(2026, 8, 30, 23, 0); // 30 sep 23:00 hora local
  assert.equal(D.isoLocal(d), "2026-09-30");
  assert.equal(D.isoLocal(new Date(2027, 0, 1, 0, 5)), "2027-01-01");
});

test("verificación: misma cantidad y mismos totales", () => {
  const crudos = ejemplo(3000);
  const adaptados = crudos.map((d, i) => D.adaptarMovimiento("m" + i, d));
  const v = D.verificar(crudos, adaptados);
  assert.ok(v.ok);
  assert.equal(v.total, 3000);
  assert.equal(v.conDecimalesExtra, 0);
  v.porTipo.forEach(f => assert.equal(f.centOriginal, f.centAdaptado, f.tipo));
  // Si falta un movimiento, la verificación lo detecta
  assert.equal(D.verificar(crudos, adaptados.slice(1)).ok, false);
  // Montos con más de 2 decimales: se informan
  const raros = [{ type: "gasto", amount: 33.333 }, { type: "gasto", amount: 10 }];
  const vr = D.verificar(raros, raros.map((d, i) => D.adaptarMovimiento("r" + i, d)));
  assert.equal(vr.conDecimalesExtra, 1);
  assert.ok(vr.ok);
});

test("respaldo: partes de hasta 800 documentos y se puede reconstruir igual", () => {
  const finanzas = ejemplo(2000).map((d, i) => Object.assign({ id: "m" + i }, d));
  const datos = { finanzas, ahorros: [{ id: "a1", amount: 100.57 }], carteras_movimientos: [], meta: { presupuestos: { comida: 1500 } } };
  const r = D.crearRespaldo(datos, 123);
  assert.deepEqual(r.resumen.conteos, { finanzas: 2000, ahorros: 1, carteras_movimientos: 0 });
  assert.equal(r.partes.filter(p => p.coleccion === "finanzas").length, 3);
  assert.ok(r.partes.every(p => JSON.stringify(p).length < 900000));
  const unido = D.unirRespaldo(r.partes.slice().reverse());
  assert.deepEqual(unido.finanzas, finanzas);
  assert.deepEqual(unido.meta, datos.meta);
  assert.equal(r.resumen.totalesCent.gasto, D.sumaCent(finanzas.filter(f => f.type === "gasto"), f => f.amount));
});
