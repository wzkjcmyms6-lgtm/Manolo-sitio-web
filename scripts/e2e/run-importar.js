// Pruebas de pantalla de Running › Importar (fase 1 del plan "al nivel de
// Strava"): ZIP del export (activities.csv + FIT.gz + GPX), GPX suelto sin
// deporte, duplicada, fusión con una rutina guiada y con una carrera a mano,
// otros deportes, archivo roto, guardado, historial, clima y lugar.
// Uso: node scripts/e2e/run-importar.js [carpeta-para-capturas]
const zlib = require("node:zlib");
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");
const X = require("../../tests/run-fixtures.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const RUN = "users/test/running", BICI = "users/test/bicicleta", RUTAS = "users/test/rutas";
const t = s => Date.parse(s);

// Actividades de los archivos
const P111 = X.puntos({ segundos: 1500, vel: 3.2, fc: 150, cad: 85, subida: 40, inicio: t("2026-11-03T06:40:00-04:00") });
const P112 = X.puntos({ segundos: 1800, vel: 7, inicio: t("2026-11-01T08:00:00-04:00") });
const P113 = X.puntos({ segundos: 1200, vel: 1.3, inicio: t("2026-10-31T09:00:00-04:00") });
const P222 = X.puntos({ segundos: 900, vel: 3, inicio: t("2026-10-20T07:00:00-04:00") });
const PSUELTO = X.puntos({ segundos: 1600, vel: 3.1, fc: 148, inicio: t("2026-10-30T18:30:00-04:00") });

const CAB = "Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,Elapsed Time,Distance,Max Heart Rate,Relative Effort,Commute,Activity Private Note,Activity Gear,Filename,Athlete Weight,Bike Weight,Elapsed Time,Moving Time,Distance,Max Speed,Average Speed,Elevation Gain";
const fila = (id, fecha, nombre, tipo, seg, m, archivo, desc) => `${id},"${fecha}",${nombre},${tipo},"${desc || ""}",${seg},${(m / 1000).toFixed(2)},,,false,,,${archivo},,,${seg}.0,${seg}.0,${m}.0,,,0`;
const CSV = [CAB,
  fila(111, "Nov 3, 2026, 10:40:00 AM", "Fondo por el Prado", "Run", 1500, 4800, "activities/111.fit.gz", "Con frío, buen ritmo"),
  fila(112, "Nov 1, 2026, 12:00:00 PM", "Rodada a Mallasa", "Ride", 1800, 12600, "activities/112.gpx"),
  fila(113, "Oct 31, 2026, 1:00:00 PM", "Paseo", "Walk", 1200, 1560, "activities/113.gpx"),
  fila(114, "Oct 28, 2026, 11:00:00 AM", "Cinta del gimnasio", "Run", 1800, 5000, ""),
  fila(115, "Oct 25, 2026, 11:00:00 AM", "Sin archivo en el ZIP", "Run", 1500, 4500, "activities/115.fit"),
  fila(222, "Oct 20, 2026, 11:00:00 AM", "Ya importada", "Run", 900, 2700, "activities/222.gpx")
].join("\n") + "\n";
const ZIP = X.zip([
  { nombre: "export_123/activities.csv", datos: CSV, metodo: 8 },
  { nombre: "export_123/activities/111.fit.gz", datos: new Uint8Array(zlib.gzipSync(Buffer.from(X.fit(P111)))), metodo: 0 },
  { nombre: "export_123/activities/112.gpx", datos: X.gpx(P112, { tipo: "1", nombre: "Ride" }), metodo: 8 },
  { nombre: "export_123/activities/113.gpx", datos: X.gpx(P113, { tipo: "10" }), metodo: 8 },
  { nombre: "export_123/activities/222.gpx", datos: X.gpx(P222), metodo: 8 },
  { nombre: "export_123/media/foto.jpg", datos: new Uint8Array(20000), metodo: 0 }
]);

const SEED = {
  [RUN]: {
    // Rutina guiada hecha con el teléfono mientras el reloj grababa la 111.
    rut1: { fuente: "rutina", date: "2026-11-03", distance: 0, duration: 24, notes: "", inicio: P111[0].t + 60000, fin: P111[0].t + 1500000, tiempoActivoS: 1440, rutina: { id: "r5k", nombre: "Plan 5K · Día 2", completados: 8, total: 8 }, rpe: 6 },
    // Anotada a mano el mismo día que el GPX suelto.
    m1: { date: "2026-10-30", distance: 5, duration: 27, rpe: 7, notes: "Con viento" },
    imp_222: { v: 2, fuente: "importado", date: "2026-10-20", distance: 2.7, duration: 15, inicio: P222[0].t, distanciaM: 2700, origen: { idExterno: "222" } },
    viejo: { date: "2026-09-10", distance: 8, duration: 45, notes: "" }
  }
};

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  for (const ancho of [390, 1280]) {
    console.log(`\n=== Ancho ${ancho} px`);
    const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#running", zona: ZONA, ancho, alto: ancho > 800 ? 900 : 844, fecha: "2026-11-04T09:00:00-04:00" });
    const pedidos = [];
    await p.context().route(/open-meteo\.com/, r => {
      pedidos.push(r.request().url());
      const dia = new URL(r.request().url()).searchParams.get("start_date");
      const time = Array.from({ length: 24 }, (_, h) => `${dia}T${String(h).padStart(2, "0")}:00`);
      r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ hourly: { time, temperature_2m: time.map(() => 8.5), apparent_temperature: time.map(() => 6), relative_humidity_2m: time.map(() => 60), wind_speed_10m: time.map(() => 9), weather_code: time.map(() => 2) } }) });
    });
    await p.context().route(/nominatim\.openstreetmap\.org/, r => {
      pedidos.push(r.request().url());
      r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ address: { quarter: "Sopocachi", city: "Municipio Nuestra Señora de La Paz", state: "La Paz" } }) });
    });
    const tx = sel => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim());
    const vis = sel => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && getComputedStyle(el).display !== "none"; }, sel);
    const doc = (c, id) => p.evaluate(([c, id]) => window.__fakeStore.colMap(c).get(id) || null, [c, id]);
    const ids = c => p.evaluate(c => Array.from(window.__fakeStore.colMap(c).keys()).sort(), c);

    console.log("Abrir la hoja");
    ok(await vis(".run-importar-btn"), "botón «Importar» arriba de Running");
    await p.click(".run-importar-btn");
    await p.waitForTimeout(300);
    ok(await vis("#ri-hoja"), "se abre la hoja de importar");
    ok(/GPX, TCX y FIT/.test(await tx("#ri-cuerpo")) && /Nada se borra/.test(await tx("#ri-cuerpo")), "explica qué archivos acepta y que nada se borra");
    ok(await p.$eval("#ri-archivos", el => !el.accept), "el selector no filtra por extensión (iPhone)");
    await p.click(".ri-guia summary");
    ok(/strava\.com/.test(await tx(".ri-guia")) && /Apple Salud/.test(await tx(".ri-guia")), "«Cómo traer mis carreras» con los pasos");
    if (ancho === 390) await captura(p, "run-importar-inicio.png");

    console.log("Vista previa");
    await p.setInputFiles("#ri-archivos", [
      { name: "export_123.zip", mimeType: "application/zip", buffer: Buffer.from(ZIP) },
      { name: "carrera tarde.gpx", mimeType: "application/octet-stream", buffer: Buffer.from(X.gpx(PSUELTO, { tipo: "", nombre: "Tarde" })) },
      { name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("hola") }
    ]);
    await p.waitForSelector(".ri-resumen", { timeout: 15000 });
    const resumen = await tx(".ri-resumen");
    ok(/5 actividades para guardar/.test(resumen), `5 para guardar (${resumen})`);
    ok(/3 nuevas/.test(resumen) && /2 se unen a algo tuyo/.test(resumen) && /1 ya estaba/.test(resumen) && /1 de otro deporte/.test(resumen) && /1 con error/.test(resumen), "nuevas, fusiones, duplicada, otro deporte y error");
    const filas = await p.$$eval(".ri-lista > .ri-fila", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
    ok(filas.some(f => /Fondo por el Prado/.test(f) && /Se une a tu rutina «Plan 5K · Día 2»/.test(f)), "la del reloj se une a la rutina guiada");
    ok(filas.some(f => /Tarde/.test(f) && /Se une a tu carrera anotada a mano \(5 km\)/.test(f) && /no dice el deporte/.test(f)), "el GPX sin deporte se une a la carrera a mano");
    ok(filas.some(f => /Rodada a Mallasa/.test(f) && /Bici/.test(f)), "la rodada va como bici");
    ok(filas.some(f => /Cinta del gimnasio/.test(f) && /solo distancia y tiempo/.test(f)), "la que no tiene archivo se guarda con distancia y tiempo");
    ok(/no tiene su archivo en el ZIP/.test(await tx("#ri-cuerpo")), "avisa la que falta en el ZIP");
    ok(/notas\.txt/.test(await p.$eval(".ri-errores", el => el.textContent)), "el archivo roto aparece con su error");
    ok(/Guardar 5/.test(await p.$eval('[data-ri="importar"]', b => b.textContent)), "botón «Guardar 5»");
    await captura(p, `run-importar-previa-${ancho}.png`);
    const ancho2 = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(ancho2 <= ancho, `sin desborde horizontal (${ancho2})`);

    console.log("Guardar");
    await p.click('[data-ri="importar"]');
    await p.waitForFunction(() => /Listo/.test(document.getElementById("ri-cuerpo").innerText), null, { timeout: 15000 });
    ok(/Guardaste 4 carreras y 1 rodada/.test(await tx("#ri-cuerpo")), "«Guardaste 4 carreras y 1 rodada»");
    ok(await vis(".ri-estirar"), "sugiere estirar con «Después de correr»");
    if (ancho === 390) await captura(p, "run-importar-listo.png");

    const r = await doc(RUN, "rut1");
    ok(r.fuente === "rutina" && r.conImportado && r.rutina.nombre === "Plan 5K · Día 2" && r.rpe === 6, "la rutina conserva su nombre y su RPE");
    ok(r.previo && r.previo.distance === 0 && r.distanciaM > 4700 && r.distance > 4.7 && r.mini && r.splits.length === 5, `y suma ruta y métricas del reloj (${r.distance} km, ${r.splits && r.splits.length} parciales)`);
    ok(r.mejores && r.mejores["1000"] > 0 && r.desnivelPosM === 37 && r.kcal === 432 && r.cadMedia === 170, "mejores marcas y valores del archivo (desnivel, calorías, cadencia)");
    ok(r.titulo === "Fondo por el Prado" && /Con frío/.test(r.notes), "título y descripción del CSV");
    const ruta = await doc(RUTAS, "rut1");
    ok(ruta && ruta.v === 2 && ruta.enc && ruta.fc && ruta.n === 1501, "su ruta completa en rutas/ con el mismo id");
    const m = await doc(RUN, "m1");
    ok(m.rpe === 7 && /Con viento/.test(m.notes) && m.date === "2026-10-30" && m.previo.distance === 5 && m.conRuta, "la carrera a mano conserva RPE, notas y fecha; guarda los km de antes");
    ok((await ids(BICI)).includes("imp_112") && (await doc(BICI, "imp_112")).titulo === "Rodada a Mallasa", "la rodada va a Bicicleta");
    const cinta = await doc(RUN, "imp_114");
    ok(cinta && cinta.distance === 5 && cinta.duration === 30 && cinta.conRuta === false, "la cinta sin archivo: 5 km, 30 min, sin ruta");
    ok((await doc(RUN, "imp_115")).distance === 4.5, "la que faltaba en el ZIP, con los datos del CSV");
    ok(!(await ids(RUN)).some(x => /113/.test(x)), "la caminata no se importó");
    ok((await doc(RUN, "viejo")).distance === 8 && (await doc(RUN, "imp_222")).distance === 2.7, "lo que ya estaba no cambia");

    console.log("Historial, clima y lugar");
    await p.click('#ri-acciones [data-ri="cerrar"]');
    await p.waitForTimeout(400);
    ok(!(await vis("#ri-hoja")), "«Listo» cierra la hoja");
    await p.waitForFunction(() => { const d = window.__fakeStore.colMap("users/test/running").get("rut1"); return d && d.clima && d.lugar; }, null, { timeout: 15000 }).catch(() => {});
    const r2 = await doc(RUN, "rut1");
    ok(r2.clima && r2.clima.tC === 8.5 && r2.lugar === "Sopocachi, La Paz", `clima y lugar completados en segundo plano (${JSON.stringify(r2.clima)} · ${r2.lugar})`);
    ok(pedidos.length > 0 && pedidos.every(u => !/\d\.\d{4,}/.test(new URL(u).search)), "solo coordenadas redondeadas");
    const lista = await tx("#running-list");
    ok(/Fondo por el Prado/.test(lista) && /Ruta/.test(lista) && /Sopocachi, La Paz/.test(lista), "el historial muestra título, «Ruta» y lugar");
    await captura(p, `run-importar-historial-${ancho}.png`);

    console.log("Volver a importar lo mismo");
    await p.click(".run-importar-btn");
    await p.waitForTimeout(300);
    await p.setInputFiles("#ri-archivos", [{ name: "export_123.zip", mimeType: "application/zip", buffer: Buffer.from(ZIP) }]);
    await p.waitForSelector(".ri-resumen", { timeout: 15000 });
    ok(/0 actividades para guardar/.test(await tx(".ri-resumen")) && /5 ya estaban/.test(await tx(".ri-resumen")), `todo se reconoce como ya importado (${await tx(".ri-resumen")})`);
    ok(await p.$eval('[data-ri="importar"]', b => b.disabled), "no hay nada que guardar");
    ok(p.errores.length === 0, "sin errores en la página");
    await p.context().close();
  }
  await terminar(browser, srv);
})();
