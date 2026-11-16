// Pruebas de pantalla de Bici al nivel de Running (D-141, docs/CYCLING.md).
// Fase 5: Actividades (tarjetas con Distancia · Velocidad · Tiempo ·
// Desnivel, trazo, medallas de récords de bici, separadores por mes, carga
// de a 20, filtros), la barra propia con el "+" (Importar · Anotar a mano),
// la tarjeta de Inicio, el detalle de una rodada (medallas, resumen
// inteligente y mismo recorrido contra tus rodadas), Progreso con el
// resumen semanal, sin rodadas, 320 px y la compu.
// Fase 6: Progreso (totales con la velocidad, racha, metas, diario, récords
// sueltos y mejores tiempos con su evolución, Eddington, los récords de una
// rodada vieja calculados con su ruta, mapa de calor) y Ajustes de Bici.
// Fase 7: tus bicis (agregar, predeterminada, ponerla en las rodadas sin
// bici, en cada rodada con Editar, al anotar a mano, retirar), el
// mantenimiento (aviso arriba del feed, «Hecho hoy», cada cuánto) y los
// segmentos de bici (crear desde una rodada, buscarlo en tus rodadas, su
// página con la velocidad, la pestaña Segmentos de Bici y no en Running).
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
    ok(barra.join(",") === "Actividades,Progreso,Agregar,Segmentos,Bicis", `barra propia (${barra.join(", ")})`);
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
    ok(barra.join(",") === "Actividades,Progreso,Agregar,Segmentos,Bicis" && !(await p.isVisible('.topbar-ajustes[data-engranaje="running"]')), `en el detalle sigue la barra de Bici (${barra.join(", ")})`);
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

