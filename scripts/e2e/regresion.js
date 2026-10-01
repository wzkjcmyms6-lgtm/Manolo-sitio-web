// Regresión: abre cada sección principal con datos de ejemplo y comprueba
// que se dibuja sin errores de JavaScript, en teléfono (390 px) y en
// computadora (1280 px). En el teléfono además hace las acciones de todos los
// días: marcar un hábito, anotar un gasto, registrar Running y Bici a mano y
// marcar una serie en el gimnasio. También revisa el aviso "Sin conexión".
// Uso: node scripts/e2e/regresion.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const hoy = new Date();
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const SEED = {
  "users/test/entrenamientos": { w1: { date: iso(hoy), startedAt: Date.now() - 3600e3, name: "Push", durationMin: 45, exercises: [{ name: "Press de banca (Barra)", exerciseId: "barbell-bench-press-medium-grip", sets: [{ kg: 60, reps: 8 }, { kg: 60, reps: 8 }] }] } },
  "users/test/rutinas": { r1: { name: "Push", orden: 0, items: [{ nombre: "Press de banca (Barra)", exerciseId: "barbell-bench-press-medium-grip", series: 3, repsMin: 8, repsMax: 10, peso: 60, descansoSeg: 90, notas: "", incremento: null }] } },
  "users/test/habitos": { h1: { v: 2, name: "Leer", emoji: "📖", tipo: "sino", freqType: "diario", days: [true, true, true, true, true, true, true], done: [], registros: {}, createdAt: Date.now() - 864e5, inicio: iso(new Date(Date.now() - 864e5)), orden: 1 } },
  "users/test/running": { c1: { date: iso(hoy), distance: 5, duration: 30, notes: "" } },
  "users/test/bicicleta": { b1: { date: iso(hoy), distance: 20, duration: 60, notes: "" } }
};
const PANTALLAS = [
  ["inicio", "#panel-inicio"], ["habitos", "#hb-lista"], ["hab-stats", "#hb-stats"], ["ej-feed", "#panel-ej-feed"],
  ["ejercicio", "#panel-ejercicio"], ["gimnasio", "#gym-home"], ["ej-rangos", "#rk-app"], ["ej-perfil", "#ejd-dash"],
  ["running", "#running-list"], ["bicicleta", "#cycling-list"], ["finanzas", "#panel-finanzas"], ["fin-movimientos", "#panel-fin-movimientos"],
  ["fin-presupuesto", "#panel-fin-presupuesto"], ["fin-analisis", "#panel-fin-analisis"], ["inversiones", "#panel-inversiones"]
];
const coleccion = (p, ruta) => p.evaluate(r => [...window.__fakeStore.colMap(r).entries()], ruta);
async function sinFestejos(p) {
  for (let i = 0; i < 5 && await p.$(".hb-celebra [data-continuar]"); i++) {
    await p.click(".hb-celebra [data-continuar]");
    await p.waitForTimeout(450);
  }
}

