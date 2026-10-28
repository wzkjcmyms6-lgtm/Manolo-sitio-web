// Pruebas de pantalla de Finanzas › Tarjetas de crédito (varias, con su límite).
// Uso: node scripts/e2e/tarjetas.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");
const TC = require("../../js/finanzas/tarjetas.js");
const FD = require("../../js/finanzas/datos.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const HOY = "2026-10-28T10:00:00-04:00";   // miércoles 28 de octubre
const MOVS = "users/test/finanzas";
const visible = (p, sel) => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && el.offsetParent !== null; }, sel);
const sobra = (p, sel) => p.$eval(sel, el => el.scrollWidth - el.clientWidth);
// innerText: separa con espacio lo que en pantalla va en líneas o cajas distintas.
const texto = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim());
const abierta = (p, sel) => p.$eval(sel, el => !el.hidden && !el.classList.contains("is-closing"));
const tarjetas = p => p.evaluate(() => { const d = window.__fakeStore.colMap("users/test/meta").get("finanzas_tarjetas"); return d ? d.list : []; });
const movs = p => p.evaluate(c => [...window.__fakeStore.colMap(c)].map(([id, d]) => Object.assign({ id }, d)), MOVS);

// Un gasto con tarjeta de antes (sin tarjetaId) y un sueldo en Débito.
const SEED = { [MOVS]: {
  viejo: { date: "2026-10-20", type: "gasto", category: "otros", payment: "credito", amount: 300, desc: "Supermercado", createdAt: 1 },
  sueldo: { date: "2026-10-01", type: "ingreso", category: "salario", payment: "debito", amount: 5000, createdAt: 2 }
} };

