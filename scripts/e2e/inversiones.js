// Pruebas de pantalla de Inversiones (js/inversiones.js): aportes viejos,
// movimientos de cada tipo, editar, borrar, ronda DCA y ajustes (fase 1);
// posiciones, precios diarios, precio a mano y sin conexión (fase 2);
// gráficos, rendimiento en Bs y objetivos (fase 3).
// Precios y tipo de cambio de la prueba son fijos (no los archivos reales).
// Uso: node scripts/e2e/inversiones.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");
const M = require("../../js/inversiones-motor.js");
const S = require("../../js/inversiones-series.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const HOY = "2026-10-28T10:00:00-04:00";
const COL = "users/test/inversiones";
const VIEJO_VOO = { date: "2026-10-01", name: "VOO", amount: 50, notes: "primer aporte" };
const VIEJO_FONDO = { date: "2026-09-28", name: "<b>Fondo</b>", amount: 30, notes: "" };
const SEED = { [COL]: { v1: VIEJO_VOO, v2: VIEJO_FONDO } };
const PRECIOS = { fuente: "prueba", actualizado: "2026-10-27T21:40:00Z", tickers: {
  QQQ: { ultimo: { fecha: "2026-10-27", cierre: 500 }, historial: { "2026-10-05": 480, "2026-10-27": 500 } },
  VOO: { ultimo: { fecha: "2026-10-20", cierre: 640 }, historial: { "2026-10-01": 619, "2026-10-20": 640 } },
  SCHD: { ultimo: { fecha: "2026-10-27", cierre: 28 }, historial: { "2026-10-27": 28 } }
}, dividendos: {
  QQQ: { frecuencia: "trimestral", historial: [{ ex: "2026-10-20", pago: "2026-10-27", monto: 0.75 }], proximo: { ex: "2027-01-19", estimado: true, monto: 0.75 } },
  VOO: { frecuencia: "trimestral", historial: [{ ex: "2026-09-26", pago: "2026-09-30", monto: 1.74 }], proximo: { ex: "2026-10-30", pago: "2026-11-03", monto: 1.8, estimado: false } },
  VT: { historial: [], proximo: { ex: "2026-12-18", estimado: true, monto: 0.4 } }
} };

const texto = (p, sel) => p.textContent(sel).then(t => (t || "").replace(/\s+/g, " ").trim());
const todos = p => p.evaluate(c => Array.from(window.__fakeStore.colMap(c).entries()), COL);
const uno = (p, id) => p.evaluate(([c, id]) => window.__fakeStore.colMap(c).get(id), [COL, id]);
const visible = (p, sel) => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && el.offsetParent !== null; }, sel);
const hojaAbierta = p => p.evaluate(() => { const h = document.querySelector(".inv-hoja"); return !!h && !h.hidden; });
async function escribir(p, sel, valor) {
  await p.fill(sel, "");
  await p.type(sel, String(valor));
}
const campo = n => `.inv-hoja .inv-form [name="${n}"]`;
async function guardar(p) {
  await p.click(".inv-hoja .inv-form [type=submit]");
  await p.waitForTimeout(400);
}
async function nuevo(p, tipo) {
  await p.click('#inv-movimientos [data-inv="nuevo"]');
  await p.waitForTimeout(350);
  if (tipo) { await p.click(`.inv-hoja [data-inv-tipo="${tipo}"]`); await p.waitForTimeout(150); }
}
// Inversiones es una sección aparte: sus pantallas se cambian con la barra de
// abajo (como Finanzas) y Ajustes con el engranaje de arriba.
const HASH_INV = { resumen: "inversiones", posiciones: "inv-posiciones", movimientos: "inv-movimientos", graficos: "inv-graficos" };
const pestana = async (p, t) => {
  await p.click(t === "ajustes" ? '.topbar-ajustes[data-engranaje="inversiones"]' : `#bottom-nav-links a[data-hash="${HASH_INV[t]}"]`);
  await p.waitForTimeout(250);
};
const sobra = (p, sel) => p.$eval(sel, el => el.scrollWidth - el.clientWidth);
const TC = { fuente: "prueba", ultimo: { fecha: "2026-10-27", tco: 12.02 }, historial: { "2026-09-24": 12.26, "2026-10-01": 12.0, "2026-10-02": 11.9, "2026-10-27": 12.02 } };
const ajustes = p => p.evaluate(() => window.__fakeStore.colMap("users/test/meta").get("inversiones_ajustes") || null);
const movsDe = async p => (await todos(p)).map(([id, x]) => M.normalizar(id, x));
// Arrastra con un dedo hacia abajo desde el centro de `sel` (como hojas.js).
async function deslizar(p, sel, dy) {
  const c = await p.$eval(sel, el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 120) }; });
  const toque = (tipo, y) => p.evaluate(([tipo, x, y]) => {
    const el = document.elementFromPoint(x, y);
    const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    const fin = tipo === "touchend";
    el.dispatchEvent(new TouchEvent(tipo, { bubbles: true, cancelable: true, touches: fin ? [] : [t], targetTouches: fin ? [] : [t], changedTouches: [t] }));
  }, [tipo, c.x, y]);
  await toque("touchstart", c.y);
  for (let i = 1; i <= 10; i++) { await p.waitForTimeout(30); await toque("touchmove", c.y + (dy * i) / 10); }
  await toque("touchend", c.y + dy);
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#inversiones", zona: ZONA, fecha: HOY });
  // Precios fijos de prueba; con conRed = false, el archivo no llega (sin conexión).
  let conRed = true;
  await p.context().route(/\/data\/precios\.json/, r => (conRed ? r.fulfill({ contentType: "application/json", body: JSON.stringify(PRECIOS) }) : r.abort()));
  await p.context().route(/\/data\/tipo-cambio\.json/, r => (conRed ? r.fulfill({ contentType: "application/json", body: JSON.stringify(TC) }) : r.abort()));
  await p.reload();
  await p.waitForTimeout(800);

  console.log("\nResumen con registros viejos");
  ok(await visible(p, "#inv-resumen"), "se ve el Resumen");
  ok(await p.$eval("#verse-banner", el => el.hidden), "Inversiones no muestra el versículo");
  console.log("\nSección aparte, como Finanzas");
  ok(await p.$eval("#bottom-nav-links", n => n.dataset.mode === "inversiones"), "la barra de abajo muestra las pestañas de Inversiones");
  ok((await p.$$eval("#bottom-nav-links a", as => as.map(a => a.textContent.trim()).join(","))) === "Resumen,Posiciones,Movimientos,Gráficos", "pestañas: Resumen, Posiciones, Movimientos y Gráficos");
  ok(await p.$eval('#bottom-nav-links a[data-hash="inversiones"]', a => a.classList.contains("active")), "Resumen resaltado abajo");
  ok(await visible(p, ".topbar-home"), "arriba, la casita para volver a Inicio");
  ok(await visible(p, '.topbar-ajustes[data-engranaje="inversiones"]') && !(await visible(p, '.topbar-ajustes[data-engranaje="finanzas"]')), "el engranaje lleva a Ajustes de Inversiones (no a los de Finanzas)");
  ok(!(await p.$("#panel-inversiones .inv-tabs")), "ya no hay pestañas dentro de la pantalla");
  ok((await texto(p, "#inv-resumen .inv-hero-valor")) === "US$ 80,00", "Aportado suma los aportes viejos (US$ 80,00)");
  ok(/2 aportes anteriores/.test(await texto(p, "#inv-resumen .inv-aviso:not(.inv-aviso-div)")), "avisa que hay 2 aportes para completar");
  ok(/Ronda DCA de octubre/.test(await texto(p, '#inv-resumen [data-inv="ronda"]')), "botón de la ronda DCA del mes");
  await captura(p, "inv-resumen-viejos.png");

  console.log("\nMovimientos: los viejos como «Aporte»");
  await p.click('#inv-resumen [data-inv="ver-aportes"]');
  await p.waitForTimeout(300);
  ok(await visible(p, "#inv-movimientos"), "«Completar aportes» lleva a Movimientos");
  const titulos = await p.$$eval("#inv-movimientos .inv-mes-titulo", els => els.map(e => e.firstChild.textContent.trim()));
  ok(titulos.join("|") === "Octubre 2026|Septiembre 2026", `agrupados por mes (${titulos.join(", ")})`);
  ok((await p.$$("#inv-movimientos .inv-chip.is-completar")).length === 2, "los 2 con la etiqueta «Completar»");
  ok(!(await p.$("#inv-movimientos .inv-fila-texto b b")) && /<b>Fondo<\/b>/.test(await texto(p, "#inv-movimientos")), "un nombre con < > se muestra como texto");
  await captura(p, "inv-movimientos-viejos.png");

  console.log("\nCompletar un aporte viejo (solo agrega campos)");
  await p.click('#inv-movimientos [data-inv-editar="v1"]');
  await p.waitForTimeout(400);
  ok(await hojaAbierta(p), "se abre la hoja");
  ok((await texto(p, "#inv-hoja-t")) === "Completar aporte", "título «Completar aporte»");
  ok(/1 oct 2026 · VOO · US\$ 50,00/.test(await texto(p, ".inv-original")), "muestra el registro original");
  ok((await p.inputValue(campo("ticker"))) === "VOO", "sugiere el ticker VOO por el nombre");
  ok((await p.inputValue(campo("monto"))) === "49,85", "monto = US$ 50 − comisión de US$ 0,15");
  await escribir(p, campo("precio"), "619,20");
  const cant = M.cantidadDesdeMonto(49.85, 619.2);
  ok((await p.inputValue(campo("cantidad"))) === String(cant).replace(".", ","), `la cantidad se calcula (${cant})`);
  ok(/Tu registro decía US\$ 50,00/.test(await texto(p, ".inv-hoja [data-inv-total]")), "compara con lo que decía el registro");
  await captura(p, "inv-completar.png");
  await guardar(p);
  ok(!(await hojaAbierta(p)), "al guardar se cierra");
  let d = await uno(p, "v1");
  ok(d.date === "2026-10-01" && d.name === "VOO" && d.amount === 50 && d.notes === "primer aporte", "date, name, amount y notes quedan igual");
  ok(d.tipo === "compra" && d.ticker === "VOO" && d.cantidad === cant && d.precio === 619.2 && d.comision === 0.15 && d.broker === "Hapi", "se agregan tipo, ticker, cantidad, precio, comisión y broker");
  ok(d.v === undefined, "el registro viejo no recibe marca de versión");
  ok((await p.$$("#inv-movimientos .inv-chip.is-completar")).length === 1, "queda 1 aporte por completar");

  console.log("\nCompra nueva con fecha pasada");
  await nuevo(p);
  ok((await p.$eval('.inv-hoja [data-inv-tipo="compra"]', b => b.classList.contains("active"))), "Compra viene elegida");
  ok((await p.inputValue(campo("fecha"))) === "2026-10-28" && (await p.inputValue(campo("broker"))) === "Hapi" && (await p.inputValue(campo("comision"))) === "0,15", "fecha de hoy, Hapi y US$ 0,15 por defecto");
  await p.fill(campo("fecha"), "2026-11-02");
  await escribir(p, campo("ticker"), "qqq");
  await escribir(p, campo("precio"), "487,10");
  await escribir(p, campo("monto"), "33,18");
  await guardar(p);
  ok(await hojaAbierta(p) && /no puede ser futura/.test(await texto(p, ".inv-hoja .inv-error")), "una fecha futura no se guarda");
  ok(await p.$eval(campo("fecha"), el => el.classList.contains("is-error")), "y marca el campo");
  await p.fill(campo("fecha"), "2026-10-05");
  ok((await p.inputValue(campo("cantidad"))) === String(M.cantidadDesdeMonto(33.18, 487.1)).replace(".", ","), "precio + monto → cantidad");
  ok(/Total: US\$ 33,3\d \(con US\$ 0,15 de comisión\)/.test(await texto(p, ".inv-hoja [data-inv-total]")), "muestra el total con la comisión");
  await guardar(p);
  let lista = await todos(p);
  const qqq = lista.find(([, x]) => x.ticker === "QQQ");
  ok(qqq && qqq[1].v === 1 && qqq[1].fecha === "2026-10-05" && qqq[1].tipo === "compra" && typeof qqq[1].creado === "number", "se guarda con fecha 5 oct 2026");

  console.log("\nFondeo (AirTM → Hapi)");
  await nuevo(p, "fondeo");
  ok((await p.inputValue(campo("fecha"))) === "2026-10-28", "cambiar de tipo conserva la fecha");
  await p.fill(campo("fecha"), "2026-10-02");
  await escribir(p, campo("bs"), "2800");
  await escribir(p, campo("tasa"), "14");
  const f = M.calcularFondeo({ bs: 2800, tasa: 14 }, null);
  const vals = await Promise.all(["usdEnviado", "comisionAirtm", "comisionTransferencia", "usd"].map(k => p.inputValue(campo(k))));
  ok(vals.join("|") === ["200", "2,8", String(f.comisionTransferencia).replace(".", ","), String(f.usd).replace(".", ",")].join("|"), `se calcula todo (${vals.join(" · ")})`);
  ok(/Cada US\$ que llegó al broker te costó/.test(await texto(p, ".inv-hoja [data-inv-total]")), "muestra lo que costó cada US$");
  await escribir(p, campo("usd"), "195,50");
  await escribir(p, campo("tasa"), "13,9");
  ok((await p.inputValue(campo("usd"))) === "195,50", "lo que escribes a mano no se pisa");
  await captura(p, "inv-fondeo.png");
  await guardar(p);
  lista = await todos(p);
  const fon = lista.find(([, x]) => x.tipo === "fondeo");
  ok(fon && fon[1].bs === 2800 && fon[1].tasa === 13.9 && fon[1].usdEnviado === 201.44 && fon[1].usd === 195.5, "fondeo guardado con Bs, tipo de cambio y US$");

  console.log("\nCambiar de tipo y deslizar para cerrar");
  await nuevo(p);
  await escribir(p, campo("ticker"), "VT");
  await escribir(p, campo("monto"), "33,18");
  await p.click('.inv-hoja [data-inv-tipo="dividendo"]');
  await p.waitForTimeout(150);
  ok((await p.inputValue(campo("ticker"))) === "VT" && (await p.inputValue(campo("monto"))) === "", "pasa el ticker, no el monto de la compra");
  await deslizar(p, ".inv-hoja .budget-sheet-panel", 420);
  await p.waitForTimeout(500);
  ok(!(await hojaAbierta(p)) && !(await p.evaluate(() => document.body.classList.contains("sheet-open"))), "deslizar hacia abajo cierra la hoja");

  console.log("\nDividendo, interés y retiro");
  await nuevo(p, "dividendo");
  await escribir(p, campo("ticker"), "schd");
  await escribir(p, campo("monto"), "0,42");
  await guardar(p);
  await nuevo(p, "interes");
  await escribir(p, campo("monto"), "0,2");
  await guardar(p);
  await nuevo(p, "efectivo");
  await p.click('.inv-hoja [data-inv-sentido="retiro"]');
  await escribir(p, campo("monto"), "5");
  await guardar(p);
  lista = (await todos(p)).map(([, x]) => x);
  ok(lista.some(x => x.tipo === "dividendo" && x.ticker === "SCHD" && x.monto === 0.42), "dividendo de SCHD");
  ok(lista.some(x => x.tipo === "interes" && x.monto === 0.2), "interés");
  ok(lista.some(x => x.tipo === "efectivo" && x.sentido === "retiro" && x.monto === 5), "retiro");
  ok(/\+US\$ 0,42/.test(await texto(p, "#inv-movimientos")) && /−US\$ 5,00/.test(await texto(p, "#inv-movimientos")), "la lista muestra +dividendo y −retiro");

  console.log("\nVenta de más: avisa pero deja guardar");
  await nuevo(p, "venta");
  await escribir(p, campo("ticker"), "VOO");
  await escribir(p, campo("precio"), "620");
  await escribir(p, campo("cantidad"), "5");
  ok(/Según tus registros tienes 0,08\d* VOO/.test(await texto(p, ".inv-hoja [data-inv-total]")), "avisa cuánto VOO tienes");
  await p.click(".inv-hoja [data-inv-cerrar].budget-sheet-close");
  await p.waitForTimeout(350);
  ok(!(await hojaAbierta(p)), "la ✕ cierra sin guardar");
  ok(!(await todos(p)).some(([, x]) => x.tipo === "venta"), "no se guardó la venta");

  console.log("\nEditar y borrar");
  await p.click(`#inv-movimientos [data-inv-editar="${qqq[0]}"]`);
  await p.waitForTimeout(400);
  ok((await texto(p, "#inv-hoja-t")) === "Editar compra" && !(await p.$(".inv-hoja .inv-tipos")), "edita sin cambiar el tipo");
  await escribir(p, campo("precio"), "500");
  ok((await p.inputValue(campo("cantidad"))) === String(qqq[1].cantidad).replace(".", ","), "al editar manda la cantidad guardada");
  await guardar(p);
  d = await uno(p, qqq[0]);
  ok(d.precio === 500 && d.creado === qqq[1].creado, "precio corregido, el resto igual");
  const interes = (await todos(p)).find(([, x]) => x.tipo === "interes");
  await p.click(`#inv-movimientos [data-inv-editar="${interes[0]}"]`);
  await p.waitForTimeout(400);
  await p.click(".inv-hoja [data-inv-borrar]");
  await p.waitForTimeout(400);
  ok(!(await uno(p, interes[0])) && !(await hojaAbierta(p)), "Eliminar (con confirmación) lo borra");

  console.log("\nRonda DCA");
  await pestana(p, "resumen");
  ok(/Ronda DCA de octubre\s*2 de 6/.test(await texto(p, "#inv-resumen .inv-ronda-estado")) && /Ya compraste QQQ, VOO\. Falta: SCHD, VT, VIG, MSFT\./.test(await texto(p, "#inv-resumen .inv-ronda-estado")), "estado de la ronda del mes: 2 de 6 (QQQ y VOO ya comprados en octubre)");
  await p.click('#inv-resumen [data-inv="ronda"]');
  await p.waitForTimeout(400);
  const filas = await p.$$eval(".inv-ronda-fila", els => els.map(e => e.dataset.ticker));
  ok(filas.join(",") === "QQQ,VOO,SCHD,VT,VIG,MSFT", `los 6 del núcleo (${filas.join(", ")})`);
  ok((await p.inputValue('.inv-ronda-fila[data-ticker="SCHD"] [name="monto"]')) === "33,18", "monto mensual por ticker ya puesto");
  const fila = t => `.inv-ronda-fila[data-ticker="${t}"]`;
  ok(/ya compraste este mes/.test(await texto(p, fila("QQQ"))) && (await p.inputValue(`${fila("QQQ")} [name="monto"]`)) === "", "lo ya comprado este mes viene marcado y sin monto");
  await escribir(p, `${fila("QQQ")} [name="monto"]`, "33,18");
  await escribir(p, `${fila("VOO")} [name="monto"]`, "33,18");
  await escribir(p, `${fila("QQQ")} [name="precio"]`, "487,10");
  await escribir(p, `${fila("VOO")} [name="precio"]`, "619,20");
  await escribir(p, `${fila("SCHD")} [name="precio"]`, "27,50");
  await escribir(p, `${fila("SCHD")} [name="cantidad"]`, "1,2");
  await escribir(p, `${fila("VT")} [name="precio"]`, "x");
  for (const t of ["VIG", "MSFT"]) await p.fill(`${fila(t)} [name="monto"]`, "");
  await guardar(p);
  ok(/VT: revisa el precio/.test(await texto(p, ".inv-hoja .inv-error")), "un precio mal escrito se marca con su ticker");
  await p.fill(`${fila("VT")} [name="precio"]`, "");
  await p.fill(`${fila("VT")} [name="monto"]`, "");
  ok(/3 compras · .* = US\$ /.test(await texto(p, ".inv-hoja [data-inv-total]")), "resume 3 compras con sus comisiones");
  await captura(p, "inv-ronda.png");
  await guardar(p);
  const ronda = (await todos(p)).map(([, x]) => x).filter(x => x.ronda === "2026-10");
  ok(ronda.length === 3 && ronda.every(x => x.comision === 0.15 && x.broker === "Hapi" && x.fecha === "2026-10-28"), "3 compras con ronda 2026-10 y US$ 0,15 cada una");
  ok(ronda.find(x => x.ticker === "SCHD").cantidad === 1.2, "la cantidad escrita a mano manda");
  await p.click('#inv-resumen [data-inv="ronda"]');
  await p.waitForTimeout(400);
  ok(/Ya anotaste 3 compras de la ronda de octubre/.test(await texto(p, ".inv-hoja [data-inv-ya]")), "si ya hay ronda en el mes, avisa");
  await p.click(".inv-hoja .budget-sheet-overlay", { position: { x: 20, y: 20 } });
  await p.waitForTimeout(350);
  ok(!(await hojaAbierta(p)), "tocar el fondo cierra la hoja");

  console.log("\nAjustes");
  await pestana(p, "ajustes");
  await escribir(p, '#inv-ajustes [name="broker"]', "IBKR");
  await p.click('#inv-ajustes [data-inv-quitar="MSFT"]');
  await escribir(p, '#inv-ajustes [name="nuevoTicker"]', "vxus");
  await p.click('#inv-ajustes [data-inv="agregar-ticker"]');
  await p.waitForTimeout(150);
  ok((await p.inputValue('#inv-ajustes [name="broker"]')) === "IBKR", "agregar un ticker no borra lo escrito");
  await escribir(p, '#inv-ajustes .inv-dca-fila[data-ticker="VXUS"] [name="dca"]', "10");
  ok(/Al mes: .*\+ US\$ 0,90 de comisiones/.test(await texto(p, "#inv-ajustes [data-inv-total-dca]")), "total mensual con las comisiones");
  await captura(p, "inv-ajustes.png");
  await p.click("#inv-ajustes [type=submit]");
  await p.waitForTimeout(400);
  const aj = await p.evaluate(() => window.__fakeStore.colMap("users/test/meta").get("inversiones_ajustes"));
  ok(aj && aj.broker === "IBKR" && !aj.tickers.MSFT && aj.tickers.VXUS && aj.tickers.VXUS.dca === 10, "ajustes guardados (IBKR, sin MSFT, con VXUS)");
  ok(await visible(p, "#inv-ajustes .inv-guardado"), "muestra «Guardado ✓»");
  await pestana(p, "movimientos");
  await nuevo(p);
  ok((await p.inputValue(campo("broker"))) === "IBKR", "los movimientos nuevos usan IBKR");
  await p.click(".inv-hoja [data-inv-ronda]");
  await p.waitForTimeout(350);
  const filas2 = await p.$$eval(".inv-ronda-fila", els => els.map(e => e.dataset.ticker));
  ok(filas2.includes("VXUS") && !filas2.includes("MSFT"), "la ronda usa el núcleo nuevo");
  await p.click(".inv-hoja .budget-sheet-close");
  await p.waitForTimeout(350);

  console.log("\nPosiciones y precios");
  await nuevo(p);
  await p.fill(campo("fecha"), "2026-10-20");
  await escribir(p, campo("ticker"), "NVDA");
  await escribir(p, campo("precio"), "130");
  await escribir(p, campo("cantidad"), "1");
  await guardar(p);
  await pestana(p, "posiciones");
  ok(await p.$eval('#bottom-nav-links a[data-hash="inv-posiciones"]', b => b.classList.contains("active")) && (await p.evaluate(() => location.hash)) === "#inv-posiciones", "pestaña Posiciones (#inv-posiciones)");
  ok(await visible(p, "#inv-posiciones") && !(await visible(p, "#inv-resumen")), "solo se ve la pantalla elegida");
  let pos = M.posiciones(await movsDe(p), PRECIOS, await ajustes(p));
  const tarjetas = await p.$$eval("#inv-posiciones [data-inv-precio]", els => els.map(e => e.dataset.invPrecio));
  ok(tarjetas.join(",") === pos.abiertas.map(o => o.ticker).join(","), `una tarjeta por ticker, por valor (${tarjetas.join(", ")})`);
  const tq = '#inv-posiciones [data-inv-precio="QQQ"]';
  const q = pos.abiertas.find(o => o.ticker === "QQQ");
  ok((await texto(p, `${tq} .inv-pos-valor`)) === M.usd(q.valor), `QQQ vale ${M.usd(q.valor)} (cantidad × cierre)`);
  ok((await texto(p, tq)).includes(M.usdS(q.gp)) && (await texto(p, tq)).includes(`prom. ${M.usd(q.costoPromedio)}`), "con costo promedio y G/P");
  ok(/cierre 27 oct 2026/.test(await texto(p, tq)) && /Núcleo/.test(await texto(p, tq)), "precio del cierre y grupo");
  ok(/cierre 20 oct 2026 · hace 8 días/.test(await texto(p, '#inv-posiciones [data-inv-precio="VOO"]')), "avisa si el precio es viejo");
  const tn = '#inv-posiciones [data-inv-precio="NVDA"]';
  ok(await p.$eval(tn, el => el.classList.contains("is-sin-precio")) && /Sin precio diario/.test(await texto(p, tn)) && /Satélite/.test(await texto(p, tn)), "NVDA: satélite y sin precio diario");
  ok((await texto(p, "#inv-posiciones .is-sin-asignar")).includes("US$ 30,00"), "los aportes sin completar se muestran aparte");
  ok((await texto(p, "#inv-posiciones .inv-hero-valor")) === M.usd(pos.total.valor), `total de posiciones ${M.usd(pos.total.valor)}`);
  await captura(p, "inv-posiciones.png");

  await p.click(tn);
  await p.waitForTimeout(400);
  ok((await texto(p, "#inv-hoja-t")) === "Precio de NVDA" && /no está en la lista de precios diarios/.test(await texto(p, ".inv-hoja .inv-aviso")), "precio a mano: avisa que no se actualiza solo");
  await captura(p, "inv-precio-manual.png");
  await escribir(p, '.inv-hoja [name="precio"]', "140,50");
  await guardar(p);
  const ajM = await ajustes(p);
  ok(ajM && ajM.preciosManuales && ajM.preciosManuales.NVDA && ajM.preciosManuales.NVDA.precio === 140.5 && ajM.preciosManuales.NVDA.fecha === "2026-10-28", "se guarda en tus ajustes");
  ok(/Precio manual US\$ 140,50 · 28 oct 2026/.test(await texto(p, tn)) && (await texto(p, `${tn} .inv-pos-valor`)) === "US$ 140,50", "la tarjeta usa el precio manual");
  await p.click(tq);
  await p.waitForTimeout(400);
  ok(/Precio diario: US\$ 500,00 \(cierre del 27 oct 2026\)/.test(await texto(p, ".inv-hoja")) && !(await p.$(".inv-hoja .inv-aviso")), "un ticker de la lista muestra su precio diario");
  await p.click(".inv-hoja .budget-sheet-close");
  await p.waitForTimeout(350);
  await pestana(p, "ajustes");
  await p.click("#inv-ajustes [type=submit]");
  await p.waitForTimeout(300);
  ok(((await ajustes(p)).preciosManuales || {}).NVDA, "guardar Ajustes no borra los precios manuales");
  await pestana(p, "posiciones");
  await p.click(tn);
  await p.waitForTimeout(400);
  await p.click(".inv-hoja [data-inv-quitar-precio]");
  await p.waitForTimeout(400);
  ok(!((await ajustes(p)).preciosManuales || {}).NVDA && /Sin precio diario/.test(await texto(p, tn)), "«Quitar precio manual» vuelve a sin precio");

  console.log("\nResumen final");
  await pestana(p, "resumen");
  const c = M.cartera(await movsDe(p), PRECIOS, await ajustes(p));
  ok((await texto(p, "#inv-resumen .inv-hero-valor")) === M.usd(c.valor), `valor de la cartera coincide con el motor (${M.usd(c.valor)})`);
  ok((await texto(p, "#inv-resumen .inv-hero")).includes(`${M.usdS(c.gp)} (${M.pctS(c.gpPct)}) sobre ${M.usd(c.resumen.aportado)} aportados`), "G/P sobre lo aportado");
  ok(/Precios al cierre del 27 oct 2026/.test(await texto(p, "#inv-resumen")) && /1 posición sin precio cuenta a su costo/.test(await texto(p, "#inv-resumen")), "dice de cuándo son los precios y cuántas no tienen");
  ok(/1 aporte anterior/.test(await texto(p, "#inv-resumen .inv-aviso:not(.inv-aviso-div)")), "queda 1 aporte por completar");
  d = await uno(p, "v2");
  ok(JSON.stringify(d) === JSON.stringify(VIEJO_FONDO), "el otro registro viejo sigue intacto");
  await captura(p, "inv-resumen.png");

  console.log("\nDividendos: avisos de 3 días antes a 3 después");
  await pestana(p, "resumen");
  const avisos = await p.$$eval("#inv-resumen .inv-aviso-div", els => els.map(e => [e.dataset.div, e.textContent.replace(/\s+/g, " ").trim()]));
  ok(avisos.map(a => a[0]).join(",") === "QQQ,VOO", `avisa QQQ (pagó ayer) y VOO (fecha ex en 2 días), no VT (falta mucho): ${avisos.map(a => a[0]).join(", ")}`);
  ok(/Pagó hace 1 día \(27 oct 2026\): anótalo/.test(avisos[0][1]), "QQQ: pagó ayer, pide anotarlo");
  ok(/Fecha ex en 2 días \(30 oct 2026\): para cobrar este dividendo tienes que tener la acción antes/.test(avisos[1][1]), "VOO: explica la fecha ex");
  const agendaTxt = await texto(p, "#inv-resumen .inv-card");
  ok(/Próximos dividendos/.test(agendaTxt) && /19 ene 2027 \(estimada\)/.test(agendaTxt) && !/VT/.test(agendaTxt), "tarjeta de próximos dividendos (QQQ estimada; VT no, porque no la tienes)");
  await captura(p, "inv-dividendos.png");
  await p.click('#inv-resumen [data-inv-anotar-div="QQQ"]');
  await p.waitForTimeout(400);
  // Cuentan las acciones que tenías antes de la fecha ex (no las de la ronda de hoy).
  const qqqAntes = M.agendaDividendos(PRECIOS, await movsDe(p), "2026-10-28").find(x => x.ticker === "QQQ" && x.ex === "2026-10-20");
  const hojaDiv = [await p.inputValue(campo("ticker")), await p.inputValue(campo("fecha")), await p.inputValue(campo("monto"))];
  ok(hojaDiv.join("|") === ["QQQ", "2026-10-27", String(qqqAntes.total).replace(".", ",")].join("|"), `«Anotar dividendo» abre la hoja con ticker, fecha de pago y monto estimado (${hojaDiv.join(" · ")})`);
  await escribir(p, campo("monto"), "0,04");
  await guardar(p);
  ok((await todos(p)).some(([, x]) => x.tipo === "dividendo" && x.ticker === "QQQ" && x.monto === 0.04 && x.fecha === "2026-10-27"), "dividendo de QQQ guardado");
  ok(!(await p.$('#inv-resumen .inv-aviso-div[data-div="QQQ"]')), "ya anotado: el aviso de QQQ desaparece");

  console.log("\nGráficos");
  await pestana(p, "graficos");
  const titulosG = await p.$$eval("#inv-graficos .inv-card-t", els => els.map(e => e.textContent));
  ok(titulosG.join("|") === "Valor vs aportado|Rendimiento|Distribución|Aportes por mes|Dividendos acumulados|Comisiones", `6 gráficos (${titulosG.join(", ")})`);
  const movsG = await movsDe(p), ajG = await ajustes(p);
  const ser = S.serie(movsG, PRECIOS, ajG, "2026-10-28");
  const cG = M.cartera(movsG, PRECIOS, ajG);
  ok(ser[ser.length - 1].valor === cG.valor, "la serie termina en el valor de la cartera");
  const svgV = await p.$eval('#inv-graficos .inv-g[data-g="valor"]', c => { const s = c.querySelector("svg"); return { w: Number(s.getAttribute("width")), caja: c.clientWidth, lineas: s.querySelectorAll('path[stroke-width="2"]').length }; });
  ok(svgV.w === svgV.caja && svgV.lineas === 2, `valor vs aportado: 2 líneas, al ancho de la pantalla (${svgV.w} px)`);
  ok((await texto(p, "#inv-graficos .inv-leyenda")).includes(`Valor ${M.usd(cG.valor)}`), "la leyenda dice el valor de hoy");
  const caja = await p.$('#inv-graficos .inv-g[data-g="valor"] svg');
  const bb = await caja.boundingBox();
  await p.mouse.click(bb.x + bb.width - 12, bb.y + bb.height / 2);
  await p.waitForTimeout(150);
  ok(/28 oct 2026/.test(await texto(p, '#inv-graficos .inv-g[data-g="valor"] .inv-g-tip')) && await visible(p, '#inv-graficos .inv-g[data-g="valor"] .inv-g-tip'), "tocar el gráfico muestra el día y sus valores");
  await captura(p, "inv-graficos-valor.png");
  const rend = S.rendimiento(movsG, PRECIOS, ajG, TC, "2026-10-28");
  const kpis = await p.$$eval("#inv-graficos .inv-kpis:not(.is-3) .inv-kpi b", els => els.map(e => e.textContent.trim()));
  ok(kpis[0] === `${M.usdS(rend.usd.gp)} (${M.pctS(rend.usd.pct)})`, `rendimiento en US$ (${kpis[0]})`);
  ok(kpis[1] === `${M.bsS(rend.bsTco.gp)} (${M.pctS(rend.bsTco.pct)})`, `en Bs con el TCO del BCB (${kpis[1]})`);
  ok(kpis[2] === `${M.bsS(rend.bsReal.gp)} (${M.pctS(rend.bsReal.pct)})`, `en Bs con el tipo de AirTM (${kpis[2]})`);
  ok((await p.$$("#inv-graficos .inv-div-fila")).length === rend.tickers.length, "una barra de rendimiento por ticker");
  await p.click('#inv-graficos [data-tabla="rendimiento"] summary');
  await p.waitForTimeout(150);
  const filaQ = await p.$$eval('#inv-graficos [data-tabla="rendimiento"] tbody tr', trs => trs.map(t => t.textContent.replace(/\s+/g, " ").trim()).find(t => t.startsWith("QQQ")));
  const rq = rend.tickers.find(t => t.ticker === "QQQ");
  ok(filaQ && filaQ.includes(M.bsS(rq.bsTco)) && filaQ.includes(M.bsS(rq.bsReal)), `tabla: QQQ en US$, Bs BCB y Bs AirTM`);
  const dist = S.distribucion(cG.posiciones, ajG);
  ok((await texto(p, "#inv-graficos .inv-stack + .inv-leyenda")).includes(`Núcleo ${M.pct(dist.nucleo, 1)} · obj. ${M.pct(dist.objetivoNucleo, 1)}`), `núcleo contra su objetivo (${M.pct(dist.objetivoNucleo, 1)})`);
  ok((await p.$$("#inv-graficos .inv-dist-fila .inv-obj")).length === dist.filas.filter(f => f.objetivo != null).length, "una raya de objetivo por ticker del núcleo");
  const meses = S.aportesPorMes(ser);
  const metaG = S.metaMensual(ajG);
  ok((await p.$$('#inv-graficos .inv-g[data-g="aportes"] .inv-g-barra')).length === meses.filter(m => Math.abs(m.monto) > 0.01).length && !!(await p.$('#inv-graficos .inv-g[data-g="aportes"] line.inv-g-meta')) && (await texto(p, "#inv-graficos .inv-card:nth-of-type(4) .inv-leyenda")).includes(`Ronda DCA ${M.usd(metaG)}`), `aportes por mes con la línea de la ronda (${M.usd(metaG)})`);
  ok((await texto(p, "#inv-graficos .inv-card:nth-of-type(5) .inv-card-big")) === M.usd(cG.resumen.dividendos), "dividendos acumulados");
  ok((await texto(p, "#inv-graficos .inv-card:nth-of-type(6) .inv-card-big")).startsWith(M.usd(cG.resumen.comisiones)), "total de comisiones");
  await captura(p, "inv-graficos.png");
  await p.screenshot({ path: CAPTURAS ? require("path").join(CAPTURAS, "inv-graficos-completo.png") : "/dev/null", fullPage: true }).catch(() => {});

  console.log("\nObjetivos en Ajustes");
  await pestana(p, "ajustes");
  // Antes se quitó MSFT y se agregó VXUS (objetivo 0): ya no suman 100 %.
  ok(/⚠️ Los objetivos suman 84,15 %: deberían sumar 100 %/.test(await texto(p, "#inv-ajustes [data-inv-total-obj]")), "si los objetivos no suman 100 %, avisa");
  await escribir(p, '#inv-ajustes .inv-dca-fila[data-ticker="QQQ"] [name="objetivo"]', "20");
  await escribir(p, '#inv-ajustes .inv-dca-fila[data-ticker="VXUS"] [name="objetivo"]', "11,68");
  ok(/Objetivos: suman 100 % ✓/.test(await texto(p, "#inv-ajustes [data-inv-total-obj]")), "y confirma cuando suman 100 %");
  await p.click("#inv-ajustes [type=submit]");
  await p.waitForTimeout(300);
  ok((await ajustes(p)).tickers.QQQ.objetivo === 20, "objetivo de QQQ guardado (20 %)");
  await pestana(p, "graficos");
  const filasDist = await p.$$eval("#inv-graficos .inv-dist-fila", els => els.map(e => e.textContent.replace(/\s+/g, " ").trim()));
  ok(filasDist.some(t => t.startsWith("QQQ") && t.includes("obj. 20 %")), "el gráfico usa el objetivo nuevo de QQQ");

  console.log("\nFase 4: ronda del mes y exportar");
  await pestana(p, "resumen");
  const er = M.estadoRonda(await movsDe(p), await ajustes(p), "2026-10");
  ok((await texto(p, "#inv-resumen .inv-ronda-estado")).includes(`${er.hechos.length} de ${er.plan.length}`) && (await p.$eval("#inv-resumen .inv-ronda-estado", e => e.dataset.rondaEstado)) === (er.completa ? "hecha" : "pendiente"), `estado de la ronda con el núcleo nuevo (${er.hechos.length} de ${er.plan.length})`);
  await pestana(p, "ajustes");
  const fs = require("fs");
  const bajar = async sel => { const [d] = await Promise.all([p.waitForEvent("download"), p.click(sel)]); return { nombre: d.suggestedFilename(), texto: fs.readFileSync(await d.path(), "utf8") }; };
  const csv = await bajar('#inv-ajustes [data-inv="exportar-csv"]');
  const nMovs = (await todos(p)).length;
  const lineasCsv = csv.texto.replace(/^\ufeff/, "").trim().split("\r\n");
  ok(csv.nombre === "manolo-inversiones-2026-10-28.csv" && lineasCsv[0] === M.COLUMNAS_CSV.join(";") && lineasCsv.length === nMovs + 1, `CSV: encabezado y ${nMovs} movimientos`);
  ok(lineasCsv.some(l => l.startsWith("2026-09-28;aporte;")) && lineasCsv.some(l => /;compra;QQQ;/.test(l)), "con el aporte viejo y las compras");
  const json = await bajar('#inv-ajustes [data-inv="exportar-json"]');
  const dj = JSON.parse(json.texto);
  ok(json.nombre.endsWith(".json") && dj.movimientos.length === nMovs && dj.ajustes && dj.ajustes.broker === "IBKR", "JSON: todos los movimientos y los ajustes");
  ok(JSON.stringify(dj.movimientos.find(m => m.id === "v2")) === JSON.stringify(Object.assign({ id: "v2" }, VIEJO_FONDO)), "el registro viejo sale tal cual");

  console.log("\nSin conexión: usa los últimos precios guardados");
  conRed = false;
  await p.reload();
  await p.waitForTimeout(900);
  await pestana(p, "posiciones");
  ok((await texto(p, `${tq} .inv-pos-valor`)) === M.usd(q.valor), "sin red, QQQ sigue con su valor");
  conRed = true;

  console.log("\nCelular angosto: nada se sale de ancho");
  await p.setViewportSize({ width: 320, height: 700 });
  await p.waitForTimeout(200);
  ok((await sobra(p, "html")) <= 0, "la página no se mueve de lado a 320 px");
  await pestana(p, "movimientos");
  await nuevo(p, "fondeo");
  ok((await sobra(p, ".inv-hoja .budget-sheet-panel")) === 0, "la hoja de fondeo cabe a 320 px");
  ok((await p.$eval(campo("bs"), el => getComputedStyle(el).fontSize)) === "16px", "campos de 16 px (el iPhone no hace zoom)");
  await p.click(".inv-hoja .budget-sheet-close");
  await p.waitForTimeout(350);
  await p.click('#inv-movimientos [data-inv="ronda"]');
  await p.waitForTimeout(350);
  ok((await sobra(p, ".inv-hoja .budget-sheet-panel")) === 0, "la ronda DCA cabe a 320 px");
  await p.click(".inv-hoja .budget-sheet-close");
  await p.waitForTimeout(350);
  await pestana(p, "posiciones");
  ok((await sobra(p, "html")) <= 0 && (await sobra(p, "#inv-posiciones")) <= 0, "Posiciones cabe a 320 px");
  await pestana(p, "graficos");
  await p.waitForTimeout(200);
  ok((await sobra(p, "html")) <= 0 && (await sobra(p, "#inv-graficos")) <= 0, "Gráficos cabe a 320 px");
  const anchoSvg = await p.$eval('#inv-graficos .inv-g[data-g="valor"]', c => [Number(c.querySelector("svg").getAttribute("width")), c.clientWidth]);
  ok(anchoSvg[0] === anchoSvg[1], `el gráfico se vuelve a dibujar al nuevo ancho (${anchoSvg[0]} px)`);
  await pestana(p, "ajustes");
  ok((await sobra(p, "html")) <= 0 && (await sobra(p, "#inv-ajustes .inv-dca-lista")) <= 0, "Ajustes (con objetivos) cabe a 320 px");
  ok(await visible(p, "#panel-inv-ajustes .back-link") && (await p.evaluate(() => location.hash)) === "#inv-ajustes", "Ajustes (#inv-ajustes) con «‹ Resumen» para volver");
  ok((await sobra(p, "#bottom-nav-links")) <= 0 && await p.$$eval("#bottom-nav-links a", as => as.every(a => a.scrollWidth <= a.clientWidth + 1)), "la barra de abajo cabe a 320 px");
  await p.click(".topbar-home");
  await p.waitForTimeout(300);
  ok((await p.evaluate(() => location.hash)) === "#inicio" && !(await p.$eval("#bottom-nav-links", n => n.classList.contains("tab-mode"))), "la casita vuelve a Inicio con la barra general");
  ok(!p.errores.length, "sin errores de página");
  await p.context().close();

  console.log("\nEscritorio: las pestañas van arriba");
  const pc = await abrir(browser, base, { __SEED__: SEED }, { hash: "#inv-graficos", ancho: 1280, alto: 800, zona: ZONA, fecha: HOY });
  await pc.waitForTimeout(800);
  ok(await visible(pc, "#inv-graficos") && await pc.$eval("#verse-banner", el => el.hidden), "abre directo en Gráficos, sin versículo");
  const pills = await pc.$$eval("#panel-inv-graficos .fin-outer-tabs a", as => as.map(a => (a.textContent.trim() || a.getAttribute("aria-label")) + (a.classList.contains("active") ? "*" : "")).join(","));
  ok(pills === "Resumen,Posiciones,Movimientos,Gráficos*,Ajustes de Inversiones", `pills de escritorio (${pills})`);
  await pc.click("#panel-inv-graficos .fin-outer-tabs .fin-tab-ajustes");
  await pc.waitForTimeout(300);
  ok(await visible(pc, "#inv-ajustes .inv-ajustes"), "el engranaje abre Ajustes de Inversiones");
  ok(!pc.errores.length, "escritorio sin errores de página");
  await pc.context().close();
  await terminar(browser, srv);
})();
