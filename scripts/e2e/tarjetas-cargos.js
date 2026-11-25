// Tarjetas de crédito: seguros y mantenimiento de cada mes, en vez del pago
// mínimo (D-165, reemplaza a D-121); de qué sale lo que pagas y el día de
// corte (D-166), a 375 px.
// El dueño paga siempre todo: lo que gastó + seguros y mantenimiento.
// Uso: node scripts/e2e/tarjetas-cargos.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar, auditarContraste } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const HOY = "2026-11-28T10:00:00-04:00";   // la Visa vence el 30: faltan 2 días; la Master, el 10 dic
const MOVS = "users/test/finanzas";
const texto = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const tarjetas = p => p.evaluate(() => window.__fakeStore.colMap("users/test/meta").get("finanzas_tarjetas").list);
const movs = p => p.evaluate(c => [...window.__fakeStore.colMap(c)].map(([id, d]) => Object.assign({ id }, d)), MOVS);
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(500); };
const VISA = "tc_visa", MASTER = "tc_master";
const sel = (id, sub) => `#fin-tarjetas [data-tc="${id}"] ${sub || ""}`;
const sinAviso = p => p.evaluate(() => { const t = document.getElementById("undo-toast"); if (t) t.hidden = true; });

// La Visa todavía tiene el pago mínimo de antes (D-121) y ningún seguro; la
// Master ya tiene seguro de desgravamen y mantenimiento.
const CARGOS_MASTER = [{ id: "seg", nombre: "Seguro de desgravamen", montoCent: 3450, monto: 34.5 }, { id: "man", nombre: "Mantenimiento", montoCent: 3000, monto: 30 }];
const lista = visaExtra => [
  Object.assign({ id: VISA, nombre: "Visa BNB", limiteCent: 500000, limite: 5000, diaPago: 30, color: "#e05656", creado: 1, pagoMinimoCent: 25000, pagoMinimo: 250, pagoMinimoActualizado: 1 }, visaExtra || {}),
  { id: MASTER, nombre: "Master", limiteCent: 200000, limite: 2000, diaPago: 10, color: "#4d9de0", creado: 2, cargos: CARGOS_MASTER, cargosActualizado: 2 }
];
const MOVIMIENTOS = {
  sueldo: { date: "2026-11-01", type: "ingreso", category: "salario", payment: "debito", amount: 5000, createdAt: 1 },
  g1: { date: "2026-11-02", type: "gasto", category: "otros", payment: "credito", amount: 1200, tarjetaId: VISA, desc: "Supermercado", createdAt: 2 },
  g2: { date: "2026-11-03", type: "gasto", category: "otros", payment: "credito", amount: 400, tarjetaId: MASTER, desc: "Farmacia", createdAt: 3 },
  p1: { date: "2026-11-10", type: "transferencia", from: "debito", to: "tarjeta", amount: 100, tarjetaId: VISA, desc: "Pago de Visa BNB", createdAt: 4 }
};
const SEED = { "users/test/meta": { finanzas_tarjetas: { list: lista() } }, [MOVS]: MOVIMIENTOS };
// La Visa con sus seguros ya anotados (para el Resumen y Mi día).
const SEED2 = { "users/test/meta": { finanzas_tarjetas: { list: lista({ cargos: [{ id: "s1", nombre: "Seguro de desgravamen", montoCent: 2550, monto: 25.5 }, { id: "m1", nombre: "Mantenimiento", montoCent: 3000, monto: 30 }] }) } }, [MOVS]: MOVIMIENTOS };

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#fin-tarjetas", zona: ZONA, fecha: HOY, ancho: 375, alto: 812 });
  const consola = [];
  p.on("console", m => { if ((m.type() === "error" || m.type() === "warning") && !/Failed to load resource|net::ERR/.test(m.text())) consola.push(`${m.type()}: ${m.text()}`); });
  await p.waitForTimeout(1200);

  console.log("\nEn cada tarjeta: pagar todo, sin pago mínimo");
  const visa = await texto(p, sel(VISA, ".fin-tc-pago"));
  ok(/Para no pagar intereses: Bs\s?1\.100,00/.test(visa) && /Pronto: vence el 30 nov \(en 2 días\)\. Paga todo lo que debes\./.test(visa), `Visa: «Para no pagar intereses: Bs 1.100», vence en 2 días (${visa.slice(0, 70)}…)`);
  ok(await p.$eval(sel(VISA, ".fin-tc-pago"), el => el.classList.contains("is-aviso") && el.querySelector(".fin-tc-pago-ic").textContent.trim() === "!"), "a 2 días: ámbar, con ícono y texto (no solo color)");
  ok(/Pagar todo \(Bs\s?1\.100,00\)/.test(await texto(p, sel(VISA, "[data-tc-pagar]"))), "botón «Pagar todo (Bs 1.100,00)»");
  ok(/Agregar seguros y mantenimiento/.test(await texto(p, sel(VISA, "[data-tc-cargos-agregar]"))), "la tarjeta sin seguros ofrece agregarlos");
  const todo = await texto(p, "#fin-tarjetas");
  ok(!/mínimo|buró/i.test(todo) && !(await p.$("[data-tc-pagar-min]")), "ya no hay pago mínimo en ninguna parte");
  const master = await texto(p, sel(MASTER, ".fin-tc-pago"));
  ok(/Para no pagar intereses: Bs\s?464,50/.test(master) && /Pendiente: vence el 10 dic \(en 12 días\)\. Lo que gastaste \(Bs\s?400\) \+ seguros y mantenimiento \(Bs\s?64,50\)\./.test(master), `Master: lo que gastó + seguros y mantenimiento (${master.slice(0, 60)}…)`);
  ok(await p.$eval(sel(MASTER, ".fin-tc-pago"), el => el.classList.contains("is-normal") && !!el.querySelector(".fin-tc-pago-ic [data-icon]")), "a 12 días: sin alarma, con un calendario");
  ok(/Pagar todo \(Bs\s?464,50\)/.test(await texto(p, sel(MASTER, "[data-tc-pagar]"))) && !(await p.$(sel(MASTER, "[data-tc-cargos-agregar]"))), "Master: «Pagar todo (Bs 464,50)» y no ofrece agregar (ya los tiene)");
  ok(/Para no pagar intereses, este mes: Bs\s?1\.564,50/.test(await texto(p, "#fin-tarjetas .fin-tc-total")), "arriba, lo de las dos tarjetas: Bs 1.564,50");
  ok(!/Pago: 30 nov/.test(await texto(p, sel(VISA))), "la fecha no se repite (va en el recuadro)");
  await captura(p, "tarjetas-cargos-375.png");

  console.log("\nAnotar los seguros y el mantenimiento de la Visa");
  await p.click(sel(VISA, "[data-tc-cargos-agregar]"));
  await p.waitForTimeout(550);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.name === "cargoNombre0"), "abre la tarjeta con el cursor en el primer cargo");
  ok(/Lo que el banco te cobra cada mes, siempre igual/.test(await texto(p, "#tc-cargos-ayuda")), "explica qué anotar");
  ok(/Antes anotaste un pago mínimo de Bs\s?250\. Ya no se usa, porque pagas todo\. Si eran tus seguros, anótalos aquí\./.test(await texto(p, "#tc-form .fin-tc-viejo")), "avisa que el pago mínimo de antes ya no se usa");
  ok((await p.$$eval("#tc-form .fin-tc-cargo input[name^=cargoNombre]", is => is.map(i => i.placeholder).join("|"))) === "Seguro de desgravamen|Mantenimiento", "dos filas para empezar: «Seguro de desgravamen» y «Mantenimiento»");
  ok((await p.$eval('#tc-form [name="cargosCategoria"]', s => s.options[s.selectedIndex].text)) === "Otros", "se anotan como gasto en «Otros» (puedes elegir otra)");
  await p.fill('#tc-form [name="cargoNombre0"]', "Seguro de desgravamen");
  await p.click("#tc-guardar");
  await p.waitForTimeout(400);
  ok(/Escribe cuánto te cobran por «Seguro de desgravamen» cada mes\./.test(await texto(p, "#tc-error")) && await p.$eval('#tc-form [name="cargoMonto0"]', i => i.classList.contains("is-error")), "sin monto: lo dice y marca el campo");
  await p.fill('#tc-form [name="cargoMonto0"]', "veinte");
  await p.click("#tc-guardar");
  await p.waitForTimeout(400);
  ok(/tiene que ser un número/.test(await texto(p, "#tc-error")), "si no es un número, lo dice");
  await p.fill('#tc-form [name="cargoMonto0"]', "25,50");
  await p.fill('#tc-form [name="cargoNombre1"]', "Mantenimiento");
  await p.fill('#tc-form [name="cargoMonto1"]', "30");
  await p.click("#tc-form [data-tc-cargo-mas]");
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.name === "cargoNombre2"), "«Agregar otro»: una fila más, con el cursor ahí");
  ok((await p.$eval('#tc-form [name="cargoNombre0"]', i => i.value)) === "Seguro de desgravamen" && (await p.$eval('#tc-form [name="cargoMonto1"]', i => i.value)) === "30", "lo ya escrito se conserva");
  await p.fill('#tc-form [name="cargoNombre2"]', "Seguro contra fraude");
  await p.fill('#tc-form [name="cargoMonto2"]', "15");
  await p.click('#tc-form [data-tc-cargo-quitar="2"]');
  await p.waitForTimeout(300);
  ok((await p.$$eval("#tc-form .fin-tc-cargo", f => f.length)) === 2 && !(await p.$('#tc-form [name="cargoNombre2"]')), "la × quita esa fila");
  ok(/Total al mes: Bs\s?55,50/.test(await texto(p, "#tc-form .fin-tc-cargos-total")), "muestra el total al mes: Bs 55,50");
  const malosForm = await p.evaluate(auditarContraste);
  ok(!malosForm.length, `el formulario se lee bien${malosForm.length ? `: ${malosForm.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  const chicosForm = await p.$$eval("#tc-sheet button, #tc-sheet input, #tc-sheet select", els => els.filter(e => e.offsetParent).map(e => ({ t: (e.textContent || e.name || "").trim().slice(0, 20), h: e.getBoundingClientRect().height })).filter(x => x.h < 44));
  ok(!chicosForm.length, `en el formulario todo se toca bien (44 px)${chicosForm.length ? `: ${JSON.stringify(chicosForm)}` : ""}`);
  ok(await p.evaluate(() => { const f = document.querySelector("#tc-sheet .budget-sheet-panel"); return f.scrollWidth <= f.clientWidth + 1; }), "el formulario no se sale a lo ancho");
  await p.$eval("#tc-form .fin-tc-cargos", el => el.scrollIntoView({ block: "center" }));
  await captura(p, "tarjetas-cargos-form-375.png");
  await p.click("#tc-guardar");
  await p.waitForTimeout(600);
  const v = (await tarjetas(p)).find(t => t.id === VISA);
  ok(v.cargos.length === 2 && v.cargos[0].nombre === "Seguro de desgravamen" && v.cargos[0].montoCent === 2550 && v.cargos[0].monto === 25.5 && v.cargos[1].montoCent === 3000 && /^cg_/.test(v.cargos[0].id) && v.cargos[0].id !== v.cargos[1].id, "se guardan los dos cargos, cada uno con su id");
  ok(v.cargosCategoria === "otros" && v.cargosActualizado > 0 && v.limiteCent === 500000 && v.creado === 1 && v.pagoMinimoCent === 25000, "con su categoría, sin tocar lo demás (el pago mínimo de antes queda guardado)");
  ok(/«Visa BNB» guardada · seguros y mantenimiento: Bs\s?55,50 al mes/.test(await texto(p, "#undo-toast")), "aviso: «guardada · seguros y mantenimiento: Bs 55,50 al mes»");
  const visa2 = await texto(p, sel(VISA, ".fin-tc-pago"));
  ok(/Para no pagar intereses: Bs\s?1\.155,50/.test(visa2) && /Lo que gastaste \(Bs\s?1\.100\) \+ seguros y mantenimiento \(Bs\s?55,50\)/.test(visa2), "la Visa ya suma sus seguros: Bs 1.155,50");
  ok(!(await p.$(sel(VISA, "[data-tc-cargos-agregar]"))), "y ya no ofrece agregarlos");

  console.log("\nDe qué sale: al tocar la tarjeta");
  await sinAviso(p);
  await p.click(sel(VISA, "[data-tc-ver]"));
  await p.waitForTimeout(450);
  ok(await p.$eval("#tcd-sheet", s => !s.hidden) && (await texto(p, "#tcd-sheet-title")) === "Visa BNB", "tocar el recuadro abre «Visa BNB» con el detalle");
  const det = await texto(p, "#tcd-cuerpo");
  ok(/^Para no pagar intereses Bs\s?1\.155,50 Vence el 30 nov \(en 2 días\)/.test(det), `arriba, lo que pagas y cuándo vence (${det.slice(0, 70)}…)`);
  ok(/Gastos \(1\) Bs\s?1\.200 Supermercado 2 nov · Otros Bs\s?1\.200/.test(det), "los gastos que lo componen: Supermercado, 2 nov, Bs 1.200");
  ok(/Seguros y mantenimiento Bs\s?55,50 Seguro de desgravamen Se anota al pagar Bs\s?25,50 Mantenimiento Se anota al pagar Bs\s?30/.test(det), "los seguros y el mantenimiento, que se anotan al pagar");
  ok(/Ya pagaste −Bs\s?100 Pago de Visa BNB 10 nov · Pago −Bs\s?100/.test(det), "lo que ya pagaste (10 nov)");
  ok(/Para no pagar intereses Bs\s?1\.155,50$/.test(det), "y el total: Bs 1.155,50 (1.200 + 55,50 − 100)");
  ok((await p.$eval("#tcd-acciones [data-tcd-pagar]", b => b.textContent.trim())) === "Pagar todo (Bs 1.155,50)" && !(await p.$("#tcd-acciones [data-tcd-ir]")), "con «Pagar todo (Bs 1.155,50)» (sin «Ver tus tarjetas»: ya estás ahí)");
  const malosDet = await p.evaluate(auditarContraste);
  ok(!malosDet.length, `el detalle se lee bien${malosDet.length ? `: ${malosDet.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  ok(await p.evaluate(() => { const f = document.querySelector("#tcd-sheet .budget-sheet-panel"); return f.scrollWidth <= f.clientWidth + 1; }), "el detalle no se sale a lo ancho");
  const chicosDet = await p.$$eval("#tcd-sheet button", els => els.filter(e => e.offsetParent).map(e => ({ t: e.textContent.trim().slice(0, 20), h: e.getBoundingClientRect().height })).filter(x => x.h < 44));
  ok(!chicosDet.length, `en el detalle todo se toca bien (44 px)${chicosDet.length ? `: ${JSON.stringify(chicosDet)}` : ""}`);
  await captura(p, "tarjetas-detalle-375.png");
  await p.click('#tcd-cuerpo [data-tcd-mov="g1"]');
  await p.waitForTimeout(550);
  ok(await p.$eval("#tcd-sheet", s => s.hidden || s.classList.contains("is-closing")) && (await texto(p, "#txn-sheet-title")) === "Editar transacción" && (await texto(p, "#txn-sheet-amount")) === "1.200", "tocar un gasto lo abre (Editar transacción, Bs 1.200)");
  await p.click("#txn-sheet .budget-sheet-close");
  await p.waitForTimeout(450);
  await p.click(sel(VISA, ".fin-tc-cifras"));
  await p.waitForTimeout(450);
  ok(await p.$eval("#tcd-sheet", s => !s.hidden), "tocar cualquier parte de la tarjeta también lo abre");
  await p.click("#tcd-sheet .budget-sheet-close");
  await p.waitForTimeout(450);
  ok(await p.$eval("#tcd-sheet", s => s.hidden), "la × lo cierra");

  console.log("\nPagar todo: se anotan los seguros y la tarjeta queda al día");
  await p.click(sel(VISA, "[data-tc-pagar]"));
  await p.waitForTimeout(500);
  ok(/^Visa BNB/.test(await texto(p, "#txn-sheet-to-label")) && /^Débito/.test(await texto(p, "#txn-sheet-from-label")), "abre la transferencia Débito → Visa BNB");
  ok((await texto(p, "#txn-sheet-amount")) === "1.155,50", "con todo: Bs 1.155,50");
  ok(await p.$eval("#txn-sheet-cargos-row", r => !r.hidden && r.offsetParent !== null) && await p.$eval("#txn-sheet-cargos", c => c.checked), "fila «Sumar seguros y mantenimiento», prendida");
  ok(/Sumar seguros y mantenimiento · Bs\s?55,50/.test(await texto(p, "#txn-sheet-cargos-row")) && /Se anotan como gastos de Visa BNB: Seguro de desgravamen, Mantenimiento\./.test(await texto(p, "#txn-sheet-cargos-row")), "dice cuánto y qué se anota");
  await p.click("#txn-sheet-cargos-row");
  await p.waitForTimeout(250);
  ok((await texto(p, "#txn-sheet-amount")) === "1.100" && !(await p.$eval("#txn-sheet-cargos", c => c.checked)), "al apagarla, el monto baja a Bs 1.100");
  await p.click("#txn-sheet-cargos-row");
  await p.waitForTimeout(250);
  ok((await texto(p, "#txn-sheet-amount")) === "1.155,50", "al prenderla, vuelve a Bs 1.155,50");
  const malosHoja = await p.evaluate(auditarContraste);
  ok(!malosHoja.length, `la hoja de pago se lee bien${malosHoja.length ? `: ${malosHoja.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await captura(p, "tarjetas-cargos-pagar-375.png");
  await p.click("#txn-sheet-save");
  await p.waitForTimeout(700);
  const ms = await movs(p);
  const pago = ms.find(m => m.type === "transferencia" && m.amount === 1155.5);
  const cargos = ms.filter(m => m.cargoId);
  ok(pago && pago.tarjetaId === VISA && pago.to === "tarjeta" && pago.from === "debito" && pago.desc === "Pago de Visa BNB", "se anota el pago de Bs 1.155,50 a la Visa");
  ok(cargos.length === 2 && cargos.every(c => c.type === "gasto" && c.payment === "credito" && c.tarjetaId === VISA && c.category === "otros" && c.cargoCiclo === "2026-11-30" && c.date === "2026-11-28" && c.createdAt < pago.createdAt && !c.excluded), "y los seguros como gastos de la Visa (de este mes, un instante antes del pago)");
  ok(cargos.map(c => `${c.desc} ${c.amount}`).sort().join("|") === "Mantenimiento 30|Seguro de desgravamen 25.5", "Seguro de desgravamen Bs 25,50 y Mantenimiento Bs 30");
  ok(/Pago de Bs\s?1\.155,50 guardado · se anotaron seguros y mantenimiento \(Bs\s?55,50\)/.test(await texto(p, "#undo-toast")), "aviso: «se anotaron seguros y mantenimiento»");
  const alDia = await texto(p, sel(VISA, ".fin-tc-pago"));
  ok(/Debes Bs\s?0,00/.test(await texto(p, sel(VISA))) && /Este mes ya pagaste todo/.test(alDia) && /Pagaste Bs\s?1\.255,50 desde el 30 oct: sin intereses\./.test(alDia), `la Visa queda en 0: «Este mes ya pagaste todo» (${alDia.slice(0, 60)}…)`);
  ok(await p.$eval(sel(VISA, ".fin-tc-pago"), el => el.classList.contains("is-ok")) && !(await p.$(sel(VISA, "[data-tc-pagar]"))), "en verde y sin «Pagar todo»");

  console.log("\nLo que gastas después va al pago siguiente");
  await p.evaluate(c => {
    window.__fakeStore.colMap(c).set("g9", { date: "2026-11-28", type: "gasto", category: "comida", payment: "credito", amount: 80, montoCent: 8000, tarjetaId: "tc_visa", desc: "Cena", createdAt: Date.now() + 1000 });
    window.__fakeStore.notify();
  }, MOVS);
  await p.waitForTimeout(700);
  const despues = await texto(p, sel(VISA, ".fin-tc-pago"));
  ok(/Este mes ya pagaste todo/.test(despues) && /Lo que gastaste después \(Bs\s?80\) va a tu próximo pago\./.test(despues), "sigue al día: lo nuevo (Bs 80) va al próximo pago");
  ok(await p.$eval(sel(VISA, "[data-tc-pagar]"), b => b.classList.contains("is-sec") && /Pagar todo \(Bs\s?80,00\)/.test(b.textContent)), "puedes pagarlo ya (botón secundario)");
  await p.click(sel(VISA, "[data-tc-pagar]"));
  await p.waitForTimeout(450);
  ok(await p.$eval("#txn-sheet-cargos-row", r => r.hidden), "los seguros de este mes ya están: no se suman otra vez");
  await p.click("#txn-sheet .budget-sheet-close");
  await p.waitForTimeout(400);
  await p.click("#txn-add");
  await p.waitForTimeout(400);
  ok(await p.$eval("#txn-sheet-cargos-row", r => r.hidden), "en un gasto común, la fila no aparece");
  await p.click("#txn-sheet .budget-sheet-close");
  await p.waitForTimeout(400);
  await p.click(sel(VISA, "[data-tc-ver]"));
  await p.waitForTimeout(450);
  const pagado = await texto(p, "#tcd-cuerpo");
  ok(/^✓ Este mes ya pagaste todo Bs\s?1\.255,50 Lo que pagaste desde el 30 oct: sin intereses\./.test(pagado), `al día: «Este mes ya pagaste todo», Bs 1.255,50 (${pagado.slice(0, 60)}…)`);
  ok(/Gastos \(1\) Bs\s?1\.200 Supermercado/.test(pagado) && /Seguros y mantenimiento Bs\s?55,50/.test(pagado) && /Seguro de desgravamen 28 nov · Otros Bs\s?25,50/.test(pagado) && /Mantenimiento 28 nov · Otros Bs\s?30/.test(pagado), "lo que cubrió tu pago: el gasto y los seguros ya anotados");
  ok(/Ya pagaste −Bs\s?1\.255,50/.test(pagado) && /Queda por pagar Bs\s?0/.test(pagado), "lo que pagaste (100 + 1.155,50) y «Queda por pagar Bs 0»");
  ok(/Después de pagar Bs\s?80 Cena 28 nov · Comida Bs\s?80 Va a tu próximo pago\.$/.test(pagado), "y aparte, lo de después (la cena), que va a tu próximo pago");
  await captura(p, "tarjetas-detalle-al-dia-375.png");
  await p.click("#tcd-sheet .budget-sheet-close");
  await p.waitForTimeout(450);

  console.log("\nMovimientos, Atención, Análisis y Mi día");
  const p2 = await abrir(browser, base, { __SEED__: SEED2 }, { hash: "#fin-movimientos", zona: ZONA, fecha: HOY, ancho: 375, alto: 812 });
  await p2.waitForTimeout(1300);
  ok(await p2.$eval(`#finance-stats [data-tc-fila="${VISA}"]`, el => el.offsetParent !== null), "en Movimientos, una fila por tarjeta");
  const filaV = await texto(p2, `#finance-stats [data-tc-fila="${VISA}"]`);
  ok(/A pagar: Bs\s?1\.155,50 \(con seguros\)/.test(filaV) && await p2.$eval(`#finance-stats [data-tc-fila="${VISA}"] .fin-cartera-pago`, el => el.classList.contains("is-aviso")), `fila de la Visa: «A pagar: Bs 1.155,50 (con seguros)» (${filaV.slice(0, 80)})`);
  ok(/A pagar: Bs\s?464,50 \(con seguros\)/.test(await texto(p2, `#finance-stats [data-tc-fila="${MASTER}"]`)), "fila de la Master: «A pagar: Bs 464,50 (con seguros)»");
  await p2.click(`#finance-stats [data-tc-fila="${VISA}"] [data-tc-ver]`);
  await p2.waitForTimeout(450);
  ok(await p2.$eval("#tcd-sheet", x => !x.hidden) && /Gastos \(1\) Bs\s?1\.200 Supermercado/.test(await texto(p2, "#tcd-cuerpo")), "en Movimientos, tocar la tarjeta también muestra de qué sale");
  await p2.click("#tcd-acciones [data-tcd-ir]");
  await p2.waitForTimeout(600);
  ok((await p2.evaluate(() => location.hash)) === "#fin-tarjetas" && await p2.$eval("#tcd-sheet", x => x.hidden || x.classList.contains("is-closing")), "«Ver tus tarjetas» lleva a Tarjetas");
  await p2.evaluate(() => { location.hash = "#finanzas"; });
  await p2.waitForTimeout(800);
  const atencion = await texto(p2, "#res-atencion");
  ok(/En 2 días: pago de Visa BNB · Bs\s?1\.155,50 \(con seguros y mantenimiento\)/.test(atencion), `«Atención»: el pago de la Visa con seguros (${(atencion.match(/En 2 días[^)]*\)/) || [""])[0]})`);
  ok(!/mínimo|buró/i.test(atencion) && !/pago de Master/.test(atencion), "sin pago mínimo; la Master (en 12 días) todavía no avisa");
  await p2.evaluate(() => { location.hash = "#fin-analisis"; });
  await p2.waitForTimeout(800);
  const analisis = await texto(p2, "#panel-fin-analisis");
  ok(/Pago de Visa BNB/.test(analisis) && /Pago de Master/.test(analisis) && /1\.620/.test(analisis), "Análisis › Próximos 30 días: los dos pagos, con seguros (Bs 1.620)");
  await p2.evaluate(() => { location.hash = "#inicio"; });
  await p2.waitForTimeout(900);
  const fila = await texto(p2, '#mi-dia [data-md="tarjeta"]');
  ok(/Pago de Visa BNB: Bs\s?1\.155,50/.test(fila) && /Vence en 2 días\. Págala completa para no pagar intereses\. Incluye seguros y mantenimiento\./.test(fila), `«Mi día» lo recuerda (${fila.slice(0, 80)})`);
  ok(await p2.$eval('#mi-dia [data-md="tarjeta"]', a => a.getAttribute("href") === "#fin-tarjetas"), "y lleva a Tarjetas");

  console.log("\nDía de corte: lo que pagas es lo del extracto");
  const BCP = "tc_bcp";
  const credito = (date, amount, desc, createdAt, category) => ({ date, type: "gasto", category: category || "otros", payment: "credito", amount, tarjetaId: BCP, desc, createdAt });
  const SEED3 = { "users/test/meta": { finanzas_tarjetas: { list: [{ id: BCP, nombre: "BCP", limiteCent: 300000, limite: 3000, diaPago: 5, diaCorte: 20, color: "#9b6bde", creado: 1,
    cargos: [{ id: "seg", nombre: "Seguro", montoCent: 4000, monto: 40 }] }] } },
  [MOVS]: { sueldo: MOVIMIENTOS.sueldo, o1: credito("2026-10-10", 800, "Viaje", 1),
    p0: { date: "2026-11-05", type: "transferencia", from: "debito", to: "tarjeta", amount: 800, tarjetaId: BCP, desc: "Pago de BCP", createdAt: 2 },
    n1: credito("2026-11-10", 600, "Super", 3), n2: credito("2026-11-18", 400, "Ropa", 4), n3: credito("2026-11-25", 80, "Cena", 5, "comida") } };
  const p4 = await abrir(browser, base, { __SEED__: SEED3 }, { hash: "#fin-tarjetas", zona: ZONA, fecha: HOY, ancho: 375, alto: 812 });
  await p4.waitForTimeout(1200);
  const bcp = await texto(p4, sel(BCP, ".fin-tc-pago"));
  ok(/Para no pagar intereses: Bs\s?1\.040,00/.test(bcp) && /Pronto: vence el 5 dic \(en 7 días\)\. Tu extracto del 20 nov: lo que gastaste \(Bs\s?1\.000\) \+ seguros y mantenimiento \(Bs\s?40\)\. Lo de después del corte \(Bs\s?80\) va al pago siguiente\./.test(bcp), `con corte: lo del extracto del 20 nov (${bcp.slice(0, 90)}…)`);
  ok(/Debes Bs\s?1\.080,00/.test(await texto(p4, sel(BCP))), "lo que debes en total sí incluye la cena (Bs 1.080)");
  await p4.click(sel(BCP, "[data-tc-ver]"));
  await p4.waitForTimeout(450);
  const ext = await texto(p4, "#tcd-cuerpo");
  ok(/Vence el 5 dic \(en 7 días\) · extracto del 20 nov/.test(ext), "el detalle dice de qué extracto es");
  ok(/Gastos \(2\) Bs\s?1\.000 Super 10 nov · Otros Bs\s?600 Ropa 18 nov · Otros Bs\s?400/.test(ext), "los gastos del extracto (hasta el corte)");
  ok(/Seguros y mantenimiento Bs\s?40 Seguro Se anota al pagar Bs\s?40/.test(ext) && /Extracto anterior Bs\s?800 Ya pagaste −Bs\s?800 Pago de BCP 5 nov · Pago −Bs\s?800/.test(ext), "el seguro, el extracto anterior y su pago");
  ok(/Para no pagar intereses Bs\s?1\.040 Después del corte Bs\s?80 Cena 25 nov · Comida Bs\s?80 Va a tu próximo pago\./.test(ext), "total Bs 1.040; la cena, después del corte, va al próximo pago");
  await captura(p4, "tarjetas-corte-detalle-375.png");
  await p4.click("#tcd-sheet .budget-sheet-close");
  await p4.waitForTimeout(450);
  await p4.click(sel(BCP, "[data-tc-editar]"));
  await p4.waitForTimeout(550);
  ok((await p4.$eval('#tc-form [name="diaCorte"]', x => x.options[x.selectedIndex].text)) === "Día 20" && /fecha de corte/.test(await texto(p4, "#tc-corte-ayuda")), "en la tarjeta, «Día de corte: Día 20», con su explicación");
  await p4.$eval('#tc-form [name="diaCorte"]', el => el.scrollIntoView({ block: "center" }));
  await captura(p4, "tarjetas-corte-form-375.png");
  await p4.selectOption('#tc-form [name="diaCorte"]', "");
  await p4.click("#tc-guardar");
  await p4.waitForTimeout(650);
  const corteGuardado = () => p4.evaluate(() => window.__fakeStore.colMap("users/test/meta").get("finanzas_tarjetas").list[0].diaCorte);
  ok((await corteGuardado()) === null && /Para no pagar intereses: Bs\s?1\.120,00/.test(await texto(p4, sel(BCP, ".fin-tc-pago"))), "sin corte: todo lo que debes (Bs 1.080) + el seguro = Bs 1.120");
  await p4.click(sel(BCP, "[data-tc-editar]"));
  await p4.waitForTimeout(550);
  await p4.selectOption('#tc-form [name="diaCorte"]', "20");
  await p4.click("#tc-guardar");
  await p4.waitForTimeout(650);
  ok((await corteGuardado()) === 20 && /Bs\s?1\.040,00/.test(await texto(p4, sel(BCP, ".fin-tc-pago"))), "con el corte otra vez (día 20): Bs 1.040");
  await sinAviso(p4);
  await p4.click(sel(BCP, "[data-tc-pagar]"));
  await p4.waitForTimeout(550);
  ok((await texto(p4, "#txn-sheet-amount")) === "1.040" && /Sumar seguros y mantenimiento · Bs\s?40/.test(await texto(p4, "#txn-sheet-cargos-row")), "«Pagar todo»: Bs 1.040, con el seguro");
  await p4.click("#txn-sheet-save");
  await p4.waitForTimeout(750);
  const seg4 = (await movs(p4)).find(m => m.cargoId === "seg");
  ok(seg4 && seg4.date === "2026-11-20" && seg4.cargoCiclo === "2026-12-05" && seg4.amount === 40, "el seguro se anota con la fecha del corte (20 nov), como en tu extracto");
  const alDia4 = await texto(p4, sel(BCP, ".fin-tc-pago"));
  ok(/Este mes ya pagaste todo/.test(alDia4) && /Lo de después del corte \(Bs\s?80\) va a tu próximo pago\./.test(alDia4), "queda al día; la cena va a tu próximo pago");
  ok(!p4.errores.length, "sin errores con el día de corte");

  console.log("\nCalidad a 375 px");
  await ir(p, "#fin-tarjetas");
  await sinAviso(p);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "sin moverse de lado");
  const chicos = await p.$$eval("#fin-tarjetas button", els => els.filter(e => e.offsetParent).map(e => ({ t: e.textContent.trim().slice(0, 25), h: e.getBoundingClientRect().height })).filter(x => x.h < 44));
  ok(!chicos.length, `botones de 44 px o más${chicos.length ? `: ${JSON.stringify(chicos)}` : ""}`);
  const malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `Tarjetas se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await p.$eval(sel(VISA), el => el.scrollIntoView({ block: "start" }));
  await captura(p, "tarjetas-cargos-al-dia-375.png");
  const nombreCabe = await (async () => {
    await p.click(sel(VISA, "[data-tc-editar]"));
    await p.waitForTimeout(500);
    const r = await p.$eval('#tc-form [name="cargoNombre0"]', i => i.scrollWidth <= i.clientWidth + 1) && (await p.$eval('#tc-form [name="cargoMonto0"]', i => i.value)) === "25,50";
    await p.click("#tc-sheet .budget-sheet-close");
    await p.waitForTimeout(400);
    return r;
  })();
  ok(nombreCabe, "al editar: «Seguro de desgravamen» se lee entero y el monto dice 25,50");

  console.log("\nEn claro");
  const p3 = await abrir(browser, base, { __SEED__: SEED2 }, { hash: "#fin-tarjetas", zona: ZONA, fecha: HOY, ancho: 375, alto: 812, esquema: "light" });
  await p3.waitForTimeout(1200);
  let claro = await p3.evaluate(auditarContraste);
  ok(!claro.length, `Tarjetas en claro se lee bien${claro.length ? `: ${claro.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await captura(p3, "tarjetas-cargos-claro-375.png");
  await p3.click(sel(VISA, "[data-tc-pagar]"));
  await p3.waitForTimeout(500);
  claro = await p3.evaluate(auditarContraste);
  ok(!claro.length, `la hoja de pago en claro se lee bien${claro.length ? `: ${claro.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await p3.click("#txn-sheet .budget-sheet-close");
  await p3.waitForTimeout(400);
  await p3.click(sel(VISA, "[data-tc-editar]"));
  await p3.waitForTimeout(500);
  claro = await p3.evaluate(auditarContraste);
  ok(!claro.length, `el formulario en claro se lee bien${claro.length ? `: ${claro.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await p3.$eval("#tc-form .fin-tc-cargos", el => el.scrollIntoView({ block: "center" }));
  await captura(p3, "tarjetas-cargos-form-claro-375.png");
  await p3.click("#tc-sheet .budget-sheet-close");
  await p3.waitForTimeout(450);
  await p3.click(sel(VISA, "[data-tc-ver]"));
  await p3.waitForTimeout(500);
  claro = await p3.evaluate(auditarContraste);
  ok(!claro.length, `el detalle en claro se lee bien${claro.length ? `: ${claro.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await captura(p3, "tarjetas-detalle-claro-375.png");
  ok(!consola.length && !p.errores.length && !p2.errores.length && !p3.errores.length, `sin errores ni advertencias${consola.length ? ` (${consola[0]})` : ""}`);
  await terminar(browser, srv);
})();
