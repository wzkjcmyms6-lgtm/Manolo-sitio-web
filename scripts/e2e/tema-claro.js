// Modo claro (D-126): la elección (Automático / Claro / Oscuro), sin
// parpadeo, y que los textos se lean en cada pantalla: mide el contraste de
// cada texto visible contra su fondo real (como Lighthouse) a 375 px.
// Uso: node scripts/e2e/tema-claro.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar, auditarContraste: auditar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const hoy = new Date();
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const SEED = {
  "users/test/habitos": { h1: { v: 2, name: "Leer", emoji: "📖", tipo: "sino", freqType: "diario", days: [true, true, true, true, true, true, true], done: [], registros: {}, createdAt: Date.now() - 864e5, inicio: iso(new Date(Date.now() - 864e5)), orden: 1 } },
  "users/test/rutinas": { r1: { name: "Push", orden: 0, v: 2, items: [{ nombre: "Press de banca (Barra)", exerciseId: "barbell-bench-press-medium-grip", series: 3, repsMin: 8, repsMax: 10, peso: 60, descansoSeg: 90, notas: "", incremento: null }], exercises: ["Press de banca (Barra)"] } },
  "users/test/entrenamientos": { w1: { date: iso(hoy), startedAt: Date.now() - 3600e3, name: "Push", durationMin: 45, exercises: [{ name: "Press de banca (Barra)", exerciseId: "barbell-bench-press-medium-grip", sets: [{ kg: 60, reps: 8 }, { kg: 60, reps: 8 }] }] } },
  "users/test/running": { c1: { date: iso(hoy), distance: 5, duration: 30, notes: "" } },
  "users/test/rutinas_running": { rr1: { v: 1, nombre: "Series", intervalos: [{ tipo: "caminar", seg: 300, texto: "Calentar" }, { tipo: "correr", seg: 60, texto: "" }], totalSeg: 360, creado: 1, orden: 1 } }
};
// Pantallas a revisar (hash, lo que tiene que verse).
const PANTALLAS = [
  ["inicio", "#panel-inicio"], ["habitos", "#hb-lista"], ["hab-stats", "#hb-stats"], ["ej-feed", "#panel-ej-feed"],
  ["gimnasio", "#gym-home"], ["ej-rangos", "#rk-app"], ["ej-perfil", "#ejd-dash"], ["running", "#rf-feed"], ["run-rutinas", "#running-rutinas"],
  ["run-progreso", "#running-dash"], ["finanzas", "#panel-finanzas"], ["fin-movimientos", "#panel-fin-movimientos"],
  ["fin-presupuesto", "#panel-fin-presupuesto"], ["fin-analisis", "#panel-fin-analisis"], ["inversiones", "#panel-inversiones"],
  ["libros", "#panel-libros"], ["biblia", "#panel-biblia"], ["tiempos", "#panel-tiempos"], ["lugares", "#panel-lugares"]
];

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();

  console.log("\nElegir la apariencia");
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#inicio", ancho: 375, alto: 812 });
  ok((await p.getAttribute("html", "data-modo")) === "oscuro" && (await p.getAttribute("html", "data-tema")) === "auto", "sin elegir nada: automático (el navegador de prueba está en oscuro)");
  await p.click('#panel-inicio [data-tema-abrir]');
  await p.waitForTimeout(400);
  ok(await p.isVisible(".tema-hoja .tema-ops") && (await p.$$(".tema-hoja [data-tema]")).length === 3, "Inicio › «Apariencia» abre las tres opciones");
  ok((await p.getAttribute('.tema-hoja [data-tema="auto"]', "aria-checked")) === "true", "«Automático» está elegido");
  await p.click('.tema-hoja [data-tema="claro"]');
  await p.waitForTimeout(300);
  ok((await p.getAttribute("html", "data-modo")) === "claro" && (await p.evaluate(() => localStorage.getItem("manolo.tema"))) === "claro", "«Claro» se aplica al tocar y queda guardado");
  ok((await p.getAttribute('meta[name="theme-color"]', "content")) === "#f4f2ec", "la barra del navegador también cambia de color");
  ok(await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === "rgb(244, 242, 236)", "el fondo de la página es claro");
  await captura(p, "tema-hoja-claro-375.png");
  await p.click('.tema-hoja [data-tema="oscuro"]');
  await p.waitForTimeout(300);
  ok((await p.getAttribute("html", "data-modo")) === "oscuro" && await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === "rgb(10, 10, 10)", "«Oscuro»: el de siempre");
  await p.click('.tema-hoja [data-tema="claro"]');
  await p.click(".tema-hoja .budget-sheet-close");
  await p.waitForTimeout(300);
  await p.reload();
  await p.waitForTimeout(900);
  ok((await p.getAttribute("html", "data-modo")) === "claro", "al volver a abrir la app sigue en claro (desde el primer pintado)");
  await p.evaluate(() => { location.hash = "inicio"; });
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.querySelector('#nav-links [data-tema-abrir]')), "también está en el menú ☰");

  console.log("\nContraste de los textos en modo claro (375 px)");
  let total = 0;
  for (const [hash, sel] of PANTALLAS) {
    await p.evaluate(h => { location.hash = h; window.scrollTo(0, 0); }, hash);
    await p.waitForTimeout(700);
    const visible = await p.isVisible(sel).catch(() => false);
    const malos = await p.evaluate(auditar);
    total += malos.length;
    ok(visible && !malos.length, `#${hash}${!visible ? " — no se ve " + sel : ""}${malos.length ? ` — ${malos.length} con poco contraste: ${malos.slice(0, 4).map(m => `«${m.texto}» ${m.k} (${m.donde})`).join(" · ")}` : ""}`);
    await captura(p, `claro-${hash}.png`);
  }
  console.log(`  (${total} textos con poco contraste en total)`);

  console.log("\nHojas y pantallas completas en modo claro");
  // Cada una: cómo abrirla, qué tiene que verse y cómo cerrarla.
  const HOJAS = [
    ["nuevo gasto", "finanzas", async () => p.click("#txn-add"), ".budget-sheet:not([hidden]) .budget-sheet-panel"],
    ["nuevo hábito", "habitos", async () => p.click("#hb-nuevo"), ".js-sheet:not([hidden]) .budget-sheet-panel, .muscle-sheet:not([hidden]) .muscle-sheet-panel"],
    ["editor de rutina (gimnasio)", "gimnasio", async () => p.click("#rut-nueva"), "#rut-editor .budget-sheet-panel"],
    ["editor de rutina (Running)", "run-rutinas", async () => p.click('#running-rutinas [data-rg="nueva"]'), ".rre-raiz .budget-sheet-panel"],
    ["nuevo lugar", "lugares", async () => p.click('[data-lug="nuevo"]'), ".lug-hoja .budget-sheet-panel, .js-sheet:not([hidden]) .budget-sheet-panel"],
    ["lector de la Biblia", "biblia", async () => { await p.evaluate(() => window.BibliaLector.abrir("John", 3)); await p.waitForTimeout(700); }, "#bbl-lector"]
  ];
  for (const [nombre, hash, abrirla, sel] of HOJAS) {
    await p.evaluate(h => { location.hash = h; window.scrollTo(0, 0); }, hash);
    await p.waitForTimeout(700);
    await abrirla().catch(() => {});
    await p.waitForTimeout(600);
    const visible = await p.isVisible(sel).catch(() => false);
    const malos = await p.evaluate(auditar);
    ok(visible && !malos.length, `${nombre}${!visible ? " — no se ve " + sel : ""}${malos.length ? ` — ${malos.length} con poco contraste: ${malos.slice(0, 4).map(m => `«${m.texto}» ${m.k} (${m.donde})`).join(" · ")}` : ""}`);
    await captura(p, `claro-hoja-${hash}.png`);
    await p.keyboard.press("Escape").catch(() => {});
    await p.evaluate(() => { if (window.BibliaLector) window.BibliaLector.cerrar(); document.querySelectorAll(".js-sheet:not([hidden]) [data-cerrar-hoja], .js-sheet:not([hidden]) .budget-sheet-close").forEach(b => b.click()); });
    await p.waitForTimeout(400);
  }
  ok(!p.errores.length, "sin errores de página");
  await p.context().close();

  console.log("\nAutomático sigue al iPhone");
  const q = await abrir(browser, base, { __SEED__: SEED }, { hash: "#inicio", ancho: 375, alto: 812 });
  await q.emulateMedia({ colorScheme: "light" });
  await q.waitForTimeout(300);
  ok((await q.getAttribute("html", "data-modo")) === "claro", "con el iPhone en claro, la app se pone clara sola");
  await q.emulateMedia({ colorScheme: "dark" });
  await q.waitForTimeout(300);
  ok((await q.getAttribute("html", "data-modo")) === "oscuro", "y vuelve a oscuro cuando el iPhone cambia");
  await q.context().close();
  await terminar(browser, srv);
})();
