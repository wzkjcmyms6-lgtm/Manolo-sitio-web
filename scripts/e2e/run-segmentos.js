// Pruebas de pantalla de Segmentos y mapa de calor (Running, fase 6): crear
// un segmento desde una carrera (controles de inicio y fin, vista previa),
// búsqueda retroactiva, página con tabla y medallas, segmentos en el
// detalle, detección al importar, buscar de nuevo, renombrar, borrar una
// carrera (quita su tiempo), eliminar el segmento y el mapa de calor.
// Uso: node scripts/e2e/run-segmentos.js [carpeta-para-capturas]
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
const RUN = {}, RUTAS = {};
function agregar(id, fecha, vel, lonExtra) {
  const ps = X.puntos({ segundos: Math.ceil(3000 / vel), vel, subida: 40, inicio: t(`${fecha}T07:00:00-04:00`) }).map(p => Object.assign(p, { lon: p.lon + (lonExtra || 0) }));
  const { campos, ruta } = M.calcular(F.leer(X.fit(ps), "x.fit"), {});
  RUN[id] = Object.assign(G.documento({ deporte: "running", origen: { idExterno: id }, campos }, 1), { titulo: `Vuelta ${id}` });
  RUTAS[id] = ruta;
}
agregar("imp_1", "2026-10-06", 3.0);
agregar("imp_2", "2026-10-13", 3.2);
agregar("imp_3", "2026-10-20", 2.9);
agregar("imp_lejos", "2026-10-22", 3.0, 0.02);
const NUEVA = X.gpx(X.puntos({ segundos: Math.ceil(3000 / 3.6), vel: 3.6, subida: 40, inicio: t("2026-11-03T07:00:00-04:00") }), { nombre: "La más rápida" });

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: { "users/test/running": RUN, "users/test/rutas": RUTAS } }, { hash: "#run-segmentos", zona: ZONA, fecha: "2026-11-04T09:00:00-04:00" });
  await p.context().route(/tile\.openstreetmap\.org/, r => r.fulfill({ contentType: "image/png", body: PNG }));
  await p.context().route(/open-meteo|nominatim/, r => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));
  const tx = sel => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim());
  const vis = sel => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && getComputedStyle(el).display !== "none"; }, sel);
  const segs = () => p.evaluate(() => Array.from(window.__fakeStore.colMap("users/test/run_segmentos").entries()).map(([id, d]) => Object.assign({ id }, d)));

  console.log("\nSegmentos vacío");
  await p.waitForTimeout(300);
  ok(/Crear segmento/.test(await tx("#rs-app")), "explica cómo crear uno desde una carrera");

  console.log("Crear desde una carrera");
  await p.evaluate(() => { location.hash = "run-actividad/running/imp_1"; });
  await p.waitForSelector("#rd-perfil:not([hidden])", { timeout: 8000 });
  await p.click('[data-rd="menu"]');
  await p.click('.rd-menu-lista [data-rd="segmento"]');
  await p.waitForTimeout(350);
  ok(await vis("#rs-hoja") && await p.$("#rs-previa svg .rs-previa-sel") !== null, "hoja con vista previa del tramo");
  const fija = (cual, v) => p.$eval(`[data-rs-rango="${cual}"]`, (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
  await fija("desde", 1000);
  await fija("hasta", 2000);
  ok(/^1,00 km · \+\d+ m · [\d,]+ %$/.test(await tx("#rs-dato")), `1 km con desnivel y pendiente (${await tx("#rs-dato")})`);
  ok(await p.$("svg.rg rect.rg-banda-seg") !== null, "el tramo se marca en el perfil");
  await fija("hasta", 1050);
  ok((await p.$eval('[data-rs-rango="hasta"]', el => Number(el.value))) - (await p.$eval('[data-rs-rango="desde"]', el => Number(el.value))) >= 100, "el fin no queda antes del inicio (mín. 100 m)");
  await fija("desde", 1000);
  await fija("hasta", 2000);
  await p.fill("#rs-nombre", "Recta del Prado");
  await captura(p, "run-segmento-crear.png");
  await p.click('[data-rsh="crear"]');
  await p.waitForFunction(() => /Listo/.test(document.getElementById("rs-cuerpo").innerText), null, { timeout: 15000 });
  ok(/Lo encontré en 2 carreras más/.test(await tx("#rs-cuerpo")), `búsqueda en las demás (${await tx("#rs-cuerpo")})`);
  let s = (await segs())[0];
  ok(s && s.nombre === "Recta del Prado" && Object.keys(s.esfuerzos).sort().join() === "imp_1,imp_2,imp_3", "guarda los tiempos de las 3 vueltas (no la de otra calle)");
  ok(Math.abs(s.esfuerzos.imp_2.t - 1000 / 3.2) <= 3, `tiempo de la vuelta 2 (${s.esfuerzos.imp_2.t} s)`);

  console.log("Página del segmento");
  await p.click('[data-rsh="ver"]');
  await p.waitForSelector(".rsg-tabla");
  ok(/#run-segmento\//.test(p.url()) && (await tx("#rsg-app .rd-titulo")) === "Recta del Prado", "abre su página");
  const filas = await p.$$eval(".rsg-tabla li", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  ok(filas.length === 3 && /^🥇 Vuelta imp_2 5:13/.test(filas[0]) && /^🥉/.test(filas[2]), `tabla con medallas (${filas[0]})`);
  ok(/^1,00 km · \+\d+ m · [\d,]+ % de pendiente media$/.test(await tx("#rsg-app .rd-meta")), "distancia, desnivel y pendiente");
  await p.waitForSelector("#rsg-mapa .leaflet-container", { timeout: 6000 }).catch(() => {});
  ok(await p.$("#rsg-mapa .leaflet-container, #rsg-mapa svg") !== null, "mapa del segmento");
  ok(await p.$eval('#bottom-nav-links a[data-hash="run-segmentos"]', a => a.classList.contains("active")), "la barra marca Segmentos");
  await captura(p, "run-segmento.png");
  await p.click('#bottom-nav-links a[data-hash="run-segmentos"]');
  await p.waitForTimeout(300);
  ok(/Recta del Prado 1,00 km · [\d,]+ % · 3 veces 5:13 tu mejor/.test(await tx(".rs-card")), "la lista con el mejor tiempo");

  console.log("En el detalle de una carrera");
  await p.evaluate(() => { location.hash = "run-actividad/running/imp_1"; });
  await p.waitForSelector(".rd-segs", { timeout: 6000 }).catch(() => {});
  const enDetalle = await tx(".rd-segs").catch(() => "");
  ok(/Recta del Prado 5:3\d 2\.º de 3 · 1,00 km/.test(enDetalle), `su tiempo y puesto en el segmento (${enDetalle})`);

  console.log("Al importar una carrera nueva por ahí");
  await p.click(".run-importar-btn").catch(async () => { await p.evaluate(() => { location.hash = "running"; }); await p.waitForTimeout(300); await p.click(".run-importar-btn"); });
  if (!(await vis("#ri-hoja"))) { await p.evaluate(() => { location.hash = "running"; }); await p.waitForTimeout(300); await p.click(".run-importar-btn"); }
  await p.waitForTimeout(300);
  await p.setInputFiles("#ri-archivos", [{ name: "rapida.gpx", mimeType: "application/octet-stream", buffer: Buffer.from(NUEVA) }]);
  await p.waitForSelector(".ri-resumen", { timeout: 10000 });
  await p.click('[data-ri="importar"]');
  await p.waitForFunction(() => /Listo/.test(document.getElementById("ri-cuerpo").innerText), null, { timeout: 10000 });
  await p.waitForTimeout(600);
  s = (await segs())[0];
  const nuevaId = Object.keys(s.esfuerzos).find(k => !/^imp_[123]$/.test(k));
  ok(nuevaId && Math.abs(s.esfuerzos[nuevaId].t - 1000 / 3.6) <= 3, "la carrera nueva se suma sola al segmento");
  await p.click('#ri-acciones [data-ri="cerrar"]');
  await p.evaluate(id => { location.hash = `run-segmento/${id}`; }, s.id);
  await p.waitForTimeout(500);
  ok(/^🥇 La más rápida 4:38/.test(await tx(".rsg-tabla li")), "y queda primera en la tabla");

  console.log("Buscar de nuevo, renombrar");
  await p.click('[data-rsg="menu"]');
  await p.click('[data-rsg="buscar"]');
  await p.waitForFunction(() => /Listo/.test(document.getElementById("rsg-aviso").textContent), null, { timeout: 10000 });
  ok(/no hay tiempos nuevos/.test(await tx("#rsg-aviso")), "buscar de nuevo: no hay tiempos nuevos");
  await p.evaluate(() => { window.prompt = () => "Recta larga"; });
  await p.click('[data-rsg="menu"]');
  await p.click('[data-rsg="renombrar"]');
  await p.waitForTimeout(400);
  ok((await tx("#rsg-app .rd-titulo")) === "Recta larga" && (await segs())[0].nombre === "Recta larga", "renombrar");

  console.log("Borrar una carrera quita su tiempo");
  await p.evaluate(() => { location.hash = "run-actividad/running/imp_3"; });
  await p.waitForSelector("#rd-app .rd-titulo");
  await p.click('.rd-acciones [data-rd="eliminar"]');
  await p.waitForTimeout(500);
  s = (await segs())[0];
  ok(!s.esfuerzos.imp_3 && s.esfuerzos.imp_1, "el tiempo de la carrera borrada sale del segmento");

  console.log("Mapa de calor");
  await p.evaluate(() => { location.hash = "run-progreso"; });
  await p.waitForSelector(".rc-tarjeta", { timeout: 6000 }).catch(() => {});
  ok(/Mapa de calor Todas tus rutas en un mapa \(4\)/.test(await tx(".rc-tarjeta")), "tarjeta en Progreso con cuántas rutas");
  await p.click(".rc-tarjeta");
  await p.waitForSelector("#rc-app .rc-svg");
  // (la tarjeta de Progreso también tiene un dibujo: se mira solo el de esta pantalla)
  ok((await p.$$("#rc-app .rc-svg polyline")).length === 4 && await p.$eval("#verse-banner", el => el.hidden), "todas las rutas en un dibujo propio (sirve sin internet)");
  await p.click('[data-rc-filtro="90"]');
  ok((await p.$$("#rc-app .rc-svg polyline")).length === 4, "filtro de 90 días");
  await p.click('[data-rc-filtro="anio"]');
  ok((await p.$$("#rc-app .rc-svg polyline")).length === 4, "filtro de este año");
  await captura(p, "run-calor.png");
  await p.click("[data-rc-calles]");
  await p.waitForSelector(".rc-caja .leaflet-container canvas", { timeout: 8000 }).catch(() => {});
  ok(await p.$(".rc-caja .leaflet-container canvas") !== null, "«Ver con calles»: Leaflet con las rutas en un lienzo");

  console.log("Eliminar el segmento");
  await p.evaluate(id => { location.hash = `run-segmento/${id}`; }, s.id);
  await p.waitForTimeout(400);
  await p.click('[data-rsg="menu"]');
  await p.click('[data-rsg="eliminar"]');
  await p.waitForTimeout(500);
  ok(/#run-segmentos$/.test(p.url()) && (await segs()).length === 0 && /Crear segmento/.test(await tx("#rs-app")), "se elimina y vuelve a la lista vacía");
  ok((await p.evaluate(() => window.__fakeStore.colMap("users/test/running").size)) === 4, "las carreras no se tocan");
  ok(p.errores.length === 0, "sin errores en la página");
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  ok(ancho <= 390, `sin desborde (${ancho})`);
  await terminar(browser, srv);
})();
