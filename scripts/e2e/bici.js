// Pruebas de pantalla de Bici al nivel de Running (D-141, docs/CYCLING.md).
// Fase 5: Actividades (tarjetas con Distancia · Velocidad · Tiempo ·
// Desnivel, trazo, medallas de récords de bici, separadores por mes, carga
// de a 20, filtros), la barra propia con el "+" (Importar · Anotar a mano),
// la tarjeta de Inicio, el detalle de una rodada (medallas, resumen
// inteligente y mismo recorrido contra tus rodadas), Progreso con el
// resumen semanal, sin rodadas, 320 px y la compu.
// Uso: node scripts/e2e/bici.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");
const X = require("../../tests/run-fixtures.js");
const F = require("../../js/run-formatos.js");
const M = require("../../js/run-metricas.js");
const G = require("../../js/run-guardar.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const FECHA = "2026-11-18T09:00:00-04:00";   // miércoles
const t = s => Date.parse(s);
// Una rodada importada (con ruta): segundos a vel m/s, subiendo `subida` m.
function rodada(id, inicio, segundos, vel, extra) {
  const ps = X.puntos({ segundos, vel, subida: (extra && extra.subida) || 0, inicio: t(inicio) });
  const act = F.leer(X.fit(ps), "x.fit");
  act.deporte = "bicicleta";
  const r = M.calcular(act, { fcMax: 190 });
  const doc = G.documento({ deporte: "bicicleta", origen: { idExterno: id }, campos: r.campos, titulo: extra && extra.titulo }, 1);
  return { doc, ruta: r.ruta };
}
const A = rodada("a", "2026-11-03T07:00:00-04:00", 3600, 7, { titulo: "Subida a La Cumbre", subida: 650 });   // 25,2 km
const Bm = rodada("b", "2026-11-10T07:00:00-04:00", 3360, 7.5, { titulo: "Subida a La Cumbre" });             // mismo recorrido (25,2 km), más rápida
const C = rodada("c", "2026-10-20T07:00:00-04:00", 8200, 6.5, { titulo: "Fondo a Tiwanaku" });                // 53,3 km, más lenta
const SEED = {
  "users/test/bicicleta": {
    imp_a: A.doc, imp_b: Bm.doc, imp_c: C.doc,
    m1: { date: "2026-11-16", distance: 18, duration: 50, notes: "Al trabajo" },
    m2: { date: "2026-11-17", distance: 12.5, duration: 35, notes: "" }
  },
  "users/test/rutas": { imp_a: A.ruta, imp_b: Bm.ruta, imp_c: C.ruta }
};
// Muchas rodadas a mano para la carga de a 20.
const MUCHAS = {};
for (let i = 0; i < 26; i++) { const d = new Date(2026, 9, 31 - i); MUCHAS[`v${i}`] = { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, distance: 20 + i, duration: 60 }; }

const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const sobra = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

async function fase5(browser, base, ancho) {
  console.log(`\nBici, fase 5: Actividades (${ancho} px)`);
  let p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#bicicleta", zona: ZONA, fecha: FECHA, ancho });
  await p.waitForTimeout(600);
  const cards = await p.$$("#bf-feed .bf-card");
  ok(cards.length === 5, `una tarjeta por rodada (${cards.length})`);
  ok(/^Noviembre de 2026 [\d,]+ km · 4 rodadas$/.test(await txt(p, "#bf-feed .rf-mes")), `separador por mes (${await txt(p, "#bf-feed .rf-mes")})`);
  const primera = await txt(p, "#bf-feed .bf-card");
  ok(/Distancia 12,50 km/.test(primera) && /Velocidad 21,4 km\/h/.test(primera) && /Tiempo 35:00/.test(primera) && /A mano/.test(primera), `la más nueva primero, con su velocidad (${primera})`);
  const subida = await p.$eval('#bf-feed a[href="#run-actividad/bicicleta/imp_a"]', el => el.innerText.replace(/\s+/g, " ").trim());
  ok(/Subida a La Cumbre/.test(subida) && /Desnivel \d+ m/.test(subida) && /🥇 5 km/.test(subida) && await p.$('#bf-feed a[href="#run-actividad/bicicleta/imp_a"] svg') !== null, `importada: desnivel, medallas de bici y trazo (${subida})`);
  ok(/Larga/.test(await p.$eval('#bf-feed a[href="#run-actividad/bicicleta/imp_c"]', el => el.innerText)), "una de 50 km o más dice «Larga»");
  ok(await sobra(p) <= 0, "nada se sale a lo ancho");
  await captura(p, `bici-feed-${ancho}.png`);

  // Filtros.
  const filtros = (await p.$$eval("#bf-filtros [data-bf-filtro]", bs => bs.map(b => b.dataset.bfFiltro))).join(",");
  ok(filtros === "todas,mapa,mano,largas", `filtros: ${filtros}`);
  await p.click('[data-bf-filtro="mapa"]');
  ok((await p.$$("#bf-feed .bf-card")).length === 3, "Con mapa: las 3 importadas");
  await p.click('[data-bf-filtro="mano"]');
  ok((await p.$$("#bf-feed .bf-card")).length === 2, "A mano: 2");
  await p.click('[data-bf-filtro="largas"]');
  ok((await p.$$("#bf-feed .bf-card")).length === 1 && /Fondo a Tiwanaku/.test(await txt(p, "#bf-feed")), "Largas: la de 53 km");
  await p.click('[data-bf-filtro="todas"]');

  // La barra propia: Actividades · + · Progreso.
  if (ancho <= 768) {
    const barra = await p.$$eval("#bottom-nav-links > a, #bottom-nav-links > button", els => els.map(e => e.getAttribute("aria-label") || e.textContent.trim()));
    ok(barra.join(",") === "Actividades,Agregar,Progreso", `barra propia (${barra.join(", ")})`);
    await p.click("#bottom-nav-links .tab-accion");
    await p.waitForTimeout(300);
    ok(await p.isVisible("#bici-mas-hoja") && /Importar/.test(await txt(p, "#bici-mas-hoja")) && /Anotar a mano/.test(await txt(p, "#bici-mas-hoja")), "el «+» ofrece Importar y Anotar a mano");
    await p.click('[data-bici-op="manual"]');
    await p.waitForTimeout(350);
    ok(await p.isVisible("#bici-manual-hoja") && !(await p.isVisible("#bici-mas-hoja")), "Anotar a mano abre el formulario");
    await p.fill("#cycling-distance", "30");
    await p.fill("#cycling-duration", "75");
    await p.click("#cycling-form button[type=submit]");
    await p.waitForTimeout(500);
    ok(!(await p.isVisible("#bici-manual-hoja")) && (await p.$$("#bf-feed .bf-card")).length === 6, "al registrar se cierra y aparece en el feed");
    ok(/Distancia 30,00 km/.test(await txt(p, "#bf-feed .bf-card")) && /Velocidad 24,0 km\/h/.test(await txt(p, "#bf-feed .bf-card")), "la nueva, primera (es de hoy)");
  }

  // Inicio: la tarjeta de Bici.
  await p.evaluate(() => { location.hash = "#inicio"; });
  await p.waitForTimeout(300);
  const ini = await txt(p, "#bici-inicio");
  ok(/^Esta semana: [\d,]+ km\. Última: .+, [\d,]+ km\.$/.test(ini), `Inicio: los km de la semana y la última (${ini})`);

  // El detalle de una rodada: medallas, resumen y mismo recorrido contra tus rodadas.
  await p.evaluate(() => { location.hash = "#run-actividad/bicicleta/imp_b"; });
  await p.waitForTimeout(900);
  const det = await txt(p, "#rd-app");
  ok(/Logros/.test(det) && /🥇/.test(det) && /5 km/.test(det), "el detalle muestra los récords de bici");
  ok(/Resumen inteligente/.test(det) && /Récord(s)? de bici/.test(det), `resumen inteligente de bici (${(det.match(/Resumen inteligente.{0,160}/) || [""])[0]})`);
  ok(/Mismo recorrido 2 veces/.test(det) && /Esta rodada/.test(det) && /km\/h/.test(await txt(p, ".rd-recorrido")), "mismo recorrido contra tus rodadas, con la velocidad");
  ok(await p.$('.rd-recorrido a[href="#run-actividad/bicicleta/imp_a"]') !== null, "y lleva a la otra rodada");
  if (ancho <= 768) {
    const barra = await p.$$eval("#bottom-nav-links > a, #bottom-nav-links > button", els => els.map(e => e.getAttribute("aria-label") || e.textContent.trim()));
    ok(barra.join(",") === "Actividades,Agregar,Progreso" && !(await p.isVisible('.topbar-ajustes[data-engranaje="running"]')), `en el detalle sigue la barra de Bici (${barra.join(", ")})`);
  }
  await captura(p, `bici-detalle-${ancho}.png`);

  // Progreso: el resumen semanal de siempre.
  await p.evaluate(() => { location.hash = "#bici-progreso"; });
  await p.waitForTimeout(400);
  ok(await p.isVisible("#cycling-dash") && /km/.test(await txt(p, '#cycling-dash [data-dash-metrica="km"] strong')), "Progreso: el resumen semanal");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();

  // Muchas rodadas: de a 20 y «Ver más».
  p = await abrir(browser, base, { __SEED__: { "users/test/bicicleta": MUCHAS } }, { hash: "#bicicleta", zona: ZONA, fecha: FECHA, ancho });
  await p.waitForTimeout(500);
  ok((await p.$$("#bf-feed .bf-card")).length === 20 && /Ver más \(6\)/.test(await txt(p, "[data-bf-mas]")), "26 rodadas: primero 20 y «Ver más (6)»");
  await p.waitForFunction(() => {
    if (document.querySelectorAll("#bf-feed .bf-card").length >= 26) return true;
    const b = document.querySelector("[data-bf-mas]");
    if (b) b.scrollIntoView();
    return false;
  }, null, { timeout: 5000, polling: 250 }).catch(() => {});
  ok((await p.$$("#bf-feed .bf-card")).length === 26, "al llegar al final se cargan las que faltan");
  await p.context().close();

  // Sin rodadas.
  p = await abrir(browser, base, { __SEED__: {} }, { hash: "#bicicleta", zona: ZONA, fecha: FECHA, ancho });
  await p.waitForTimeout(500);
  ok(/Todavía no hay rodadas/.test(await txt(p, "#bf-feed")) && await p.$("#bf-feed [data-ri-abrir]") !== null && await p.$('#bf-feed [data-bici-op="manual"]') !== null, "sin rodadas: invita a importar o anotar");
  ok(await p.$eval("#bf-filtros", el => el.hidden), "sin filtros");
  await p.evaluate(() => { location.hash = "#inicio"; });
  await p.waitForTimeout(300);
  ok((await txt(p, "#bici-inicio")) === "Tus rodadas, mapas, velocidad y récords.", "Inicio sin rodadas");
  await p.context().close();
}

async function compu(browser, base) {
  console.log("\nBici en la compu (1280 px)");
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#bicicleta", zona: ZONA, fecha: FECHA, ancho: 1280, alto: 900 });
  await p.waitForTimeout(600);
  const pills = await p.$$eval("#panel-bicicleta .fin-outer-tabs a, #panel-bicicleta .fin-outer-tabs button", els => els.map(e => e.textContent.trim()));
  ok(pills.join(",") === "Actividades,+ Agregar,Progreso", `las secciones como pills arriba (${pills.join(", ")})`);
  ok(await sobra(p) <= 0, "nada se sale a lo ancho");
  const fila = await p.$eval("#bf-feed .bf-card .bf-cifras", el => { const r = [...el.children].map(c => Math.round(c.getBoundingClientRect().top)); return new Set(r).size; });
  ok(fila === 1, "las cifras en una fila");
  await captura(p, "bici-feed-1280.png");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  for (const ancho of [390, 320]) await fase5(browser, base, ancho);
  await compu(browser, base);
  await terminar(browser, srv);
})();
