// Pruebas de pantalla de Running y Bicicleta (sin GPS):
// resumen semanal, rutinas guiadas de varios días (cola: la completada pasa
// al final), historial que no depende de las rutinas, registro a mano.
// Uso: node scripts/e2e/running.js [carpeta-para-capturas]
// Reloj y voz simulados (scripts/e2e/comun.js): una rutina se recorre en
// segundos. La voz y los pitidos reales se prueban en el iPhone.
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");
const AA = require("../../js/actividad-analisis.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoy = new Date();
const haceDias = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const SEED = {
  "users/test/running": {
    manual1: { date: iso(hoy), distance: 5, duration: 30, notes: "Cinta" },
    hace2: { date: haceDias(14), distance: 8, duration: 50, notes: "" },
    // Una carrera vieja grabada con GPS (con su recorrido aparte).
    gps1: { date: haceDias(28), distance: 3, duration: 18.5, notes: "", fuente: "gps", conRuta: true, tiempoActivoS: 1110 }
  },
  "users/test/rutas": { gps1: { v: 1, deporte: "running", enc: "abc", tramos: [3], n: 3 } },
  "users/test/bicicleta": { b1: { date: iso(hoy), distance: 20, duration: 60, notes: "" } }
};
// Plan de 3 días con intervalos cortos (10 s) para recorrerlo rápido.
const CSV_PLAN = "Día,orden,tipo,duracion,descripcion\n1,1,caminar,10,Calentar\n1,2,correr,10,\"Suave, sin apuro\"\n2,1,caminar,10,Calentar\n2,2,correr,10,Correr\n3,1,trotar,10,Trote\n3,2,caminar,10,Enfriar\n";

const texto = (p, sel) => p.textContent(sel).then(t => (t || "").trim());
const dichos = p => p.evaluate(() => window.__dichos.slice());
const coleccion = (p, ruta) => p.evaluate(r => [...window.__fakeStore.colMap(r).entries()], ruta);
const rutinas = async p => (await coleccion(p, "users/test/rutinas_running")).map(([id, d]) => Object.assign({ id }, d));
const listaRutinas = p => p.$$eval("#running-rutinas .rg-abrir strong", els => els.map(e => e.textContent.trim()));
// Avanza `seg` segundos de a uno (con pausas reales para que corra el reloj de avisos).
async function avanzar(p, seg) {
  for (let i = 0; i < seg; i++) {
    await p.evaluate(() => window.__adelantar(1000));
    await p.waitForTimeout(290);
  }
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  let p = await abrir(browser, base, { __SEED__: SEED }, { reloj: true, voz: true, hash: "#running" });
  await p.evaluate(() => window.__congelar());

  console.log("\nRunning: resumen semanal y sin GPS");
  const pagina = await texto(p, "#panel-running");
  ok(!pagina.includes("GPS") && !(await p.$('[data-act="preparar"]')), "ya no hay GPS (ni «Iniciar carrera» ni avisos de ubicación)");
  ok(await p.isVisible("#running-dash"), "arriba está el resumen semanal");
  ok((await texto(p, "#running-dash .dash-semana")) === AA.rangoSemana(AA.porSemana([], iso(hoy), 1)[0].desde), "muestra la semana actual");
  ok((await texto(p, '[data-dash-metrica="km"] strong')) === "5,00 km" && (await texto(p, '[data-dash-metrica="min"] strong')) === "30min", "distancia y tiempo de la semana (sin desnivel)");
  ok(!(await texto(p, "#running-dash")).includes("Desnivel"), "no muestra desnivel");
  ok((await p.$$("#running-dash .dash-punto")).length === 11 && (await p.$$("#running-dash .dash-sel")).length === 1, "gráfico de 12 semanas con la semana elegida resaltada");
  ok((await texto(p, "#running-dash .dash-sub")) === "Últimas 12 semanas", "«Últimas 12 semanas»");
  await captura(p, "run-dash.png");
  await p.click('#running-dash [data-dash-semana="9"]');
  await p.waitForTimeout(200);
  ok((await texto(p, '[data-dash-metrica="km"] strong')) === "8,00 km" && (await texto(p, '[data-dash-metrica="min"] strong')) === "50min", "tocar otra semana muestra sus km y su tiempo");
  ok((await p.$$("#running-dash .dash-punto")).length === 11, "y la resalta en el gráfico");
  await p.click('#running-dash [data-dash-metrica="min"]');
  await p.waitForTimeout(200);
  ok(await p.getAttribute('[data-dash-metrica="min"]', "aria-pressed") === "true" && (await texto(p, "#running-dash .dash-svg")).includes("h"), "tocar «Tiempo» dibuja el tiempo por semana");
  await captura(p, "run-dash-tiempo.png");
  await p.click('#running-dash [data-dash-metrica="km"]');
  await p.click('#running-dash [data-dash-semana="11"]');
  await p.waitForTimeout(200);
  ok((await texto(p, '[data-dash-metrica="km"] strong')) === "5,00 km", "volver a tocar esta semana la elige otra vez");

  console.log("\nImportar un plan de varios días");
  const [elegir] = await Promise.all([p.waitForEvent("filechooser"), p.click('#running-rutinas [data-rg="importar"]')]);
  await elegir.setFiles({ name: "Plan prueba.csv", mimeType: "text/csv", buffer: Buffer.from(CSV_PLAN) });
  await p.waitForTimeout(600);
  ok((await texto(p, ".rr-resumen")).startsWith("3 días · 6 intervalos"), "vista previa: 3 días, 6 intervalos");
  ok((await p.$$(".rr-lista li.rr-dia")).length === 3 && (await texto(p, ".rr-lista")).includes("Suave, sin apuro"), "con cada día y sus intervalos");
  ok((await p.inputValue("[data-rr-nombre]")) === "Plan prueba", "el nombre del plan sale del archivo");
  ok((await texto(p, '[data-rr="guardar"]')) === "Guardar 3 rutinas", "guarda una rutina por día");
  await captura(p, "run-csv-plan.png");
  await p.click('[data-rr="guardar"]');
  await p.waitForTimeout(600);
  let rs = await rutinas(p);
  ok(rs.length === 3 && rs.every(r => r.nombre === "Plan prueba" && r.plan === rs[0].plan) && rs.map(r => `${r.dia}:${r.orden}`).sort().join() === "1:1,2:2,3:3", "se guardan Día 1, 2 y 3 del mismo plan, en orden");
  ok((await listaRutinas(p)).join() === "Día 1,Día 2,Día 3", "la lista muestra Día 1, Día 2, Día 3");
  ok((await texto(p, "#running-rutinas .rg-item:first-child")).includes("Siguiente"), "Día 1 marcado como «Siguiente»");
  await captura(p, "run-rutinas.png");

  console.log("\nRutina guiada completa (Día 1)");
  await p.click("#running-rutinas .rg-item:first-child .rg-abrir");
  await p.waitForTimeout(300);
  ok(await p.isVisible("#running-act .act-vivo") && await p.isHidden("#running-home"), "abre la pantalla de la rutina");
  ok(await p.evaluate(() => document.body.classList.contains("act-en-curso")), "pantalla completa (sin barras)");
  ok((await texto(p, "[data-rg-tipo]")) === "Caminar" && (await texto(p, "[data-rg-resta]")) === "0:10", "primer intervalo: Caminar 0:10");
  ok((await texto(p, "[data-rg-sig]")) === "Siguiente: Correr · 0:10", "muestra el siguiente");
  ok((await texto(p, "#running-act .act-dep")) === "Plan prueba · Día 1", "con el nombre del plan y el día");
  await captura(p, "run-vivo-listo.png");
  await p.click('[data-rg="iniciar"]');
  await p.waitForTimeout(300);
  ok((await dichos(p)).includes("Empezamos: caminar durante 10 segundos."), "voz al empezar");
  await avanzar(p, 11);
  ok((await texto(p, "[data-rg-tipo]")) === "Correr" && (await dichos(p)).includes("Siguiente intervalo: correr durante 10 segundos."), "cambia solo a Correr y lo dice");
  ok((await texto(p, "[data-rg-cab]")) === "Intervalo 2 de 2", "intervalo 2 de 2");
  ok(await p.$eval('[data-rg-plan] li[data-rg-i="0"]', li => li.classList.contains("is-hecho")), "el intervalo hecho queda atenuado en la lista");
  await captura(p, "run-vivo.png");
  await avanzar(p, 10);
  ok((await dichos(p)).includes("Rutina terminada. ¡Buen trabajo!"), "voz al terminar");
  await p.waitForTimeout(2300);
  ok(await p.isVisible("#running-act .act-resumen") && (await texto(p, ".act-titulo")) === "¡Rutina completada!", "al terminar pasa solo al resumen");
  ok((await texto(p, ".act-tiles")).includes("2 de 2 ✓") && (await texto(p, ".act-tiles")).includes("0:20"), "resumen: 0:20 y 2 de 2 intervalos");
  ok(!(await p.$('[data-rg="volver"]')), "completada: no ofrece volver a la rutina");
  await p.fill("[data-rg-km]", "abc");
  await p.click('[data-rg="guardar"]');
  ok(await p.isVisible("[data-rg-error]"), "km inválidos: avisa y no guarda");
  await p.fill("[data-rg-km]", "2,5");
  await p.selectOption("[data-rg-rpe]", "6");
  await p.fill("[data-rg-notas]", "Primera del plan");
  await captura(p, "run-resumen.png");
  await p.click('[data-rg="guardar"]');
  await p.waitForTimeout(600);
  let hist = (await coleccion(p, "users/test/running")).map(([id, d]) => Object.assign({ id }, d)).filter(d => d.fuente === "rutina");
  const h1 = hist[0];
  ok(hist.length === 1 && h1.rutina.nombre === "Plan prueba · Día 1" && h1.rutina.completados === 2 && h1.rutina.total === 2, "queda en el historial con el nombre de la rutina");
  ok(h1 && h1.distance === 2.5 && h1.tiempoActivoS === 20 && h1.rpe === 6 && h1.notes === "Primera del plan" && h1.duration > 0, "con km, tiempo, RPE y notas");
  rs = await rutinas(p);
  ok(rs.find(r => r.dia === 1).orden === 4, "Día 1 pasa al final (orden 4)");
  ok((await listaRutinas(p)).join() === "Día 2,Día 3,Día 1", "la lista queda Día 2, Día 3, Día 1");
  ok((await texto(p, "#running-rutinas .act-ok")).includes("Pasó al final"), "y lo avisa");
  ok((await texto(p, "#running-list")).includes("Plan prueba · Día 1") && (await texto(p, "#running-list")).includes("Rutina"), "aparece en «Tus carreras»");
  ok((await texto(p, '[data-dash-metrica="km"] strong')) === "7,50 km", "y suma al resumen de la semana");
  ok(await p.evaluate(() => localStorage.getItem("manolo.rutina.test")) === null, "el borrador del teléfono se borra");
  await captura(p, "run-cola.png");

  console.log("\nRutina sin terminar: pausa, recuperar y guardar (Día 2)");
  await p.click("#running-rutinas .rg-item:first-child .rg-abrir");
  await p.waitForTimeout(300);
  await p.click('[data-rg="iniciar"]');
  await p.waitForTimeout(200);
  await avanzar(p, 5);
  await p.click('[data-rg="pausar"]');
  await p.waitForTimeout(200);
  const resta = await texto(p, "[data-rg-resta]");
  await p.evaluate(() => window.__adelantar(60000));
  await p.waitForTimeout(500);
  ok((await texto(p, "[data-rg-resta]")) === resta, "en pausa el tiempo no corre");
  await p.reload();
  await p.waitForTimeout(1000);
  ok(await p.isVisible("#running-act .act-vivo") && await p.isVisible('[data-rg="reanudar"]'), "al reabrir Manolo recupera la rutina en pausa");
  ok((await texto(p, "[data-rg-resta]")) === resta, "donde iba");
  await p.evaluate(() => { location.hash = "inicio"; });
  await p.waitForTimeout(300);
  ok(await p.isVisible('[data-act-en-curso="running"]'), "en Inicio avisa «Tienes una rutina sin terminar»");
  await p.evaluate(() => { location.hash = "running"; });
  await p.waitForTimeout(300);
  const nDichos = (await dichos(p)).length;
  await p.click('[data-rg="reanudar"]');
  await p.waitForTimeout(400);
  ok((await dichos(p)).length === nDichos, "al reanudar no repite avisos viejos");
  await p.click('[data-rg="pausar"]');
  await p.waitForTimeout(200);
  await p.click('[data-rg="finalizar"]');
  await p.waitForTimeout(400);
  ok((await texto(p, ".act-titulo")) === "Rutina terminada" && (await texto(p, ".act-tiles")).includes("0 de 2"), "resumen: «Rutina terminada», 0 de 2 intervalos");
  ok(await p.isVisible('[data-rg="volver"]'), "se puede volver a la rutina");
  await p.click('[data-rg="guardar"]');
  await p.waitForTimeout(600);
  hist = (await coleccion(p, "users/test/running")).map(([, d]) => d).filter(d => d.fuente === "rutina");
  const h2 = hist.find(d => d.rutina.nombre === "Plan prueba · Día 2");
  ok(h2 && h2.distance === 0 && h2.rutina.completados === 0, "sin terminar también queda en el historial (sin km)");
  ok((await listaRutinas(p)).join() === "Día 2,Día 3,Día 1", "sin terminar no se mueve: Día 2 sigue primero");
  ok((await texto(p, "#running-list")).includes("(0 de 2 intervalos)"), "el historial dice cuántos intervalos hiciste");

  console.log("\nVoz apagada y descartar");
  await p.click("#running-rutinas .rg-item:first-child .rg-abrir");
  await p.waitForTimeout(300);
  await p.click('[data-rg="voz"]');
  ok(await p.getAttribute('[data-rg="voz"]', "aria-pressed") === "false", "se puede apagar la voz");
  const n2 = (await dichos(p)).length;
  await p.click('[data-rg="iniciar"]');
  await p.waitForTimeout(400);
  ok((await dichos(p)).length === n2, "con la voz apagada no habla");
  await p.click('[data-rg="pausar"]');
  await p.waitForTimeout(200);
  await p.click('[data-rg="finalizar"]');
  await p.waitForTimeout(300);
  await p.click('[data-rg="descartar"]');
  await p.waitForTimeout(400);
  ok((await coleccion(p, "users/test/running")).length === 5, "descartar no guarda nada");
  await p.evaluate(() => Avisos.cambiar("voz", true));

  console.log("\nBorrar rutinas no borra el historial");
  await p.evaluate(() => { const r = [true, false]; window.confirm = () => r.shift(); });
  await p.click("#running-rutinas .rg-item:first-child .act-rutina-borrar");
  await p.waitForTimeout(400);
  ok((await rutinas(p)).map(r => r.dia).sort().join() === "1,3", "borrar un día (sin el resto del plan) deja los otros");
  await p.evaluate(() => { const r = [true, true]; window.confirm = () => r.shift(); });
  await p.click("#running-rutinas .rg-item:first-child .act-rutina-borrar");
  await p.waitForTimeout(400);
  ok((await rutinas(p)).length === 0, "o se puede borrar el plan entero");
  hist = (await coleccion(p, "users/test/running")).map(([, d]) => d).filter(d => d.fuente === "rutina");
  ok(hist.length === 2 && (await texto(p, "#running-list")).includes("Plan prueba · Día 1"), "el historial de esas rutinas sigue en la lista");
  ok((await texto(p, "#running-rutinas")).includes("Importa tus rutinas"), "sin rutinas: explica cómo importar");

  console.log("\nHistorial y registro a mano");
  await p.evaluate(() => { window.confirm = () => true; });
  const items = await p.$$("#running-list .list-item");
  for (const it of items) { if ((await it.textContent()).includes("3.00 km")) { await (await it.$(".delete")).click(); break; } }
  await p.waitForTimeout(400);
  ok(!(await coleccion(p, "users/test/running")).some(([id]) => id === "gps1") && (await coleccion(p, "users/test/rutas")).length === 0, "borrar una carrera vieja con GPS borra también su recorrido");
  await p.click("#panel-running .act-manual summary");
  await p.fill("#running-distance", "4");
  await p.fill("#running-duration", "25");
  await p.click("#running-form button[type=submit]");
  await p.waitForTimeout(400);
  ok((await texto(p, '[data-dash-metrica="km"] strong')) === "11,50 km", "registrar a mano suma al resumen de la semana");
  await captura(p, "run-lista.png");
  await p.context().close();

  console.log("\nBicicleta");
  p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#bicicleta" });
  ok(!(await texto(p, "#panel-bicicleta")).includes("GPS") && !(await p.$("#cycling-act")), "sin GPS");
  ok(await p.isVisible("#cycling-dash") && (await texto(p, '#cycling-dash [data-dash-metrica="km"] strong')) === "20,00 km" && (await texto(p, '#cycling-dash [data-dash-metrica="min"] strong')) === "1h", "resumen semanal de la bici");
  await p.click("#panel-bicicleta .act-manual summary");
  await p.fill("#cycling-distance", "15.5");
  await p.fill("#cycling-duration", "45");
  await p.click("#cycling-form button[type=submit]");
  await p.waitForTimeout(400);
  ok((await texto(p, '#cycling-dash [data-dash-metrica="km"] strong')) === "35,50 km" && (await texto(p, '#cycling-dash [data-dash-metrica="min"] strong')) === "1h 45min", "registrar una rodada suma a la semana");
  ok((await texto(p, "#cycling-list")).includes("km/h"), "la lista muestra la velocidad");
  await captura(p, "bici-dash.png");
  await p.context().close();

  console.log("\nComputadora");
  p = await abrir(browser, base, { __SEED__: SEED }, { ancho: 1280, alto: 800, hash: "#running" });
  const ancho = await p.$eval("#running-dash", el => el.getBoundingClientRect().width);
  ok(ancho > 300 && (await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, `el resumen se ve bien en la compu (${Math.round(ancho)} px)`);
  await captura(p, "run-compu.png");
  await p.context().close();

  await terminar(browser, srv);
})();
