// Pruebas de pantalla de la Fase 4 (rutinas de Running por CSV con avisos).
// Uso: node scripts/e2e/fase4.js [carpeta-para-capturas]
// GPS, reloj y voz simulados (scripts/e2e/comun.js). La voz y los pitidos
// reales se prueban en el iPhone.
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const LAT = -16.5, LON = -68.13, M = 111195;
const CSV_OK = "orden,tipo,duracion,descripcion\n1,caminar,0:20,Calentamiento\n2,correr,30,\"Suave, sin apuro\"\n3,caminar,15 s,Recuperación\n";
const CSV_MAL = "orden,tipo,duracion\n1,caminar,3:00\n2,volar,2:00\n3,correr,abc\n";

let metros = 0;
// Avanza `seg` segundos de a uno (con pausas reales para que corra el reloj de avisos).
async function avanzar(p, seg, conGps = true) {
  for (let i = 0; i < seg; i++) {
    metros += 3;
    await p.evaluate(([m, gps, LAT, LON, M]) => { window.__adelantar(1000); if (gps) window.__gps(LAT + m / M, LON, 6); }, [metros, conGps, LAT, LON, M]);
    await p.waitForTimeout(290);
  }
}
const texto = (p, sel) => p.textContent(sel).then(t => (t || "").trim());
const dichos = p => p.evaluate(() => window.__dichos.slice());
const pitidos = p => p.evaluate(() => window.__pitidos.slice());

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  let p = await abrir(browser, base, {}, { gps: true, voz: true, hash: "#running" });
  await p.evaluate(() => {
    window.__permiso = "granted";
    window.__congelar();
    window.__pitidos = [];
    const original = Avisos.pitido;
    Avisos.pitido = t => { window.__pitidos.push(t); original(t); };
  });

  console.log("\nImportar rutinas");
  ok((await texto(p, "#panel-running .act-rutinas")).includes("Importa una rutina"), "sin rutinas: explica cómo importar y ofrece la plantilla");
  await p.evaluate(t => RutinasRunning._vistaPrevia(t, "mala.csv"), CSV_MAL);
  await p.waitForTimeout(400);
  const errores = await texto(p, ".rr-errores");
  ok(errores.includes("Fila 3") && errores.includes("volar") && errores.includes("Fila 4") && errores.includes("abc"), "CSV con errores: los explica fila por fila");
  ok(!(await p.$('[data-rr="guardar"]')), "y no deja guardarlo");
  await captura(p, "f4-csv-errores.png");
  await p.click('.rr-hoja .budget-sheet-close');
  await p.waitForTimeout(300);
  const [elegir] = await Promise.all([p.waitForEvent("filechooser"), p.click('#panel-running [data-act="importar-rutina"]')]);
  await elegir.setFiles({ name: "Intervalos_cortos.csv", mimeType: "text/csv", buffer: Buffer.from(CSV_OK) });
  await p.waitForTimeout(600);
  ok((await p.$$(".rr-lista li")).length === 3, "CSV válido: vista previa con los 3 intervalos");
  ok((await p.inputValue("[data-rr-nombre]")) === "Intervalos cortos", "el nombre sale del archivo");
  ok((await texto(p, ".rr-lista")).includes("Suave, sin apuro"), "respeta comas y tildes de las descripciones");
  await captura(p, "f4-csv-vista.png");
  await p.fill("[data-rr-nombre]", "Prueba 3 intervalos");
  await p.click('[data-rr="guardar"]');
  await p.waitForTimeout(600);
  const guardadas = await p.evaluate(() => [...window.__fakeStore.colMap("users/test/rutinas_running").values()]);
  ok(guardadas.length === 1 && guardadas[0].nombre === "Prueba 3 intervalos" && guardadas[0].totalSeg === 65, "la rutina se guarda");
  ok((await texto(p, "#panel-running .act-rutinas-lista")).includes("Prueba 3 intervalos"), "y aparece en la lista para usarla");
  await captura(p, "f4-inicio.png");

  console.log("\nCorrer con la rutina");
  await p.click('#panel-running [data-act="rutina"]');
  await p.waitForTimeout(300);
  ok(await p.isVisible("#panel-running [data-act-rut]"), "la carrera muestra la tarjeta de la rutina");
  ok((await texto(p, "#panel-running [data-act-rut-tipo]")) === "Caminar" && (await texto(p, "#panel-running [data-act-rut-resta]")) === "0:20", "primer intervalo: Caminar 0:20");
  ok((await texto(p, "#panel-running [data-act-rut-sig]")) === "Siguiente: Correr · 0:30", "muestra el siguiente");
  await p.evaluate(([LAT, LON]) => window.__gps(LAT, LON, 6), [LAT, LON]);
  await p.click('#panel-running [data-act="iniciar"]');
  await p.waitForTimeout(300);
  ok((await dichos(p)).includes("Empezamos: caminar durante 20 segundos."), "voz al empezar: «Empezamos: caminar durante 20 segundos.»");
  await avanzar(p, 17);
  ok((await pitidos(p)).filter(x => x === "cuenta").length >= 1, "cuenta atrás con pitidos antes del cambio");
  await captura(p, "f4-cuenta.png");
  await avanzar(p, 4);
  ok((await texto(p, "#panel-running [data-act-rut-tipo]")) === "Correr", "cambia solo a Correr");
  ok((await dichos(p)).includes("Siguiente intervalo: correr durante 30 segundos."), "voz en el cambio de intervalo");
  ok((await pitidos(p)).filter(x => x === "cuenta").length === 3, "3-2-1: tres pitidos de cuenta");
  ok((await texto(p, "#panel-running [data-act-rut-cab]")).includes("2 de 3"), "intervalo 2 de 3");
  await captura(p, "f4-correr.png");

  console.log("\nPausa, recuperación y app congelada");
  await p.click('#panel-running [data-act="pausar"]');
  await p.waitForTimeout(300);
  const resta = await texto(p, "#panel-running [data-act-rut-resta]");
  await p.evaluate(() => window.__adelantar(60000));
  await p.waitForTimeout(600);
  ok((await texto(p, "#panel-running [data-act-rut-resta]")) === resta, "en pausa la rutina no avanza");
  await p.reload();
  await p.waitForTimeout(1000);
  await p.evaluate(() => { window.__pitidos = []; const o = Avisos.pitido; Avisos.pitido = t => { window.__pitidos.push(t); o(t); }; });
  ok(await p.isVisible("#panel-running [data-act-rut]") && (await texto(p, "#panel-running [data-act-rut-tipo]")) === "Correr", "al reabrir Manolo recupera la rutina donde iba");
  const antes = (await dichos(p)).length;
  await p.click('#panel-running [data-act="reanudar"]');
  await p.waitForTimeout(600);
  ok((await dichos(p)).length === antes, "al reanudar no repite avisos viejos");
  // La app "se congela" 30 s (pantalla bloqueada) y pasa el cambio a Caminar:
  // al volver no recita la cuenta atrasada, solo dice dónde va.
  await p.evaluate(() => window.__adelantar(30000));
  await p.waitForTimeout(600);
  ok((await pitidos(p)).filter(x => x === "cuenta").length === 0, "tras un salto de tiempo no hay ráfaga de pitidos");
  ok((await dichos(p)).some(d => d.startsWith("Ahora: caminar")), "y dice en qué intervalo va («Ahora: caminar…»)");
  await avanzar(p, 15, false); // sin señal de GPS: la rutina sigue igual
  ok((await texto(p, "#panel-running [data-act-rut-tipo]")) === "¡Rutina completada!", "la rutina termina aunque no haya GPS");
  ok((await dichos(p)).includes("Rutina terminada. ¡Buen trabajo!"), "voz al terminar");
  await captura(p, "f4-fin.png");

  console.log("\nGuardar con la rutina");
  await p.click('#panel-running [data-act="pausar"]');
  await p.waitForTimeout(250);
  await p.click('#panel-running [data-act="finalizar"]');
  await p.waitForTimeout(500);
  ok((await texto(p, "#panel-running .act-rut-res")).includes("3 de 3 intervalos"), "el resumen dice cuántos intervalos completaste");
  await p.click('#panel-running [data-act="guardar"]');
  await p.waitForTimeout(500);
  const carrera = await p.evaluate(() => [...window.__fakeStore.colMap("users/test/running").values()][0]);
  ok(carrera && carrera.rutina && carrera.rutina.nombre === "Prueba 3 intervalos" && carrera.rutina.completados === 3 && carrera.rutina.total === 3 && !!carrera.rutina.id, "la carrera guarda la rutina usada");

  console.log("\nApagar la voz y eliminar la rutina");
  await p.click('#panel-running [data-act="rutina"]');
  await p.waitForTimeout(300);
  await p.click('#panel-running [data-act="voz"]');
  ok(await p.getAttribute('#panel-running [data-act="voz"]', "aria-pressed") === "false", "se puede apagar la voz");
  const n = (await dichos(p)).length;
  await p.evaluate(([LAT, LON]) => window.__gps(LAT, LON, 6), [LAT, LON]);
  await p.click('#panel-running [data-act="iniciar"]');
  await p.waitForTimeout(400);
  ok((await dichos(p)).length === n, "con la voz apagada no habla");
  await p.click('#panel-running [data-act="pausar"]');
  await p.waitForTimeout(200);
  await p.click('#panel-running [data-act="finalizar"]');
  await p.waitForTimeout(300);
  await p.click('#panel-running [data-act="descartar"]');
  await p.waitForTimeout(300);
  await p.click('#panel-running [data-act="borrar-rutina"]');
  await p.waitForTimeout(400);
  ok((await p.evaluate(() => window.__fakeStore.colMap("users/test/rutinas_running").size)) === 0, "eliminar la rutina la borra");
  ok((await p.evaluate(() => window.__fakeStore.colMap("users/test/running").size)) === 1, "las carreras hechas con ella se quedan");
  await p.evaluate(() => Avisos.cambiar("voz", true));
  await p.context().close();

  await terminar(browser, srv);
})();