// Recorre todas las pantallas: cada una se ve, sin errores y sin scroll de lado.
async function recorrer(p, etiqueta) {
  const errores = p.errores;
  for (const [hash, sel] of PANTALLAS) {
    errores.length = 0;
    await p.evaluate(h => { location.hash = h; window.scrollTo(0, 0); }, hash);
    await p.waitForTimeout(500);
    const visible = await p.isVisible(sel);
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(visible && !errores.length && ancho <= 1,
      `${etiqueta} #${hash}${errores.length ? " — " + errores.join(" | ") : !visible ? " — no se ve " + sel : ancho > 1 ? ` — se mueve de lado (${ancho} px)` : ""}`);
    await captura(p, CAPTURAS, `reg-${etiqueta}-${hash}.png`);
  }
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();

  console.log("\nTeléfono (390 px): todas las pantallas");
  let p = await abrir(browser, base, { __SEED__: SEED });
  const errores = p.errores;
  await p.waitForTimeout(400);
  await recorrer(p, "telefono");

  console.log("\nAcciones de todos los días");
  // Hábitos: marcar «Leer» como hecho hoy.
  errores.length = 0;
  await p.evaluate(() => { location.hash = "habitos"; });
  await p.waitForTimeout(400);
  await p.click('.hb-check[data-marcar="h1"]');
  await p.waitForTimeout(500);
  await sinFestejos(p);
  const h1 = (await coleccion(p, "users/test/habitos")).find(([id]) => id === "h1")[1];
  ok(!errores.length && h1.registros && h1.registros[iso(hoy)], "hábitos: marcar un hábito hoy se guarda");

  // Finanzas: anotar un gasto de 25 Bs con el teclado de la hoja.
  errores.length = 0;
  await p.evaluate(() => { location.hash = "fin-movimientos"; });
  await p.waitForTimeout(500);
  await p.click("#txn-add");
  await p.waitForTimeout(400);
  await p.click('[data-txn-key="2"]');
  await p.click('[data-txn-key="5"]');
  if (await p.$("#txn-sheet-chips button")) await p.click("#txn-sheet-chips button");
  await p.click("#txn-sheet-save");
  await p.waitForTimeout(600);
  const movs = await coleccion(p, "users/test/finanzas");
  ok(!errores.length && movs.length === 1 && movs[0][1].amount === 25 && movs[0][1].type === "gasto", "finanzas: anotar un gasto se guarda como siempre");

  // Running y Bici: registro a mano (los datos de siempre).
  for (const [hash, pref, col] of [["running", "running", "running"], ["bicicleta", "cycling", "bicicleta"]]) {
    errores.length = 0;
    await p.evaluate(h => { location.hash = h; }, hash);
    await p.waitForTimeout(400);
    await p.click(`#panel-${hash} .act-manual summary`);
    await p.fill(`#${pref}-distance`, "4");
    await p.fill(`#${pref}-duration`, "25");
    await p.click(`#${pref}-form button[type=submit]`);
    await p.waitForTimeout(400);
    const docs = await coleccion(p, `users/test/${col}`);
    const nuevo = docs.find(([id]) => !["c1", "b1"].includes(id));
    ok(!errores.length && docs.length === 2 && nuevo && nuevo[1].distance === 4 && nuevo[1].duration === 25 && !("fuente" in nuevo[1]),
      `${hash}: registrar a mano guarda km y minutos como antes`);
  }

  // Gimnasio: empezar la rutina y marcar una serie.
  errores.length = 0;
  await p.evaluate(() => { location.hash = "gimnasio"; });
  await p.waitForTimeout(400);
  await p.click('[data-rut-empezar="r1"]');
  await p.waitForTimeout(400);
  await p.click('.gx-ej[data-ex-index="0"] .gx-fila[data-set-index="0"] .gx-check');
  await p.waitForTimeout(300);
  ok(!errores.length && (await p.textContent("#gym-active-series")) === "1", "gimnasio: empezar rutina y marcar una serie");

  console.log("\nSin conexión");
  await p.context().setOffline(true);
  await p.evaluate(() => window.dispatchEvent(new Event("offline")));
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.documentElement.classList.contains("sin-conexion")), "sin internet aparece el aviso «Sin conexión»");
  await p.context().setOffline(false);
  await p.evaluate(() => window.dispatchEvent(new Event("online")));
  await p.waitForTimeout(200);
  ok(!(await p.evaluate(() => document.documentElement.classList.contains("sin-conexion"))), "al volver internet el aviso desaparece");
  await p.context().close();

  console.log("\nComputadora (1280 px): todas las pantallas");
  p = await abrir(browser, base, { __SEED__: SEED }, { ancho: 1280, alto: 800 });
  await p.waitForTimeout(400);
  await recorrer(p, "compu");
  await p.context().close();

  await terminar(browser, srv);
})();
