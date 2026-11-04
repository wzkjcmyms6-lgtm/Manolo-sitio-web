// Pruebas de pantalla del detalle de una actividad (Running, fase 2): abrir
// desde el historial, cifras, logros, mapa (Leaflet local, teselas
// simuladas), perfil con cursor unido al mapa, parciales, vueltas, zonas,
// intervalos de la rutina sombreados, editar, exportar GPX, corregir
// desnivel, eliminar (con su ruta), sin internet (trazo SVG) y 1280 px.
// Uso: node scripts/e2e/run-detalle.js [carpeta-para-capturas]
const fs = require("node:fs");
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");
const X = require("../../tests/run-fixtures.js");
const F = require("../../js/run-formatos.js");
const M = require("../../js/run-metricas.js");
const G = require("../../js/run-guardar.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const t = s => Date.parse(s);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk2PbfHwAEhwJ6g1n0LQAAAABJRU5ErkJggg==", "base64");

// Actividades armadas con el motor real (como al importar).
function importada(id, ps, extra, opciones) {
  const act = F.leer(X.fit(ps, opciones && opciones.fit), "x.fit");
  const { campos, ruta } = M.calcular(act, { fcMax: 190, fcReposo: 50 });
  const doc = G.documento(Object.assign({ deporte: "running", origen: { formato: "fit", app: "strava", idExterno: id, dispositivo: "Garmin" } , campos }, extra), Date.now());
  return { doc, ruta };
}
const A = importada("a", X.puntos({ segundos: 3000, vel: 3.3, fc: 152, cad: 86, subida: 80, inicio: t("2026-11-03T06:42:00-04:00") }),
  { titulo: "Fondo por el Prado", descripcion: "Con frío, buen ritmo" }, { fit: { vueltas: 3 } });
A.doc.lugar = "Sopocachi, La Paz";
A.doc.clima = { tC: 8.5, sensC: 6, hum: 60, vientoKmh: 9, cod: 2 };
const B = importada("b", X.puntos({ segundos: 1700, vel: 3.0, fc: 150, inicio: t("2026-10-20T07:00:00-04:00") }), { titulo: "Más lenta" });
// Rutina guiada unida a una importada: intervalos sombreados.
const R = importada("r", X.puntos({ segundos: 1500, vel: 2.8, fc: 145, inicio: t("2026-10-28T18:00:00-04:00") }), {});
const RUT = Object.assign({}, R.doc, { fuente: "rutina", conImportado: true, rutina: { id: "r5k", nombre: "Plan 5K · Día 2", completados: 6, total: 6 }, previo: { distance: 0, duration: 25, inicio: R.doc.inicio + 30000 }, titulo: null, rpe: 6 });
delete RUT.titulo;

