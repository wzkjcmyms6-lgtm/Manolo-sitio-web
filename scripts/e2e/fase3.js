// Pruebas de pantalla de la Fase 3 (Running con GPS).
// Uso: node scripts/e2e/fase3.js [carpeta-para-capturas]
// El GPS y el reloj son simulados (scripts/e2e/comun.js): una carrera de
// varios minutos se recorre en segundos. El GPS real se prueba en el iPhone.
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const SEED = {
  "users/test/running": { manual1: { date: "2026-09-20", distance: 5, duration: 30, notes: "Cinta" } },
  "users/test/meta": { perfil_ejercicio: { sexo: "hombre", pesajes: { "2026-09-01": 80 } } }
};
const LAT = -16.5, LON = -68.13, M = 111195;

// Corre `seg` segundos a `v` m/s hacia el norte desde `m0` metros (un punto por segundo).
function correr(p, m0, seg, v, acc = 6) {
  return p.evaluate(([m0, seg, v, acc, LAT, LON, M]) => {
    for (let i = 1; i <= seg; i++) { window.__adelantar(1000); window.__gps(LAT + (m0 + v * i) / M, LON, acc, 3600 + (m0 + v * i) * 0.02); }
  }, [m0, seg, v, acc, LAT, LON, M]);
}
const texto = (p, sel) => p.textContent(sel).then(t => (t || "").trim());
const actividades = p => p.evaluate(() => [...window.__fakeStore.colMap("users/test/running").entries()]);
const rutas = p => p.evaluate(() => [...window.__fakeStore.colMap("users/test/rutas").entries()]);

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();

  console.log("\nRunning: pantalla inicial");
  let p = await abrir(browser, base, { __SEED__: SEED }, { gps: true, hash: "#running" });
  await p.evaluate(() => { window.__permiso = "granted"; window.__congelar(); });
  ok(await p.isHidden("#verse-banner"), "Running ya no muestra el versículo");
  ok(await p.isVisible('#panel-running [data-act="preparar"]'), "se ve «Iniciar carrera»");
  ok((await texto(p, "#running-list")).includes("5.00 km"), "la lista conserva las carreras anotadas a mano");
  ok(await p.isVisible("#panel-running .act-manual summary"), "el registro a mano sigue disponible (desplegable)");
  await captura(p, "f3-inicio.png");

  console.log("\nPreparar y GPS");
  await p.click('#panel-running [data-act="preparar"]');
  await p.waitForTimeout(300);
  ok(await p.isVisible("#panel-running .act-vivo"), "abre la pantalla de la carrera");
  ok(await p.evaluate(() => document.body.classList.contains("act-en-curso")), "pantalla completa: sin barras de arriba y abajo");
  ok(await p.isHidden(".topbar") && await p.isHidden("#bottom-nav-links"), "barras ocultas en el teléfono");
  ok((await texto(p, "#panel-running [data-act-gps]")) === "Buscando GPS…", "avisa que está buscando GPS");
  ok(await p.evaluate(() => window.__vigilantes()) === 1, "empieza a escuchar el GPS");
  await p.evaluate(([LAT, LON]) => window.__gps(LAT, LON, 40), [LAT, LON]);
  await p.waitForTimeout(150);
  ok((await texto(p, "#panel-running [data-act-gps]")) === "GPS impreciso", "con mala precisión dice «GPS impreciso»");
  await p.evaluate(([LAT, LON]) => window.__gps(LAT, LON, 6), [LAT, LON]);
  await p.waitForTimeout(150);
  ok((await texto(p, "#panel-running [data-act-gps]")).startsWith("GPS listo"), "con buena precisión dice «GPS listo»");
  await captura(p, "f3-preparar.png");

  console.log("\nCorrer, pausar, recuperar");
  await p.click('#panel-running [data-act="iniciar"]');
  await p.waitForTimeout(200);
  ok(await p.isVisible('#panel-running [data-act="pausar"]'), "al iniciar aparece Pausar");
  await correr(p, 0, 300, 3);              // 900 m en 5 min
  await p.waitForTimeout(1200);
  const dist = await texto(p, "#panel-running [data-act-dist]");
  ok(/^0,(89|90|91)$/.test(dist), `distancia en vivo ≈ 0,90 km (${dist})`);
  ok((await texto(p, "#panel-running [data-act-tiempo]")) === "5:00", "tiempo en vivo 5:00");
  const ritmo = await texto(p, "#panel-running [data-act-actual]");
  ok(/^5:(3[0-9])$/.test(ritmo), `ritmo actual ≈ 5:33 /km (${ritmo})`);
  ok(await p.$eval("#panel-running [data-act-ruta]", el => !!el.querySelector("polyline")), "se dibuja el recorrido");
  await captura(p, "f3-corriendo.png");
  await p.click('#panel-running [data-act="pausar"]');
  await p.waitForTimeout(200);
  ok(await p.isVisible('#panel-running [data-act="reanudar"]') && await p.isVisible('#panel-running [data-act="finalizar"]'), "en pausa: Reanudar y Finalizar");
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem("manolo.actividad.test")).st.estado) === "pausado", "el estado queda guardado en el teléfono");
  await p.addInitScript(() => { window.__gpsPausaMs = 1500; });
  await p.reload();
  await p.waitForTimeout(900);
  ok(await p.isVisible("#panel-running .act-vivo") && await p.isVisible('#panel-running [data-act="reanudar"]'), "al reabrir Manolo recupera la carrera en pausa");
  ok((await texto(p, "#panel-running [data-act-dist]")).startsWith("0,9"), "con la distancia que llevaba");
  await p.click('#panel-running [data-act="reanudar"]');
  await p.waitForTimeout(200);
  await correr(p, 900, 100, 3);            // +300 m
  await p.click('#panel-running [data-act="pausar"]');
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => window.__vigilantes()) === 1, "en pausa corta el GPS sigue listo");
  await p.waitForTimeout(1800);
  ok(await p.evaluate(() => window.__vigilantes()) === 0 && (await texto(p, "#panel-running [data-act-gps]")) === "GPS en pausa", "en pausa larga se apaga el GPS (ahorra batería)");

  console.log("\nResumen y guardado");
  await p.click('#panel-running [data-act="finalizar"]');
  await p.waitForTimeout(600);
  ok(await p.isVisible("#panel-running .act-resumen"), "Finalizar abre el resumen");
  const resumen = await texto(p, "#panel-running .act-resumen");
  ok(resumen.includes("Carrera completada") && /1,(19|20|21) km/.test(resumen), "resumen con la distancia total");
  ok(resumen.includes("Ritmo medio") && resumen.includes("En movimiento") && resumen.includes("Tiempo total"), "tiempos y ritmo medio");
  ok(resumen.includes("Desnivel") && resumen.includes("aprox."), "desnivel (aproximado, del GPS)");
  ok(resumen.includes("Calorías") && resumen.includes("estimado"), "calorías marcadas como estimadas (con tu peso)");
  ok((await p.$$("#panel-running .act-parciales li")).length === 1, "parciales: 1 km completo");
  await p.waitForTimeout(800);
  ok(await p.$("#panel-running .act-mapa .leaflet-container") !== null, "mapa con calles (Leaflet) en el resumen");
  await captura(p, "f3-resumen.png");
  await p.click('#panel-running [data-act="volver"]');
  await p.waitForTimeout(300);
  ok(await p.isVisible('#panel-running [data-act="reanudar"]'), "«Volver a la carrera» regresa a la pausa");
  await p.click('#panel-running [data-act="finalizar"]');
  await p.waitForTimeout(400);
  await p.selectOption("#panel-running [data-act-rpe]", "6");
  await p.fill("#panel-running [data-act-notas]", "Primera con GPS");
  await p.click('#panel-running [data-act="guardar"]');
  await p.waitForTimeout(600);
  const acts = (await actividades(p)).filter(([id]) => id !== "manual1");
  const d = acts[0] && acts[0][1];
  ok(acts.length === 1 && d.fuente === "gps", "se guardó la carrera");
  ok(d && Math.abs(d.distance - 1.2) < 0.03 && d.duration > 6.5 && d.rpe === 6 && d.notes === "Primera con GPS", "con km, minutos, RPE y notas como antes");
  ok(d && d.tiempoActivoS === 400 && d.parciales.length === 1, "y los datos del GPS (tiempos, parciales)");
  const rs = await rutas(p);
  ok(rs.length === 1 && rs[0][0] === acts[0][0] && rs[0][1].enc.length > 10, "la ruta se guardó aparte con el mismo id");
  ok(await p.evaluate(() => localStorage.getItem("manolo.actividad.test")) === null, "el borrador del teléfono se borra al guardar");
  ok(await p.isVisible("#panel-running .act-ok") && !(await p.evaluate(() => document.body.classList.contains("act-en-curso"))), "vuelve al inicio con «Carrera guardada»");
  ok(await p.evaluate(() => window.__vigilantes()) === 0, "el GPS se apaga al terminar");
  ok((await texto(p, "#running-list")).includes("GPS"), "la carrera aparece en la lista con su etiqueta GPS");
  await captura(p, "f3-lista.png");

  console.log("\nVer y eliminar una carrera guardada");
  await p.click("#panel-running .act-item-abrir");
  await p.waitForTimeout(900);
  ok(await p.isVisible("#panel-running .act-resumen") && (await texto(p, "#panel-running .act-titulo")) === "Tu carrera", "abre el resumen guardado");
  ok(await p.$("#panel-running .act-mapa .leaflet-container, .act-mapa polyline") !== null, "con su recorrido");
  await p.click('#panel-running [data-act="eliminar"]');
  await p.waitForTimeout(500);
  ok((await actividades(p)).length === 1 && (await rutas(p)).length === 0, "eliminar borra la carrera y su ruta");

  console.log("\nRegistro a mano (regresión)");
  await p.click("#panel-running .act-manual summary");
  await p.fill("#running-distance", "3");
  await p.fill("#running-duration", "20");
  await p.click("#running-form button[type=submit]");
  await p.waitForTimeout(400);
  ok((await actividades(p)).length === 2, "registrar a mano sigue funcionando");
  await p.context().close();

  console.log("\nPermiso de ubicación denegado");
  p = await abrir(browser, base, { __SEED__: SEED }, { gps: true, hash: "#running" });
  await p.evaluate(() => { window.__permiso = "denied"; location.hash = "inicio"; });
  await p.waitForTimeout(200);
  await p.evaluate(() => { location.hash = "running"; });
  await p.waitForTimeout(200);
  await p.evaluate(() => { document.querySelector('#panel-running [data-act="preparar"]').click(); });
  await p.waitForTimeout(200);
  await p.evaluate(() => window.__gpsError(1));
  await p.waitForTimeout(200);
  const nota = await texto(p, "#panel-running [data-act-nota]");
  ok(nota.includes("no tiene permiso") && nota.includes("Ajustes"), "explica cómo dar permiso en el iPhone");
  ok((await texto(p, "#panel-running [data-act-gps]")) === "GPS no disponible", "y lo marca en el indicador");
  await p.click('#panel-running [data-act="cancelar"]');
  await p.waitForTimeout(200);
  ok(await p.isVisible('#panel-running [data-act="preparar"]'), "Cancelar vuelve al inicio");
  await p.context().close();

  await terminar(browser, srv);
})();