const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(400); };
async function hojaTarjeta(p, nombre, limite, dia) {
  await p.fill('#tc-form [name="nombre"]', nombre);
  await p.fill('#tc-form [name="limite"]', limite);
  await p.selectOption('#tc-form [name="diaPago"]', dia);
  await p.click("#tc-guardar");
  await p.waitForTimeout(450);
}
const tarjetaSel = (id, sub) => `#fin-tarjetas [data-tc="${id}"] ${sub || ""}`;

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#fin-movimientos", zona: ZONA, fecha: HOY });
  await p.waitForTimeout(700);

  console.log("\nAntes de registrar tarjetas: todo como siempre");
  ok(/Tarjeta de crédito/.test(await texto(p, "#finance-stats")) && /−Bs\s?300,00/.test(await texto(p, "#finance-stats .fin-cartera.is-tarjeta")), "la cartera «Tarjeta de crédito» de siempre, con −Bs 300");
  await ir(p, "#fin-ajustes");
  ok(/Tarjetas de crédito Agrega tus tarjetas y su límite/.test(await texto(p, '#fin-ajustes a[href="#fin-tarjetas"]')), "en Ajustes: «Tarjetas de crédito · Agrega tus tarjetas y su límite»");
  await p.click('#fin-ajustes a[href="#fin-tarjetas"]');
  await p.waitForTimeout(400);
  ok(await visible(p, "#panel-fin-tarjetas"), "abre la sección Tarjetas de crédito");
  ok(/Ahora debes Bs\s?300,00 con tarjeta/.test(await texto(p, "#fin-tarjetas")), "explica que la deuda de ahora quedará en la primera tarjeta");
  ok(/Resumen/.test(await texto(p, "#panel-fin-tarjetas .back-link")), "botón «‹ Resumen» para volver");

  console.log("\nAgregar tarjetas");
  await p.click("[data-tc-nueva]");
  await p.waitForTimeout(350);
  ok(await abierta(p, "#tc-sheet") && (await texto(p, "#tc-sheet-title")) === "Nueva tarjeta" && await p.$eval("#tc-borrar", b => b.hidden), "hoja «Nueva tarjeta» (sin Eliminar)");
  await p.click("#tc-guardar");
  await p.waitForTimeout(200);
  ok(/Ponle un nombre/.test(await texto(p, "#tc-error")) && /límite/.test(await texto(p, "#tc-error")), "sin nombre ni límite: dice qué falta");
  ok(await p.$eval('#tc-form [name="nombre"]', i => i.classList.contains("is-error")) && await p.$eval('#tc-form [name="limite"]', i => i.classList.contains("is-error")), "y marca los dos campos");
  ok(await p.$eval('#tc-form [name="limite"]', i => getComputedStyle(i).fontSize === "16px" && i.inputMode === "decimal"), "campo de 16 px con teclado numérico");
  await hojaTarjeta(p, "Visa BNB", "5.000", "15");
  let lista = await tarjetas(p);
  ok(lista.length === 1 && lista[0].nombre === "Visa BNB" && lista[0].limiteCent === 500000 && lista[0].limite === 5000 && lista[0].diaPago === 15 && /^tc_/.test(lista[0].id), "se guarda: Visa BNB, límite Bs 5.000 (escrito «5.000»), pago el 15");
  const VISA = lista[0].id;
  ok(!(await abierta(p, "#tc-sheet")), "la hoja se cierra");
  ok(/Debes Bs\s?300,00/.test(await texto(p, tarjetaSel(VISA, ".fin-tc-cifras"))) && /Disponible Bs\s?4\.700,00/.test(await texto(p, tarjetaSel(VISA, ".fin-tc-cifras"))), "la deuda de antes queda en Visa: debes 300, disponible 4.700");
  ok(/Usaste el 6 % de Bs\s?5\.000/.test(await texto(p, tarjetaSel(VISA))) && /Pago: 15 nov \(faltan 18 días\)/.test(await texto(p, tarjetaSel(VISA))), "uso 6 % y próximo pago 15 nov (faltan 18 días)");
  await p.click("[data-tc-nueva]");
  await p.waitForTimeout(350);
  await hojaTarjeta(p, "visa bnb", "100", "");
  ok(/Ya tienes una tarjeta con ese nombre/.test(await texto(p, "#tc-error")), "no deja repetir el nombre");
  await hojaTarjeta(p, "Master Ganadero", "2000", "");
  lista = await tarjetas(p);
  const MASTER = lista[1].id;
  ok(lista.length === 2 && lista[1].diaPago === null && lista[1].color !== lista[0].color, "segunda tarjeta, sin día propio y con otro color");
  ok(/Pago: 29 oct \(falta 1 día\)/.test(await texto(p, tarjetaSel(MASTER))), "sin día propio usa el de Ajustes (29)");
  ok(/Límite total Bs\s?7\.000 Debes Bs\s?300 Disponible Bs\s?6\.700/.test(await texto(p, "#fin-tarjetas .fin-tc-total")), "arriba, el total de las dos: límite 7.000, debes 300, disponible 6.700");
  ok(/Principal/.test(await texto(p, tarjetaSel(VISA, ".fin-tc-cab"))) && !/Principal/.test(await texto(p, tarjetaSel(MASTER, ".fin-tc-cab"))), "la primera dice «Principal»");
  ok(!(await p.$(tarjetaSel(MASTER, "[data-tc-pagar]"))) && await p.$(tarjetaSel(VISA, "[data-tc-pagar]")), "solo la que tiene deuda muestra «Pagar»");
  await captura(p, "tarjetas-lista.png");

  console.log("\nMovimientos: una cartera por tarjeta");
  await ir(p, "#fin-movimientos");
  ok((await p.$$eval("#finance-stats [data-tc-fila]", els => els.map(e => e.querySelector(".fin-cartera-nombre").textContent).join("|"))) === "Visa BNB|Master Ganadero", "aparecen Visa BNB y Master Ganadero en vez de «Tarjeta de crédito»");
  ok(/Disponible: Bs\s?4\.700/.test(await texto(p, `[data-tc-fila="${VISA}"]`)), "con su disponible");
  ok(await p.$(`[data-tc-fila="${VISA}"] [data-pagar-tarjeta]`) && !(await p.$(`[data-tc-fila="${MASTER}"] [data-pagar-tarjeta]`)), "Pagar solo en la que debe");

  console.log("\nAnotar un gasto eligiendo la tarjeta");
  await p.click("#txn-add");
  await p.waitForTimeout(400);
  for (const k of ["1", "9", "0", "0"]) await p.click(`[data-txn-key="${k}"]`);
  await p.click("#txn-sheet-pay");
  await p.waitForTimeout(350);
  const opciones = await p.$$eval("#category-selector-grid [data-pick-id]", els => els.map(e => e.querySelector(".category-selector-item-label").textContent));
  ok(opciones.join("|") === "Efectivo|Débito|Visa BNB|Master Ganadero", `«¿Con qué pagaste?» lista cada tarjeta por su nombre (${opciones.join(", ")})`);
  ok(/disponible Bs\s?2\.000/.test(await texto(p, `#category-selector-grid [data-pick-id="credito|${MASTER}"]`)), "con lo disponible de cada una");
  await p.click(`#category-selector-grid [data-pick-id="credito|${MASTER}"]`);
  await p.waitForTimeout(300);
  ok(/^Master Ganadero · disponible Bs\s?2\.000/.test(await texto(p, "#txn-sheet-pay-label")), "la hoja muestra la tarjeta elegida");
  if (await p.$("#txn-sheet-chips button")) await p.click("#txn-sheet-chips button");
  await p.click("#txn-sheet-save");
  await p.waitForTimeout(600);
  let todos = await movs(p);
  const gastoMaster = todos.find(m => m.amount === 1900);
  ok(gastoMaster && gastoMaster.payment === "credito" && gastoMaster.tarjetaId === MASTER, "el gasto se guarda con payment «credito» y tarjetaId de Master");
  ok(todos.find(m => m.id === "viejo").tarjetaId === undefined, "el gasto viejo no se toca");
  ok(/Master Ganadero/.test(await texto(p, "#finance-list")) && /Visa BNB/.test(await texto(p, "#finance-list")) && !/Tarjeta de Crédito/.test(await texto(p, "#finance-list")), "en la lista, cada gasto dice con qué tarjeta se pagó");
  await p.click("#txn-add");
  await p.waitForTimeout(400);
  await p.click('[data-txn-key="5"]');
  ok(/^Master Ganadero/.test(await texto(p, "#txn-sheet-pay-label")), "el siguiente gasto propone la última tarjeta usada");
  await p.click("#txn-sheet .budget-sheet-close");
  await p.waitForTimeout(350);

  console.log("\nAvisos y estado de cada tarjeta");
  await ir(p, "#fin-tarjetas");
  ok(/Debes Bs\s?1\.900,00/.test(await texto(p, tarjetaSel(MASTER))) && /Ya usaste el 95 % del límite/.test(await texto(p, tarjetaSel(MASTER, ".fin-tc-alerta"))), "Master: debes 1.900 y avisa que usaste el 95 %");
  ok(await p.$eval(tarjetaSel(MASTER, ".fin-tc-barra"), b => b.classList.contains("is-alto")), "barra en rojo (más del 80 %)");
  await ir(p, "#finanzas");
  ok(/Mañana: pago de Master Ganadero · Bs\s?1\.900/.test(await texto(p, "#res-atencion")), "Atención: «Mañana: pago de Master Ganadero»");
  ok(!/pago de Visa BNB/.test(await texto(p, "#res-atencion")), "Visa (pago en 18 días) todavía no avisa");
  const ds = await movs(p);
  const adapt = ds.map(m => FD.adaptarMovimiento(m.id, m));
  const deudas = TC.deudas(adapt, TC.normalizar(await tarjetas(p)));
  ok(deudas[VISA] + deudas[MASTER] === FD.saldos(adapt).deuda, "la suma de las tarjetas es la deuda total de siempre");

  console.log("\nPagar una tarjeta");
  await ir(p, "#fin-tarjetas");
  await p.click(tarjetaSel(VISA, "[data-tc-pagar]"));
  await p.waitForTimeout(400);
  ok(/^Visa BNB · −Bs\s?300,00/.test(await texto(p, "#txn-sheet-to-label")) && /^Débito/.test(await texto(p, "#txn-sheet-from-label")), "Pagar abre la transferencia Débito → Visa BNB");
  await p.click("#txn-sheet-to");
  await p.waitForTimeout(300);
  const destinos = await p.$$eval("#category-selector-grid [data-pick-id]", els => els.map(e => e.dataset.pickId));
  ok(destinos.includes(`tarjeta|${MASTER}`) && !destinos.includes(`tarjeta|${VISA}`) && !destinos.includes("tarjeta"), "al cambiar el destino, ofrece la otra tarjeta por su nombre");
  await p.click("#category-selector-cancel");
  await p.waitForTimeout(300);
  await p.click("#txn-sheet-save");
  await p.waitForTimeout(600);
  todos = await movs(p);
  const pago = todos.find(m => m.type === "transferencia");
  ok(pago && pago.to === "tarjeta" && pago.from === "debito" && pago.amount === 300 && pago.tarjetaId === VISA && pago.desc === "Pago de Visa BNB", "se guarda la transferencia de 300 a Visa (tarjetaId)");
  ok(/Debes Bs\s?0,00/.test(await texto(p, tarjetaSel(VISA))) && !(await p.$(tarjetaSel(VISA, "[data-tc-pagar]"))), "Visa queda en 0 y sin «Pagar»");
  ok(/Debes Bs\s?1\.900,00/.test(await texto(p, tarjetaSel(MASTER))), "Master no cambia");

  console.log("\nEditar, principal y eliminar");
  await p.click(tarjetaSel(MASTER, "[data-tc-editar]"));
  await p.waitForTimeout(350);
  ok((await texto(p, "#tc-sheet-title")) === "Editar tarjeta" && (await p.$eval('#tc-form [name="limite"]', i => i.value)) === "2000" && !(await p.$eval("#tc-borrar", b => b.hidden)), "Editar trae los datos y el botón Eliminar");
  await p.fill('#tc-form [name="limite"]', "2.500");
  await p.selectOption('#tc-form [name="diaPago"]', "5");
  await p.click("#tc-guardar");
  await p.waitForTimeout(450);
  lista = await tarjetas(p);
  ok(lista[1].limiteCent === 250000 && lista[1].diaPago === 5 && lista[1].id === MASTER && lista[1].color === lista[1].color, "se guarda el límite nuevo (2.500) y el día 5, misma tarjeta");
  ok(!(await p.$(tarjetaSel(MASTER, ".fin-tc-alerta"))) && await p.$eval(tarjetaSel(MASTER, ".fin-tc-barra"), b => b.classList.contains("is-medio")), "76 % usado: barra ámbar, sin alerta");
  await p.click(tarjetaSel(MASTER, "[data-tc-editar]"));
  await p.waitForTimeout(350);
  await p.click("[data-tc-principal]");
  await p.waitForTimeout(450);
  lista = await tarjetas(p);
  ok(lista[0].id === MASTER && lista[1].id === VISA, "«Hacer principal» la pone primera");
  ok(/Debes Bs\s?2\.200,00/.test(await texto(p, tarjetaSel(MASTER))) && /Saldo a favor: Bs\s?300/.test(await texto(p, tarjetaSel(VISA))), "el gasto viejo (sin tarjeta) pasa a la principal; Visa queda con saldo a favor");
  await p.click(tarjetaSel(VISA, "[data-tc-editar]"));
  await p.waitForTimeout(350);
  await p.click("[data-tc-principal]");
  await p.waitForTimeout(450);
  ok((await tarjetas(p))[0].id === VISA, "y se puede volver a cambiar");
  await p.click(tarjetaSel(MASTER, "[data-tc-editar]"));
  await p.waitForTimeout(350);
  await p.click("#tc-borrar");
  await p.waitForTimeout(450);
  lista = await tarjetas(p);
  ok(lista.length === 1 && lista[0].id === VISA, "Eliminar quita la tarjeta");
  ok(/sus gastos pasan a la principal/.test(await texto(p, ".undo-toast-msg")), "avisa que sus gastos pasan a la principal");
  ok(/Debes Bs\s?1\.900,00/.test(await texto(p, tarjetaSel(VISA))), "y así se ve: Visa debe 1.900");
  ok((await movs(p)).find(m => m.amount === 1900).tarjetaId === MASTER, "los movimientos no se tocan");
  await p.click(".undo-toast-btn");
  await p.waitForTimeout(450);
  ok((await tarjetas(p)).length === 2, "«Deshacer» la recupera");

  console.log("\nPagos recurrentes con tarjeta");
  await ir(p, "#fin-recurrentes");
  await p.click("[data-rec-nuevo]");
  await p.waitForTimeout(350);
  const pagosRec = await p.$$eval('#rec-form [name="payment"] option', os => os.map(o => o.textContent));
  ok(pagosRec.join("|") === "Efectivo|Débito|Visa BNB|Master Ganadero", "«Se paga con» también lista cada tarjeta");
  await p.click("#rec-sheet .budget-sheet-close");
  await p.waitForTimeout(300);
  ok(!p.errores.length, "sin errores de página");
  await p.context().close();

  console.log("\nCelular angosto (320 px)");
  const q = await abrir(browser, base, { __SEED__: SEED }, { hash: "#fin-tarjetas", ancho: 320, alto: 700, zona: ZONA, fecha: HOY });
  await q.waitForTimeout(600);
  await q.click("[data-tc-nueva]");
  await q.waitForTimeout(300);
  await hojaTarjeta(q, "Tarjeta con un nombre bastante largo", "15000", "10");
  await q.click("[data-tc-nueva]");
  await q.waitForTimeout(300);
  await hojaTarjeta(q, "Master", "2000", "");
  ok((await sobra(q, "html")) <= 0 && (await sobra(q, "#fin-tarjetas")) <= 0, "Tarjetas no se sale de ancho");
  ok(await q.$eval("#fin-tarjetas .fin-tc-nombre", el => el.scrollWidth > el.clientWidth || el.getBoundingClientRect().right <= el.parentElement.getBoundingClientRect().right), "un nombre largo se corta con «…» sin empujar el lápiz");
  await captura(q, "tarjetas-320.png");
  await q.click("#fin-tarjetas [data-tc-editar]");
  await q.waitForTimeout(300);
  ok((await sobra(q, "#tc-sheet .budget-sheet-panel")) <= 0, "la hoja cabe");
  ok(!q.errores.length, "sin errores de página");
  await q.context().close();
  await terminar(browser, srv);
})();
