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

// ---------- 1d: copia en archivo, importación, CSV y modo demo ----------
const Demo = require("../js/finanzas/demo.js");

test("copia en archivo: se valida y se detectan archivos que no son copias", () => {
  const datos = { finanzas: [{ id: "m1", date: "2026-09-01", type: "gasto", amount: 10 }], ahorros: [], carteras_movimientos: [], meta: { presupuestos: { comida: 100 }, finanzas_esquema: { x: 1 } } };
  const c = D.copiaCompleta(datos, new Date(2026, 8, 30, 23, 30).getTime());
  assert.equal(c.app, "manolo-finanzas");
  assert.equal(c.fecha, "2026-09-30"); // hora local, no UTC
  assert.deepEqual(c.conteos, { finanzas: 1, ahorros: 0, carteras_movimientos: 0 });
  assert.ok(!("finanzas_esquema" in c.datos.meta)); // lo interno no viaja
  const json = JSON.parse(JSON.stringify(c));
  assert.ok(D.validarCopia(json).ok);
  assert.equal(D.validarCopia({ hola: 1 }).ok, false);
  assert.equal(D.validarCopia(null).ok, false);
  assert.equal(D.validarCopia({ app: "manolo-finanzas", version: 99, datos: {} }).ok, false);
  assert.equal(D.validarCopia({ app: "manolo-finanzas", version: 2, datos: { finanzas: "roto" } }).ok, false);
});

test("importar: solo agrega lo que falta, nunca cambia lo que ya tienes", () => {
  const actual = {
    finanzas: [{ id: "m1", date: "2026-09-01", type: "gasto", amount: 10 }], ahorros: [], carteras_movimientos: [],
    meta: {
      presupuestos: { comida: 100 },
      categorias_gasto: { groups: [{ id: "comida", nombre: "Comida", items: [{ id: "comida", label: "Comida" }] }] },
      carteras_custom: { list: [{ id: "viajes", nombre: "Viajes", moneda: "Bs" }] },
      finanzas_ajustes: { reivaPct: 5 }
    }
  };
  const copia = D.copiaCompleta({
    finanzas: [{ id: "m1", date: "2026-09-01", type: "gasto", amount: 999 }, { id: "m2", date: "2026-09-02", type: "ingreso", amount: 50 }, { id: "malo", date: "ayer", amount: 1 }],
    ahorros: [{ id: "a1", amount: 5 }], carteras_movimientos: [],
    meta: {
      presupuestos: { comida: 555, transporte: 200 },
      categorias_gasto: { groups: [{ id: "comida", nombre: "Comida", items: [{ id: "comida", label: "Comida" }, { id: "cafe", label: "Café" }] }, { id: "mascotas", nombre: "Mascotas", items: [{ id: "mascotas", label: "Mascotas" }] }], archivadas: [{ id: "gym", label: "Gym" }] },
      carteras_custom: { list: [{ id: "viajes", nombre: "Otro nombre", moneda: "Bs" }, { id: "casa", nombre: "Casa", moneda: "US$" }] },
      finanzas_ajustes: { reivaPct: 13 }
    }
  }, 1);
  const p = D.planImportacion(JSON.parse(JSON.stringify(copia)), actual);
  assert.ok(p.ok);
  assert.deepEqual(p.nuevos.finanzas.map(x => x.id), ["m2"]); // m1 no se pisa
  assert.equal(p.resumen.descartados, 1);
  assert.deepEqual(p.meta.presupuestos, { transporte: 200 }); // comida conserva 100
  assert.deepEqual(p.meta.categorias_gasto.groups.map(g => [g.id, g.items.map(i => i.id)]), [["comida", ["comida", "cafe"]], ["mascotas", ["mascotas"]]]);
  assert.deepEqual(p.meta.categorias_gasto.archivadas.map(x => x.id), ["gym"]);
  assert.deepEqual(p.meta.carteras_custom.list.map(w => w.nombre), ["Viajes", "Casa"]);
  assert.ok(!("finanzas_ajustes" in p.meta)); // ya tenías ajustes
  // Importar lo mismo dos veces no agrega nada
  const actual2 = { finanzas: actual.finanzas.concat(p.nuevos.finanzas), ahorros: p.nuevos.ahorros, carteras_movimientos: [],
    meta: Object.assign({}, actual.meta, { presupuestos: { comida: 100, transporte: 200 }, categorias_gasto: p.meta.categorias_gasto, carteras_custom: p.meta.carteras_custom }) };
  assert.ok(D.planImportacion(JSON.parse(JSON.stringify(copia)), actual2).vacio);
});

