// Regresión rápida: abre cada sección principal con datos de ejemplo y
// comprueba que se dibuja sin errores de JavaScript.
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

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: SEED });
  const errores = p.errores;
  await p.waitForTimeout(400);
  for (const [hash, sel] of PANTALLAS) {
    errores.length = 0;
    await p.evaluate(h => { location.hash = h; }, hash);
    await p.waitForTimeout(500);
    const visible = await p.isVisible(sel);
    ok(visible && !errores.length, `#${hash}${errores.length ? " — " + errores.join(" | ") : visible ? "" : " — no se ve " + sel}`);
    await captura(p, CAPTURAS, `reg-${hash}.png`);
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
  await terminar(browser, srv);
})();
