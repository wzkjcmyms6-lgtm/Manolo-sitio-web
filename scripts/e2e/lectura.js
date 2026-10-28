// Pruebas de pantalla de Libros y Biblia (sub-paneles de Inicio).
// Uso: node scripts/e2e/lectura.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const HOY = "2026-10-29T08:00:00-04:00";
const visible = (p, sel) => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && el.offsetParent !== null; }, sel);
const sobra = (p, sel) => p.$eval(sel, el => el.scrollWidth - el.clientWidth);

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, {}, { hash: "#inicio", zona: ZONA, fecha: HOY });

  console.log("\nFase 1: tarjetas en Inicio y secciones");
  const tarjetas = await p.$$eval("#panel-inicio .card-grid-home > a.card", els => els.map(a => a.getAttribute("href")));
  ok(tarjetas.slice(-4).join(",") === "#finanzas,#inversiones,#libros,#biblia", `Libros y Biblia van después de Finanzas e Inversiones (${tarjetas.join(" ")})`);
  ok(await p.$eval('#panel-inicio a[href="#libros"] .icon svg', () => true).catch(() => false), "la tarjeta Libros tiene su ícono");
  ok(await p.$eval('#panel-inicio a[href="#biblia"] .icon svg', () => true).catch(() => false), "la tarjeta Biblia tiene su ícono");
  const fuera = await p.$$eval('a[href="#libros"], a[href="#biblia"], [data-hash="libros"], [data-hash="biblia"]', els => els.filter(e => !e.closest(".card-grid-home")).length);
  ok(fuera === 0, "no aparecen en la barra inferior, el menú ni otro lugar");
  ok((await sobra(p, "html")) <= 0, "Inicio no se mueve de lado a 390 px");
  await captura(p, "lectura-inicio.png");

  await p.click('#panel-inicio a[href="#libros"]');
  await p.waitForTimeout(300);
  ok(await visible(p, "#panel-libros") && !(await visible(p, "#panel-inicio")), "la tarjeta abre Libros");
  ok(await p.$eval('[data-nav-link].active', a => a.dataset.hash).catch(() => "") === "inicio", "en Libros, la navegación resalta Inicio");
  ok(await visible(p, "#panel-libros .lib-volver") && /Inicio/.test(await p.textContent("#panel-libros .lib-volver")), "botón visible para volver a Inicio");
  await captura(p, "lectura-libros-vacio.png");
  await p.click("#panel-libros .lib-volver");
  await p.waitForTimeout(300);
  ok(await visible(p, "#panel-inicio") && !(await visible(p, "#panel-libros")), "el botón vuelve a Inicio");

  await p.click('#panel-inicio a[href="#biblia"]');
  await p.waitForTimeout(300);
  ok(await visible(p, "#panel-biblia"), "la tarjeta abre Biblia");
  await p.goBack();
  await p.waitForTimeout(300);
  ok(await visible(p, "#panel-inicio") && !(await visible(p, "#panel-biblia")), "atrás del navegador vuelve a Inicio");
  await p.goForward();
  await p.waitForTimeout(300);
  ok(await visible(p, "#panel-biblia"), "y adelante vuelve a Biblia");
  ok((await sobra(p, "html")) <= 0, "Biblia no se mueve de lado a 390 px");

  await p.setViewportSize({ width: 1280, height: 900 });
  await p.evaluate(() => { location.hash = "inicio"; });
  await p.waitForTimeout(300);
  const filas = await p.$$eval('#panel-inicio a[href="#inversiones"], #panel-inicio a[href="#libros"]', els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  ok(filas[1] > filas[0], "en la compu, Libros queda debajo de Inversiones");
  ok((await sobra(p, "html")) <= 0, "sin desborde a 1280 px");
  ok(!p.errores.length, "sin errores de página");

  await p.context().close();
  await terminar(browser, srv);
})();
