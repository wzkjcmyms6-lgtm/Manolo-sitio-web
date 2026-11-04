// Pruebas de pantalla de Running › Actividades (fase 3): barra propia con el
// "+" al centro, tarjetas (cifras es-BO, trazo, medallas, etiquetas),
// separadores por mes, filtros, carga de a 20, abrir el detalle, estado
// vacío, hoja del "+" (Importar · Anotar a mano · Rutina guiada), sugerencia
// de estirar, tarjeta de Inicio, Segmentos vacío y pills en la computadora.
// Uso: node scripts/e2e/run-feed.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");
const X = require("../../tests/run-fixtures.js");
const F = require("../../js/run-formatos.js");
const M = require("../../js/run-metricas.js");
const G = require("../../js/run-guardar.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const t = s => Date.parse(s);
function imp(id, ps, extra) {
  const { campos } = M.calcular(F.leer(X.fit(ps), "x.fit"), { fcMax: 190 });
  return G.documento(Object.assign({ deporte: "running", origen: { idExterno: id }, campos }, extra), 1);
}
const RUN = {
  imp_a: Object.assign(imp("a", X.puntos({ segundos: 3000, vel: 3.3, inicio: t("2026-11-03T06:42:00-04:00") }), { titulo: "Fondo por el Prado" }), { lugar: "Sopocachi, La Paz" }),
  imp_b: imp("b", X.puntos({ segundos: 1700, vel: 3.0, inicio: t("2026-10-20T07:00:00-04:00") }), { titulo: "10K Ciudad", subtipo: "competencia" }),
  m1: { date: "2026-10-30", distance: 5, duration: 27, rpe: 7, notes: "Con viento" },
  r1: { fuente: "rutina", date: "2026-10-28", distance: 0, duration: 24, inicio: t("2026-10-28T18:00:00-04:00"), fin: t("2026-10-28T18:30:00-04:00"), rutina: { id: "x", nombre: "Plan 5K · Día 2", completados: 6, total: 6 } }
};
// Muchas carreras a mano para la carga de a 20.
const MUCHAS = {};
for (let i = 0; i < 45; i++) { const d = new Date(2026, 9, 31 - i); MUCHAS[`v${i}`] = { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, distance: 5 + i / 10, duration: 30 }; }

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  let p = await abrir(browser, base, { __SEED__: { "users/test/running": RUN } }, { hash: "#running", zona: ZONA, fecha: "2026-11-04T09:00:00-04:00" });
  const tx = sel => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim());
  const vis = sel => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && getComputedStyle(el).display !== "none"; }, sel);
  const tarjetas = () => p.$$eval("#rf-feed .rf-card", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));

  console.log("\nBarra propia de Running");
  const barra = await p.$$eval("#bottom-nav-links > *:not(.tab-glass)", els => els.map(e => e.getAttribute("aria-label") || e.textContent.trim()));
  ok(barra.join("|") === "Actividades|Progreso|Agregar|Segmentos|Rutinas", `Actividades · Progreso · + · Segmentos · Rutinas (${barra.join("|")})`);
  ok(await p.$eval("#bottom-nav-links .tab-accion", b => b.tagName === "BUTTON"), "el «+» del centro es un botón, no una pestaña");
  ok(await p.$eval('#bottom-nav-links a[data-hash="running"]', a => a.classList.contains("active")), "Actividades resaltada");
  ok(await p.evaluate(() => document.body.classList.contains("has-home-btn")), "arriba, la casita para volver a Inicio");
  ok(await p.$eval("#verse-banner", el => el.hidden), "sin versículo");

  console.log("Tarjetas");
  const ts = await tarjetas();
  ok(ts.length === 4, `4 tarjetas (${ts.length})`);
  ok(/^Fondo por el Prado mar 3 nov · 06:42 · Sopocachi, La Paz Distancia 9,90 km Ritmo 5:03 \/km Tiempo 50:00/.test(ts[0]), `la más reciente arriba, con fecha, lugar y cifras (${ts[0].slice(0, 110)})`);
  ok(await p.$("#rf-feed article.rf-card:first-of-type .rf-mapa svg.run-ruta") !== null, "con el trazo de la ruta");
  ok(/🥇 400 m/.test(ts[0]) && /\+3/.test(ts[0]), "medallas de sus mejores marcas (+3 más)");
  ok(ts.some(x => /^Carrera al mediodía vie 30 oct Distancia 5,00 km Ritmo 5:24 \/km Tiempo 27:00 A mano$/.test(x)), "la anotada a mano, con su etiqueta");
  ok(ts.some(x => /^Plan 5K · Día 2 .* Tiempo 24:00 Rutina$/.test(x)), "la rutina sin km: solo tiempo y «Rutina»");
  ok(ts.some(x => /10K Ciudad/.test(x) && /Competencia/.test(x)), "la competencia con su etiqueta");
  const meses = await p.$$eval(".rf-mes", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  ok(meses.join(" | ") === "Noviembre de 2026 9,9 km · 1 carrera | Octubre de 2026 10,1 km · 3 carreras", `separadores por mes con km y cantidad (${meses.join(" | ")})`);
  await captura(p, "run-feed.png");

  console.log("Filtros");
  const filtrar = async k => { await p.click(`[data-rf-filtro="${k}"]`); await p.waitForTimeout(150); return (await tarjetas()).map(x => x.split(" ")[0]); };
  ok((await filtrar("mapa")).length === 2, "Con mapa: las 2 importadas");
  ok((await filtrar("rutinas")).join() === "Plan", "Rutinas: la rutina");
  ok((await filtrar("mano")).join() === "Carrera", "A mano: la anotada a mano");
  ok((await filtrar("competencia")).join() === "10K", "Competencias");
  ok((await filtrar("todas")).length === 4, "Todas");

  console.log("Abrir el detalle");
  await p.click("#rf-feed article.rf-card:first-of-type .rf-link");
  await p.waitForSelector(".rd-titulo");
  ok(/#run-actividad\/running\/imp_a$/.test(p.url()) && (await tx(".rd-titulo")) === "Fondo por el Prado", "tocar la tarjeta abre su detalle");
  ok(await p.$eval('#bottom-nav-links a[data-hash="running"]', a => a.classList.contains("active")), "la barra sigue en Actividades");
  await p.goBack();
  await p.waitForTimeout(300);

  console.log("Pestañas");
  await p.click('#bottom-nav-links a[data-hash="run-progreso"]');
  await p.waitForTimeout(300);
  ok(await vis("#panel-run-progreso") && await vis("#running-dash"), "Progreso con el resumen semanal de siempre");
  await p.click('#bottom-nav-links a[data-hash="run-segmentos"]');
  await p.waitForTimeout(300);
  ok(await vis("#panel-run-segmentos") && /Tus tramos favoritos/.test(await tx("#rs-app")), "Segmentos explica lo que viene");
  await p.click('#bottom-nav-links a[data-hash="run-rutinas"]');
  await p.waitForTimeout(300);
  ok(await vis("#running-rutinas") && /Después de correr/.test(await tx(".run-movilidad")), "Rutinas guiadas y el acceso a estirar");

  console.log("El «+»: anotar a mano");
  await p.click("#bottom-nav-links .tab-accion");
  await p.waitForTimeout(300);
  ok(await vis("#run-mas-hoja"), "abre la hoja Agregar");
  ok((await p.$$eval(".run-mas-op b", els => els.map(e => e.textContent))).join("|") === "Importar|Anotar a mano|Rutina guiada", "Importar · Anotar a mano · Rutina guiada");
  await captura(p, "run-mas.png");
  await p.click('[data-run-op="manual"]');
  await p.waitForTimeout(350);
  ok(await vis("#run-manual-hoja") && !(await vis("#run-mas-hoja")), "Anotar a mano abre su formulario");
  ok((await p.inputValue("#running-date")) === "2026-11-04", "con la fecha de hoy");
  await p.fill("#running-distance", "6.2");
  await p.fill("#running-duration", "33");
  await p.click("#running-form button[type=submit]");
  await p.waitForTimeout(500);
  ok(!(await vis("#run-manual-hoja")), "al registrar se cierra");
  const guardada = await p.evaluate(() => Array.from(window.__fakeStore.colMap("users/test/running").values()).find(d => d.distance === 6.2));
  ok(guardada && guardada.duration === 33 && guardada.date === "2026-11-04", "se guarda como siempre (fecha, km, minutos)");
  ok(await vis("#panel-run-rutinas [data-run-estirar]") && /¿Estiramos\?/.test(await tx("#panel-run-rutinas [data-run-estirar]")), "sugiere estirar (Movilidad › Después de correr)");
  await p.click('#bottom-nav-links a[data-hash="running"]');
  await p.waitForTimeout(300);
  ok((await tarjetas()).length === 5 && /6,20 km/.test((await tarjetas())[0]), "la nueva aparece arriba en Actividades");
  await p.click("#panel-running [data-run-estirar-x]");
  ok(!(await vis("#panel-running [data-run-estirar]")), "la sugerencia se puede ocultar");

  console.log("El «+»: importar y rutina guiada");
  await p.click("#bottom-nav-links .tab-accion");
  await p.waitForTimeout(250);
  await p.click('[data-run-op="importar"]');
  await p.waitForTimeout(300);
  ok(await vis("#ri-hoja") && !(await vis("#run-mas-hoja")), "Importar abre la hoja de importar");
  await p.click("#ri-hoja .budget-sheet-close");
  await p.waitForTimeout(300);
  await p.click("#bottom-nav-links .tab-accion");
  await p.waitForTimeout(250);
  await p.click('[data-run-op="rutina"]');
  await p.waitForTimeout(350);
  ok(/#run-rutinas$/.test(p.url()) && !(await vis("#run-mas-hoja")), "Rutina guiada lleva a Rutinas");

  console.log("Inicio");
  await p.evaluate(() => { location.hash = "inicio"; });
  await p.waitForTimeout(300);
  ok((await tx("#run-inicio")) === "Esta semana: 16,1 km. Última: Carrera al mediodía, 6,20 km.", `la tarjeta de Running resume la semana y la última (${await tx("#run-inicio")})`);
  ok(!(await p.evaluate(() => document.body.classList.contains("has-home-btn"))), "en Inicio vuelve la barra general");
  ok(p.errores.length === 0, "sin errores en la página");
  const anchoTel = await p.evaluate(() => document.documentElement.scrollWidth);
  ok(anchoTel <= 390, `sin desborde horizontal (${anchoTel})`);
  await p.context().close();

  console.log("\nVacío y muchas carreras");
  p = await abrir(browser, base, { __SEED__: {} }, { hash: "#running", zona: ZONA, fecha: "2026-11-04T09:00:00-04:00" });
  ok(/Todavía no hay carreras/.test(await p.$eval("#rf-feed", el => el.innerText)) && await p.$("#rf-feed [data-ri-abrir]") !== null && await p.$('#rf-feed [data-run-op="manual"]') !== null, "sin carreras: invita a importar o anotar");
  ok(await p.$eval("#rf-filtros", el => el.hidden), "sin filtros");
  await captura(p, "run-feed-vacio.png");
  await p.context().close();
  p = await abrir(browser, base, { __SEED__: { "users/test/running": MUCHAS } }, { hash: "#running", zona: ZONA, fecha: "2026-11-04T09:00:00-04:00" });
  ok((await p.$$("#rf-feed .rf-card")).length === 20 && /Ver más \(25\)/.test(await p.$eval("[data-rf-mas]", b => b.textContent)), "45 carreras: primero 20 y «Ver más (25)»");
  await p.$eval("[data-rf-mas]", b => b.scrollIntoView());
  await p.waitForTimeout(600);
  ok((await p.$$("#rf-feed .rf-card")).length === 40, "al llegar al final se cargan 20 más solas");
  ok(p.errores.length === 0, "sin errores");
  await p.context().close();

  console.log("\nComputadora (1280 px)");
  p = await abrir(browser, base, { __SEED__: { "users/test/running": RUN } }, { hash: "#running", zona: ZONA, ancho: 1280, alto: 900, fecha: "2026-11-04T09:00:00-04:00" });
  const pills = await p.$$eval("#panel-running .fin-outer-tabs > *:not(.fin-tab-ajustes)", els => els.map(e => e.textContent.trim()));
  ok(await p.$('#panel-running .fin-outer-tabs a.fin-tab-ajustes[href="#run-ajustes"]') !== null, "y el engranaje de Ajustes");
  ok(pills.join("|") === "Actividades|Progreso|+ Agregar|Segmentos|Rutinas", `pestañas arriba en la compu (${pills.join("|")})`);
  await p.click("#panel-running .fin-tab-accion");
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.getElementById("run-mas-hoja").hidden), "«+ Agregar» abre la hoja");
  await p.click("#run-mas-hoja .budget-sheet-close");
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 1280), "sin desborde");
  await captura(p, "run-feed-1280.png");
  ok(p.errores.length === 0, "sin errores");
  await p.context().close();
  await terminar(browser, srv);
})();