test("CSV: escapa comas, comillas y saltos; montos con punto decimal", () => {
  const csv = D.aCsv(["Fecha", "Nota", "Monto"], [["2026-09-30", 'Pan, leche y "queso"', D.montoCsv(123456)], ["2026-09-30", "línea\nnueva", D.montoCsv(5)]]);
  assert.ok(csv.startsWith("﻿Fecha,Nota,Monto\r\n"));
  assert.ok(csv.includes('"Pan, leche y ""queso""",1234.56'));
  assert.ok(csv.includes('"línea\nnueva",0.05'));
});

test("modo demo: 6 meses de datos ficticios coherentes, sin NaN", () => {
  const d = Demo.generarDemo(new Date(2026, 8, 30));
  assert.ok(d.finanzas.length > 300);
  const fechas = d.finanzas.map(m => m.date).sort();
  assert.equal(fechas[0], "2026-04-01");
  assert.equal(fechas[fechas.length - 1], "2026-09-30");
  assert.ok(d.finanzas.every(m => Number.isFinite(m.amount) && m.amount > 0 && m.montoCent === Math.round(m.amount * 100)));
  assert.equal(new Set(d.finanzas.map(m => m.id)).size, d.finanzas.length);
  // Los enlaces de las transferencias existen
  const ids = new Set(d.ahorros.map(a => a.id).concat(d.carteras_movimientos.map(c => c.id)));
  d.finanzas.filter(m => m.type === "transferencia").forEach(m => (m.links || []).forEach(l => assert.ok(ids.has(l.id))));
  // Nada de datos personales: solo textos genéricos
  const textos = d.finanzas.map(m => m.desc).join(" ");
  assert.ok(!/@|\d{7,}/.test(textos));
  // Siempre es el mismo (misma semilla)
  assert.deepEqual(Demo.generarDemo(new Date(2026, 8, 30)).finanzas.slice(0, 20), d.finanzas.slice(0, 20));
  // Los saldos se pueden calcular sin problemas
  const s = D.saldos(d.finanzas.map(m => D.adaptarMovimiento(m.id, m)));
  assert.ok(Object.values(s).every(Number.isInteger));
});

test("modo demo: almacén aparte con la forma de Firestore", async () => {
  const memoria = (() => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m }; })();
  Demo.activar(memoria);
  assert.ok(Demo.activo(memoria));
  const alm = Demo.crearAlmacen(Demo.generarDemo(new Date(2026, 8, 30)), memoria);
  const col = alm.raiz.collection("finanzas");
  const primero = await col.get();
  const ref = await col.add({ type: "gasto", amount: 12.5, date: "2026-09-30" });
  let visto = null;
  col.onSnapshot({ includeMetadataChanges: true }, snap => { visto = snap.docs.length; });
  await new Promise(r => setTimeout(r, 5));
  assert.equal(visto, primero.docs.length + 1);
  const lote = alm.batch();
  lote.delete(col.doc(ref.id));
  lote.set(alm.raiz.collection("meta").doc("presupuestos"), { comida: 1 }, { merge: true });
  await lote.commit();
  assert.equal((await col.get()).docs.length, primero.docs.length);
  const pres = (await alm.raiz.collection("meta").doc("presupuestos").get()).data();
  assert.equal(pres.comida, 1);
  assert.equal(pres.vivienda, 3100); // merge conserva lo demás
  // Persiste: otro almacén con el mismo espacio ve los cambios
  const otra = Demo.crearAlmacen({}, memoria);
  assert.equal((await otra.raiz.collection("finanzas").get()).docs.length, primero.docs.length);
  // Salir borra todo
  Demo.salir(memoria);
  assert.ok(!Demo.activo(memoria));
  assert.deepEqual(Object.keys(memoria._m), []);
});

// ---------- 2a: teclado con suma y resta ----------
test("teclado: escribe montos y suma o resta (25+18)", () => {
  const escribir = teclas => teclas.split("").reduce((e, t) => D.teclaMonto(e, t === "<" ? "back" : t === "-" ? "−" : t), "0");
  assert.equal(escribir("25+18"), "25+18");
  assert.equal(D.evaluarMonto("25+18"), 4300);
  assert.equal(D.evaluarMonto(escribir("100-12,5")), 8750);
  assert.equal(escribir("12,345"), "12,34");        // máximo 2 decimales por número
  assert.equal(escribir("5,5+2,25"), "5,5+2,25");
  assert.equal(D.evaluarMonto("5,5+2,25"), 775);
  assert.equal(escribir("+"), "0");                 // no empieza con signo
  assert.equal(escribir("7+-"), "7−");              // cambia el signo
  assert.equal(escribir("8+,5"), "8+0,5");
  assert.equal(escribir("9+<"), "9");
  assert.equal(escribir("<<"), "0");
  assert.equal(escribir("007"), "7");
  assert.equal(escribir("1234567890"), "123456789");
  assert.equal(D.evaluarMonto("25+"), 2500);        // un signo al final se ignora al guardar
  assert.equal(D.evaluarMonto("10−20"), -1000);     // negativo: la pantalla lo rechaza
  assert.equal(D.evaluarMonto("1,2,3"), null);
  assert.ok(D.tieneOperacion("25+18"));
  assert.ok(!D.tieneOperacion("25"));
});

