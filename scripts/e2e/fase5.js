// Pruebas de pantalla de la Fase 5 (Bicicleta con GPS).
// Uso: node scripts/e2e/fase5.js [carpeta-para-capturas]
// GPS y reloj simulados (scripts/e2e/comun.js).
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const SEED = { "users/test/bicicleta": { manual1: { date: "2026-09-21", distance: 20, duration: 60, notes: "Rodillo" } } };
const LAT = -16.5, LON = -68.13, M = 111195;

function rodar(p, m0, seg, v) {
  return p.evaluate(([m0, seg, v, LAT, LON, M]) => {
    for (let i = 1; i <= seg; i++) { window.__adelantar(1000); window.__gps(LAT + (m0 + v * i) / M, LON, 6); }
  }, [m0, seg, v, LAT, LON, M]);
}
const texto = (p, sel) => p.textContent(sel).then(t => (t || "").trim());
const docs = (p, c) => p.evaluate(c => [...window.__fakeStore.colMap(c).entries()], c);

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();

  console.log("\nBicicleta: inicio");
  const p = await abrir(browser, base, { __SEED__: SEED }, { gps: true, hash: "#bicicleta" });
  await p.evaluate(() => { window.__permiso = "granted"; window.__congelar(); });
  ok(await p.isHidden("#verse-banner"), "Bicicleta ya no muestra el versículo");
  ok((await texto(p, '#panel-bicicleta [data-act="preparar"]')).includes("Iniciar rodada"), "se ve «Iniciar rodada»");
  ok((await texto(p, "#cycling-list")).includes("20.00 km") && (await texto(p, "#cycling-stats")).includes("20.0 km/h"), "conserva las rodadas a mano y la velocidad promedio");
  ok(!(await p.$("#panel-bicicleta .act-rutinas")), "sin rutinas de intervalos (son de Running)");
  await captura(p, "f5-inicio.png");

  console.log("\nRodar");
  await p.click('#panel-bicicleta [data-act="preparar"]');
  await p.waitForTimeout(300);
  ok((await texto(p, "#panel-bicicleta .act-principal .act-lbl")) === "Velocidad", "en bici el número grande es la velocidad");
  await p.evaluate(([LAT, LON]) => window.__gps(LAT, LON, 6), [LAT, LON]);
  await p.click('#panel-bicicleta [data-act="iniciar"]');
  await p.waitForTimeout(200);
  await rodar(p, 0, 700, 8);        // 5,6 km a 28,8 km/h
  await p.waitForTimeout(1200);
  ok((await texto(p, "#panel-bicicleta [data-act-actual]")) === "28,8", `velocidad actual 28,8 km/h (${await texto(p, "#panel-bicicleta [data-act-actual]")})`);
  ok(/^5,(59|60|61)$/.test(await texto(p, "#panel-bicicleta [data-act-dist]")), `distancia 5,60 km (${await texto(p, "#panel-bicicleta [data-act-dist]")})`);
  ok((await texto(p, "#panel-bicicleta [data-act-medio]")) === "28,8", "velocidad media 28,8");
  ok((await texto(p, "#panel-bicicleta [data-act-tiempo]")) === "11:40", "tiempo 11:40");
  await captura(p, "f5-rodando.png");
  await p.click('#panel-bicicleta [data-act="pausar"]');
  await p.waitForTimeout(200);
  await p.click('#panel-bicicleta [data-act="finalizar"]');
  await p.waitForTimeout(800);

  console.log("\nResumen y guardado");
  const r = await texto(p, "#panel-bicicleta .act-resumen");
  ok(r.includes("Rodada completada"), "«Rodada completada»");
  ok(r.includes("Velocidad media") && r.includes("28,8 km/h") && r.includes("Velocidad máx."), "velocidad media y máxima");
  ok(!r.includes("Calorías"), "sin calorías en bici (no hay un método fiable)");
  ok((await p.$$("#panel-bicicleta .act-parciales li")).length === 1 && (await texto(p, "#panel-bicicleta .act-parciales li")).startsWith("5 km"), "parcial de 5 km");
  ok(await p.$("#panel-bicicleta .act-mapa .leaflet-container") !== null, "mapa en el resumen");
  await captura(p, "f5-resumen.png");
  await p.click('#panel-bicicleta [data-act="guardar"]');
  await p.waitForTimeout(600);
  const bici = (await docs(p, "users/test/bicicleta")).filter(([id]) => id !== "manual1");
  const d = bici[0] && bici[0][1];
  ok(bici.length === 1 && d.fuente === "gps" && Math.abs(d.distance - 5.6) < 0.03 && d.velMaxKmh >= 28 && d.velMaxKmh < 31, "se guardó en Bicicleta con km, minutos y velocidad máxima");
  const rutas = await docs(p, "users/test/rutas");
  ok(rutas.length === 1 && rutas[0][0] === bici[0][0] && rutas[0][1].deporte === "bicicleta", "la ruta se guardó aparte");
  ok((await docs(p, "users/test/running")).length === 0, "no se mezcla con Running");
  ok((await texto(p, "#cycling-list")).includes("GPS") && (await texto(p, "#cycling-list")).includes("28.8 km/h"), "la rodada aparece en la lista con su velocidad");

  console.log("\nVer, eliminar y registrar a mano");
  await p.click("#panel-bicicleta .act-item-abrir");
  await p.waitForTimeout(800);
  ok((await texto(p, "#panel-bicicleta .act-titulo")) === "Tu rodada", "abre el resumen guardado");
  await p.click('#panel-bicicleta [data-act="eliminar"]');
  await p.waitForTimeout(400);
  ok((await docs(p, "users/test/bicicleta")).length === 1 && (await docs(p, "users/test/rutas")).length === 0, "eliminar borra la rodada y su ruta");
  await p.click("#panel-bicicleta .act-manual summary");
  await p.fill("#cycling-distance", "12");
  await p.fill("#cycling-duration", "40");
  await p.click("#cycling-form button[type=submit]");
  await p.waitForTimeout(400);
  ok((await docs(p, "users/test/bicicleta")).length === 2, "registrar a mano sigue funcionando");

  console.log("\nUna actividad a la vez");
  await p.evaluate(() => { location.hash = "running"; });
  await p.waitForTimeout(300);
  await p.click('#running-act [data-act="preparar"]');
  await p.waitForTimeout(200);
  await p.evaluate(([LAT, LON]) => window.__gps(LAT, LON, 6), [LAT, LON]);
  await p.click('#running-act [data-act="iniciar"]');
  await p.waitForTimeout(200);
  await p.click('#running-act [data-act="pausar"]');
  await p.waitForTimeout(200);
  await p.evaluate(() => { location.hash = "bicicleta"; });
  await p.waitForTimeout(300);
  await p.reload();
  await p.waitForTimeout(900);
  ok(await p.isDisabled('#cycling-act [data-act="preparar"]'), "con una carrera sin terminar no deja iniciar una rodada");
  ok((await texto(p, "#cycling-act [data-act-permiso]")).includes("otra actividad"), "y explica por qué");
  await p.evaluate(() => { location.hash = "inicio"; });
  await p.waitForTimeout(300);
  ok(await p.isVisible('[data-act-en-curso="running"]') && await p.isHidden('[data-act-en-curso="bicicleta"]'), "Inicio avisa la carrera sin terminar");
  await captura(p, "f5-aviso-inicio.png");

  await terminar(browser, srv);
})();
