// Tarjetas de crédito: avance de efectivo con comisión (D-167), a 375 px.
// Sacas plata con la tarjeta (por ejemplo, por QR) a Débito o Efectivo; en la
// tarjeta debes lo que sacaste + la comisión (el % de la tarjeta).
// Uso: node scripts/e2e/tarjetas-avance.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar, auditarContraste } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const HOY = "2026-11-28T10:00:00-04:00";
const MOVS = "users/test/finanzas";
const texto = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const movs = p => p.evaluate(c => [...window.__fakeStore.colMap(c)].map(([id, d]) => Object.assign({ id }, d)), MOVS);
const tarjetas = p => p.evaluate(() => window.__fakeStore.colMap("users/test/meta").get("finanzas_tarjetas").list);
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(500); };
const visible = (p, sel) => p.$eval(sel, el => !el.hidden && el.offsetParent !== null).catch(() => false);
const sinAviso = p => p.evaluate(() => { const t = document.getElementById("undo-toast"); if (t) t.hidden = true; });
const VISA = "tc_visa", MASTER = "tc_master";
const sel = (id, sub) => `#fin-tarjetas [data-tc="${id}"] ${sub || ""}`;
const teclear = async (p, cifras) => { for (const k of cifras) await p.click(`[data-txn-key="${k}"]`); };