// ---------- 2b: filtros ----------
test("filtros: tipo, categoría, cartera, RE-IVA y fechas", () => {
  const L = [
    { id: "a", type: "gasto", category: "comida", payment: "efectivo", factura: true, date: "2026-09-01" },
    { id: "b", type: "gasto", category: "comida", payment: "credito", factura: false, date: "2026-09-10" },
    { id: "c", type: "ingreso", category: "salario", payment: "debito", date: "2026-09-02" },
    { id: "d", type: "transferencia", from: "gastos", to: "ahorro", date: "2026-09-05" },
    { id: "e", type: "pago_tarjeta", payment: "debito", date: "2026-09-29" }
  ];
  const ids = f => D.filtrarMovimientos(L, f).map(m => m.id).join("");
  assert.equal(ids({}), "abcde");
  assert.ok(!D.hayFiltros({}));
  assert.equal(ids({ tipo: "gasto" }), "ab");
  assert.equal(ids({ tipo: "transferencia" }), "de");  // pagar la tarjeta es una transferencia
  assert.equal(ids({ categoria: "comida" }), "ab");
  assert.equal(ids({ cartera: "tarjeta" }), "be");
  assert.equal(ids({ cartera: "debito" }), "cde");       // "gastos" (viejo) cuenta como Débito
  assert.equal(ids({ cartera: "ahorro" }), "d");
  assert.equal(ids({ factura: "si" }), "a");
  assert.equal(ids({ factura: "no" }), "b");
  assert.equal(ids({ desde: "2026-09-02", hasta: "2026-09-10" }), "bcd");
  assert.equal(ids({ tipo: "gasto", cartera: "efectivo", factura: "si" }), "a");
});

// ---------- 2c: pagos recurrentes ----------
test("recurrentes: fechas mensuales, semanales y anuales (meses cortos y cambio de año)", () => {
  assert.deepEqual(D.ocurrencias({ frecuencia: "mensual", inicio: "2026-01-31" }, "2026-01-01", "2026-04-30"), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  assert.deepEqual(D.ocurrencias({ frecuencia: "mensual", inicio: "2026-11-05" }, "2026-12-01", "2027-02-10"), ["2026-12-05", "2027-01-05", "2027-02-05"]);
  assert.deepEqual(D.ocurrencias({ frecuencia: "semanal", inicio: "2026-09-07" }, "2026-09-10", "2026-09-30"), ["2026-09-14", "2026-09-21", "2026-09-28"]);
  assert.deepEqual(D.ocurrencias({ frecuencia: "anual", inicio: "2024-02-29" }, "2025-01-01", "2028-12-31"), ["2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
  assert.deepEqual(D.ocurrencias({ frecuencia: "mensual", inicio: "2026-10-01" }, "2026-09-01", "2026-09-30"), []); // antes de empezar
  assert.deepEqual(D.ocurrencias({ frecuencia: "mensual", inicio: "mal" }, "2026-09-01", "2026-09-30"), []);
});

test("recurrentes: pendientes de confirmar y próximos pagos", () => {
  const recs = [
    { id: "alq", nombre: "Alquiler", frecuencia: "mensual", inicio: "2026-07-05", montoCent: 280000 },
    { id: "net", nombre: "Streaming", frecuencia: "mensual", inicio: "2026-08-15", omitidos: ["2026-09-15"] },
    { id: "gym", nombre: "Gimnasio", frecuencia: "mensual", inicio: "2026-10-03" },
    { id: "off", nombre: "Pausado", frecuencia: "mensual", inicio: "2026-07-01", activo: false }
  ];
  const movs = [{ recurrenteId: "alq", recurrenteFecha: "2026-09-05" }];
  const pend = D.pendientesRecurrentes(recs, movs, "2026-09-30", 45);
  // Solo los últimos 45 días: el 5 de agosto ya quedó fuera; el 15 de septiembre se omitió.
  assert.equal(pend.length, 0);
  const pend2 = D.pendientesRecurrentes(recs, [], "2026-09-30", 45);
  assert.deepEqual(pend2.map(p => `${p.rec.id}@${p.fecha}`), ["alq@2026-09-05"]);
  assert.equal(pend2[0].atraso, 25);
  const prox = D.proximosRecurrentes(recs, movs, "2026-09-30", 7);
  assert.deepEqual(prox.map(p => `${p.rec.id}@${p.fecha}`), ["gym@2026-10-03", "alq@2026-10-05"]);
  assert.equal(D.siguienteFecha(recs[0], "2026-09-06"), "2026-10-05");
  assert.equal(D.siguienteFecha(recs[0], "2026-09-05"), "2026-09-05");
});
