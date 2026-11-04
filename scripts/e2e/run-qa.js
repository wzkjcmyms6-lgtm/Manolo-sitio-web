// QA final de Running (fase 8): el recorrido completo en teléfono (390 px) y
// computadora (1280 px) — importar, tarjeta, detalle (parciales, mejores
// marcas), crear un segmento, eliminar — sin errores en la consola; ver sin
// internet; exportar todo (ZIP con GPX + JSON); y rendimiento con 500
// carreras (feed, progreso y detalle). Uso: node scripts/e2e/run-qa.js [capturas]
const fs = require("node:fs");
const zlib = require("node:zlib");
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");
const X = require("../../tests/run-fixtures.js");
const F = require("../../js/run-formatos.js");
const M = require("../../js/run-metricas.js");
const G = require("../../js/run-guardar.js");
const Z = require("../../js/run-zip.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const t = s => Date.parse(s);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk2PbfHwAEhwJ6g1n0LQAAAABJRU5ErkJggg==", "base64");
const ruta = (ini, vel, seg) => X.puntos({ segundos: seg, vel, fc: 150, cad: 85, subida: 50, inicio: t(ini) }).map((p, i) => Object.assign(p, { lon: p.lon + Math.sin(i / 300) * 0.004 }));
const FIT = Buffer.from(zlib.gzipSync(Buffer.from(X.fit(ruta("2026-11-03T06:40:00-04:00", 3.3, 3000), { vueltas: 2 }))));
const GPX = Buffer.from(X.gpx(ruta("2026-10-27T18:10:00-04:00", 3.0, 2200), { nombre: "Tarde en el Prado" }));