const SEED = {
  "users/test/running": { imp_a: A.doc, imp_b: B.doc, rut1: RUT, m1: { date: "2026-10-30", distance: 5, duration: 27, rpe: 7, notes: "Con viento" } },
  "users/test/rutas": { imp_a: A.ruta, imp_b: B.ruta, rut1: R.ruta },
  "users/test/rutinas_running": { r5k: { v: 1, nombre: "Plan 5K · Día 2", orden: 1, intervalos: [{ tipo: "caminar", seg: 300 }, { tipo: "correr", seg: 240 }, { tipo: "caminar", seg: 120 }, { tipo: "correr", seg: 240 }, { tipo: "caminar", seg: 120 }, { tipo: "correr", seg: 240 }] } },
  "users/test/meta": { running_ajustes: { fcMax: 190, fcReposo: 50 } }
};

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#running", zona: ZONA, fecha: "2026-11-04T09:00:00-04:00" });
  await p.context().route(/tile\.openstreetmap\.org/, r => r.fulfill({ contentType: "image/png", body: PNG }));
  const elev = [];
  await p.context().route(/api\.open-meteo\.com\/v1\/elevation/, r => {
    const n = new URL(r.request().url()).searchParams.get("latitude").split(",").length;
    elev.push(n);
    r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ elevation: Array.from({ length: n }, (_, i) => 3600 + (i % 20 < 10 ? i % 20 : 20 - (i % 20))) }) });
  });
  const tx = sel => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim());
  const vis = sel => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && getComputedStyle(el).display !== "none"; }, sel);
  const doc = (c, id) => p.evaluate(([c, id]) => window.__fakeStore.colMap(c).get(id) || null, [c, id]);

  console.log("\nAbrir desde el historial");
  await p.click('#running-list a[href="#run-actividad/running/imp_a"]');
  await p.waitForSelector(".rd-titulo");
  ok(await vis("#panel-run-actividad") && !(await vis("#panel-running")), "tocar la carrera abre su detalle");
  ok(await p.$eval("#verse-banner", el => el.hidden), "sin versículo");
  ok((await tx(".rd-titulo")) === "Fondo por el Prado", "título");
  const meta = await tx(".rd-meta");
  ok(/martes 3 de noviembre de 2026 · 06:42/.test(meta) && /Sopocachi, La Paz/.test(meta) && /Parcialmente nublado, 9 °C/.test(meta), `fecha, hora, lugar y clima (${meta})`);
  const stats = await tx(".rd-stats");
  ok(/Distancia 9,90 km/.test(stats) && /Ritmo 5:03 \/km/.test(stats) && /En movimiento 50:00/.test(stats), `distancia, ritmo y tiempo (${stats.slice(0, 90)})`);
  ok(/Desnivel 37 m/.test(stats) && /Calorías 432 kcal/.test(stats) && /FC media 151 lpm/.test(stats) && /Cadencia 170 ppm/.test(stats) && /Carga \d+ por FC/.test(stats), "desnivel, calorías, FC, cadencia y carga del reloj");
  ok(/Con frío, buen ritmo/.test(await tx(".rd-notas")), "la descripción");
  const logros = await tx(".rd-logros");
  ok(/🥇/.test(logros) && /5K/.test(logros) && /Mejor marca/.test(logros), `logros con medalla (${logros.slice(0, 60)})`);

  console.log("Mapa y perfil");
  await p.waitForSelector(".rd-mapa .leaflet-container", { timeout: 8000 }).catch(() => {});
  ok(await p.$(".rd-mapa .leaflet-container") !== null, "mapa con calles (Leaflet local)");
  ok(/OpenStreetMap/.test(await tx(".rd-mapa .leaflet-control-attribution")), "atribución de OpenStreetMap");
  ok((await p.$$(".rd-mapa path.leaflet-interactive")).length >= 3, "ruta, inicio y fin");
  await p.waitForSelector("#rd-perfil:not([hidden]) svg.rg");
  const modos = await p.$$eval("[data-rd-modo]", els => els.map(e => e.textContent));
  ok(modos.join("|") === "Ritmo|FC|Altura", `pestañas del perfil (${modos.join("|")})`);
  const caja = await p.$("[data-rd-perfil] svg");
  await caja.scrollIntoViewIfNeeded();
  const bb = await caja.boundingBox();
  const antes = (await p.$$(".rd-mapa .leaflet-overlay-pane path")).length;
  await p.mouse.move(bb.x + bb.width * 0.5, bb.y + bb.height * 0.5);
  await p.waitForTimeout(150);
  ok(await p.$eval(".rg-cursor", g => !g.hasAttribute("hidden")), "el cursor aparece al pasar por el gráfico");
  const lect = await tx(".rd-lectura");
  ok(/^km \d,\d\d · 5:0\d \/km · 3\.6\d\d m · 15\d lpm$/.test(lect), `lectura del punto (${lect})`);
  ok((await p.$$(".rd-mapa .leaflet-overlay-pane path")).length === antes + 1, "y un punto se mueve en el mapa");
  await p.click('[data-rd-modo="fc"]');
  ok(await p.$("svg.rg path.rg-fc") !== null, "pestaña FC");
  await captura(p, "run-detalle-arriba.png");

  console.log("Parciales, vueltas y zonas");
  const filas = await p.$$eval(".rd-parciales tbody tr", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  ok(filas.length === 10 && /^1 /.test(filas[0]) && /^0,90/.test(filas[9]), `9 km + el último parcial (${filas.length})`);
  ok((await p.$$(".rd-parciales tr.is-rapido")).length === 1 && /más rápido/.test(await tx(".rd-parciales tr.is-rapido")), "el más rápido marcado");
  ok((await p.$$(".rd-vueltas tbody tr")).length === 3, "vueltas del reloj");
  const zonas = await p.$$eval(".rd-zonas li", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  ok(zonas.length === 5 && /^Z5/.test(zonas[0]) && zonas.some(z => /^Z3 .*100 %/.test(z)), `5 zonas con los ajustes (${zonas[2]})`);
  ok(/Origen Importada de un archivo FIT \(Strava\) · Garmin/.test(await tx(".rd-detalles")), "de dónde vino");
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await captura(p, "run-detalle-abajo.png");

  console.log("Mapa grande");
  await p.click('[data-rd="ampliar"]');
  ok(await p.evaluate(() => document.body.classList.contains("rd-mapa-abierto")), "ampliar el mapa a pantalla completa");
  await p.waitForTimeout(150);
  await captura(p, "run-detalle-mapa.png");
  await p.click('[data-rd="ampliar"]');
  ok(!(await p.evaluate(() => document.body.classList.contains("rd-mapa-abierto"))), "y volver");

  console.log("Editar");
  await p.click('[data-rd="menu"]');
  ok(await vis(".rd-menu-lista"), "menú ⋯");
  await p.click('.rd-menu-lista [data-rd="editar"]');
  await p.waitForTimeout(250);
  await p.fill('#rd-form [name="titulo"]', "Fondo largo del martes");
  await p.selectOption('#rd-form [name="subtipo"]', "trail");
  await p.selectOption('#rd-form [name="rpe"]', "8");
  await p.click('[data-rdh="guardar"]');
  await p.waitForTimeout(400);
  const ed = await doc("users/test/running", "imp_a");
  ok(ed.titulo === "Fondo largo del martes" && ed.subtipo === "trail" && ed.rpe === 8 && ed.notes === "Con frío, buen ritmo", "guarda título, tipo y RPE sin tocar la descripción");
  ok((await tx(".rd-titulo")) === "Fondo largo del martes" && /Tipo Trail/.test(await tx(".rd-detalles")) && /Esfuerzo percibido 8\/10/.test(await tx(".rd-detalles")), "y se ve al instante");

  console.log("Exportar GPX");
  const [descarga] = await Promise.all([p.waitForEvent("download"), p.click('.rd-acciones [data-rd="gpx"]')]);
  const gpx = fs.readFileSync(await descarga.path(), "utf8");
  ok(descarga.suggestedFilename() === "2026-11-03-fondo-largo-del-martes.gpx", `nombre del archivo (${descarga.suggestedFilename()})`);
  ok((gpx.match(/<trkpt /g) || []).length === 3001 && /<gpxtpx:hr>152<\/gpxtpx:hr>/.test(gpx), "GPX con todos los puntos y la FC");

  console.log("Corregir desnivel");
  await p.click('[data-rd="menu"]');
  await p.click('.rd-menu-lista [data-rd="desnivel"]');
  await p.waitForFunction(() => { const d = window.__fakeStore.colMap("users/test/running").get("imp_a"); return d && d.desnivelCorr; }, null, { timeout: 8000 }).catch(() => {});
  const dc = (await doc("users/test/running", "imp_a")).desnivelCorr;
  ok(dc && dc.pos > 0 && dc.fuente === "open-meteo" && elev.length >= 1 && elev.every(n => n <= 100), `desnivel corregido en lotes de ≤ 100 (${JSON.stringify(dc)}, ${elev.join("+")})`);
  ok(!!(await doc("users/test/rutas", "imp_a")).altCorr, "la altura del terreno queda en la ruta");
  await p.waitForTimeout(200);
  ok(/corregido · reloj 37 m/.test(await tx(".rd-stats")), "se ve corregido y el del reloj");

  console.log("Rutina guiada unida: intervalos sombreados");
  await p.goto(base + "/index.html#run-actividad/running/rut1");
  await p.waitForSelector("svg.rg rect.rg-banda", { timeout: 8000 }).catch(() => {});
  ok((await p.$$("svg.rg rect.rg-banda")).length === 3, "3 intervalos de correr sombreados");
  ok((await tx(".rd-titulo")) === "Plan 5K · Día 2" && /Rutina Plan 5K · Día 2 · 6 de 6 intervalos/.test(await tx(".rd-detalles")), "título y datos de la rutina");
  await captura(p, "run-detalle-rutina.png");

  console.log("Carrera a mano");
  await p.goto(base + "/index.html#run-actividad/running/m1");
  await p.waitForSelector(".rd-titulo");
  ok(!(await p.$(".rd-mapa")) && /Distancia 5,00 km/.test(await tx(".rd-stats")) && /Ritmo 5:24 \/km/.test(await tx(".rd-stats")), "sin mapa, con distancia y ritmo");
  ok(!(await p.$('[data-rd="gpx"]')), "sin exportar GPX");

  console.log("Sin internet: trazo propio");
  await p.context().setOffline(true);
  await p.goto(base + "/index.html#run-actividad/running/imp_b").catch(() => {});
  await p.waitForSelector(".rd-titulo", { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(800);
  ok(await p.$(".rd-mapa svg.run-ruta") !== null && !(await p.$(".rd-mapa .leaflet-container")), "sin internet se ve el trazo SVG");
  await p.context().setOffline(false);

  console.log("Eliminar");
  await p.goto(base + "/index.html#run-actividad/running/imp_b");
  await p.waitForSelector(".rd-titulo");
  await p.click('.rd-acciones [data-rd="eliminar"]');
  await p.waitForTimeout(500);
  ok(/#running$/.test(p.url()) && !(await doc("users/test/running", "imp_b")) && !(await doc("users/test/rutas", "imp_b")), "borra la carrera y su ruta y vuelve a Running");
  ok(!!(await doc("users/test/running", "imp_a")), "las demás siguen");

  console.log("Computadora (1280 px)");
  const q = await abrir(browser, base, { __SEED__: SEED }, { hash: "#run-actividad/running/imp_a", zona: ZONA, ancho: 1280, alto: 900, fecha: "2026-11-04T09:00:00-04:00" });
  await q.context().route(/tile\.openstreetmap\.org/, r => r.fulfill({ contentType: "image/png", body: PNG }));
  await q.reload();
  await q.waitForSelector(".rd-titulo");
  await q.waitForTimeout(800);
  ok(await q.evaluate(() => document.documentElement.scrollWidth <= 1280), "sin desborde horizontal");
  ok(await q.$(".rd-mapa .leaflet-container") !== null, "mapa en la computadora");
  await captura(q, "run-detalle-1280.png");
  ok(p.errores.length === 0 && q.errores.length === 0, "sin errores en la página");
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  ok(ancho <= 390, `sin desborde en el teléfono (${ancho})`);
  await terminar(browser, srv);
})();