// ---- Fase 6: Progreso (D-142) ----
async function fase6(browser, base, ancho) {
  console.log(`\nBici, fase 6: Progreso (${ancho} px)`);
  // imp_a importada antes (sin récords de bici): se calculan con su ruta al abrir Bici.
  const viejo = JSON.parse(JSON.stringify(A.doc));
  delete viejo.mejoresBici;
  const seed = JSON.parse(JSON.stringify(SEED));
  seed["users/test/bicicleta"].imp_a = viejo;
  seed["users/test/meta"] = { bici_ajustes: { metas: { semanaKm: 100, mesKm: 300 } } };
  const p = await abrir(browser, base, { __SEED__: seed }, { hash: "#bici-progreso", zona: ZONA, fecha: FECHA, ancho });
  await p.waitForTimeout(900);
  const arriba = await txt(p, "#bp-arriba");
  ok(/Esta semana 30,5 km/.test(arriba) && /Rodadas 2/.test(arriba) && /Velocidad [\d,]+ km\/h/.test(arriba), `totales de la semana con la velocidad (${arriba})`);
  await p.click('[data-bp-periodo="mes"]');
  ok(/Este mes 80,9 km/.test(await txt(p, "#bp-arriba")) && /vs el mes pasado/.test(await txt(p, "#bp-arriba")), "el mes contra el anterior");
  const app = await txt(p, "#bp-app");
  ok(/🔥 \d+ semanas? seguidas?/.test(app), "la racha de semanas");
  ok(/30,5\/100 km Semana/.test(app) && /80,9\/300 km Mes/.test(app), `las metas con anillos (${(app.match(/[\d,]+\/\d+ km \w+/g) || []).join(" · ")})`);
  ok(/Diario/.test(app) && await p.$('#bp-app .rp-dia.is-con[href^="#run-actividad/bicicleta/"]') !== null, "el diario lleva a las rodadas");
  ok(/La más larga 53,3 km/.test(app) && /Velocidad máxima [\d,]+ km\/h/.test(app) && /La más rápida [\d,]+ km\/h/.test(app), "los récords sueltos");
  ok(/Número de Eddington 5 Saliste 5 días con al menos 5 km\./.test(app) && /Para llegar a 6: te falta 1 día de 6 km o más \(llevas 5\)/.test(app), `el número de Eddington (${(app.match(/Número de Eddington.{0,140}/) || [""])[0]})`);
  // La rodada vieja: sus récords se calculan con la ruta y se guardan.
  await p.waitForFunction(() => { const d = window.__fakeStore.colMap("users/test/bicicleta").get("imp_a"); return d && d.mejoresBici && d.mejoresBici["5000"] > 0; }, null, { timeout: 6000 }).catch(() => {});
  const mb = await p.evaluate(() => window.__fakeStore.colMap("users/test/bicicleta").get("imp_a").mejoresBici);
  ok(mb && mb["5000"] > 0 && mb["20000"] > 0 && !mb["50000"], `la rodada vieja ya tiene sus récords (${JSON.stringify(mb)})`);
  await p.waitForTimeout(400);
  const marcas = await p.$$eval("#bp-app [data-bp-marca]", bs => bs.map(b => b.dataset.bpMarca));
  ok(marcas.join(",") === "5000,10000,20000,30000,40000,50000", `mejores tiempos de 5 a 50 km (${marcas.join(", ")})`);
  await p.click('[data-bp-marca="5000"]');
  ok(/5 km: tus 3 mejores/.test(await txt(p, "#bp-app")) && (await p.$$("#bp-app .rp-top li")).length === 3, "el top 3 de 5 km");
  ok(await p.$("#bp-app .rp-evo") !== null, "y cómo fue mejorando");
  await captura(p, `bici-progreso-${ancho}.png`);
  // El mapa de calor de tus rodadas.
  await p.click('#bp-app a[href="#bici-calor"]');
  await p.waitForTimeout(400);
  ok(/3 rodadas con ruta/.test(await txt(p, "#bc-app")) && await p.$("#bc-app svg.rc-svg") !== null, "mapa de calor de tus rodadas");
  // Ajustes de Bici (el engranaje): cambiar las metas.
  await p.evaluate(() => { location.hash = "#bici-progreso"; });
  await p.waitForTimeout(300);
  if (ancho <= 768) {
    ok(await p.isVisible('.topbar-ajustes[data-engranaje="bicicleta"]') && !(await p.isVisible('.topbar-ajustes[data-engranaje="running"]')), "el engranaje de Bici arriba");
    await p.click('.topbar-ajustes[data-engranaje="bicicleta"]');
  } else await p.evaluate(() => { location.hash = "#bici-ajustes"; });
  await p.waitForTimeout(400);
  await p.fill('#ba-form [name="semanaKm"]', "120");
  await p.fill('#ba-form [name="anioKm"]', "3000");
  await p.click("#ba-form button[type=submit]");
  await p.waitForTimeout(400);
  const metas = await p.evaluate(() => window.__fakeStore.colMap("users/test/meta").get("bici_ajustes").metas);
  ok(metas.semanaKm === 120 && metas.mesKm === 300 && metas.anioKm === 3000 && /Metas guardadas/.test(await txt(p, "#ba-app")), `metas guardadas (${JSON.stringify(metas)})`);
  await p.fill('#ba-form [name="mesKm"]', "-3");
  await p.click("#ba-form button[type=submit]");
  ok(/Las metas son km mayores que 0/.test(await txt(p, "#ba-app")), "una meta mal escrita avisa");
  ok(await sobra(p) <= 0, "nada se sale a lo ancho");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// ---- Fase 7: tus bicis, mantenimiento y segmentos de bici (D-143) ----
async function fase7(browser, base, ancho) {
  console.log(`\nBici, fase 7: tus bicis y segmentos (${ancho} px)`);
  let p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#bici-bicis", zona: ZONA, fecha: FECHA, ancho });
  await p.waitForTimeout(600);
  ok(/Agrega tu bici/.test(await txt(p, "#bb-app")), "sin bicis: invita a agregar una");
  await p.click("[data-bb-nueva]");
  await p.fill('#bb-form [name="nombre"]', "Trek Domane");
  await p.selectOption('#bb-form [name="tipo"]', "ruta");
  await p.fill('#bb-form [name="kmInicial"]', "2950");
  await p.click("#bb-form button[type=submit]");
  await p.waitForTimeout(400);
  const aj = () => p.evaluate(() => window.__fakeStore.colMap("users/test/meta").get("bici_ajustes") || {});
  let a = await aj();
  ok(a.bicis && a.bicis.length === 1 && a.bicis[0].nombre === "Trek Domane" && a.bicis[0].predeterminada && a.bicis[0].kmInicial === 2950, "agregar una bici (la primera queda como predeterminada)");
  let card = await txt(p, "#bb-app .bb-bici");
  ok(/Trek Domane Predeterminada/.test(card) && /Ruta · 2\.950 km · 0 rodadas/.test(card), `la tarjeta de la bici (${card.slice(0, 90)})`);
  ok((await p.$$("#bb-app .bb-pieza")).length === 4 && /Cadena 0 de 3\.000 km/.test(card) && /Service general 0 de 5\.000 km · 0 de 180 días/.test(card), "el mantenimiento: 4 piezas desde hoy");
  // Ponerle la bici a las rodadas que no tienen.
  ok(/5 rodadas no tienen bici/.test(await txt(p, "#bb-app .bb-sin")), "las rodadas sin bici");
  await p.click("[data-bb-asignar]");
  await p.waitForTimeout(600);
  const sinBici = await p.evaluate(() => [...window.__fakeStore.colMap("users/test/bicicleta").values()].filter(d => d.biciId !== (window.__fakeStore.colMap("users/test/meta").get("bici_ajustes").bicis[0].id)).length);
  ok(sinBici === 0 && /Trek Domane .*3\.084 km · 5 rodadas/.test(await txt(p, "#bb-app .bb-bici")), `ponerle la bici a todas (${(await txt(p, "#bb-app .bb-bici")).slice(0, 80)})`);
  // La cadena ya tenía 3.000 km cuando la agregaste: toca cambiarla.
  const id = (await aj()).bicis[0].id;
  await p.evaluate(x => window.__fakeStore.colMap("users/test/meta").set("bici_ajustes", Object.assign({}, window.__fakeStore.colMap("users/test/meta").get("bici_ajustes"), { mantenimiento: { [x]: { cadena: { desdeKm: 0, desde: "2026-01-01" } } } })), id);
  await p.evaluate(() => window.__fakeStore.notify());
  await p.waitForTimeout(500);
  ok(/Toca cambiar la cadena: 3\.084 km/.test(await txt(p, "#bb-app")) && await p.$("#bb-app .bb-pieza.is-cambiar") !== null, "aviso: toca cambiar la cadena");
  await p.evaluate(() => { location.hash = "#bicicleta"; });
  await p.waitForTimeout(400);
  ok(await p.isVisible("#bf-aviso") && /Toca cambiar la cadena: 3\.084 km \(Trek Domane\)/.test(await txt(p, "#bf-aviso")), "y arriba del feed");
  await captura(p, `bici-aviso-${ancho}.png`);
  await p.click("#bf-aviso a");
  await p.waitForTimeout(400);
  await p.click('#bb-app .bb-pieza.is-cambiar [data-bb-hecho="cadena"]');
  await p.waitForTimeout(400);
  a = await aj();
  ok(a.mantenimiento[id].cadena.desdeKm === 3084.2 && a.mantenimiento[id].cadena.desde === "2026-11-18" && /vuelve a contar desde hoy/.test(await txt(p, "#bb-app")), `«Hecho hoy»: vuelve a contar (${JSON.stringify(a.mantenimiento[id].cadena)})`);
  ok(!(await p.$("#bb-app .bb-pieza.is-cambiar")), "ya no hay nada que cambiar");
  // Cada cuánto.
  await p.click("[data-bb-intervalos]");
  await p.fill('#bb-int-form [name="cadena-km"]', "3500");
  await p.click("#bb-int-form button[type=submit]");
  await p.waitForTimeout(400);
  a = await aj();
  ok(a.mantenimiento[id].cadena.cadaKm === 3500 && a.mantenimiento[id].cadena.desdeKm === 3084.2 && a.mantenimiento[id].service.cadaDias === 180, "cambiar cada cuánto (sin perder «Hecho hoy»)");
  await captura(p, `bici-bicis-${ancho}.png`);
  ok(await sobra(p) <= 0, "nada se sale a lo ancho");

  // Otra bici; en una rodada se elige con Editar.
  await p.click("[data-bb-nueva]");
  await p.fill('#bb-form [name="nombre"]', "La de montaña");
  await p.selectOption('#bb-form [name="tipo"]', "montana");
  await p.click("#bb-form button[type=submit]");
  await p.waitForTimeout(400);
  a = await aj();
  const id2 = a.bicis[1].id;
  ok(a.bicis.length === 2 && !a.bicis[1].predeterminada, "una segunda bici (no predeterminada)");
  await p.evaluate(() => { location.hash = "#run-actividad/bicicleta/imp_c"; });
  await p.waitForTimeout(900);
  ok(/Bici Trek Domane/.test(await txt(p, "#rd-app")), "el detalle dice con qué bici saliste");
  await p.click('[data-rd="menu"]');
  await p.click('[data-rd="editar"]');
  await p.waitForTimeout(350);
  ok(await p.$('#rd-form select[name="biciId"]') !== null && !(await p.$('#rd-form select[name="zapatillaId"]')), "Editar: elegir la bici (y no zapatillas)");
  await p.selectOption('#rd-form select[name="biciId"]', id2);
  await p.click('[data-rdh="guardar"]');
  await p.waitForTimeout(500);
  ok((await p.evaluate(() => window.__fakeStore.colMap("users/test/bicicleta").get("imp_c").biciId)) === id2 && /Bici La de montaña/.test(await txt(p, "#rd-app")), "cambiarla en una rodada");
  // Anotar a mano: con la predeterminada.
  await p.evaluate(() => { location.hash = "#bicicleta"; });
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector("[data-bici-mas]").click());
  await p.waitForTimeout(250);
  await p.click('[data-bici-op="manual"]');
  await p.waitForTimeout(300);
  await p.fill("#cycling-distance", "22");
  await p.fill("#cycling-duration", "60");
  await p.click("#cycling-form button[type=submit]");
  await p.waitForTimeout(500);
  const nueva = await p.evaluate(() => [...window.__fakeStore.colMap("users/test/bicicleta").values()].find(d => d.distance === 22));
  ok(nueva && nueva.biciId === id, "lo que anotas a mano lleva tu bici predeterminada");
  // Retirar y volver a usar.
  await p.evaluate(() => { location.hash = "#bici-bicis"; });
  await p.waitForTimeout(400);
  await p.click(`[data-bb-bici="${id2}"] [data-bb-retirar]`);
  await p.waitForTimeout(400);
  ok(/Retiradas/.test(await txt(p, "#bb-app")) && (await aj()).bicis[1].retirada === true, "retirar una bici");
  await p.click(`[data-bb-bici="${id2}"] [data-bb-volver]`);
  await p.waitForTimeout(400);
  ok(!(await aj()).bicis[1].retirada, "y volver a usarla");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();

  // Segmentos de bici: crear uno desde una rodada y buscarlo en las demás.
  p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#bici-segmentos", zona: ZONA, fecha: FECHA, ancho });
  await p.waitForTimeout(500);
  ok(/Abre una rodada con ruta/.test(await txt(p, "#bs-app")), "Segmentos de Bici vacío");
  await p.evaluate(() => { location.hash = "#run-actividad/bicicleta/imp_a"; });
  await p.waitForTimeout(1200);
  await p.click('[data-rd="menu"]');
  await p.click('[data-rd="segmento"]');
  await p.waitForTimeout(400);
  ok(/en todas tus rodadas/.test(await txt(p, "#rs-cuerpo")), "crear segmento desde una rodada");
  await p.fill("#rs-nombre", "Subida a La Cumbre");
  await p.click('[data-rsh="crear"]');
  await p.waitForFunction(() => /Listo/.test(document.getElementById("rs-cuerpo").innerText), null, { timeout: 15000 }).catch(() => {});
  // imp_b va por el mismo camino y imp_c (53 km) también pasa por ahí.
  ok(/Lo encontré en 2 rodadas más/.test(await txt(p, "#rs-cuerpo")), `lo busca en tus rodadas (${await txt(p, "#rs-cuerpo")})`);
  const seg = await p.evaluate(() => [...window.__fakeStore.colMap("users/test/run_segmentos").values()][0]);
  ok(seg && seg.deporte === "bicicleta" && Object.keys(seg.esfuerzos).sort().join() === "imp_a,imp_b,imp_c", "un segmento de bici con los tiempos de las 3 rodadas (las carreras no cuentan)");
  await p.click('[data-rsh="ver"]');
  await p.waitForSelector("#bsg-app .rsg-tabla", { timeout: 5000 }).catch(() => {});
  ok(/#bici-segmento\//.test(p.url()) && /Subida a La Cumbre/.test(await txt(p, "#bsg-app .rd-titulo")) && /km\/h/.test(await txt(p, "#bsg-app .rsg-tabla")), "su página, con la velocidad");
  ok(await p.$('#bsg-app .rsg-tabla a[href="#run-actividad/bicicleta/imp_b"]') !== null, "la tabla lleva a tus rodadas");
  await captura(p, `bici-segmento-${ancho}.png`);
  await p.evaluate(() => { location.hash = "#bici-segmentos"; });
  await p.waitForTimeout(400);
  ok(/Subida a La Cumbre/.test(await txt(p, "#bs-app")) && await p.$('#bs-app a[href^="#bici-segmento/"]') !== null, "la lista de Segmentos de Bici");
  await p.evaluate(() => { location.hash = "#run-segmentos"; });
  await p.waitForTimeout(400);
  ok(!/Subida a La Cumbre/.test(await txt(p, "#rs-app")), "y no aparece en los de Running");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

async function compu(browser, base) {
  console.log("\nBici en la compu (1280 px)");
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#bicicleta", zona: ZONA, fecha: FECHA, ancho: 1280, alto: 900 });
  await p.waitForTimeout(600);
  const pills = await p.$$eval("#panel-bicicleta .fin-outer-tabs a, #panel-bicicleta .fin-outer-tabs button", els => els.map(e => e.textContent.trim() || e.getAttribute("aria-label")));
  ok(pills.join(",") === "Actividades,Progreso,+ Agregar,Segmentos,Bicis,Ajustes de Bici", `las secciones como pills arriba, con el engranaje (${pills.join(", ")})`);
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
  for (const ancho of [390, 320]) await fase6(browser, base, ancho);
  for (const ancho of [390, 320]) await fase7(browser, base, ancho);
  await compu(browser, base);
  await terminar(browser, srv);
})();
