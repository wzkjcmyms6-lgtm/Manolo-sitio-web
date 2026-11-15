// Fallas de diseño de las capturas del dueño (2026-11-15, D-120), a 375 px:
// barra de abajo flotando cuando el iPhone deja la pantalla "corrida",
// campos con letra chica (hacen que el iPhone acerque), campos de hora que
// se salen de la tarjeta y nombres largos de libros cortados en cualquier letra.
// Uso: node scripts/e2e/pantalla.js
const { chromium, servidor, abrir, ok, terminar } = require("./comun.js");

const ZONA = "America/La_Paz";
const PANTALLAS = ["#inicio", "#habitos", "#finanzas", "#fin-presupuesto", "#fin-movimientos", "#fin-tarjetas", "#fin-ajustes", "#inversiones", "#ejercicio", "#running", "#libros", "#biblia", "#tiempos", "#lugares", "#movilidad"];
const caja = (p, sel) => p.$eval(sel, el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
// El iPhone, "corrido": la parte visible quedó 300 px más abajo de lo que usa para lo fijo.
const correr = (p, top) => p.evaluate(t => {
  const vv = window.visualViewport;
  Object.defineProperty(vv, "offsetTop", { configurable: true, get: () => t });
  Object.defineProperty(vv, "height", { configurable: true, get: () => window.innerHeight });
  vv.dispatchEvent(new Event("resize"));
}, top);

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, {}, { hash: "#inicio", zona: ZONA, fecha: "2026-11-15T13:00:00-04:00", ancho: 375, alto: 812 });
  const consola = [];
  p.on("console", m => { if ((m.type() === "error" || m.type() === "warning") && !/Failed to load resource|net::ERR/.test(m.text())) consola.push(`${m.type()}: ${m.text()}`); });
  await p.waitForTimeout(1200);

  console.log("\nPantalla corrida del iPhone (barra flotando)");
  const navAntes = await caja(p, "#bottom-nav-links");
  ok(!(await p.evaluate(() => document.documentElement.classList.contains("vv-corrida"))), "normalmente no se toca nada");
  await correr(p, 300);
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.documentElement.classList.contains("vv-corrida") && getComputedStyle(document.documentElement).getPropertyValue("--vv-abajo").trim() === "300px"), "detecta la pantalla corrida (300 px)");
  const navDespues = await caja(p, "#bottom-nav-links");
  ok(Math.round(navDespues.top - navAntes.top) === 300, `la barra de abajo baja a su lugar (${Math.round(navDespues.top - navAntes.top)} px)`);
  ok(await p.$eval(".topbar", el => getComputedStyle(el).translate === "0px 300px"), "la barra de arriba también vuelve");
  await p.click("#respaldo-abrir");
  await p.waitForTimeout(450);
  ok(await p.$eval(".rsp-hoja", el => { const s = getComputedStyle(el); return s.top === "300px" && s.bottom === "-300px"; }), "las hojas de abajo cubren lo visible");
  await p.click(".rsp-hoja .budget-sheet-close");
  await p.waitForTimeout(350);
  // Con un campo abierto (teclado), lo normal del iPhone: no se toca.
  await p.evaluate(() => { location.hash = "#lugares"; });
  await p.waitForTimeout(600);
  await p.focus("#lug-q");
  await p.waitForTimeout(500);
  ok(!(await p.evaluate(() => document.documentElement.classList.contains("vv-corrida"))), "mientras escribes no se mueve nada");
  await p.evaluate(() => document.activeElement.blur());
  await correr(p, 0);
  await p.waitForTimeout(1100);
  ok(!(await p.evaluate(() => document.documentElement.classList.contains("vv-corrida"))), "al volver a la normalidad, todo como siempre");

  console.log("\nCampos con letra de 16 px (si no, el iPhone acerca la pantalla)");
  const chicos = new Map();
  for (const h of PANTALLAS) {
    await p.evaluate(x => { location.hash = x; }, h);
    await p.waitForTimeout(500);
    (await p.$$eval("input, select, textarea", els => els
      .filter(e => !/^(checkbox|radio|range|button|submit|file|hidden|color)$/i.test(e.type || "") && parseFloat(getComputedStyle(e).fontSize) < 16)
      .map(e => `${e.id || e.name || e.className}: ${getComputedStyle(e).fontSize}`))).forEach(x => chicos.set(x, h));
  }
  ok(!chicos.size, `ningún campo con letra menor a 16 px${chicos.size ? ` (${[...chicos.keys()].slice(0, 5).join(", ")})` : ""}`);

  console.log("\nMedir tiempos: los campos de hora caben en la tarjeta");
  await p.evaluate(() => { location.hash = "#tiempos"; });
  await p.waitForTimeout(800);
  const tarjeta = await caja(p, "#tmp-plan");
  const listo = await caja(p, '#tmp-plan input[name="listo"]');
  const levanto = await caja(p, '#tmp-plan input[name="levantarse"]');
  ok(listo.right <= tarjeta.right - 8 && levanto.left >= tarjeta.left + 8, `«Me levanto» y «Listo a las» dentro de la tarjeta (${Math.round(listo.right)} ≤ ${Math.round(tarjeta.right - 8)})`);
  ok(await p.$eval('#tmp-plan input[name="listo"]', el => getComputedStyle(el).appearance === "none"), "sin el ancho propio del iPhone en los campos de hora");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "sin moverse de lado a 375 px");

  console.log("\nBiblia › Progreso: nombres largos");
  await p.evaluate(() => { location.hash = "#biblia-progreso"; });
  await p.waitForTimeout(800);
  ok(await p.$eval(".bpr-libro-n", el => { const s = getComputedStyle(el); return s.hyphens === "auto" && s.overflowWrap === "break-word"; }), "«Lamentaciones» se corta en sílabas, no en cualquier letra");
  ok(!consola.length && !p.errores.length, `sin errores ni advertencias${consola.length ? ` (${consola[0]})` : ""}`);
  await terminar(browser, srv);
})();
