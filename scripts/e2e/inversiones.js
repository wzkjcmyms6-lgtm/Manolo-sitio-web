// Pruebas de pantalla de Inversiones (js/inversiones.js), fase 1:
// aportes viejos, movimientos de cada tipo, editar, borrar, ronda DCA y ajustes.
// Uso: node scripts/e2e/inversiones.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");
const M = require("../../js/inversiones-motor.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/Caracas";
const HOY = "2026-10-28T10:00:00-04:00";
const COL = "users/test/inversiones";
const VIEJO_VOO = { date: "2026-10-01", name: "VOO", amount: 50, notes: "primer aporte" };
const VIEJO_FONDO = { date: "2026-09-28", name: "<b>Fondo</b>", amount: 30, notes: "" };
const SEED = { [COL]: { v1: VIEJO_VOO, v2: VIEJO_FONDO } };

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
const pestana = async (p, t) => { await p.click(`#panel-inversiones [data-inv-tab="${t}"]`); await p.waitForTimeout(250); };
const sobra = (p, sel) => p.$eval(sel, el => el.scrollWidth - el.clientWidth);
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

  console.log("\nResumen con registros viejos");
  ok(await visible(p, "#inv-resumen"), "se ve el Resumen");
  ok((await texto(p, "#inv-resumen .inv-hero-valor")) === "US$ 80,00", "Aportado suma los aportes viejos (US$ 80,00)");
  ok(/2 aportes anteriores/.test(await texto(p, "#inv-resumen .inv-aviso")), "avisa que hay 2 aportes para completar");
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
  await escribir(p, campo("bs"), "8020");
  await escribir(p, campo("tasa"), "40,1");
  const f = M.calcularFondeo({ bs: 8020, tasa: 40.1 }, null);
  const vals = await Promise.all(["usdEnviado", "comisionAirtm", "comisionTransferencia", "usd"].map(k => p.inputValue(campo(k))));
  ok(vals.join("|") === ["200", "2,8", String(f.comisionTransferencia).replace(".", ","), String(f.usd).replace(".", ",")].join("|"), `se calcula todo (${vals.join(" · ")})`);
  ok(/Cada US\$ que llegó al broker te costó/.test(await texto(p, ".inv-hoja [data-inv-total]")), "muestra lo que costó cada US$");
  await escribir(p, campo("usd"), "195,50");
  await escribir(p, campo("tasa"), "40");
  ok((await p.inputValue(campo("usd"))) === "195,50", "lo que escribes a mano no se pisa");
  await captura(p, "inv-fondeo.png");
  await guardar(p);
  lista = await todos(p);
  const fon = lista.find(([, x]) => x.tipo === "fondeo");
  ok(fon && fon[1].bs === 8020 && fon[1].tasa === 40 && fon[1].usdEnviado === 200.5 && fon[1].usd === 195.5, "fondeo guardado con Bs, tipo de cambio y US$");

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
  await p.click('#inv-resumen [data-inv="ronda"]');
  await p.waitForTimeout(400);
  const filas = await p.$$eval(".inv-ronda-fila", els => els.map(e => e.dataset.ticker));
  ok(filas.join(",") === "QQQ,VOO,SCHD,VT,VIG,MSFT", `los 6 del núcleo (${filas.join(", ")})`);
  ok((await p.inputValue('.inv-ronda-fila[data-ticker="QQQ"] [name="monto"]')) === "33,18", "monto mensual por ticker ya puesto");
  const fila = t => `.inv-ronda-fila[data-ticker="${t}"]`;
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

  console.log("\nResumen final");
  await pestana(p, "resumen");
  const r = M.resumen((await todos(p)).map(([id, x]) => M.normalizar(id, x)));
  ok((await texto(p, "#inv-resumen .inv-hero-valor")) === M.usd(r.aportado), `Aportado coincide con el motor (${M.usd(r.aportado)})`);
  ok(/1 aporte anterior/.test(await texto(p, "#inv-resumen .inv-aviso")), "queda 1 aporte por completar");
  d = await uno(p, "v2");
  ok(JSON.stringify(d) === JSON.stringify(VIEJO_FONDO), "el otro registro viejo sigue intacto");
  await captura(p, "inv-resumen.png");

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
  ok(!p.errores.length, "sin errores de página");

  await p.context().close();
  await terminar(browser, srv);
})();