const SEED = {
  "users/test/meta": { finanzas_tarjetas: { list: [
    { id: VISA, nombre: "Visa BNB", limiteCent: 500000, limite: 5000, diaPago: 30, color: "#e05656", creado: 1, avancePct: 1 },
    { id: MASTER, nombre: "Master", limiteCent: 200000, limite: 2000, diaPago: 10, color: "#4d9de0", creado: 2 }
  ] } },
  [MOVS]: {
    sueldo: { date: "2026-11-01", type: "ingreso", category: "salario", payment: "debito", amount: 5000, createdAt: 1 },
    g1: { date: "2026-11-02", type: "gasto", category: "otros", payment: "credito", amount: 1200, tarjetaId: VISA, desc: "Supermercado", createdAt: 2 }
  }
};

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#fin-movimientos", zona: ZONA, fecha: HOY, ancho: 375, alto: 812 });
  const consola = [];
  p.on("console", m => { if ((m.type() === "error" || m.type() === "warning") && !/Failed to load resource|net::ERR/.test(m.text())) consola.push(`${m.type()}: ${m.text()}`); });
  await p.waitForTimeout(1200);

  console.log("\nAl registrar un gasto con la tarjeta: «Es un avance de efectivo»");
  await p.click("#txn-add");
  await p.waitForTimeout(450);
  ok(!(await visible(p, "#txn-sheet-avance-btn")), "con Efectivo o Débito, no aparece");
  await p.click("#txn-sheet-pay");
  await p.waitForTimeout(350);
  await p.click(`#category-selector-grid [data-pick-id="credito|${VISA}"]`);
  await p.waitForTimeout(350);
  ok(await visible(p, "#txn-sheet-avance-btn") && /¿Sacaste plata con la tarjeta\? Es un avance de efectivo/.test(await texto(p, "#txn-sheet-avance-btn")), "con la Visa: «¿Sacaste plata con la tarjeta? Es un avance de efectivo»");
  await p.click("#txn-sheet-avance-btn");
  await p.waitForTimeout(350);
  ok((await texto(p, "#txn-sheet-title")) === "Avance de efectivo", "la hoja pasa a «Avance de efectivo»");
  ok(/^Visa BNB · disponible Bs\s?3\.800/.test(await texto(p, "#txn-sheet-from-label")) && /^Débito/.test(await texto(p, "#txn-sheet-to-label")), "desde la Visa (con su disponible) a Débito");
  await teclear(p, ["3", "0", "0"]);
  await p.waitForTimeout(200);
  const fila = await texto(p, "#txn-sheet-avance-row");
  ok(/Comisión del avance · 1 %: Bs\s?3/.test(fila) && /En Visa BNB debes Bs\s?303 \(Bs\s?300 \+ Bs\s?3 de comisión\)\./.test(fila), `la comisión al escribir: Bs 3, debes Bs 303 (${fila.slice(0, 70)}…)`);
  let malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `la hoja se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "sin moverse de lado");
  await captura(p, "tarjetas-avance-hoja-375.png");
  await p.click("#txn-sheet-save");
  await p.waitForTimeout(700);
  let ms = await movs(p);
  const av = ms.find(m => m.type === "transferencia" && m.from === "tarjeta");
  const com = ms.find(m => m.comisionAvance);
  ok(av && av.to === "debito" && av.amount === 300 && av.tarjetaId === VISA && av.avance === true && av.avancePct === 1 && av.comisionCent === 300 && av.desc === "Avance de efectivo", "se guarda el avance: Bs 300 de la Visa a Débito, con 1 %");
  ok(com && com.type === "gasto" && com.payment === "credito" && com.tarjetaId === VISA && com.amount === 3 && com.category === "otros" && com.desc === "Comisión del avance (1 %)", "y la comisión, Bs 3, como gasto de la Visa");
  ok(av && com && (av.links || []).some(l => l.kind === "mov" && l.id === com.id), "unidos: si borras el avance, se borra su comisión");
  ok(/Avance de Bs\s?300 a Débito · comisión Bs\s?3: en Visa BNB debes Bs\s?303 más/.test(await texto(p, "#undo-toast")), "aviso: «comisión Bs 3: en Visa BNB debes Bs 303 más»");

  console.log("\nEn Movimientos y en la tarjeta");
  ok(/Débito/.test(await texto(p, "#finance-stats")) && /Bs\s?5\.300/.test(await texto(p, '#finance-stats [data-abrir-cartera="debito"]')), "Débito sube a Bs 5.300");
  ok(/−Bs\s?1\.503,00/.test(await texto(p, `#finance-stats [data-tc-fila="${VISA}"]`)), "la Visa debe Bs 1.503 (1.200 + 300 + 3)");
  const lista = await texto(p, "#finance-list");
  ok(/Avance de efectivo Visa BNB → Débito/.test(lista) && /Comisión del avance \(1 %\) Otros · Visa BNB/.test(lista), "en la lista: «Avance de efectivo · Visa BNB → Débito» y la comisión");
  await p.click(`[data-edit-txn="${av.id}"]`);
  await p.waitForTimeout(450);
  ok((await texto(p, "#txn-sheet-title")) === "Avance de efectivo" && /Comisión del avance · 1 %: Bs\s?3/.test(await texto(p, "#txn-sheet-avance-row")), "al abrirlo: «Avance de efectivo», con su comisión");
  await p.click("#txn-sheet-delete");
  await p.waitForTimeout(600);
  ms = await movs(p);
  ok(!ms.some(m => m.id === av.id) && !ms.some(m => m.id === com.id) && /Avance de efectivo eliminado/.test(await texto(p, "#undo-toast")), "borrarlo quita el avance y su comisión");
  await p.click("#undo-toast .undo-toast-btn");
  await p.waitForTimeout(600);
  ms = await movs(p);
  ok(ms.some(m => m.id === av.id) && ms.some(m => m.id === com.id), "«Deshacer» devuelve los dos");
  await sinAviso(p);

  await ir(p, "#fin-tarjetas");
  const pago = await texto(p, sel(VISA, ".fin-tc-pago"));
  ok(/Para no pagar intereses: Bs\s?1\.503,00/.test(pago), `en la tarjeta, lo que pagas ya lo incluye (${pago.slice(0, 50)}…)`);
  await p.click(sel(VISA, "[data-tc-ver]"));
  await p.waitForTimeout(450);
  const det = await texto(p, "#tcd-cuerpo");
  ok(/Gastos \(1\) Bs\s?1\.200 Supermercado/.test(det) && /Avances de efectivo Bs\s?303 Avance de efectivo 28 nov · a Débito Bs\s?300 Comisión del avance \(1 %\) 28 nov · Otros Bs\s?3/.test(det), "el detalle muestra el avance y su comisión aparte");
  await captura(p, "tarjetas-avance-detalle-375.png");
  await p.click("#tcd-sheet .budget-sheet-close");
  await p.waitForTimeout(450);

  console.log("\nDesde la tarjeta y desde Transferencia");
  await p.click(sel(MASTER, "[data-tc-avance]"));
  await p.waitForTimeout(450);
  ok((await texto(p, "#txn-sheet-title")) === "Avance de efectivo" && /^Master/.test(await texto(p, "#txn-sheet-from-label")), "«Avance de efectivo» en la tarjeta abre la hoja desde la Master");
  ok(/Avance de efectivo · sin comisión/.test(await texto(p, "#txn-sheet-avance-row")) && /pon su % en la tarjeta/.test(await texto(p, "#txn-sheet-avance-row")), "sin % en la Master: «sin comisión» y dónde ponerlo");
  await p.click("#txn-sheet .budget-sheet-close");
  await p.waitForTimeout(450);
  await ir(p, "#fin-movimientos");
  await p.click("#txn-add");
  await p.waitForTimeout(450);
  await p.click('#txn-sheet [data-txn-type="transferencia"]');
  await p.waitForTimeout(300);
  await p.click("#txn-sheet-from");
  await p.waitForTimeout(350);
  const desde = await p.$$eval("#category-selector-grid [data-pick-id]", els => els.map(e => e.dataset.pickId));
  ok(desde.includes(`tarjeta|${VISA}`) && desde.includes(`tarjeta|${MASTER}`) && /Master · avance de efectivo/.test(await texto(p, "#category-selector-grid")), "«¿Desde qué cartera?» ofrece cada tarjeta para un avance");
  await p.click(`#category-selector-grid [data-pick-id="tarjeta|${MASTER}"]`);
  await p.waitForTimeout(350);
  ok(/^Débito/.test(await texto(p, "#txn-sheet-to-label")), "el destino pasa a Débito (un avance no va a Ahorro)");
  await p.click("#txn-sheet-to");
  await p.waitForTimeout(350);
  const destinos = await p.$$eval("#category-selector-grid [data-pick-id]", els => els.map(e => e.dataset.pickId));
  ok(destinos.length === 1 && destinos[0] === "efectivo", `a dónde va: solo Efectivo o Débito (${destinos.join(", ")})`);
  await p.click('#category-selector-grid [data-pick-id="efectivo"]');
  await p.waitForTimeout(350);
  await teclear(p, ["1", "0", "0"]);
  await p.click("#txn-sheet-save");
  await p.waitForTimeout(700);
  ms = await movs(p);
  const av2 = ms.find(m => m.type === "transferencia" && m.from === "tarjeta" && m.tarjetaId === MASTER);
  ok(av2 && av2.to === "efectivo" && av2.amount === 100 && av2.comisionCent === 0 && !(av2.links || []).length && !ms.some(m => m.comisionAvance && m.tarjetaId === MASTER), "sin %: el avance a Efectivo, sin comisión");
  await sinAviso(p);

  console.log("\nEl % en cada tarjeta");
  await ir(p, "#fin-tarjetas");
  await p.click(sel(MASTER, "[data-tc-editar]"));
  await p.waitForTimeout(550);
  ok(/Avance de efectivo · comisión \(%\)/.test(await texto(p, "#tc-form")) && /Con 1 %, si sacas Bs 300, en la tarjeta debes Bs 303\./.test(await texto(p, "#tc-avance-ayuda")), "el formulario tiene «Avance de efectivo · comisión (%)» con su ejemplo");
  await p.fill('#tc-form [name="avancePct"]', "dos");
  await p.click("#tc-guardar");
  await p.waitForTimeout(400);
  ok(/es un porcentaje/.test(await texto(p, "#tc-error")), "si no es un número, lo dice");
  await p.fill('#tc-form [name="avancePct"]', "2,5");
  await p.$eval('#tc-form [name="avancePct"]', el => el.scrollIntoView({ block: "center" }));
  await captura(p, "tarjetas-avance-form-375.png");
  await p.click("#tc-guardar");
  await p.waitForTimeout(600);
  ok((await tarjetas(p)).find(t => t.id === MASTER).avancePct === 2.5, "se guarda: 2,5 %");
  await sinAviso(p);
  await p.click(sel(VISA, "[data-tc-editar]"));
  await p.waitForTimeout(550);
  ok((await p.$eval('#tc-form [name="avancePct"]', i => i.value)) === "1", "la Visa muestra su 1 %");
  await p.click("#tc-sheet .budget-sheet-close");
  await p.waitForTimeout(400);

  console.log("\nCalidad a 375 px");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Tarjetas sin moverse de lado");
  const chicos = await p.$$eval("#fin-tarjetas button", els => els.filter(e => e.offsetParent).map(e => ({ t: e.textContent.trim().slice(0, 25), h: e.getBoundingClientRect().height })).filter(x => x.h < 44));
  ok(!chicos.length, `botones de 44 px o más${chicos.length ? `: ${JSON.stringify(chicos)}` : ""}`);
  malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `Tarjetas se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await p.$eval(sel(VISA), el => el.scrollIntoView({ block: "start" }));
  await captura(p, "tarjetas-avance-375.png");
  const p2 = await abrir(browser, base, { __SEED__: SEED }, { hash: "#fin-tarjetas", zona: ZONA, fecha: HOY, ancho: 375, alto: 812, esquema: "light" });
  await p2.waitForTimeout(1200);
  await p2.click(sel(VISA, "[data-tc-avance]"));
  await p2.waitForTimeout(450);
  await teclear(p2, ["3", "0", "0"]);
  malos = await p2.evaluate(auditarContraste);
  ok(!malos.length, `en claro, la hoja del avance se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await captura(p2, "tarjetas-avance-claro-375.png");
  ok(!consola.length && !p.errores.length && !p2.errores.length, `sin errores ni advertencias${consola.length ? ` (${consola[0]})` : ""}`);
  await terminar(browser, srv);
})();
