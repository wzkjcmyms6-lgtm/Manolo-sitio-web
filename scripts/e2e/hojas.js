// Pruebas de pantalla: deslizar hacia abajo para cerrar las hojas
// (js/hoja-deslizar.js). Simula el dedo con eventos táctiles.
// Uso: node scripts/e2e/hojas.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const hoy = new Date();
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const SEED = {
  "users/test/habitos": { h1: { v: 2, name: "Leer", emoji: "📖", tipo: "sino", freqType: "diario", days: [true, true, true, true, true, true, true], done: [], registros: {}, createdAt: Date.now() - 864e5, inicio: iso(new Date(Date.now() - 864e5)), orden: 1 } }
};

// Arrastra con un dedo desde el centro de `sel`: dy hacia abajo (dx de lado),
// en `pasos` movimientos separados por `ms` milisegundos reales.
async function deslizar(p, sel, dy, o = {}) {
  const { dx = 0, pasos = 10, ms = 30, soltar = true } = o;
  const caja = await p.$eval(sel, el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 120) }; });
  const toque = (tipo, x, y) => p.evaluate(([sel, tipo, x, y]) => {
    const el = document.elementFromPoint(x, y) || document.querySelector(sel);
    const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    const fin = tipo === "touchend";
    el.dispatchEvent(new TouchEvent(tipo, { bubbles: true, cancelable: true, touches: fin ? [] : [t], targetTouches: fin ? [] : [t], changedTouches: [t] }));
  }, [sel, tipo, x, y]);
  await toque("touchstart", caja.x, caja.y);
  for (let i = 1; i <= pasos; i++) {
    await p.waitForTimeout(ms);
    await toque("touchmove", caja.x + (dx * i) / pasos, caja.y + (dy * i) / pasos);
  }
  if (soltar) await toque("touchend", caja.x + dx, caja.y + dy);
}
const visible = (p, sel) => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden; }, sel);
const desplazada = (p, sel) => p.$eval(sel, el => el.style.transform || "");

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#fin-movimientos" });

  console.log("\nFinanzas: nueva transacción");
  await p.click("#txn-add");
  await p.waitForTimeout(400);
  ok(await visible(p, "#txn-sheet"), "se abre la hoja");
  await deslizar(p, "#txn-sheet .budget-sheet-panel", 140, { soltar: false });
  const mitad = await desplazada(p, "#txn-sheet .budget-sheet-panel");
  ok(/translateY\(1[0-4]\d(\.\d+)?px\)/.test(mitad), `la hoja sigue al dedo (${mitad})`);
  await captura(p, "hoja-arrastrando.png");
  await p.evaluate(() => { const el = document.querySelector("#txn-sheet .budget-sheet-panel"); const t = new Touch({ identifier: 1, target: el, clientX: 200, clientY: 400 }); el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [t] })); });
  await p.waitForTimeout(400);
  ok(await visible(p, "#txn-sheet") && (await desplazada(p, "#txn-sheet .budget-sheet-panel")) === "", "si se suelta a mitad de camino, vuelve a su lugar");
  await deslizar(p, "#txn-sheet .budget-sheet-panel", 60, { pasos: 6, ms: 60 });
  await p.waitForTimeout(400);
  ok(await visible(p, "#txn-sheet"), "un arrastre corto y lento no la cierra");
  await deslizar(p, "#txn-sheet-chips", 0, { dx: -150 });
  await p.waitForTimeout(300);
  ok(await visible(p, "#txn-sheet") && (await desplazada(p, "#txn-sheet .budget-sheet-panel")) === "", "deslizar de lado (categorías) no mueve la hoja");
  await deslizar(p, "#txn-sheet .budget-sheet-panel", 420);
  await p.waitForTimeout(500);
  ok(!(await visible(p, "#txn-sheet")), "bajarla lo suficiente la cierra");
  ok(!(await p.evaluate(() => document.body.classList.contains("sheet-open"))), "y la página vuelve a desplazarse");
  await p.click("#txn-add");
  await p.waitForTimeout(400);
  ok(await visible(p, "#txn-sheet") && (await desplazada(p, "#txn-sheet .budget-sheet-panel")) === "", "al volver a abrirla aparece normal");
  await deslizar(p, "#txn-sheet .budget-sheet-panel", 90, { pasos: 3, ms: 16 });
  await p.waitForTimeout(500);
  ok(!(await visible(p, "#txn-sheet")), "un tirón rápido hacia abajo también la cierra");

  console.log("\nContenido desplazado");
  await p.click("#txn-add");
  await p.waitForTimeout(400);
  await p.click("#txn-sheet [data-txn-mas]");
  await p.waitForTimeout(500);
  ok(await visible(p, "#cat-sheet"), "se abre el selector de categorías");
  const largo = await p.$eval("#cat-sheet-body", el => el.scrollHeight > el.clientHeight + 50);
  if (largo) {
    await p.$eval("#cat-sheet-body", el => { el.scrollTop = 200; });
    await deslizar(p, "#cat-sheet-body", 300);
    await p.waitForTimeout(400);
    ok(await visible(p, "#cat-sheet"), "con la lista desplazada, arrastrar hacia abajo no cierra (primero sube la lista)");
    await p.$eval("#cat-sheet-body", el => { el.scrollTop = 0; });
  }
  await deslizar(p, "#cat-sheet-body", 450);
  await p.waitForTimeout(500);
  ok(!(await visible(p, "#cat-sheet")) && await visible(p, "#txn-sheet"), "arriba del todo, deslizar cierra el selector (y queda la transacción)");
  await deslizar(p, "#txn-sheet .budget-sheet-panel", 420);
  await p.waitForTimeout(500);

  console.log("\nHábitos (otro tipo de hoja)");
  await p.evaluate(() => { location.hash = "habitos"; });
  await p.waitForTimeout(500);
  await p.click('#hb-lista [data-detalle="h1"], #hb-lista .hb-nombre');
  await p.waitForTimeout(500);
  ok(await visible(p, ".hb-sheet"), "se abre el detalle del hábito");
  await deslizar(p, ".hb-sheet .muscle-sheet-panel", 400);
  await p.waitForTimeout(500);
  ok(!(await visible(p, ".hb-sheet")), "deslizar hacia abajo lo cierra");

  console.log("\nRunning: importar rutina");
  await p.evaluate(() => { location.hash = "running"; });
  await p.waitForTimeout(500);
  await p.evaluate(() => RutinasRunning._vistaPrevia("tipo,duracion\ncaminar,60\ncorrer,60\n", "Prueba.csv"));
  await p.waitForTimeout(500);
  ok(await visible(p, ".rr-hoja"), "se abre la vista previa");
  await deslizar(p, ".rr-hoja .budget-sheet-panel", 400);
  await p.waitForTimeout(500);
  ok(!(await visible(p, ".rr-hoja")) && (await p.evaluate(() => window.__fakeStore.colMap("users/test/rutinas_running").size)) === 0, "deslizar la cierra sin guardar");

  await p.context().close();
  await terminar(browser, srv);
})();
