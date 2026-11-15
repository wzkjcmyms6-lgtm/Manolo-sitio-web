// Biblia: "Leí en mi Biblia" (D-122), marcar lo leído en papel sin abrir el lector, a 375 px.
// Uso: node scripts/e2e/biblia-marcar.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const HOY = "2026-11-15";
const texto = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const leidos = p => p.evaluate(() => { const d = window.__fakeStore.colMap("users/test/meta").get("biblia_leidos"); return (d && d.dias) || {}; });
const abierta = p => p.$eval(".bmk-hoja", el => !el.hidden && !el.classList.contains("is-closing")).catch(() => false);
const base0 = { "users/test/meta": { biblia_leidos: { dias: { "2026-11-13": ["Gen.1", "Gen.2"], "2026-11-14": ["Gen.3"] } } } };

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: base0 }, { hash: "#biblia", zona: ZONA, fecha: `${HOY}T07:00:00-04:00`, ancho: 375, alto: 812 });
  const consola = [];
  p.on("console", m => { if ((m.type() === "error" || m.type() === "warning") && !/Failed to load resource|net::ERR/.test(m.text())) consola.push(`${m.type()}: ${m.text()}`); });
  await p.waitForTimeout(1300);

  console.log("\nUn toque: «Leí Génesis 4»");
  ok(await p.isVisible("#bib-resumen .bmk") && /Leí en mi Biblia/.test(await texto(p, "#bmk-t")), "la tarjeta «Leí en mi Biblia» está arriba de Biblia");
  ok(await p.$eval("#bib-resumen", el => { const a = el.querySelector(".bmk"), b = el.querySelector(".bbl-entrar"); return !!a && !!b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) > 0; }), "va antes que «Seguir leyendo» (el lector queda para cuando no tienes tu Biblia)");
  ok(/✓ Leí Génesis 4/.test(await texto(p, "#bib-resumen [data-bmk-marcar]")), "sugiere el que sigue al último que marcaste (Génesis 4)");
  await captura(p, "biblia-marcar-375.png");
  await p.click("#bib-resumen [data-bmk-marcar]");
  await p.waitForTimeout(500);
  ok(((await leidos(p))[HOY] || []).includes("Gen.4"), "queda marcado como leído hoy (sin abrir el lector)");
  ok(/Hoy marcaste: Génesis 4\./.test(await texto(p, "#bib-resumen .bmk-ayuda")) && /✓ Leí Génesis 5/.test(await texto(p, "#bib-resumen [data-bmk-marcar]")), "dice lo de hoy y ya ofrece el siguiente (Génesis 5)");
  ok(/Marcaste Génesis 4 como leído/.test(await texto(p, "#bmk-toast")) && await p.isVisible("#bmk-toast .undo-toast-btn"), "aviso con «Deshacer»");
  ok(/Hoy ya leíste la Biblia/.test(await texto(p, "#bib-resumen")), "cuenta para la racha de hoy");
  await p.click("#bib-resumen [data-bmk-marcar]");
  await p.waitForTimeout(400);
  ok(/Hoy marcaste: Génesis 4–5\./.test(await texto(p, "#bib-resumen .bmk-ayuda")), "otro toque: Génesis 4–5");
  await p.click("#bmk-toast .undo-toast-btn");
  await p.waitForTimeout(500);
  const hoy1 = (await leidos(p))[HOY] || [];
  ok(hoy1.includes("Gen.4") && !hoy1.includes("Gen.5"), "«Deshacer» quita solo el último (Génesis 5)");

  console.log("\nElegir otros capítulos (tocar números)");
  await p.click('#bib-resumen [data-bmk="elegir"]');
  await p.waitForTimeout(450);
  ok(await abierta(p) && /Hace poco/i.test(await texto(p, ".bmk-hoja")) && /Génesis 4\/50/.test(await texto(p, ".bmk-hoja .bmk-lista")), "hoja con los libros (recientes arriba, con lo leído)");
  await p.fill(".bmk-hoja .bmk-buscar", "salm");
  await p.waitForTimeout(250);
  ok((await p.$$(".bmk-hoja [data-bmk-libro]")).length === 1, "el buscador encuentra Salmos");
  await p.click('.bmk-hoja [data-bmk-libro="Ps"]');
  await p.waitForTimeout(400);
  ok((await p.$$(".bmk-hoja [data-bmk-cap]")).length === 150 && /0 de 150 leídos/.test(await texto(p, ".bmk-hoja .bmk-cuenta")), "los 150 salmos para tocar");
  await p.click('.bmk-hoja [data-bmk-cap="Ps.23"]');
  await p.waitForTimeout(400);
  ok(((await leidos(p))[HOY] || []).includes("Ps.23") && await p.$eval('.bmk-hoja [data-bmk-cap="Ps.23"]', b => b.classList.contains("is-hoy") && b.getAttribute("aria-pressed") === "true"), "tocar el 23 lo marca (✓ y verde)");
  ok(/1 de 150 leídos · hoy: Salmos 23/.test(await texto(p, ".bmk-hoja .bmk-cuenta")), "la cuenta se actualiza");
  await p.click('.bmk-hoja [data-bmk-cap="Ps.23"]');
  await p.waitForTimeout(400);
  ok(!((await leidos(p))[HOY] || []).includes("Ps.23"), "tocarlo otra vez lo quita");
  for (const c of [1, 2, 3]) { await p.click(`.bmk-hoja [data-bmk-cap="Ps.${c}"]`); await p.waitForTimeout(150); }
  await p.waitForTimeout(300);
  const hoy2 = (await leidos(p))[HOY] || [];
  ok(["Ps.1", "Ps.2", "Ps.3"].every(k => hoy2.includes(k)), "tres toques: Salmos 1, 2 y 3 leídos hoy");
  const chicos = await p.$$eval(".bmk-hoja button", els => els.filter(e => e.offsetParent).map(e => ({ t: (e.getAttribute("aria-label") || e.textContent).trim().slice(0, 20), h: e.getBoundingClientRect().height })).filter(x => x.h < 44));
  ok(!chicos.length, `botones de 44 px o más${chicos.length ? `: ${JSON.stringify(chicos.slice(0, 3))}` : ""}`);
  await captura(p, "biblia-marcar-salmos-375.png");
  await p.click('.bmk-hoja [data-bmk="libros"]');
  await p.waitForTimeout(350);
  ok(/Salmos 3\/150/.test(await texto(p, ".bmk-hoja .bmk-lista")), "«‹ Libros» vuelve a la lista (Salmos 3/150)");
  await p.click('.bmk-hoja [data-bmk-libro="Ps"]');
  await p.waitForTimeout(300);
  await p.click('.bmk-hoja [data-bmk="listo"]');
  await p.waitForTimeout(350);
  ok(!(await abierta(p)), "«Listo» cierra");
  ok(/Hoy marcaste: Génesis 4, Salmos 1–3\./.test(await texto(p, "#bib-resumen .bmk-ayuda")), "arriba: «Hoy marcaste: Génesis 4, Salmos 1–3»");

  console.log("\nDesde Progreso");
  await p.evaluate(() => { location.hash = "#biblia-progreso"; });
  await p.waitForTimeout(700);
  ok(/Toca un libro para marcar/.test(await texto(p, "#bpr-app")), "Progreso explica que se toca un libro para marcar");
  await p.click('[data-bpr-libro="Gen"]');
  await p.waitForTimeout(450);
  ok(await abierta(p) && /Leer Génesis en la app/.test(await texto(p, ".bmk-hoja")), "un libro abre la misma hoja, con «Leer Génesis en la app»");
  await p.click('.bmk-hoja [data-bmk-cap="Gen.6"]');
  await p.waitForTimeout(450);
  ok(/Génesis 5\/50|Génesis\s*5\/50/.test(await texto(p, "#bpr-app")) || /5\/50/.test(await texto(p, '[data-bpr-libro="Gen"]')), "el mapa de Progreso se actualiza (5/50)");
  await p.click('.bmk-hoja [data-bmk="leer"]');
  await p.waitForTimeout(900);
  ok(await p.evaluate(() => { const l = window.BibliaLector.lugar(); return !!l && l.libro === "Gen" && l.cap === 5; }), "«Leer en la app» abre el lector en el primer capítulo sin leer (Génesis 5)");
  ok(!consola.length && !p.errores.length, `sin errores ni advertencias${consola.length ? ` (${consola[0]})` : ""}`);
  await p.context().close();

  console.log("\nCon un plan: todo lo de hoy de un toque");
  const conPlan = { "users/test/meta": { biblia_planes: { planes: { p1: { tipo: "evangelios30", inicio: HOY, activo: true, creado: 1 } } } } };
  const q = await abrir(browser, base, { __SEED__: conPlan }, { hash: "#biblia", zona: ZONA, fecha: `${HOY}T07:00:00-04:00`, ancho: 375, alto: 812 });
  await q.waitForTimeout(1300);
  const boton = await texto(q, "#bib-resumen [data-bmk-marcar]");
  const claves = await q.$eval("#bib-resumen [data-bmk-marcar]", b => b.dataset.bmkMarcar.split(","));
  ok(/✓ Ya leí lo de hoy: Mateo 1–\d/.test(boton) && claves.length >= 2 && claves[0] === "Matt.1", `con plan: «${boton}»`);
  await q.click("#bib-resumen [data-bmk-marcar]");
  await q.waitForTimeout(600);
  const hoyPlan = (await leidos(q))[HOY] || [];
  ok(claves.every(k => hoyPlan.includes(k)) && /La lectura de hoy está hecha/.test(await texto(q, "#bib-resumen")), `un toque marca los ${claves.length} capítulos y el plan queda hecho hoy`);
  ok(!q.errores.length, "sin errores de página");
  await q.context().close();
  await terminar(browser, srv);
})();