// 500 carreras con mini ruta, parciales y mejores marcas (rendimiento).
function muchas() {
  const base = ruta("2026-01-01T07:00:00-04:00", 3.2, 1800);
  const { campos } = M.calcular({ deporte: "running", inicio: base[0].t, puntos: base, resumen: {} }, {});
  const out = {};
  for (let i = 0; i < 500; i++) {
    const ini = t("2025-06-01T07:00:00-04:00") + i * 86400000 * 0.95;
    const d = new Date(ini);
    out[`r${i}`] = Object.assign({}, campos, {
      v: 2, fuente: "importado", inicio: ini, fin: ini + 1800000, titulo: `Carrera ${i}`,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      tiempoMovS: campos.tiempoMovS - (i % 50), mejores: Object.fromEntries(Object.entries(campos.mejores).map(([k, v]) => [k, v - (i % 37)]))
    });
  }
  return out;
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();

  for (const ancho of [390, 1280]) {
    console.log(`\n=== Recorrido completo a ${ancho} px`);
    const p = await abrir(browser, base, { __SEED__: { "users/test/running": { m1: { date: "2026-10-30", distance: 5, duration: 28, rpe: 6 } } } }, { hash: "#running", zona: ZONA, ancho, alto: ancho > 800 ? 900 : 844, fecha: "2026-11-04T09:00:00-04:00" });
    const consola = [];
    p.on("console", m => { if (m.type() === "error") consola.push(m.text()); });
    await p.context().route(/tile\.openstreetmap\.org/, r => r.fulfill({ contentType: "image/png", body: PNG }));
    await p.context().route(/open-meteo|nominatim/, r => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));
    const tx = sel => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim());
    const sinDesborde = async que => { const w = await p.evaluate(() => document.documentElement.scrollWidth); ok(w <= ancho, `${que}: sin desborde (${w})`); };

    // Importar (desde el "+" en el teléfono, desde la pill en la compu)
    if (ancho < 800) await p.click("#bottom-nav-links .tab-accion"); else await p.click("#panel-running .fin-tab-accion");
    await p.waitForTimeout(300);
    await p.click('[data-run-op="importar"]');
    await p.waitForTimeout(300);
    await p.setInputFiles("#ri-archivos", [{ name: "reloj.fit.gz", mimeType: "application/gzip", buffer: FIT }, { name: "tarde.gpx", mimeType: "application/octet-stream", buffer: GPX }]);
    await p.waitForSelector(".ri-resumen", { timeout: 10000 });
    ok(/2 actividades para guardar/.test(await tx(".ri-resumen")), "importar: 2 para guardar");
    await p.click('[data-ri="importar"]');
    await p.waitForFunction(() => /Listo/.test(document.getElementById("ri-cuerpo").innerText), null, { timeout: 10000 });
    await p.click('#ri-acciones [data-ri="cerrar"]');
    await p.waitForTimeout(400);

    // Tarjeta
    const cards = await p.$$eval("#rf-feed .rf-card", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
    ok(cards.length === 3 && /^Carrera por la mañana mar 3 nov · 06:40 Distancia 9,90 km Ritmo 5:03 \/km Tiempo 50:00/.test(cards[0]), `tarjeta de la importada (${cards[0].slice(0, 80)})`);
    ok((await p.$$("#rf-feed .rf-mapa svg")).length === 2, "con su trazo");
    await sinDesborde("Actividades");
    await captura(p, `qa-feed-${ancho}.png`);

    // Detalle: parciales, mejores marcas
    await p.click("#rf-feed article.rf-card:first-of-type .rf-link");
    await p.waitForSelector("#rd-perfil:not([hidden])", { timeout: 8000 });
    ok((await p.$$(".rd-parciales tbody tr")).length === 10, "detalle: 9 km + el último parcial");
    ok(/5K/.test(await tx(".rd-logros")) && /Mejor marca/.test(await tx(".rd-logros")), "detalle: mejores marcas");
    ok((await p.$$(".rd-vueltas tbody tr")).length === 2 && (await p.$$(".rd-ia li")).length >= 2, "vueltas del reloj y resumen inteligente");
    await p.waitForSelector(".rd-mapa .leaflet-container", { timeout: 6000 }).catch(() => {});
    ok(await p.$(".rd-mapa .leaflet-container") !== null, "mapa");
    await sinDesborde("Detalle");
    await captura(p, `qa-detalle-${ancho}.png`);

    // Segmento
    await p.click('[data-rd="menu"]');
    await p.click('.rd-menu-lista [data-rd="segmento"]');
    await p.waitForTimeout(300);
    await p.fill("#rs-nombre", "Subida QA");
    await p.click('[data-rsh="crear"]');
    await p.waitForFunction(() => /Listo/.test(document.getElementById("rs-cuerpo").innerText), null, { timeout: 15000 });
    await p.click('[data-rsh="ver"]');
    await p.waitForSelector(".rsg-tabla", { timeout: 6000 });
    ok((await p.$$(".rsg-tabla li")).length >= 1 && /Subida QA/.test(await tx("#rsg-app .rd-titulo")), "segmento creado con su tabla");
    await sinDesborde("Segmento");

    // Sin internet: navegar sigue funcionando (datos del teléfono y trazo propio)
    await p.context().setOffline(true);
    await p.evaluate(() => { location.hash = "running"; });
    await p.waitForTimeout(300);
    await p.click('#rf-feed .rf-card:has-text("Tarde en el Prado") .rf-link');
    await p.waitForSelector("#rd-app .rd-titulo");
    await p.waitForTimeout(600);
    ok(await p.$(".rd-mapa svg.run-ruta") !== null && /Tarde en el Prado/.test(await tx("#rd-app .rd-titulo")), "sin internet: el detalle se ve con el trazo propio");
    await p.evaluate(() => { location.hash = "run-progreso"; });
    await p.waitForTimeout(400);
    ok(/Esta semana/.test(await tx(".rp-total")), "sin internet: Progreso se ve");
    await p.context().setOffline(false);

    // Eliminar
    await p.evaluate(() => { location.hash = "running"; });
    await p.waitForTimeout(300);
    await p.click('#rf-feed .rf-card:has-text("Tarde en el Prado") .rf-link');
    await p.waitForSelector("#rd-app .rd-titulo");
    const id = await p.evaluate(() => location.hash.split("/").pop());
    await p.click('.rd-acciones [data-rd="eliminar"]');
    await p.waitForTimeout(500);
    ok(!(await p.evaluate(i => window.__fakeStore.colMap("users/test/running").has(i) || window.__fakeStore.colMap("users/test/rutas").has(i), id)), "eliminar: se va la carrera y su ruta");
    ok((await p.$$("#rf-feed .rf-card")).length === 2, "y sale del feed");

    // Exportar todo
    await p.evaluate(() => { location.hash = "run-ajustes"; });
    await p.waitForSelector("[data-ra-exportar]");
    const [descarga] = await Promise.all([p.waitForEvent("download"), p.click("[data-ra-exportar]")]);
    const zip = new Uint8Array(fs.readFileSync(await descarga.path()));
    const fz = Z.desdeBytes(zip);
    const ents = await Z.listar(fz);
    const json = JSON.parse(new TextDecoder().decode(await Z.extraer(fz, ents.find(e => e.nombre === "manolo-running.json"))));
    ok(/^manolo-running-2026-11-04\.zip$/.test(descarga.suggestedFilename()) && ents.filter(e => /^gpx\/.+\.gpx$/.test(e.nombre)).length === 1, `ZIP con 1 GPX (${ents.map(e => e.nombre).join(", ")})`);
    ok(json.running.length === 2 && json.segmentos.length === 1 && json.ajustes != null, "y el JSON con carreras, segmentos y ajustes");
    const gpxTxt = new TextDecoder().decode(await Z.extraer(fz, ents.find(e => /\.gpx$/.test(e.nombre))));
    ok(F.leer(new TextEncoder().encode(gpxTxt), "x.gpx").puntos.length === 3001, "el GPX exportado se vuelve a leer completo");

    ok(p.errores.length === 0, `sin errores de página (${p.errores.join(" | ")})`);
    const reales = consola.filter(c => !/Failed to load resource|net::ERR/.test(c));
    ok(reales.length === 0, `sin errores en la consola (${reales.slice(0, 3).join(" | ")})`);
    await p.context().close();
  }

  console.log("\n=== Rendimiento con 500 carreras");
  const q = await abrir(browser, base, { __SEED__: { "users/test/running": muchas() } }, { hash: "#inicio", zona: ZONA, fecha: "2026-11-04T09:00:00-04:00" });
  const medir = async (hash, sel) => {
    const t0 = Date.now();
    await q.evaluate(h => { location.hash = h; }, hash);
    await q.waitForSelector(sel, { timeout: 10000 });
    return Date.now() - t0;
  };
  const tFeed = await medir("running", "#rf-feed article.rf-card");
  ok((await q.$$("#rf-feed .rf-card")).length === 20, "feed: 20 tarjetas de 500");
  ok(tFeed < 1500, `feed en ${tFeed} ms (< 1,5 s)`);
  const tProg = await medir("run-progreso", ".rp-total");
  ok(tProg < 2000, `progreso en ${tProg} ms (< 2 s)`);
  const tDet = await medir("run-actividad/running/r250", "#rd-app .rd-ia");
  ok(tDet < 1500, `detalle con resumen y mismo recorrido en ${tDet} ms (< 1,5 s)`);
  ok(/Mismo recorrido \d+ veces/.test(await q.$eval(".rd-recorrido h2", el => el.textContent.replace(/\s+/g, " "))), "mismo recorrido entre 500");
  ok(q.errores.length === 0, "sin errores");
  await terminar(browser, srv);
})();
