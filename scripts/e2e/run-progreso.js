// Pruebas de pantalla de Running › Progreso y Ajustes (fase 4): totales por
// período contra el anterior, resumen semanal de siempre, racha, metas con
// anillos, diario, mejores marcas (top 3 y evolución), predicciones, forma y
// fatiga, zapatillas, engranaje de Ajustes (FC, umbral, metas, zapatillas)
// y zapatilla predeterminada al importar.
// Uso: node scripts/e2e/run-progreso.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");
const X = require("../../tests/run-fixtures.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const t = s => Date.parse(s);
const imp = (id, fecha, km, seg, mejores, extra) => Object.assign({ v: 2, fuente: "importado", date: fecha, inicio: t(`${fecha}T07:00:00-04:00`), distance: km, duration: Math.round(seg / 6) / 10, distanciaM: km * 1000, tiempoMovS: seg, tiempoTotalS: seg, conRuta: false, mejores, carga: { v: Math.round(seg / 36), m: "rtss" }, titulo: `Carrera ${id}` }, extra);
const RUN = {
  a: imp("a", "2026-11-03", 10, 3000, { "1000": 280, "1609": 460, "5000": 1480, "10000": 3000 }, { zapatillaId: "z1", desnivelPosM: 120 }),
  b: imp("b", "2026-11-02", 5, 1500, { "1000": 285, "1609": 470, "5000": 1500 }, { zapatillaId: "z1" }),
  c: imp("c", "2026-10-28", 8, 2500, { "1000": 290, "5000": 1550 }),
  d: imp("d", "2026-10-20", 21.1, 7000, { "1000": 300, "5000": 1600, "10000": 3200, "21097": 7000 }),
  e: imp("e", "2026-10-13", 6, 1900, { "1000": 295, "5000": 1580 }),
  m: { date: "2026-10-30", distance: 5, duration: 30, rpe: 6 }
};
const AJ = { running_ajustes: { metas: { semanaKm: 20, mesKm: 0, anioKm: 1000 }, zapatillas: [{ id: "z1", nombre: "Pegasus", kmInicial: 600, limiteKm: 700, predeterminada: true, creado: t("2026-10-01T00:00:00-04:00") }] } };

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: { "users/test/running": RUN, "users/test/meta": AJ } }, { hash: "#run-progreso", zona: ZONA, fecha: "2026-11-04T09:00:00-04:00" });
  const tx = sel => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim());
  const vis = sel => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && getComputedStyle(el).display !== "none"; }, sel);
  await p.waitForSelector(".rp-total");

  console.log("\nTotales por período");
  let tot = await tx(".rp-total");
  ok(/^Esta semana 15,0 km ▲ 2,0 km vs la semana pasada Tiempo 1 h 15 min Carreras 2 Desnivel 120 m$/.test(tot), `semana contra la pasada (${tot})`);
  await p.click('[data-rp-periodo="mes"]');
  tot = await tx(".rp-total");
  ok(/^Este mes 15,0 km ▼ 25,1 km vs el mes pasado/.test(tot), `mes contra el pasado (${tot.slice(0, 60)})`);
  await p.click('[data-rp-periodo="total"]');
  ok(/Desde que registras 55,1 km/.test(await tx(".rp-total")) && !/vs/.test(await tx(".rp-total")), "total, sin comparación");
  await p.click('[data-rp-periodo="semana"]');
  ok(await vis("#running-dash") && /Últimas 12 semanas/.test(await tx("#running-dash")), "el resumen semanal de siempre sigue debajo");

  console.log("Racha, metas y diario");
  const racha = await tx(".rp-racha");
  ok(/^🔥 4 semanas seguidas/.test(racha), `racha de semanas (${racha})`);
  const metas = await p.$$eval(".rp-meta", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  ok(metas.join(" | ") === "15,0/20 km Semana | 55,1/1.000 km Año", `anillos de metas (${metas.join(" | ")})`);
  const cal = await p.$$eval(".rp-cal .rp-dia", els => els.map(e => ({ vacio: e.classList.contains("is-vacio"), con: e.classList.contains("is-con"), txt: e.textContent.trim(), href: e.getAttribute("href") })));
  ok(cal.filter(c => c.vacio).length === 6 && cal.filter(c => !c.vacio).length === 30, "noviembre empieza en domingo (6 huecos) y tiene 30 días");
  ok(cal.filter(c => c.con).map(c => c.txt).join() === "2,3" && cal.find(c => c.txt === "3").href === "#run-actividad/running/a", "círculos el 2 y el 3, que abren su carrera");
  await p.click('[data-rp-mes="2026-10"]');
  ok(/Octubre de 2026/.test(await tx(".rp-mes-nav")) && (await p.$$(".rp-cal .rp-dia.is-con")).length === 4, "mes anterior: 4 días con carreras");
  ok(await p.$eval('.rp-mes-nav button[aria-label="Mes siguiente"]', b => !b.disabled), "y se puede volver");
  await p.click('.rp-mes-nav button[aria-label="Mes siguiente"]');
  ok(await p.$eval('.rp-mes-nav button[aria-label="Mes siguiente"]', b => b.disabled), "no se pasa del mes actual");
  await captura(p, "run-progreso.png");

  console.log("Mejores marcas y predicciones");
  const marcas = await p.$$eval(".rp-marca", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  ok(marcas.length === 5 && /^5K 24:40/.test(marcas.find(m => /^5K/.test(m))), `una por distancia con la mejor (${marcas.length})`);
  ok(/5K: tus 3 mejores/.test(await tx(".rp-marca-sel h3")) && (await p.$$(".rp-top li")).length === 3, "5K elegido: top 3");
  ok((await p.$$(".rp-evo circle")).length === 5 && (await p.$$(".rp-evo circle.rp-pr")).length >= 2, "evolución con cada esfuerzo y las marcas");
  await p.click('[data-rp-marca="21097"]');
  ok(/Media maratón: tus 3 mejores/.test(await tx(".rp-marca-sel h3")) && (await p.$$(".rp-top li")).length === 1 && !(await p.$(".rp-evo")), "media: una sola, sin gráfico");
  const pred = await p.$$eval(".rp-pred > div", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  ok(pred.length === 4 && /^5K \d+:\d\d \d:\d\d \/km$/.test(pred[0]) && /^Maratón \d:\d\d:\d\d/.test(pred[3]), `predicciones 5K a maratón (${pred.join(" | ")})`);

  console.log("Forma y fatiga, zapatillas");
  const ff = await tx(".rp-ff-cifras");
  ok(/Estado físico \d+ Fatiga \d+ Forma [+−-]?\d+/.test(ff) && await p.$("svg.rp-ff path.rp-ff-estado") !== null, `cifras y gráfico (${ff})`);
  ok((await tx(".rp-ff-texto")).length > 10, "una frase que explica la forma");
  const zap = await tx(".rp-zap");
  ok(/^Pegasus predeterminada 615 \/ 700 km/.test(zap) && !/Pronto/.test(zap), `km de las zapatillas (${zap})`);
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await captura(p, "run-progreso-abajo.png");

  console.log("Ajustes (engranaje)");
  ok(await vis('.topbar-ajustes[data-engranaje="running"]'), "engranaje arriba en Running");
  await p.click('.topbar-ajustes[data-engranaje="running"]');
  await p.waitForSelector("#ra-form");
  ok(/#run-ajustes$/.test(p.url()) && await p.$eval('#bottom-nav-links a[data-hash="running"]', () => true), "abre Ajustes de Running con la barra de Running");
  ok(/Sugerido: 5:00/.test(await p.getAttribute('[name="ritmoUmbral"]', "placeholder")), "ritmo umbral sugerido por la mejor de 10K");
  await p.fill('[name="fcMax"]', "250");
  await p.click(".ra-guardar");
  ok(/entre 120 y 230/.test(await tx("[data-ra-error]")), "valida la FC máxima");
  await p.fill('[name="fcMax"]', "192");
  await p.fill('[name="fcReposo"]', "52");
  await p.fill('[name="ritmoUmbral"]', "4:55");
  await p.fill('[name="mesKm"]', "80");
  await p.click(".ra-guardar");
  await p.waitForTimeout(300);
  const aj = await p.evaluate(() => window.__fakeStore.colMap("users/test/meta").get("running_ajustes"));
  ok(aj.fcMax === 192 && aj.fcReposo === 52 && aj.ritmoUmbralS === 295 && aj.metas.mesKm === 80 && aj.metas.semanaKm === 20 && aj.zapatillas.length === 1, "guarda FC, umbral y metas sin tocar las zapatillas");
  ok(/Ajustes guardados/.test(await tx("#ra-app")), "avisa que se guardó");
  await p.click("[data-ra-nueva]");
  await p.fill('#ra-zap-form [name="nombre"]', "Trail Gel");
  await p.fill('#ra-zap-form [name="kmInicial"]', "50");
  await p.click('#ra-zap-form button[type="submit"]');
  await p.waitForTimeout(300);
  let zs = (await p.evaluate(() => window.__fakeStore.colMap("users/test/meta").get("running_ajustes"))).zapatillas;
  ok(zs.length === 2 && zs[1].nombre === "Trail Gel" && zs[1].kmInicial === 50 && zs[1].limiteKm === 700 && zs[1].predeterminada === false, "agrega zapatillas (la primera sigue como predeterminada)");
  await p.click(`[data-ra-pred="${zs[1].id}"]`);
  await p.waitForTimeout(250);
  zs = (await p.evaluate(() => window.__fakeStore.colMap("users/test/meta").get("running_ajustes"))).zapatillas;
  ok(zs[1].predeterminada && !zs[0].predeterminada, "cambiar la predeterminada");
  await p.click('[data-ra-retirar="z1"]');
  await p.waitForTimeout(250);
  zs = (await p.evaluate(() => window.__fakeStore.colMap("users/test/meta").get("running_ajustes"))).zapatillas;
  ok(zs[0].retirada === true, "retirar (sus km quedan)");
  await captura(p, "run-ajustes.png");
  await p.evaluate(() => { location.hash = "run-progreso"; });
  await p.waitForTimeout(400);
  const metas2 = await p.$$eval(".rp-meta small", els => els.map(e => e.textContent));
  ok(metas2.join() === "Semana,Mes,Año", "la meta del mes aparece en Progreso");
  ok(!/Pegasus/.test(await tx("#rp-app")) && /Trail Gel/.test(await tx(".rp-zaps")), "las retiradas no se muestran en Progreso");

  console.log("Detalle: zonas con los ajustes nuevos y zapatillas al editar");
  await p.evaluate(() => { location.hash = "run-actividad/running/a"; });
  await p.waitForSelector(".rd-titulo");
  await p.click('.rd-acciones [data-rd="editar"]');
  await p.waitForTimeout(250);
  const opciones = await p.$$eval('#rd-form [name="zapatillaId"] option', os => os.map(o => o.textContent));
  ok(opciones.join("|") === "Sin elegir|Pegasus|Trail Gel", `la carrera con las retiradas sigue mostrando la suya (${opciones.join("|")})`);
  await p.click('[data-rdh="cancelar"]');
  ok(p.errores.length === 0, "sin errores en la página");
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  ok(ancho <= 390, `sin desborde horizontal (${ancho})`);

  console.log("\nComputadora");
  const q = await abrir(browser, base, { __SEED__: { "users/test/running": RUN, "users/test/meta": AJ } }, { hash: "#run-progreso", zona: ZONA, ancho: 1280, alto: 900, fecha: "2026-11-04T09:00:00-04:00" });
  await q.waitForSelector(".rp-total");
  ok(await q.$('#panel-run-progreso .fin-outer-tabs a[href="#run-ajustes"]') !== null, "en la compu el engranaje va con las pestañas");
  ok(await q.evaluate(() => document.documentElement.scrollWidth <= 1280), "sin desborde");
  await captura(q, "run-progreso-1280.png");
  ok(q.errores.length === 0, "sin errores");
  await terminar(browser, srv);
})();
