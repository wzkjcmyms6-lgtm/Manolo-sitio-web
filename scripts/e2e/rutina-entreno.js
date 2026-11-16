// Gimnasio: guardar en la rutina lo que cambiaste hoy, guardar un entreno
// libre como rutina y avisar antes de perder cambios en el editor (D-125).
// Uso: node scripts/e2e/rutina-entreno.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const item = (nombre, exerciseId, extra) => Object.assign({ nombre, exerciseId, series: 3, repsMin: 8, repsMax: 12, peso: null, descansoSeg: 90, notas: "", incremento: null }, extra || {});
const PUSH = {
  name: "Push", orden: 0, v: 2,
  items: [
    item("Press de banca (Barra)", "barbell-bench-press-medium-grip", { repsMin: 8, repsMax: 10, peso: 60, descansoSeg: 120, notas: "Pausa abajo", incremento: 2.5 }),
    item("Aperturas (Mancuerna)", "dumbbell-flyes", { repsMin: 12, repsMax: 15, peso: 10 }),
    item("Fondos en paralelas", "parallel-bar-dip")
  ]
};
PUSH.exercises = PUSH.items.map(x => x.nombre);
const SEED = { "users/test/rutinas": { r1: PUSH } };

const texto = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const rutinas = p => p.evaluate(() => [...window.__fakeStore.colMap("users/test/rutinas").entries()].map(([id, d]) => Object.assign({ id }, d)));
const ej = i => `#gym-active-exercises .gx-ej[data-ex-index="${i}"]`;
async function marcar(p, i, s) {
  await p.click(`${ej(i)} .gx-fila[data-set-index="${s}"] .gx-check`);
  await p.waitForTimeout(150);
}
async function agregar(p, nombre) {
  await p.fill("#gym-active-exercise-name", nombre);
  await p.press("#gym-active-exercise-name", "Enter");
  await p.waitForTimeout(350);
}
async function accion(p, i, a) {
  await p.click(`${ej(i)} .gx-mas`);
  await p.waitForTimeout(300);
  await p.click(`#gx-menu [data-gx-accion="${a}"]`);
  await p.waitForTimeout(300);
}
// El aviso de "Nuevos rangos" (js/rangos.js) sale al cerrar el resumen.
async function sinRangos(p) {
  for (let i = 0; i < 8; i++) {
    await p.waitForTimeout(250);
    const b = await p.$(".rk-aviso-modal:not(.closing) [data-continuar]");
    if (b && await b.isVisible()) { await b.click(); await p.waitForTimeout(350); return; }
  }
}
async function terminarEntreno(p) {
  await p.click("#gym-active-finish");
  await p.waitForTimeout(500);
  if (await p.isVisible('#gx-fin [data-gx-fin="marcadas"]')) {
    await p.click('#gx-fin [data-gx-fin="marcadas"]');
    await p.waitForTimeout(600);
  }
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#gimnasio", ancho: 375, alto: 812 });
  const consola = [];
  p.on("console", m => { if ((m.type() === "error" || m.type() === "warning") && !/Failed to load resource|net::ERR/.test(m.text())) consola.push(`${m.type()}: ${m.text()}`); });
  await p.evaluate(() => { window.confirm = () => true; });
  await p.waitForTimeout(900);

  console.log("\nEntreno de la rutina «Push» con cambios");
  await p.click('#gym-routines [data-rut-empezar="r1"]');
  await p.waitForTimeout(600);
  ok((await p.$$("#gym-active-exercises .gx-ej")).length === 3, "empieza la rutina con sus 3 ejercicios");
  // Banca: las 3 series y una cuarta.
  for (const s of [0, 1, 2]) await marcar(p, 0, s);
  await p.click(`${ej(0)} .gx-agregar-serie`);
  await p.waitForTimeout(200);
  await p.fill(`${ej(0)} .gx-fila[data-set-index="3"] .set-kg`, "60");
  await p.fill(`${ej(0)} .gx-fila[data-set-index="3"] .set-reps`, "6");
  await marcar(p, 0, 3);
  // Hoy sin aperturas.
  await accion(p, 1, "eliminar");
  ok((await p.$$("#gym-active-exercises .gx-ej")).length === 2, "quito las aperturas del entreno");
  // Fondos: solo 2 series, y los paso primero.
  for (const s of [0, 1]) {
    await p.fill(`${ej(1)} .gx-fila[data-set-index="${s}"] .set-reps`, "10");
    await marcar(p, 1, s);
  }
  await accion(p, 1, "subir");
  // Un ejercicio nuevo.
  await agregar(p, "Press militar (Barra)");
  ok((await p.$$("#gym-active-exercises .gx-ej")).length === 3 && /Press militar/.test(await texto(p, ej(2))), "agrego el press militar");
  await p.fill(`${ej(2)} .gx-fila[data-set-index="0"] .set-kg`, "30");
  await p.fill(`${ej(2)} .gx-fila[data-set-index="0"] .set-reps`, "10");
  await marcar(p, 2, 0);
  await terminarEntreno(p);
  ok(await p.isVisible(".ejr-hoja .muscle-sheet-panel"), "al terminar se abre el resumen");
  ok(/Hoy cambiaste «Push»/.test(await texto(p, ".ejr-hoja .rde")), "con «Hoy cambiaste «Push»»");
  const ops = await p.$$eval(".ejr-hoja .rde-op", ls => ls.map(l => ({ t: l.textContent.replace(/\s+/g, " ").trim(), si: l.querySelector("input").checked })));
  ok(ops.length === 5 && ops.every(o => o.si), `5 cambios, todos marcados: ${ops.map(o => o.t).join(" | ")}`);
  ok(ops.some(o => o.t === "Agregar Press militar (Barra)") && ops.some(o => o.t === "Quitar Aperturas (Mancuerna) (hoy no lo hiciste)") && ops.some(o => o.t === "Press de banca (Barra): 4 series (antes 3)") && ops.some(o => o.t === "Fondos en paralelas: 2 series (antes 3)") && ops.some(o => o.t === "El orden de hoy"), "agregar, quitar, series y orden, en palabras");
  await p.$eval(".ejr-hoja .rde", el => el.scrollIntoView({ block: "center" }));
  await captura(p, "rde-cambios-375.png");
  // Las aperturas fueron solo por hoy: se quedan en la rutina.
  await p.click('.ejr-hoja [data-rde-cambio^="quitar:"]');
  await p.waitForTimeout(150);
  ok(!(await p.$eval('.ejr-hoja [data-rde-cambio^="quitar:"]', i => i.checked)), "quito la marca de «Quitar Aperturas»");
  // Elegir el esfuerzo repinta el resumen: lo elegido se mantiene.
  await p.click('.ejr-hoja [data-ejr-rpe="7"]');
  await p.waitForTimeout(250);
  ok(!(await p.$eval('.ejr-hoja [data-rde-cambio^="quitar:"]', i => i.checked)) && (await p.$$(".ejr-hoja .rde-op input:checked")).length === 4, "al elegir el esfuerzo, lo marcado sigue igual");
  await p.click('.ejr-hoja [data-rde="guardar"]');
  await p.waitForTimeout(600);
  let r = (await rutinas(p)).find(x => x.id === "r1");
  ok(r.items.map(x => x.nombre).join(" · ") === "Fondos en paralelas · Press de banca (Barra) · Press militar (Barra) · Aperturas (Mancuerna)", `la rutina queda en el orden de hoy (${r.items.map(x => x.nombre).join(" · ")})`);
  const banca = r.items[1], militar = r.items[2];
  ok(banca.series === 4 && banca.peso === 60 && banca.repsMin === 8 && banca.repsMax === 10 && banca.notas === "Pausa abajo" && banca.descansoSeg === 120 && banca.incremento === 2.5, "banca: 4 series, con su peso, reps, descanso y notas de antes");
  ok(r.items[0].series === 2 && militar.series === 1 && militar.peso === 30 && militar.repsMin === 10 && militar.exerciseId === "standing-military-press", "fondos 2 series; el press militar con lo de hoy (1 × 10, 30 kg)");
  ok(r.items[3].series === 3 && r.name === "Push" && r.orden === 0 && r.exercises.length === 4 && r.v === 2, "las aperturas se quedan igual; nombre y lugar de la rutina, igual");
  ok(/✓ Cambios guardados en «Push»/.test(await texto(p, ".ejr-hoja .rde")), "dice «✓ Cambios guardados en «Push»»");
  await captura(p, "rde-guardado-375.png");
  await p.click('.ejr-hoja [data-rde="deshacer"]');
  await p.waitForTimeout(600);
  r = (await rutinas(p)).find(x => x.id === "r1");
  ok(r.items.map(x => x.nombre).join(" · ") === "Press de banca (Barra) · Aperturas (Mancuerna) · Fondos en paralelas" && r.items.every(x => x.series === 3) && r.items[0].notas === "Pausa abajo", "«Deshacer» la deja como estaba");
  ok((await p.$$(".ejr-hoja .rde-op")).length === 5, "y vuelve a ofrecer los cambios");
  await p.click(".ejr-hoja .ejr-listo");
  await sinRangos(p);

  console.log("\nEntreno libre → rutina nueva");
  await p.click("#gym-start-empty");
  await p.waitForTimeout(500);
  await p.fill("#gym-active-name", "Brazos");
  await agregar(p, "Curl de bíceps (Barra)");
  await p.fill(`${ej(0)} .gx-fila[data-set-index="0"] .set-kg`, "25");
  await p.fill(`${ej(0)} .gx-fila[data-set-index="0"] .set-reps`, "12");
  await marcar(p, 0, 0);
  await p.click(`${ej(0)} .gx-agregar-serie`);
  await p.waitForTimeout(200);
  await p.fill(`${ej(0)} .gx-fila[data-set-index="1"] .set-kg`, "27.5");
  await p.fill(`${ej(0)} .gx-fila[data-set-index="1"] .set-reps`, "10");
  await marcar(p, 0, 1);
  await terminarEntreno(p);
  ok(/¿Repetir este entreno\?/.test(await texto(p, ".ejr-hoja .rde")) && await p.isVisible('.ejr-hoja [data-rde="nueva"]'), "entreno libre: ofrece «Guardar como rutina»");
  await p.click('.ejr-hoja [data-rde="nueva"]');
  await p.waitForTimeout(600);
  let rs = await rutinas(p);
  const brazos = rs.find(x => x.name === "Brazos");
  ok(brazos && brazos.items.length === 1 && brazos.items[0].nombre === "Curl de bíceps (Barra)" && brazos.items[0].series === 2 && brazos.items[0].repsMin === 10 && brazos.items[0].repsMax === 12 && brazos.items[0].peso === 27.5 && brazos.orden === 1, "se guarda «Brazos»: curl 2 × 10–12 con 27,5 kg, al final de tus rutinas");
  ok(/Guardado como la rutina «Brazos»/.test(await texto(p, ".ejr-hoja .rde")), "y lo dice");
  await p.click('.ejr-hoja [data-rde="deshacer"]');
  await p.waitForTimeout(500);
  ok(!(await rutinas(p)).some(x => x.name === "Brazos"), "«Deshacer» la borra");
  await p.click('.ejr-hoja [data-rde="nueva"]');
  await p.waitForTimeout(500);
  await p.click(".ejr-hoja .ejr-listo");
  await sinRangos(p);
  ok((await texto(p, "#gym-routines")).includes("Brazos"), "aparece en tus rutinas");
  const chicos = await p.$$eval(".ejr-hoja .rde button, .ejr-hoja .rde-op", els => els.filter(e => e.offsetParent).map(e => e.getBoundingClientRect().height).filter(h => h < 44));
  ok(!chicos.length, "botones y opciones de 44 px o más");

  console.log("\nEditor: avisa antes de perder cambios");
  let preguntas = 0;
  await p.evaluate(() => { window.__preguntas = 0; window.confirm = () => { window.__preguntas++; return false; }; });
  const idx = await p.$$eval("#gym-routines [data-rut-menu]", bs => bs.findIndex(b => /Push/.test(b.getAttribute("aria-label"))));
  await p.evaluate(i => document.querySelectorAll("#gym-routines [data-rut-menu]")[i].click(), idx);
  await p.waitForTimeout(350);
  await p.click('#rut-menu [data-rut-accion="editar"]');
  await p.waitForTimeout(600);
  ok(await p.isVisible("#rut-editor .budget-sheet-panel"), "abro «Editar rutina»");
  await p.click("#rut-cancelar");
  await p.waitForTimeout(300);
  preguntas = await p.evaluate(() => window.__preguntas);
  ok(preguntas === 0 && !(await p.isVisible("#rut-editor .budget-sheet-panel")), "sin cambios, «Cancelar» cierra sin preguntar");
  await p.evaluate(i => document.querySelectorAll("#gym-routines [data-rut-menu]")[i].click(), idx);
  await p.waitForTimeout(350);
  await p.click('#rut-menu [data-rut-accion="editar"]');
  await p.waitForTimeout(600);
  await p.fill("#rut-nombre", "Push nuevo");
  await p.click("#rut-editor-cerrar");
  await p.waitForTimeout(300);
  ok((await p.evaluate(() => window.__preguntas)) === 1 && await p.isVisible("#rut-editor .budget-sheet-panel"), "con cambios, la ✕ pregunta; si dices que no, el editor sigue abierto");
  await p.fill('#rut-items [data-rut-item="0"] [data-campo="series"]', "5");
  await p.$eval("#rut-editor .budget-sheet-overlay", el => el.click());
  await p.waitForTimeout(300);
  ok((await p.evaluate(() => window.__preguntas)) === 2 && await p.isVisible("#rut-editor .budget-sheet-panel"), "tocar fuera también pregunta");
  await p.click("#rut-guardar");
  await p.waitForTimeout(500);
  r = (await rutinas(p)).find(x => x.id === "r1");
  ok((await p.evaluate(() => window.__preguntas)) === 2 && !(await p.isVisible("#rut-editor .budget-sheet-panel")) && r.name === "Push nuevo" && r.items[0].series === 5, "«Guardar rutina» guarda sin preguntar");
  await p.evaluate(() => { window.confirm = () => { window.__preguntas++; return true; }; });
  await p.evaluate(i => document.querySelectorAll("#gym-routines [data-rut-menu]")[i].click(), idx);
  await p.waitForTimeout(350);
  await p.click('#rut-menu [data-rut-accion="editar"]');
  await p.waitForTimeout(600);
  await p.fill("#rut-nombre", "Otra cosa");
  await p.click("#rut-cancelar");
  await p.waitForTimeout(400);
  r = (await rutinas(p)).find(x => x.id === "r1");
  ok(!(await p.isVisible("#rut-editor .budget-sheet-panel")) && r.name === "Push nuevo", "si confirmas «Salir sin guardar», no se guarda nada");
  ok(!consola.length && !p.errores.length, `sin errores ni advertencias${consola.length ? ` (${consola[0]})` : ""}`);
  await p.context().close();
  await terminar(browser, srv);
})();
