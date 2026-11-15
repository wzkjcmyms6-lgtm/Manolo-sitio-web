// Tarjetas de crédito: el pago mínimo de cada una (D-121), a 375 px.
// Uso: node scripts/e2e/tarjetas-minimo.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const HOY = "2026-11-28T10:00:00-04:00";   // la Visa vence el 30: faltan 2 días
const MOVS = "users/test/finanzas";
const texto = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const tarjetas = p => p.evaluate(() => window.__fakeStore.colMap("users/test/meta").get("finanzas_tarjetas").list);
const movs = p => p.evaluate(c => [...window.__fakeStore.colMap(c)].map(([id, d]) => Object.assign({ id }, d)), MOVS);
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(500); };
const VISA = "tc_visa", MASTER = "tc_master";
const sel = (id, sub) => `#fin-tarjetas [data-tc="${id}"] ${sub || ""}`;

const SEED = {
  "users/test/meta": { finanzas_tarjetas: { list: [
    { id: VISA, nombre: "Visa BNB", limiteCent: 500000, limite: 5000, diaPago: 30, color: "#e05656", creado: 1, pagoMinimoCent: 25000, pagoMinimo: 250, pagoMinimoActualizado: 1 },
    { id: MASTER, nombre: "Master", limiteCent: 200000, limite: 2000, diaPago: 10, color: "#4d9de0", creado: 2 }
  ] } },
  [MOVS]: {
    sueldo: { date: "2026-11-01", type: "ingreso", category: "salario", payment: "debito", amount: 5000, createdAt: 1 },
    g1: { date: "2026-11-02", type: "gasto", category: "otros", payment: "credito", amount: 1200, tarjetaId: VISA, desc: "Supermercado", createdAt: 2 },
    g2: { date: "2026-11-03", type: "gasto", category: "otros", payment: "credito", amount: 400, tarjetaId: MASTER, desc: "Farmacia", createdAt: 3 },
    p1: { date: "2026-11-10", type: "transferencia", from: "debito", to: "tarjeta", amount: 100, tarjetaId: VISA, desc: "Pago de Visa BNB", createdAt: 4 }
  }
};

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#fin-tarjetas", zona: ZONA, fecha: HOY, ancho: 375, alto: 812 });
  const consola = [];
  p.on("console", m => { if ((m.type() === "error" || m.type() === "warning") && !/Failed to load resource|net::ERR/.test(m.text())) consola.push(`${m.type()}: ${m.text()}`); });
  await p.waitForTimeout(1200);

  console.log("\nEn cada tarjeta");
  const visa = await texto(p, sel(VISA, ".fin-tc-min"));
  ok(/Pago mínimo: Bs\s?150,00/.test(visa), `muestra lo que falta del mínimo (${visa.slice(0, 60)}…)`);
  ok(/Urgente: vence el 30 nov \(en 2 días\)/.test(visa) && /ya pagaste Bs\s?100 de Bs\s?250/.test(visa) && /para no caer en el buró/.test(visa), "cuándo vence, lo ya pagado y para qué sirve");
  ok(await p.$eval(sel(VISA, ".fin-tc-min"), el => el.classList.contains("is-mal") && /!/.test(el.querySelector(".fin-tc-min-ic").textContent)), "a 2 días: en rojo, con ícono y texto (no solo color)");
  ok(/Pagar el mínimo \(Bs\s?150\)/.test(await texto(p, sel(VISA, "[data-tc-pagar-min]"))) && /Pagar todo \(Bs\s?1\.100,00\)/.test(await texto(p, sel(VISA, "[data-tc-pagar]"))), "dos botones: «Pagar el mínimo» y «Pagar todo»");
  ok(/Agregar el pago mínimo/.test(await texto(p, sel(MASTER, "[data-tc-min-agregar]"))), "la tarjeta sin mínimo ofrece agregarlo");
  await captura(p, "tarjetas-minimo-375.png");

  console.log("\nPagar el mínimo");
  await p.click(sel(VISA, "[data-tc-pagar-min]"));
  await p.waitForTimeout(450);
  ok(/^Visa BNB/.test(await texto(p, "#txn-sheet-to-label")) && /^Débito/.test(await texto(p, "#txn-sheet-from-label")), "abre la transferencia Débito → Visa BNB");
  await p.click("#txn-sheet-save");
  await p.waitForTimeout(600);
  const pago = (await movs(p)).find(m => m.desc === "Pago mínimo de Visa BNB");
  ok(pago && pago.amount === 150 && pago.tarjetaId === VISA && pago.to === "tarjeta", "se anota el pago de Bs 150 a la Visa");
  ok(/Pago mínimo cubierto/.test(await texto(p, sel(VISA, ".fin-tc-min"))) && /Pagaste Bs\s?250 desde el 30 oct/.test(await texto(p, sel(VISA, ".fin-tc-min"))), "queda «Pago mínimo cubierto» (pagaste 250 desde el 30 oct)");
  ok(!(await p.$(sel(VISA, "[data-tc-pagar-min]"))), "ya no ofrece pagar el mínimo");

  console.log("\nAgregar y cambiar el pago mínimo");
  await p.click(sel(MASTER, "[data-tc-min-agregar]"));
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.name === "pagoMinimo"), "abre la tarjeta con el cursor en «Pago mínimo»");
  ok(/no caer en el buró/.test(await texto(p, "#tc-min-ayuda")), "explica qué es el pago mínimo");
  await p.fill('#tc-form [name="pagoMinimo"]', "cien");
  await p.click("#tc-guardar");
  await p.waitForTimeout(400);
  ok(/tiene que ser un número/.test(await texto(p, "#tc-error")), "si no es un número, lo dice");
  await p.fill('#tc-form [name="pagoMinimo"]', "120,50");
  await p.click("#tc-guardar");
  await p.waitForTimeout(500);
  const master = (await tarjetas(p)).find(t => t.id === MASTER);
  ok(master.pagoMinimoCent === 12050 && master.pagoMinimo === 120.5 && master.pagoMinimoActualizado > 0 && master.limiteCent === 200000 && master.creado === 2, "se guarda (Bs 120,50) sin tocar lo demás de la tarjeta");
  ok(/Pago mínimo: Bs\s?120,50/.test(await texto(p, sel(MASTER, ".fin-tc-min"))), "la Master muestra su mínimo");

  console.log("\nEn el Resumen y en Mi día");
  const p2 = await abrir(browser, base, { __SEED__: SEED }, { hash: "#finanzas", zona: ZONA, fecha: HOY, ancho: 375, alto: 812 });
  await p2.waitForTimeout(1300);
  ok(/Mínimo por pagar: Bs\s?150/.test(await texto(p2, '#finance-stats [data-tc-fila="tc_visa"]')), "la fila de la Visa: «Mínimo por pagar: Bs 150»");
  const atencion = await texto(p2, "#panel-finanzas");
  ok(/En 2 días: pago mínimo de Visa BNB · Bs\s?150(,00)? \(para no caer en el buró\)/.test(atencion), `«Atención»: el mínimo que vence en 2 días (${(atencion.match(/En 2 días[^.]*/) || [""])[0].slice(0, 80)})`);
  await p2.evaluate(() => { location.hash = "#inicio"; });
  await p2.waitForTimeout(900);
  const fila = await texto(p2, '#mi-dia [data-md="tarjeta"]');
  ok(/Pago mínimo de Visa BNB: Bs\s?150(,00)?/.test(fila) && /Vence en 2 días\. Págalo para no caer en el buró\./.test(fila), `«Mi día» lo recuerda (${fila.slice(0, 70)})`);
  await p2.evaluate(() => { location.hash = "#fin-analisis"; });
  await p2.waitForTimeout(800);
  ok(/Próximos 30 días/.test(await texto(p2, "#panel-fin-analisis")) && /Pago de Visa BNB/.test(await texto(p2, "#panel-fin-analisis")), "Análisis › Próximos 30 días funciona con pagos de tarjeta por venir (antes fallaba)");
  ok(await p2.$eval('#mi-dia [data-md="tarjeta"]', a => a.getAttribute("href") === "#fin-tarjetas"), "y lleva a Tarjetas");

  console.log("\nCalidad a 375 px");
  await p.evaluate(() => { location.hash = "#fin-tarjetas"; });
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "sin moverse de lado");
  const chicos = await p.$$eval("#fin-tarjetas button", els => els.filter(e => e.offsetParent).map(e => ({ t: e.textContent.trim().slice(0, 25), h: e.getBoundingClientRect().height })).filter(x => x.h < 44));
  ok(!chicos.length, `botones de 44 px o más${chicos.length ? `: ${JSON.stringify(chicos)}` : ""}`);
  ok(!consola.length && !p.errores.length && !p2.errores.length, `sin errores ni advertencias${consola.length ? ` (${consola[0]})` : ""}`);
  await terminar(browser, srv);
})();
