// Pruebas de pantalla de la Fase 6 (historial y análisis de Running y Bici).
// Uso: node scripts/e2e/fase6.js [carpeta-para-capturas]
// Las actividades de ejemplo se generan con el motor real (ruta, parciales,
// altitud), como si se hubieran grabado con GPS.
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");
const AM = require("../../js/actividad-motor.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const M = 111195, DIA = 86400000;

// Graba una actividad: tramos [[segundos, m/s]], con subida suave.
function grabar(deporte, diasAtras, tramos) {
  const t0 = Date.now() - diasAtras * DIA;
  const st = AM.crear(deporte);
  AM.iniciar(st, t0);
  let s = 0, m = 0;
  AM.punto(st, { lat: -16.5, lon: -68.13, t: t0, acc: 5, alt: 3600 });
  tramos.forEach(([seg, v]) => {
    for (let i = 0; i < seg; i++) {
      s++; m += v;
      AM.punto(st, { lat: -16.5 + m / M, lon: -68.13, t: t0 + s * 1000, acc: 5, alt: 3600 + m * 0.01 });
    }
  });
  AM.finalizar(st, t0 + s * 1000);
  return AM.resumen(st);
}
function semilla() {
  const seed = { "users/test/running": {}, "users/test/bicicleta": {}, "users/test/rutas": {} };
  const poner = (col, id, r) => { seed[`users/test/${col}`][id] = r.documento; seed["users/test/rutas"][id] = r.ruta; };
  poner("running", "r1", grabar("running", 2, [[600, 3], [400, 3.6], [300, 2.8]]));   // ~4,7 km con cambios de ritmo
  poner("running", "r2", grabar("running", 9, [[1900, 3.2]]));                        // ~6,1 km parejo
  poner("running", "r3", grabar("running", 30, [[900, 3.4]]));                        // ~3,1 km
  seed["users/test/running"].manual = { date: AM.fechaLocal(Date.now() - 5 * DIA), distance: 21, duration: 120, notes: "Media maratón a mano" };
  poner("bicicleta", "b1", grabar("bicicleta", 3, [[800, 7.5], [400, 9]]));           // ~9,6 km
  return seed;
}
const texto = (p, sel) => p.textContent(sel).then(t => (t || "").trim());

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: semilla() }, { hash: "#running" });
  await p.waitForTimeout(500);

  console.log("\nRunning: Tu progreso");
  const prog = "#running-progreso";
  ok(await p.isVisible(prog) && (await texto(p, prog)).includes("Tu progreso"), "aparece «Tu progreso»");
  ok((await p.$$(`${prog} .ejd-col`)).length === 12, "barras de las últimas 12 semanas");
  const tend = await texto(p, `${prog} .act-tend`);
  ok(/Últimas 4 semanas: \d+,\d km/.test(tend) && tend.includes("ritmo medio"), `tendencia con distancia y ritmo medio (${tend})`);
  await p.click(`${prog} [data-act-metrica="min"]`);
  await p.waitForTimeout(200);
  ok(await p.getAttribute(`${prog} [data-act-metrica="min"]`, "aria-pressed") === "true" && /min|h/.test(await texto(p, `${prog} .ejd-ejey`)), "se puede ver el tiempo por semana");
  await p.click(`${prog} [data-act-metrica="km"]`);
  await p.waitForTimeout(200);
  const marcas = await texto(p, `${prog} .act-marcas`);
  ok(marcas.includes("Mejor 1 km") && marcas.includes("Mejor 5 km") && marcas.includes("Carrera más larga"), "mejores marcas: 1 km, 5 km y la más larga");
  ok(!marcas.includes("21,00 km"), "la carrera anotada a mano no cuenta como marca");
  ok(!marcas.includes("Mejor 10 km"), "sin carreras de 10 km no se inventa esa marca");
  ok((await p.$$("#running-list .act-mes")).length >= 1, "la lista se separa por meses");
  await captura(p, "f6-progreso.png");

  console.log("\nDetalle de una carrera");
  await p.click(`${prog} [data-act-marca="r1"]`);
  await p.waitForTimeout(1000);
  ok((await texto(p, "#panel-running .act-titulo")) === "Tu carrera", "tocar una marca abre esa carrera");
  ok(await p.$("#panel-running .act-linea.is-ritmo path") !== null, "gráfico de ritmo a lo largo del recorrido");
  ok(await p.$("#panel-running .act-linea.is-alt path") !== null, "gráfico de altitud");
  ok(await p.$("#panel-running .act-parciales li.is-mejor") !== null && await p.$("#panel-running .act-parciales li.is-peor") !== null, "parciales: el mejor y el peor resaltados");
  await captura(p, "f6-detalle.png");
  await p.click('#panel-running [data-act="cerrar"]');
  await p.waitForTimeout(300);

  console.log("\nBicicleta");
  await p.evaluate(() => { location.hash = "bicicleta"; });
  await p.waitForTimeout(500);
  const bm = await texto(p, "#cycling-progreso .act-marcas");
  ok(bm.includes("Rodada más larga") && bm.includes("Mejor velocidad media") && bm.includes("Mejor 5 km"), "marcas de bici: más larga, velocidad media y 5 km");
  ok((await texto(p, "#cycling-progreso .act-tend")).includes("velocidad media"), "tendencia con velocidad media");
  await p.click('#cycling-progreso [data-act-marca="b1"]');
  await p.waitForTimeout(1000);
  ok(await p.$("#panel-bicicleta .act-linea.is-vel path") !== null, "gráfico de velocidad a lo largo de la rodada");
  await captura(p, "f6-bici.png");

  await terminar(browser, srv);
})();
